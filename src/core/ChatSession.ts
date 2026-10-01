// One conversation in AgentHub: owns the agent session, the view state and pending permissions.
// UI-agnostic: the view subscribes to snapshots and calls the methods below (plan §4.2).

import type {
  AgentAdapter,
  AgentSession,
  Disposable,
  HostBridge,
  SessionOptions,
} from './AgentAdapter';
import { AgentError } from './errors';
import { createInitialState, reduce, type SessionAction } from './reducer';
import type {
  AgentEvent,
  ConfigOption,
  PermissionOutcome,
  PermissionRequest,
  PromptBlock,
  SessionViewState,
  TranscriptItem,
} from './types';

export type HostServices = Omit<HostBridge, 'requestPermission'>;

export interface ChatSessionInit {
  localId: string;
  adapter: AgentAdapter;
  host: HostServices;
  options: SessionOptions;
  title?: string;
  /** Stored session being reopened: its transcript is shown and the agent is asked to continue it. */
  restore?: { items: TranscriptItem[]; nativeSessionId?: string };
  /** Options the agent announced when it last started, shown until it starts again. */
  initialConfigOptions?: ConfigOption[];
  /** Called with the options an agent announces when it starts (to remember them). */
  onAgentReady?: (configOptions: ConfigOption[]) => void;
  now?: () => number;
}

const DEBUG_CAPACITY = 500;
const TITLE_LENGTH = 60;

export class ChatSession {
  private state: SessionViewState;
  private readonly listeners = new Set<(state: SessionViewState) => void>();
  private readonly pending = new Map<string, (outcome: PermissionOutcome) => void>();
  private readonly debugLines: string[] = [];
  private agent: AgentSession | null = null;
  private starting: Promise<AgentSession | null> | null = null;
  private turnCounter = 0;
  private readonly pendingConfig: Record<string, string> = {};
  private agentStarts = 0;
  /** Set when the agent was stopped for being idle: the next start continues the same conversation. */
  private resumeAfterIdle: string | undefined;
  private lastActivityAt: number;
  private disposed = false;

  constructor(private readonly init: ChatSessionInit) {
    this.lastActivityAt = this.now();
    // Keep local ids unique after reopening a stored transcript.
    this.turnCounter = init.restore?.items.filter((item) => item.kind === 'user').length ?? 0;
    this.state = createInitialState({
      localId: init.localId,
      agentId: init.adapter.id,
      cwd: init.options.cwd,
      title: init.title,
      items: init.restore?.items,
      nativeSessionId: init.restore?.nativeSessionId,
      configOptions: init.initialConfigOptions,
    });
  }

  get localId(): string {
    return this.init.localId;
  }

  getState(): SessionViewState {
    return this.state;
  }

  subscribe(listener: (state: SessionViewState) => void): Disposable {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  /** Raw agent output (stderr, unknown updates) for the debug panel. */
  debugLog(): readonly string[] {
    return this.debugLines;
  }

  /** A turn is in progress. Starting the agent is not "busy": messages sent meanwhile wait for it. */
  get busy(): boolean {
    const { status } = this.state;
    return status === 'running' || status === 'awaiting-permission';
  }

  /** Sends one user message. Starts the agent on first use. Ignored while a turn is running. */
  async send(blocks: PromptBlock[]): Promise<void> {
    if (this.disposed || this.busy || blocks.length === 0) return;
    const now = this.init.now?.() ?? Date.now();
    this.touch();
    this.dispatch({ type: 'local.user', id: `user-${++this.turnCounter}`, blocks, at: now });
    if (!this.state.title) this.dispatch({ type: 'local.title', title: titleFrom(blocks) });

    const agent = await this.ensureAgent();
    if (!agent) return;
    this.dispatch({ type: 'local.status', status: 'running' });
    try {
      await agent.prompt(blocks);
    } catch (error) {
      this.reportError(error);
      this.dispatch({ type: 'turn.end', stopReason: 'error' });
    }
  }

  /** When the session last did something (a message, an agent event). */
  get lastActivity(): number {
    return this.lastActivityAt;
  }

  /** Whether an agent process is running for this session. */
  get hasAgent(): boolean {
    return this.agent !== null;
  }

  /**
   * Stops an idle agent to free its process (plan T4.5). The conversation stays: the next message
   * starts the agent again and continues it (resume/load, ADR-022). No-op during a turn.
   */
  async suspend(): Promise<void> {
    if (!this.agent || this.busy || this.disposed) return;
    const agent = this.agent;
    this.agent = null;
    this.resumeAfterIdle = agent.nativeSessionId ?? this.state.nativeSessionId;
    await agent.dispose();
  }

  private touch(): void {
    this.lastActivityAt = this.now();
  }

  private now(): number {
    return this.init.now?.() ?? Date.now();
  }

  /** Starts the agent ahead of the first message so its options can be set first. */
  async prepare(): Promise<void> {
    if (!this.disposed && !this.agent) await this.ensureAgent();
  }

  async cancel(): Promise<void> {
    this.resolveAllPending({ outcome: 'cancelled' });
    await this.agent?.cancel();
  }

  resolvePermission(id: string, outcome: PermissionOutcome): void {
    const resolve = this.pending.get(id);
    if (!resolve) return;
    this.pending.delete(id);
    this.dispatch({ type: 'local.permission.resolve', id, outcome });
    resolve(outcome);
  }

  async setConfigOption(id: string, value: string): Promise<void> {
    if (!this.agent) {
      this.dispatch({
        type: 'config',
        configOptions: this.state.configOptions.map((option) =>
          option.id === id ? { ...option, currentValue: value } : option,
        ),
      });
      // Not started: apply it at start-up. Starting: it began with the old value, so set it after.
      if (!this.starting) {
        this.pendingConfig[id] = value;
        return;
      }
      await this.starting;
      if (!this.agent) return;
    }
    try {
      await this.agent.setConfigOption?.(id, value);
    } catch (error) {
      this.reportError(error);
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.resolveAllPending({ outcome: 'cancelled' });
    this.dispatch({ type: 'local.status', status: 'closed' });
    this.listeners.clear();
    const agent = this.agent ?? (await this.starting);
    await agent?.dispose();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private ensureAgent(): Promise<AgentSession | null> {
    if (this.agent) return Promise.resolve(this.agent);
    this.starting ??= this.startAgent();
    return this.starting;
  }

  private async startAgent(): Promise<AgentSession | null> {
    this.dispatch({ type: 'local.status', status: 'starting' });
    const host: HostBridge = {
      ...this.init.host,
      requestPermission: (request) => this.requestPermission(request),
    };
    try {
      const { adapter } = this.init;
      const options = {
        ...this.init.options,
        config: { ...this.init.options.config, ...this.pendingConfig },
      };
      // Only the first agent of a reopened session resumes; after a crash we start fresh.
      const firstStart = this.agentStarts++ === 0;
      const resumeId =
        this.resumeAfterIdle ?? (firstStart ? this.init.restore?.nativeSessionId : undefined);
      this.resumeAfterIdle = undefined;
      const agent =
        resumeId && adapter.loadSession
          ? await adapter.loadSession(resumeId, options, host)
          : await adapter.createSession(options, host);
      if (this.disposed) {
        await agent.dispose();
        return null;
      }
      agent.onEvent((event) => this.onAgentEvent(event));
      this.agent = agent;
      if (resumeId !== undefined && !agent.restored) {
        this.dispatch({
          type: 'local.notice',
          level: 'info',
          notice: { key: 'contextNotRestored' },
        });
      }
      return agent;
    } catch (error) {
      this.reportError(error);
      this.dispatch({ type: 'local.status', status: 'error' });
      return null;
    } finally {
      this.starting = null;
    }
  }

  private onAgentEvent(event: AgentEvent): void {
    this.touch();
    if (event.type === 'session.ready' && event.configOptions && event.configOptions.length > 0) {
      this.init.onAgentReady?.(event.configOptions);
    }
    if (event.type === 'debug') {
      this.debugLines.push(`[${event.source}] ${event.line}`);
      if (this.debugLines.length > DEBUG_CAPACITY) this.debugLines.shift();
      return;
    }
    if (event.type === 'turn.end') this.resolveAllPending({ outcome: 'cancelled' });
    if (event.type === 'error' && !event.recoverable) {
      // The process is gone; the next message starts a fresh agent.
      const dead = this.agent;
      this.agent = null;
      void dead?.dispose();
    }
    this.dispatch(event);
  }

  private requestPermission(request: PermissionRequest): Promise<PermissionOutcome> {
    if (this.disposed) return Promise.resolve({ outcome: 'cancelled' });
    return new Promise((resolve) => {
      this.pending.set(request.id, resolve);
      this.dispatch({ type: 'local.permission.request', request });
    });
  }

  private resolveAllPending(outcome: PermissionOutcome): void {
    for (const id of [...this.pending.keys()]) this.resolvePermission(id, outcome);
  }

  private reportError(error: unknown): void {
    const notice =
      error instanceof AgentError
        ? {
            key: 'agentError' as const,
            message: error.message,
            hint: error.hint,
            detail: error.detail,
            kind: error.kind,
          }
        : {
            key: 'agentError' as const,
            message: error instanceof Error ? error.message : String(error),
          };
    this.dispatch({ type: 'local.notice', level: 'error', notice });
  }

  private dispatch(action: SessionAction): void {
    const next = reduce(this.state, action);
    if (next === this.state) return;
    this.state = next;
    this.listeners.forEach((listener) => listener(next));
  }
}

function titleFrom(blocks: PromptBlock[]): string {
  const text = blocks
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > TITLE_LENGTH ? `${text.slice(0, TITLE_LENGTH - 1)}…` : text;
}

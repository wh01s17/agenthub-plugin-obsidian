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
import {
  dangerousModeOptions,
  isDangerousMode,
  type ConfirmDangerousMode,
} from './permissionModes';
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
  confirmDangerousMode?: ConfirmDangerousMode;
  /** Called when the user's change of an option takes effect, so it can be kept for new sessions. */
  onConfigChosen?: (id: string, value: string) => void;
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
  private modeConfirmation: AbortController | null = null;
  private configuring = false;

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
    return this.configuring || status === 'running' || status === 'awaiting-permission';
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

  /** Renames the session (tab and history); an empty title is ignored. */
  rename(title: string): void {
    const trimmed = title.trim();
    if (this.disposed || !trimmed || trimmed === this.state.title) return;
    this.dispatch({ type: 'local.title', title: trimmed });
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
    this.modeConfirmation?.abort();
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
    if (this.disposed || this.busy || this.configuring) return;
    this.configuring = true;
    try {
      if (isDangerousMode(value) && !(await this.approveMode(id, value))) return;
      if (this.disposed) return;
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
          this.init.onConfigChosen?.(id, value);
          return;
        }
        await this.starting;
        if (!this.agent) return;
      }
      await this.agent.setConfigOption?.(id, value);
      this.init.onConfigChosen?.(id, value);
    } catch (error) {
      this.reportError(error);
    } finally {
      this.configuring = false;
      if (!this.disposed) this.dispatch({ type: 'local.status', status: this.state.status });
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.modeConfirmation?.abort();
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
      const approved = new Map<string, string>();
      for (const [id, value] of Object.entries(options.config)) {
        if (!isDangerousMode(value)) continue;
        if (!(await this.approveMode(id, value)))
          throw new AgentError('unsafe-mode', 'Unrestricted mode was not enabled.');
        approved.set(id, value);
      }
      if (this.disposed) return null;
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
      try {
        // Resuming can restore an upstream mode even when no dangerous initial setting was supplied.
        for (const option of dangerousModeOptions(this.state.configOptions)) {
          if (approved.get(option.id) === option.currentValue) continue;
          if (!(await this.approveMode(option.id, option.currentValue)))
            throw new AgentError('unsafe-mode', 'Unrestricted mode was not enabled.');
        }
      } catch (error) {
        await agent.dispose();
        throw error;
      }
      if (this.disposed) {
        await agent.dispose();
        return null;
      }
      this.agent = agent;
      // Started ahead of a message (prepare): back to "Ready". A message sent meanwhile already
      // switched the status to running, so leave that alone.
      if (this.state.status === 'starting') this.dispatch({ type: 'local.status', status: 'idle' });
      if (resumeId !== undefined && !agent.restored) {
        this.dispatch({
          type: 'local.notice',
          level: 'info',
          notice: { key: 'contextNotRestored' },
        });
      }
      return agent;
    } catch (error) {
      if (this.disposed) return null;
      this.reportError(error);
      this.dispatch({ type: 'local.status', status: 'error' });
      return null;
    } finally {
      this.starting = null;
    }
  }

  private onAgentEvent(event: AgentEvent): void {
    if (this.disposed) return;
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

  private async approveMode(optionId: string, value: string): Promise<boolean> {
    if (!this.init.confirmDangerousMode || this.disposed) return false;
    const controller = new AbortController();
    this.modeConfirmation = controller;
    const previous = this.state.status;
    this.dispatch({ type: 'local.status', status: 'awaiting-permission' });
    try {
      const allowed = await this.init.confirmDangerousMode(
        { agentId: this.state.agentId, optionId, value, sessionTitle: this.state.title },
        controller.signal,
      );
      return allowed && !controller.signal.aborted && !this.disposed;
    } finally {
      this.modeConfirmation = null;
      if (!this.disposed) this.dispatch({ type: 'local.status', status: previous });
    }
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

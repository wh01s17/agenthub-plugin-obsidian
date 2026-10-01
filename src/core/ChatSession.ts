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
  PermissionOutcome,
  PermissionRequest,
  PromptBlock,
  SessionViewState,
} from './types';

export type HostServices = Omit<HostBridge, 'requestPermission'>;

export interface ChatSessionInit {
  localId: string;
  adapter: AgentAdapter;
  host: HostServices;
  options: SessionOptions;
  title?: string;
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
  private disposed = false;

  constructor(private readonly init: ChatSessionInit) {
    this.state = createInitialState({
      localId: init.localId,
      agentId: init.adapter.id,
      cwd: init.options.cwd,
      title: init.title,
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

  get busy(): boolean {
    const { status } = this.state;
    return status === 'starting' || status === 'running' || status === 'awaiting-permission';
  }

  /** Sends one user message. Starts the agent on first use. Ignored while a turn is running. */
  async send(blocks: PromptBlock[]): Promise<void> {
    if (this.disposed || this.busy || blocks.length === 0) return;
    const now = this.init.now?.() ?? Date.now();
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
    const agent = await this.ensureAgent();
    try {
      await agent?.setConfigOption?.(id, value);
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
      const agent = await this.init.adapter.createSession(this.init.options, host);
      if (this.disposed) {
        await agent.dispose();
        return null;
      }
      agent.onEvent((event) => this.onAgentEvent(event));
      this.agent = agent;
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

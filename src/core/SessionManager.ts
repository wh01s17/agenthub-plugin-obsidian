// Creates, finds and closes chat sessions (plan §4.2). The idle reaper and persistence come in Fase 4.

import type { AgentAdapter, SessionOptions } from './AgentAdapter';
import { ChatSession, type HostServices } from './ChatSession';
import type { AgentId, ConfigOption, TranscriptItem } from './types';

export interface SessionManagerDeps {
  getAdapter(agentId: AgentId): AgentAdapter | undefined;
  host: HostServices;
  /** Per-agent options (cwd, initial config, vault instructions). */
  sessionOptions(agentId: AgentId): SessionOptions;
  newId?: () => string;
  onCreate?: (session: ChatSession) => void;
  /** Options each agent announced when it last started (shown before it starts again). */
  knownConfigOptions?: (agentId: AgentId) => ConfigOption[] | undefined;
  rememberConfigOptions?: (agentId: AgentId, options: ConfigOption[]) => void;
}

export class SessionManager {
  private readonly sessions = new Map<string, ChatSession>();
  private counter = 0;

  constructor(private readonly deps: SessionManagerDeps) {}

  /** Returns `undefined` when the agent is unknown (e.g. removed from settings). */
  create(agentId: AgentId, localId?: string): ChatSession | undefined {
    const adapter = this.deps.getAdapter(agentId);
    if (!adapter) return undefined;
    const id = localId ?? this.deps.newId?.() ?? `session-${Date.now()}-${++this.counter}`;
    const session = new ChatSession({
      localId: id,
      adapter,
      host: this.deps.host,
      options: this.deps.sessionOptions(agentId),
      ...this.configHooks(agentId),
    });
    this.sessions.set(id, session);
    this.deps.onCreate?.(session);
    return session;
  }

  /** Reopens a stored session under its original local id (plan T4.2/T4.3). */
  restore(stored: {
    localId: string;
    agentId: AgentId;
    title: string;
    nativeSessionId?: string;
    items: TranscriptItem[];
  }): ChatSession | undefined {
    const existing = this.sessions.get(stored.localId);
    if (existing) return existing;
    const adapter = this.deps.getAdapter(stored.agentId);
    if (!adapter) return undefined;
    const session = new ChatSession({
      localId: stored.localId,
      adapter,
      host: this.deps.host,
      options: this.deps.sessionOptions(stored.agentId),
      title: stored.title,
      restore: { items: stored.items, nativeSessionId: stored.nativeSessionId },
      ...this.configHooks(stored.agentId),
    });
    this.sessions.set(stored.localId, session);
    this.deps.onCreate?.(session);
    return session;
  }

  private configHooks(agentId: AgentId) {
    return {
      initialConfigOptions: this.deps.knownConfigOptions?.(agentId),
      onAgentReady: (options: ConfigOption[]) =>
        this.deps.rememberConfigOptions?.(agentId, options),
    };
  }

  get(localId: string): ChatSession | undefined {
    return this.sessions.get(localId);
  }

  list(): ChatSession[] {
    return [...this.sessions.values()];
  }

  async close(localId: string): Promise<void> {
    const session = this.sessions.get(localId);
    this.sessions.delete(localId);
    await session?.dispose();
  }

  async disposeAll(): Promise<void> {
    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    await Promise.all(sessions.map((session) => session.dispose()));
  }
}

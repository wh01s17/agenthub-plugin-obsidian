// Creates, finds and closes chat sessions (plan §4.2). The idle reaper and persistence come in Fase 4.

import type { AgentAdapter, SessionOptions } from './AgentAdapter';
import { ChatSession, type HostServices } from './ChatSession';
import type { AgentId } from './types';

export interface SessionManagerDeps {
  getAdapter(agentId: AgentId): AgentAdapter | undefined;
  host: HostServices;
  /** Per-agent options (cwd, initial config, vault instructions). */
  sessionOptions(agentId: AgentId): SessionOptions;
  newId?: () => string;
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
    });
    this.sessions.set(id, session);
    return session;
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

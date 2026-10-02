import type { App } from 'obsidian';
import type { AgentRegistry } from '../agents/AgentRegistry';
import type { PromptHistory } from '../core/PromptHistory';
import type { SessionManager } from '../core/SessionManager';
import type { SessionViewState } from '../core/types';
import type { NoteContext } from '../host/NoteContext';
import type { AgentHubSettings } from '../settings/settings';
import type { StoredSession } from '../storage/SessionStore';
import type { SessionHistory } from './components/HistoryPanel';

/** What a chat view needs from the plugin. */
export interface ViewHost {
  readonly app: App;
  readonly settings: AgentHubSettings;
  readonly agents: AgentRegistry;
  readonly sessions: SessionManager;
  readonly notes: NoteContext;
  /** Prompts sent since Obsidian started, recalled with the arrow keys. */
  readonly prompts: PromptHistory;
  /** Saved sessions; `undefined` when history is disabled. */
  readonly history:
    (SessionHistory & { load(localId: string): Promise<StoredSession | undefined> }) | undefined;
  openSettings(): void;
  /** Writes the session as a Markdown note and opens it (T4.4). */
  exportSession(state: SessionViewState): Promise<void>;
  /** Absolute working directory for new sessions (for display). */
  workingDirectory(): string;
}

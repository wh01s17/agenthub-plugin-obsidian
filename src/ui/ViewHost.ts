import type { App } from 'obsidian';
import type { AgentRegistry } from '../agents/AgentRegistry';
import type { SessionManager } from '../core/SessionManager';
import type { AgentHubSettings } from '../settings/settings';

/** What a chat view needs from the plugin. */
export interface ViewHost {
  readonly app: App;
  readonly settings: AgentHubSettings;
  readonly agents: AgentRegistry;
  readonly sessions: SessionManager;
  openSettings(): void;
  /** Absolute working directory for new sessions (for display). */
  workingDirectory(): string;
}

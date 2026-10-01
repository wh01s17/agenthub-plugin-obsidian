import { ItemView, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { h, render } from 'preact';
import { AGENTHUB_ICON, VIEW_TYPE_AGENTHUB } from '../constants';
import type { ChatSession } from '../core/ChatSession';
import { t } from '../i18n';
import { App } from './App';
import type { ViewHost } from './ViewHost';

export interface AgentHubViewState {
  sessionId: string | null;
}

export function parseViewState(state: unknown): AgentHubViewState {
  if (typeof state === 'object' && state !== null && 'sessionId' in state) {
    const { sessionId } = state;
    if (typeof sessionId === 'string' && sessionId.length > 0) return { sessionId };
  }
  return { sessionId: null };
}

/** Sidebar view showing one chat session. Closing the view ends its session (and agent process). */
export class AgentHubView extends ItemView {
  private session: ChatSession | null = null;
  private restoredId: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly host: ViewHost,
  ) {
    super(leaf);
  }

  override getViewType(): string {
    return VIEW_TYPE_AGENTHUB;
  }

  override getDisplayText(): string {
    return t('viewTitle');
  }

  override getIcon(): string {
    return AGENTHUB_ICON;
  }

  override async onOpen(): Promise<void> {
    this.contentEl.addClass('agenthub-view');
    this.ensureSession();
    this.renderApp();
  }

  override async onClose(): Promise<void> {
    render(null, this.contentEl);
    const session = this.session;
    this.session = null;
    if (session) await this.host.sessions.close(session.localId);
  }

  override getState(): Record<string, unknown> {
    return { ...super.getState(), sessionId: this.session?.localId ?? this.restoredId };
  }

  override async setState(state: unknown, result: ViewStateResult): Promise<void> {
    // Sessions are not persisted yet (Fase 4): a restored id only survives while the plugin runs.
    this.restoredId = parseViewState(state).sessionId;
    const existing = this.restoredId ? this.host.sessions.get(this.restoredId) : undefined;
    if (existing && existing !== this.session) {
      const replaced = this.session;
      this.session = existing;
      if (replaced) void this.host.sessions.close(replaced.localId);
    }
    this.ensureSession();
    this.renderApp();
    await super.setState(state, result);
  }

  /** Starts a new session with `agentId` (or the current agent), ending the current one. */
  startNewSession(agentId?: string): void {
    const previous = this.session;
    this.session = null;
    this.ensureSession(agentId ?? previous?.getState().agentId);
    if (previous) void this.host.sessions.close(previous.localId);
    this.renderApp();
    this.host.app.workspace.requestSaveLayout();
  }

  private ensureSession(preferredAgent?: string): void {
    if (this.session) return;
    const { agents, settings, sessions } = this.host;
    const candidates = [
      preferredAgent,
      settings.defaultAgentId,
      ...agents.enabled().map((a) => a.id),
    ];
    for (const agentId of candidates) {
      if (!agentId) continue;
      const session = sessions.create(agentId);
      if (session) {
        this.session = session;
        return;
      }
    }
  }

  private renderApp(): void {
    render(
      h(App, {
        host: this.host,
        session: this.session,
        onAgentChange: (agentId: string) => this.startNewSession(agentId),
        onNewSession: () => this.startNewSession(),
      }),
      this.contentEl,
    );
  }
}

import { ItemView, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { h, render } from 'preact';
import { AGENTHUB_ICON, VIEW_TYPE_AGENTHUB } from '../constants';
import type { ChatSession } from '../core/ChatSession';
import type { SelectionRef } from '../core/PromptBuilder';
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
  private selection: SelectionRef | null = null;

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
    if (session) await this.release(session.localId);
  }

  override getState(): Record<string, unknown> {
    return { ...super.getState(), sessionId: this.session?.localId ?? this.restoredId };
  }

  override async setState(state: unknown, result: ViewStateResult): Promise<void> {
    this.restoredId = parseViewState(state).sessionId;
    // A live session (same plugin run) or a saved one (after restarting Obsidian, T4.3).
    if (this.restoredId && this.restoredId !== this.session?.localId) {
      await this.openSession(this.restoredId, false);
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
    if (previous) void this.release(previous.localId);
    this.renderApp();
    this.host.app.workspace.requestSaveLayout();
  }

  /**
   * Shows a session in this view: a live one, or a saved one reopened from history (T4.2). The
   * replaced session ends (it stays saved). Returns false when it cannot be opened.
   */
  async openSession(localId: string, render = true): Promise<boolean> {
    if (this.session?.localId === localId) return true;
    let session = this.host.sessions.get(localId);
    if (!session) {
      const stored = await this.host.history?.load(localId).catch(() => undefined);
      if (!stored) return false;
      session = this.host.sessions.restore({ ...stored.entry, items: stored.items });
      if (!session) return false;
    }
    const previous = this.session;
    this.session = session;
    if (previous) void this.release(previous.localId);
    if (render) {
      this.renderApp();
      this.host.app.workspace.requestSaveLayout();
    }
    return true;
  }

  /** Deletes a saved session; the current one is closed first so closing cannot save it again. */
  async deleteSession(localId: string): Promise<void> {
    if (this.session?.localId === localId) {
      const current = this.session;
      this.session = null;
      this.ensureSession(current.getState().agentId);
      this.renderApp();
      await this.host.sessions.close(localId);
    }
    await this.host.history?.delete(localId);
  }

  /** Ends a session this view stops showing, unless another AgentHub view still shows it. */
  private async release(localId: string): Promise<void> {
    const shownElsewhere = this.host.app.workspace
      .getLeavesOfType(VIEW_TYPE_AGENTHUB)
      .some(
        (leaf) =>
          leaf.view !== this && leaf.view instanceof AgentHubView && leaf.view.shows(localId),
      );
    if (!shownElsewhere) await this.host.sessions.close(localId);
  }

  shows(localId: string): boolean {
    return this.session?.localId === localId;
  }

  /** Attaches an editor selection to the next message (command "Send selection"). */
  attachSelection(selection: SelectionRef): void {
    this.selection = selection;
    this.renderApp();
    this.focusComposer();
  }

  focusComposer(): void {
    this.contentEl.querySelector<HTMLTextAreaElement>('.agenthub-composer-input')?.focus();
  }

  /** Exports the session shown in this view to a note. */
  exportSession(): Promise<void> {
    return this.session ? this.host.exportSession(this.session.getState()) : Promise.resolve();
  }

  /** Stops the running turn, if any. */
  stop(): void {
    void this.session?.cancel();
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
    // Start the agent in the background so its options (mode, model…) can be chosen first.
    void this.session?.prepare();
    render(
      h(App, {
        host: this.host,
        session: this.session,
        onAgentChange: (agentId: string) => this.startNewSession(agentId),
        onNewSession: () => this.startNewSession(),
        selection: this.selection,
        onOpenSession: (localId: string) => void this.openSession(localId),
        onDeleteSession: (localId: string) => this.deleteSession(localId),
        onClearSelection: () => {
          this.selection = null;
          this.renderApp();
        },
      }),
      this.contentEl,
    );
  }
}

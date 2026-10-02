import { ItemView, Notice, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { Fragment, h, render } from 'preact';
import { AGENTHUB_ICON, VIEW_TYPE_AGENTHUB } from '../constants';
import type { ChatSession } from '../core/ChatSession';
import type { SelectionRef } from '../core/PromptBuilder';
import { t } from '../i18n';
import { App, type AppProps } from './App';
import { TabBar } from './components/TabBar';
import { TabActivity } from './tabs';
import type { ViewHost } from './ViewHost';

export interface AgentHubViewState {
  /** Local ids of the sessions shown as tabs, in order. */
  tabs: string[];
  activeTab: string | null;
}

const PERMISSION_NOTICE_MS = 10_000;

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function parseViewState(state: unknown): AgentHubViewState {
  if (typeof state !== 'object' || state === null) return { tabs: [], activeTab: null };
  const record = state as Record<string, unknown>;
  const tabs = Array.isArray(record.tabs) ? [...new Set(record.tabs.filter(isId))] : [];
  // 0.2.x saved a single session as `sessionId` (ADR-022).
  if (tabs.length === 0 && isId(record.sessionId)) tabs.push(record.sessionId);
  const { activeTab } = record;
  return {
    tabs,
    activeTab: isId(activeTab) && tabs.includes(activeTab) ? activeTab : (tabs[0] ?? null),
  };
}

/**
 * Sidebar view with one tab per chat session (ADR-033). Every tab keeps its own agent process;
 * closing a tab or the view ends the sessions no other AgentHub view shows.
 */
export class AgentHubView extends ItemView {
  private tabs: ChatSession[] = [];
  private activeId: string | null = null;
  private restored: AgentHubViewState = { tabs: [], activeTab: null };
  /** Selection from "Send selection", attached to the tab that was active when it arrived. */
  private selection: { tabId: string; ref: SelectionRef } | null = null;
  private readonly activity = new TabActivity({
    onChange: () => this.renderApp(false),
    onBackgroundPermission: (session) => {
      new Notice(t('tabPermissionNotice', { tab: this.tabTitle(session) }), PERMISSION_NOTICE_MS);
    },
  });

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
    this.ensureTab();
    this.renderApp();
  }

  override async onClose(): Promise<void> {
    render(null, this.contentEl);
    this.activity.dispose();
    const tabs = this.tabs;
    this.tabs = [];
    this.activeId = null;
    await Promise.all(tabs.map((session) => this.release(session.localId)));
  }

  override getState(): Record<string, unknown> {
    const tabs = this.tabs.length > 0 ? this.tabs.map((s) => s.localId) : this.restored.tabs;
    const activeTab = this.active?.localId ?? this.restored.activeTab;
    // `sessionId` lets a 0.2.x build reopen at least the active tab after a downgrade.
    return { ...super.getState(), tabs, activeTab, sessionId: activeTab };
  }

  override async setState(state: unknown, result: ViewStateResult): Promise<void> {
    this.restored = parseViewState(state);
    const { tabs: wanted, activeTab } = this.restored;
    const current = this.tabs.map((s) => s.localId);
    if (wanted.length > 0 && wanted.join('\n') !== current.join('\n')) {
      // Live sessions (same plugin run) or saved ones (after restarting Obsidian, T4.3).
      const opened = (await Promise.all(wanted.map((id) => this.resolve(id)))).filter(
        (session): session is ChatSession => session !== undefined,
      );
      if (opened.length > 0) {
        const previous = this.tabs;
        this.tabs = opened;
        for (const session of previous) {
          if (!opened.includes(session)) void this.release(session.localId);
        }
      }
    }
    if (activeTab && this.tabs.some((s) => s.localId === activeTab)) this.activeId = activeTab;
    this.ensureTab();
    this.renderApp();
    await super.setState(state, result);
  }

  /** The session of the tab being looked at. */
  get active(): ChatSession | null {
    return this.tabs.find((s) => s.localId === this.activeId) ?? this.tabs[0] ?? null;
  }

  /** Opens a tab with `agentId` (default: the default agent) next to the active one. */
  newTab(agentId?: string): void {
    const session = this.createSession(agentId);
    if (!session) return;
    this.insertTab(session);
    this.changed();
  }

  /** Closes a tab (default: the active one) and ends its session; the view always keeps one tab. */
  closeTab(localId = this.active?.localId): void {
    const session = localId ? this.removeTab(localId) : undefined;
    if (!session) return;
    void this.release(session.localId);
    this.changed();
  }

  selectTab(localId: string): void {
    if (!this.tabs.some((s) => s.localId === localId) || this.activeId === localId) return;
    this.activeId = localId;
    this.changed();
  }

  /** Moves to the next (`1`) or previous (`-1`) tab, wrapping around. */
  cycleTab(step: 1 | -1): void {
    const index = this.tabs.findIndex((s) => s === this.active);
    const next = this.tabs[(index + step + this.tabs.length) % this.tabs.length];
    if (next) this.selectTab(next.localId);
  }

  /** Starts a new session in the active tab with `agentId` (or the tab's agent), ending the old one. */
  startNewSession(agentId?: string): void {
    const current = this.active;
    if (current) this.replaceTab(current, agentId);
    else this.newTab(agentId);
  }

  /**
   * Shows a session: a live one, or a saved one reopened from history (T4.2). It gets its own
   * tab, unless it is already open or the active tab is still empty. Returns false when it
   * cannot be opened.
   */
  async openSession(localId: string): Promise<boolean> {
    if (this.tabs.some((s) => s.localId === localId)) {
      this.selectTab(localId);
      return true;
    }
    const session = await this.resolve(localId);
    if (!session) return false;
    const current = this.active;
    const reuse = current && !current.busy && current.getState().items.length === 0;
    this.insertTab(session);
    if (reuse) {
      this.tabs = this.tabs.filter((s) => s !== current);
      void this.release(current.localId);
    }
    this.changed();
    return true;
  }

  /** Deletes a saved session; its tab is closed first so closing cannot save it again. */
  async deleteSession(localId: string): Promise<void> {
    if (this.removeTab(localId)) {
      this.changed();
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
    return this.tabs.some((s) => s.localId === localId);
  }

  /** Attaches an editor selection to the next message of the active tab ("Send selection"). */
  attachSelection(selection: SelectionRef): void {
    const tab = this.active;
    if (!tab) return;
    this.selection = { tabId: tab.localId, ref: selection };
    this.renderApp();
    this.focusComposer();
  }

  focusComposer(): void {
    this.contentEl
      .querySelector<HTMLTextAreaElement>('.agenthub-app:not([hidden]) .agenthub-composer-input')
      ?.focus();
  }

  /** Exports the session of the active tab to a note. */
  exportSession(): Promise<void> {
    const session = this.active;
    return session ? this.host.exportSession(session.getState()) : Promise.resolve();
  }

  /** Stops the running turn of the active tab, if any. */
  stop(): void {
    void this.active?.cancel();
  }

  /** Redraws with the current settings (e.g. after an appearance change) without starting the agent. */
  refresh(): void {
    this.renderApp(false);
  }

  private async resolve(localId: string): Promise<ChatSession | undefined> {
    const live = this.host.sessions.get(localId);
    if (live) return live;
    const stored = await this.host.history?.load(localId).catch(() => undefined);
    return stored && this.host.sessions.restore({ ...stored.entry, items: stored.items });
  }

  private createSession(preferredAgent?: string): ChatSession | null {
    const { agents, settings, sessions } = this.host;
    const candidates = [
      preferredAgent,
      settings.defaultAgentId,
      ...agents.enabled().map((a) => a.id),
    ];
    for (const agentId of candidates) {
      if (!agentId) continue;
      const session = sessions.create(agentId);
      if (session) return session;
    }
    return null;
  }

  private ensureTab(): void {
    if (this.tabs.length > 0) return;
    const session = this.createSession();
    if (session) {
      this.tabs = [session];
      this.activeId = session.localId;
    }
  }

  /** Inserts `session` after the active tab and activates it. */
  private insertTab(session: ChatSession): void {
    const index = this.tabs.findIndex((s) => s === this.active);
    this.tabs = [...this.tabs.slice(0, index + 1), session, ...this.tabs.slice(index + 1)];
    this.activeId = session.localId;
  }

  /** Removes a tab (activating its neighbour) without ending its session. */
  private removeTab(localId: string): ChatSession | undefined {
    const index = this.tabs.findIndex((s) => s.localId === localId);
    const session = this.tabs[index];
    if (!session) return undefined;
    const wasActive = session === this.active;
    this.tabs = this.tabs.filter((s) => s !== session);
    if (wasActive) this.activeId = (this.tabs[index] ?? this.tabs[index - 1])?.localId ?? null;
    this.ensureTab();
    return session;
  }

  /** Puts a new session with `agentId` (or the same agent) in place of `previous`. */
  private replaceTab(previous: ChatSession, agentId?: string): void {
    if (!this.tabs.includes(previous)) return;
    const session = this.createSession(agentId ?? previous.getState().agentId);
    if (!session) return;
    this.tabs = this.tabs.map((s) => (s === previous ? session : s));
    if (this.activeId === previous.localId || !this.activeId) this.activeId = session.localId;
    void this.release(previous.localId);
    this.changed();
  }

  private changed(): void {
    this.renderApp();
    this.host.app.workspace.requestSaveLayout();
  }

  private tabTitle(session: ChatSession): string {
    const { title, agentId } = session.getState();
    return title || (this.host.agents.config(agentId)?.label ?? agentId);
  }

  private renderApp(prepare = true): void {
    const active = this.active;
    // Start the agent in the background so its options (mode, model…) can be chosen first.
    if (prepare) void active?.prepare();
    this.activity.sync(this.tabs, active?.localId ?? null);
    const appProps = (session: ChatSession | null): AppProps => ({
      host: this.host,
      session,
      onAgentChange: (agentId: string) =>
        session ? this.replaceTab(session, agentId) : this.newTab(agentId),
      onNewSession: () => (session ? this.replaceTab(session) : this.newTab()),
      selection: session && this.selection?.tabId === session.localId ? this.selection.ref : null,
      onOpenSession: (localId: string) => void this.openSession(localId),
      onDeleteSession: (localId: string) => this.deleteSession(localId),
      onClearSelection: () => {
        this.selection = null;
        this.renderApp();
      },
    });
    if (!active) {
      render(h(App, appProps(null)), this.contentEl);
      return;
    }
    const tabBar = h(TabBar, {
      tabs: this.tabs.map((session) => {
        const { agentId, title } = session.getState();
        return {
          id: session.localId,
          agentId,
          agentLabel: this.host.agents.config(agentId)?.label ?? agentId,
          title,
          indicator: this.activity.indicator(session),
        };
      }),
      activeId: active.localId,
      onSelect: (id: string) => this.selectTab(id),
      onClose: (id: string) => this.closeTab(id),
      onNew: () => this.newTab(),
      onRename: (id: string, title: string) => this.host.sessions.get(id)?.rename(title),
    });
    render(
      h(
        Fragment,
        null,
        this.tabs.map((session) =>
          h(App, {
            ...appProps(session),
            key: session.localId,
            hidden: session !== active,
            tabBar: session === active ? tabBar : undefined,
          }),
        ),
      ),
      this.contentEl,
    );
  }
}

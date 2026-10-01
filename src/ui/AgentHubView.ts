import { ItemView, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { h, render } from 'preact';
import { AGENTHUB_ICON, VIEW_TYPE_AGENTHUB } from '../constants';
import { t } from '../i18n';
import { App } from './App';

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

export class AgentHubView extends ItemView {
  private sessionId: string | null = null;

  constructor(leaf: WorkspaceLeaf) {
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
    this.renderApp();
  }

  override async onClose(): Promise<void> {
    // Unmount Preact so its effects and listeners are released.
    render(null, this.contentEl);
  }

  override getState(): Record<string, unknown> {
    return { ...super.getState(), sessionId: this.sessionId };
  }

  override async setState(state: unknown, result: ViewStateResult): Promise<void> {
    this.sessionId = parseViewState(state).sessionId;
    this.renderApp();
    await super.setState(state, result);
  }

  private renderApp(): void {
    render(h(App, { sessionId: this.sessionId }), this.contentEl);
  }
}

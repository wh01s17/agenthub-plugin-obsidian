import { Notice, Plugin, type WorkspaceLeaf } from 'obsidian';
import { AGENTHUB_ICON, VIEW_TYPE_AGENTHUB } from './constants';
import { t } from './i18n';
import { AgentHubView } from './ui/AgentHubView';

export default class AgentHubPlugin extends Plugin {
  override onload(): void {
    this.registerView(VIEW_TYPE_AGENTHUB, (leaf) => new AgentHubView(leaf));

    this.addRibbonIcon(AGENTHUB_ICON, t('openView'), () => this.run(this.activateView()));

    this.addCommand({
      id: 'open-view',
      name: t('openView'),
      callback: () => this.run(this.activateView()),
    });
  }

  /** Reveals the existing AgentHub view or opens one in the right sidebar. */
  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_AGENTHUB)[0] ?? null;

    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: VIEW_TYPE_AGENTHUB, active: true });
    }

    await workspace.revealLeaf(leaf);
  }

  /** Runs a UI-triggered task so a failure is logged and shown instead of becoming an unhandled rejection. */
  private run(task: Promise<unknown>): void {
    task.catch((error: unknown) => {
      console.error('[AgentHub]', error);
      new Notice(`AgentHub: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
}

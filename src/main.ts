import { Plugin, type WorkspaceLeaf } from 'obsidian';
import { AGENTHUB_ICON, VIEW_TYPE_AGENTHUB } from './constants';
import { t } from './i18n';
import { AgentHubView } from './ui/AgentHubView';

export default class AgentHubPlugin extends Plugin {
  override onload(): void {
    this.registerView(VIEW_TYPE_AGENTHUB, (leaf) => new AgentHubView(leaf));

    this.addRibbonIcon(AGENTHUB_ICON, t('openView'), () => {
      void this.activateView();
    });

    this.addCommand({
      id: 'open-view',
      name: t('openView'),
      callback: () => {
        void this.activateView();
      },
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
}

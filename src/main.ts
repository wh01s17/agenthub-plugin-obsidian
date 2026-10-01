import { Notice, Plugin, type WorkspaceLeaf } from 'obsidian';
import { AgentRegistry } from './agents/AgentRegistry';
import { AGENTHUB_ICON, VIEW_TYPE_AGENTHUB } from './constants';
import type { DetectionResult } from './core/AgentAdapter';
import { t } from './i18n';
import { CommandResolver, type ResolvedCommand } from './process/BinaryResolver';
import { ProcessRegistry } from './process/ProcessRunner';
import { LoginShellEnv } from './process/ShellEnv';
import { type AgentHubSettings, defaultSettings, migrate } from './settings/settings';
import { AgentHubSettingTab, type SettingsHost } from './settings/SettingsTab';
import { AgentHubView } from './ui/AgentHubView';

export default class AgentHubPlugin extends Plugin implements SettingsHost {
  override settings: AgentHubSettings = defaultSettings();
  readonly processes = new ProcessRegistry();
  readonly agents = new AgentRegistry({
    resolveCommand: (command) => this.resolveCommand(command),
    processes: this.processes,
    hints: {
      install: (command) => t('hintInstall', { command }),
      login: (command) => t('hintLogin', { command }),
      unsupported: (transport) => t('hintUnsupported', { transport }),
      noCommand: () => t('hintNoCommand'),
    },
  });
  private readonly loginShell = new LoginShellEnv({ shell: process.env.SHELL });

  override async onload(): Promise<void> {
    this.settings = migrate(await this.loadData());
    this.agents.setAgents(this.settings.agents);

    this.registerView(VIEW_TYPE_AGENTHUB, (leaf) => new AgentHubView(leaf));
    this.addSettingTab(new AgentHubSettingTab(this.app, this, this));

    this.addRibbonIcon(AGENTHUB_ICON, t('openView'), () => this.run(this.activateView()));
    this.addCommand({
      id: 'open-view',
      name: t('openView'),
      callback: () => this.run(this.activateView()),
    });
  }

  override onunload(): void {
    // No agent process may outlive the plugin (RNF-02).
    this.run(this.processes.killAll());
  }

  async updateSettings(change: (settings: AgentHubSettings) => void): Promise<void> {
    change(this.settings);
    this.agents.setAgents(this.settings.agents);
    await this.saveData(this.settings);
  }

  detectAgent(id: string): Promise<DetectionResult> {
    return this.agents.detect(id);
  }

  redetectAgents(): void {
    this.loginShell.invalidate();
    this.agents.invalidate();
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

  /** Built per call so PATH settings apply immediately (ADR-017). */
  private resolveCommand(command: string): Promise<ResolvedCommand | null> {
    return new CommandResolver({
      baseEnv: process.env,
      platform: process.platform,
      extraPath: this.settings.extraPath,
      loginShell: this.settings.resolveLoginShell ? this.loginShell : undefined,
    }).resolve(command);
  }

  /** Runs a UI-triggered task so a failure is logged and shown instead of becoming an unhandled rejection. */
  private run(task: Promise<unknown>): void {
    task.catch((error: unknown) => {
      console.error('[AgentHub]', error);
      new Notice(`AgentHub: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
}

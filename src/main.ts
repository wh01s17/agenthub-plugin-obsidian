import { Notice, Plugin, type WorkspaceLeaf } from 'obsidian';
import { AgentRegistry } from './agents/AgentRegistry';
import { AGENTHUB_ICON, VIEW_TYPE_AGENTHUB } from './constants';
import type { DetectionResult, SessionOptions } from './core/AgentAdapter';
import { SessionManager } from './core/SessionManager';
import { createObsidianHost, vaultBasePath } from './host/ObsidianHost';
import { openPluginSettings } from './host/openSettings';
import { t } from './i18n';
import { CommandResolver, type ResolvedCommand } from './process/BinaryResolver';
import { ProcessRegistry } from './process/ProcessRunner';
import { LoginShellEnv } from './process/ShellEnv';
import {
  type AgentHubSettings,
  defaultSettings,
  migrate,
  renderInstructions,
} from './settings/settings';
import { AgentHubSettingTab, type SettingsHost } from './settings/SettingsTab';
import { AgentHubView } from './ui/AgentHubView';
import type { ViewHost } from './ui/ViewHost';

export default class AgentHubPlugin extends Plugin implements SettingsHost, ViewHost {
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
  readonly sessions = new SessionManager({
    getAdapter: (agentId) => this.agents.get(agentId),
    host: createObsidianHost({
      app: this.app,
      env: () => Promise.resolve(process.env),
      debug: () => this.settings.debugPanel,
    }),
    sessionOptions: (agentId) => this.sessionOptions(agentId),
  });
  private readonly loginShell = new LoginShellEnv({ shell: process.env.SHELL });

  override async onload(): Promise<void> {
    this.settings = migrate(await this.loadData());
    this.agents.setAgents(this.settings.agents);

    this.registerView(VIEW_TYPE_AGENTHUB, (leaf) => new AgentHubView(leaf, this));
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
    this.run(this.sessions.disposeAll().finally(() => this.processes.killAll()));
  }

  // ── SettingsHost ───────────────────────────────────────────────────────────

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

  // ── ViewHost ───────────────────────────────────────────────────────────────

  openSettings(): void {
    if (!openPluginSettings(this.app, this.manifest.id)) new Notice(t('settingsButton'));
  }

  workingDirectory(): string {
    const { cwdMode, customCwd } = this.settings;
    return cwdMode === 'custom' && customCwd ? customCwd : (vaultBasePath(this.app) ?? '');
  }

  // ── internals ──────────────────────────────────────────────────────────────

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

  private sessionOptions(agentId: string): SessionOptions {
    const agent = this.agents.config(agentId);
    return {
      cwd: this.workingDirectory(),
      config: agent?.config,
      systemPromptAppend: renderInstructions(this.settings.vaultInstructions, {
        configDir: this.app.vault.configDir,
      }),
    };
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

import {
  type Editor,
  type MarkdownFileInfo,
  Notice,
  normalizePath,
  Plugin,
  type WorkspaceLeaf,
} from 'obsidian';
import { AgentRegistry } from './agents/AgentRegistry';
import { AGENTHUB_ICON, VIEW_TYPE_AGENTHUB } from './constants';
import type { DetectionResult, SessionOptions } from './core/AgentAdapter';
import type { SelectionRef } from './core/PromptBuilder';
import type { SessionViewState } from './core/types';
import { SessionManager } from './core/SessionManager';
import { createNoteContext } from './host/NoteContext';
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
import { exportFileName, sessionToMarkdown } from './storage/exportToNote';
import { SessionStore } from './storage/SessionStore';
import { noticeText } from './ui/components/NoticeItem';

export default class AgentHubPlugin extends Plugin implements SettingsHost, ViewHost {
  override settings: AgentHubSettings = defaultSettings();
  private sessionStore?: SessionStore;

  /** Saved sessions stay browsable even when saving new ones is disabled (README). */
  get history(): SessionStore | undefined {
    return this.sessionStore;
  }
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
    onCreate: (session) => this.sessionStore?.track(session),
    knownConfigOptions: (agentId) => this.settings.knownConfigOptions[agentId],
    rememberConfigOptions: (agentId, options) => {
      if (JSON.stringify(this.settings.knownConfigOptions[agentId]) === JSON.stringify(options))
        return;
      this.run(
        this.updateSettings((s) => {
          s.knownConfigOptions[agentId] = options;
        }),
      );
    },
  });
  readonly notes = createNoteContext(this.app);
  private readonly loginShell = new LoginShellEnv({ shell: process.env.SHELL });

  override async onload(): Promise<void> {
    this.settings = migrate(await this.loadData());
    this.agents.setAgents(this.settings.agents);
    this.sessionStore = new SessionStore(this.app.vault.adapter, {
      directory: `${this.app.vault.configDir}/plugins/${this.manifest.id}/sessions`,
      settings: () => ({
        enabled: this.settings.historyEnabled,
        maxSessions: this.settings.maxSessions,
      }),
      onError: (error) => {
        console.error('[AgentHub] Session storage', error);
        new Notice(t('historySaveError'));
      },
    });

    this.registerView(VIEW_TYPE_AGENTHUB, (leaf) => new AgentHubView(leaf, this));
    this.addSettingTab(new AgentHubSettingTab(this.app, this, this));

    this.addRibbonIcon(AGENTHUB_ICON, t('openView'), () => this.run(this.activateView()));
    this.addCommand({
      id: 'open-view',
      name: t('openView'),
      callback: () => this.run(this.activateView()),
    });
    this.addCommand({
      id: 'open-new-view',
      name: t('cmdOpenNewView'),
      callback: () => this.run(this.openNewView()),
    });
    // Free idle agent processes (T4.5); the conversation resumes on the next message.
    this.registerInterval(
      window.setInterval(() => {
        const minutes = this.settings.idleTimeoutMin;
        if (minutes > 0) this.run(this.sessions.reapIdle(minutes * 60_000));
      }, 60_000),
    );
    this.addCommand({
      id: 'send-selection',
      name: t('cmdSendSelection'),
      editorCheckCallback: (checking, editor, info) => {
        const selection = selectionFrom(editor, info);
        if (!selection) return false;
        if (!checking) this.run(this.withView((view) => view.attachSelection(selection)));
        return true;
      },
    });
    this.addCommand({
      id: 'ask-about-note',
      name: t('cmdAskAboutNote'),
      callback: () => this.run(this.withView((view) => view.focusComposer())),
    });
    this.addCommand({
      id: 'new-session',
      name: t('cmdNewSession'),
      callback: () => this.run(this.withView((view) => view.startNewSession())),
    });
    this.addCommand({
      id: 'export-session',
      name: t('cmdExportSession'),
      callback: () => this.run(this.activateView().then((view) => view?.exportSession())),
    });
    this.addCommand({
      id: 'stop-turn',
      name: t('cmdStop'),
      callback: () => this.run(this.withView((view) => view.stop())),
    });
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor, info) => {
        const selection = selectionFrom(editor, info);
        if (!selection) return;
        menu.addItem((item) => {
          item
            .setTitle(t('cmdSendSelection'))
            .setIcon(AGENTHUB_ICON)
            .onClick(() => this.run(this.withView((view) => view.attachSelection(selection))));
        });
      }),
    );
  }

  /** Opens an additional AgentHub view with its own session, split below the current one. */
  private async openNewView(): Promise<void> {
    const leaf = this.app.workspace.getRightLeaf(true);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_AGENTHUB, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  /** Opens (or reveals) the view and runs `action` on it. */
  private async withView(action: (view: AgentHubView) => void): Promise<void> {
    const view = await this.activateView();
    if (view) action(view);
  }

  override onunload(): void {
    // No agent process may outlive the plugin (RNF-02).
    this.run(
      this.sessions
        .disposeAll()
        .finally(() => this.processes.killAll())
        .finally(() => this.sessionStore?.dispose()),
    );
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

  async exportSession(state: SessionViewState): Promise<void> {
    if (state.items.length === 0) {
      new Notice(t('exportEmpty'));
      return;
    }
    const now = new Date();
    const markdown = sessionToMarkdown(
      state,
      {
        agent: this.agents.config(state.agentId)?.label ?? state.agentId,
        you: t('you'),
        thinking: t('thinking'),
        plan: t('planTitle'),
        permission: t('permissionTitle'),
        notice: (item) => noticeText(item.notice),
      },
      now,
    );
    const folder = normalizePath(this.settings.exportFolder || '/');
    if (folder !== '/' && !this.app.vault.getFolderByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }
    let path = normalizePath(`${folder}/${exportFileName(state.title, now)}`);
    for (let n = 2; this.app.vault.getFileByPath(path); n++) {
      path = path.replace(/( \(\d+\))?\.md$/, ` (${n}).md`);
    }
    const file = await this.app.vault.create(path, markdown);
    await this.app.workspace.getLeaf(true).openFile(file);
    new Notice(t('exportDone', { path }));
  }

  workingDirectory(): string {
    const { cwdMode, customCwd } = this.settings;
    return cwdMode === 'custom' && customCwd ? customCwd : (vaultBasePath(this.app) ?? '');
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Reveals the existing AgentHub view or opens one in the right sidebar. */
  async activateView(): Promise<AgentHubView | null> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_AGENTHUB)[0] ?? null;

    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (!leaf) return null;
      await leaf.setViewState({ type: VIEW_TYPE_AGENTHUB, active: true });
    }

    await workspace.revealLeaf(leaf);
    return leaf.view instanceof AgentHubView ? leaf.view : null;
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

/** The editor's selection as prompt context, or `null` when nothing is selected. */
function selectionFrom(editor: Editor, info: MarkdownFileInfo): SelectionRef | null {
  const text = editor.getSelection();
  const path = info.file?.path;
  if (!text.trim() || !path) return null;
  return {
    path,
    text,
    fromLine: editor.getCursor('from').line + 1,
    toLine: editor.getCursor('to').line + 1,
  };
}

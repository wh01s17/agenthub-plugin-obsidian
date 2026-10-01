import { type App, PluginSettingTab, Setting } from 'obsidian';
import type { DetectionResult } from '../core/AgentAdapter';
import { t } from '../i18n';
import { type AgentConfig, type AgentHubSettings, newCustomAgent } from './settings';

/** What the tab needs from the plugin; keeps the tab testable and decoupled from `main.ts`. */
export interface SettingsHost {
  readonly settings: AgentHubSettings;
  updateSettings(change: (settings: AgentHubSettings) => void): Promise<void>;
  detectAgent(id: string): Promise<DetectionResult>;
  redetectAgents(): void;
}

// ── text helpers for multi-line fields ───────────────────────────────────────

export const toLines = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/** Parses `KEY=value` lines; lines without `=` or with an empty key are ignored. */
export function parsePairs(value: string): Record<string, string> {
  return Object.fromEntries(
    toLines(value).flatMap((line) => {
      const eq = line.indexOf('=');
      return eq > 0 ? [[line.slice(0, eq).trim(), line.slice(eq + 1).trim()]] : [];
    }),
  );
}

export const formatPairs = (pairs: Record<string, string>): string =>
  Object.entries(pairs)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

export function describeDetection(result: DetectionResult): string {
  switch (result.status) {
    case 'available':
      return t('settingsAvailable', { path: result.resolvedCommand ?? '' });
    case 'missing':
      return t('settingsMissing', { hint: result.message ?? '' });
    case 'error':
      return t('settingsAgentError', { message: result.message ?? '' });
  }
}

export class AgentHubSettingTab extends PluginSettingTab {
  private readonly expanded = new Set<string>();

  constructor(
    app: App,
    plugin: ConstructorParameters<typeof PluginSettingTab>[1],
    private readonly host: SettingsHost,
  ) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();
    this.renderAgents(containerEl);
    this.renderSessions(containerEl);
    this.renderEnvironment(containerEl);
  }

  private save(change: (settings: AgentHubSettings) => void, redraw = false): void {
    void this.host.updateSettings(change).then(() => {
      if (redraw) this.display();
    });
  }

  private renderAgents(el: HTMLElement): void {
    const { settings } = this.host;
    new Setting(el).setName(t('settingsAgents')).setHeading();

    new Setting(el)
      .setName(t('settingsDefaultAgent'))
      .setDesc(t('settingsDefaultAgentDesc'))
      .addDropdown((dropdown) => {
        for (const agent of settings.agents) {
          if (agent.enabled) dropdown.addOption(agent.id, agent.label);
        }
        dropdown.setValue(settings.defaultAgentId).onChange((value) =>
          this.save((s) => {
            s.defaultAgentId = value;
          }),
        );
      });

    new Setting(el)
      .setName(t('settingsRedetect'))
      .setDesc(t('settingsRedetectDesc'))
      .addButton((button) =>
        button.setButtonText(t('settingsRedetectButton')).onClick(() => {
          this.host.redetectAgents();
          this.display();
        }),
      );

    settings.agents.forEach((agent, index) => this.renderAgent(el, agent, index));

    new Setting(el)
      .setName(t('settingsAddAgent'))
      .setDesc(t('settingsAddAgentDesc'))
      .addButton((button) =>
        button.setButtonText(t('settingsAddAgentButton')).onClick(() => {
          const agent = newCustomAgent(
            settings.agents.map((a) => a.id),
            (n) => t('settingsCustomAgentLabel', { n }),
          );
          this.expanded.add(agent.id);
          this.save((s) => {
            s.agents.push(agent);
          }, true);
        }),
      );
  }

  private renderAgent(el: HTMLElement, agent: AgentConfig, index: number): void {
    const row = new Setting(el).setName(agent.label);
    if (agent.enabled) {
      row.setDesc(t('settingsDetecting'));
      // Block body on purpose: `Setting` has a fluent `then()` (Obsidian 1.13), so returning it from a
      // promise callback makes the promise adopt it forever and freezes the app.
      void this.host.detectAgent(agent.id).then((result) => {
        row.setDesc(describeDetection(result));
      });
    } else {
      row.setDesc(t('settingsDisabled'));
    }
    row.addToggle((toggle) =>
      toggle.setValue(agent.enabled).onChange((enabled) =>
        this.save((s) => {
          const target = s.agents[index];
          if (target) target.enabled = enabled;
        }, true),
      ),
    );
    row.addExtraButton((button) =>
      button
        .setIcon('pencil')
        .setTooltip(t('settingsEdit'))
        .onClick(() => {
          if (this.expanded.has(agent.id)) this.expanded.delete(agent.id);
          else this.expanded.add(agent.id);
          this.display();
        }),
    );
    if (!agent.builtin) {
      row.addExtraButton((button) =>
        button
          .setIcon('trash')
          .setTooltip(t('settingsDelete'))
          .onClick(() =>
            this.save((s) => {
              s.agents.splice(index, 1);
              if (s.defaultAgentId === agent.id) s.defaultAgentId = s.agents[0]?.id ?? '';
            }, true),
          ),
      );
    }
    if (this.expanded.has(agent.id)) this.renderAgentDetails(el, index, agent);
  }

  private renderAgentDetails(el: HTMLElement, index: number, agent: AgentConfig): void {
    const details = el.createDiv({ cls: 'agenthub-settings-agent' });
    const edit = (change: (target: AgentConfig) => void) =>
      this.save((s) => {
        const target = s.agents[index];
        if (target) change(target);
      });

    new Setting(details).setName(t('settingsLabel')).addText((text) =>
      text.setValue(agent.label).onChange((value) =>
        edit((a) => {
          a.label = value.trim() || a.label;
        }),
      ),
    );
    new Setting(details)
      .setName(t('settingsCommand'))
      .setDesc(t('settingsCommandDesc'))
      .addText((text) =>
        text.setValue(agent.command).onChange((value) =>
          edit((a) => {
            a.command = value.trim();
          }),
        ),
      );
    new Setting(details)
      .setName(t('settingsArgs'))
      .setDesc(t('settingsArgsDesc'))
      .addTextArea((area) =>
        area.setValue(agent.args.join('\n')).onChange((value) =>
          edit((a) => {
            a.args = toLines(value);
          }),
        ),
      );
    new Setting(details)
      .setName(t('settingsEnv'))
      .setDesc(t('settingsEnvDesc'))
      .addTextArea((area) =>
        area.setValue(formatPairs(agent.env)).onChange((value) =>
          edit((a) => {
            a.env = parsePairs(value);
          }),
        ),
      );
    new Setting(details)
      .setName(t('settingsConfig'))
      .setDesc(t('settingsConfigDesc'))
      .addTextArea((area) =>
        area.setValue(formatPairs(agent.config)).onChange((value) =>
          edit((a) => {
            a.config = parsePairs(value);
          }),
        ),
      );
  }

  private renderSessions(el: HTMLElement): void {
    const { settings } = this.host;
    new Setting(el).setName(t('settingsSessions')).setHeading();
    new Setting(el)
      .setName(t('settingsHistory'))
      .setDesc(t('settingsHistoryDesc'))
      .addToggle((toggle) => {
        toggle.setValue(settings.historyEnabled).onChange((value) =>
          this.save((s) => {
            s.historyEnabled = value;
          }),
        );
      });
    new Setting(el)
      .setName(t('settingsMaxSessions'))
      .setDesc(t('settingsMaxSessionsDesc'))
      .addText((text) => {
        text.inputEl.type = 'number';
        text.inputEl.min = '1';
        text.inputEl.max = '10000';
        text.setValue(String(settings.maxSessions)).onChange((value) => {
          const count = Number(value);
          if (Number.isInteger(count) && count >= 1 && count <= 10000) {
            this.save((s) => {
              s.maxSessions = count;
            });
          }
        });
      });

    new Setting(el)
      .setName(t('settingsIdleTimeout'))
      .setDesc(t('settingsIdleTimeoutDesc'))
      .addText((text) => {
        text.inputEl.type = 'number';
        text.inputEl.min = '0';
        text.inputEl.max = '1440';
        text.setValue(String(settings.idleTimeoutMin)).onChange((value) => {
          const minutes = Number(value);
          if (Number.isInteger(minutes) && minutes >= 0 && minutes <= 1440) {
            this.save((s) => {
              s.idleTimeoutMin = minutes;
            });
          }
        });
      });

    new Setting(el)
      .setName(t('settingsExportFolder'))
      .setDesc(t('settingsExportFolderDesc'))
      .addText((text) =>
        text.setValue(settings.exportFolder).onChange((value) =>
          this.save((s) => {
            s.exportFolder = value.trim();
          }),
        ),
      );

    new Setting(el)
      .setName(t('settingsCwd'))
      .setDesc(t('settingsCwdDesc'))
      .addDropdown((dropdown) =>
        dropdown
          .addOption('vault', t('settingsCwdVault'))
          .addOption('custom', t('settingsCwdCustom'))
          .setValue(settings.cwdMode)
          .onChange((value) =>
            this.save((s) => {
              s.cwdMode = value === 'custom' ? 'custom' : 'vault';
            }, true),
          ),
      );
    if (settings.cwdMode === 'custom') {
      new Setting(el)
        .setName(t('settingsCustomCwd'))
        .setDesc(t('settingsCustomCwdDesc'))
        .addText((text) =>
          text.setValue(settings.customCwd).onChange((value) =>
            this.save((s) => {
              s.customCwd = value.trim();
            }),
          ),
        );
    }

    new Setting(el)
      .setName(t('settingsInstructions'))
      .setDesc(t('settingsInstructionsDesc'))
      .addTextArea((area) => {
        area.inputEl.rows = 5;
        area.setValue(settings.vaultInstructions).onChange((value) =>
          this.save((s) => {
            s.vaultInstructions = value;
          }),
        );
      });

    new Setting(el)
      .setName(t('settingsIncludeActive'))
      .setDesc(t('settingsIncludeActiveDesc'))
      .addToggle((toggle) =>
        toggle.setValue(settings.includeActiveNote).onChange((value) =>
          this.save((s) => {
            s.includeActiveNote = value;
          }),
        ),
      );

    new Setting(el).setName(t('settingsSendWith')).addDropdown((dropdown) =>
      dropdown
        .addOption('enter', t('settingsSendEnter'))
        .addOption('mod-enter', t('settingsSendModEnter'))
        .setValue(settings.sendWith)
        .onChange((value) =>
          this.save((s) => {
            s.sendWith = value === 'mod-enter' ? 'mod-enter' : 'enter';
          }),
        ),
    );

    new Setting(el)
      .setName(t('settingsShowThoughts'))
      .setDesc(t('settingsShowThoughtsDesc'))
      .addToggle((toggle) =>
        toggle.setValue(settings.showThoughts).onChange((value) =>
          this.save((s) => {
            s.showThoughts = value;
          }),
        ),
      );

    new Setting(el)
      .setName(t('settingsDebug'))
      .setDesc(t('settingsDebugDesc'))
      .addToggle((toggle) =>
        toggle.setValue(settings.debugPanel).onChange((value) =>
          this.save((s) => {
            s.debugPanel = value;
          }),
        ),
      );
  }

  private renderEnvironment(el: HTMLElement): void {
    const { settings } = this.host;
    new Setting(el).setName(t('settingsEnvironment')).setHeading();

    new Setting(el)
      .setName(t('settingsLoginShell'))
      .setDesc(t('settingsLoginShellDesc'))
      .addToggle((toggle) =>
        toggle.setValue(settings.resolveLoginShell).onChange((value) =>
          this.save((s) => {
            s.resolveLoginShell = value;
          }),
        ),
      );

    new Setting(el)
      .setName(t('settingsExtraPath'))
      .setDesc(t('settingsExtraPathDesc'))
      .addTextArea((area) =>
        area.setValue(settings.extraPath.join('\n')).onChange((value) =>
          this.save((s) => {
            s.extraPath = toLines(value);
          }),
        ),
      );
  }
}

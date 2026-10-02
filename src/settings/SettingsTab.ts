import {
  type App,
  PluginSettingTab,
  requireApiVersion,
  Setting,
  type SettingDefinitionItem,
} from 'obsidian';
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

/** Shortens a path in the user's home folder to `~/…`, as shells do. */
export function tildePath(
  path: string,
  home = process.env.HOME ?? process.env.USERPROFILE,
): string {
  if (!home) return path;
  const base = home.replace(/[\\/]+$/, '');
  if (path === base) return '~';
  return path.startsWith(`${base}/`) || path.startsWith(`${base}\\`)
    ? `~${path.slice(base.length)}`
    : path;
}

export function describeDetection(result: DetectionResult): string {
  switch (result.status) {
    case 'available':
      return t('settingsAvailable', { path: tildePath(result.resolvedCommand ?? '') });
    case 'missing':
      return t('settingsMissing', { hint: result.message ?? '' });
    case 'error':
      return t('settingsAgentError', { message: result.message ?? '' });
  }
}

/** Appearance settings shown as a dropdown. */
type AppearanceChoice =
  'messageStyle' | 'density' | 'chatFontSize' | 'accentColor' | 'optionsPlacement';

/** One settings row: its name/description (indexed by Obsidian's settings search) and its controls. */
interface Row {
  name: string;
  desc?: string;
  /** Repeated per-agent detail rows stay out of the search index. */
  searchable?: boolean;
  /** Extra CSS class for the row (e.g. indented agent details). */
  cls?: string;
  /**
   * Adds the row's controls. The return value is ignored on purpose: these callbacks often end with a
   * fluent `Setting` call, and a `Setting` is a thenable in Obsidian 1.13, so it must never reach
   * Obsidian (the wrappers below call this in a block body that returns nothing).
   */
  render: (setting: Setting) => unknown;
}

interface Section {
  heading: string;
  rows: Row[];
}

/**
 * Settings defined once (`sections()`), shown two ways (T6.7, ADR-019): Obsidian 1.13+ reads
 * `getSettingDefinitions()`, which also puts them in its settings search; older versions call
 * `display()`, which draws the same rows imperatively.
 */
export class AgentHubSettingTab extends PluginSettingTab {
  private readonly expanded = new Set<string>();

  constructor(
    app: App,
    plugin: ConstructorParameters<typeof PluginSettingTab>[1],
    private readonly host: SettingsHost,
  ) {
    super(app, plugin);
  }

  override getSettingDefinitions(): SettingDefinitionItem[] {
    return this.sections().map((section) => ({
      type: 'group',
      heading: section.heading,
      items: section.rows.map((row) => ({
        name: row.name,
        desc: row.desc,
        searchable: row.searchable,
        render: (setting: Setting) => {
          if (row.cls) setting.settingEl.addClass(row.cls);
          row.render(setting);
        },
      })),
    }));
  }

  /** Fallback for Obsidian < 1.13 (never called when definitions are provided). */
  override display(): void {
    const { containerEl } = this;
    containerEl.empty();
    for (const section of this.sections()) {
      new Setting(containerEl).setName(section.heading).setHeading();
      for (const row of section.rows) {
        const setting = new Setting(containerEl).setName(row.name);
        if (row.desc) setting.setDesc(row.desc);
        if (row.cls) setting.settingEl.addClass(row.cls);
        row.render(setting);
      }
    }
  }

  /** Re-renders after the list of rows changes (agent added, removed, expanded…). */
  private refresh(): void {
    if (requireApiVersion('1.13.0')) this.update();
    else this.display();
  }

  private save(change: (settings: AgentHubSettings) => void, redraw = false): void {
    void this.host.updateSettings(change).then(() => {
      if (redraw) this.refresh();
    });
  }

  private sections(): Section[] {
    return [
      { heading: t('settingsAgents'), rows: this.agentRows() },
      { heading: t('settingsSessions'), rows: this.sessionRows() },
      { heading: t('settingsAppearance'), rows: this.appearanceRows() },
      { heading: t('settingsEnvironment'), rows: this.environmentRows() },
    ];
  }

  // ── Agents ─────────────────────────────────────────────────────────────────

  private agentRows(): Row[] {
    const { settings } = this.host;
    const rows: Row[] = [
      {
        name: t('settingsDefaultAgent'),
        desc: t('settingsDefaultAgentDesc'),
        render: (setting) =>
          setting.addDropdown((dropdown) => {
            for (const agent of settings.agents) {
              if (agent.enabled) dropdown.addOption(agent.id, agent.label);
            }
            dropdown.setValue(settings.defaultAgentId).onChange((value) =>
              this.save((s) => {
                s.defaultAgentId = value;
              }),
            );
          }),
      },
      {
        name: t('settingsRedetect'),
        desc: t('settingsRedetectDesc'),
        render: (setting) =>
          setting.addButton((button) =>
            button.setButtonText(t('settingsRedetectButton')).onClick(() => {
              this.host.redetectAgents();
              this.refresh();
            }),
          ),
      },
    ];
    settings.agents.forEach((agent, index) => {
      rows.push(this.agentRow(agent, index));
      if (this.expanded.has(agent.id)) rows.push(...this.agentDetailRows(agent, index));
    });
    rows.push({
      name: t('settingsAddAgent'),
      desc: t('settingsAddAgentDesc'),
      render: (setting) =>
        setting.addButton((button) =>
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
        ),
    });
    return rows;
  }

  private agentRow(agent: AgentConfig, index: number): Row {
    return {
      name: agent.label,
      desc: agent.enabled ? t('settingsDetecting') : t('settingsDisabled'),
      render: (row) => {
        if (agent.enabled) {
          // Block body on purpose: `Setting` has a fluent `then()` (Obsidian 1.13), so returning it
          // from a promise callback makes the promise adopt it forever and freezes the app.
          void this.host.detectAgent(agent.id).then((result) => {
            row.setDesc(describeDetection(result));
          });
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
              this.refresh();
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
      },
    };
  }

  private agentDetailRows(agent: AgentConfig, index: number): Row[] {
    const edit = (change: (target: AgentConfig) => void) =>
      this.save((s) => {
        const target = s.agents[index];
        if (target) change(target);
      });
    const detail = (row: Omit<Row, 'searchable' | 'cls'>): Row => ({
      ...row,
      searchable: false,
      cls: 'agenthub-settings-agent',
    });
    return [
      detail({
        name: t('settingsLabel'),
        render: (setting) =>
          setting.addText((text) =>
            text.setValue(agent.label).onChange((value) =>
              edit((a) => {
                a.label = value.trim() || a.label;
              }),
            ),
          ),
      }),
      detail({
        name: t('settingsCommand'),
        desc: t('settingsCommandDesc'),
        render: (setting) =>
          setting.addText((text) =>
            text.setValue(agent.command).onChange((value) =>
              edit((a) => {
                a.command = value.trim();
              }),
            ),
          ),
      }),
      detail({
        name: t('settingsArgs'),
        desc: t('settingsArgsDesc'),
        render: (setting) =>
          setting.addTextArea((area) =>
            area.setValue(agent.args.join('\n')).onChange((value) =>
              edit((a) => {
                a.args = toLines(value);
              }),
            ),
          ),
      }),
      detail({
        name: t('settingsEnv'),
        desc: t('settingsEnvDesc'),
        render: (setting) =>
          setting.addTextArea((area) =>
            area.setValue(formatPairs(agent.env)).onChange((value) =>
              edit((a) => {
                a.env = parsePairs(value);
              }),
            ),
          ),
      }),
      detail({
        name: t('settingsConfig'),
        desc: t('settingsConfigDesc'),
        render: (setting) =>
          setting.addTextArea((area) =>
            area.setValue(formatPairs(agent.config)).onChange((value) =>
              edit((a) => {
                a.config = parsePairs(value);
              }),
            ),
          ),
      }),
    ];
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  private sessionRows(): Row[] {
    const { settings } = this.host;
    const toggle = (
      name: string,
      desc: string,
      value: boolean,
      set: (s: AgentHubSettings, value: boolean) => void,
    ): Row => ({
      name,
      desc,
      render: (setting) =>
        setting.addToggle((component) =>
          component.setValue(value).onChange((next) => this.save((s) => set(s, next))),
        ),
    });
    const integer = (
      name: string,
      desc: string,
      value: number,
      [min, max]: [number, number],
      set: (s: AgentHubSettings, value: number) => void,
    ): Row => ({
      name,
      desc,
      render: (setting) =>
        setting.addText((text) => {
          text.inputEl.type = 'number';
          text.inputEl.min = String(min);
          text.inputEl.max = String(max);
          text.setValue(String(value)).onChange((raw) => {
            const next = Number(raw);
            if (Number.isInteger(next) && next >= min && next <= max) {
              this.save((s) => set(s, next));
            }
          });
        }),
    });

    const rows: Row[] = [
      toggle(t('settingsHistory'), t('settingsHistoryDesc'), settings.historyEnabled, (s, v) => {
        s.historyEnabled = v;
      }),
      integer(
        t('settingsMaxSessions'),
        t('settingsMaxSessionsDesc'),
        settings.maxSessions,
        [1, 10000],
        (s, v) => {
          s.maxSessions = v;
        },
      ),
      integer(
        t('settingsIdleTimeout'),
        t('settingsIdleTimeoutDesc'),
        settings.idleTimeoutMin,
        [0, 1440],
        (s, v) => {
          s.idleTimeoutMin = v;
        },
      ),
      {
        name: t('settingsExportFolder'),
        desc: t('settingsExportFolderDesc'),
        render: (setting) =>
          setting.addText((text) =>
            text.setValue(settings.exportFolder).onChange((value) =>
              this.save((s) => {
                s.exportFolder = value.trim();
              }),
            ),
          ),
      },
      {
        name: t('settingsCwd'),
        desc: t('settingsCwdDesc'),
        render: (setting) =>
          setting.addDropdown((dropdown) =>
            dropdown
              .addOption('vault', t('settingsCwdVault'))
              .addOption('active-note-folder', t('settingsCwdActiveFolder'))
              .addOption('custom', t('settingsCwdCustom'))
              .setValue(settings.cwdMode)
              .onChange((value) =>
                this.save((s) => {
                  s.cwdMode =
                    value === 'custom' || value === 'active-note-folder' ? value : 'vault';
                }, true),
              ),
          ),
      },
    ];
    if (settings.cwdMode === 'custom') {
      rows.push({
        name: t('settingsCustomCwd'),
        desc: t('settingsCustomCwdDesc'),
        render: (setting) =>
          setting.addText((text) =>
            text.setValue(settings.customCwd).onChange((value) =>
              this.save((s) => {
                s.customCwd = value.trim();
              }),
            ),
          ),
      });
    }
    rows.push(
      {
        name: t('settingsInstructions'),
        desc: t('settingsInstructionsDesc'),
        render: (setting) =>
          setting.addTextArea((area) => {
            area.inputEl.rows = 5;
            area.setValue(settings.vaultInstructions).onChange((value) =>
              this.save((s) => {
                s.vaultInstructions = value;
              }),
            );
          }),
      },
      toggle(
        t('settingsIncludeActive'),
        t('settingsIncludeActiveDesc'),
        settings.includeActiveNote,
        (s, v) => {
          s.includeActiveNote = v;
        },
      ),
      {
        name: t('settingsSendWith'),
        render: (setting) =>
          setting.addDropdown((dropdown) =>
            dropdown
              .addOption('enter', t('settingsSendEnter'))
              .addOption('mod-enter', t('settingsSendModEnter'))
              .setValue(settings.sendWith)
              .onChange((value) =>
                this.save((s) => {
                  s.sendWith = value === 'mod-enter' ? 'mod-enter' : 'enter';
                }),
              ),
          ),
      },
      toggle(
        t('settingsShowThoughts'),
        t('settingsShowThoughtsDesc'),
        settings.showThoughts,
        (s, v) => {
          s.showThoughts = v;
        },
      ),
      toggle(t('settingsDebug'), t('settingsDebugDesc'), settings.debugPanel, (s, v) => {
        s.debugPanel = v;
      }),
    );
    return rows;
  }

  // ── Appearance (ADR-032) ───────────────────────────────────────────────────

  private appearanceRows(): Row[] {
    const { settings } = this.host;
    /** A dropdown bound to one enum setting; open views redraw when it changes. */
    const choice = <K extends AppearanceChoice>(
      key: K,
      name: string,
      desc: string,
      options: Record<AgentHubSettings[K], string>,
    ): Row => ({
      name,
      desc,
      render: (setting) =>
        setting.addDropdown((dropdown) => {
          for (const [value, label] of Object.entries<string>(options)) {
            dropdown.addOption(value, label);
          }
          dropdown.setValue(settings[key]).onChange((value) => {
            if (!(value in options)) return;
            this.save((s) => {
              s[key] = value as AgentHubSettings[K];
            });
          });
        }),
    });
    const toggle = (key: 'expandToolCalls' | 'showUsage', name: string, desc: string): Row => ({
      name,
      desc,
      render: (setting) =>
        setting.addToggle((component) =>
          component.setValue(settings[key]).onChange((next) =>
            this.save((s) => {
              s[key] = next;
            }),
          ),
        ),
    });
    return [
      choice('messageStyle', t('settingsMessageStyle'), t('settingsMessageStyleDesc'), {
        bubbles: t('settingsMessageBubbles'),
        cards: t('settingsMessageCards'),
        plain: t('settingsMessagePlain'),
      }),
      choice('density', t('settingsDensity'), t('settingsDensityDesc'), {
        comfortable: t('settingsDensityComfortable'),
        compact: t('settingsDensityCompact'),
      }),
      choice('chatFontSize', t('settingsFontSize'), t('settingsFontSizeDesc'), {
        small: t('settingsFontSmall'),
        medium: t('settingsFontMedium'),
        large: t('settingsFontLarge'),
      }),
      choice('accentColor', t('settingsAccent'), t('settingsAccentDesc'), {
        agent: t('settingsAccentAgent'),
        theme: t('settingsAccentTheme'),
      }),
      choice('optionsPlacement', t('settingsOptionsPlacement'), t('settingsOptionsPlacementDesc'), {
        header: t('settingsOptionsHeader'),
        composer: t('settingsOptionsComposer'),
      }),
      toggle('expandToolCalls', t('settingsExpandTools'), t('settingsExpandToolsDesc')),
      toggle('showUsage', t('settingsShowUsage'), t('settingsShowUsageDesc')),
    ];
  }

  // ── Environment ────────────────────────────────────────────────────────────

  private environmentRows(): Row[] {
    const { settings } = this.host;
    return [
      {
        name: t('settingsLoginShell'),
        desc: t('settingsLoginShellDesc'),
        render: (setting) =>
          setting.addToggle((toggle) =>
            toggle.setValue(settings.resolveLoginShell).onChange((value) =>
              this.save((s) => {
                s.resolveLoginShell = value;
              }),
            ),
          ),
      },
      {
        name: t('settingsExtraPath'),
        desc: t('settingsExtraPathDesc'),
        render: (setting) =>
          setting.addTextArea((area) =>
            area.setValue(settings.extraPath.join('\n')).onChange((value) =>
              this.save((s) => {
                s.extraPath = toLines(value);
              }),
            ),
          ),
      },
    ];
  }
}

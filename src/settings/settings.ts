// Plugin settings: schema, defaults, agent presets and migration of what `loadData()` returns.
// Settings are validated field by field so one bad value never resets the rest (plan §4.12).

import { z } from 'zod';

export const AgentConfigSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  enabled: z.boolean(),
  /** Only `acp` is implemented; direct-mode transports arrive in Fase 5. */
  transport: z.enum(['acp', 'claude-native', 'codex-native']),
  command: z.string().min(1),
  args: z.array(z.string()),
  /** Stored in plain text in data.json; the settings UI warns about secrets. */
  env: z.record(z.string(), z.string()),
  /** Initial values for the agent's config options, e.g. `{ mode: 'default' }`. */
  config: z.record(z.string(), z.string()),
  /** Command the user can run to install the agent (shown when it is missing). */
  installCommand: z.string().optional(),
  /** Command the user can run to log in (shown when the agent asks for auth). */
  loginCommand: z.string().optional(),
  /** Shipped with the plugin (cannot be deleted, only disabled). */
  builtin: z.boolean(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

const ConfigOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  currentValue: z.string(),
  options: z.array(
    z.object({ value: z.string(), name: z.string(), description: z.string().optional() }),
  ),
});

const SettingsSchema = z.object({
  schemaVersion: z.literal(1),
  defaultAgentId: z.string(),
  agents: z.array(AgentConfigSchema),
  cwdMode: z.enum(['vault', 'custom']),
  customCwd: z.string(),
  vaultInstructions: z.string(),
  /** Attach the active note to each message by default (it can be toggled per message). */
  includeActiveNote: z.boolean(),
  sendWith: z.enum(['enter', 'mod-enter']),
  showThoughts: z.boolean(),
  debugPanel: z.boolean(),
  historyEnabled: z.boolean(),
  maxSessions: z.number().int().min(1).max(10000),
  /** Vault folder for exported sessions. */
  exportFolder: z.string(),
  /** Options each agent announced at start-up, shown before it starts again (not user-facing). */
  knownConfigOptions: z.record(z.string(), z.array(ConfigOptionSchema)),
  /** Ask the login shell for PATH when a command is not found (ADR-017). */
  resolveLoginShell: z.boolean(),
  /** Directories put first in PATH for agent commands. */
  extraPath: z.array(z.string()),
});

export type AgentHubSettings = z.infer<typeof SettingsSchema>;

/** Built-in agents (plan §5.4), with versions pinned per ADR-010 and facts from spike S2. */
export const AGENT_PRESETS: readonly AgentConfig[] = [
  {
    id: 'claude-acp',
    label: 'Claude Code',
    enabled: true,
    transport: 'acp',
    command: 'npx',
    args: ['-y', '@agentclientprotocol/claude-agent-acp@0.85.0'],
    env: {},
    config: {},
    installCommand: 'npm i -g @agentclientprotocol/claude-agent-acp',
    loginCommand: 'claude /login',
    builtin: true,
  },
  {
    id: 'codex-acp',
    label: 'Codex',
    enabled: true,
    transport: 'acp',
    command: 'npx',
    args: ['-y', '@agentclientprotocol/codex-acp@2.1.1'],
    env: {},
    config: {},
    installCommand: 'npm i -g @agentclientprotocol/codex-acp',
    loginCommand: 'codex login',
    builtin: true,
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    enabled: true,
    transport: 'acp',
    command: 'opencode',
    args: ['acp'],
    env: {},
    config: {},
    installCommand: 'npm i -g opencode-ai',
    loginCommand: 'opencode auth login',
    builtin: true,
  },
  {
    // Disabled: personal Gemini Code Assist accounts are no longer supported by this client (S2).
    id: 'gemini',
    label: 'Gemini CLI',
    enabled: false,
    transport: 'acp',
    command: 'gemini',
    args: ['--acp'],
    env: {},
    config: {},
    installCommand: 'npm i -g @google/gemini-cli',
    loginCommand: 'gemini',
    builtin: true,
  },
];

export const DEFAULT_VAULT_INSTRUCTIONS = [
  'You are working inside an Obsidian vault (the working directory).',
  'Link notes with [[wikilinks]] and keep YAML frontmatter valid.',
  'Never modify the {{configDir}}/ folder (Obsidian settings).',
  'Prefer paths relative to the vault root.',
].join('\n');

/** Fills placeholders in the vault instructions; `{{configDir}}` is usually `.obsidian`. */
export function renderInstructions(template: string, vars: { configDir: string }): string {
  return template.replaceAll('{{configDir}}', vars.configDir);
}

export function defaultSettings(): AgentHubSettings {
  return {
    schemaVersion: 1,
    defaultAgentId: 'claude-acp',
    agents: AGENT_PRESETS.map((preset) => ({ ...preset })),
    cwdMode: 'vault',
    customCwd: '',
    vaultInstructions: DEFAULT_VAULT_INSTRUCTIONS,
    includeActiveNote: true,
    sendWith: 'enter',
    showThoughts: false,
    debugPanel: false,
    historyEnabled: true,
    maxSessions: 200,
    exportFolder: 'AgentHub',
    knownConfigOptions: {},
    resolveLoginShell: true,
    extraPath: [],
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Turns whatever `loadData()` returned into valid settings. Invalid fields fall back to their
 * default, invalid agents are dropped, and presets added by newer plugin versions appear disabled.
 */
export function migrate(raw: unknown): AgentHubSettings {
  const defaults = defaultSettings();
  if (!isRecord(raw)) return defaults;

  const field = <K extends keyof AgentHubSettings>(key: K): AgentHubSettings[K] => {
    const parsed = SettingsSchema.shape[key].safeParse(raw[key]);
    // Zod infers each shape entry's output type; `key` ties it to the matching settings field.
    return parsed.success ? (parsed.data as AgentHubSettings[K]) : defaults[key];
  };

  const savedAgents = Array.isArray(raw.agents)
    ? raw.agents.flatMap((agent) => {
        const parsed = AgentConfigSchema.safeParse(agent);
        return parsed.success ? [parsed.data] : [];
      })
    : defaults.agents;
  const known = new Set(savedAgents.map((agent) => agent.id));
  const newPresets = AGENT_PRESETS.filter((preset) => !known.has(preset.id)).map((preset) => ({
    ...preset,
    enabled: false,
  }));
  const agents = Array.isArray(raw.agents) ? [...savedAgents, ...newPresets] : defaults.agents;

  const defaultAgentId = field('defaultAgentId');
  return {
    schemaVersion: 1,
    defaultAgentId: agents.some((agent) => agent.id === defaultAgentId)
      ? defaultAgentId
      : (agents.find((agent) => agent.enabled)?.id ?? defaults.defaultAgentId),
    agents,
    cwdMode: field('cwdMode'),
    customCwd: field('customCwd'),
    vaultInstructions: field('vaultInstructions'),
    includeActiveNote: field('includeActiveNote'),
    sendWith: field('sendWith'),
    showThoughts: field('showThoughts'),
    debugPanel: field('debugPanel'),
    historyEnabled: field('historyEnabled'),
    maxSessions: field('maxSessions'),
    exportFolder: field('exportFolder'),
    knownConfigOptions: field('knownConfigOptions'),
    resolveLoginShell: field('resolveLoginShell'),
    extraPath: field('extraPath'),
  };
}

/** A blank custom ACP agent for the "Add agent" button. */
export function newCustomAgent(
  existingIds: Iterable<string>,
  labelFor: (index: number) => string,
): AgentConfig {
  const taken = new Set(existingIds);
  let index = 1;
  while (taken.has(`custom-${index}`)) index++;
  return {
    id: `custom-${index}`,
    label: labelFor(index),
    enabled: false,
    transport: 'acp',
    command: '',
    args: [],
    env: {},
    config: {},
    builtin: false,
  };
}

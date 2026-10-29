// Commands AgentHub runs itself instead of sending them to the agent (plan T11.2, ADR-038/039). Pure.

import type { ConfigOption, SlashCommand } from './types';

export type ClientCommandId = 'new' | 'resume' | 'export' | 'help' | 'model' | 'mode' | 'skills';

export interface ClientCommand {
  id: ClientCommandId;
  /** What the user types after `/`. */
  name: string;
  /** The agent announces the same name: typed alone it opens AgentHub's menu, with arguments it goes to the agent. */
  sharedWithAgent?: boolean;
}

/**
 * Commands whose CLI opens an interactive menu, which does not exist over ACP (the agents answer with
 * text): AgentHub shows its own menu instead (ADR-039).
 */
const MENUS: ReadonlySet<ClientCommandId> = new Set(['model', 'mode', 'skills']);

const COMMANDS: readonly ClientCommand[] = [
  { id: 'new', name: 'new' },
  { id: 'new', name: 'clear' },
  { id: 'resume', name: 'resume' },
  { id: 'export', name: 'export' },
  { id: 'help', name: 'help' },
  { id: 'model', name: 'model' },
  { id: 'mode', name: 'mode' },
  { id: 'skills', name: 'skills' },
];

/**
 * The client commands on offer. A name the agent announces belongs to the agent (it does what the user
 * expects from its CLI), except the menus, which AgentHub keeps for the bare command (ADR-039).
 * `/model`/`/mode` need an option of that category and `/skills` skills announced as `$name`.
 */
export function clientCommands(
  agentCommands: readonly SlashCommand[],
  options: readonly ConfigOption[],
  canResume: boolean,
): ClientCommand[] {
  const taken = new Set(agentCommands.map((command) => command.name));
  return COMMANDS.flatMap((command) => {
    const shared = taken.has(command.name);
    if (shared && !MENUS.has(command.id)) return [];
    if (command.id === 'resume' && !canResume) return [];
    if ((command.id === 'model' || command.id === 'mode') && !optionFor(options, command.id))
      return [];
    if (command.id === 'skills' && !agentCommands.some((c) => c.name.startsWith('$'))) return [];
    return [shared ? { ...command, sharedWithAgent: true } : command];
  });
}

/**
 * `/name [args]` when `name` is one of `available`; anything else goes to the agent, as does a command
 * shared with the agent when it has arguments.
 */
export function parseClientCommand(
  text: string,
  available: readonly ClientCommand[],
): { command: ClientCommand; args: string } | null {
  const match = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!match) return null;
  const command = available.find((candidate) => candidate.name === match[1]);
  const args = (match[2] ?? '').trim();
  if (!command || (command.sharedWithAgent && args)) return null;
  return { command, args };
}

/** The agent option a `/model` or `/mode` command acts on. */
export function optionFor(
  options: readonly ConfigOption[],
  category: 'model' | 'mode',
): ConfigOption | null {
  return options.find((option) => option.category === category) ?? null;
}

/** The option value whose id or name best matches what the user typed (`/model opus`). */
export function matchOptionValue(option: ConfigOption, query: string): string | null {
  const q = query.toLowerCase();
  const exact = option.options.find(
    (value) => value.value.toLowerCase() === q || value.name.toLowerCase() === q,
  );
  if (exact) return exact.value;
  const partial = option.options.filter(
    (value) => value.value.toLowerCase().includes(q) || value.name.toLowerCase().includes(q),
  );
  return partial.length === 1 ? (partial[0]?.value ?? null) : null;
}

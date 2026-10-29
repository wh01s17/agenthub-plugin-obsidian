// Commands AgentHub runs itself instead of sending them to the agent (plan T11.2, ADR-038). Pure.

import type { ConfigOption, SlashCommand } from './types';

export type ClientCommandId = 'new' | 'resume' | 'export' | 'help' | 'model' | 'mode';

export interface ClientCommand {
  id: ClientCommandId;
  /** What the user types after `/`. */
  name: string;
}

const COMMANDS: readonly ClientCommand[] = [
  { id: 'new', name: 'new' },
  { id: 'new', name: 'clear' },
  { id: 'resume', name: 'resume' },
  { id: 'export', name: 'export' },
  { id: 'help', name: 'help' },
  { id: 'model', name: 'model' },
  { id: 'mode', name: 'mode' },
];

/**
 * The client commands on offer: a name the agent announces belongs to the agent (it does what the user
 * expects from its CLI), and `/model`/`/mode` need an option of that category to act on.
 */
export function clientCommands(
  agentCommands: readonly SlashCommand[],
  options: readonly ConfigOption[],
  canResume: boolean,
): ClientCommand[] {
  const taken = new Set(agentCommands.map((command) => command.name));
  return COMMANDS.filter((command) => {
    if (taken.has(command.name)) return false;
    if (command.id === 'resume') return canResume;
    if (command.id === 'model' || command.id === 'mode')
      return optionFor(options, command.id) !== null;
    return true;
  });
}

/** `/name [args]` when `name` is one of `available`; anything else goes to the agent. */
export function parseClientCommand(
  text: string,
  available: readonly ClientCommand[],
): { command: ClientCommand; args: string } | null {
  const match = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!match) return null;
  const command = available.find((candidate) => candidate.name === match[1]);
  return command ? { command, args: (match[2] ?? '').trim() } : null;
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

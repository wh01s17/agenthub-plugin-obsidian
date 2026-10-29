// Composer completion logic (plan T3.3/T3.4, T11.3): `@` for vault files and folders, `/` for commands,
// `$` for skills the agent announces with that prefix (Codex). Pure.

import type { ClientCommand } from './clientCommands';
import type { SlashCommand } from './types';

export interface Trigger {
  kind: 'note' | 'command' | 'skill';
  /** Text typed after the trigger character. */
  query: string;
  /** Index of the trigger character in the text. */
  start: number;
}

export interface Suggestion {
  value: string;
  detail?: string;
  /** What the command expects after its name (`inputHint`). */
  hint?: string;
  /** `client`: run by AgentHub (ADR-038); `agent`: announced by the agent. */
  group?: 'client' | 'agent';
}

/** Commands and skills are shown in a scrolling list: agents announce hundreds (T11.1). */
export const COMMAND_LIMIT = 50;

/**
 * Finds an active trigger ending at `cursor`: `@query` or `$query` after a space or at the start, or
 * `/query` at the very start of the message (slash commands).
 */
export function findTrigger(text: string, cursor: number): Trigger | null {
  const before = text.slice(0, cursor);
  const command = /^\/([^\s]*)$/.exec(before);
  if (command) return { kind: 'command', query: command[1] ?? '', start: 0 };
  const token = /(^|\s)([@$])([^\s@$[\]]*)$/.exec(before);
  if (token) {
    const query = token[3] ?? '';
    return { kind: token[2] === '@' ? 'note' : 'skill', query, start: cursor - query.length - 1 };
  }
  return null;
}

/** Higher is better; `null` when `candidate` does not contain the query letters in order. */
export function matchScore(query: string, candidate: string): number | null {
  const q = query.toLowerCase();
  // Folders end with `/`: match on their own name.
  const c = (candidate.endsWith('/') ? candidate.slice(0, -1) : candidate).toLowerCase();
  if (!q) return 0;
  const name = c.slice(c.lastIndexOf('/') + 1);
  if (name.startsWith(q)) return 300 - name.length;
  const index = c.indexOf(q);
  if (index >= 0) return 200 - index;
  let position = 0;
  for (const char of q) {
    position = c.indexOf(char, position);
    if (position < 0) return null;
    position++;
  }
  return 100 - c.length;
}

export function rankMatches(query: string, candidates: readonly string[], limit = 8): string[] {
  return candidates
    .flatMap((candidate) => {
      const score = matchScore(query, candidate);
      return score === null ? [] : [{ candidate, score }];
    })
    .sort((a, b) => b.score - a.score || a.candidate.localeCompare(b.candidate))
    .slice(0, limit)
    .map((match) => match.candidate);
}

/** Skills announced as `$name` (Codex) are offered after `$`, not after `/`. */
function isSkill(command: SlashCommand): boolean {
  return command.name.startsWith('$');
}

/**
 * `/` completions: AgentHub's own commands first, then the agent's. `describe` gives a client
 * command its (localized) description.
 */
export function commandSuggestions(
  query: string,
  agentCommands: readonly SlashCommand[],
  client: readonly ClientCommand[],
  describe: (command: ClientCommand) => string,
): Suggestion[] {
  const ownNames = rankMatches(
    query,
    client.map((command) => command.name),
    COMMAND_LIMIT,
  );
  const own = ownNames.flatMap((name) => {
    const command = client.find((candidate) => candidate.name === name);
    return command ? [{ value: name, detail: describe(command), group: 'client' as const }] : [];
  });
  const announced = agentCommands.filter((command) => !isSkill(command));
  return [...own, ...agentSuggestions(query, announced, COMMAND_LIMIT - own.length)];
}

/** `$` completions: the agent's `$skill` entries, without the prefix. */
export function skillSuggestions(
  query: string,
  agentCommands: readonly SlashCommand[],
): Suggestion[] {
  const skills = agentCommands
    .filter(isSkill)
    .map((command) => ({ ...command, name: command.name.slice(1) }));
  return agentSuggestions(query, skills, COMMAND_LIMIT);
}

function agentSuggestions(
  query: string,
  commands: readonly SlashCommand[],
  limit: number,
): Suggestion[] {
  const byName = new Map(commands.map((command) => [command.name, command]));
  return rankMatches(query, [...byName.keys()], limit).map((name) => {
    const command = byName.get(name);
    return { value: name, detail: command?.description, hint: command?.inputHint, group: 'agent' };
  });
}

/** Replaces the trigger token with the chosen value; returns the new text and cursor position. */
export function applySuggestion(
  text: string,
  cursor: number,
  trigger: Trigger,
  value: string,
): { text: string; cursor: number } {
  const prefix = { note: '@[[', command: '/', skill: '$' }[trigger.kind];
  const insert = trigger.kind === 'note' ? `${prefix}${value}]] ` : `${prefix}${value} `;
  const next = text.slice(0, trigger.start) + insert + text.slice(cursor);
  return { text: next, cursor: trigger.start + insert.length };
}

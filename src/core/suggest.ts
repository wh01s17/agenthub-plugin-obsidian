// Composer completion logic (plan T3.3/T3.4): `@` for vault notes, `/` for agent commands. Pure.

export interface Trigger {
  kind: 'note' | 'command';
  /** Text typed after the trigger character. */
  query: string;
  /** Index of the trigger character in the text. */
  start: number;
}

/**
 * Finds an active trigger ending at `cursor`: `@query` after a space or at the start, or `/query`
 * at the very start of the message (agent slash commands).
 */
export function findTrigger(text: string, cursor: number): Trigger | null {
  const before = text.slice(0, cursor);
  const command = /^\/([^\s]*)$/.exec(before);
  if (command) return { kind: 'command', query: command[1] ?? '', start: 0 };
  const note = /(^|\s)@([^\s@[\]]*)$/.exec(before);
  if (note) {
    const query = note[2] ?? '';
    return { kind: 'note', query, start: cursor - query.length - 1 };
  }
  return null;
}

/** Higher is better; `null` when `candidate` does not contain the query letters in order. */
export function matchScore(query: string, candidate: string): number | null {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
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

/** Replaces the trigger token with the chosen value; returns the new text and cursor position. */
export function applySuggestion(
  text: string,
  cursor: number,
  trigger: Trigger,
  value: string,
): { text: string; cursor: number } {
  const insert = trigger.kind === 'note' ? `@[[${value}]] ` : `/${value} `;
  const next = text.slice(0, trigger.start) + insert + text.slice(cursor);
  return { text: next, cursor: trigger.start + insert.length };
}

// Line diff for edits made by agents (plan T6.1), shaped for rendering.

import { diffLines } from 'diff';

export interface DiffLine {
  kind: 'add' | 'remove' | 'same' | 'skip';
  text: string;
}

/** Unchanged runs longer than this collapse to a "…" marker, keeping `CONTEXT` lines around changes. */
const CONTEXT = 2;

export function lineDiff(oldText: string | null, newText: string): DiffLine[] {
  const lines: DiffLine[] = [];
  for (const part of diffLines(oldText ?? '', newText)) {
    const kind = part.added ? 'add' : part.removed ? 'remove' : 'same';
    const text = part.value.endsWith('\n') ? part.value.slice(0, -1) : part.value;
    for (const line of text.split('\n')) lines.push({ kind, text: line });
  }
  return collapse(lines);
}

function collapse(lines: DiffLine[]): DiffLine[] {
  const keep = lines.map(
    (line, index) =>
      line.kind !== 'same' ||
      lines.slice(Math.max(0, index - CONTEXT), index + CONTEXT + 1).some((l) => l.kind !== 'same'),
  );
  const out: DiffLine[] = [];
  lines.forEach((line, index) => {
    if (keep[index]) out.push(line);
    else if (out.at(-1)?.kind !== 'skip') out.push({ kind: 'skip', text: '…' });
  });
  return out;
}

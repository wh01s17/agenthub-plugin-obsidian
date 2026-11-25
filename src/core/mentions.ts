// Short `@name` mentions in the message box (ADR-042): the box shows `@Kickoff`, the agent gets
// `@[[Meetings/Kickoff.md]]`. The composer keeps the label → path map for the current draft.

import { noteName } from './PromptBuilder';

/** Label → vault path of the notes mentioned in the draft. */
export type MentionMap = ReadonlyMap<string, string>;

const FULL_MENTION = /@\[\[([^\]]+)\]\]/g;

/** Label for a vault path: the note name (folders keep their `/`). */
function baseLabel(path: string): string {
  if (path.endsWith('/')) {
    const name = path.slice(0, -1).split('/').pop() || path.slice(0, -1);
    return `${name}/`;
  }
  return noteName(path);
}

/** The path without the `.md` extension (folders unchanged). */
function longLabel(path: string): string {
  return path.endsWith('.md') ? path.slice(0, -3) : path;
}

/**
 * The shortest label for `path` that is not ambiguous: the note name, or the whole path (without
 * `.md`) when another vault entry or another mention in the draft shares that name.
 */
export function mentionLabel(path: string, mentions: MentionMap, vault: readonly string[]): string {
  const label = baseLabel(path);
  const taken = mentions.get(label);
  const clash =
    (taken !== undefined && taken !== path) ||
    vault.some((other) => other !== path && baseLabel(other) === label);
  return clash ? longLabel(path) : label;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Matches `@label` for the map's labels: longest first, whole words only. */
function labelPattern(mentions: MentionMap): RegExp | null {
  const labels = [...mentions.keys()].sort((a, b) => b.length - a.length);
  if (labels.length === 0) return null;
  // A label ending in a letter or digit must not run into more of a word (`@Kickoffs`).
  return new RegExp(
    `(?<![\\p{L}\\p{N}_])@(${labels.map(escape).join('|')})(?![\\p{L}\\p{N}_])`,
    'gu',
  );
}

/**
 * The draft cut into plain text (even indices) and mentions (odd indices): the map's `@label`s and
 * any `@[[path]]` typed by hand. Used to highlight them in the message box.
 */
export function mentionSegments(text: string, mentions: MentionMap): string[] {
  const labels = labelPattern(mentions);
  const pattern = new RegExp(
    labels ? `${FULL_MENTION.source}|${labels.source}` : FULL_MENTION.source,
    'gu',
  );
  const parts: string[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    parts.push(text.slice(last, match.index), match[0]);
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

/** Replaces each `@label` of the map with `@[[path]]` (longest labels first, whole words only). */
export function expandMentions(text: string, mentions: MentionMap): string {
  const pattern = labelPattern(mentions);
  if (!pattern) return text;
  return text.replace(pattern, (match, label: string) => {
    const path = mentions.get(label);
    return path ? `@[[${path}]]` : match;
  });
}

/** The reverse of `expandMentions`: turns `@[[path]]` into `@label` and returns the map. */
export function compactMentions(
  text: string,
  vault: readonly string[],
): { text: string; mentions: Map<string, string> } {
  const mentions = new Map<string, string>();
  const compacted = text.replace(FULL_MENTION, (_, raw: string) => {
    const path = raw.trim();
    const label = mentionLabel(path, mentions, vault);
    mentions.set(label, path);
    return `@${label}`;
  });
  return { text: compacted, mentions };
}

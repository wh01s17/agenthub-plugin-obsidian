// Turns what the user typed plus Obsidian context into prompt blocks (plan §4.8). Pure: the host
// resolves notes and reads their text beforehand.

import type { ImageBlock } from './images';
import type { PromptBlock } from './types';

export interface NoteRef {
  /** Vault-relative path. */
  path: string;
  absPath: string;
  /** Note content to embed when the agent accepts embedded context. */
  text?: string;
}

export interface SelectionRef {
  path: string;
  text: string;
  fromLine: number;
  toLine: number;
}

export interface PromptInput {
  text: string;
  /** Pasted or dropped images (ADR-035). */
  images?: ImageBlock[];
  activeNote?: NoteRef;
  selection?: SelectionRef;
  /** Notes referenced with `@[[path]]` in the text, already resolved. */
  mentions?: NoteRef[];
  /** Embedded note text beyond this budget is dropped (the link remains). */
  maxEmbeddedChars?: number;
}

const DEFAULT_BUDGET = 200_000;
const MENTION = /@\[\[([^\]]+)\]\]/g;

/** A message that runs an agent command (`/name …`): agents only recognize it on its own (T11.5). */
export function isSlashCommand(text: string): boolean {
  return /^\/\S/.test(text.trimStart());
}

/** Vault paths referenced as `@[[path]]` in the message, in order and without duplicates. */
export function extractMentions(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION)) {
    const path = match[1]?.trim();
    if (path) found.add(path);
  }
  return [...found];
}

/** File name shown for a cited note: the last path segment, without `.md`. */
export function noteName(path: string): string {
  const name = path.split('/').pop() || path;
  return name.endsWith('.md') ? name.slice(0, -3) : name;
}

/** The text with each `@[[path]]` replaced by `@name`, for titles and other short labels. */
export function shortenMentions(text: string): string {
  return text.replace(MENTION, (_, path: string) => `@${noteName(path.trim())}`);
}

/** A message cut into plain text (even indices) and `@[[path]]` mentions (odd indices). */
export function splitMentions(text: string): string[] {
  return text.split(/@\[\[([^\]]+)\]\]/);
}

export function buildPrompt(input: PromptInput): PromptBlock[] {
  const images = input.images ?? [];
  // A message made only of images needs no empty text block.
  const blocks: PromptBlock[] =
    input.text || images.length === 0 ? [{ type: 'text', text: input.text }] : [];
  blocks.push(...images);
  let budget = input.maxEmbeddedChars ?? DEFAULT_BUDGET;
  const seen = new Set<string>();

  const addNote = (note: NoteRef) => {
    if (seen.has(note.path)) return;
    seen.add(note.path);
    const fits = note.text !== undefined && note.text.length <= budget;
    if (fits && note.text !== undefined) budget -= note.text.length;
    blocks.push({
      type: 'file',
      path: note.path,
      absPath: note.absPath,
      text: fits ? note.text : undefined,
    });
  };

  if (input.selection) blocks.push({ type: 'selection', ...input.selection });
  input.mentions?.forEach(addNote);
  // The active note is implicit context: a command goes without it (Claude's `/usage` needs one block).
  if (input.activeNote && !isSlashCommand(input.text)) addNote(input.activeNote);
  return blocks;
}

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

/** Vault paths referenced as `@[[path]]` in the message, in order and without duplicates. */
export function extractMentions(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION)) {
    const path = match[1]?.trim();
    if (path) found.add(path);
  }
  return [...found];
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
  if (input.activeNote) addNote(input.activeNote);
  return blocks;
}

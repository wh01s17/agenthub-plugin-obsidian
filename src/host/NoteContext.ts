// Obsidian-side note access for prompts: active note, note text, note list, opening paths (plan §4.8).

import { type App, type EventRef, normalizePath, TFile } from 'obsidian';
import type { NoteRef } from '../core/PromptBuilder';
import { isInside } from '../core/pathGuard';
import { vaultBasePath } from './ObsidianHost';

export interface NoteContext {
  /** Vault path of the most recently active note, if any. */
  activeNotePath(): string | null;
  onActiveNoteChange(listener: () => void): () => void;
  /** Resolves a vault path (or a `[[link]]` target) to a note with its text. */
  readNote(pathOrLink: string): Promise<NoteRef | null>;
  /** Markdown note paths, for `@` completion. */
  listNotes(): string[];
  /** Vault-relative form of an absolute path inside the vault; other paths are returned unchanged. */
  displayPath(path: string): string;
  /** Free text (a tool title, a command) with absolute paths inside the vault made vault-relative. */
  displayText(text: string): string;
  /** Opens a vault-relative or absolute path inside the vault; returns false if it is outside. */
  openPath(path: string): boolean;
}

export function createNoteContext(app: App): NoteContext {
  const base = vaultBasePath(app) ?? '';

  const resolve = (pathOrLink: string): TFile | null => {
    const path = normalizePath(pathOrLink);
    const direct = app.vault.getFileByPath(path);
    if (direct) return direct;
    // Also accept link text such as "Ideas" or "Notas/Ideas".
    return app.metadataCache.getFirstLinkpathDest(pathOrLink, '');
  };

  return {
    activeNotePath: () => app.workspace.getActiveFile()?.path ?? null,

    onActiveNoteChange(listener) {
      const ref: EventRef = app.workspace.on('file-open', () => listener());
      return () => app.workspace.offref(ref);
    },

    async readNote(pathOrLink) {
      const file = resolve(pathOrLink);
      if (!file) return null;
      return {
        path: file.path,
        absPath: base ? `${base}/${file.path}` : file.path,
        text: await app.vault.cachedRead(file),
      };
    },

    listNotes: () => app.vault.getMarkdownFiles().map((file) => file.path),

    displayPath: (path) =>
      base && path.startsWith(`${base}/`) && isInside(base, path)
        ? path.slice(base.length + 1)
        : path,

    displayText: (text) => (base ? text.replaceAll(`${base}/`, '') : text),

    openPath(path) {
      let vaultPath = path;
      if (path.startsWith('/')) {
        if (!base || !isInside(base, path)) return false;
        vaultPath = path.slice(base.length + 1);
      }
      const file = resolve(vaultPath);
      if (!(file instanceof TFile)) return false;
      void app.workspace.getLeaf(false).openFile(file);
      return true;
    },
  };
}

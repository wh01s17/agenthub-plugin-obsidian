// Obsidian-side note access for prompts: active note, note text, note list, opening paths (plan §4.8).

import {
  type App,
  arrayBufferToBase64,
  type EventRef,
  normalizePath,
  TFile,
  TFolder,
} from 'obsidian';
import { imageMimeType, MAX_IMAGE_BYTES, type ImageBlock } from '../core/images';
import type { NoteRef } from '../core/PromptBuilder';
import { isInside } from '../core/pathGuard';
import { vaultBasePath } from './ObsidianHost';

export interface NoteContext {
  /** Vault path of the most recently active note, if any. */
  activeNotePath(): string | null;
  onActiveNoteChange(listener: () => void): () => void;
  /**
   * Resolves a vault path (or a `[[link]]` target) to a file or folder; only Markdown notes come with
   * their text, the rest travel as links the agent reads itself (T11.4).
   */
  readNote(pathOrLink: string): Promise<NoteRef | null>;
  /** A mentioned image as an `image` block; `null` if it is not one or is too large (ADR-035). */
  readImage(path: string): Promise<ImageBlock | null>;
  /** File paths and folder paths (ending in `/`), for `@` completion. */
  listPaths(): string[];
  /** Vault-relative form of an absolute path inside the vault; other paths are returned unchanged. */
  displayPath(path: string): string;
  /** Free text (a tool title, a command) with absolute paths inside the vault made vault-relative. */
  displayText(text: string): string;
  /** Opens a vault-relative or absolute path inside the vault; returns false if it is outside. */
  openPath(path: string): boolean;
}

export function createNoteContext(app: App): NoteContext {
  const base = vaultBasePath(app) ?? '';

  const resolve = (pathOrLink: string): TFile | TFolder | null => {
    const path = normalizePath(pathOrLink);
    const direct = app.vault.getAbstractFileByPath(path);
    if (direct instanceof TFile || direct instanceof TFolder) return direct;
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
        text:
          file instanceof TFile && file.extension === 'md'
            ? await app.vault.cachedRead(file)
            : undefined,
      };
    },

    async readImage(path) {
      const file = resolve(path);
      const mimeType = file instanceof TFile ? imageMimeType(file.path) : null;
      if (!(file instanceof TFile) || !mimeType || file.stat.size > MAX_IMAGE_BYTES) return null;
      return {
        type: 'image',
        mimeType,
        data: arrayBufferToBase64(await app.vault.readBinary(file)),
      };
    },

    listPaths: () => [
      ...app.vault.getFiles().map((file) => file.path),
      ...app.vault.getAllFolders(false).map((folder) => `${folder.path}/`),
    ],

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

// `HostServices` backed by Obsidian: vault-aware file access and logging (plan §5.1, ADR-009/014).

import { readFile, writeFile } from 'node:fs/promises';
import { type App, FileSystemAdapter, MarkdownView, normalizePath } from 'obsidian';
import type { HostServices } from '../core/ChatSession';
import { checkPath, type PathPolicy } from '../core/pathGuard';
import { sliceLines } from '../core/text';
import type { Env } from '../process/ShellEnv';

export interface ObsidianHostDeps {
  app: App;
  env: () => Promise<Env>;
  /** Whether debug logging is on (read on every call so settings apply immediately). */
  debug: () => boolean;
  allowedRoots?: () => readonly string[];
}

/** Absolute path of the vault, or `null` when the vault is not on the local file system. */
export function vaultBasePath(app: App): string | null {
  const adapter = app.vault.adapter;
  return adapter instanceof FileSystemAdapter ? adapter.getBasePath() : null;
}

export function createObsidianHost(deps: ObsidianHostDeps): HostServices {
  const { app } = deps;
  const base = vaultBasePath(app) ?? '';
  const policy = (): PathPolicy => ({
    vaultRoot: base,
    configDir: app.vault.configDir,
    allowedRoots: deps.allowedRoots?.() ?? [],
    protectConfigDir: true,
  });

  const verdictOrThrow = (path: string, mode: 'read' | 'write') => {
    const verdict = checkPath(policy(), path, mode);
    if (!verdict.allowed)
      throw new Error(`AgentHub does not allow ${mode} access to ${path} (${verdict.reason}).`);
    return verdict;
  };

  /** Unsaved editor content wins over the file on disk. */
  const openEditorText = (vaultPath: string): string | null => {
    for (const leaf of app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === vaultPath)
        return view.editor.getValue();
    }
    return null;
  };

  const ensureFolder = async (vaultPath: string) => {
    const folder = vaultPath.split('/').slice(0, -1).join('/');
    if (folder && !app.vault.getFolderByPath(folder)) await app.vault.createFolder(folder);
  };

  return {
    vaultBasePath: base,
    env: deps.env,

    async readTextFile(absPath, line, limit) {
      const { vaultPath } = verdictOrThrow(absPath, 'read');
      if (vaultPath === null) return sliceLines(await readFile(absPath, 'utf8'), line, limit);
      const path = normalizePath(vaultPath);
      const fromEditor = openEditorText(path);
      if (fromEditor !== null) return sliceLines(fromEditor, line, limit);
      const file = app.vault.getFileByPath(path);
      // Files Obsidian does not index (e.g. inside the config folder) are read from disk.
      const text = file ? await app.vault.read(file) : await readFile(absPath, 'utf8');
      return sliceLines(text, line, limit);
    },

    async writeTextFile(absPath, content) {
      const { vaultPath } = verdictOrThrow(absPath, 'write');
      if (vaultPath === null) {
        await writeFile(absPath, content, 'utf8');
        return;
      }
      const path = normalizePath(vaultPath);
      const file = app.vault.getFileByPath(path);
      if (file) {
        await app.vault.process(file, () => content);
      } else {
        await ensureFolder(path);
        await app.vault.create(path, content);
      }
    },

    log: {
      error: (message, ...data) => console.error(`[AgentHub] ${message}`, ...data),
      warn: (message, ...data) => console.warn(`[AgentHub] ${message}`, ...data),
      info: (message, ...data) => {
        if (deps.debug()) console.debug(`[AgentHub] ${message}`, ...data);
      },
      debug: (message, ...data) => {
        if (deps.debug()) console.debug(`[AgentHub] ${message}`, ...data);
      },
    },
  };
}

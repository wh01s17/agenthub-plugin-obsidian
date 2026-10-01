// Decides where the ACP `fs/*` channel may read and write (plan §4.9, ADR-014). Pure path logic:
// note that agents can still write through their own tools; the real protection is their permission mode.

import { isAbsolute, relative, resolve, sep } from 'node:path';

/** True when `target` is `root` itself or inside it (no `..` escapes). */
export function isInside(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export type PathVerdict =
  | { allowed: true; vaultPath: string | null }
  | { allowed: false; reason: 'not-absolute' | 'outside' | 'config-dir' };

export interface PathPolicy {
  vaultRoot: string;
  /** Obsidian's config folder, relative to the vault (usually `.obsidian`). */
  configDir: string;
  /** Extra absolute folders the agent may use. */
  allowedRoots?: readonly string[];
  /** Block writes into the config folder. */
  protectConfigDir: boolean;
}

/**
 * Checks an absolute path from an agent. `vaultPath` is the vault-relative path (with `/`) when the
 * file is inside the vault, so the caller can use the Vault API.
 */
export function checkPath(policy: PathPolicy, target: string, mode: 'read' | 'write'): PathVerdict {
  if (!isAbsolute(target)) return { allowed: false, reason: 'not-absolute' };
  if (isInside(policy.vaultRoot, target)) {
    const vaultPath = relative(resolve(policy.vaultRoot), resolve(target)).split(sep).join('/');
    const inConfig = vaultPath === policy.configDir || vaultPath.startsWith(`${policy.configDir}/`);
    if (mode === 'write' && policy.protectConfigDir && inConfig) {
      return { allowed: false, reason: 'config-dir' };
    }
    return { allowed: true, vaultPath };
  }
  if ((policy.allowedRoots ?? []).some((root) => isInside(root, target))) {
    return { allowed: true, vaultPath: null };
  }
  return { allowed: false, reason: 'outside' };
}

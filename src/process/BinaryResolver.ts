// Finds agent binaries and the environment to run them with (plan §4.7, ADR-017):
// Obsidian's own environment first, the login shell only when a command is missing.

import { constants as fsConstants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { delimiter as posixDelimiter, isAbsolute, join } from 'node:path';
import { mergePath, type Env, type LoginShellEnv } from './ShellEnv';

export type IsExecutable = (path: string) => Promise<boolean>;

export const isExecutableFile: IsExecutable = async (path) => {
  try {
    if (!(await stat(path)).isFile()) return false;
    await access(path, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
};

export interface WhichOptions {
  platform: NodeJS.Platform;
  isExecutable?: IsExecutable;
}

const pathKey = (env: Env) => Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';

/** Like `which`: returns the absolute path of `command` using `env.PATH`, or `null`. */
export async function which(
  command: string,
  env: Env,
  { platform, isExecutable = isExecutableFile }: WhichOptions,
): Promise<string | null> {
  const windows = platform === 'win32';
  const extensions = windows
    ? ['', ...(env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)]
    : [''];

  if (isAbsolute(command) || command.includes('/') || (windows && command.includes('\\'))) {
    for (const ext of extensions) {
      if (await isExecutable(command + ext)) return command + ext;
    }
    return null;
  }

  const dirs = (env[pathKey(env)] ?? '').split(windows ? ';' : posixDelimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const ext of extensions) {
      const candidate = join(dir, command + ext);
      if (await isExecutable(candidate)) return candidate;
    }
  }
  return null;
}

export interface ResolvedCommand {
  /** Absolute path of the binary. */
  path: string;
  /** Environment to spawn it with (PATH may include login-shell entries). */
  env: Env;
  source: 'process' | 'login-shell';
}

export interface CommandResolverOptions {
  baseEnv: Env;
  platform: NodeJS.Platform;
  /** Directories from settings, put first in PATH. */
  extraPath?: readonly string[];
  loginShell?: LoginShellEnv;
  isExecutable?: IsExecutable;
}

export class CommandResolver {
  constructor(private readonly options: CommandResolverOptions) {}

  async resolve(command: string): Promise<ResolvedCommand | null> {
    const { baseEnv, platform, extraPath = [], loginShell, isExecutable } = this.options;
    const delimiter = platform === 'win32' ? ';' : posixDelimiter;
    const key = pathKey(baseEnv);

    const env: Env = {
      ...baseEnv,
      [key]: mergePath(baseEnv[key], undefined, extraPath, delimiter),
    };
    const direct = await which(command, env, { platform, isExecutable });
    if (direct) return { path: direct, env, source: 'process' };

    // Windows GUI apps inherit the user PATH; there is no login shell to ask.
    if (platform === 'win32' || !loginShell) return null;
    const shellEnv = await loginShell.get();
    if (!shellEnv) return null;

    const fallbackEnv: Env = {
      ...baseEnv,
      [key]: mergePath(baseEnv[key], shellEnv.PATH, extraPath, delimiter),
    };
    const viaShell = await which(command, fallbackEnv, { platform, isExecutable });
    return viaShell ? { path: viaShell, env: fallbackEnv, source: 'login-shell' } : null;
  }
}

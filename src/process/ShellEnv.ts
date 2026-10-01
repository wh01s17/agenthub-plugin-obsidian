// Login-shell environment, used only as a lazy fallback (ADR-017): in S1 the shell took ~1.4 s
// and picked different binaries than Obsidian's own environment.

import { execFile } from 'node:child_process';

export type Env = Record<string, string | undefined>;

const START = '__AGH_START__';
const END = '__AGH_END__';
/** Prints the environment NUL-separated between markers, so `.zshrc` noise is ignored. */
export const ENV_DUMP_SCRIPT = `printf "${START}"; env -0; printf "${END}"`;

/** Extracts the text between the dump markers, or `null` if they are missing. */
export function extractEnvDump(stdout: string): string | null {
  const start = stdout.indexOf(START);
  const end = stdout.lastIndexOf(END);
  if (start < 0 || end < start) return null;
  return stdout.slice(start + START.length, end);
}

/** Parses `env -0` output. Values may contain newlines; entries without `=` are skipped. */
export function parseEnvDump(dump: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const entry of dump.split('\0')) {
    const eq = entry.indexOf('=');
    if (eq <= 0) continue;
    env[entry.slice(0, eq)] = entry.slice(eq + 1);
  }
  return env;
}

/**
 * Builds a PATH: `extra` first, then `base`, then `fallback` entries not already present.
 * Appending the fallback keeps whichever binary `base` already resolves (ADR-017).
 */
export function mergePath(
  base: string | undefined,
  fallback: string | undefined,
  extra: readonly string[],
  delimiter: string,
): string {
  const seen = new Set<string>();
  const result: string[] = [];
  const add = (dir: string) => {
    if (dir && !seen.has(dir)) {
      seen.add(dir);
      result.push(dir);
    }
  };
  extra.forEach(add);
  (base ?? '').split(delimiter).forEach(add);
  (fallback ?? '').split(delimiter).forEach(add);
  return result.join(delimiter);
}

export interface ShellRunResult {
  stdout: string;
  failed: boolean;
}

export type ShellRunner = (
  shell: string,
  args: string[],
  timeoutMs: number,
) => Promise<ShellRunResult>;

export const execShell: ShellRunner = (shell, args, timeoutMs) =>
  new Promise((resolve) => {
    execFile(
      shell,
      args,
      { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, env: process.env },
      (error, stdout) => resolve({ stdout: stdout ?? '', failed: error !== null }),
    );
  });

export interface ShellEnvOptions {
  shell: string | undefined;
  timeoutMs?: number;
  run?: ShellRunner;
}

/** Captures the user's login-shell environment once, on first use. Never throws. */
export class LoginShellEnv {
  private pending: Promise<Record<string, string> | null> | null = null;

  constructor(private readonly options: ShellEnvOptions) {}

  get(): Promise<Record<string, string> | null> {
    this.pending ??= this.capture();
    return this.pending;
  }

  /** Forgets the cached result (the "re-detect agents" button). */
  invalidate(): void {
    this.pending = null;
  }

  private async capture(): Promise<Record<string, string> | null> {
    const { shell, timeoutMs = 5000, run = execShell } = this.options;
    if (!shell) return null;
    try {
      const { stdout } = await run(shell, ['-ilc', ENV_DUMP_SCRIPT], timeoutMs);
      // A non-zero exit from a noisy rc file is fine as long as the dump came through.
      const dump = extractEnvDump(stdout);
      return dump === null ? null : parseEnvDump(dump);
    } catch {
      return null;
    }
  }
}

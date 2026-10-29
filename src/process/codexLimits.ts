// Reads Codex's account usage limits (plan T12, ADR-040). `codex-acp` keeps them to itself (only `/status`
// prints them), so AgentHub asks `codex app-server` directly with a short-lived process:
// `initialize` → `initialized` → `account/rateLimits/read` (✅ verified with Codex 0.165.0, ~0.8 s, no model call).

import { LineDecoder } from './LineDecoder';
import { spawnProcess, type ProcessRegistry } from './ProcessRunner';
import type { Env } from './ShellEnv';

export interface CodexLimitsOptions {
  /** Absolute path of the `codex` binary. */
  command: string;
  env: Env;
  cwd: string;
  registry?: ProcessRegistry;
  timeoutMs?: number;
}

/** The raw `account/rateLimits/read` result, or `null` on any failure. */
export async function readCodexRateLimits(options: CodexLimitsOptions): Promise<unknown> {
  const child = spawnProcess(
    { command: options.command, args: ['app-server'], cwd: options.cwd, env: options.env },
    options.registry,
  );
  const pending = new Map<number, (result: unknown) => void>();
  let nextId = 0;
  const request = (method: string, params?: unknown) =>
    new Promise<unknown>((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });

  const decoder = new LineDecoder({ maxLineLength: 1024 * 1024 });
  const onLine = (line: string) => {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof message !== 'object' || message === null) return;
    const { id, result, error, method } = message as Record<string, unknown>;
    // Requests from the server would need an answer; none is expected for these calls.
    if (typeof id !== 'number' || method !== undefined) return;
    pending.get(id)?.(error === undefined ? result : null);
    pending.delete(id);
  };
  child.stdout.on('data', (chunk: Buffer) => decoder.push(chunk).forEach(onLine));

  let timer: number | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = window.setTimeout(() => resolve(null), options.timeoutMs ?? 15_000);
  });
  const exited = child.exited.then(() => null);
  try {
    const query = (async () => {
      await request('initialize', {
        clientInfo: { name: 'agenthub', title: 'AgentHub', version: '0' },
      });
      child.stdin.write(`${JSON.stringify({ method: 'initialized' })}\n`);
      return request('account/rateLimits/read');
    })();
    return await Promise.race([query, timeout, exited]);
  } finally {
    window.clearTimeout(timer);
    void child.kill(500);
  }
}

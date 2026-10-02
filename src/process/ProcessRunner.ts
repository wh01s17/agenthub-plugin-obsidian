// Spawns agent processes and guarantees they (and their children) can be terminated (plan §4.6).

import type { ChildProcess } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';
import spawn from 'cross-spawn';
import { LineDecoder, RingBuffer } from './LineDecoder';
import type { Env } from './ShellEnv';

export interface SpawnOptions {
  command: string;
  args: readonly string[];
  cwd: string;
  env: Env;
  platform?: NodeJS.Platform;
  /** How many stderr lines to keep for error reports. */
  stderrCapacity?: number;
}

export interface ExitInfo {
  code: number | null;
  signal: NodeJS.Signals | null;
  /** Set when the process could not start (e.g. ENOENT). */
  error?: Error;
}

/** Variables that keep agent output free of ANSI colors. */
export const CHILD_ENV_DEFAULTS: Env = { NO_COLOR: '1', FORCE_COLOR: '0' };

export class ManagedProcess {
  readonly exited: Promise<ExitInfo>;
  private readonly stderr: RingBuffer<string>;
  private readonly stderrListeners = new Set<(line: string) => void>();
  private exitInfo: ExitInfo | null = null;

  constructor(
    private readonly child: ChildProcess,
    private readonly platform: NodeJS.Platform,
    stderrCapacity: number,
  ) {
    this.stderr = new RingBuffer(stderrCapacity);
    this.exited = new Promise((resolve) => {
      child.once('error', (error) => this.finish({ code: null, signal: null, error }, resolve));
      child.once('exit', (code, signal) => this.finish({ code, signal }, resolve));
    });

    const decoder = new LineDecoder({ maxLineLength: 64 * 1024 });
    const onLine = (line: string) => {
      this.stderr.push(line);
      this.stderrListeners.forEach((listener) => listener(line));
    };
    child.stderr?.on('data', (chunk: Buffer) => decoder.push(chunk).forEach(onLine));
    child.stderr?.on('end', () => decoder.flush().forEach(onLine));
    // Writing to a dead agent must not crash Obsidian.
    child.stdin?.on('error', () => undefined);
  }

  get pid(): number | undefined {
    return this.child.pid;
  }

  get running(): boolean {
    return this.exitInfo === null;
  }

  get stdin(): Writable {
    if (!this.child.stdin) throw new Error('stdin is not piped');
    return this.child.stdin;
  }

  get stdout(): Readable {
    if (!this.child.stdout) throw new Error('stdout is not piped');
    return this.child.stdout;
  }

  stderrTail(): string[] {
    return this.stderr.toArray();
  }

  onStderrLine(listener: (line: string) => void): { dispose(): void } {
    this.stderrListeners.add(listener);
    return { dispose: () => this.stderrListeners.delete(listener) };
  }

  /** SIGTERM to the whole process group, SIGKILL after `graceMs` if it is still alive. */
  async kill(graceMs = 3000): Promise<ExitInfo> {
    if (!this.running) return this.exited;
    this.signalTree('SIGTERM');
    const timer = window.setTimeout(() => this.signalTree('SIGKILL'), graceMs);
    try {
      return await this.exited;
    } finally {
      window.clearTimeout(timer);
    }
  }

  private signalTree(signal: NodeJS.Signals): void {
    const pid = this.child.pid;
    if (pid === undefined) return;
    if (this.platform === 'win32') {
      // taskkill /T takes the children with it; it is always forceful.
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' }).on(
        'error',
        () => undefined,
      );
      return;
    }
    try {
      process.kill(-pid, signal); // negative pid = the process group created by `detached`
    } catch {
      try {
        this.child.kill(signal);
      } catch {
        // Already gone.
      }
    }
  }

  private finish(info: ExitInfo, resolve: (info: ExitInfo) => void): void {
    if (this.exitInfo) return;
    this.exitInfo = info;
    resolve(info);
  }
}

/** Tracks every live agent process so the plugin can stop them all on unload. */
export class ProcessRegistry {
  private readonly processes = new Set<ManagedProcess>();

  add(process: ManagedProcess): void {
    this.processes.add(process);
    void process.exited.then(() => this.processes.delete(process));
  }

  get size(): number {
    return this.processes.size;
  }

  async killAll(graceMs?: number): Promise<void> {
    await Promise.all([...this.processes].map((p) => p.kill(graceMs)));
  }
}

export function spawnProcess(options: SpawnOptions, registry?: ProcessRegistry): ManagedProcess {
  const platform = options.platform ?? process.platform;
  const child = spawn(options.command, [...options.args], {
    cwd: options.cwd,
    env: { ...options.env, ...CHILD_ENV_DEFAULTS },
    stdio: ['pipe', 'pipe', 'pipe'],
    // Own process group on POSIX so the whole tree can be signalled (ADR-005).
    detached: platform !== 'win32',
    windowsHide: true,
  });
  const managed = new ManagedProcess(child, platform, options.stderrCapacity ?? 200);
  registry?.add(managed);
  return managed;
}

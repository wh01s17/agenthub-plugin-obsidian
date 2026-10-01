// @vitest-environment node
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { LineDecoder } from '../../src/process/LineDecoder';
import {
  ProcessRegistry,
  spawnProcess,
  type ManagedProcess,
} from '../../src/process/ProcessRunner';

const helper = fileURLToPath(new URL('../helpers/child-tree.mjs', import.meta.url));
const registry = new ProcessRegistry();

afterEach(() => registry.killAll(500));

function start(...args: string[]): ManagedProcess {
  return spawnProcess(
    { command: process.execPath, args: [helper, ...args], cwd: process.cwd(), env: process.env },
    registry,
  );
}

async function firstLine(proc: ManagedProcess): Promise<string> {
  const decoder = new LineDecoder();
  for (;;) {
    const [chunk] = (await once(proc.stdout, 'data')) as [Buffer];
    const [line] = decoder.push(chunk);
    if (line !== undefined) return line;
  }
}

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function waitUntilDead(pid: number, timeoutMs = 3000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

describe('spawnProcess', () => {
  it('pipes stdin/stdout and passes the no-color defaults', async () => {
    const proc = start();
    const decoder = new LineDecoder();
    await firstLine(proc);
    proc.stdin.write('hola\n');
    const [chunk] = (await once(proc.stdout, 'data')) as [Buffer];
    expect(decoder.push(chunk)).toEqual(['echo:hola']);
  });

  it('kills the whole tree, including grandchildren', async () => {
    const proc = start();
    const { grandchild } = JSON.parse(await firstLine(proc)) as { grandchild: number };
    expect(isAlive(grandchild)).toBe(true);

    const info = await proc.kill();
    expect(info.signal).toBe('SIGTERM');
    expect(proc.running).toBe(false);
    expect(await waitUntilDead(grandchild)).toBe(true);
  });

  it('escalates to SIGKILL when SIGTERM is ignored', async () => {
    const proc = start('--ignore-term');
    await firstLine(proc);
    const info = await proc.kill(200);
    expect(info.signal).toBe('SIGKILL');
  });

  it('keeps the tail of stderr', async () => {
    const proc = start('--stderr', '250');
    await firstLine(proc);
    await new Promise((r) => setTimeout(r, 100));
    const tail = proc.stderrTail();
    expect(tail).toHaveLength(200);
    expect(tail.at(-1)).toBe('err 250');
  });

  it('reports a missing binary through `exited` instead of throwing', async () => {
    const proc = spawnProcess({
      command: 'agenthub-binary-that-does-not-exist',
      args: [],
      cwd: process.cwd(),
      env: process.env,
    });
    const info = await proc.exited;
    expect(info.error?.message).toMatch(/ENOENT/);
    expect(proc.running).toBe(false);
  });
});

describe('ProcessRegistry', () => {
  it('kills every tracked process and forgets them', async () => {
    const procs = [start(), start()];
    await Promise.all(procs.map(firstLine));
    expect(registry.size).toBe(2);
    await registry.killAll(500);
    expect(procs.every((p) => !p.running)).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(registry.size).toBe(0);
  });
});

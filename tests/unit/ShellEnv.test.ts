import { describe, expect, it, vi } from 'vitest';
import {
  ENV_DUMP_SCRIPT,
  LoginShellEnv,
  extractEnvDump,
  mergePath,
  parseEnvDump,
  type ShellRunner,
} from '../../src/process/ShellEnv';

const dumpOutput = (entries: string[], noise = 'Welcome to zsh!\n') =>
  `${noise}__AGH_START__${entries.join('\0')}\0__AGH_END__`;

describe('extractEnvDump / parseEnvDump', () => {
  it('ignores shell noise around the markers', () => {
    const dump = extractEnvDump(dumpOutput(['A=1', 'PATH=/bin']));
    expect(parseEnvDump(dump ?? '')).toEqual({ A: '1', PATH: '/bin' });
  });

  it('keeps values with newlines and "=" signs', () => {
    expect(parseEnvDump('MULTI=a\nb\0EQ=x=y\0BROKEN\0=nokey\0')).toEqual({
      MULTI: 'a\nb',
      EQ: 'x=y',
    });
  });

  it('returns null when the markers are missing', () => {
    expect(extractEnvDump('zsh: command not found')).toBeNull();
  });
});

describe('mergePath', () => {
  it('puts extra first, keeps base order and appends new fallback entries', () => {
    expect(mergePath('/a:/b', '/b:/c', ['/x'], ':')).toBe('/x:/a:/b:/c');
  });

  it('handles missing values and empty entries', () => {
    expect(mergePath(undefined, '::/c', [], ':')).toBe('/c');
  });
});

describe('LoginShellEnv', () => {
  it('runs the login shell once and caches the result', async () => {
    const run = vi.fn<ShellRunner>().mockResolvedValue({
      stdout: dumpOutput(['PATH=/home/u/.local/bin']),
      failed: false,
    });
    const env = new LoginShellEnv({ shell: '/bin/zsh', run });

    await expect(env.get()).resolves.toEqual({ PATH: '/home/u/.local/bin' });
    await env.get();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('/bin/zsh', ['-ilc', ENV_DUMP_SCRIPT], 5000);
  });

  it('accepts a dump even if the shell exits with an error', async () => {
    const run: ShellRunner = () => Promise.resolve({ stdout: dumpOutput(['A=1']), failed: true });
    await expect(new LoginShellEnv({ shell: '/bin/zsh', run }).get()).resolves.toEqual({ A: '1' });
  });

  it('returns null without a shell, on timeout output or when the runner throws', async () => {
    await expect(new LoginShellEnv({ shell: undefined }).get()).resolves.toBeNull();
    const timedOut: ShellRunner = () => Promise.resolve({ stdout: 'banner', failed: true });
    await expect(new LoginShellEnv({ shell: '/bin/sh', run: timedOut }).get()).resolves.toBeNull();
    const throwing: ShellRunner = () => Promise.reject(new Error('ENOENT'));
    await expect(new LoginShellEnv({ shell: '/bin/sh', run: throwing }).get()).resolves.toBeNull();
  });

  it('runs again after invalidate()', async () => {
    const run = vi.fn<ShellRunner>().mockResolvedValue({ stdout: dumpOutput([]), failed: false });
    const env = new LoginShellEnv({ shell: '/bin/zsh', run });
    await env.get();
    env.invalidate();
    await env.get();
    expect(run).toHaveBeenCalledTimes(2);
  });
});

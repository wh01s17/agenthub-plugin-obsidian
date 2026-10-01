import { describe, expect, it, vi } from 'vitest';
import { CommandResolver, which, type IsExecutable } from '../../src/process/BinaryResolver';
import { LoginShellEnv, type ShellRunner } from '../../src/process/ShellEnv';

const fakeFs =
  (...files: string[]): IsExecutable =>
  (path) =>
    Promise.resolve(files.includes(path));

describe('which', () => {
  it('returns the first match in PATH order', async () => {
    const isExecutable = fakeFs('/b/claude', '/c/claude');
    await expect(
      which('claude', { PATH: '/a:/b:/c' }, { platform: 'linux', isExecutable }),
    ).resolves.toBe('/b/claude');
  });

  it('checks absolute and relative paths directly', async () => {
    const isExecutable = fakeFs('/opt/claude');
    await expect(which('/opt/claude', {}, { platform: 'linux', isExecutable })).resolves.toBe(
      '/opt/claude',
    );
    await expect(
      which('/opt/missing', {}, { platform: 'linux', isExecutable }),
    ).resolves.toBeNull();
  });

  it('tries PATHEXT extensions on Windows and finds a Path key in any case', async () => {
    const isExecutable = fakeFs('C:\\npm/claude.CMD');
    await expect(
      which(
        'claude',
        { Path: 'C:\\npm', PATHEXT: '.EXE;.CMD' },
        { platform: 'win32', isExecutable },
      ),
    ).resolves.toBe('C:\\npm/claude.CMD');
  });
});

describe('CommandResolver', () => {
  const shellWithPath = (path: string) => {
    const run = vi.fn<ShellRunner>().mockResolvedValue({
      stdout: `__AGH_START__PATH=${path}\0__AGH_END__`,
      failed: false,
    });
    return { run, loginShell: new LoginShellEnv({ shell: '/bin/zsh', run }) };
  };

  it('uses the process environment without touching the login shell (S1 case)', async () => {
    const { run, loginShell } = shellWithPath('/home/u/.local/bin');
    const resolver = new CommandResolver({
      baseEnv: { PATH: '/home/u/.local/share/mise/shims:/usr/bin' },
      platform: 'linux',
      loginShell,
      isExecutable: fakeFs('/home/u/.local/share/mise/shims/claude', '/home/u/.local/bin/claude'),
    });

    await expect(resolver.resolve('claude')).resolves.toMatchObject({
      path: '/home/u/.local/share/mise/shims/claude',
      source: 'process',
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('falls back to the login shell and appends its PATH entries', async () => {
    const { loginShell } = shellWithPath('/home/u/.local/bin:/usr/bin');
    const resolver = new CommandResolver({
      baseEnv: { PATH: '/usr/bin', HOME: '/home/u' },
      platform: 'linux',
      loginShell,
      isExecutable: fakeFs('/home/u/.local/bin/codex'),
    });

    const resolved = await resolver.resolve('codex');
    expect(resolved).toMatchObject({ path: '/home/u/.local/bin/codex', source: 'login-shell' });
    expect(resolved?.env).toEqual({ PATH: '/usr/bin:/home/u/.local/bin', HOME: '/home/u' });
  });

  it('puts configured extra directories first', async () => {
    const resolver = new CommandResolver({
      baseEnv: { PATH: '/usr/bin' },
      platform: 'linux',
      extraPath: ['/opt/agents'],
      isExecutable: fakeFs('/opt/agents/opencode', '/usr/bin/opencode'),
    });
    const resolved = await resolver.resolve('opencode');
    expect(resolved?.path).toBe('/opt/agents/opencode');
    expect(resolved?.env.PATH).toBe('/opt/agents:/usr/bin');
  });

  it('returns null when nothing is found, and never asks a shell on Windows', async () => {
    const { run, loginShell } = shellWithPath('/x');
    const linux = new CommandResolver({
      baseEnv: { PATH: '/usr/bin' },
      platform: 'linux',
      loginShell,
      isExecutable: fakeFs(),
    });
    await expect(linux.resolve('gemini')).resolves.toBeNull();

    run.mockClear();
    const windows = new CommandResolver({
      baseEnv: { Path: 'C:\\bin' },
      platform: 'win32',
      loginShell,
      isExecutable: fakeFs(),
    });
    await expect(windows.resolve('gemini')).resolves.toBeNull();
    expect(run).not.toHaveBeenCalled();
  });
});

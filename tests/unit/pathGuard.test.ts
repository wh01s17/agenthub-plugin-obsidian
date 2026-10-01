import { describe, expect, it } from 'vitest';
import { checkPath, isInside } from '../../src/core/pathGuard';

const policy = {
  vaultRoot: '/v',
  configDir: '.obsidian',
  protectConfigDir: true,
  allowedRoots: ['/extra'],
};

describe('isInside', () => {
  it('rejects escapes and siblings with a common prefix', () => {
    expect(isInside('/v', '/v')).toBe(true);
    expect(isInside('/v', '/v/a/b.md')).toBe(true);
    expect(isInside('/v', '/v/../etc/passwd')).toBe(false);
    expect(isInside('/v', '/vault2/x.md')).toBe(false);
  });
});

describe('checkPath', () => {
  it('maps vault files to vault paths', () => {
    expect(checkPath(policy, '/v/Notas/Ideas.md', 'write')).toEqual({
      allowed: true,
      vaultPath: 'Notas/Ideas.md',
    });
  });

  it('protects the config folder for writes only', () => {
    expect(checkPath(policy, '/v/.obsidian/app.json', 'write')).toEqual({
      allowed: false,
      reason: 'config-dir',
    });
    expect(checkPath(policy, '/v/.obsidian/app.json', 'read')).toMatchObject({ allowed: true });
    expect(checkPath(policy, '/v/.obsidian-notes/a.md', 'write')).toMatchObject({ allowed: true });
  });

  it('allows extra roots and rejects everything else', () => {
    expect(checkPath(policy, '/extra/a.txt', 'write')).toEqual({ allowed: true, vaultPath: null });
    expect(checkPath(policy, '/etc/passwd', 'read')).toEqual({ allowed: false, reason: 'outside' });
    expect(checkPath(policy, 'relative.md', 'read')).toEqual({
      allowed: false,
      reason: 'not-absolute',
    });
  });
});

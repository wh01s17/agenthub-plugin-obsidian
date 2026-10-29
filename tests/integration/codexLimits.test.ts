import { describe, expect, it } from 'vitest';
import { codexLimits } from '../../src/core/limits';
import { readCodexRateLimits } from '../../src/process/codexLimits';
import { ProcessRegistry } from '../../src/process/ProcessRunner';

const FAKE = 'tests/helpers/fake-codex-app-server.mjs';

describe('readCodexRateLimits (ADR-040)', () => {
  it('asks app-server for the rate limits and stops it', async () => {
    const registry = new ProcessRegistry();
    const result = await readCodexRateLimits({
      command: FAKE,
      env: process.env,
      cwd: process.cwd(),
      registry,
    });
    expect(codexLimits(result)).toEqual({
      fiveHour: { usedPercent: 3, resetsAt: 1793257112000 },
      weekly: { usedPercent: 20, resetsAt: 1793803807000 },
    });
  });

  it('gives up after the timeout', async () => {
    const result = await readCodexRateLimits({
      command: FAKE,
      env: { ...process.env, FAKE_CODEX_MODE: 'silent' },
      cwd: process.cwd(),
      timeoutMs: 300,
    });
    expect(result).toBeNull();
  });

  it('returns null when codex cannot start', async () => {
    const result = await readCodexRateLimits({
      command: '/nonexistent/codex',
      env: process.env,
      cwd: process.cwd(),
    });
    expect(result).toBeNull();
  });
});

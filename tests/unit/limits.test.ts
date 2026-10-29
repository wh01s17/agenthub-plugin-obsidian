import { describe, expect, it, vi } from 'vitest';
import { claudeLimits, codexLimits, isCodexCommand, LimitsCache } from '../../src/core/limits';

describe('claudeLimits (ADR-040)', () => {
  it('reads both unified windows as percentages with resets in milliseconds', () => {
    const meta = {
      '_claude/rateLimit': {
        status: 'allowed',
        unifiedWindows: {
          five_hour: { utilization: 0.22, resetsAt: 1793257200 },
          seven_day: { utilization: 0.03, resetsAt: 1793844000 },
        },
      },
    };
    expect(claudeLimits(meta)).toEqual({
      fiveHour: { usedPercent: 22, resetsAt: 1793257200000 },
      weekly: { usedPercent: 3, resetsAt: 1793844000000 },
    });
  });

  it('ignores meta without windows', () => {
    expect(claudeLimits(undefined)).toBeNull();
    expect(claudeLimits({ '_claude/rateLimit': { status: 'allowed' } })).toBeNull();
    expect(claudeLimits({ '_claude/rateLimit': { unifiedWindows: { five_hour: {} } } })).toBeNull();
  });
});

describe('codexLimits (ADR-040)', () => {
  it('matches windows by their length', () => {
    const result = {
      rateLimits: {
        primary: { usedPercent: 3, windowDurationMins: 300, resetsAt: 1793257112 },
        secondary: { usedPercent: 20, windowDurationMins: 10080, resetsAt: 1793803807 },
      },
    };
    expect(codexLimits(result)).toEqual({
      fiveHour: { usedPercent: 3, resetsAt: 1793257112000 },
      weekly: { usedPercent: 20, resetsAt: 1793803807000 },
    });
    expect(
      codexLimits({ rateLimits: { primary: { usedPercent: 50, windowDurationMins: 10080 } } }),
    ).toEqual({ weekly: { usedPercent: 50, resetsAt: undefined } });
  });

  it('returns null without usable windows', () => {
    expect(codexLimits(null)).toBeNull();
    expect(codexLimits({ rateLimits: { primary: null, secondary: null } })).toBeNull();
    expect(
      codexLimits({ rateLimits: { primary: { usedPercent: 1, windowDurationMins: 60 } } }),
    ).toBeNull();
  });
});

describe('isCodexCommand', () => {
  it('recognizes the Codex preset and the codex binary', () => {
    expect(isCodexCommand('npx', ['-y', '@agentclientprotocol/codex-acp@2.1.1'])).toBe(true);
    expect(isCodexCommand('/usr/local/bin/codex-acp', [])).toBe(true);
    expect(isCodexCommand('codex', ['app-server'])).toBe(true);
    expect(isCodexCommand('npx', ['-y', '@agentclientprotocol/claude-agent-acp@0.85.0'])).toBe(
      false,
    );
    expect(isCodexCommand('opencode', ['acp'])).toBe(false);
  });
});

describe('LimitsCache', () => {
  it('shares one reading for the TTL, then reads again', async () => {
    let now = 0;
    const read = vi.fn(() => Promise.resolve({ fiveHour: { usedPercent: now } }));
    const cache = new LimitsCache(read, 60_000, () => now);
    await Promise.all([cache.get(), cache.get()]);
    expect(read).toHaveBeenCalledOnce();
    now = 59_999;
    await cache.get();
    expect(read).toHaveBeenCalledOnce();
    now = 60_000;
    expect(await cache.get()).toEqual({ fiveHour: { usedPercent: 60_000 } });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('turns a failed reading into null', async () => {
    const cache = new LimitsCache(() => Promise.reject(new Error('no codex')));
    expect(await cache.get()).toBeNull();
  });
});

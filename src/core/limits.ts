// Account usage limits (plan T12, ADR-040): the 5-hour and weekly windows, from what each agent reports.
// Pure parsing of the agents' formats; fetching lives in the adapters and the plugin.

import type { LimitWindow, RateLimits } from './types';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const clamp = (percent: number) => Math.min(100, Math.max(0, percent));

/**
 * Claude (`claude-agent-acp`): `usage_update._meta["_claude/rateLimit"].unifiedWindows`, with
 * `utilization` as a fraction and `resetsAt` in seconds (✅ verified 2026-10-28 against `/usage`).
 */
export function claudeLimits(meta: unknown): RateLimits | null {
  const info = isObject(meta) ? meta['_claude/rateLimit'] : undefined;
  const windows = isObject(info) ? info.unifiedWindows : undefined;
  if (!isObject(windows)) return null;
  const window = (raw: unknown): LimitWindow | undefined => {
    if (!isObject(raw)) return undefined;
    const utilization = num(raw.utilization);
    if (utilization === undefined) return undefined;
    const resetsAt = num(raw.resetsAt);
    return {
      usedPercent: clamp(utilization * 100),
      resetsAt: resetsAt === undefined ? undefined : resetsAt * 1000,
    };
  };
  return compact({ fiveHour: window(windows.five_hour), weekly: window(windows.seven_day) });
}

const FIVE_HOURS_MIN = 300;
const WEEK_MIN = 7 * 24 * 60;

/**
 * Codex (`codex app-server`, `account/rateLimits/read`): `rateLimits.primary`/`secondary` with
 * `usedPercent`, `windowDurationMins` and `resetsAt` in seconds (✅ verified with Codex 0.165.0).
 * Windows are matched by their length, not by their position.
 */
export function codexLimits(result: unknown): RateLimits | null {
  const limits = isObject(result) ? result.rateLimits : undefined;
  if (!isObject(limits)) return null;
  const found: RateLimits = {};
  for (const raw of [limits.primary, limits.secondary]) {
    if (!isObject(raw)) continue;
    const used = num(raw.usedPercent);
    const minutes = num(raw.windowDurationMins);
    if (used === undefined || minutes === undefined) continue;
    const resetsAt = num(raw.resetsAt);
    const window = {
      usedPercent: clamp(used),
      resetsAt: resetsAt === undefined ? undefined : resetsAt * 1000,
    };
    if (minutes === FIVE_HOURS_MIN) found.fiveHour = window;
    else if (minutes === WEEK_MIN) found.weekly = window;
  }
  return compact(found);
}

function compact(limits: RateLimits): RateLimits | null {
  const out: RateLimits = {};
  if (limits.fiveHour) out.fiveHour = limits.fiveHour;
  if (limits.weekly) out.weekly = limits.weekly;
  return out.fiveHour || out.weekly ? out : null;
}

/** Whether an agent command runs Codex (`codex-acp` or `codex …`), whose limits come from `codex app-server`. */
export function isCodexCommand(command: string, args: readonly string[]): boolean {
  const name = (path: string) =>
    path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
  return [command, ...args].some((part) => {
    const base = name(part).replace(/\.(exe|cmd)$/i, '');
    return base === 'codex' || /(^|\/)codex-acp(@|$)/.test(part) || base === 'codex-acp';
  });
}

/** Shares one reading among sessions and callers for `ttlMs` (limits belong to the account). */
export class LimitsCache {
  private value: { at: number; limits: RateLimits | null } | null = null;
  private inFlight: Promise<RateLimits | null> | null = null;

  constructor(
    private readonly read: () => Promise<RateLimits | null>,
    private readonly ttlMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  get(): Promise<RateLimits | null> {
    if (this.value && this.now() - this.value.at < this.ttlMs) {
      return Promise.resolve(this.value.limits);
    }
    this.inFlight ??= this.read()
      .catch(() => null)
      .then((limits) => {
        this.value = { at: this.now(), limits };
        this.inFlight = null;
        return limits;
      });
    return this.inFlight;
  }
}

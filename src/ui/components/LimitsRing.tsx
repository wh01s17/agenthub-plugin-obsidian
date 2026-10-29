import { useEffect, useState } from 'preact/hooks';
import type { LimitWindow, RateLimits } from '../../core/types';
import { t } from '../../i18n';

/** How long each window stays on screen before the ring shows the other one. */
export const ROTATE_MS = 7000;

const WINDOWS = ['fiveHour', 'weekly'] as const;
type WindowKey = (typeof WINDOWS)[number];

const LABEL: Record<WindowKey, string> = { fiveHour: '5h', weekly: 'w' };
const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function resetText(window: LimitWindow, key: WindowKey): string {
  if (window.resetsAt === undefined) return '';
  const date = new Date(window.resetsAt);
  const time = date.toLocaleString(undefined, {
    ...(key === 'weekly' ? { weekday: 'short' } : {}),
    hour: 'numeric',
    minute: '2-digit',
  });
  return ` · ${t('limitResets', { time })}`;
}

/** Both windows, one per line: the ring's tooltip and accessible name. */
export function limitsDetail(limits: RateLimits): string {
  return WINDOWS.flatMap((key) => {
    const window = limits[key];
    if (!window) return [];
    const percent = Math.round(window.usedPercent);
    const name = t(key === 'fiveHour' ? 'limitFiveHour' : 'limitWeekly', { percent });
    return [name + resetText(window, key)];
  }).join('\n');
}

function level(percent: number): string {
  if (percent >= 90) return 'is-critical';
  if (percent >= 75) return 'is-warning';
  return '';
}

/**
 * Account usage limits (ADR-040): a small ring next to the options that shows the 5-hour window and the
 * weekly one in turn (`5h`, `w`), with both in the tooltip.
 */
export function LimitsRing({ limits }: { limits: RateLimits }) {
  const shown = WINDOWS.filter((key) => limits[key]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (shown.length < 2) return;
    const id = window.setInterval(() => setIndex((value) => value + 1), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [shown.length]);

  const key = shown[index % shown.length];
  const current = key ? limits[key] : undefined;
  if (!key || !current) return null;
  const percent = Math.round(current.usedPercent);
  const detail = limitsDetail(limits);
  return (
    <span
      class={`agenthub-limits ${level(percent)}`}
      role="img"
      tabIndex={0}
      aria-label={detail}
      title={detail}
      data-window={key}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle class="agenthub-limits-track" cx="12" cy="12" r={RADIUS} />
        <circle
          class="agenthub-limits-value"
          cx="12"
          cy="12"
          r={RADIUS}
          stroke-dasharray={CIRCUMFERENCE}
          stroke-dashoffset={CIRCUMFERENCE * (1 - current.usedPercent / 100)}
          transform="rotate(-90 12 12)"
        />
      </svg>
      <span class="agenthub-limits-label" aria-hidden="true">
        {LABEL[key]}
      </span>
    </span>
  );
}

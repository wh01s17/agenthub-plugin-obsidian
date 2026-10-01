import type { SessionStatus, Usage } from '../../core/types';
import { t, type MessageKey } from '../../i18n';

const STATUS_TEXT: Record<SessionStatus, MessageKey> = {
  idle: 'statusIdle',
  starting: 'statusStarting',
  running: 'statusRunning',
  'awaiting-permission': 'statusAwaiting',
  error: 'statusError',
  closed: 'statusClosed',
};

export function contextPercent(usage: Usage | undefined): number | null {
  if (!usage?.contextSize || usage.contextUsed === undefined) return null;
  return Math.min(100, Math.round((usage.contextUsed / usage.contextSize) * 100));
}

export function StatusBar({ status, usage }: { status: SessionStatus; usage?: Usage }) {
  const percent = contextPercent(usage);
  return (
    <div class={`agenthub-status is-${status}`}>
      {/* The only live region of the view: announces state changes, not streamed text. */}
      <span class="agenthub-status-text" role="status" aria-live="polite">
        {t(STATUS_TEXT[status])}
      </span>
      {percent !== null && (
        <span class="agenthub-status-usage">{t('contextUsage', { percent })}</span>
      )}
      {usage?.costUsd !== undefined && usage.costUsd > 0 && (
        <span class="agenthub-status-usage">
          {t('costUsd', { cost: usage.costUsd.toFixed(2) })}
        </span>
      )}
    </div>
  );
}

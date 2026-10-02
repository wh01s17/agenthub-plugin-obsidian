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

/** States that show animated "…" dots while the agent works. */
const ANIMATED = new Set<SessionStatus>(['starting', 'running']);

/**
 * Text with a trailing ellipsis whose dots appear one by one. Screen readers get the plain text;
 * the animated dots are decorative.
 */
function StatusText({ text, animated }: { text: string; animated: boolean }) {
  const base = text.replace(/(…|\.\.\.)$/, '');
  if (!animated || base === text) return <>{text}</>;
  return (
    <>
      <span class="agenthub-visually-hidden">{text}</span>
      <span aria-hidden="true">
        {base}
        <span class="agenthub-dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </span>
    </>
  );
}

export function contextPercent(usage: Usage | undefined): number | null {
  if (!usage?.contextSize || usage.contextUsed === undefined) return null;
  return Math.min(100, Math.round((usage.contextUsed / usage.contextSize) * 100));
}

export function StatusBar({
  status,
  usage,
  showUsage = true,
}: {
  status: SessionStatus;
  usage?: Usage;
  /** Context and cost badges (appearance setting). */
  showUsage?: boolean;
}) {
  const percent = showUsage ? contextPercent(usage) : null;
  const cost = showUsage ? usage?.costUsd : undefined;
  return (
    <div class={`agenthub-status is-${status}`}>
      {/* The only live region of the view: announces state changes, not streamed text. */}
      <span class="agenthub-status-text" role="status" aria-live="polite">
        <StatusText text={t(STATUS_TEXT[status])} animated={ANIMATED.has(status)} />
      </span>
      {percent !== null && (
        <span class="agenthub-status-usage">{t('contextUsage', { percent })}</span>
      )}
      {cost !== undefined && cost > 0 && (
        <span class="agenthub-status-usage">{t('costUsd', { cost: cost.toFixed(2) })}</span>
      )}
    </div>
  );
}

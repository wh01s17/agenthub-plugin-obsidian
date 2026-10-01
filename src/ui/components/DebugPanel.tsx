import { t } from '../../i18n';

const SHOWN_LINES = 200;

/** Raw agent output (stderr, unknown updates). Shown only when enabled in settings (RF-19). */
export function DebugPanel({ lines }: { lines: readonly string[] }) {
  const shown = lines.slice(-SHOWN_LINES);
  return (
    <details class="agenthub-debug">
      <summary>{t('debugTitle')}</summary>
      <pre class="agenthub-debug-output">
        {shown.length > 0 ? shown.join('\n') : t('debugEmpty')}
      </pre>
    </details>
  );
}

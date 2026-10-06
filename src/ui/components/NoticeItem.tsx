import type { Notice } from '../../core/types';
import { t } from '../../i18n';
import { Icon } from './Icon';

const LEVEL_ICONS = { info: 'info', warning: 'alert-triangle', error: 'alert-octagon' } as const;

export function noticeText(notice: Notice): string {
  switch (notice.key) {
    case 'agentError':
      switch (notice.kind) {
        case 'missing-binary':
          return t('errorMissingBinary');
        case 'auth':
          return t('errorAuth');
        case 'startup':
          return t('errorStartup');
        case 'crash':
          return t('errorCrash');
        case 'unsafe-mode':
          return t('errorUnsafeMode');
        default:
          // Protocol errors carry the agent's own message, which we cannot translate.
          return notice.message;
      }
    case 'permissionDenied':
      return t('noticePermissionDenied', { tool: notice.toolName });
    case 'contextNotRestored':
      return t('noticeContextNotRestored');
    case 'imagesNotSent':
      return t('noticeImagesNotSent');
    case 'turnStopped':
      switch (notice.stopReason) {
        case 'cancelled':
          return t('noticeCancelled');
        case 'max_tokens':
          return t('noticeMaxTokens');
        case 'max_turn_requests':
          return t('noticeMaxTurns');
        case 'refusal':
          return t('noticeRefusal');
        case 'error':
          return '';
      }
  }
}

export function NoticeItem({ level, notice }: { level: keyof typeof LEVEL_ICONS; notice: Notice }) {
  const hint = notice.key === 'agentError' ? notice.hint : undefined;
  const detail = notice.key === 'agentError' ? notice.detail : undefined;
  return (
    <div class={`agenthub-notice is-${level}`} role={level === 'error' ? 'alert' : undefined}>
      <Icon name={LEVEL_ICONS[level]} />
      <div class="agenthub-notice-body">
        <div>{noticeText(notice)}</div>
        {hint && <div class="agenthub-notice-hint">{hint}</div>}
        {detail && (
          <details>
            <summary>{t('noticeErrorDetail')}</summary>
            <pre class="agenthub-tool-output">{detail}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

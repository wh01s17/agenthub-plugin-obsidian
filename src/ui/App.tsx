import { t } from '../i18n';

export interface AppProps {
  /** Local id of the session shown in this view; `null` until sessions exist (Fase 2). */
  sessionId: string | null;
}

export function App({ sessionId }: AppProps) {
  return (
    <div class="agenthub-app" data-session-id={sessionId ?? undefined}>
      <header class="agenthub-header">
        <span class="agenthub-header-title">{t('viewTitle')}</span>
      </header>
      <div class="agenthub-empty" role="status">
        <p class="agenthub-empty-title">{t('emptyTitle')}</p>
        <p class="agenthub-empty-body">{t('emptyBody')}</p>
      </div>
    </div>
  );
}

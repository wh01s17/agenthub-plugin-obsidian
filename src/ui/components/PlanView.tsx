import type { PlanEntry } from '../../core/types';
import { t } from '../../i18n';
import { Icon } from './Icon';

const ICONS: Record<PlanEntry['status'], string> = {
  pending: 'circle',
  in_progress: 'circle-dot',
  completed: 'circle-check',
};

export function PlanView({ entries }: { entries: readonly PlanEntry[] }) {
  return (
    <section class="agenthub-plan" aria-label={t('planTitle')}>
      <div class="agenthub-plan-title">{t('planTitle')}</div>
      <ol class="agenthub-plan-list">
        {entries.map((entry, index) => (
          <li key={index} class={`agenthub-plan-entry is-${entry.status}`}>
            <Icon name={ICONS[entry.status]} />
            <span>{entry.content}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

import type { PermissionOutcome, PermissionRequest } from '../../core/types';
import { t } from '../../i18n';
import { Icon } from './Icon';

interface PermissionCardProps {
  request: PermissionRequest;
  resolved?: PermissionOutcome;
  onAnswer: (outcome: PermissionOutcome) => void;
}

function answerText(request: PermissionRequest, resolved: PermissionOutcome): string {
  if (resolved.outcome === 'cancelled') return t('permissionCancelled');
  const option = request.options.find((o) => o.id === resolved.optionId);
  return t('permissionAnswered', { option: option?.label ?? resolved.optionId });
}

export function PermissionCard({ request, resolved, onAnswer }: PermissionCardProps) {
  return (
    <section
      class={`agenthub-permission ${resolved ? 'is-resolved' : 'is-pending'}`}
      aria-label={t('permissionTitle')}
    >
      <div class="agenthub-permission-header">
        <Icon name="shield-alert" />
        <span>{t('permissionTitle')}</span>
      </div>
      <div class="agenthub-permission-title">{request.toolCall.title}</div>
      {resolved ? (
        <div class="agenthub-permission-answer">{answerText(request, resolved)}</div>
      ) : (
        <div class="agenthub-permission-actions">
          {request.options.map((option) => (
            <button
              key={option.id}
              type="button"
              class={option.kind.startsWith('allow') ? 'mod-cta' : 'mod-warning'}
              onClick={() => onAnswer({ outcome: 'selected', optionId: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

import type { PermissionOutcome, PermissionRequest } from '../../core/types';
import { t } from '../../i18n';
import { Icon } from './Icon';

interface PermissionCardProps {
  request: PermissionRequest;
  resolved?: PermissionOutcome;
  onAnswer: (outcome: PermissionOutcome) => void;
  /** How to show the title, which may contain paths. */
  textLabel?: (text: string) => string;
}

function answerText(request: PermissionRequest, resolved: PermissionOutcome): string {
  if (resolved.outcome === 'cancelled') return t('permissionCancelled');
  const option = request.options.find((o) => o.id === resolved.optionId);
  return t('permissionAnswered', { option: option?.label ?? resolved.optionId });
}

/**
 * One primary action (the first "allow"), quiet outline buttons for the rest and a red outline for
 * rejections, so the safe choices are easy to tell apart.
 */
function buttonClass(
  request: PermissionRequest,
  option: PermissionRequest['options'][number],
): string {
  if (!option.kind.startsWith('allow')) return 'agenthub-button is-danger';
  const primary = request.options.find((o) => o.kind.startsWith('allow'));
  return option.id === primary?.id ? 'mod-cta' : 'agenthub-button';
}

export function PermissionCard({
  request,
  resolved,
  onAnswer,
  textLabel = (text) => text,
}: PermissionCardProps) {
  return (
    <section
      class={`agenthub-permission ${resolved ? 'is-resolved' : 'is-pending'}`}
      aria-label={t('permissionTitle')}
    >
      <div class="agenthub-permission-header">
        <Icon name="shield-alert" />
        <span>{t('permissionTitle')}</span>
      </div>
      <div class="agenthub-permission-title">{textLabel(request.toolCall.title)}</div>
      {resolved ? (
        <div class="agenthub-permission-answer">{answerText(request, resolved)}</div>
      ) : (
        <div class="agenthub-permission-actions">
          {request.options.map((option) => (
            <button
              key={option.id}
              type="button"
              class={buttonClass(request, option)}
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

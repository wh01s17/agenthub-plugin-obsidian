import type { SelectionRef } from '../../core/PromptBuilder';
import { t } from '../../i18n';
import { Icon } from './Icon';

interface ContextChipsProps {
  activeNotePath: string | null;
  includeActive: boolean;
  selection: SelectionRef | null;
  onToggleActive: () => void;
  onRemoveSelection: () => void;
}

const baseName = (path: string) => path.split('/').pop()?.replace(/\.md$/, '') ?? path;

/** What will travel with the next message: the current note (toggleable) and a captured selection. */
export function ContextChips(props: ContextChipsProps) {
  const { activeNotePath, includeActive, selection } = props;
  if (!activeNotePath && !selection) return null;
  return (
    <div class="agenthub-chips">
      {activeNotePath && (
        <button
          type="button"
          class={`agenthub-chip ${includeActive ? 'is-on' : 'is-off'}`}
          aria-pressed={includeActive}
          title={t('chipToggleActive')}
          onClick={props.onToggleActive}
        >
          <Icon name={includeActive ? 'file-text' : 'file-x'} />
          <span>
            {t(includeActive ? 'chipActiveNote' : 'chipActiveNoteOff', {
              name: baseName(activeNotePath),
            })}
          </span>
        </button>
      )}
      {selection && (
        <span class="agenthub-chip is-on">
          <Icon name="text-select" />
          <span>
            {t('chipSelection', {
              name: baseName(selection.path),
              from: selection.fromLine,
              to: selection.toLine,
            })}
          </span>
          <button
            type="button"
            class="clickable-icon agenthub-chip-remove"
            aria-label={t('chipRemove')}
            onClick={props.onRemoveSelection}
          >
            <Icon name="x" />
          </button>
        </span>
      )}
    </div>
  );
}

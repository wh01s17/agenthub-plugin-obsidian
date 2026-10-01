import { useRef, useState } from 'preact/hooks';
import { applySuggestion, findTrigger, rankMatches, type Trigger } from '../../core/suggest';
import type { SlashCommand } from '../../core/types';
import { t } from '../../i18n';
import { Icon } from './Icon';

interface ComposerProps {
  agentLabel: string;
  busy: boolean;
  disabled: boolean;
  sendWith: 'enter' | 'mod-enter';
  /** Vault note paths for `@` completion (read lazily). */
  notes: () => string[];
  /** Agent slash commands for `/` completion. */
  commands: readonly SlashCommand[];
  onSend: (text: string) => void;
  onStop: () => void;
}

interface Suggestions {
  trigger: Trigger;
  items: { value: string; detail?: string }[];
  active: number;
}

const LISTBOX_ID = 'agenthub-suggestions';

/** Whether a key press should send, given the user's preference (plan §4.11). */
export function isSendKey(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'isComposing'>,
  sendWith: 'enter' | 'mod-enter',
): boolean {
  if (event.key !== 'Enter' || event.isComposing) return false;
  const mod = event.ctrlKey || event.metaKey;
  return sendWith === 'enter' ? !event.shiftKey && !mod : mod;
}

export function Composer(props: ComposerProps) {
  const { agentLabel, busy, disabled, sendWith, onSend, onStop } = props;
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  const updateSuggestions = (value: string, cursor: number) => {
    const trigger = findTrigger(value, cursor);
    if (!trigger) return setSuggestions(null);
    const items =
      trigger.kind === 'note'
        ? rankMatches(trigger.query, props.notes()).map((value) => ({ value }))
        : rankMatches(
            trigger.query,
            props.commands.map((c) => c.name),
          ).map((name) => ({
            value: name,
            detail: props.commands.find((c) => c.name === name)?.description,
          }));
    setSuggestions(items.length > 0 ? { trigger, items, active: 0 } : null);
  };

  const choose = (index: number) => {
    const el = ref.current;
    const item = suggestions?.items[index];
    if (!el || !suggestions || !item) return;
    const next = applySuggestion(text, el.selectionStart, suggestions.trigger, item.value);
    setText(next.text);
    setSuggestions(null);
    // Restore the caret after Preact updates the value.
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.cursor, next.cursor);
    });
  };

  const send = () => {
    const message = text.trim();
    if (!message || busy || disabled) return;
    onSend(message);
    setText('');
    setSuggestions(null);
    ref.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (suggestions) {
      const count = suggestions.items.length;
      const move = (delta: number) => {
        event.preventDefault();
        setSuggestions({ ...suggestions, active: (suggestions.active + delta + count) % count });
      };
      if (event.key === 'ArrowDown') return move(1);
      if (event.key === 'ArrowUp') return move(-1);
      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
        event.preventDefault();
        return choose(suggestions.active);
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        return setSuggestions(null);
      }
    }
    if (isSendKey(event, sendWith)) {
      event.preventDefault();
      send();
    }
  };

  const activeId = suggestions ? `${LISTBOX_ID}-${suggestions.active}` : undefined;

  return (
    <div class="agenthub-composer">
      {suggestions && (
        <ul
          id={LISTBOX_ID}
          class="agenthub-suggestions"
          role="listbox"
          aria-label={t(suggestions.trigger.kind === 'note' ? 'suggestNotes' : 'suggestCommands')}
        >
          {suggestions.items.map((item, index) => (
            <li
              key={item.value}
              id={`${LISTBOX_ID}-${index}`}
              role="option"
              aria-selected={index === suggestions.active}
              class={`agenthub-suggestion ${index === suggestions.active ? 'is-active' : ''}`}
              // Keep focus in the textarea while picking with the mouse.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(index);
              }}
            >
              <span class="agenthub-suggestion-value">{item.value}</span>
              {item.detail && <span class="agenthub-suggestion-detail">{item.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={ref}
        class="agenthub-composer-input"
        rows={3}
        value={text}
        disabled={disabled}
        aria-autocomplete="list"
        aria-controls={suggestions ? LISTBOX_ID : undefined}
        aria-activedescendant={activeId}
        aria-label={t('composerLabel')}
        placeholder={t('composerPlaceholder', { agent: agentLabel })}
        onInput={(event) => {
          const el = event.currentTarget;
          setText(el.value);
          updateSuggestions(el.value, el.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setSuggestions(null)}
      />
      {busy ? (
        <button
          type="button"
          class="agenthub-composer-button mod-warning"
          onClick={onStop}
          aria-label={t('stop')}
        >
          <Icon name="square" />
          <span>{t('stop')}</span>
        </button>
      ) : (
        <button
          type="button"
          class="agenthub-composer-button mod-cta"
          onClick={send}
          disabled={disabled || !text.trim()}
          aria-label={t('send')}
        >
          <Icon name="send" />
          <span>{t('send')}</span>
        </button>
      )}
    </div>
  );
}

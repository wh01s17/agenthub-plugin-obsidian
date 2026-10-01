import { useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { Icon } from './Icon';

interface ComposerProps {
  agentLabel: string;
  busy: boolean;
  disabled: boolean;
  sendWith: 'enter' | 'mod-enter';
  onSend: (text: string) => void;
  onStop: () => void;
}

/** Whether a key press should send, given the user's preference (plan §4.11). */
export function isSendKey(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'isComposing'>,
  sendWith: 'enter' | 'mod-enter',
): boolean {
  if (event.key !== 'Enter' || event.isComposing) return false;
  const mod = event.ctrlKey || event.metaKey;
  return sendWith === 'enter' ? !event.shiftKey && !mod : mod;
}

export function Composer({ agentLabel, busy, disabled, sendWith, onSend, onStop }: ComposerProps) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    const message = text.trim();
    if (!message || busy || disabled) return;
    onSend(message);
    setText('');
    ref.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isSendKey(event, sendWith)) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div class="agenthub-composer">
      <textarea
        ref={ref}
        class="agenthub-composer-input"
        rows={3}
        value={text}
        disabled={disabled}
        aria-label={t('composerLabel')}
        placeholder={t('composerPlaceholder', { agent: agentLabel })}
        onInput={(event) => setText(event.currentTarget.value)}
        onKeyDown={onKeyDown}
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

import type { PromptBlock, QueuedMessage } from '../../core/types';
import { t } from '../../i18n';
import { Icon } from './Icon';

/** What the user typed in a message (the first text block, see `buildPrompt`). */
export function typedText(blocks: readonly PromptBlock[]): string {
  const first = blocks[0];
  return first?.type === 'text' ? first.text : '';
}

interface QueuedMessagesProps {
  queue: readonly QueuedMessage[];
  paused: boolean;
  onSendNow: (id: string) => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}

/** Messages written while the agent works, waiting for its turn to end (ADR-036). */
export function QueuedMessages({
  queue,
  paused,
  onSendNow,
  onEdit,
  onRemove,
}: QueuedMessagesProps) {
  if (queue.length === 0) return null;
  return (
    <section class={`agenthub-queue ${paused ? 'is-paused' : ''}`} aria-label={t('queueLabel')}>
      <p class="agenthub-queue-title">
        {paused ? t('queuePaused') : t('queueWaiting', { count: queue.length })}
      </p>
      <ol class="agenthub-queue-list">
        {queue.map((message, index) => {
          const text = typedText(message.blocks);
          const images = message.blocks.filter((block) => block.type === 'image').length;
          const n = index + 1;
          return (
            <li key={message.id} class="agenthub-queue-item">
              <Icon name="corner-down-right" class="agenthub-queue-marker" />
              <span class="agenthub-queue-text" title={text}>
                {text || t('queueImagesOnly')}
              </span>
              {images > 0 && (
                <span class="agenthub-queue-images" title={t('imagesAttached')}>
                  <Icon name="image" />
                  {images}
                </span>
              )}
              <button
                type="button"
                class="clickable-icon"
                aria-label={t('queueSendNow', { n })}
                title={t('queueSendNow', { n })}
                onClick={() => onSendNow(message.id)}
              >
                <Icon name="send-horizontal" />
              </button>
              <button
                type="button"
                class="clickable-icon"
                aria-label={t('queueEdit', { n })}
                title={t('queueEdit', { n })}
                onClick={() => onEdit(message.id)}
              >
                <Icon name="pencil" />
              </button>
              <button
                type="button"
                class="clickable-icon"
                aria-label={t('queueRemove', { n })}
                title={t('queueRemove', { n })}
                onClick={() => onRemove(message.id)}
              >
                <Icon name="x" />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

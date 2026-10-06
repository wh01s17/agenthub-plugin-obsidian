import { Notice } from 'obsidian';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { imageDataUrl, MAX_IMAGES_PER_MESSAGE, type ImageBlock } from '../../core/images';
import type { PromptHistory } from '../../core/PromptHistory';
import { applySuggestion, findTrigger, rankMatches, type Trigger } from '../../core/suggest';
import type { SlashCommand } from '../../core/types';
import { t } from '../../i18n';
import { draggingFiles, pastedImages, readImage, type ImageResult } from '../imageFiles';
import { Icon } from './Icon';

interface ComposerProps {
  agentLabel: string;
  busy: boolean;
  disabled: boolean;
  sendWith: 'enter' | 'mod-enter';
  /** Vault note paths for `@` completion (read lazily). */
  notes: () => string[];
  /** Prompts sent earlier, recalled with Up/Down like a shell. */
  history?: PromptHistory;
  /** Agent slash commands for `/` completion. */
  commands: readonly SlashCommand[];
  /** The message text (trimmed, may be empty if images go along) and the attached images. */
  onSend: (text: string, images: ImageBlock[]) => void;
  onStop: () => void;
  /** Shown at the top of the message box (context chips: what travels with the message). */
  children?: ComponentChildren;
  /** The agent's options, when they live in the composer (ADR-032). */
  options?: ComponentChildren;
}

interface Suggestions {
  trigger: Trigger;
  items: { value: string; detail?: string }[];
  active: number;
}

const LISTBOX_ID = 'agenthub-suggestions';

interface PendingImage {
  key: number;
  block: ImageBlock;
}

function rejectionText(result: Extract<ImageResult, { ok: false }>): string {
  const name = result.name;
  if (result.reason === 'type') return t('imageUnsupportedType', { name });
  if (result.reason === 'size') return t('imageTooLarge', { name });
  return t('imageReadFailed', { name });
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

export function Composer(props: ComposerProps) {
  const { agentLabel, busy, disabled, sendWith, onSend, onStop } = props;
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [images, setImagesState] = useState<PendingImage[]>([]);
  const [dropping, setDropping] = useState(false);
  // Mirrors `images` so reads that finish later add to the current list, not a stale one.
  const imagesRef = useRef<PendingImage[]>([]);
  const imageKey = useRef(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Position while browsing the history (`null`: editing a new prompt) and the text it replaced.
  const recall = useRef<{ index: number; draft: string } | null>(null);

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

  /** Shows a history entry (or the draft) with the caret at its end. */
  const showRecalled = (value: string) => {
    setText(value);
    const el = ref.current;
    window.requestAnimationFrame(() => el?.setSelectionRange(value.length, value.length));
  };

  /** Up on the first line goes back in history; Down on the last line goes forward. */
  const browseHistory = (event: KeyboardEvent): boolean => {
    const el = ref.current;
    const entries = props.history?.entries() ?? [];
    if (!el || entries.length === 0 || el.selectionStart !== el.selectionEnd) return false;
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return false;
    const state = recall.current;
    if (event.key === 'ArrowUp' && !el.value.slice(0, el.selectionStart).includes('\n')) {
      const index = state ? Math.max(0, state.index - 1) : entries.length - 1;
      recall.current = { index, draft: state?.draft ?? text };
      showRecalled(entries[index] ?? '');
      return true;
    }
    if (event.key === 'ArrowDown' && state && !el.value.slice(el.selectionEnd).includes('\n')) {
      const index = state.index + 1;
      if (index >= entries.length) {
        recall.current = null;
        showRecalled(state.draft);
      } else {
        recall.current = { ...state, index };
        showRecalled(entries[index] ?? '');
      }
      return true;
    }
    return false;
  };

  const setImages = (next: PendingImage[]) => {
    imagesRef.current = next;
    setImagesState(next);
  };

  /** Reads pasted, dropped or picked files; problems are reported with a notice (ADR-035). */
  const attach = async (files: File[]) => {
    if (files.length === 0 || disabled) return;
    const results = await Promise.all(files.map(readImage));
    const added: PendingImage[] = [];
    for (const result of results) {
      if (!result.ok) new Notice(rejectionText(result));
      else added.push({ key: ++imageKey.current, block: result.image });
    }
    const room = MAX_IMAGES_PER_MESSAGE - imagesRef.current.length;
    if (added.length > room) new Notice(t('imageLimit', { max: MAX_IMAGES_PER_MESSAGE }));
    if (added.length > 0 && room > 0) setImages([...imagesRef.current, ...added.slice(0, room)]);
  };

  const removeImage = (key: number) => {
    setImages(imagesRef.current.filter((image) => image.key !== key));
    ref.current?.focus();
  };

  const send = () => {
    const message = text.trim();
    const attached = imagesRef.current.map((image) => image.block);
    if ((!message && attached.length === 0) || busy || disabled) return;
    if (message) props.history?.add(message);
    recall.current = null;
    onSend(message, attached);
    setText('');
    setImages([]);
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
      return;
    }
    if (browseHistory(event)) event.preventDefault();
  };

  const activeId = suggestions ? `${LISTBOX_ID}-${suggestions.active}` : undefined;

  // Keep the highlighted suggestion in view while moving with the arrow keys.
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!activeId) return;
    listRef.current
      ?.querySelector<HTMLElement>(`#${activeId}`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  const hasContext = Boolean(props.children) || images.length > 0;

  return (
    <div
      class={`agenthub-composer ${dropping ? 'is-dropping' : ''}`}
      onDragOver={(event) => {
        if (disabled || !draggingFiles(event.dataTransfer)) return;
        event.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(event) => {
        // Moving over a child also fires `dragleave` on the box: only leaving it counts.
        const next = event.relatedTarget as Node | null;
        if (!next || !event.currentTarget.contains(next)) setDropping(false);
      }}
      onDrop={(event) => {
        if (!draggingFiles(event.dataTransfer)) return;
        event.preventDefault();
        setDropping(false);
        void attach(Array.from(event.dataTransfer?.files ?? []));
      }}
    >
      {suggestions && (
        <ul
          ref={listRef}
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
      {hasContext && (
        <div class="agenthub-composer-context">
          {props.children}
          {images.length > 0 && (
            <ul class="agenthub-image-strip" aria-label={t('imagesAttached')}>
              {images.map((image, index) => (
                <li key={image.key} class="agenthub-image-chip">
                  <img
                    src={imageDataUrl(image.block) ?? undefined}
                    alt={t('imageAlt', { n: index + 1 })}
                  />
                  <button
                    type="button"
                    class="clickable-icon agenthub-image-remove"
                    aria-label={t('imageRemove', { n: index + 1 })}
                    title={t('imageRemove', { n: index + 1 })}
                    onClick={() => removeImage(image.key)}
                  >
                    <Icon name="x" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
          // Editing a recalled prompt makes it the new draft.
          recall.current = null;
          setText(el.value);
          updateSuggestions(el.value, el.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onPaste={(event) => {
          const files = pastedImages(event.clipboardData);
          if (files.length === 0) return;
          event.preventDefault();
          void attach(files);
        }}
        onBlur={() => setSuggestions(null)}
      />
      <div class="agenthub-composer-toolbar">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            // Clear it so picking the same file again still fires `change`.
            event.currentTarget.value = '';
            void attach(files);
          }}
        />
        <button
          type="button"
          class="clickable-icon agenthub-composer-attach"
          disabled={disabled}
          aria-label={t('imageAttach')}
          title={t('imageAttach')}
          onClick={() => fileInput.current?.click()}
        >
          <Icon name="image-plus" />
        </button>
        {props.options}
        {/* Round icon buttons, like the agents' own apps; the name comes from `aria-label`/`title`. */}
        {busy ? (
          <button
            type="button"
            class="agenthub-composer-button is-stop"
            onClick={onStop}
            aria-label={t('stop')}
            title={t('stop')}
          >
            <Icon name="square" />
          </button>
        ) : (
          <button
            type="button"
            class="agenthub-composer-button mod-cta"
            onClick={send}
            disabled={disabled || (!text.trim() && images.length === 0)}
            aria-label={t('send')}
            title={t('send')}
          >
            <Icon name="arrow-up" />
          </button>
        )}
      </div>
    </div>
  );
}

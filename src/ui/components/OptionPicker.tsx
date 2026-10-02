import { useEffect, useRef, useState } from 'preact/hooks';
import type { ConfigOption } from '../../core/types';
import { isDangerousMode } from '../../core/permissionModes';
import { t } from '../../i18n';
import { Icon } from './Icon';

/** Effort-like options (ordered levels) get a level meter instead of a list. */
export function isLevelOption(option: ConfigOption): boolean {
  const text = `${option.id} ${option.name} ${option.category ?? ''}`;
  return /effort|reasoning|thought|thinking/i.test(text) && option.options.length <= 6;
}

/** Lucide icon per kind of option, so each pill reads at a glance. */
export function optionIcon(option: ConfigOption): string {
  const text = `${option.id} ${option.name} ${option.category ?? ''}`.toLowerCase();
  if (option.category === 'mode' || /\bmode\b|permission|access/.test(text)) return 'shield';
  if (option.category === 'model' || /model/.test(text)) return 'sparkles';
  if (isLevelOption(option)) return 'gauge';
  if (/fast|speed/.test(text)) return 'zap';
  return 'sliders-horizontal';
}

interface OptionPickerProps {
  option: ConfigOption;
  /** Visible name of the option ("Mode", "Model"…). */
  label: string;
  busy: boolean;
  onChange: (value: string) => void;
}

/**
 * A pill in the message box (icon + current value) that opens a panel rising from the composer:
 * a titled list with descriptions, or a level meter for effort-like options (ADR-032).
 */
export function OptionPicker({ option, label, busy, onChange }: OptionPickerProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = option.options.find((choice) => choice.value === option.currentValue);
  const currentName = current?.name ?? option.currentValue;
  const dangerous = isDangerousMode(option.currentValue);
  const level = isLevelOption(option);
  const panelId = `agenthub-option-${option.id}`;

  // Close on a click outside (in this window: the view may live in a popout).
  useEffect(() => {
    if (!open) return;
    const doc = root.current?.ownerDocument;
    const onDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    doc?.addEventListener('mousedown', onDown);
    // Focus the current choice so arrow keys work at once.
    root.current
      ?.querySelector<HTMLElement>('[aria-checked="true"], [role="menuitemradio"]')
      ?.focus();
    return () => doc?.removeEventListener('mousedown', onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  const choose = (value: string) => {
    close();
    if (value !== option.currentValue) onChange(value);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      return close();
    }
    const keys = level ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    const step = event.key === keys[1] ? 1 : event.key === keys[0] ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const items = [
      ...(root.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []),
    ];
    const index = items.findIndex((item) => item === item.ownerDocument.activeElement);
    items[(index + step + items.length) % items.length]?.focus();
  };

  const selectedIndex = option.options.findIndex((choice) => choice.value === option.currentValue);

  return (
    <div ref={root} class="agenthub-picker" onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        class={`agenthub-pill ${dangerous ? 'is-danger' : ''} ${open ? 'is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={t('optionPill', { option: label, value: currentName })}
        title={option.description ?? label}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={dangerous ? 'shield-alert' : optionIcon(option)} />
        <span class="agenthub-pill-value">{currentName}</span>
        <Icon name="chevrons-up-down" class="agenthub-pill-caret" />
      </button>
      {open && (
        <div id={panelId} class="agenthub-panel" role="menu" aria-label={label}>
          <div class="agenthub-panel-title">
            <Icon name={optionIcon(option)} />
            <span>{label}</span>
            {level && <span class="agenthub-panel-current">{currentName}</span>}
          </div>
          {level ? (
            <div class="agenthub-meter">
              {option.options.map((choice, index) => (
                <button
                  key={choice.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={index === selectedIndex}
                  aria-label={choice.name}
                  title={choice.description ?? choice.name}
                  class={`agenthub-meter-step ${index <= selectedIndex ? 'is-filled' : ''}`}
                  onClick={() => choose(choice.value)}
                >
                  <span class="agenthub-meter-bar" />
                  <span class="agenthub-meter-label">{choice.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div class="agenthub-panel-list">
              {option.options.map((choice) => {
                const selected = choice.value === option.currentValue;
                return (
                  <button
                    key={choice.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    class="agenthub-panel-item"
                    onClick={() => choose(choice.value)}
                  >
                    <span class="agenthub-panel-text">
                      <span class="agenthub-panel-name">{choice.name}</span>
                      {choice.description && (
                        <span class="agenthub-panel-desc">{choice.description}</span>
                      )}
                    </span>
                    {selected && <Icon name="check" class="agenthub-panel-check" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

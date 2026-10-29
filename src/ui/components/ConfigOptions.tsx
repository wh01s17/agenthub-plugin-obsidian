import { useEffect, useRef } from 'preact/hooks';
import type { ConfigOption } from '../../core/types';
import { t } from '../../i18n';
import { OptionPicker, TogglePill, toggleValues } from './OptionPicker';

interface ConfigOptionsProps {
  options: readonly ConfigOption[];
  busy: boolean;
  onChange: (id: string, value: string) => void;
  /**
   * `grid`: labelled selects under the header. `inline`: pills in the message box that open a panel
   * (`OptionPicker`); the label moves to the panel title and the accessible name.
   */
  variant: 'grid' | 'inline';
  /** `/model` or `/mode` asked to open this option (ADR-038); `n` grows with each request. */
  openRequest?: { optionId: string; n: number } | null;
}

export function optionName(option: ConfigOption): string {
  if (option.category === 'mode' && option.name === 'Mode') return t('configModeLabel');
  if (option.category === 'model' && option.name === 'Model') return t('configModelLabel');
  return option.name;
}

/** The agent's own options (mode, model, effort…: T2.9). */
export function ConfigOptions({
  options,
  busy,
  onChange,
  variant,
  openRequest,
}: ConfigOptionsProps) {
  const grid = useRef<HTMLDivElement>(null);
  // The grid has native selects: a request moves the focus to the one asked for.
  useEffect(() => {
    if (!openRequest || variant !== 'grid') return;
    grid.current
      ?.querySelector<HTMLSelectElement>(
        `select[data-option-id="${CSS.escape(openRequest.optionId)}"]`,
      )
      ?.focus();
  }, [openRequest, variant]);
  if (options.length === 0) return null;
  if (variant === 'inline') {
    return (
      <div class="agenthub-config is-inline">
        {options.map((option) => {
          const Pill = toggleValues(option) ? TogglePill : OptionPicker;
          return (
            <Pill
              key={option.id}
              option={option}
              label={optionName(option)}
              busy={busy}
              onChange={(value) => onChange(option.id, value)}
              openRequest={openRequest?.optionId === option.id ? openRequest.n : undefined}
            />
          );
        })}
      </div>
    );
  }
  return (
    <div ref={grid} class={`agenthub-config is-${variant}`}>
      {options.map((option) => (
        // The visible name tells what each value means ("Off" alone is ambiguous).
        <div
          key={option.id}
          class="agenthub-config-item"
          title={option.description ?? optionName(option)}
        >
          <span class="agenthub-config-label" aria-hidden="true">
            {optionName(option)}
          </span>
          <select
            class="dropdown agenthub-config-select"
            aria-label={optionName(option)}
            data-option-id={option.id}
            value={option.currentValue}
            disabled={busy}
            onChange={(event) => {
              const value = event.currentTarget.value;
              event.currentTarget.value = option.currentValue;
              onChange(option.id, value);
            }}
          >
            {option.options.map((choice) => (
              <option key={choice.value} value={choice.value} title={choice.description}>
                {choice.name}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

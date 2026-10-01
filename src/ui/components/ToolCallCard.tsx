import type { ToolCall, ToolContent, ToolKind, ToolStatus } from '../../core/types';
import { t, type MessageKey } from '../../i18n';
import { Icon } from './Icon';

const KIND_ICONS: Record<ToolKind, string> = {
  read: 'file-text',
  edit: 'pencil',
  delete: 'trash-2',
  move: 'move',
  search: 'search',
  execute: 'terminal',
  think: 'brain',
  fetch: 'globe',
  other: 'wrench',
};

const STATUS_TEXT: Record<ToolStatus, MessageKey> = {
  pending: 'toolPending',
  in_progress: 'toolRunning',
  completed: 'toolCompleted',
  failed: 'toolFailed',
};

const STATUS_ICONS: Record<ToolStatus, string> = {
  pending: 'circle-dashed',
  in_progress: 'loader',
  completed: 'check',
  failed: 'x',
};

const MAX_OUTPUT_CHARS = 4000;

function truncate(text: string): string {
  return text.length > MAX_OUTPUT_CHARS ? `${text.slice(0, MAX_OUTPUT_CHARS)}\n…` : text;
}

function hasInput(input: unknown): boolean {
  return (
    input !== undefined &&
    input !== null &&
    !(typeof input === 'object' && Object.keys(input).length === 0)
  );
}

function Content({ item }: { item: ToolContent }) {
  switch (item.type) {
    case 'text':
      return <pre class="agenthub-tool-output">{truncate(item.text)}</pre>;
    case 'terminal':
      return (
        <div class="agenthub-tool-terminal">
          <pre class="agenthub-tool-output">{truncate(item.output)}</pre>
          {item.exitCode !== undefined && (
            <div class="agenthub-tool-exit">{t('toolExitCode', { code: item.exitCode })}</div>
          )}
        </div>
      );
    case 'diff':
      return (
        <div class="agenthub-tool-diff">
          <div class="agenthub-tool-diff-path">
            {item.path}
            {item.oldText === null && <span class="agenthub-badge">{t('toolNewFile')}</span>}
          </div>
          <pre class="agenthub-tool-output">{truncate(item.newText)}</pre>
        </div>
      );
  }
}

export function ToolCallCard({ call, expanded = false }: { call: ToolCall; expanded?: boolean }) {
  const status = t(STATUS_TEXT[call.status]);
  return (
    <details class={`agenthub-tool agenthub-tool-${call.status}`} open={expanded}>
      <summary class="agenthub-tool-summary">
        <Icon name={KIND_ICONS[call.kind]} />
        <span class="agenthub-tool-title">{call.title}</span>
        <span class="agenthub-tool-status" title={status}>
          <Icon name={STATUS_ICONS[call.status]} class={`agenthub-status-${call.status}`} />
          <span class="agenthub-visually-hidden">{status}</span>
        </span>
      </summary>
      <div class="agenthub-tool-body">
        {call.locations && call.locations.length > 0 && (
          <ul class="agenthub-tool-locations">
            {call.locations.map((location) => (
              <li key={`${location.path}:${location.line ?? ''}`}>
                {location.path}
                {location.line !== undefined ? `:${location.line}` : ''}
              </li>
            ))}
          </ul>
        )}
        {hasInput(call.rawInput) && (
          <div class="agenthub-tool-section">
            <div class="agenthub-tool-label">{t('toolInput')}</div>
            <pre class="agenthub-tool-output">
              {truncate(JSON.stringify(call.rawInput, null, 2))}
            </pre>
          </div>
        )}
        {call.content && call.content.length > 0 && (
          <div class="agenthub-tool-section">
            <div class="agenthub-tool-label">{t('toolOutput')}</div>
            {call.content.map((item, index) => (
              <Content key={index} item={item} />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

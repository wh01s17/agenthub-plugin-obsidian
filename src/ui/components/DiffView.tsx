import { t } from '../../i18n';
import { lineDiff } from '../diffLines';

const MAX_LINES = 200;
const MARKS = { add: '+', remove: '-', same: ' ', skip: '' } as const;

interface DiffViewProps {
  path: string;
  oldText: string | null;
  newText: string;
  onOpenPath?: (path: string) => boolean;
}

/** What an edit changed, as a compact line diff (plan T6.1). */
export function DiffView({ path, oldText, newText, onOpenPath }: DiffViewProps) {
  const lines = lineDiff(oldText, newText);
  const shown = lines.slice(0, MAX_LINES);
  return (
    <div class="agenthub-diff">
      <div class="agenthub-tool-diff-path">
        {onOpenPath ? (
          <a
            href="#"
            class="agenthub-path-link"
            title={t('openFile', { path })}
            onClick={(event) => {
              event.preventDefault();
              onOpenPath(path);
            }}
          >
            {path}
          </a>
        ) : (
          path
        )}
        {oldText === null && <span class="agenthub-badge">{t('toolNewFile')}</span>}
      </div>
      <pre class="agenthub-diff-lines">
        {shown.map((line, index) => (
          <div key={index} class={`agenthub-diff-line is-${line.kind}`}>
            <span class="agenthub-diff-mark" aria-hidden="true">
              {MARKS[line.kind]}
            </span>
            <span class="agenthub-visually-hidden">
              {line.kind === 'add'
                ? t('diffAdded')
                : line.kind === 'remove'
                  ? t('diffRemoved')
                  : ''}
            </span>
            {line.text}
          </div>
        ))}
        {lines.length > MAX_LINES && <div class="agenthub-diff-line is-skip">…</div>}
      </pre>
    </div>
  );
}

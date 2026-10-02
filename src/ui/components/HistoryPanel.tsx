import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import type { SessionEntry } from '../../storage/sessionSchema';
import { AgentBadge } from './AgentBadge';
import { Icon } from './Icon';

export interface SessionHistory {
  list(): Promise<SessionEntry[]>;
  rename(localId: string, title: string): Promise<void>;
  delete(localId: string): Promise<void>;
}

interface HistoryPanelProps {
  history: SessionHistory;
  currentId: string | null;
  agentLabel: (agentId: string) => { label: string; enabled: boolean };
  onOpen: (localId: string) => void;
  /** Renames a session that is also open in a tab, so its live title follows. */
  onRename?: (localId: string, title: string) => void;
  /** Deletes a saved session (the view closes it first if it is the current one). */
  onDelete: (localId: string) => Promise<void>;
  onClose: () => void;
}

function Entry(props: {
  entry: SessionEntry;
  current: boolean;
  agent: { label: string; enabled: boolean };
  onOpen: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const { entry, current, agent } = props;
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const title = entry.title || t('historyUntitled');

  return (
    <li class={`agenthub-history-entry ${current ? 'is-current' : ''}`}>
      <AgentBadge agentId={entry.agentId} label={agent.label} />
      {editing ? (
        <input
          class="agenthub-history-rename"
          aria-label={t('historyRename')}
          value={entry.title}
          ref={(el) => el?.focus()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              props.onRename(event.currentTarget.value.trim());
              setEditing(false);
            } else if (event.key === 'Escape') {
              setEditing(false);
            }
          }}
          onBlur={() => setEditing(false)}
        />
      ) : (
        <button
          type="button"
          class="agenthub-history-open"
          aria-label={t('historyOpen', { title })}
          disabled={!agent.enabled}
          onClick={props.onOpen}
        >
          <span class="agenthub-history-title">{title}</span>
          <span class="agenthub-history-meta">
            {agent.enabled ? agent.label : t('historyAgentMissing', { agent: agent.label })} ·{' '}
            {new Date(entry.updatedAt).toLocaleString()}
            {current && ` · ${t('historyCurrent')}`}
          </span>
        </button>
      )}
      <button
        type="button"
        class="clickable-icon agenthub-icon-button"
        aria-label={t('historyRename')}
        title={t('historyRename')}
        onClick={() => setEditing(true)}
      >
        <Icon name="pencil" />
      </button>
      <button
        type="button"
        class={`clickable-icon agenthub-icon-button ${confirming ? 'mod-warning' : ''}`}
        aria-label={confirming ? t('historyConfirmDelete') : t('historyDelete')}
        title={confirming ? t('historyConfirmDelete') : t('historyDelete')}
        onClick={() => (confirming ? props.onDelete() : setConfirming(true))}
        onBlur={() => setConfirming(false)}
      >
        <Icon name={confirming ? 'check' : 'trash-2'} />
      </button>
    </li>
  );
}

/** Saved sessions: search, open (resume), rename and delete (plan T4.2). */
export function HistoryPanel(props: HistoryPanelProps) {
  const { history } = props;
  const [entries, setEntries] = useState<SessionEntry[] | null>(null);
  const [query, setQuery] = useState('');

  const reload = () => {
    void history.list().then((list) => {
      setEntries(list);
    });
  };
  useEffect(reload, [history]);

  const needle = query.trim().toLowerCase();
  const shown = (entries ?? []).filter(
    (entry) => !needle || (entry.title || t('historyUntitled')).toLowerCase().includes(needle),
  );

  return (
    <section class="agenthub-history" aria-label={t('history')}>
      <div class="agenthub-history-header">
        <button
          type="button"
          class="clickable-icon agenthub-icon-button"
          aria-label={t('historyBack')}
          title={t('historyBack')}
          onClick={props.onClose}
        >
          <Icon name="arrow-left" />
        </button>
        <input
          type="search"
          class="agenthub-history-search"
          aria-label={t('historySearch')}
          placeholder={t('historySearch')}
          value={query}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </div>
      {entries !== null && shown.length === 0 ? (
        <p class="agenthub-empty-body">{t('historyEmpty')}</p>
      ) : (
        <ul class="agenthub-history-list">
          {shown.map((entry) => (
            <Entry
              key={entry.localId}
              entry={entry}
              current={entry.localId === props.currentId}
              agent={props.agentLabel(entry.agentId)}
              onOpen={() => props.onOpen(entry.localId)}
              onRename={(title) => {
                if (!title) return;
                props.onRename?.(entry.localId, title);
                void history.rename(entry.localId, title).then(reload);
              }}
              onDelete={() => {
                void props.onDelete(entry.localId).then(reload);
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

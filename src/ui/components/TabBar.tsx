import { useState } from 'preact/hooks';
import { t } from '../../i18n';
import { agentIdentity } from '../agentIdentity';
import type { TabIndicator } from '../tabs';
import { AgentBadge } from './AgentBadge';
import { Icon } from './Icon';

export interface TabInfo {
  id: string;
  agentId: string;
  agentLabel: string;
  /** Session title; empty until the first message. */
  title: string;
  indicator: TabIndicator;
}

interface TabBarProps {
  tabs: readonly TabInfo[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
}

const INDICATOR_LABEL = {
  permission: 'tabPermission',
  working: 'tabWorking',
  error: 'tabError',
  unread: 'tabUnread',
} as const;

function Tab(props: {
  tab: TabInfo;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (title: string) => void;
}) {
  const { tab, active } = props;
  const [editing, setEditing] = useState(false);
  const title = tab.title || tab.agentLabel;
  const status = tab.indicator ? t(INDICATOR_LABEL[tab.indicator]) : '';

  return (
    <div
      class={`agenthub-tab ${active ? 'is-active' : ''}`}
      data-agent-color={agentIdentity(tab.agentId, tab.agentLabel).color}
      data-indicator={tab.indicator ?? undefined}
    >
      {editing ? (
        <input
          class="agenthub-tab-rename"
          aria-label={t('tabRename')}
          value={tab.title}
          ref={(el) => el?.focus()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              props.onRename(event.currentTarget.value);
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
          class="agenthub-tab-button"
          aria-current={active ? 'true' : undefined}
          aria-label={status ? `${title}, ${status}` : title}
          title={status ? `${title} · ${status}` : title}
          onClick={props.onSelect}
          onDblClick={() => setEditing(true)}
          onAuxClick={(event) => {
            if (event.button === 1) props.onClose();
          }}
          onKeyDown={(event) => {
            if (event.key === 'F2') setEditing(true);
          }}
        >
          <AgentBadge agentId={tab.agentId} label={tab.agentLabel} />
          <span class="agenthub-tab-title">{title}</span>
          {tab.indicator && <span class="agenthub-tab-indicator" aria-hidden="true" />}
        </button>
      )}
      <button
        type="button"
        class="clickable-icon agenthub-tab-close"
        aria-label={t('tabClose', { title })}
        title={t('tabClose', { title })}
        onClick={props.onClose}
      >
        <Icon name="x" />
      </button>
    </div>
  );
}

/** One tab per conversation of the view (ADR-033): logo, title and what needs attention. */
export function TabBar(props: TabBarProps) {
  return (
    <div class="agenthub-tabs" role="group" aria-label={t('tabsLabel')}>
      <div class="agenthub-tab-list">
        {props.tabs.map((tab) => (
          <Tab
            key={tab.id}
            tab={tab}
            active={tab.id === props.activeId}
            onSelect={() => props.onSelect(tab.id)}
            onClose={() => props.onClose(tab.id)}
            onRename={(title) => props.onRename(tab.id, title)}
          />
        ))}
      </div>
      <button
        type="button"
        class="clickable-icon agenthub-icon-button agenthub-tab-new"
        aria-label={t('tabNew')}
        title={t('tabNew')}
        onClick={props.onNew}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}

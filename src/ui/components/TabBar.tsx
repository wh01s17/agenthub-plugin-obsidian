import { useLayoutEffect, useRef, useState } from 'preact/hooks';
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
  /** Moves tab `id` to the place of tab `target` (drag and drop, or Ctrl/Cmd+Shift+arrows). */
  onMove: (id: string, target: string) => void;
}

const DRAG_TYPE = 'application/x-agenthub-tab';

const INDICATOR_LABEL = {
  permission: 'tabPermission',
  working: 'tabWorking',
  queued: 'tabQueued',
  error: 'tabError',
  unread: 'tabUnread',
} as const;

function Tab(props: {
  tab: TabInfo;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (title: string) => void;
  /** Moves this tab one place left (-1) or right (1). */
  onStep: (step: -1 | 1) => void;
  onDropTab: (id: string) => void;
}) {
  const { tab, active } = props;
  const [editing, setEditing] = useState(false);
  const [dropTarget, setDropTarget] = useState(false);
  const title = tab.title || tab.agentLabel;
  const status = tab.indicator ? t(INDICATOR_LABEL[tab.indicator]) : '';

  return (
    <div
      class={`agenthub-tab ${active ? 'is-active' : ''} ${dropTarget ? 'is-drop-target' : ''}`}
      data-agent-color={agentIdentity(tab.agentId, tab.agentLabel).color}
      data-indicator={tab.indicator ?? undefined}
      draggable={!editing}
      onDragStart={(event) => {
        event.dataTransfer?.setData(DRAG_TYPE, tab.id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer?.types.includes(DRAG_TYPE)) return;
        event.preventDefault();
        setDropTarget(true);
      }}
      onDragLeave={() => setDropTarget(false)}
      onDrop={(event) => {
        setDropTarget(false);
        const id = event.dataTransfer?.getData(DRAG_TYPE);
        if (!id) return;
        event.preventDefault();
        props.onDropTab(id);
      }}
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
            const arrow = { ArrowLeft: -1, ArrowRight: 1 } as const;
            const step = arrow[event.key as keyof typeof arrow];
            if (step && event.shiftKey && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              props.onStep(step);
            }
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
  const list = useRef<HTMLDivElement>(null);
  // The bar is rebuilt inside the newly active tab, starting scrolled to the left: bring the
  // active tab back into view before painting, so tabs far to the right stay where they were.
  useLayoutEffect(() => {
    list.current
      ?.querySelector('.agenthub-tab.is-active')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [props.activeId, props.tabs.length]);

  return (
    <div class="agenthub-tabs" role="group" aria-label={t('tabsLabel')}>
      <div class="agenthub-tab-list" ref={list}>
        {props.tabs.map((tab, index) => (
          <Tab
            key={tab.id}
            tab={tab}
            active={tab.id === props.activeId}
            onSelect={() => props.onSelect(tab.id)}
            onClose={() => props.onClose(tab.id)}
            onRename={(title) => props.onRename(tab.id, title)}
            onStep={(step) => {
              const neighbour = props.tabs[index + step];
              if (neighbour) props.onMove(tab.id, neighbour.id);
            }}
            onDropTab={(id) => {
              if (id !== tab.id) props.onMove(id, tab.id);
            }}
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

import type { App } from 'obsidian';
import { useEffect, useRef } from 'preact/hooks';
import type { PermissionOutcome, PromptBlock, TranscriptItem } from '../../core/types';
import { t } from '../../i18n';
import { Markdown } from './Markdown';
import { NoticeItem } from './NoticeItem';
import { PermissionCard } from './PermissionCard';
import { PlanView } from './PlanView';
import { ToolCallCard } from './ToolCallCard';

interface MessageListProps {
  app: App;
  items: readonly TranscriptItem[];
  showThoughts: boolean;
  onPermission: (id: string, outcome: PermissionOutcome) => void;
  /** Opens a vault path; returns false when it cannot be opened. */
  onOpenPath: (path: string) => boolean;
}

/** How close to the bottom (px) still counts as "following" the conversation. */
const FOLLOW_THRESHOLD = 48;

function userText(blocks: readonly PromptBlock[]): string {
  return blocks.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('\n\n');
}

function Attachments({ blocks }: { blocks: readonly PromptBlock[] }) {
  const labels = blocks.flatMap((block) => {
    if (block.type === 'file') return [t('attachedNote', { path: block.path })];
    if (block.type === 'selection') {
      return [t('attachedSelection', { path: block.path, from: block.fromLine, to: block.toLine })];
    }
    return [];
  });
  if (labels.length === 0) return null;
  return (
    <ul class="agenthub-attachments">
      {labels.map((label) => (
        <li key={label}>{label}</li>
      ))}
    </ul>
  );
}

function Item({
  app,
  item,
  showThoughts,
  onPermission,
  onOpenPath,
}: Omit<MessageListProps, 'items'> & { item: TranscriptItem }) {
  switch (item.kind) {
    case 'user':
      return (
        <div class="agenthub-message is-user">
          <span class="agenthub-visually-hidden">{t('you')}</span>
          <div class="agenthub-message-text">{userText(item.blocks)}</div>
          <Attachments blocks={item.blocks} />
        </div>
      );
    case 'assistant':
      return (
        <div class="agenthub-message is-assistant">
          <Markdown app={app} text={item.text} streaming={item.streaming} />
        </div>
      );
    case 'thought':
      return (
        <details class="agenthub-thought" open={showThoughts}>
          <summary>{t('thinking')}</summary>
          <div class="agenthub-thought-text">{item.text}</div>
        </details>
      );
    case 'tool':
      return <ToolCallCard call={item.call} onOpenPath={onOpenPath} />;
    case 'plan':
      return <PlanView entries={item.entries} />;
    case 'permission':
      return (
        <PermissionCard
          request={item.request}
          resolved={item.resolved}
          onAnswer={(outcome) => onPermission(item.request.id, outcome)}
        />
      );
    case 'notice':
      return <NoticeItem level={item.level} notice={item.notice} />;
  }
}

function itemKey(item: TranscriptItem, index: number): string {
  switch (item.kind) {
    case 'tool':
      return `tool-${item.call.id}`;
    case 'permission':
      return `perm-${item.request.id}`;
    case 'plan':
      return `plan-${index}`;
    default:
      return `${item.kind}-${item.id}`;
  }
}

export function MessageList({
  app,
  items,
  showThoughts,
  onPermission,
  onOpenPath,
}: MessageListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  // Keep the newest content in view, unless the user scrolled up to read.
  useEffect(() => {
    const el = ref.current;
    if (el && following.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  const onScroll = () => {
    const el = ref.current;
    if (el) following.current = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD;
  };

  return (
    // Not a live region: streamed chunks would be announced one by one. The status bar announces progress.
    <div ref={ref} class="agenthub-messages" onScroll={onScroll}>
      {items.map((item, index) => (
        <Item
          key={itemKey(item, index)}
          app={app}
          item={item}
          showThoughts={showThoughts}
          onPermission={onPermission}
          onOpenPath={onOpenPath}
        />
      ))}
    </div>
  );
}

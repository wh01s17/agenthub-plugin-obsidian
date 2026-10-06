import type { App } from 'obsidian';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { imageDataUrl } from '../../core/images';
import type { PermissionOutcome, PromptBlock, TranscriptItem } from '../../core/types';
import { t } from '../../i18n';
import { Icon } from './Icon';
import { Markdown } from './Markdown';
import { NoticeItem } from './NoticeItem';
import { PermissionCard } from './PermissionCard';
import { PlanView } from './PlanView';
import { ToolCallCard } from './ToolCallCard';

interface MessageListProps {
  app: App;
  items: readonly TranscriptItem[];
  showThoughts: boolean;
  /** Open tool call details by default (appearance setting). */
  expandToolCalls?: boolean;
  onPermission: (id: string, outcome: PermissionOutcome) => void;
  /** Opens a vault path; returns false when it cannot be opened. */
  onOpenPath: (path: string) => boolean;
  /** How to show a path (vault-relative when possible). */
  pathLabel?: (path: string) => string;
  /** How to show free text that may contain paths (tool and permission titles). */
  textLabel?: (text: string) => string;
}

/** Items rendered at first, and how many more each "show earlier" adds (plan T6.4). */
export const PAGE_SIZE = 100;

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

/** Images sent with a message (ADR-035); a click shows one at full width. */
function Images({ blocks }: { blocks: readonly PromptBlock[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const images = blocks.flatMap((block) => {
    const src = block.type === 'image' ? imageDataUrl(block) : null;
    return src ? [src] : [];
  });
  if (images.length === 0) return null;
  return (
    <div class="agenthub-message-images">
      {images.map((src, index) => (
        <button
          key={index}
          type="button"
          class={`agenthub-message-image ${open === index ? 'is-open' : ''}`}
          aria-pressed={open === index}
          title={t(open === index ? 'imageShrink' : 'imageEnlarge')}
          onClick={() => setOpen(open === index ? null : index)}
        >
          <img src={src} alt={t('imageAlt', { n: index + 1 })} />
        </button>
      ))}
    </div>
  );
}

function Item({
  app,
  item,
  showThoughts,
  expandToolCalls = false,
  onPermission,
  onOpenPath,
  pathLabel,
  textLabel,
}: Omit<MessageListProps, 'items'> & { item: TranscriptItem }) {
  switch (item.kind) {
    case 'user': {
      const text = userText(item.blocks);
      return (
        <div class="agenthub-message is-user">
          <div class="agenthub-message-author">{t('you')}</div>
          {text && <div class="agenthub-message-text">{text}</div>}
          <Images blocks={item.blocks} />
          <Attachments blocks={item.blocks} />
        </div>
      );
    }
    case 'assistant':
      return (
        <div class="agenthub-message is-assistant">
          <Markdown app={app} text={item.text} streaming={item.streaming} />
        </div>
      );
    case 'thought':
      return (
        <details class="agenthub-thought" open={showThoughts}>
          <summary>
            <Icon name="chevron-right" class="agenthub-chevron" />
            <span>{t('thinking')}</span>
          </summary>
          <div class="agenthub-thought-text">{item.text}</div>
        </details>
      );
    case 'tool':
      return (
        <ToolCallCard
          call={item.call}
          expanded={expandToolCalls}
          onOpenPath={onOpenPath}
          pathLabel={pathLabel}
          textLabel={textLabel}
        />
      );
    case 'plan':
      return <PlanView entries={item.entries} />;
    case 'permission':
      return (
        <PermissionCard
          request={item.request}
          resolved={item.resolved}
          textLabel={textLabel}
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
  expandToolCalls,
  onPermission,
  onOpenPath,
  pathLabel,
  textLabel,
}: MessageListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const seenPermissions = useRef(new Set<string>());
  // Long sessions render only their tail: each agent reply goes through Obsidian's Markdown renderer.
  const [limit, setLimit] = useState(PAGE_SIZE);
  const heightBeforeExpand = useRef<number | null>(null);
  const start = Math.max(0, items.length - limit);

  // Keep the reading position when older items are inserted above.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && heightBeforeExpand.current !== null) {
      el.scrollTop += el.scrollHeight - heightBeforeExpand.current;
      heightBeforeExpand.current = null;
    }
  }, [limit]);

  // Keep the newest content in view, unless the user scrolled up to read. A new permission request
  // always scrolls into view: the agent is blocked until it is answered.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    for (const item of items) {
      if (item.kind !== 'permission' || item.resolved) continue;
      if (seenPermissions.current.has(item.request.id)) continue;
      seenPermissions.current.add(item.request.id);
      following.current = true;
    }
    if (following.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  // Content grows after it is drawn (Markdown renders block by block, cards open): stay at the bottom.
  useEffect(() => {
    const el = ref.current;
    const inner = content.current;
    const Observer = el?.ownerDocument.defaultView?.ResizeObserver;
    if (!el || !inner || !Observer) return;
    const observer = new Observer(() => {
      if (following.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  const onScroll = () => {
    const el = ref.current;
    if (el) following.current = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD;
  };

  return (
    // Not a live region: streamed chunks would be announced one by one. The status bar announces progress.
    <div ref={ref} class="agenthub-messages" onScroll={onScroll}>
      <div ref={content} class="agenthub-messages-content">
        {start > 0 && (
          <button
            type="button"
            class="agenthub-show-earlier"
            onClick={() => {
              heightBeforeExpand.current = ref.current?.scrollHeight ?? null;
              setLimit((value) => value + PAGE_SIZE);
            }}
          >
            {t('showEarlier', { count: Math.min(PAGE_SIZE, start) })}
          </button>
        )}
        {items.slice(start).map((item, offset) => (
          <Item
            key={itemKey(item, start + offset)}
            app={app}
            item={item}
            showThoughts={showThoughts}
            expandToolCalls={expandToolCalls}
            onPermission={onPermission}
            onOpenPath={onOpenPath}
            pathLabel={pathLabel}
            textLabel={textLabel}
          />
        ))}
      </div>
    </div>
  );
}

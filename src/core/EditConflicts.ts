// Notices when two open sessions edit the same file (ADR-034): with several tabs or panes, two
// agents can overwrite each other's changes without knowing about it. Nothing is blocked.

import type { ChatSession } from './ChatSession';
import type { SessionViewState, ToolCall, TranscriptItem } from './types';

const WRITES: ReadonlySet<ToolCall['kind']> = new Set(['edit', 'delete', 'move']);

export interface EditConflict {
  path: string;
  /** The session editing now. */
  session: SessionViewState;
  /** Open sessions that edited the same path before. */
  others: SessionViewState[];
}

/** Files a tool call writes: its locations and the paths of its diffs. */
export function editedPaths(call: ToolCall): string[] {
  if (!WRITES.has(call.kind) || call.status === 'failed') return [];
  const paths = [
    ...(call.locations ?? []).map((location) => location.path),
    ...(call.content ?? []).flatMap((content) => (content.type === 'diff' ? [content.path] : [])),
  ];
  return [...new Set(paths.filter((path) => path.length > 0))];
}

interface Tracked {
  state: SessionViewState;
  paths: Set<string>;
  seen: WeakSet<TranscriptItem>;
}

export class EditConflictWatcher {
  private readonly sessions = new Map<string, Tracked>();
  private readonly warned = new Set<string>();

  constructor(
    private readonly onConflict: (conflict: EditConflict) => void,
    private readonly enabled: () => boolean = () => true,
  ) {}

  track(session: ChatSession): void {
    const tracked: Tracked = { state: session.getState(), paths: new Set(), seen: new WeakSet() };
    this.sessions.set(session.localId, tracked);
    // Edits already in a reopened transcript count for later conflicts but do not warn by themselves.
    this.scan(tracked, false);
    const subscription = session.subscribe((state) => {
      if (state.status === 'closed') {
        subscription.dispose();
        this.sessions.delete(state.localId);
        return;
      }
      tracked.state = state;
      this.scan(tracked);
    });
  }

  private scan(tracked: Tracked, notify = true): void {
    for (const item of tracked.state.items) {
      if (tracked.seen.has(item)) continue;
      tracked.seen.add(item);
      if (item.kind !== 'tool') continue;
      for (const path of editedPaths(item.call)) {
        if (tracked.paths.has(path)) continue;
        tracked.paths.add(path);
        if (notify) this.check(tracked, path);
      }
    }
  }

  private check(tracked: Tracked, path: string): void {
    const others = [...this.sessions.values()].filter(
      (other) => other !== tracked && other.paths.has(path),
    );
    const fresh = others.filter((other) => {
      const key = [path, ...[tracked.state.localId, other.state.localId].sort()].join('\n');
      if (this.warned.has(key)) return false;
      this.warned.add(key);
      return true;
    });
    if (fresh.length > 0 && this.enabled()) {
      this.onConflict({ path, session: tracked.state, others: fresh.map((o) => o.state) });
    }
  }
}

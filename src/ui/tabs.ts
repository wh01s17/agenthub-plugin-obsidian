// What each tab of an AgentHub view needs the user to notice (ADR-033): a hidden tab that asks for
// permission, works, fails or finishes while the user looks at another one.

import type { ChatSession } from '../core/ChatSession';
import type { SessionStatus, SessionViewState } from '../core/types';

export type TabIndicator = 'permission' | 'working' | 'error' | 'unread' | null;

export interface TabActivityEvents {
  /** A tab's status, title or unread mark changed: redraw the tab bar. */
  onChange(): void;
  /** A tab the user is not looking at started waiting for a decision. Nothing is approved for them. */
  onBackgroundPermission(session: ChatSession): void;
}

interface Watched {
  dispose(): void;
  status: SessionStatus;
  title: string;
}

const BUSY: ReadonlySet<SessionStatus> = new Set(['running', 'awaiting-permission']);

export class TabActivity {
  private readonly watched = new Map<string, Watched>();
  private readonly unread = new Set<string>();
  private active: string | null = null;

  constructor(private readonly events: TabActivityEvents) {}

  /** Follows exactly `sessions`; `activeId` is the tab being looked at. */
  sync(sessions: readonly ChatSession[], activeId: string | null): void {
    const ids = new Set(sessions.map((session) => session.localId));
    for (const [id, watched] of this.watched) {
      if (ids.has(id)) continue;
      watched.dispose();
      this.watched.delete(id);
      this.unread.delete(id);
    }
    for (const session of sessions) {
      if (!this.watched.has(session.localId)) this.watch(session);
    }
    this.active = activeId;
    if (activeId) this.unread.delete(activeId);
  }

  indicator(session: ChatSession): TabIndicator {
    const { status } = session.getState();
    if (status === 'awaiting-permission') return 'permission';
    if (status === 'running') return 'working';
    if (status === 'error') return 'error';
    return this.unread.has(session.localId) ? 'unread' : null;
  }

  dispose(): void {
    for (const watched of this.watched.values()) watched.dispose();
    this.watched.clear();
    this.unread.clear();
  }

  private watch(session: ChatSession): void {
    const { status, title } = session.getState();
    const subscription = session.subscribe((state) => this.update(session, state));
    this.watched.set(session.localId, {
      dispose: () => subscription.dispose(),
      status,
      title,
    });
  }

  private update(session: ChatSession, state: SessionViewState): void {
    const watched = this.watched.get(session.localId);
    if (!watched || (watched.status === state.status && watched.title === state.title)) return;
    const previous = watched.status;
    watched.status = state.status;
    watched.title = state.title;
    const hidden = session.localId !== this.active;
    if (hidden && BUSY.has(previous) && !BUSY.has(state.status)) this.unread.add(session.localId);
    if (hidden && state.status === 'awaiting-permission' && previous !== 'awaiting-permission')
      this.events.onBackgroundPermission(session);
    this.events.onChange();
  }
}

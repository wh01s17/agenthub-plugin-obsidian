// Several conversations in one view (ADR-033): tabs, background work and permissions, persistence.
import { fireEvent, render, screen } from '@testing-library/preact';
import { WorkspaceLeaf } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionOutcome } from '../../src/core/types';
import { SessionStore } from '../../src/storage/SessionStore';
import { AgentHubView } from '../../src/ui/AgentHubView';
import { TabBar, type TabInfo } from '../../src/ui/components/TabBar';
// The same module `obsidian` resolves to in tests, typed with its recording of notices.
import { Notice } from '../__mocks__/obsidian';
import { MemoryAdapter } from '../helpers/memoryStorage';
import type { StubScript } from '../helpers/stubAgent';
import { makeViewHost } from '../helpers/viewHost';

const reply: StubScript = ({ emit }) => {
  emit({ type: 'message.chunk', role: 'assistant', messageId: 'm', text: 'ok' });
  emit({ type: 'message.end', messageId: 'm' });
  return 'end_turn';
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const text = (value: string) => [{ type: 'text' as const, text: value }];

async function openView(script: StubScript = reply, store?: SessionStore) {
  const setup = makeViewHost(script, {}, store);
  const view = new AgentHubView(new WorkspaceLeaf(), setup.host);
  await view.onOpen();
  return { ...setup, view };
}

const tabs = (view: AgentHubView) => [...view.contentEl.querySelectorAll('.agenthub-tab')];
const visibleApps = (view: AgentHubView) =>
  [...view.contentEl.querySelectorAll('.agenthub-app')].filter((el) => !el.hasAttribute('hidden'));

beforeEach(() => {
  Notice.shown.length = 0;
});

describe('tabs in the view', () => {
  it('opens tabs side by side and shows only the active one', async () => {
    const { view, sessions } = await openView();
    const first = view.active!;
    view.newTab('codex-acp');
    const second = view.active!;

    expect(second).not.toBe(first);
    expect(second.getState().agentId).toBe('codex-acp');
    expect(sessions.list()).toHaveLength(2);
    expect(tabs(view)).toHaveLength(2);
    expect(visibleApps(view)).toHaveLength(1);
    expect(visibleApps(view)[0]?.getAttribute('data-session-id')).toBe(second.localId);
    expect(view.getState()).toMatchObject({
      tabs: [first.localId, second.localId],
      activeTab: second.localId,
    });

    view.cycleTab(1);
    expect(view.active).toBe(first);
    view.cycleTab(-1);
    expect(view.active).toBe(second);
  });

  it('keeps every tab working while the user switches between them', async () => {
    const gate = deferred();
    let calls = 0;
    const { view, adapter, codex } = await openView(async () => {
      if (++calls === 1) await gate.promise;
      return 'end_turn' as const;
    });
    const first = view.active!;
    const firstTurn = first.send(text('long task'));
    await vi.waitFor(() => expect(first.getState().status).toBe('running'));

    view.newTab('codex-acp');
    const second = view.active!;
    await second.send(text('quick question'));
    expect(first.getState().status).toBe('running');
    expect(view.contentEl.querySelector('[data-indicator="working"]')).not.toBeNull();

    gate.resolve();
    await firstTurn;
    expect(first.getState().status).toBe('idle');
    expect(adapter.sessions[0]?.disposed).toBe(false);
    expect(codex.sessions[0]?.disposed).toBe(false);
    // The hidden tab finished: it is marked until the user looks at it.
    expect(view.contentEl.querySelector('[data-indicator="unread"]')).not.toBeNull();
    view.selectTab(first.localId);
    expect(view.contentEl.querySelector('[data-indicator="unread"]')).toBeNull();
  });

  it('flags a permission request from a hidden tab and never answers it', async () => {
    let outcome: PermissionOutcome | undefined;
    const { view } = await openView(async ({ host }) => {
      outcome = await host.requestPermission({
        id: 'p1',
        toolCall: { id: 'c1', title: 'Write', kind: 'edit' },
        options: [{ id: 'ok', label: 'Allow', kind: 'allow_once' }],
      });
      return 'end_turn' as const;
    });
    const first = view.active!;
    view.newTab();
    const turn = first.send(text('Edit my note'));
    await vi.waitFor(() => expect(first.getState().status).toBe('awaiting-permission'));

    expect(Notice.shown).toEqual(['AgentHub: "Edit my note" is waiting for your permission.']);
    const flagged = view.contentEl.querySelector('.agenthub-tab[data-indicator="permission"]');
    expect(flagged?.textContent).toContain('Edit my note');
    expect(outcome).toBeUndefined();

    first.resolvePermission('p1', { outcome: 'selected', optionId: 'ok' });
    await turn;
    expect(outcome).toEqual({ outcome: 'selected', optionId: 'ok' });
  });

  it('closing a tab ends its agent; closing the last one leaves a fresh tab', async () => {
    const { view, sessions, adapter } = await openView();
    const first = view.active!;
    await first.send(text('hola'));
    view.newTab();
    const second = view.active!;

    view.closeTab(first.localId);
    await vi.waitFor(() => expect(adapter.sessions[0]?.disposed).toBe(true));
    expect(sessions.get(first.localId)).toBeUndefined();
    expect(view.active).toBe(second);

    view.closeTab();
    expect(tabs(view)).toHaveLength(1);
    expect(view.active).not.toBe(second);
    expect(sessions.list()).toHaveLength(1);
  });

  it('the header starts a new session inside the active tab only', async () => {
    const { view } = await openView();
    const first = view.active!;
    view.newTab();
    const second = view.active!;
    view.startNewSession('codex-acp');
    expect(view.getState().tabs).toEqual([first.localId, view.active!.localId]);
    expect(view.active).not.toBe(second);
    expect(view.active!.getState().agentId).toBe('codex-acp');
  });

  it('renames a tab with a double click', async () => {
    const { view } = await openView();
    const button = view.contentEl.querySelector<HTMLButtonElement>('.agenthub-tab-button')!;
    fireEvent.dblClick(button);
    const input = view.contentEl.querySelector<HTMLInputElement>('.agenthub-tab-rename')!;
    input.value = 'Carpetas';
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(view.active!.getState().title).toBe('Carpetas');
    expect(tabs(view)[0]?.textContent).toContain('Carpetas');
  });
});

describe('tabs and history', () => {
  function setupStore(adapter = new MemoryAdapter()) {
    return new SessionStore(adapter, {
      directory: 'cfg/plugins/agenthub/sessions',
      settings: () => ({ enabled: true, maxSessions: 200 }),
      onError: vi.fn(),
    });
  }

  it('reopens the same tabs after a restart', async () => {
    const files = new MemoryAdapter();
    const store = setupStore(files);
    const { view } = await openView(reply, store);
    await view.active!.send(text('primera'));
    view.newTab('codex-acp');
    await view.active!.send(text('segunda'));
    view.cycleTab(-1);
    const state = view.getState();
    await view.onClose();
    await store.dispose();

    const second = makeViewHost(reply, {}, setupStore(files));
    const reopened = new AgentHubView(new WorkspaceLeaf(), second.host);
    await reopened.onOpen();
    await reopened.setState(state, { history: false });

    expect(reopened.getState()).toMatchObject({ tabs: state.tabs, activeTab: state.activeTab });
    expect(second.sessions.list()).toHaveLength(2);
    expect(visibleApps(reopened)[0]?.textContent).toContain('primera');
    expect(reopened.contentEl.textContent).toContain('segunda');
    // Only the tab being looked at starts its agent; the hidden one waits until it is shown.
    expect(second.codex.options).toHaveLength(0);
    reopened.cycleTab(1);
    await vi.waitFor(() => expect(second.codex.options).toHaveLength(1));
  });

  it('opens a saved session in a new tab, or in the active one while it is empty', async () => {
    const store = setupStore();
    const { view } = await openView(reply, store);
    await view.active!.send(text('guardada'));
    const saved = view.active!.localId;
    view.closeTab();
    await store.flush();

    // The fresh tab is empty: the saved session takes its place.
    expect(await view.openSession(saved)).toBe(true);
    expect(view.getState().tabs).toEqual([saved]);

    view.newTab();
    await view.active!.send(text('otra'));
    const other = view.active!.localId;
    view.closeTab(saved);
    await store.flush();
    expect(await view.openSession(saved)).toBe(true);
    expect(view.getState().tabs).toEqual([other, saved]);

    // Already open: it just becomes active.
    view.selectTab(other);
    expect(await view.openSession(saved)).toBe(true);
    expect(view.getState()).toMatchObject({ tabs: [other, saved], activeTab: saved });
  });
});

describe('TabBar', () => {
  it('keeps the active tab in view when the bar is rebuilt', async () => {
    const scrolled: string[] = [];
    const scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this.textContent ?? '');
    });
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      const { view } = await openView();
      const first = view.active!;
      view.newTab('codex-acp');
      view.newTab();
      const last = view.active!;
      view.selectTab(first.localId);
      view.selectTab(last.localId);
      expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest', inline: 'nearest' });
      expect(scrolled.at(-1)).toContain('Claude Code');
      expect(
        view.contentEl.querySelector('.agenthub-tab.is-active')?.isSameNode(tabs(view)[2] ?? null),
      ).toBe(true);
    } finally {
      delete (Element.prototype as Partial<Element>).scrollIntoView;
    }
  });

  const infos: TabInfo[] = [
    {
      id: 'a',
      agentId: 'claude-acp',
      agentLabel: 'Claude Code',
      title: 'Resumen',
      indicator: null,
    },
    { id: 'b', agentId: 'codex-acp', agentLabel: 'Codex', title: '', indicator: 'permission' },
  ];

  it('selects, closes with the middle button and opens tabs', () => {
    const props = {
      onSelect: vi.fn(),
      onClose: vi.fn(),
      onNew: vi.fn(),
      onRename: vi.fn(),
    };
    render(<TabBar tabs={infos} activeId="a" {...props} />);
    const waiting = screen.getByRole('button', { name: 'Codex, waiting for permission' });
    expect(screen.getByRole('button', { name: 'Resumen' }).getAttribute('aria-current')).toBe(
      'true',
    );

    fireEvent.click(waiting);
    expect(props.onSelect).toHaveBeenCalledWith('b');
    fireEvent(waiting, new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(props.onClose).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByRole('button', { name: 'Close "Resumen"' }));
    expect(props.onClose).toHaveBeenCalledWith('a');
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    expect(props.onNew).toHaveBeenCalled();
  });
});

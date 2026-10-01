import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { WorkspaceLeaf } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { ChatSession } from '../../src/core/ChatSession';
import type { TranscriptItem } from '../../src/core/types';
import { SessionStore } from '../../src/storage/SessionStore';
import { AgentHubView } from '../../src/ui/AgentHubView';
import { HistoryPanel } from '../../src/ui/components/HistoryPanel';
import { MemoryAdapter } from '../helpers/memoryStorage';
import { StubAdapter, hostServices, type StubScript } from '../helpers/stubAgent';
import { makeViewHost } from '../helpers/viewHost';

const reply: StubScript = ({ emit }) => {
  emit({ type: 'message.chunk', role: 'assistant', messageId: 'm', text: 'ok' });
  emit({ type: 'message.end', messageId: 'm' });
  return 'end_turn';
};

const storedItems: TranscriptItem[] = [
  { kind: 'user', id: 'user-1', blocks: [{ type: 'text', text: 'antes' }], at: 1 },
  { kind: 'assistant', id: 'a1', text: 'respuesta previa', streaming: false },
];

function restoredSession(adapter: StubAdapter) {
  return new ChatSession({
    localId: 's1',
    adapter,
    host: hostServices,
    options: { cwd: '/vault' },
    title: 'Previa',
    restore: { items: storedItems, nativeSessionId: 'native-1' },
  });
}

describe('reopening a stored session (T4.2)', () => {
  it('shows the stored transcript and resumes the native session on the first message', async () => {
    const adapter = new StubAdapter(reply);
    const session = restoredSession(adapter);
    expect(session.getState()).toMatchObject({
      title: 'Previa',
      nativeSessionId: 'native-1',
      status: 'idle',
    });
    expect(session.getState().items).toHaveLength(2);

    await session.send([{ type: 'text', text: 'después' }]);
    expect(adapter.resumed).toEqual(['native-1']);
    expect(session.getState().items.map((i) => i.kind)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    expect(session.getState().items.some((i) => i.kind === 'notice')).toBe(false);
  });

  it('warns when the agent cannot continue the previous context', async () => {
    const adapter = new StubAdapter(reply);
    adapter.canRestore = false;
    const session = restoredSession(adapter);
    await session.send([{ type: 'text', text: 'después' }]);
    expect(session.getState().items).toContainEqual(
      expect.objectContaining({ kind: 'notice', notice: { key: 'contextNotRestored' } }),
    );
  });
});

function setupStore(adapter = new MemoryAdapter()) {
  const store = new SessionStore(adapter, {
    directory: 'cfg/plugins/agenthub/sessions',
    settings: () => ({ enabled: true, maxSessions: 200 }),
    onError: vi.fn(),
  });
  return { adapter, store };
}

describe('history in the view (T4.2/T4.3)', () => {
  it('restores the session shown in a view after a restart', async () => {
    const { adapter, store } = setupStore();
    const first = makeViewHost(reply, {}, store);
    const view = new AgentHubView(new WorkspaceLeaf(), first.host);
    await view.onOpen();
    const id = first.sessions.list()[0]?.localId ?? '';
    await first.sessions.get(id)?.send([{ type: 'text', text: 'hola' }]);
    const state = view.getState();
    await view.onClose();
    await store.dispose();

    // "Restart": new store and host over the same files.
    const second = makeViewHost(reply, {}, setupStore(adapter).store);
    const reopened = new AgentHubView(new WorkspaceLeaf(), second.host);
    await reopened.onOpen();
    await reopened.setState(state, { history: false });
    expect(reopened.getState()).toMatchObject({ sessionId: id });
    expect(reopened.contentEl.textContent).toContain('hola');
  });

  it('deleting the current session does not save it again', async () => {
    const { store } = setupStore();
    const { host, sessions } = makeViewHost(reply, {}, store);
    const view = new AgentHubView(new WorkspaceLeaf(), host);
    await view.onOpen();
    const id = sessions.list()[0]?.localId ?? '';
    await sessions.get(id)?.send([{ type: 'text', text: 'borrar' }]);
    await store.flush();

    await view.deleteSession(id);
    await store.flush();
    expect((await store.list()).map((e) => e.localId)).not.toContain(id);
    expect(view.getState().sessionId).not.toBe(id);
  });
});

describe('HistoryPanel', () => {
  it('lists, filters, renames and asks before deleting', async () => {
    const entries = [
      {
        localId: 'a',
        agentId: 'claude-acp',
        title: 'Resumen de ideas',
        cwd: '/v',
        createdAt: 1,
        updatedAt: 2,
      },
      { localId: 'b', agentId: 'gone', title: 'Otra cosa', cwd: '/v', createdAt: 1, updatedAt: 1 },
    ];
    const history = {
      list: vi.fn(() => Promise.resolve(entries)),
      rename: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
    };
    const onOpen = vi.fn();
    const onDelete = vi.fn(() => Promise.resolve());
    render(
      <HistoryPanel
        history={history}
        currentId="a"
        agentLabel={(id) => ({
          label: id === 'gone' ? 'Gone' : 'Claude Code',
          enabled: id !== 'gone',
        })}
        onOpen={onOpen}
        onDelete={onDelete}
        onClose={vi.fn()}
      />,
    );
    const open = await screen.findByRole('button', { name: 'Open "Resumen de ideas"' });
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Open "Otra cosa"' }).disabled,
    ).toBe(true);

    fireEvent.input(screen.getByRole('searchbox', { name: 'Search sessions' }), {
      target: { value: 'ideas' },
    });
    expect(screen.queryByRole('button', { name: 'Open "Otra cosa"' })).toBeNull();

    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledWith('a');

    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[0]!);
    const input = screen.getByRole('textbox', { name: 'Rename' });
    (input as HTMLInputElement).value = 'Nuevo título';
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(history.rename).toHaveBeenCalledWith('a', 'Nuevo título'));

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]!);
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('a'));
  });
});

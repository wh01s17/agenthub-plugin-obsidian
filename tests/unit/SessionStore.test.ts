import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionManager } from '../../src/core/SessionManager';
import { createInitialState } from '../../src/core/reducer';
import type { SessionViewState, TranscriptItem } from '../../src/core/types';
import { SessionStore, type SessionStorageAdapter } from '../../src/storage/SessionStore';
import { StubAdapter, hostServices } from '../helpers/stubAgent';

const directory = 'config/plugins/agenthub/sessions';
const indexPath = `${directory}/index.json`;

class MemoryAdapter implements SessionStorageAdapter {
  readonly files = new Map<string, string>();
  readonly directories = new Set<string>();
  readonly writes: string[] = [];
  failRename = false;
  exists(path: string) {
    return Promise.resolve(this.files.has(path) || this.directories.has(path));
  }
  mkdir(path: string) {
    this.directories.add(path);
    return Promise.resolve();
  }
  read(path: string) {
    const data = this.files.get(path);
    return data === undefined ? Promise.reject(new Error('Missing file')) : Promise.resolve(data);
  }
  write(path: string, data: string) {
    this.writes.push(path);
    this.files.set(path, data);
    return Promise.resolve();
  }
  rename(path: string, target: string) {
    if (this.failRename) return Promise.reject(new Error('Disk full'));
    if (this.files.has(target))
      return Promise.reject(new Error('Destination file already exists!'));
    const data = this.files.get(path);
    if (data === undefined) return Promise.reject(new Error('Missing temp file'));
    this.files.set(target, data);
    this.files.delete(path);
    return Promise.resolve();
  }
  remove(path: string) {
    this.files.delete(path);
    return Promise.resolve();
  }
}

function setup() {
  const adapter = new MemoryAdapter();
  const settings = { enabled: true, maxSessions: 200 };
  const onError = vi.fn();
  let now = 100;
  const options = { directory, settings: () => settings, onError, now: () => now };
  const store = new SessionStore(adapter, options);
  return {
    adapter,
    settings,
    onError,
    options,
    store,
    time: (value: number) => {
      now = value;
    },
  };
}

function state(
  localId = 's1',
  items: readonly TranscriptItem[] = [
    { kind: 'user', id: 'u', blocks: [{ type: 'text', text: 'hello' }], at: 100 },
    { kind: 'assistant', id: 'a', text: 'reply', streaming: false },
  ],
): SessionViewState {
  return {
    ...createInitialState({ localId, agentId: 'stub', cwd: '/vault', title: 'Hello' }),
    nativeSessionId: 'native-id',
    items,
  };
}

afterEach(() => vi.useRealTimers());

describe('SessionStore', () => {
  it('round trips versioned JSONL and metadata through a new store instance', async () => {
    const { adapter, store, options, time } = setup();
    store.schedule(state());
    await store.flush();
    time(200);
    store.schedule({ ...state(), title: 'Changed' });
    await store.flush();
    const restarted = new SessionStore(adapter, options);
    expect(await restarted.list()).toEqual([
      {
        localId: 's1',
        agentId: 'stub',
        nativeSessionId: 'native-id',
        title: 'Changed',
        cwd: '/vault',
        createdAt: 100,
        updatedAt: 200,
      },
    ]);
    expect((await restarted.load('s1'))?.items).toEqual(state().items);
    expect(adapter.files.get(`${directory}/s1.jsonl`)?.split('\n').filter(Boolean)).toHaveLength(2);
    expect([...adapter.files.keys()].some((path) => path.endsWith('.tmp'))).toBe(false);
  });

  it('debounces streaming snapshots and flushes the last value', async () => {
    vi.useFakeTimers();
    const { store, adapter } = setup();
    store.schedule(state());
    await vi.advanceTimersByTimeAsync(900);
    store.schedule({
      ...state(),
      items: [{ kind: 'assistant', id: 'a', text: 'complete', streaming: true }],
    });
    await vi.advanceTimersByTimeAsync(900);
    expect(adapter.writes).toEqual([]);
    await vi.advanceTimersByTimeAsync(100);
    expect((await store.load('s1'))?.items).toEqual([
      { kind: 'assistant', id: 'a', text: 'complete', streaming: false },
    ]);
    await store.dispose();
  });

  it('saves at turn end and view close through SessionManager without saving empty sessions', async () => {
    const { store } = setup();
    const adapter = new StubAdapter(({ emit }) => {
      emit({ type: 'session.ready', nativeSessionId: 'stub-native' });
      emit({ type: 'message.chunk', role: 'assistant', messageId: 'm', text: 'answer' });
      return 'end_turn';
    });
    const manager = new SessionManager({
      getAdapter: () => adapter,
      host: hostServices,
      sessionOptions: () => ({ cwd: '/vault' }),
      newId: () => 's1',
      onCreate: (session) => store.track(session),
    });
    const session = manager.create('stub')!;
    expect(await store.list()).toEqual([]);
    await session.send([{ type: 'text', text: 'question' }]);
    expect((await store.load('s1'))?.entry.nativeSessionId).toBe('stub-native');
    expect((await store.load('s1'))?.items).toHaveLength(2);
    await manager.close('s1');
    await store.dispose();
    expect((await store.load('s1'))?.items.at(-1)).toMatchObject({
      text: 'answer',
      streaming: false,
    });
    expect(adapter.sessions[0]?.disposed).toBe(true);
  });

  it('retains the most recently updated sessions and removes old transcripts', async () => {
    const { store, settings, time, adapter } = setup();
    settings.maxSessions = 2;
    for (const [id, at] of [
      ['s1', 100],
      ['s2', 200],
      ['s1', 300],
      ['s3', 400],
    ] as const) {
      time(at);
      store.schedule(state(id));
      await store.flush();
    }
    expect((await store.list()).map((entry) => entry.localId)).toEqual(['s3', 's1']);
    expect(adapter.files.has(`${directory}/s2.jsonl`)).toBe(false);
  });

  it('disabling history discards pending writes and preserves existing history', async () => {
    const { store, settings, adapter } = setup();
    store.schedule(state());
    await store.flush();
    const writes = adapter.writes.length;
    store.schedule(state('s2'));
    settings.enabled = false;
    await store.flush();
    store.schedule(state('s3'));
    await store.dispose();
    expect(adapter.writes).toHaveLength(writes);
    expect((await store.list()).map((entry) => entry.localId)).toEqual(['s1']);
  });

  it('keeps the committed snapshot intact after a write failure and retries', async () => {
    const { store, adapter, time } = setup();
    store.schedule(state());
    await store.flush();
    const original = adapter.files.get(`${directory}/s1.jsonl`);
    adapter.failRename = true;
    time(200);
    store.schedule({ ...state(), title: 'Updated' });
    await expect(store.flush()).rejects.toThrow('Disk full');
    expect(adapter.files.get(`${directory}/s1.jsonl`)).toBe(original);
    adapter.failRename = false;
    await store.flush();
    expect((await store.list())[0]?.title).toBe('Updated');
  });

  it('restores the committed file if replacement fails after moving it to backup', async () => {
    const { store, adapter } = setup();
    store.schedule(state());
    await store.flush();
    const original = adapter.files.get(`${directory}/s1.jsonl`);
    const rename = adapter.rename.bind(adapter);
    let fail = true;
    vi.spyOn(adapter, 'rename').mockImplementation((path, target) => {
      if (fail && path === `${directory}/s1.jsonl.tmp`) {
        fail = false;
        return Promise.reject(new Error('Replacement failed'));
      }
      return rename(path, target);
    });
    store.schedule({ ...state(), title: 'New' });
    await expect(store.flush()).rejects.toThrow('Replacement failed');
    expect(adapter.files.get(`${directory}/s1.jsonl`)).toBe(original);
    await store.flush();
    expect((await store.list())[0]?.title).toBe('New');
  });

  it('recovers index and transcript backups left by an interrupted replacement', async () => {
    const { store, adapter, options } = setup();
    store.schedule(state());
    await store.flush();
    await adapter.rename(indexPath, `${indexPath}.bak`);
    await adapter.rename(`${directory}/s1.jsonl`, `${directory}/s1.jsonl.bak`);
    const restarted = new SessionStore(adapter, options);
    expect((await restarted.load('s1'))?.items).toEqual(state().items);
    expect(adapter.files.has(indexPath)).toBe(true);
    expect(adapter.files.has(`${directory}/s1.jsonl`)).toBe(true);
  });

  it('does not let a failed older write overwrite a newer queued snapshot on retry', async () => {
    const { store, adapter } = setup();
    vi.spyOn(adapter, 'rename').mockRejectedValueOnce(new Error('Disk full'));
    store.schedule({ ...state(), title: 'Old' });
    const older = store.flush();
    store.schedule({ ...state(), title: 'New' });
    const newer = store.flush();
    await expect(older).rejects.toThrow('Disk full');
    await newer;
    await store.flush();
    expect((await store.list())[0]?.title).toBe('New');
  });

  it('reports corrupt records and recovers valid items without logging transcript content', async () => {
    const { store, adapter, onError } = setup();
    store.schedule(state());
    await store.flush();
    adapter.files.set(
      `${directory}/s1.jsonl`,
      adapter.files.get(`${directory}/s1.jsonl`) + '{"secret":',
    );
    expect((await store.load('s1'))?.items).toHaveLength(2);
    expect(onError).toHaveBeenCalledOnce();
    expect(String(onError.mock.calls[0]?.[0])).not.toContain('secret');
  });

  it('refuses corrupt indexes without overwriting them', async () => {
    const { store, adapter } = setup();
    adapter.files.set(indexPath, 'broken');
    store.schedule(state());
    await expect(store.flush()).rejects.toThrow();
    expect(adapter.files.get(indexPath)).toBe('broken');
    expect(adapter.writes).toEqual([]);
  });

  it.each(['../other', '/absolute', 'a/b', 'a\\b', '..', ''])(
    'rejects unsafe local ID %s',
    async (id) => {
      const { store } = setup();
      expect(() => store.schedule(state(id))).toThrow();
      expect(() => store.load(id)).toThrow();
      expect(() => store.delete(id)).toThrow();
      await store.dispose();
    },
  );

  it('renames and deletes saved sessions in serialized order', async () => {
    const { store, adapter } = setup();
    store.schedule(state());
    await store.flush();
    await store.rename('s1', 'Renamed');
    expect((await store.list())[0]?.title).toBe('Renamed');
    await store.delete('s1');
    expect(await store.load('s1')).toBeUndefined();
    expect(await store.list()).toEqual([]);
    expect(adapter.files.has(`${directory}/s1.jsonl`)).toBe(false);
  });

  it('cancels persisted pending permissions and flushes on shutdown', async () => {
    const { store } = setup();
    store.schedule(
      state('s1', [
        {
          kind: 'permission',
          request: { id: 'p', toolCall: { id: 't', title: 'Write', kind: 'edit' }, options: [] },
        },
      ]),
    );
    await store.dispose();
    expect((await store.load('s1'))?.items[0]).toMatchObject({
      resolved: { outcome: 'cancelled' },
    });
    store.schedule(state('s2'));
    expect((await store.list()).map((entry) => entry.localId)).toEqual(['s1']);
  });
});

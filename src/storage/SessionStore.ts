import type { Disposable } from '../core/AgentAdapter';
import type { ChatSession } from '../core/ChatSession';
import type { SessionViewState, TranscriptItem } from '../core/types';
import {
  consolidate,
  localIdSchema,
  sessionEntrySchema,
  transcriptRecordSchema,
  type SessionEntry,
} from './sessionSchema';

/** Structural subset of Obsidian's DataAdapter; storage can also run without Obsidian. */
export interface SessionStorageAdapter {
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  read(path: string): Promise<string>;
  write(path: string, data: string): Promise<void>;
  rename(path: string, newPath: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface SessionStoreOptions {
  directory: string;
  settings: () => { enabled: boolean; maxSessions: number };
  onError: (error: unknown) => void;
  now?: () => number;
  debounceMs?: number;
}

type Pending = { state: SessionViewState; at: number; revision: number };
export interface StoredSession {
  entry: SessionEntry;
  items: TranscriptItem[];
}

/** All disk operations are serialized; failed writes leave pending snapshots available for retry. */
export class SessionStore {
  private entries: SessionEntry[] | null = null;
  private readonly pending = new Map<string, Pending>();
  private readonly subscriptions = new Set<Disposable>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;
  private revision = 0;
  private readonly committed = new Map<string, number>();

  constructor(
    private readonly adapter: SessionStorageAdapter,
    private readonly options: SessionStoreOptions,
  ) {}

  track(session: ChatSession): void {
    if (this.disposed) return;
    const subscription = session.subscribe((state) => {
      this.schedule(state);
      if (state.status === 'closed') {
        subscription.dispose();
        this.subscriptions.delete(subscription);
      }
      if (state.status === 'idle' || state.status === 'error' || state.status === 'closed') {
        void this.flush().catch(this.options.onError);
      }
    });
    this.subscriptions.add(subscription);
  }

  schedule(state: SessionViewState): void {
    if (this.disposed || !this.options.settings().enabled || state.items.length === 0) return;
    localIdSchema.parse(state.localId);
    this.pending.set(state.localId, { state, at: this.now(), revision: ++this.revision });
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush().catch(this.options.onError);
    }, this.options.debounceMs ?? 1000);
  }

  flush(): Promise<void> {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    const snapshots = [...this.pending.values()];
    this.pending.clear();
    return this.serial(async () => {
      if (!this.options.settings().enabled) return;
      try {
        if (snapshots.length === 0) return;
        await this.initialize();
        for (const snapshot of snapshots) await this.save(snapshot);
      } catch (error) {
        for (const snapshot of snapshots) {
          const id = snapshot.state.localId;
          const newer = this.pending.get(id);
          if ((this.committed.get(id) ?? 0) >= snapshot.revision) continue;
          if (!newer || newer.revision < snapshot.revision) this.pending.set(id, snapshot);
        }
        throw error;
      }
    });
  }

  list(): Promise<SessionEntry[]> {
    return this.serial(async () => {
      await this.initialize();
      return this.sorted().map((entry) => ({ ...entry }));
    });
  }

  load(localId: string): Promise<StoredSession | undefined> {
    localIdSchema.parse(localId);
    return this.serial(async () => {
      await this.initialize();
      const entry = this.entries?.find((entry) => entry.localId === localId);
      if (!entry) return undefined;
      const path = this.transcriptPath(localId);
      await this.recoverBackup(path);
      if (!(await this.adapter.exists(path)))
        throw new Error(`Missing session transcript: ${localId}`);
      const lines = (await this.adapter.read(path)).split('\n').filter((line) => line.trim());
      const items: TranscriptItem[] = [];
      for (const [index, line] of lines.entries()) {
        try {
          items.push(consolidate(transcriptRecordSchema.parse(JSON.parse(line)).item));
        } catch {
          this.options.onError(
            new Error(`Invalid transcript record: ${localId}, line ${index + 1}`),
          );
        }
      }
      return { entry: { ...entry }, items };
    });
  }

  rename(localId: string, title: string): Promise<void> {
    localIdSchema.parse(localId);
    return this.serial(async () => {
      await this.initialize();
      const next =
        this.entries?.map((entry) =>
          entry.localId === localId ? { ...entry, title, updatedAt: this.now() } : entry,
        ) ?? [];
      await this.writeIndex(next);
    });
  }

  delete(localId: string): Promise<void> {
    localIdSchema.parse(localId);
    this.pending.delete(localId);
    return this.serial(async () => {
      await this.initialize();
      this.pending.delete(localId);
      await this.writeIndex(this.entries?.filter((entry) => entry.localId !== localId) ?? []);
      await this.removeTranscript(localId);
    });
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    for (const subscription of this.subscriptions) subscription.dispose();
    this.subscriptions.clear();
    await this.flush();
  }

  private async initialize(): Promise<void> {
    if (this.entries !== null) return;
    if (!(await this.adapter.exists(this.options.directory)))
      await this.adapter.mkdir(this.options.directory);
    const path = `${this.options.directory}/index.json`;
    await this.recoverBackup(path);
    // A corrupt index fails visibly and is never silently overwritten.
    const entries = (await this.adapter.exists(path))
      ? sessionEntrySchema.array().parse(JSON.parse(await this.adapter.read(path)))
      : [];
    if (new Set(entries.map((entry) => entry.localId)).size !== entries.length)
      throw new Error('Duplicate session IDs in index');
    this.entries = entries;
  }

  private async save({ state, at, revision }: Pending): Promise<void> {
    const previous = this.entries?.find((entry) => entry.localId === state.localId);
    const entry: SessionEntry = {
      localId: state.localId,
      agentId: state.agentId,
      nativeSessionId: state.nativeSessionId,
      title: state.title,
      cwd: state.cwd,
      createdAt: previous?.createdAt ?? at,
      updatedAt: at,
    };
    const data =
      state.items
        .map((item) => JSON.stringify({ v: 1, t: at, item: consolidate(item) }))
        .join('\n') + '\n';
    await this.atomicWrite(this.transcriptPath(state.localId), data);
    const next = [...(this.entries?.filter((e) => e.localId !== state.localId) ?? []), entry].sort(
      (a, b) => b.updatedAt - a.updatedAt || a.localId.localeCompare(b.localId),
    );
    const max = Math.max(1, Math.floor(this.options.settings().maxSessions));
    await this.writeIndex(next.slice(0, max));
    this.committed.set(state.localId, revision);
    const pending = this.pending.get(state.localId);
    if (pending && pending.revision <= revision) this.pending.delete(state.localId);
    for (const removed of next.slice(max)) await this.removeTranscript(removed.localId);
  }

  private async writeIndex(entries: SessionEntry[]): Promise<void> {
    await this.atomicWrite(`${this.options.directory}/index.json`, JSON.stringify(entries));
    this.entries = entries;
  }

  private async atomicWrite(path: string, data: string): Promise<void> {
    await this.recoverBackup(path);
    await this.adapter.write(`${path}.tmp`, data);
    // DataAdapter.rename refuses to overwrite a destination, unlike Node's fs.rename.
    // Keep the committed file as a backup until replacement succeeds.
    const exists = await this.adapter.exists(path);
    if (exists) {
      if (await this.adapter.exists(`${path}.bak`)) await this.adapter.remove(`${path}.bak`);
      await this.adapter.rename(path, `${path}.bak`);
    }
    try {
      await this.adapter.rename(`${path}.tmp`, path);
    } catch (error) {
      if (exists) await this.recoverBackup(path);
      throw error;
    }
    if (exists) await this.adapter.remove(`${path}.bak`);
  }

  private async recoverBackup(path: string): Promise<void> {
    if (!(await this.adapter.exists(path)) && (await this.adapter.exists(`${path}.bak`))) {
      await this.adapter.rename(`${path}.bak`, path);
    }
  }

  private async removeTranscript(localId: string): Promise<void> {
    const path = this.transcriptPath(localId);
    for (const file of [path, `${path}.bak`, `${path}.tmp`]) {
      if (await this.adapter.exists(file)) await this.adapter.remove(file);
    }
  }

  private transcriptPath(localId: string): string {
    return `${this.options.directory}/${localId}.jsonl`;
  }
  private now(): number {
    return this.options.now?.() ?? Date.now();
  }
  private sorted(): SessionEntry[] {
    return [...(this.entries ?? [])].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }
}

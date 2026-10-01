// In-memory SessionStorageAdapter that mimics Obsidian's DataAdapter (rename refuses to overwrite).
import type { SessionStorageAdapter } from '../../src/storage/SessionStore';

export class MemoryAdapter implements SessionStorageAdapter {
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

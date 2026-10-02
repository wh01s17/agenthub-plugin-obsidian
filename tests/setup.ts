import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

// The plugin uses `window` timers (Obsidian popout windows); tests in the Node environment have no `window`.
globalThis.window ??= globalThis as unknown as Window & typeof globalThis;

// Without `globals: true`, Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
});

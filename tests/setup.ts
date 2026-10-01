import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

// Without `globals: true`, Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
});

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      obsidian: fileURLToPath(new URL('./tests/__mocks__/obsidian.ts', import.meta.url)),
    },
  },
  // Vite 8 transforma con Oxc (la opción `esbuild` está deprecada).
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  test: {
    environment: 'jsdom',
    // Un jsdom por worker en lugar de uno por archivo; cada archivo sigue aislado en su propio contexto VM.
    pool: 'vmThreads',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    // Cada test parte de mocks, variables de entorno y globals limpios.
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      reporter: ['text', 'html'],
    },
  },
});

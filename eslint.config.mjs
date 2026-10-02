import { defineConfig, globalIgnores } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['node_modules/', 'main.js', 'test-vault/', 'coverage/']),
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'eslint.config.mjs',
            'esbuild.config.mjs',
            'vitest.config.ts',
            'scripts/*.mjs',
            'scripts/spikes/*.mjs',
            'tests/helpers/*.mjs',
          ],
        },
      },
    },
  },
  {
    // Scripts de desarrollo y config: corren en Node, no dentro de Obsidian.
    files: ['scripts/**', 'tests/helpers/**', '*.config.mjs', '*.config.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'import/no-nodejs-modules': 'off',
      'no-console': 'off',
      'obsidianmd/rule-custom-message': 'off',
      'obsidianmd/hardcoded-config-path': 'off',
      // `tests/setup.ts` crea `window` en los tests que corren en Node.
      'obsidianmd/no-global-this': 'off',
      'obsidianmd/prefer-window-timers': 'off',
    },
  },
  {
    // Los tests corren en jsdom puro, sin los helpers DOM de Obsidian. Las rutas `.obsidian` literales son
    // datos de prueba (guardia de rutas, copia del vault), no la carpeta de configuración real.
    files: ['tests/**'],
    rules: {
      'obsidianmd/prefer-create-el': 'off',
      'obsidianmd/prefer-window-timers': 'off',
      'obsidianmd/hardcoded-config-path': 'off',
      // `tests/setup.ts` crea `window` en los tests que corren en Node.
      'obsidianmd/no-global-this': 'off',
    },
  },
  {
    // Estos tests ejercitan a propósito `display()`, el respaldo para Obsidian < 1.13 (ADR-027).
    files: ['tests/unit/SettingsTab.test.ts'],
    rules: { '@typescript-eslint/no-deprecated': 'off' },
  },
]);

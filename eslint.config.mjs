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
          ],
        },
      },
    },
  },
  {
    // Scripts de desarrollo y config: corren en Node, no dentro de Obsidian.
    files: ['scripts/**', '*.config.mjs', '*.config.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'import/no-nodejs-modules': 'off',
      'no-console': 'off',
      'obsidianmd/rule-custom-message': 'off',
      'obsidianmd/hardcoded-config-path': 'off',
    },
  },
  {
    // Los tests corren en jsdom puro, sin los helpers DOM de Obsidian.
    files: ['tests/**'],
    rules: { 'obsidianmd/prefer-create-el': 'off' },
  },
]);

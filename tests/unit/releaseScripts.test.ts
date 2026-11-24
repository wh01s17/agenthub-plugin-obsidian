import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  addChangelogEntry,
  cutChangelog,
  findPins,
  isNewer,
  nextVersion,
  releaseNotes,
  replacePin,
  updatePlanTables,
} from '../../scripts/release-lib.mjs';

const CHANGELOG = `# Changelog

Intro.

## [Unreleased]

### Fixed

- A fix.

## [0.8.0] - 2026-10-28

### Added

- A feature.
`;

describe('adapter bump (T13.2)', () => {
  it('finds the pinned adapters of the presets with their labels', () => {
    const source = readFileSync('src/settings/settings.ts', 'utf8');
    const pins = findPins(source);
    expect(pins.map((p) => [p.label, p.pkg])).toEqual([
      ['Claude Code', '@agentclientprotocol/claude-agent-acp'],
      ['Codex', '@agentclientprotocol/codex-acp'],
    ]);
    for (const pin of pins) expect(pin.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('only moves forward to stable versions', () => {
    expect(isNewer('2.12.0', '2.1.1')).toBe(true);
    expect(isNewer('2.1.10', '2.1.9')).toBe(true);
    expect(isNewer('2.1.1', '2.1.1')).toBe(false);
    expect(isNewer('2.0.9', '2.1.1')).toBe(false);
    expect(isNewer('2.13.0-preview.1', '2.12.0')).toBe(false);
    expect(isNewer('', '2.12.0')).toBe(false);
  });

  it('replaces the exact pin only', () => {
    const source = `args: ['-y', '@a/codex-acp@2.1.1'], other: '@a/codex-acp@2.1.10'`;
    expect(replacePin(source, '@a/codex-acp', '2.1.1', '2.2.0')).toBe(
      `args: ['-y', '@a/codex-acp@2.2.0'], other: '@a/codex-acp@2.1.10'`,
    );
  });

  it('updates the version tables of plan.md but not the log', () => {
    const plan = [
      '| Codex | `npx -y @a/codex-acp@2.1.1` (antes 2.0.0) | ✅ |',
      '| `@a/codex-acp` | 2.1.1 | Adaptador. |',
      '- **2026-10-28** — verificado con `codex-acp@2.1.1`.',
      '  | Codex (`codex-acp@2.1.1`) | 235 |',
    ].join('\n');
    expect(updatePlanTables(plan, '@a/codex-acp', '2.1.1', '2.2.0').split('\n')).toEqual([
      '| Codex | `npx -y @a/codex-acp@2.2.0` (antes 2.0.0) | ✅ |',
      '| `@a/codex-acp` | 2.2.0 | Adaptador. |',
      '- **2026-10-28** — verificado con `codex-acp@2.1.1`.',
      '  | Codex (`codex-acp@2.1.1`) | 235 |',
    ]);
  });

  it('adds a Changed entry to [Unreleased], replacing an older bump of the same adapter', () => {
    const once = addChangelogEntry(CHANGELOG, 'Changed', '- Codex `@a/x` updated to 1.', '`@a/x`');
    expect(once).toContain(
      '## [Unreleased]\n\n### Fixed\n\n- A fix.\n\n### Changed\n\n- Codex `@a/x` updated to 1.\n\n## [0.8.0]',
    );
    const twice = addChangelogEntry(once, 'Changed', '- Codex `@a/x` updated to 2.', '`@a/x`');
    expect(twice).toContain('### Changed\n\n- Codex `@a/x` updated to 2.\n');
    expect(twice).not.toContain('updated to 1.');
    const empty = CHANGELOG.replace('### Fixed\n\n- A fix.\n\n', '');
    expect(addChangelogEntry(empty, 'Changed', '- B.')).toContain(
      '## [Unreleased]\n\n### Changed\n\n- B.\n\n## [0.8.0]',
    );
  });
});

describe('one-click release (T13.3)', () => {
  it('computes the next version', () => {
    expect(nextVersion('0.8.0', 'patch')).toBe('0.8.1');
    expect(nextVersion('0.8.3', 'minor')).toBe('0.9.0');
    expect(() => nextVersion('0.9.0-beta.1', 'patch')).toThrow();
  });

  it('cuts [Unreleased] into a dated version and extracts its notes', () => {
    const cut = cutChangelog(CHANGELOG, '0.8.1', '2026-11-24');
    expect(cut).toContain(
      '## [Unreleased]\n\n## [0.8.1] - 2026-11-24\n\n### Fixed\n\n- A fix.\n\n## [0.8.0] - 2026-10-28',
    );
    expect(releaseNotes(cut, '0.8.1')).toBe('### Fixed\n\n- A fix.\n');
    expect(releaseNotes(cut, '0.8.0')).toBe('### Added\n\n- A feature.\n');
    expect(() => cutChangelog(cut, '0.8.2', '2026-11-25')).toThrow(/empty/);
  });
});

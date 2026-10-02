# Changelog

Notable changes to AgentHub. Versions follow the release policy in `plan.md` §8.4.

## [Unreleased]

### Changed

- README discloses external processes, network use, adapter downloads by `npx`, required accounts, and file access outside the vault, as required by the Obsidian developer policies.

## [0.1.0] - 2026-10-02

### Added

- Changelog covering published releases.
- Release acceptance checklist and completion guide.

### Fixed

- Version synchronization instructions now use a manual version bump without creating tags with a `v` prefix.
- Permission buttons with long command labels wrap to fit the panel, including when zoomed.
- User messages and attachment labels support mouse text selection and copying.

## [0.0.5] - 2026-10-01

### Added

- Confirmation dialog and visible warning for unrestricted modes.
- Model and mode selectors for agents using older ACP fields, including Gemini CLI.

### Changed

- Codex starts in read-only mode unless an initial mode is explicitly configured.
- User messages have a visible author label, background, accent border, and spacing between turns.
- Original Claude, Codex, Gemini, and OpenCode logos; monograms for custom agents.
- Activity animations respect reduced motion preferences.
- Improved label/status contrast and dialog layout in narrow panels.

### Fixed

- Plugin manifest author set to `wh01s17`.

## [0.0.4] - 2026-10-01

### Added

- Searchable settings through the Obsidian 1.13+ declarative API, with compatibility for older versions.

### Fixed

- The startup status returns to Ready after early agent initialization finishes.

## [0.0.3] - 2026-10-01

### Added

- First documented public release: ACP chat, streaming, tools, permissions, and agent options.
- Active note context, selections, mentions, and command autocomplete.
- Persistent history, session resumption, note exports, and additional views.
- Edit diffs, English/Spanish localization, and paginated conversation history.
- Working directory option for the current note's folder.

### Changed

- Markdown rendering runs in blocks to keep the interface responsive during long responses.

### Fixed

- Code fences and vault-relative links in exported notes.

Version 0.0.1 was scaffolding. Version 0.0.2 had a tag and a draft that was later deleted. Neither was a public release.

[Unreleased]: https://github.com/wh01s17/agenthub-plugin-obsidian/compare/0.1.0...HEAD
[0.1.0]: https://github.com/wh01s17/agenthub-plugin-obsidian/releases/tag/0.1.0
[0.0.5]: https://github.com/wh01s17/agenthub-plugin-obsidian/releases/tag/0.0.5
[0.0.4]: https://github.com/wh01s17/agenthub-plugin-obsidian/releases/tag/0.0.4
[0.0.3]: https://github.com/wh01s17/agenthub-plugin-obsidian/releases/tag/0.0.3

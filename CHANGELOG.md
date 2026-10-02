# Changelog

Notable changes to AgentHub. Versions follow the release policy in `plan.md` §8.4.

## [Unreleased]

### Added

- Appearance settings: message style (bubbles, cards, or plain), density, text size, accent color (agent or theme), placement of the agent options, expanded tool calls, and usage display. Changes apply to open views at once.
- Agent options (mode, model, effort…) as pills in the message box, with a panel that lists each choice and its description; effort levels show as a level meter, and unrestricted modes are highlighted in red.
- The mode, model, and other agent options you choose are kept for new sessions and after restarting Obsidian. Unrestricted modes still ask for confirmation each time the agent starts.
- Two-state agent options, such as fast mode, appear as switches with their name.
- Up and Down in the message box recall the prompts sent since Obsidian started, like a shell history. The history is not saved.

### Fixed

- Agent detection in settings shortens paths in your home folder to `~`.
- Tool and permission titles show paths relative to the vault instead of full system paths.
- Reopening a conversation no longer stops the agent when it cannot continue the saved session (Gemini after restarting Obsidian): a new session starts and the view says that the earlier context was not restored.
- The suggestion list follows the highlighted item while moving with the arrow keys, and long descriptions are limited to two lines.

### Changed

- Refreshed design: message bubbles, rounded message box with a round send button and context at the top, softer cards for tools and plans, and a permission card with one primary action.
- Agent options appear in the message box by default; the previous selectors above the conversation remain available in settings.
- README screenshots retaken for the new design, including the agent options panel, context, and appearance settings.
- README adds a table of contents and installation from the community plugin directory; screenshots are shown expanded, two per row.

## [0.1.1] - 2026-10-02

### Changed

- README discloses external processes, network use, adapter downloads by `npx`, required accounts, and file access outside the vault, as required by the Obsidian developer policies.
- Release assets include GitHub artifact attestations to prove they were built from this repository.

### Fixed

- Timers in the agent connection, process cleanup, and session saving use `window` timers, for compatibility with Obsidian popout windows.
- The visually hidden text used for screen readers no longer relies on `clip-path`, which older Obsidian versions only partially support.

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

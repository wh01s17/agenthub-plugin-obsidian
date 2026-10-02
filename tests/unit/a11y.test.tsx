// Automated accessibility audit (axe-core, WCAG 2.x A/AA) of every chat component (plan T6.3).
// Color contrast is not checked here: jsdom cannot compute styles; Obsidian themes own the colors.
import { render, waitFor } from '@testing-library/preact';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { ChatSession } from '../../src/core/ChatSession';
import type { TranscriptItem } from '../../src/core/types';
import { App } from '../../src/ui/App';
import { HistoryPanel } from '../../src/ui/components/HistoryPanel';
import { DangerousModeDialog } from '../../src/ui/DangerousModeDialog';
import { StubAdapter, hostServices } from '../helpers/stubAgent';
import { makeViewHost } from '../helpers/viewHost';

async function audit(container: Element, minPasses = 5) {
  const result = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  // Guard against a vacuous pass: axe must have actually checked rules on this markup.
  expect(result.passes.length).toBeGreaterThanOrEqual(minPasses);
  return result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}

const transcript: TranscriptItem[] = [
  {
    kind: 'user',
    id: 'u1',
    at: 1,
    blocks: [
      { type: 'text', text: 'resume' },
      { type: 'file', path: 'A.md', absPath: '/v/A.md' },
    ],
  },
  { kind: 'thought', id: 't1', text: 'pensando', streaming: false },
  {
    kind: 'tool',
    call: {
      id: 'c1',
      title: 'Edit A.md',
      kind: 'edit',
      status: 'completed',
      locations: [{ path: 'A.md', line: 1 }],
      rawInput: { file_path: 'A.md' },
      content: [
        { type: 'diff', path: 'A.md', oldText: 'a\n', newText: 'b\n' },
        { type: 'terminal', output: 'ok', exitCode: 0 },
      ],
    },
  },
  {
    kind: 'plan',
    entries: [
      { content: 'Leer', status: 'completed' },
      { content: 'Escribir', status: 'in_progress' },
    ],
  },
  {
    kind: 'permission',
    request: {
      id: 'p1',
      toolCall: { id: 'c2', title: 'Write B.md', kind: 'edit' },
      options: [
        { id: 'ok', label: 'Allow', kind: 'allow_once' },
        { id: 'no', label: 'Reject', kind: 'reject_once' },
      ],
    },
  },
  { kind: 'assistant', id: 'a1', text: 'Hecho', streaming: false },
  {
    kind: 'notice',
    id: 'n1',
    level: 'error',
    notice: { key: 'agentError', message: 'x', hint: 'Run login', detail: 'stderr' },
  },
];

describe('accessibility audit (axe-core)', () => {
  it('unrestricted mode confirmation has named controls and a labelled description', async () => {
    const { container } = render(
      // jsdom does not implement native dialog visibility; audit the equivalent ARIA wrapper.
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mode-title"
        aria-describedby="mode-description"
      >
        <DangerousModeDialog
          agent="Codex"
          value="agent-full-access"
          titleId="mode-title"
          descriptionId="mode-description"
          onDecision={vi.fn()}
        />
      </div>,
    );
    expect(await audit(container)).toEqual([]);
  });
  it('chat view with every kind of transcript item has no violations', async () => {
    const { host } = makeViewHost(() => 'end_turn');
    host.notes.activeNotePath = () => 'A.md';
    const session = new ChatSession({
      localId: 's1',
      adapter: new StubAdapter(() => 'end_turn'),
      host: hostServices,
      options: { cwd: '/vault' },
      restore: { items: transcript },
      initialConfigOptions: [
        { id: 'mode', name: 'Mode', currentValue: 'a', options: [{ value: 'a', name: 'A' }] },
      ],
    });
    const { container } = render(
      <App
        host={host}
        session={session}
        onAgentChange={vi.fn()}
        onNewSession={vi.fn()}
        selection={{ path: 'A.md', text: 'x', fromLine: 1, toLine: 2 }}
      />,
    );
    expect(await audit(container)).toEqual([]);
  });

  it('history panel has no violations', async () => {
    const history = {
      list: () =>
        Promise.resolve([
          {
            localId: 'a',
            agentId: 'claude-acp',
            title: 'Uno',
            cwd: '/v',
            createdAt: 1,
            updatedAt: 2,
          },
        ]),
      rename: () => Promise.resolve(),
      delete: () => Promise.resolve(),
    };
    const { container, findByText } = render(
      <HistoryPanel
        history={history}
        currentId="a"
        agentLabel={() => ({ label: 'Claude Code', enabled: true })}
        onOpen={vi.fn()}
        onDelete={() => Promise.resolve()}
        onClose={vi.fn()}
      />,
    );
    await findByText('Uno');
    await waitFor(async () => expect(await audit(container)).toEqual([]));
  });
});

describe('the audit itself', () => {
  it('detects a real problem (an unnamed button)', async () => {
    const { container } = render(
      <div>
        <button type="button" />
      </div>,
    );
    expect((await audit(container, 0)).join()).toContain('button-name');
  });
});

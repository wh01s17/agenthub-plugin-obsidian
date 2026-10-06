import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/core/reducer';
import { exportFileName, sessionToMarkdown } from '../../src/storage/exportToNote';

const labels = {
  agent: 'Claude Code',
  you: 'You',
  thinking: 'Reasoning',
  plan: 'Plan',
  permission: 'Permission requested',
  image: 'Image',
  notice: () => 'Stopped.',
  vaultPath: (path: string) => (path.startsWith('/v/') ? path.slice(3) : null),
};

describe('sessionToMarkdown', () => {
  it('writes frontmatter, messages, attachments and callouts', () => {
    const state = createInitialState({
      localId: 's1',
      agentId: 'claude-acp',
      cwd: '/v',
      title: 'Resumen',
      items: [
        {
          kind: 'user',
          id: 'u',
          at: 1,
          blocks: [
            { type: 'text', text: 'resume' },
            { type: 'file', path: 'Notas/Ideas.md', absPath: '/v/Notas/Ideas.md' },
          ],
        },
        {
          kind: 'tool',
          call: {
            id: 'c',
            title: 'Read Ideas.md',
            kind: 'read',
            status: 'completed',
            content: [{ type: 'text', text: 'línea 1\nlínea 2' }],
          },
        },
        { kind: 'assistant', id: 'a', text: 'Hecho.', streaming: false },
        {
          kind: 'permission',
          request: {
            id: 'p',
            toolCall: { id: 'c2', title: 'Write x.md', kind: 'edit' },
            options: [{ id: 'ok', label: 'Allow', kind: 'allow_once' }],
          },
          resolved: { outcome: 'selected', optionId: 'ok' },
        },
        {
          kind: 'notice',
          id: 'n',
          level: 'info',
          notice: { key: 'turnStopped', stopReason: 'cancelled' },
        },
      ],
    });
    const md = sessionToMarkdown(state, labels, new Date('2026-10-01T12:00:00Z'));
    expect(md).toContain('agent: "Claude Code"\nsession: "s1"\nexported: 2026-10-01T12:00:00.000Z');
    expect(md).toContain('# Resumen');
    expect(md).toContain('## You\n\nresume\n\n- [[Notas/Ideas.md]]');
    expect(md).toContain(
      '> [!tool]- Read Ideas.md (completed)\n> ```\n> línea 1\n> línea 2\n> ```',
    );
    expect(md).toContain('## Claude Code\n\nHecho.');
    expect(md).toContain('> [!warning] Permission requested: Write x.md → Allow');
    expect(md).toContain('> [!info] Stopped.');
  });
});

describe('exportFileName', () => {
  it('strips characters Obsidian does not allow in file names', () => {
    expect(exportFileName('a/b: c? [x]', new Date('2026-10-01T12:34:00Z'))).toBe(
      'ab c x 2026-10-01 12-34.md',
    );
    expect(exportFileName('', new Date('2026-10-01T12:34:00Z'))).toBe(
      'AgentHub session 2026-10-01 12-34.md',
    );
  });
});

describe('tool output that already contains code fences', () => {
  it('uses a longer fence so the inner one cannot close it', () => {
    const state = createInitialState({
      localId: 's2',
      agentId: 'claude-acp',
      cwd: '/v',
      items: [
        {
          kind: 'tool',
          call: {
            id: 'c',
            title: 'Read A.md',
            kind: 'read',
            status: 'completed',
            content: [{ type: 'text', text: '```\n1\tcode\n```' }],
          },
        },
      ],
    });
    const md = sessionToMarkdown(state, labels, new Date('2026-10-01T12:00:00Z'));
    expect(md).toContain('> ````\n> ```\n> 1\tcode\n> ```\n> ````');
  });
});

describe('paths in exported notes', () => {
  it('links vault files and keeps outside paths as code', () => {
    const state = createInitialState({
      localId: 's3',
      agentId: 'claude-acp',
      cwd: '/v',
      items: [
        {
          kind: 'tool',
          call: {
            id: 'c',
            title: 'Edit',
            kind: 'edit',
            status: 'completed',
            locations: [{ path: '/v/Notas/A.md' }, { path: '/etc/hosts' }],
            content: [{ type: 'diff', path: '/v/Notas/A.md', oldText: 'a', newText: 'b' }],
          },
        },
      ],
    });
    const md = sessionToMarkdown(state, labels, new Date('2026-10-01T12:00:00Z'));
    expect(md).toContain('> - [[Notas/A.md]]\n> - `/etc/hosts`');
    expect(md).toContain('> [[Notas/A.md]]\n> ```\n> b\n> ```');
  });
});

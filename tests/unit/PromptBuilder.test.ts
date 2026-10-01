import { describe, expect, it } from 'vitest';
import { buildPrompt, extractMentions } from '../../src/core/PromptBuilder';

const note = (path: string, text?: string) => ({ path, absPath: `/v/${path}`, text });

describe('extractMentions', () => {
  it('finds unique @[[path]] mentions in order', () => {
    expect(
      extractMentions('Mira @[[A.md]] y @[[Notas/B.md]] y otra vez @[[A.md]]; [[C]] no'),
    ).toEqual(['A.md', 'Notas/B.md']);
  });
});

describe('buildPrompt', () => {
  it('starts with the message and adds selection, mentions and the active note', () => {
    const blocks = buildPrompt({
      text: 'resume',
      activeNote: note('Activa.md', '# Activa'),
      selection: { path: 'Activa.md', text: 'línea', fromLine: 3, toLine: 3 },
      mentions: [note('Otra.md', 'otra')],
    });
    expect(blocks).toEqual([
      { type: 'text', text: 'resume' },
      { type: 'selection', path: 'Activa.md', text: 'línea', fromLine: 3, toLine: 3 },
      { type: 'file', path: 'Otra.md', absPath: '/v/Otra.md', text: 'otra' },
      { type: 'file', path: 'Activa.md', absPath: '/v/Activa.md', text: '# Activa' },
    ]);
  });

  it('does not repeat the active note when it is also mentioned', () => {
    const blocks = buildPrompt({
      text: 'x',
      activeNote: note('A.md', 'a'),
      mentions: [note('A.md', 'a')],
    });
    expect(blocks.filter((b) => b.type === 'file')).toHaveLength(1);
  });

  it('keeps links but drops embedded text beyond the budget', () => {
    const blocks = buildPrompt({
      text: 'x',
      mentions: [note('Big.md', 'x'.repeat(10)), note('Small.md', 'yy')],
      maxEmbeddedChars: 5,
    });
    expect(blocks.slice(1)).toEqual([
      { type: 'file', path: 'Big.md', absPath: '/v/Big.md', text: undefined },
      { type: 'file', path: 'Small.md', absPath: '/v/Small.md', text: 'yy' },
    ]);
  });
});

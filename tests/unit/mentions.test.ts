import { describe, expect, it } from 'vitest';
import { compactMentions, expandMentions, mentionLabel, mentionSegments } from '../../src/core/mentions';

describe('mentionLabel', () => {
  const vault = ['Meetings/Kickoff.md', 'Projects/Kickoff.md', 'a/informe.pdf', 'Proyectos/'];

  it('uses the note name when it is unique', () => {
    expect(mentionLabel('a/informe.pdf', new Map(), vault)).toBe('informe.pdf');
    expect(mentionLabel('Proyectos/', new Map(), vault)).toBe('Proyectos/');
  });

  it('falls back to the path when the name is shared', () => {
    expect(mentionLabel('Meetings/Kickoff.md', new Map(), vault)).toBe('Meetings/Kickoff');
    const taken = new Map([['informe.pdf', 'b/informe.pdf']]);
    expect(mentionLabel('a/informe.pdf', taken, vault)).toBe('a/informe.pdf');
  });
});

describe('expandMentions', () => {
  const mentions = new Map([
    ['Kickoff', 'Meetings/Kickoff.md'],
    ['Website Redesign', 'Projects/Website Redesign.md'],
  ]);

  it('turns known labels into full mentions, whole words only', () => {
    expect(expandMentions('@Kickoff, @Website Redesign y @Kickoffs', mentions)).toBe(
      '@[[Meetings/Kickoff.md]], @[[Projects/Website Redesign.md]] y @Kickoffs',
    );
  });

  it('leaves text without labels alone', () => {
    expect(expandMentions('hola @[[x.md]]', new Map())).toBe('hola @[[x.md]]');
  });
});

describe('compactMentions', () => {
  it('shortens full mentions and round-trips', () => {
    const text = 'mira @[[Meetings/Kickoff.md]] y @[[a/informe.pdf]]';
    const compact = compactMentions(text, ['Meetings/Kickoff.md', 'a/informe.pdf']);
    expect(compact.text).toBe('mira @Kickoff y @informe.pdf');
    expect(expandMentions(compact.text, compact.mentions)).toBe(text);
  });
});

describe('mentionSegments', () => {
  it('splits out short labels and hand-typed full mentions', () => {
    const mentions = new Map([['Kickoff', 'Meetings/Kickoff.md']]);
    expect(mentionSegments('@Kickoff vs @[[a.md]] y @Kickoffs', mentions)).toEqual([
      '',
      '@Kickoff',
      ' vs ',
      '@[[a.md]]',
      ' y @Kickoffs',
    ]);
    expect(mentionSegments('hola', new Map())).toEqual(['hola']);
  });
});

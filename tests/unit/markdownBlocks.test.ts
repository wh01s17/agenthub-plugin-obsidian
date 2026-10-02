import { describe, expect, it } from 'vitest';
import { splitBlocks } from '../../src/ui/markdownBlocks';

describe('splitBlocks', () => {
  it('splits paragraphs on blank lines', () => {
    expect(splitBlocks('# Título\n\nUno\ndos\n\n\n- a\n- b')).toEqual([
      '# Título',
      'Uno\ndos',
      '- a\n- b',
    ]);
  });

  it('keeps fenced code with blank lines in one block, even unclosed while streaming', () => {
    const text = 'Antes\n\n```js\nconst a = 1;\n\nconst b = 2;\n```\n\nDespués';
    expect(splitBlocks(text)).toEqual([
      'Antes',
      '```js\nconst a = 1;\n\nconst b = 2;\n```',
      'Después',
    ]);
    expect(splitBlocks('```\nx\n\ny')).toEqual(['```\nx\n\ny']);
  });

  it('only closes a fence with the same marker and enough length', () => {
    const text = '````\n```\ninner\n\n```\n````\n\nfin';
    expect(splitBlocks(text)).toEqual(['````\n```\ninner\n\n```\n````', 'fin']);
  });

  it('returns nothing for empty text', () => {
    expect(splitBlocks('')).toEqual([]);
    expect(splitBlocks('\n\n')).toEqual([]);
  });
});

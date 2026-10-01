import { describe, expect, it } from 'vitest';
import { applySuggestion, findTrigger, rankMatches } from '../../src/core/suggest';

describe('findTrigger', () => {
  it('detects @ after a space or at the start', () => {
    expect(findTrigger('hola @Ide', 9)).toEqual({ kind: 'note', query: 'Ide', start: 5 });
    expect(findTrigger('@', 1)).toEqual({ kind: 'note', query: '', start: 0 });
    expect(findTrigger('correo@ejemplo', 14)).toBeNull();
    expect(findTrigger('ya @[[A.md]] ', 13)).toBeNull();
  });

  it('detects / only at the start of the message', () => {
    expect(findTrigger('/rev', 4)).toEqual({ kind: 'command', query: 'rev', start: 0 });
    expect(findTrigger('/review algo', 12)).toBeNull();
    expect(findTrigger('usa /x', 6)).toBeNull();
  });
});

describe('rankMatches', () => {
  it('prefers name prefixes, then substrings, then subsequences', () => {
    const notes = ['Notas/Ideas.md', 'Bienvenida.md', 'Notas/Proyecto Alfa.md', 'Archivo/IA.md'];
    expect(rankMatches('ide', notes)).toEqual(['Notas/Ideas.md']);
    expect(rankMatches('nts', notes)).toEqual(['Notas/Ideas.md', 'Notas/Proyecto Alfa.md']);
    expect(rankMatches('', notes, 2)).toHaveLength(2);
  });
});

describe('applySuggestion', () => {
  it('inserts a note mention or a command and moves the cursor after it', () => {
    expect(
      applySuggestion(
        'mira @Ide y más',
        9,
        { kind: 'note', query: 'Ide', start: 5 },
        'Notas/Ideas.md',
      ),
    ).toEqual({
      text: 'mira @[[Notas/Ideas.md]]  y más',
      cursor: 25,
    });
    expect(applySuggestion('/re', 3, { kind: 'command', query: 're', start: 0 }, 'review')).toEqual(
      {
        text: '/review ',
        cursor: 8,
      },
    );
  });
});

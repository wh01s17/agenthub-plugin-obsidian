import { describe, expect, it } from 'vitest';
import {
  applySuggestion,
  commandSuggestions,
  findTrigger,
  rankMatches,
  skillSuggestions,
} from '../../src/core/suggest';

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

describe('$ skills and folders (T11.3, T11.4)', () => {
  it('detects $ like @, anywhere after a space', () => {
    expect(findTrigger('usa $ana', 8)).toEqual({ kind: 'skill', query: 'ana', start: 4 });
    expect(findTrigger('cuesta 5$x', 10)).toBeNull();
  });

  it('ranks folders by their own name', () => {
    expect(rankMatches('proy', ['Notas/Proyectos/', 'Otra/Plan.md'])).toEqual(['Notas/Proyectos/']);
  });

  it('inserts a skill with its $ prefix', () => {
    expect(applySuggestion('$an', 3, { kind: 'skill', query: 'an', start: 0 }, 'anatomy')).toEqual({
      text: '$anatomy ',
      cursor: 9,
    });
  });
});

describe('commandSuggestions (T11.3)', () => {
  const agent = [
    { name: 'review', description: 'Review changes', inputHint: 'optional instructions' },
    { name: '$anatomy', description: 'Skill' },
  ];
  const client = [{ id: 'new' as const, name: 'new' }];

  it('puts AgentHub commands first and keeps $ skills out of /', () => {
    expect(commandSuggestions('', agent, client, () => 'Start')).toEqual([
      { value: 'new', detail: 'Start', group: 'client' },
      { value: 'review', detail: 'Review changes', hint: 'optional instructions', group: 'agent' },
    ]);
  });

  it('offers $ skills without the prefix', () => {
    expect(skillSuggestions('ana', agent).map((s) => s.value)).toEqual(['anatomy']);
  });

  it('shows more than 8 commands', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `cmd${i}` }));
    expect(commandSuggestions('cmd', many, [], String)).toHaveLength(30);
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { PromptBlock } from '../../src/core/types';
import { App } from '../../src/ui/App';
import { makeViewHost } from '../helpers/viewHost';

function setup(
  selection = null as null | { path: string; text: string; fromLine: number; toLine: number },
) {
  const seen: PromptBlock[][] = [];
  const { host, sessions } = makeViewHost(({ blocks }) => {
    seen.push(blocks);
    return 'end_turn';
  });
  const notes: Record<string, string> = { 'Activa.md': '# Activa', 'Otra.md': '# Otra' };
  host.notes.activeNotePath = () => 'Activa.md';
  host.notes.readNote = (path) =>
    Promise.resolve(path in notes ? { path, absPath: `/vault/${path}`, text: notes[path] } : null);
  const onClearSelection = vi.fn();
  render(
    <App
      host={host}
      session={sessions.create('claude-acp') ?? null}
      onAgentChange={vi.fn()}
      onNewSession={vi.fn()}
      selection={selection}
      onClearSelection={onClearSelection}
    />,
  );
  const send = (text: string) => {
    const input = screen.getByRole('textbox', { name: 'Message to the agent' });
    fireEvent.input(input, { target: { value: text } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };
  return { seen, send, onClearSelection };
}

describe('context in prompts (Fase 3)', () => {
  it('attaches the active note and @mentions', async () => {
    const { seen, send } = setup();
    expect(screen.getByRole('button', { name: /Current note: Activa/ })).toBeTruthy();
    send('compara con @[[Otra.md]]');
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]?.map((b) => (b.type === 'file' ? b.path : b.type))).toEqual([
      'text',
      'Otra.md',
      'Activa.md',
    ]);
    expect(screen.getByText('Note: Activa.md')).toBeTruthy();
  });

  it('lets the user leave the active note out', async () => {
    const { seen, send } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Current note: Activa/ }));
    expect(screen.getByRole('button', { name: /not included/ }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    send('hola');
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]?.map((b) => b.type)).toEqual(['text']);
  });

  it('sends a captured selection once', async () => {
    const { seen, send, onClearSelection } = setup({
      path: 'Activa.md',
      text: 'línea',
      fromLine: 2,
      toLine: 4,
    });
    expect(screen.getByText('Selection: Activa (lines 2–4)')).toBeTruthy();
    send('mejora esto');
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]?.[1]).toEqual({
      type: 'selection',
      path: 'Activa.md',
      text: 'línea',
      fromLine: 2,
      toLine: 4,
    });
    expect(onClearSelection).toHaveBeenCalled();
  });
});

describe('composer suggestions (T3.3/T3.4)', () => {
  it('completes @ with vault notes using the keyboard', async () => {
    const { host, sessions } = makeViewHost(() => 'end_turn');
    host.notes.listNotes = () => ['Notas/Ideas.md', 'Bienvenida.md'];
    render(
      <App
        host={host}
        session={sessions.create('claude-acp') ?? null}
        onAgentChange={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );
    const input = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Message to the agent',
    });
    input.value = 'mira @ide';
    input.setSelectionRange(9, 9);
    fireEvent.input(input);
    const option = await screen.findByRole('option', { name: 'Notas/Ideas.md' });
    expect(option.getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(option.id);
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(input.value).toBe('mira @[[Notas/Ideas.md]] '));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

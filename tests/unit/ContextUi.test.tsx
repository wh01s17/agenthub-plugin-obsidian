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
    // The mention shows as a chip in the text; the active note as a chip below, without repeats.
    const message = document.querySelector('.agenthub-message.is-user');
    expect(message?.querySelector('.agenthub-message-text')?.textContent).toBe('compara con Otra');
    expect(screen.getAllByRole('link', { name: 'Note: Otra.md' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Note: Activa.md' })).toHaveLength(1);
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
    host.notes.listPaths = () => ['Notas/Ideas.md', 'Bienvenida.md'];
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
    // The box shows a short label (ADR-042); the agent gets the full mention.
    await waitFor(() => expect(input.value).toBe('mira @Ideas '));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('sends a short @label as the full mention and recalls it short', async () => {
    const seen: PromptBlock[][] = [];
    const { host, sessions } = makeViewHost(({ blocks }) => {
      seen.push(blocks);
      return 'end_turn';
    });
    host.notes.listPaths = () => ['Notas/Ideas.md', 'Bienvenida.md'];
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
    await screen.findByRole('option', { name: 'Notas/Ideas.md' });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(input.value).toBe('mira @Ideas '));
    expect(document.querySelector('.agenthub-composer-highlight mark')?.textContent).toBe('@Ideas');
    fireEvent.input(input, { target: { value: 'mira @Ideas y resume' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]?.[0]).toEqual({ type: 'text', text: 'mira @[[Notas/Ideas.md]] y resume' });
    // Up brings the prompt back with the short label, and it still sends the full mention.
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    await waitFor(() => expect(input.value).toBe('mira @Ideas y resume'));
  });

  it('scrolls the highlighted suggestion into view while moving with the arrows', async () => {
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    const { host, sessions } = makeViewHost(() => 'end_turn');
    host.notes.listPaths = () => ['Uno.md', 'Dos.md', 'Tres.md'];
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
    input.value = '@';
    input.setSelectionRange(1, 1);
    fireEvent.input(input);
    await screen.findByRole('listbox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const active = screen
      .getAllByRole('option')
      .find((o) => o.getAttribute('aria-selected') === 'true');
    await waitFor(() => expect(scroll.mock.contexts.at(-1)).toBe(active));
    expect(scroll).toHaveBeenLastCalledWith({ block: 'nearest' });
  });
});

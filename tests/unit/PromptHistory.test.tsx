import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { PromptHistory } from '../../src/core/PromptHistory';
import { Composer } from '../../src/ui/components/Composer';

function renderComposer(history: PromptHistory) {
  const onSend = vi.fn();
  render(
    <Composer
      agentLabel="Claude Code"
      busy={false}
      disabled={false}
      sendWith="enter"
      history={history}
      notes={() => []}
      commands={[]}
      onSend={onSend}
      onStop={vi.fn()}
    />,
  );
  const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message to the agent' });
  const send = (text: string) => {
    fireEvent.input(input, { target: { value: text } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };
  return { input, send, onSend };
}

describe('PromptHistory', () => {
  it('keeps trimmed prompts, skips repeats and empty ones, and caps its size', () => {
    const history = new PromptHistory();
    history.add('  uno ');
    history.add('uno');
    history.add('   ');
    history.add('dos');
    expect(history.entries()).toEqual(['uno', 'dos']);
    for (let i = 0; i < 150; i++) history.add(`p${i}`);
    expect(history.entries()).toHaveLength(100);
    expect(history.entries()[99]).toBe('p149');
  });
});

describe('composer history (arrow keys)', () => {
  it('goes back with Up and forward with Down, ending at the unsent draft', () => {
    const history = new PromptHistory();
    const { input, send, onSend } = renderComposer(history);
    send('uno');
    send('dos');
    expect(onSend.mock.calls).toEqual([['uno'], ['dos']]);
    expect(history.entries()).toEqual(['uno', 'dos']);

    fireEvent.input(input, { target: { value: 'borrador' } });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('dos');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('uno');
    fireEvent.keyDown(input, { key: 'ArrowUp' }); // stays on the oldest
    expect(input.value).toBe('uno');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('dos');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('borrador');
  });

  it('moves the caret normally inside a multi-line prompt', () => {
    const history = new PromptHistory();
    history.add('anterior');
    const { input } = renderComposer(history);
    fireEvent.input(input, { target: { value: 'línea 1\nlínea 2' } });
    input.setSelectionRange(12, 12); // second line
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('línea 1\nlínea 2');
  });
});

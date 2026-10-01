import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { PermissionOutcome } from '../../src/core/types';
import { App } from '../../src/ui/App';
import { isSendKey } from '../../src/ui/components/Composer';
import { ToolCallCard } from '../../src/ui/components/ToolCallCard';
import { contextPercent } from '../../src/ui/components/StatusBar';
import type { StubScript } from '../helpers/stubAgent';
import { makeViewHost } from '../helpers/viewHost';

function renderChat(script: StubScript) {
  const { host, sessions } = makeViewHost(script);
  const session = sessions.create('claude-acp') ?? null;
  render(<App host={host} session={session} onAgentChange={vi.fn()} onNewSession={vi.fn()} />);
  return { session };
}

const input = () => screen.getByRole('textbox', { name: 'Message to the agent' });

describe('isSendKey', () => {
  const key = (over: Partial<KeyboardEvent>) => ({
    key: 'Enter',
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    isComposing: false,
    ...over,
  });
  it('sends on Enter or on Mod+Enter depending on the setting', () => {
    expect(isSendKey(key({}), 'enter')).toBe(true);
    expect(isSendKey(key({ shiftKey: true }), 'enter')).toBe(false);
    expect(isSendKey(key({}), 'mod-enter')).toBe(false);
    expect(isSendKey(key({ ctrlKey: true }), 'mod-enter')).toBe(true);
    expect(isSendKey(key({ isComposing: true }), 'enter')).toBe(false);
  });
});

describe('chat view', () => {
  it('sends a message with Enter and renders the reply', async () => {
    renderChat(({ emit, blocks }) => {
      const text = blocks[0]?.type === 'text' ? blocks[0].text : '';
      emit({ type: 'message.chunk', role: 'assistant', messageId: 'm', text: `Eco: ${text}` });
      emit({ type: 'message.end', messageId: 'm' });
      return 'end_turn';
    });
    expect(screen.getByText('Start a conversation')).toBeTruthy();

    fireEvent.input(input(), { target: { value: 'hola' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    await waitFor(() => expect(screen.getByText('Eco: hola')).toBeTruthy());
    expect(screen.getByText('hola')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Ready');
  });

  it('answers permission requests with native buttons', async () => {
    let answer: PermissionOutcome | undefined;
    renderChat(async ({ host }) => {
      answer = await host.requestPermission({
        id: 'p1',
        toolCall: { id: 'c1', title: 'Write resumen.md', kind: 'edit' },
        options: [
          { id: 'ok', label: 'Allow', kind: 'allow_once' },
          { id: 'no', label: 'Reject', kind: 'reject_once' },
        ],
      });
      return 'end_turn' as const;
    });
    fireEvent.input(input(), { target: { value: 'escribe' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    const allow = await screen.findByRole('button', { name: 'Allow' });
    expect(screen.getByRole('status').textContent).toBe('Waiting for your permission');
    fireEvent.click(allow);
    await waitFor(() => expect(screen.getByText('Answered: Allow')).toBeTruthy());
    expect(answer).toEqual({ outcome: 'selected', optionId: 'ok' });
  });

  it('offers Stop while the agent works', async () => {
    renderChat(
      ({ cancelled }) =>
        new Promise((resolve) => {
          const timer = setInterval(() => {
            if (cancelled()) {
              clearInterval(timer);
              resolve('cancelled');
            }
          }, 5);
        }),
    );
    fireEvent.input(input(), { target: { value: 'largo' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('button', { name: 'Stop' }));
    await waitFor(() => expect(screen.getByText('Stopped.')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
  });
});

describe('ToolCallCard', () => {
  it('shows title, accessible status, input and terminal output', () => {
    render(
      <ToolCallCard
        call={{
          id: 'c',
          title: 'ls Notas',
          kind: 'execute',
          status: 'completed',
          rawInput: { command: 'ls Notas' },
          content: [{ type: 'terminal', output: 'Ideas.md\n', exitCode: 0 }],
        }}
      />,
    );
    expect(screen.getByText('ls Notas')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText('Exit code 0')).toBeTruthy();
    expect(screen.getByText(/"command": "ls Notas"/)).toBeTruthy();
  });
});

describe('contextPercent', () => {
  it('needs both values and caps at 100', () => {
    expect(contextPercent(undefined)).toBeNull();
    expect(contextPercent({ contextUsed: 50 })).toBeNull();
    expect(contextPercent({ contextUsed: 50, contextSize: 200 })).toBe(25);
    expect(contextPercent({ contextUsed: 500, contextSize: 200 })).toBe(100);
  });
});

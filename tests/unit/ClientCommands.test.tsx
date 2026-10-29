import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigOption, PromptBlock } from '../../src/core/types';
import { App } from '../../src/ui/App';
import { makeViewHost } from '../helpers/viewHost';

const model: ConfigOption = {
  id: 'model',
  name: 'Model',
  category: 'model',
  currentValue: 'sonnet',
  options: [
    { value: 'sonnet', name: 'Sonnet' },
    { value: 'opus', name: 'Opus' },
  ],
};

async function setup() {
  const seen: PromptBlock[][] = [];
  const { host, sessions, adapter } = makeViewHost(({ blocks }) => {
    seen.push(blocks);
    return 'end_turn';
  });
  const onNewSession = vi.fn();
  const session = sessions.create('claude-acp') ?? null;
  void session?.prepare();
  render(<App host={host} session={session} onAgentChange={vi.fn()} onNewSession={onNewSession} />);
  await waitFor(() => expect(adapter.sessions).toHaveLength(1));
  const agent = adapter.sessions[0]!;
  const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message to the agent' });
  const type = (text: string) => {
    input.value = text;
    input.setSelectionRange(text.length, text.length);
    fireEvent.input(input);
  };
  const send = (text: string) => {
    type(text);
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'Enter' });
  };
  return { host, seen, agent, input, type, send, onNewSession };
}

describe('client commands (T11.2, ADR-038)', () => {
  it('runs /new and /export without sending them to the agent', async () => {
    const { host, seen, send, onNewSession, input } = await setup();
    const exportSession = vi.fn(() => Promise.resolve());
    host.exportSession = exportSession;
    send('/new');
    expect(onNewSession).toHaveBeenCalledOnce();
    expect(input.value).toBe('');
    send('/export');
    expect(exportSession).toHaveBeenCalledOnce();
    expect(seen).toHaveLength(0);
  });

  it('/help lists AgentHub and agent commands, AgentHub first', async () => {
    const { agent, send } = await setup();
    await act(() =>
      agent.push({
        type: 'commands',
        commands: [{ name: 'review', description: 'Review', inputHint: 'instructions' }],
      }),
    );
    send('/help');
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options[0]?.textContent).toContain('new');
    expect(options[0]?.textContent).toContain('AgentHub');
    const review = options.find((o) => o.textContent?.startsWith('review'));
    expect(review?.textContent).toContain('instructions');
    expect(review?.className).toContain('is-group-start');
  });

  it('sends a command the agent announces with the same name to the agent', async () => {
    const { agent, seen, send, onNewSession } = await setup();
    await act(() => agent.push({ type: 'commands', commands: [{ name: 'new' }] }));
    send('/new');
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(onNewSession).not.toHaveBeenCalled();
  });

  it('/model <name> changes the model option', async () => {
    const { agent, send } = await setup();
    const setConfigOption = vi.fn(() => Promise.resolve());
    agent.setConfigOption = setConfigOption;
    agent.capabilities.configOptions = true;
    await act(() => agent.push({ type: 'config', configOptions: [model] }));
    send('/model opus');
    await waitFor(() => expect(setConfigOption).toHaveBeenCalledWith('model', 'opus'));
  });

  it('/model alone opens the model picker', async () => {
    const { agent, send } = await setup();
    await act(() => agent.push({ type: 'config', configOptions: [model] }));
    send('/model');
    expect(await screen.findByRole('menu', { name: 'Model' })).toBeTruthy();
  });
});

describe('own menus (ADR-039)', () => {
  it('/model alone opens the picker even if the agent announces /model; with arguments it goes to the agent', async () => {
    const { agent, seen, send } = await setup();
    await act(() => agent.push({ type: 'commands', commands: [{ name: 'model' }] }));
    await act(() => agent.push({ type: 'config', configOptions: [model] }));
    send('/model');
    expect(await screen.findByRole('menu', { name: 'Model' })).toBeTruthy();
    expect(seen).toHaveLength(0);
    send('/model opus');
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toEqual([{ type: 'text', text: '/model opus' }]);
  });

  it('/skills lists the $ skills to pick one', async () => {
    const { agent, seen, send, input } = await setup();
    await act(() =>
      agent.push({ type: 'commands', commands: [{ name: 'skills' }, { name: '$anatomy' }] }),
    );
    send('/skills');
    const option = await screen.findByRole('option', { name: /anatomy/ });
    expect(option).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(input.value).toBe('$anatomy '));
    expect(seen).toHaveLength(0);
  });
});

describe('$ skills (T11.3)', () => {
  it('completes skills announced with $ and keeps them out of /', async () => {
    const { agent, type, input } = await setup();
    await act(() =>
      agent.push({ type: 'commands', commands: [{ name: '$anatomy' }, { name: 'review' }] }),
    );
    type('/');
    expect(screen.queryByRole('option', { name: /anatomy/ })).toBeNull();
    type('usa $ana');
    const option = await screen.findByRole('option', { name: /anatomy/ });
    expect(option).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(input.value).toBe('usa $anatomy '));
  });
});

describe('@ files, folders and images (T11.4)', () => {
  it('sends a mentioned image as an image block and a folder as a file link', async () => {
    const { host, seen, send } = await setup();
    const image = { type: 'image' as const, mimeType: 'image/png', data: 'AAAA' };
    host.notes.readImage = (path) => Promise.resolve(path === 'img/a.png' ? image : null);
    host.notes.readNote = (path) =>
      Promise.resolve({ path: path.replace(/\/$/, ''), absPath: `/vault/${path}` });
    send('mira @[[img/a.png]] y @[[Proyectos/]]');
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]?.map((b) => (b.type === 'file' ? `file:${b.path}` : b.type))).toEqual([
      'text',
      'image',
      'file:Proyectos',
    ]);
  });
});

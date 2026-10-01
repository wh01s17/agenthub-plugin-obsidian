import { describe, expect, it } from 'vitest';
import { createInitialState, reduce, type SessionAction } from '../../src/core/reducer';
import type { SessionViewState } from '../../src/core/types';

const initial = () => createInitialState({ localId: 'l1', agentId: 'a', cwd: '/vault' });
const run = (...actions: SessionAction[]) => actions.reduce(reduce, initial());

describe('reduce', () => {
  it('starts idle and empty', () => {
    expect(initial()).toEqual({
      localId: 'l1',
      agentId: 'a',
      cwd: '/vault',
      title: '',
      status: 'idle',
      items: [],
      configOptions: [],
      commands: [],
    });
  });

  it('never mutates the previous state', () => {
    const before = run({
      type: 'local.user',
      id: 'u1',
      blocks: [{ type: 'text', text: 'hi' }],
      at: 1,
    });
    const frozen = structuredClone(before);
    reduce(before, { type: 'message.chunk', role: 'assistant', messageId: 'm1', text: 'x' });
    expect(before).toEqual(frozen);
  });

  it('returns the same object for events that change nothing', () => {
    const state = initial();
    expect(reduce(state, { type: 'debug', source: 'stderr', line: 'x' })).toBe(state);
    expect(reduce(state, { type: 'message.end', messageId: 'missing' })).toBe(state);
  });

  it('accumulates streamed chunks per message and closes them', () => {
    const state = run(
      { type: 'message.chunk', role: 'assistant', messageId: 'm1', text: 'Ho' },
      { type: 'thought.chunk', messageId: 't1', text: 'pienso' },
      { type: 'message.chunk', role: 'assistant', messageId: 'm1', text: 'la' },
      { type: 'message.end', messageId: 'm1' },
    );
    expect(state.items).toEqual([
      { kind: 'assistant', id: 'm1', text: 'Hola', streaming: false },
      { kind: 'thought', id: 't1', text: 'pienso', streaming: true },
    ]);
  });

  it('creates tool calls and merges updates, even for unseen ids', () => {
    const state = run(
      { type: 'tool.call', call: { id: 'c1', title: 'Read', kind: 'read', status: 'pending' } },
      { type: 'tool.update', id: 'c1', patch: { status: 'completed', title: 'Read a.md' } },
      { type: 'tool.update', id: 'c2', patch: { status: 'in_progress' } },
    );
    expect(state.items).toEqual([
      { kind: 'tool', call: { id: 'c1', title: 'Read a.md', kind: 'read', status: 'completed' } },
      {
        kind: 'tool',
        call: { id: 'c2', title: 'Tool call', kind: 'other', status: 'in_progress' },
      },
    ]);
  });

  it('keeps one plan per turn', () => {
    const entry = (status: 'pending' | 'completed') => [{ content: 'a', status }];
    const state = run(
      { type: 'plan', entries: entry('pending') },
      { type: 'plan', entries: entry('completed') },
      { type: 'local.user', id: 'u2', blocks: [], at: 2 },
      { type: 'plan', entries: entry('pending') },
    );
    expect(state.items.filter((i) => i.kind === 'plan')).toEqual([
      { kind: 'plan', entries: entry('completed') },
      { kind: 'plan', entries: entry('pending') },
    ]);
  });

  it('tracks permission requests and their resolution in the status', () => {
    const request = {
      id: 'p1',
      toolCall: { id: 'c1', title: 'Write', kind: 'edit' as const },
      options: [{ id: 'ok', label: 'Allow', kind: 'allow_once' as const }],
    };
    let state = run(
      { type: 'local.user', id: 'u1', blocks: [], at: 1 },
      { type: 'local.permission.request', request },
    );
    expect(state.status).toBe('awaiting-permission');
    state = reduce(state, {
      type: 'local.permission.resolve',
      id: 'p1',
      outcome: { outcome: 'selected', optionId: 'ok' },
    });
    expect(state.status).toBe('running');
    expect(state.items.at(-1)).toMatchObject({ resolved: { outcome: 'selected', optionId: 'ok' } });
  });

  it('settles everything when the turn ends and explains unusual stops', () => {
    const request = {
      id: 'p1',
      toolCall: { id: 'c', title: 'x', kind: 'edit' as const },
      options: [],
    };
    const state = run(
      { type: 'local.user', id: 'u1', blocks: [], at: 1 },
      { type: 'message.chunk', role: 'assistant', messageId: 'm1', text: 'a' },
      { type: 'local.permission.request', request },
      { type: 'turn.end', stopReason: 'cancelled' },
    );
    expect(state.status).toBe('idle');
    expect(state.items).toEqual([
      { kind: 'user', id: 'u1', blocks: [], at: 1 },
      { kind: 'assistant', id: 'm1', text: 'a', streaming: false },
      { kind: 'permission', request, resolved: { outcome: 'cancelled' } },
      {
        kind: 'notice',
        id: 'notice-3',
        level: 'info',
        notice: { key: 'turnStopped', stopReason: 'cancelled' },
      },
    ]);
  });

  it('marks the session as errored only for unrecoverable errors', () => {
    const recoverable = run({ type: 'error', message: 'oops', recoverable: true });
    expect(recoverable.status).toBe('idle');
    const fatal = run(
      { type: 'error', message: 'dead', recoverable: false, detail: 'stderr' },
      { type: 'turn.end', stopReason: 'error' },
    );
    expect(fatal.status).toBe('error');
    expect(fatal.items).toEqual([
      {
        kind: 'notice',
        id: 'notice-0',
        level: 'error',
        notice: { key: 'agentError', message: 'dead', detail: 'stderr' },
      },
    ]);
  });

  it('applies session info, config, mode and partial usage reports', () => {
    const configOptions = [
      { id: 'mode', name: 'Mode', category: 'mode', currentValue: 'manual', options: [] },
    ];
    const state: SessionViewState = run(
      { type: 'session.ready', nativeSessionId: 'n1', configOptions },
      { type: 'mode', currentModeId: 'auto' },
      { type: 'usage', usage: { contextUsed: 10, contextSize: 100 } },
      { type: 'usage', usage: { contextUsed: 20, costUsd: undefined } },
      { type: 'commands', commands: [{ name: 'review' }] },
    );
    expect(state.nativeSessionId).toBe('n1');
    expect(state.currentModeId).toBe('auto');
    expect(state.configOptions[0]?.currentValue).toBe('auto');
    expect(state.usage).toEqual({ contextUsed: 20, contextSize: 100 });
    expect(state.commands).toEqual([{ name: 'review' }]);
  });

  it('turns denied permissions into warnings', () => {
    expect(run({ type: 'permission.denied', toolName: 'Write' }).items).toEqual([
      {
        kind: 'notice',
        id: 'notice-0',
        level: 'warning',
        notice: { key: 'permissionDenied', toolName: 'Write' },
      },
    ]);
  });
});

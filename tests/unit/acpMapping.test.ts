import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AcpUpdateMapper,
  mapConfigOptions,
  mapPermissionRequest,
} from '../../src/adapters/acp/mapping';
import type { AgentEvent } from '../../src/core/types';

/** Replays every `session/update` of a recorded S2 fixture through the mapper. */
function replay(agent: string): AgentEvent[] {
  const mapper = new AcpUpdateMapper();
  const lines = readFileSync(`tests/fixtures/acp/${agent}/basic.jsonl`, 'utf8').trim().split('\n');
  const events = lines.flatMap((line) => {
    const { msg } = JSON.parse(line) as { msg: { method?: string; params?: { update?: unknown } } };
    return msg.method === 'session/update' ? mapper.map(msg.params?.update) : [];
  });
  return [...events, ...mapper.endTurn()];
}

const ofType = <T extends AgentEvent['type']>(events: AgentEvent[], type: T) =>
  events.filter((e): e is Extract<AgentEvent, { type: T }> => e.type === type);

describe('AcpUpdateMapper with recorded fixtures', () => {
  it('maps Claude: message chunks, tool call completed by updates, context usage', () => {
    const events = replay('claude');
    const text = ofType(events, 'message.chunk')
      .map((e) => e.text)
      .join('');
    expect(text).toContain('resumen');

    const read = ofType(events, 'tool.call').find((e) => e.call.kind === 'read');
    expect(read?.call.rawInput).toEqual({});
    const readUpdates = ofType(events, 'tool.update').filter((e) => e.id === read?.call.id);
    expect(readUpdates.some((e) => e.patch.title === 'Read Notas/Ideas.md')).toBe(true);
    expect(readUpdates.some((e) => e.patch.status === 'completed')).toBe(true);

    const usage = ofType(events, 'usage')[0]?.usage;
    expect(usage?.contextSize).toBeGreaterThan(0);
    expect(ofType(events, 'commands')[0]?.commands.length).toBeGreaterThan(0);
  });

  it('maps Codex: thoughts, diff content and terminal output from _meta', () => {
    const events = replay('codex');
    expect(ofType(events, 'thought.chunk').length).toBeGreaterThan(0);

    const diff = ofType(events, 'tool.call')
      .flatMap((e) => e.call.content ?? [])
      .find((c) => c.type === 'diff');
    expect(diff).toMatchObject({ type: 'diff', path: '/VAULT/resumen.md', oldText: null });

    const terminal = ofType(events, 'tool.update')
      .flatMap((e) => e.patch.content ?? [])
      .find((c) => c.type === 'terminal' && c.output.includes('ABSENT'));
    expect(terminal).toEqual({ type: 'terminal', output: 'ABSENT\n', exitCode: 0 });

    expect(ofType(events, 'debug').some((e) => e.line.includes('session_info_update'))).toBe(true);
  });

  it('maps OpenCode: tool updates fill in title and input, cost is in USD', () => {
    const events = replay('opencode');
    const write = ofType(events, 'tool.update').find(
      (e) =>
        (e.patch.rawInput as { filePath?: string } | undefined)?.filePath === '/VAULT/resumen.md',
    );
    expect(write?.patch.kind).toBe('edit');
    expect(ofType(events, 'usage')[0]?.usage.costUsd).toBe(0);
  });

  it('closes every message it opens', () => {
    for (const agent of ['claude', 'codex', 'opencode']) {
      const events = replay(agent);
      const opened = new Set(
        events.flatMap((e) =>
          e.type === 'message.chunk' && e.role === 'assistant'
            ? [e.messageId]
            : e.type === 'thought.chunk'
              ? [e.messageId]
              : [],
        ),
      );
      const closed = new Set(ofType(events, 'message.end').map((e) => e.messageId));
      expect(closed).toEqual(opened);
    }
  });
});

describe('AcpUpdateMapper edge cases', () => {
  it('generates ids when the agent sends none and keeps them per message', () => {
    const mapper = new AcpUpdateMapper();
    const chunk = (text: string) => ({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text },
    });
    const [a] = mapper.map(chunk('ho'));
    const [b] = mapper.map(chunk('la'));
    expect(a).toMatchObject({ type: 'message.chunk', text: 'ho' });
    expect(b).toMatchObject({ messageId: (a as { messageId: string }).messageId, text: 'la' });
    expect(
      mapper.map({ sessionUpdate: 'tool_call', toolCallId: 't', title: 'x', kind: 'weird' }),
    ).toEqual([
      { type: 'message.end', messageId: (a as { messageId: string }).messageId },
      { type: 'tool.call', call: { id: 't', title: 'x', kind: 'other', status: 'pending' } },
    ]);
  });

  it('ignores junk and turns unknown kinds into debug events', () => {
    const mapper = new AcpUpdateMapper();
    expect(mapper.map(null)).toEqual([]);
    expect(mapper.map({ sessionUpdate: 'tool_call_update' })).toEqual([]);
    expect(mapper.map({ sessionUpdate: 'brand_new' })[0]?.type).toBe('debug');
  });
});

describe('mapConfigOptions', () => {
  it('flattens grouped options and skips non-select options', () => {
    expect(
      mapConfigOptions([
        {
          id: 'model',
          name: 'Model',
          category: 'model',
          type: 'select',
          currentValue: 'a',
          options: [
            { group: 'g', name: 'G', options: [{ value: 'a', name: 'A' }] },
            { value: 'b' },
          ],
        },
        { id: 'flag', type: 'boolean', currentValue: true },
      ]),
    ).toEqual([
      {
        id: 'model',
        name: 'Model',
        description: undefined,
        category: 'model',
        currentValue: 'a',
        options: [
          { value: 'a', name: 'A', description: undefined },
          { value: 'b', name: 'b', description: undefined },
        ],
      },
    ]);
  });
});

describe('mapPermissionRequest', () => {
  it('keeps known option kinds and the tool call summary', () => {
    const request = mapPermissionRequest(
      {
        toolCall: { toolCallId: 'c1', title: 'Write resumen.md', kind: 'edit' },
        options: [
          { optionId: 'a', name: 'Allow', kind: 'allow_once' },
          { optionId: 'x', name: 'Odd', kind: 'something' },
        ],
      },
      'req-1',
    );
    expect(request).toEqual({
      id: 'req-1',
      toolCall: {
        id: 'c1',
        title: 'Write resumen.md',
        kind: 'edit',
        rawInput: undefined,
        locations: undefined,
      },
      options: [{ id: 'a', label: 'Allow', kind: 'allow_once' }],
    });
  });
});

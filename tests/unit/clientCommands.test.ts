import { describe, expect, it } from 'vitest';
import {
  clientCommands,
  matchOptionValue,
  parseClientCommand,
} from '../../src/core/clientCommands';
import type { ConfigOption } from '../../src/core/types';

const model: ConfigOption = {
  id: 'model',
  name: 'Model',
  category: 'model',
  currentValue: 'sonnet',
  options: [
    { value: 'sonnet', name: 'Sonnet' },
    { value: 'opus', name: 'Opus' },
    { value: 'opus-1m', name: 'Opus (1M context)' },
  ],
};

describe('clientCommands (ADR-038)', () => {
  it('offers new/clear/export/help always, resume with history and model/mode with an option', () => {
    expect(clientCommands([], [], false).map((c) => c.name)).toEqual([
      'new',
      'clear',
      'export',
      'help',
    ]);
    expect(clientCommands([], [model], true).map((c) => c.name)).toEqual([
      'new',
      'clear',
      'resume',
      'export',
      'help',
      'model',
    ]);
  });

  it('leaves a name the agent announces to the agent', () => {
    const names = clientCommands([{ name: 'clear' }], [model], true).map((c) => c.name);
    expect(names).not.toContain('clear');
    expect(names).toContain('new');
  });

  it('keeps the menus when the agent announces them, marked as shared (ADR-039)', () => {
    const [shared] = clientCommands([{ name: 'model' }], [model], true).filter(
      (c) => c.id === 'model',
    );
    expect(shared).toEqual({ id: 'model', name: 'model', sharedWithAgent: true });
  });

  it('offers /skills only when the agent announces $ skills', () => {
    expect(clientCommands([{ name: 'review' }], [], false).map((c) => c.id)).not.toContain(
      'skills',
    );
    expect(
      clientCommands([{ name: 'skills' }, { name: '$anatomy' }], [], false).find(
        (c) => c.id === 'skills',
      ),
    ).toEqual({ id: 'skills', name: 'skills', sharedWithAgent: true });
  });
});

describe('parseClientCommand', () => {
  const available = clientCommands([], [model], true);

  it('recognizes /name with optional arguments', () => {
    expect(parseClientCommand('/new', available)?.command.id).toBe('new');
    expect(parseClientCommand('/clear', available)?.command.id).toBe('new');
    expect(parseClientCommand('  /model  opus ', available)).toEqual({
      command: { id: 'model', name: 'model' },
      args: 'opus',
    });
  });

  it('lets everything else through to the agent', () => {
    expect(parseClientCommand('/review', available)).toBeNull();
    expect(parseClientCommand('hola /new', available)).toBeNull();
    expect(parseClientCommand('/newer', available)).toBeNull();
  });

  it('sends a shared menu command with arguments to the agent', () => {
    const shared = clientCommands([{ name: 'model' }], [model], true);
    expect(parseClientCommand('/model', shared)?.command.id).toBe('model');
    expect(parseClientCommand('/model opus', shared)).toBeNull();
  });
});

describe('matchOptionValue', () => {
  it('matches the id or name exactly, or a single partial match', () => {
    expect(matchOptionValue(model, 'Opus')).toBe('opus');
    expect(matchOptionValue(model, 'son')).toBe('sonnet');
    expect(matchOptionValue(model, '1m')).toBe('opus-1m');
    expect(matchOptionValue(model, 'op')).toBeNull();
    expect(matchOptionValue(model, 'haiku')).toBeNull();
  });
});

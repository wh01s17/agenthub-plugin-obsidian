import { describe, expect, it } from 'vitest';
import {
  AGENT_PRESETS,
  defaultSettings,
  migrate,
  newCustomAgent,
  renderInstructions,
} from '../../src/settings/settings';
import {
  describeDetection,
  tildePath,
  formatPairs,
  parsePairs,
  toLines,
} from '../../src/settings/SettingsTab';

describe('migrate', () => {
  it('returns defaults for empty or invalid data', () => {
    expect(migrate(undefined)).toEqual(defaultSettings());
    expect(migrate('garbage')).toEqual(defaultSettings());
  });

  it('keeps valid fields and resets only the invalid ones', () => {
    const settings = migrate({ ...defaultSettings(), sendWith: 'mod-enter', showThoughts: 'yes' });
    expect(settings.sendWith).toBe('mod-enter');
    expect(settings.showThoughts).toBe(false);
  });

  it('adds history defaults when migrating settings from before T4.1', () => {
    const { historyEnabled: _enabled, maxSessions: _max, ...old } = defaultSettings();
    expect(migrate(old)).toMatchObject({ historyEnabled: true, maxSessions: 200 });
  });

  it('preserves disabled history and rejects invalid retention values', () => {
    expect(migrate({ historyEnabled: false, maxSessions: 10 })).toMatchObject({
      historyEnabled: false,
      maxSessions: 10,
    });
    for (const maxSessions of [0, -1, 1.5, '200', Infinity, 10001]) {
      expect(migrate({ maxSessions }).maxSessions).toBe(200);
    }
  });

  it('drops invalid agents and adds presets from newer versions as disabled', () => {
    const custom = newCustomAgent([], (n) => `Custom ${n}`);
    const settings = migrate({
      ...defaultSettings(),
      agents: [AGENT_PRESETS[0], { id: 'broken' }, { ...custom, command: 'my-agent' }],
    });
    expect(settings.agents.map((a) => a.id)).toEqual([
      'claude-acp',
      'custom-1',
      'codex-acp',
      'opencode',
      'gemini',
    ]);
    expect(settings.agents.find((a) => a.id === 'codex-acp')?.enabled).toBe(false);
  });

  it('repairs a default agent that no longer exists', () => {
    const settings = migrate({ ...defaultSettings(), defaultAgentId: 'gone' });
    expect(settings.defaultAgentId).toBe('claude-acp');
  });

  it('ships Gemini disabled and pins adapter versions', () => {
    const presets = Object.fromEntries(AGENT_PRESETS.map((p) => [p.id, p]));
    expect(presets.gemini?.enabled).toBe(false);
    expect(presets['claude-acp']?.args.join(' ')).toMatch(/claude-agent-acp@\d+\.\d+\.\d+$/);
    expect(presets['codex-acp']?.args.join(' ')).toMatch(/codex-acp@\d+\.\d+\.\d+$/);
  });
});

describe('newCustomAgent', () => {
  it('picks the next free id', () => {
    const agent = newCustomAgent(['custom-1', 'custom-2'], (n) => `Agente ${n}`);
    expect(agent).toMatchObject({
      id: 'custom-3',
      label: 'Agente 3',
      enabled: false,
      builtin: false,
    });
  });
});

describe('renderInstructions', () => {
  it('replaces the config folder placeholder', () => {
    expect(renderInstructions('No toques {{configDir}}/', { configDir: '.obs' })).toBe(
      'No toques .obs/',
    );
  });
});

describe('settings tab helpers', () => {
  it('parses lines and KEY=value pairs', () => {
    expect(toLines(' a \n\n b ')).toEqual(['a', 'b']);
    expect(parsePairs('A=1\nB = x=y\nnope\n=bad')).toEqual({ A: '1', B: 'x=y' });
    expect(formatPairs({ A: '1', B: '2' })).toBe('A=1\nB=2');
  });

  it('shortens paths in the home folder with a tilde', () => {
    expect(tildePath('/home/me/.local/bin/npx', '/home/me')).toBe('~/.local/bin/npx');
    expect(tildePath('/home/me', '/home/me/')).toBe('~');
    expect(tildePath('/home/meow/bin', '/home/me')).toBe('/home/meow/bin');
    expect(tildePath('C:\\Users\\me\\npx.cmd', 'C:\\Users\\me')).toBe('~\\npx.cmd');
    expect(tildePath('/usr/bin/x', undefined)).toBe('/usr/bin/x');
  });

  it('describes detection results', () => {
    expect(describeDetection({ status: 'available', resolvedCommand: '/bin/x' })).toBe(
      'Available: /bin/x',
    );
    expect(describeDetection({ status: 'missing', message: 'Install it' })).toBe(
      'Not found. Install it',
    );
  });
});

describe('working directory modes (T3.7)', () => {
  it('accepts the active-note-folder mode and rejects unknown ones', () => {
    expect(migrate({ ...defaultSettings(), cwdMode: 'active-note-folder' }).cwdMode).toBe(
      'active-note-folder',
    );
    expect(migrate({ ...defaultSettings(), cwdMode: 'elsewhere' }).cwdMode).toBe('vault');
  });
});

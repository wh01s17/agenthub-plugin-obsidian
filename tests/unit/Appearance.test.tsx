import { fireEvent, render, screen } from '@testing-library/preact';
import type { App as ObsidianApp } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigOption, PermissionRequest } from '../../src/core/types';
import { defaultSettings, migrate } from '../../src/settings/settings';
import { App, appearanceAttributes } from '../../src/ui/App';
import { Composer } from '../../src/ui/components/Composer';
import { ConfigOptions } from '../../src/ui/components/ConfigOptions';
import { Header } from '../../src/ui/components/Header';
import { MessageList } from '../../src/ui/components/MessageList';
import { isLevelOption, optionIcon } from '../../src/ui/components/OptionPicker';
import { PermissionCard } from '../../src/ui/components/PermissionCard';
import { StatusBar } from '../../src/ui/components/StatusBar';
import { AGENT_PRESETS } from '../../src/settings/settings';
import { makeViewHost } from '../helpers/viewHost';

const modeOption: ConfigOption = {
  id: 'mode',
  name: 'Mode',
  category: 'mode',
  currentValue: 'default',
  options: [
    { value: 'default', name: 'Manual' },
    { value: 'plan', name: 'Plan' },
  ],
};

describe('appearance settings (ADR-032)', () => {
  it('migrates field by field: invalid values fall back, older data gets the defaults', () => {
    const defaults = defaultSettings();
    const settings = migrate({ ...defaults, messageStyle: 'cards', density: 'cozy', showUsage: 0 });
    expect(settings.messageStyle).toBe('cards');
    expect(settings.density).toBe(defaults.density);
    expect(settings.showUsage).toBe(true);

    const {
      messageStyle: _style,
      chatFontSize: _size,
      optionsPlacement: _placement,
      ...older
    } = defaults;
    expect(migrate(older)).toEqual(defaults);
  });

  it('exposes the appearance on the view root as data attributes', () => {
    const { host, sessions } = makeViewHost(() => 'end_turn', {
      messageStyle: 'plain',
      density: 'compact',
      chatFontSize: 'large',
      accentColor: 'theme',
    });
    const { container } = render(
      <App
        host={host}
        session={sessions.create('claude-acp') ?? null}
        onAgentChange={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );
    const root = container.querySelector('.agenthub-app');
    expect(root?.getAttribute('data-message-style')).toBe('plain');
    expect(root?.getAttribute('data-density')).toBe('compact');
    expect(root?.getAttribute('data-font-size')).toBe('large');
    expect(root?.getAttribute('data-accent')).toBe('theme');
    expect(appearanceAttributes(defaultSettings())['data-message-style']).toBe('bubbles');
  });

  it('moves the agent options from the header into pills in the message box', () => {
    const onChange = vi.fn();
    const { container } = render(
      <>
        <Header
          agents={AGENT_PRESETS}
          agentId="claude-acp"
          configOptions={[modeOption]}
          busy={false}
          showOptions={false}
          onAgentChange={vi.fn()}
          onConfigChange={vi.fn()}
          onNewSession={vi.fn()}
          onOpenSettings={vi.fn()}
        />
        <Composer
          agentLabel="Claude Code"
          busy={false}
          disabled={false}
          sendWith="enter"
          notes={() => []}
          commands={[]}
          onSend={vi.fn()}
          onStop={vi.fn()}
          options={
            <ConfigOptions
              options={[modeOption]}
              busy={false}
              onChange={onChange}
              variant="inline"
            />
          }
        />
      </>,
    );
    expect(container.querySelector('.agenthub-header .agenthub-config')).toBeNull();
    const pill = screen.getByRole('button', { name: 'Mode: Manual' });
    expect(pill.closest('.agenthub-composer')).toBeTruthy();
    expect(pill.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(pill);
    expect(pill.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu', { name: 'Mode' });
    expect(screen.getByRole('menuitemradio', { name: 'Manual' }).getAttribute('aria-checked')).toBe(
      'true',
    );

    // Arrow keys move between choices; Escape closes and returns focus to the pill.
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Plan' }));
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(pill);

    fireEvent.click(pill);
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Plan' }));
    expect(onChange).toHaveBeenCalledWith('mode', 'plan');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('turns two-state options into switch pills with their name', () => {
    const fast: ConfigOption = {
      id: 'fast_mode',
      name: 'Fast mode',
      currentValue: 'off',
      options: [
        { value: 'off', name: 'Off' },
        { value: 'on', name: 'On' },
      ],
    };
    const onChange = vi.fn();
    render(<ConfigOptions options={[fast]} busy={false} onChange={onChange} variant="inline" />);
    const pill = screen.getByRole('button', { name: 'Fast mode' });
    expect(pill.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(pill);
    expect(onChange).toHaveBeenCalledWith('fast_mode', 'on');
    expect(optionIcon(fast)).toBe('zap');
    expect(optionIcon({ ...fast, id: 'collaboration_mode', name: 'Collaboration mode' })).toBe(
      'users',
    );
  });

  it('shows effort-like options as a level meter and flags unrestricted modes', () => {
    const effort: ConfigOption = {
      id: 'reasoning_effort',
      name: 'Reasoning effort',
      currentValue: 'medium',
      options: ['low', 'medium', 'high'].map((value) => ({ value, name: value })),
    };
    const onChange = vi.fn();
    const { container } = render(
      <ConfigOptions
        options={[effort, { ...modeOption, currentValue: 'bypassPermissions' }]}
        busy={false}
        onChange={onChange}
        variant="inline"
      />,
    );
    expect(isLevelOption(effort)).toBe(true);
    expect(
      screen
        .getByRole('button', { name: 'Mode: bypassPermissions' })
        .classList.contains('is-danger'),
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Reasoning effort: medium' }));
    const filled = container.querySelectorAll('.agenthub-meter-step.is-filled');
    expect(filled).toHaveLength(2); // low and medium
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'high' }));
    expect(onChange).toHaveBeenCalledWith('reasoning_effort', 'high');
  });

  it('opens tool call details by default when asked', () => {
    const { container } = render(
      <MessageList
        app={{} as ObsidianApp}
        items={[
          {
            kind: 'tool',
            call: { id: 't1', title: 'Read note.md', kind: 'read', status: 'completed' },
          },
        ]}
        showThoughts={false}
        expandToolCalls
        onPermission={vi.fn()}
        onOpenPath={() => false}
      />,
    );
    expect(container.querySelector<HTMLDetailsElement>('details.agenthub-tool')?.open).toBe(true);
  });

  it('hides usage badges when usage is turned off', () => {
    const usage = { contextUsed: 50, contextSize: 100, costUsd: 0.5 };
    const { rerender } = render(<StatusBar status="idle" usage={usage} />);
    expect(screen.getByText('Context 50%')).toBeTruthy();
    rerender(<StatusBar status="idle" usage={usage} showUsage={false} />);
    expect(screen.queryByText('Context 50%')).toBeNull();
    expect(screen.queryByText(/\$0\.50/)).toBeNull();
  });

  it('keeps one primary permission action and marks rejections as destructive', () => {
    const request: PermissionRequest = {
      id: 'p1',
      toolCall: { id: 't1', title: 'Write note.md', kind: 'edit' },
      options: [
        { id: 'once', label: 'Allow once', kind: 'allow_once' },
        { id: 'always', label: 'Always allow', kind: 'allow_always' },
        { id: 'no', label: 'Reject', kind: 'reject_once' },
      ],
    };
    render(<PermissionCard request={request} onAnswer={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Allow once' }).className).toBe('mod-cta');
    expect(screen.getByRole('button', { name: 'Always allow' }).className).toBe('agenthub-button');
    expect(screen.getByRole('button', { name: 'Reject' }).className).toBe(
      'agenthub-button is-danger',
    );
  });
});

import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { Header } from '../../src/ui/components/Header';
import { NoticeItem } from '../../src/ui/components/NoticeItem';
import { AGENT_PRESETS } from '../../src/settings/settings';

const modeOption = {
  id: 'mode',
  name: 'Mode',
  category: 'mode',
  currentValue: 'default',
  options: [
    { value: 'default', name: 'Manual' },
    { value: 'plan', name: 'Plan' },
  ],
};

function renderHeader(busy = false) {
  const handlers = {
    onAgentChange: vi.fn(),
    onConfigChange: vi.fn(),
    onNewSession: vi.fn(),
    onOpenSettings: vi.fn(),
  };
  render(
    <Header
      agents={AGENT_PRESETS.filter((a) => a.enabled)}
      agentId="claude-acp"
      configOptions={[modeOption]}
      busy={busy}
      {...handlers}
    />,
  );
  return handlers;
}

describe('Header (T2.9)', () => {
  it('announces an unrestricted mode with text as well as a warning style', () => {
    render(
      <Header
        agents={AGENT_PRESETS}
        agentId="codex-acp"
        configOptions={[{ ...modeOption, currentValue: 'agent-full-access' }]}
        busy={false}
        onAgentChange={vi.fn()}
        onConfigChange={vi.fn()}
        onNewSession={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByRole('status').textContent).toBe('Unrestricted mode: agent-full-access');
  });
  it('exposes the agent and its config options as labelled selects', () => {
    const handlers = renderHeader();
    fireEvent.change(screen.getByRole('combobox', { name: 'Mode' }), { target: { value: 'plan' } });
    expect(handlers.onConfigChange).toHaveBeenCalledWith('mode', 'plan');

    fireEvent.change(screen.getByRole('combobox', { name: 'Agent' }), {
      target: { value: 'codex-acp' },
    });
    expect(handlers.onAgentChange).toHaveBeenCalledWith('codex-acp');

    fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    expect(handlers.onNewSession).toHaveBeenCalled();
  });

  it('locks selectors while the agent is working', () => {
    renderHeader(true);
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Mode' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'New session' }).disabled).toBe(
      true,
    );
  });
});

describe('NoticeItem (T2.10)', () => {
  it('shows agent errors with the hint and the stderr details as an alert', () => {
    render(
      <NoticeItem
        level="error"
        notice={{
          key: 'agentError',
          message: 'The agent needs you to log in.',
          hint: 'Log in by running `codex login` in a terminal.',
          detail: 'stderr tail',
        }}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('The agent needs you to log in.');
    expect(screen.getByText('Log in by running `codex login` in a terminal.')).toBeTruthy();
    expect(screen.getByText('stderr tail')).toBeTruthy();
  });

  it('translates structured notices', () => {
    render(<NoticeItem level="warning" notice={{ key: 'permissionDenied', toolName: 'Write' }} />);
    expect(screen.getByText('Write was not allowed to run.')).toBeTruthy();
  });
});

describe('agent errors are explained by kind (T6.2)', () => {
  it('uses translated text for known kinds and the agent message otherwise', () => {
    render(
      <NoticeItem
        level="error"
        notice={{ key: 'agentError', kind: 'crash', message: 'raw english text' }}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain(
      'The agent process stopped unexpectedly.',
    );
    expect(screen.queryByText('raw english text')).toBeNull();
  });
});

describe('animated status dots', () => {
  it('animates the dots while working but keeps the plain text for screen readers', async () => {
    const { StatusBar } = await import('../../src/ui/components/StatusBar');
    const { container } = render(<StatusBar status="running" />);
    expect(screen.getByRole('status').textContent).toContain('Working…');
    expect(container.querySelectorAll('.agenthub-dots > span')).toHaveLength(3);
    expect(
      container.querySelector('.agenthub-dots')?.closest('[aria-hidden="true"]'),
    ).not.toBeNull();
  });

  it('shows plain text when idle', async () => {
    const { StatusBar } = await import('../../src/ui/components/StatusBar');
    const { container } = render(<StatusBar status="idle" />);
    expect(screen.getByRole('status').textContent).toBe('Ready');
    expect(container.querySelector('.agenthub-dots')).toBeNull();
  });
});

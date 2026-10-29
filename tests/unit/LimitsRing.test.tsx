import { act, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/ui/App';
import { LimitsRing, ROTATE_MS } from '../../src/ui/components/LimitsRing';
import { makeViewHost } from '../helpers/viewHost';

const limits = {
  fiveHour: { usedPercent: 22.4 },
  weekly: { usedPercent: 80 },
};

afterEach(() => vi.useRealTimers());

describe('LimitsRing (ADR-040)', () => {
  it('shows 5h first, then the week every 7 seconds, with both in the tooltip', () => {
    vi.useFakeTimers();
    const { container } = render(<LimitsRing limits={limits} />);
    const ring = screen.getByRole('img');
    expect(ring.textContent).toBe('5h');
    const detail = '5-hour limit: 22% used\nWeekly limit: 80% used';
    expect(ring.getAttribute('aria-label')).toBe(detail);
    expect(ring.getAttribute('title')).toBe(detail);
    void act(() => {
      vi.advanceTimersByTime(ROTATE_MS);
    });
    expect(screen.getByRole('img').textContent).toBe('w');
    // Over 75% the ring warns.
    expect(container.querySelector('.agenthub-limits')?.className).toContain('is-warning');
    void act(() => {
      vi.advanceTimersByTime(ROTATE_MS);
    });
    expect(screen.getByRole('img').textContent).toBe('5h');
  });

  it('stays on the only window it has and adds the reset time', () => {
    vi.useFakeTimers();
    render(
      <LimitsRing limits={{ weekly: { usedPercent: 5, resetsAt: Date.UTC(2026, 10, 2, 13) } }} />,
    );
    void act(() => {
      vi.advanceTimersByTime(ROTATE_MS * 3);
    });
    const ring = screen.getByRole('img');
    expect(ring.textContent).toBe('w');
    expect(ring.getAttribute('aria-label')).toMatch(/^Weekly limit: 5% used · resets /);
  });
});

describe('limits in the message box', () => {
  async function setup(showUsage: boolean) {
    const { host, sessions, adapter } = makeViewHost(() => 'end_turn', { showUsage });
    const session = sessions.create('claude-acp') ?? null;
    void session?.prepare();
    render(<App host={host} session={session} onAgentChange={vi.fn()} onNewSession={vi.fn()} />);
    await waitFor(() => expect(adapter.sessions).toHaveLength(1));
    await act(() => adapter.sessions[0]?.push({ type: 'limits', limits }));
  }

  it('shows the ring next to the options when the agent reports limits', async () => {
    await setup(true);
    expect(screen.getByRole('img', { name: /5-hour limit: 22% used/ })).toBeTruthy();
  });

  it('hides it when usage is turned off', async () => {
    await setup(false);
    expect(screen.queryByRole('img', { name: /limit/ })).toBeNull();
  });
});

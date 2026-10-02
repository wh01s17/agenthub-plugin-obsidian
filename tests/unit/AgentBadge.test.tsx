import { render } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { AgentBadge } from '../../src/ui/components/AgentBadge';

describe('AgentBadge (ADR-028)', () => {
  it('shows the Claude logo in its original color', () => {
    const { container } = render(<AgentBadge agentId="claude-acp" label="Claude Code" />);
    expect(container.querySelector('svg.agenthub-agent-logo')).not.toBeNull();
    expect(container.querySelector('path')?.getAttribute('fill')).toBe('#D97757');
    expect(container.textContent).toBe('');
  });

  it('gives each logo instance its own gradient ids', () => {
    const { container } = render(
      <div>
        <AgentBadge agentId="codex-acp" label="Codex" />
        <AgentBadge agentId="codex-acp" label="Codex" />
      </div>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ids).size).toBe(ids.length);
    for (const el of container.querySelectorAll('[fill^="url(#"]')) {
      const target = /url\(#(.+)\)/.exec(el.getAttribute('fill') ?? '')?.[1];
      expect(ids).toContain(target);
    }
  });

  it('keeps the colored monogram for custom agents', () => {
    const { container } = render(<AgentBadge agentId="custom-1" label="My agent" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toBe('MA');
  });
});

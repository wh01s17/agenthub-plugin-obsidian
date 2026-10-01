import { describe, expect, it } from 'vitest';
import { agentIdentity } from '../../src/ui/agentIdentity';

describe('agentIdentity', () => {
  it('gives known agents a fixed color and monogram', () => {
    expect(agentIdentity('claude-acp', 'Claude Code')).toEqual({ color: 'orange', monogram: 'C' });
    expect(agentIdentity('codex-acp', 'Codex')).toEqual({ color: 'green', monogram: 'Cx' });
    expect(agentIdentity('gemini', 'Gemini CLI')).toEqual({ color: 'blue', monogram: 'G' });
    expect(agentIdentity('opencode', 'OpenCode')).toEqual({ color: 'purple', monogram: 'O' });
    expect(agentIdentity('claude-native', 'Claude Code (direct)').color).toBe('orange');
  });

  it('gives custom agents a stable color and initials', () => {
    const first = agentIdentity('custom-1', 'My agent');
    expect(first).toEqual(agentIdentity('custom-1', 'My agent'));
    expect(first.monogram).toBe('MA');
    expect(agentIdentity('custom-2', 'goose').monogram).toBe('GO');
  });
});

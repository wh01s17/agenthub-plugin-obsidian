// Per-agent visual identity: a theme color and a monogram (no brand logos; colors come from the
// theme's own palette so they adapt to light/dark and community themes — ADR-018).

import type { LogoKey } from './logos';

export type AgentColor =
  'orange' | 'green' | 'blue' | 'purple' | 'cyan' | 'pink' | 'yellow' | 'red';

export interface AgentIdentity {
  color: AgentColor;
  monogram: string;
  /** Original logo for known agents (ADR-028); custom agents show the monogram. */
  logo?: LogoKey;
}

const KNOWN: { match: RegExp; identity: AgentIdentity }[] = [
  { match: /claude/i, identity: { color: 'orange', monogram: 'C', logo: 'claude' } },
  { match: /codex/i, identity: { color: 'green', monogram: 'Cx', logo: 'codex' } },
  { match: /gemini/i, identity: { color: 'blue', monogram: 'G', logo: 'gemini' } },
  { match: /opencode/i, identity: { color: 'purple', monogram: 'O', logo: 'opencode' } },
];

/** Custom agents get a stable color from their id. */
const FALLBACK: AgentColor[] = [
  'cyan',
  'pink',
  'yellow',
  'red',
  'blue',
  'green',
  'purple',
  'orange',
];

function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

function initials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1 ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}` : label.slice(0, 2);
  return letters.toUpperCase() || '?';
}

export function agentIdentity(agentId: string, label: string): AgentIdentity {
  const known = KNOWN.find(({ match }) => match.test(agentId) || match.test(label));
  if (known) return known.identity;
  return { color: FALLBACK[hash(agentId) % FALLBACK.length] ?? 'cyan', monogram: initials(label) };
}

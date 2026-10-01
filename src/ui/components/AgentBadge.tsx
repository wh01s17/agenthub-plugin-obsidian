import { agentIdentity } from '../agentIdentity';

/** Colored monogram for an agent. Decorative: the agent name is always shown or labelled nearby. */
export function AgentBadge({ agentId, label }: { agentId: string; label: string }) {
  const { color, monogram } = agentIdentity(agentId, label);
  return (
    <span class="agenthub-agent-badge" data-agent-color={color} aria-hidden="true">
      {monogram}
    </span>
  );
}

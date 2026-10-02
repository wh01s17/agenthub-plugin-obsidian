import { h, type VNode } from 'preact';
import { useId } from 'preact/hooks';
import { agentIdentity } from '../agentIdentity';
import { LOGOS, type LogoKey, type SvgNode } from '../logos';

/** Rebuilds an SVG node with gradient ids made unique to this instance (several logos per page). */
function svgNode(node: SvgNode, prefix: string, key: number): VNode {
  const attrs: Record<string, string | number> = { key };
  for (const [name, value] of Object.entries(node.attrs)) {
    attrs[name] = value.replaceAll('lobe-icons-', `${prefix}-lobe-icons-`);
  }
  return h(
    node.tag,
    attrs,
    node.children?.map((child, index) => svgNode(child, prefix, index)),
  );
}

function Logo({ logo }: { logo: LogoKey }) {
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const data = LOGOS[logo];
  return h(
    'svg',
    {
      class: 'agenthub-agent-logo',
      viewBox: data.viewBox,
      fill: data.fill ?? undefined,
      'fill-rule': logo === 'opencode' ? 'evenodd' : undefined,
      'aria-hidden': 'true',
      focusable: 'false',
    },
    data.children.map((child, index) => svgNode(child, prefix, index)),
  );
}

/** The agent's logo in its original colors, or a colored monogram for custom agents (ADR-028). */
export function AgentBadge({ agentId, label }: { agentId: string; label: string }) {
  const { color, monogram, logo } = agentIdentity(agentId, label);
  if (logo) {
    return (
      <span class="agenthub-agent-badge is-logo" aria-hidden="true">
        <Logo logo={logo} />
      </span>
    );
  }
  return (
    <span class="agenthub-agent-badge" data-agent-color={color} aria-hidden="true">
      {monogram}
    </span>
  );
}

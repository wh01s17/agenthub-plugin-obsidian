import type { ConfigOption } from '../../core/types';
import { t } from '../../i18n';
import type { AgentConfig } from '../../settings/settings';
import { AgentBadge } from './AgentBadge';
import { ConfigOptions } from './ConfigOptions';
import { Icon } from './Icon';
import { dangerousModeOptions } from '../../core/permissionModes';

interface HeaderProps {
  agents: readonly AgentConfig[];
  agentId: string;
  configOptions: readonly ConfigOption[];
  busy: boolean;
  onAgentChange: (agentId: string) => void;
  onConfigChange: (id: string, value: string) => void;
  onNewSession: () => void;
  onOpenSettings: () => void;
  /** Shown only when history is enabled. */
  onOpenHistory?: () => void;
  /** False when the options live in the composer instead (ADR-032). */
  showOptions?: boolean;
}

/** Agent selector, the agent's own options (mode, model…: T2.9) and session actions. */
export function Header(props: HeaderProps) {
  const { agents, agentId, configOptions, busy } = props;
  const dangerous = dangerousModeOptions(configOptions);
  return (
    <header class="agenthub-header">
      <div class="agenthub-header-row">
        <AgentBadge
          agentId={agentId}
          label={agents.find((agent) => agent.id === agentId)?.label ?? agentId}
        />
        <select
          class="dropdown agenthub-agent-select"
          aria-label={t('agentLabel')}
          value={agentId}
          disabled={busy}
          onChange={(event) => props.onAgentChange(event.currentTarget.value)}
        >
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          class="clickable-icon agenthub-icon-button"
          aria-label={t('newSession')}
          title={t('newSession')}
          disabled={busy}
          onClick={props.onNewSession}
        >
          <Icon name="square-pen" />
        </button>
        {props.onOpenHistory && (
          <button
            type="button"
            class="clickable-icon agenthub-icon-button"
            aria-label={t('history')}
            title={t('history')}
            onClick={props.onOpenHistory}
          >
            <Icon name="history" />
          </button>
        )}
        <button
          type="button"
          class="clickable-icon agenthub-icon-button"
          aria-label={t('settingsButton')}
          title={t('settingsButton')}
          onClick={props.onOpenSettings}
        >
          <Icon name="settings" />
        </button>
      </div>
      {dangerous.length > 0 && (
        <div class="agenthub-dangerous-mode" role="status">
          <Icon name="shield-alert" />
          <span>
            {t('dangerousModeBadge', {
              mode: dangerous.map((option) => option.currentValue).join(', '),
            })}
          </span>
        </div>
      )}
      {props.showOptions !== false && (
        <ConfigOptions
          options={configOptions}
          busy={busy}
          onChange={props.onConfigChange}
          variant="grid"
        />
      )}
    </header>
  );
}

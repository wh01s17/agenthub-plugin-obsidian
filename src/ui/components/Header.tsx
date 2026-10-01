import type { ConfigOption } from '../../core/types';
import { t } from '../../i18n';
import type { AgentConfig } from '../../settings/settings';
import { Icon } from './Icon';

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
}

/** Agent selector, the agent's own options (mode, model…: T2.9) and session actions. */
export function Header(props: HeaderProps) {
  const { agents, agentId, configOptions, busy } = props;
  return (
    <header class="agenthub-header">
      <div class="agenthub-header-row">
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
      {configOptions.length > 0 && (
        <div class="agenthub-header-row agenthub-config">
          {configOptions.map((option) => (
            <select
              key={option.id}
              class="dropdown agenthub-config-select"
              aria-label={option.name}
              title={option.description ?? option.name}
              value={option.currentValue}
              disabled={busy}
              onChange={(event) => props.onConfigChange(option.id, event.currentTarget.value)}
            >
              {option.options.map((choice) => (
                <option key={choice.value} value={choice.value} title={choice.description}>
                  {choice.name}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}
    </header>
  );
}

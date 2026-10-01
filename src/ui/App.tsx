import type { ChatSession } from '../core/ChatSession';
import { t } from '../i18n';
import { Composer } from './components/Composer';
import { DebugPanel } from './components/DebugPanel';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { StatusBar } from './components/StatusBar';
import { useSessionState } from './hooks';
import type { ViewHost } from './ViewHost';

export interface AppProps {
  host: ViewHost;
  /** `null` when no agent is enabled. */
  session: ChatSession | null;
  onAgentChange: (agentId: string) => void;
  onNewSession: () => void;
}

export function App({ host, session, onAgentChange, onNewSession }: AppProps) {
  if (!session) {
    return (
      <div class="agenthub-app">
        <div class="agenthub-empty" role="status">
          <p class="agenthub-empty-title">{t('noAgentsTitle')}</p>
          <p class="agenthub-empty-body">{t('noAgentsBody')}</p>
          <button type="button" class="mod-cta" onClick={() => host.openSettings()}>
            {t('settingsButton')}
          </button>
        </div>
      </div>
    );
  }
  return (
    <ChatView
      key={session.localId}
      host={host}
      session={session}
      onAgentChange={onAgentChange}
      onNewSession={onNewSession}
    />
  );
}

function ChatView({
  host,
  session,
  onAgentChange,
  onNewSession,
}: AppProps & { session: ChatSession }) {
  const state = useSessionState(session);
  const agentLabel = host.agents.config(state.agentId)?.label ?? state.agentId;
  const busy = session.busy;

  return (
    <div class="agenthub-app" data-session-id={state.localId}>
      <Header
        agents={host.agents.enabled()}
        agentId={state.agentId}
        configOptions={state.configOptions}
        busy={busy}
        onAgentChange={onAgentChange}
        onConfigChange={(id, value) => void session.setConfigOption(id, value)}
        onNewSession={onNewSession}
        onOpenSettings={() => host.openSettings()}
      />
      {state.items.length === 0 ? (
        <div class="agenthub-empty">
          <p class="agenthub-empty-title">{t('welcomeTitle')}</p>
          <p class="agenthub-empty-body">
            {t('welcomeBody', { agent: agentLabel, cwd: host.workingDirectory() })}
          </p>
        </div>
      ) : (
        <MessageList
          app={host.app}
          items={state.items}
          showThoughts={host.settings.showThoughts}
          onPermission={(id, outcome) => session.resolvePermission(id, outcome)}
        />
      )}
      {host.settings.debugPanel && <DebugPanel lines={session.debugLog()} />}
      <StatusBar status={state.status} usage={state.usage} />
      <Composer
        agentLabel={agentLabel}
        busy={busy}
        disabled={state.status === 'closed'}
        sendWith={host.settings.sendWith}
        onSend={(text) => void session.send([{ type: 'text', text }])}
        onStop={() => void session.cancel()}
      />
    </div>
  );
}

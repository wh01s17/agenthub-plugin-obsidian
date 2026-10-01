import { useEffect, useState } from 'preact/hooks';
import type { ChatSession } from '../core/ChatSession';
import {
  buildPrompt,
  extractMentions,
  type NoteRef,
  type SelectionRef,
} from '../core/PromptBuilder';
import { t } from '../i18n';
import { Composer } from './components/Composer';
import { ContextChips } from './components/ContextChips';
import { DebugPanel } from './components/DebugPanel';
import { HistoryPanel } from './components/HistoryPanel';
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
  /** Selection captured by the "Send selection" command, attached to the next message. */
  selection?: SelectionRef | null;
  onClearSelection?: () => void;
  /** Opens a saved session in this view (plan T4.2). */
  onOpenSession?: (localId: string) => void;
  /** Deletes a saved session from the history panel. */
  onDeleteSession?: (localId: string) => Promise<void>;
}

export function App(props: AppProps) {
  const { host, session } = props;
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
  return <ChatView key={session.localId} {...props} session={session} />;
}

/** Resolves the context for one message and sends it (plan §4.8). */
async function sendWithContext(
  host: ViewHost,
  session: ChatSession,
  text: string,
  context: { activeNotePath: string | null; selection: SelectionRef | null },
): Promise<void> {
  const read = (path: string) => host.notes.readNote(path);
  const isNote = (note: NoteRef | null): note is NoteRef => note !== null;
  const [mentions, activeNote] = await Promise.all([
    Promise.all(extractMentions(text).map(read)).then((notes) => notes.filter(isNote)),
    context.activeNotePath ? read(context.activeNotePath) : Promise.resolve(null),
  ]);
  await session.send(
    buildPrompt({
      text,
      mentions,
      activeNote: activeNote ?? undefined,
      selection: context.selection ?? undefined,
    }),
  );
}

function useActiveNotePath(host: ViewHost): string | null {
  const [path, setPath] = useState(() => host.notes.activeNotePath());
  useEffect(
    () => host.notes.onActiveNoteChange(() => setPath(host.notes.activeNotePath())),
    [host],
  );
  return path;
}

function ChatView(props: AppProps & { session: ChatSession }) {
  const { host, session, onAgentChange, onNewSession, selection = null } = props;
  const state = useSessionState(session);
  const agentLabel = host.agents.config(state.agentId)?.label ?? state.agentId;
  const busy = session.busy;
  const activeNotePath = useActiveNotePath(host);
  const [includeActive, setIncludeActive] = useState(host.settings.includeActiveNote);
  const [showHistory, setShowHistory] = useState(false);
  const history = host.history;

  const onSend = (text: string) => {
    const context = { activeNotePath: includeActive ? activeNotePath : null, selection };
    props.onClearSelection?.();
    void sendWithContext(host, session, text, context);
  };

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
        onOpenHistory={history ? () => setShowHistory((open) => !open) : undefined}
      />
      {showHistory && history ? (
        <HistoryPanel
          history={history}
          currentId={state.localId}
          agentLabel={(agentId) => {
            const agent = host.agents.config(agentId);
            return { label: agent?.label ?? agentId, enabled: agent?.enabled ?? false };
          }}
          onOpen={(localId) => {
            setShowHistory(false);
            props.onOpenSession?.(localId);
          }}
          onDelete={(localId) => props.onDeleteSession?.(localId) ?? Promise.resolve()}
          onClose={() => setShowHistory(false)}
        />
      ) : state.items.length === 0 ? (
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
          onOpenPath={(path) => host.notes.openPath(path)}
        />
      )}
      {host.settings.debugPanel && <DebugPanel lines={session.debugLog()} />}
      <StatusBar status={state.status} usage={state.usage} />
      <ContextChips
        activeNotePath={activeNotePath}
        includeActive={includeActive}
        selection={selection}
        onToggleActive={() => setIncludeActive((value) => !value)}
        onRemoveSelection={() => props.onClearSelection?.()}
      />
      <Composer
        agentLabel={agentLabel}
        busy={busy}
        disabled={state.status === 'closed'}
        sendWith={host.settings.sendWith}
        notes={() => host.notes.listNotes()}
        commands={state.commands}
        onSend={onSend}
        onStop={() => void session.cancel()}
      />
    </div>
  );
}

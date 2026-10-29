import { Notice } from 'obsidian';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { ChatSession } from '../core/ChatSession';
import {
  clientCommands,
  matchOptionValue,
  optionFor,
  type ClientCommand,
} from '../core/clientCommands';
import {
  buildPrompt,
  extractMentions,
  type NoteRef,
  type SelectionRef,
} from '../core/PromptBuilder';
import { imageMimeType, MAX_IMAGES_PER_MESSAGE, type ImageBlock } from '../core/images';
import { t } from '../i18n';
import { AgentBadge } from './components/AgentBadge';
import { Composer } from './components/Composer';
import { ConfigOptions, optionName } from './components/ConfigOptions';
import { ContextChips } from './components/ContextChips';
import { DebugPanel } from './components/DebugPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { StatusBar } from './components/StatusBar';
import { agentIdentity } from './agentIdentity';
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
  /** Tab bar shown at the very top, above the header (ADR-033). */
  tabBar?: ComponentChildren;
  /** Tabs the user is not looking at stay mounted (draft, scroll) but hidden. */
  hidden?: boolean;
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
  context: {
    activeNotePath: string | null;
    selection: SelectionRef | null;
    images: ImageBlock[];
  },
): Promise<void> {
  const read = (path: string) => host.notes.readNote(path);
  const isNote = (note: NoteRef | null): note is NoteRef => note !== null;
  // Mentioned images go as images while there is room (ADR-035); the rest of the mentions as files.
  const images = [...context.images];
  const notePaths: string[] = [];
  for (const path of extractMentions(text)) {
    const image =
      imageMimeType(path) && images.length < MAX_IMAGES_PER_MESSAGE
        ? await host.notes.readImage(path)
        : null;
    if (image) images.push(image);
    else notePaths.push(path);
  }
  const [mentions, activeNote] = await Promise.all([
    Promise.all(notePaths.map(read)).then((notes) => notes.filter(isNote)),
    context.activeNotePath ? read(context.activeNotePath) : Promise.resolve(null),
  ]);
  await session.send(
    buildPrompt({
      text,
      images,
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

/** Appearance settings as data attributes; `styles.css` does the rest (ADR-032). */
export function appearanceAttributes(settings: ViewHost['settings']): Record<string, string> {
  return {
    'data-message-style': settings.messageStyle,
    'data-density': settings.density,
    'data-font-size': settings.chatFontSize,
    'data-accent': settings.accentColor,
  };
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
  const { settings } = host;
  const optionsInComposer = settings.optionsPlacement === 'composer';
  const onConfigChange = (id: string, value: string) => void session.setConfigOption(id, value);
  const client = clientCommands(state.commands, state.configOptions, Boolean(history));
  const [openRequest, setOpenRequest] = useState<{ optionId: string; n: number } | null>(null);

  /** Commands AgentHub runs instead of the agent (ADR-038); `/help` stays in the composer. */
  const runClientCommand = (command: ClientCommand, args: string) => {
    if (command.id === 'new') return onNewSession();
    if (command.id === 'resume') return setShowHistory(true);
    if (command.id === 'export') return void host.exportSession(session.getState());
    if (command.id !== 'model' && command.id !== 'mode') return;
    const option = optionFor(state.configOptions, command.id);
    if (!option) return;
    if (!args) return setOpenRequest((last) => ({ optionId: option.id, n: (last?.n ?? 0) + 1 }));
    const value = matchOptionValue(option, args);
    if (value) onConfigChange(option.id, value);
    else new Notice(t('noticeOptionNoMatch', { option: optionName(option), query: args }));
  };

  const onSend = (text: string, images: ImageBlock[]) => {
    const context = { activeNotePath: includeActive ? activeNotePath : null, selection, images };
    props.onClearSelection?.();
    void sendWithContext(host, session, text, context);
  };

  return (
    <div
      class="agenthub-app"
      data-session-id={state.localId}
      hidden={props.hidden}
      data-agent-color={agentIdentity(state.agentId, agentLabel).color}
      {...appearanceAttributes(settings)}
    >
      {props.tabBar}
      <Header
        agents={host.agents.enabled()}
        agentId={state.agentId}
        configOptions={state.configOptions}
        busy={busy}
        onAgentChange={onAgentChange}
        onConfigChange={onConfigChange}
        showOptions={!optionsInComposer}
        openRequest={openRequest}
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
          onRename={(localId, title) => host.sessions.get(localId)?.rename(title)}
          onDelete={(localId) => props.onDeleteSession?.(localId) ?? Promise.resolve()}
          onClose={() => setShowHistory(false)}
        />
      ) : state.items.length === 0 ? (
        <div class="agenthub-empty">
          <AgentBadge agentId={state.agentId} label={agentLabel} />
          <p class="agenthub-empty-title">{t('welcomeTitle')}</p>
          <p class="agenthub-empty-body">
            {t('welcomeBody', { agent: agentLabel, cwd: state.cwd })}
          </p>
        </div>
      ) : (
        <MessageList
          app={host.app}
          items={state.items}
          showThoughts={settings.showThoughts}
          expandToolCalls={settings.expandToolCalls}
          onPermission={(id, outcome) => session.resolvePermission(id, outcome)}
          onOpenPath={(path) => host.notes.openPath(path)}
          pathLabel={(path) => host.notes.displayPath(path)}
          textLabel={(text) => host.notes.displayText(text)}
        />
      )}
      {settings.debugPanel && <DebugPanel lines={session.debugLog()} />}
      <StatusBar status={state.status} usage={state.usage} showUsage={settings.showUsage} />

      <Composer
        agentLabel={agentLabel}
        busy={busy}
        disabled={state.status === 'closed'}
        sendWith={settings.sendWith}
        history={host.prompts}
        notes={() => host.notes.listPaths()}
        commands={state.commands}
        clientCommands={client}
        onClientCommand={runClientCommand}
        onSend={onSend}
        onStop={() => void session.cancel()}
        queue={state.queue}
        queuePaused={state.queuePaused}
        onSendNow={(id) => void session.sendNow(id)}
        onUnqueue={(id) => session.unqueue(id)}
        options={
          optionsInComposer ? (
            <ConfigOptions
              options={state.configOptions}
              busy={busy}
              onChange={onConfigChange}
              variant="inline"
              openRequest={openRequest}
            />
          ) : undefined
        }
      >
        <ContextChips
          activeNotePath={activeNotePath}
          includeActive={includeActive}
          selection={selection}
          onToggleActive={() => setIncludeActive((value) => !value)}
          onRemoveSelection={() => props.onClearSelection?.()}
        />
      </Composer>
    </div>
  );
}

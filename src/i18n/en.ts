export const en = {
  viewTitle: 'AgentHub',
  openView: 'Open AgentHub',
  emptyTitle: 'No session yet',
  emptyBody: 'Agents will appear here once they are connected.',

  // Settings: agents
  settingsAgents: 'Agents',
  settingsDefaultAgent: 'Default agent',
  settingsDefaultAgentDesc: 'Agent used for new sessions.',
  settingsRedetect: 'Detect agents again',
  settingsRedetectDesc: 'Look for agent commands again, e.g. after installing one.',
  settingsRedetectButton: 'Detect',
  settingsAddAgent: 'Add a custom agent',
  settingsAddAgentDesc: 'Any agent that speaks the Agent Client Protocol (ACP) over stdio.',
  settingsAddAgentButton: 'Add agent',
  settingsCustomAgentLabel: 'Custom agent {n}',
  settingsEdit: 'Edit',
  settingsDelete: 'Delete',
  settingsDetecting: 'Detecting…',
  settingsAvailable: 'Available: {path}',
  settingsMissing: 'Not found. {hint}',
  settingsAgentError: 'Unavailable: {message}',
  settingsDisabled: 'Disabled',
  settingsLabel: 'Name',
  settingsCommand: 'Command',
  settingsCommandDesc: 'Program to run, by name or absolute path.',
  settingsArgs: 'Arguments',
  settingsArgsDesc: 'One argument per line.',
  settingsEnv: 'Environment variables',
  settingsEnvDesc:
    'One KEY=value per line. Stored in plain text in the plugin data: avoid secrets.',
  settingsConfig: 'Initial options',
  settingsConfigDesc: 'One option=value per line, e.g. mode=plan. Applied when a session starts.',

  // Settings: sessions
  settingsSessions: 'Sessions',
  settingsHistory: 'Save session history',
  settingsHistoryDesc:
    'Save transcripts in the plugin folder. Vault sync or Git may sync them too. Disabling this keeps existing history.',
  settingsMaxSessions: 'Maximum saved sessions',
  settingsMaxSessionsDesc:
    'Keep the most recently updated sessions (1–10,000). Applied on the next save.',
  historySaveError:
    'AgentHub could not read or save session history. See the developer console for details.',
  settingsCwd: 'Working directory',
  settingsCwdDesc: 'Folder where agents run.',
  settingsCwdVault: 'Vault root',
  settingsCwdCustom: 'Custom folder',
  settingsCustomCwd: 'Custom folder',
  settingsCustomCwdDesc: 'Absolute path.',
  settingsInstructions: 'Vault instructions',
  settingsInstructionsDesc:
    'Sent to the agent with the first message. {{configDir}} is replaced by the Obsidian config folder.',
  settingsSendWith: 'Send message with',
  settingsSendEnter: 'Enter (Shift+Enter for a new line)',
  settingsSendModEnter: 'Ctrl/Cmd+Enter',
  settingsShowThoughts: 'Show agent reasoning',
  settingsShowThoughtsDesc: 'Expand the agent thinking blocks by default.',
  settingsDebug: 'Debug panel',
  settingsDebugDesc: 'Show raw agent output (stderr and unknown messages) in the view.',

  // Settings: environment
  settingsEnvironment: 'Environment',
  settingsLoginShell: 'Use the login shell PATH as a fallback',
  settingsLoginShellDesc:
    'If a command is not found, ask your login shell for its PATH (slower, only when needed).',
  settingsExtraPath: 'Extra PATH folders',
  settingsExtraPathDesc: 'One folder per line, searched before the rest.',

  // Agent hints
  hintInstall: 'Install it with: {command}',
  hintLogin: 'Log in by running `{command}` in a terminal.',
  hintUnsupported: 'The "{transport}" mode is not supported yet.',
  hintNoCommand: 'No command configured.',

  // Chat view
  newSession: 'New session',
  agentLabel: 'Agent',
  settingsButton: 'AgentHub settings',
  noAgentsTitle: 'No agents enabled',
  noAgentsBody: 'Enable or add an agent in the AgentHub settings.',
  welcomeTitle: 'Start a conversation',
  welcomeBody: '{agent} runs in {cwd}.',
  composerLabel: 'Message to the agent',
  composerPlaceholder: 'Message {agent}…',
  send: 'Send',
  stop: 'Stop',
  statusIdle: 'Ready',
  statusStarting: 'Starting the agent…',
  statusRunning: 'Working…',
  statusAwaiting: 'Waiting for your permission',
  statusError: 'The agent stopped',
  statusClosed: 'Session closed',
  contextUsage: 'Context {percent}%',
  costUsd: '${cost}',
  you: 'You',
  thinking: 'Reasoning',
  toolInput: 'Input',
  toolOutput: 'Output',
  toolExitCode: 'Exit code {code}',
  toolNewFile: 'New file',
  toolPending: 'Pending',
  toolRunning: 'Running',
  toolCompleted: 'Completed',
  toolFailed: 'Failed',
  permissionTitle: 'Permission requested',
  permissionAnswered: 'Answered: {option}',
  permissionCancelled: 'Cancelled',
  planTitle: 'Plan',
  noticePermissionDenied: '{tool} was not allowed to run.',
  noticeCancelled: 'Stopped.',
  noticeMaxTokens: 'The reply hit the length limit.',
  noticeMaxTurns: 'The agent reached its step limit.',
  noticeRefusal: 'The agent declined to continue.',
  noticeErrorDetail: 'Details',
  debugTitle: 'Debug output',
  debugEmpty: 'No output yet.',
  configLabel: '{name}',

  // Obsidian context (Fase 3)
  settingsIncludeActive: 'Include the current note',
  settingsIncludeActiveDesc: 'Attach the note you are working on to each message by default.',
  chipActiveNote: 'Current note: {name}',
  chipActiveNoteOff: 'Current note not included: {name}',
  chipToggleActive: 'Include the current note',
  chipSelection: 'Selection: {name} (lines {from}–{to})',
  chipRemove: 'Remove',
  attachedNote: 'Note: {path}',
  attachedSelection: 'Selection: {path} ({from}–{to})',
  cmdSendSelection: 'Send selection to AgentHub',
  cmdAskAboutNote: 'Ask AgentHub about the current note',
  cmdNewSession: 'Start a new AgentHub session',
  cmdStop: 'Stop the current AgentHub turn',
  suggestNotes: 'Notes',
  suggestCommands: 'Agent commands',
  openFile: 'Open {path}',

  // History (Fase 4)
  noticeContextNotRestored:
    'The agent could not continue the previous conversation; it starts with a fresh context.',
  history: 'Session history',
  historySearch: 'Search sessions',
  historyEmpty: 'No saved sessions yet.',
  historyBack: 'Back to the conversation',
  historyOpen: 'Open "{title}"',
  historyRename: 'Rename',
  historyDelete: 'Delete',
  historyConfirmDelete: 'Confirm delete',
  historyUntitled: 'Untitled session',
  historyAgentMissing: '{agent} (not enabled)',
  historyCurrent: 'Current',

  // Export (T4.4)
  cmdExportSession: 'Export the AgentHub session to a note',
  exportDone: 'Session exported to {path}',
  exportEmpty: 'This session has no messages to export.',
  settingsExportFolder: 'Export folder',
  settingsExportFolderDesc: 'Vault folder where exported sessions are saved.',
  exportButton: 'Export to note',

  // Sessions (T4.5)
  settingsIdleTimeout: 'Stop idle agents after (minutes)',
  settingsIdleTimeoutDesc:
    'Frees the agent process when a session is unused. The conversation continues when you write again. 0 = never.',
  cmdOpenNewView: 'Open AgentHub in a new pane',

  // Diffs (T6.1)
  diffAdded: 'Added: ',
  diffRemoved: 'Removed: ',

  // Agent errors (T6.2)
  errorMissingBinary: 'The agent command was not found.',
  errorAuth: 'The agent needs you to log in.',
  errorStartup: 'The agent did not respond in time.',
  errorCrash: 'The agent process stopped unexpectedly.',

  // Performance (T6.4)
  showEarlier: 'Show {count} earlier messages',
};

export type Messages = typeof en;

import { render } from 'preact';
import type { DangerousModeRequest } from '../core/permissionModes';
import { t } from '../i18n';

export function DangerousModeDialog({
  agent,
  value,
  session,
  titleId,
  descriptionId,
  onDecision,
}: {
  agent: string;
  value: string;
  /** Title of the session (tab) asking; omitted while it has none. */
  session?: string;
  titleId: string;
  descriptionId: string;
  onDecision: (allowed: boolean) => void;
}) {
  return (
    <div class="agenthub-mode-dialog-content">
      <h2 id={titleId}>{t('dangerousModeTitle')}</h2>
      <p id={descriptionId}>{t('dangerousModeDescription', { agent, mode: value })}</p>
      {session && (
        <p class="agenthub-mode-dialog-session">{t('dangerousModeSession', { title: session })}</p>
      )}
      <div class="agenthub-mode-dialog-actions">
        <button type="button" onClick={() => onDecision(false)}>
          {t('dangerousModeCancel')}
        </button>
        <button type="button" class="mod-warning" onClick={() => onDecision(true)}>
          {t('dangerousModeEnable')}
        </button>
      </div>
    </div>
  );
}

/** Native modal dialog traps focus, supports Escape, and cancels when its session closes. */
export function confirmDangerousMode(
  doc: Document,
  request: DangerousModeRequest,
  agent: string,
  signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const dialog = doc.body.createEl('dialog', { cls: 'agenthub-mode-dialog' });
    const id = `agenthub-mode-${crypto.randomUUID()}`;
    dialog.setAttribute('aria-labelledby', `${id}-title`);
    dialog.setAttribute('aria-describedby', `${id}-description`);
    const previous = doc.activeElement;
    let finished = false;
    const finish = (allowed: boolean) => {
      if (finished) return;
      finished = true;
      signal.removeEventListener('abort', abort);
      dialog.removeEventListener('cancel', cancel);
      dialog.removeEventListener('close', abort);
      if (dialog.open) dialog.close();
      render(null, dialog);
      dialog.remove();
      resolve(allowed);
      // The session unlocks its selects after resolving; restore focus after that render.
      doc.defaultView?.setTimeout(() => {
        if (previous instanceof doc.defaultView!.HTMLElement && previous.isConnected)
          previous.focus();
      }, 0);
    };
    const abort = () => finish(false);
    const cancel = (event: Event) => {
      event.preventDefault();
      finish(false);
    };
    signal.addEventListener('abort', abort, { once: true });
    dialog.addEventListener('cancel', cancel);
    dialog.addEventListener('close', abort);
    render(
      <DangerousModeDialog
        agent={agent}
        value={request.value}
        session={request.sessionTitle || undefined}
        titleId={`${id}-title`}
        descriptionId={`${id}-description`}
        onDecision={finish}
      />,
      dialog,
    );
    try {
      dialog.showModal();
    } catch {
      finish(false);
    }
  });
}

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ChatSession } from '../core/ChatSession';
import type { SessionViewState } from '../core/types';

/** Re-renders whenever the session publishes a new snapshot. */
export function useSessionState(session: ChatSession): SessionViewState {
  const [state, setState] = useState(() => session.getState());
  useEffect(() => {
    setState(session.getState());
    const subscription = session.subscribe(setState);
    return () => subscription.dispose();
  }, [session]);
  return state;
}

/**
 * Returns `value`, but while `active` updates it at most every `intervalMs` (plan §4.11:
 * re-rendering Markdown on every streamed chunk is too expensive). The final value always lands.
 */
export function useThrottledValue<T>(value: T, intervalMs: number, active: boolean): T {
  const [shown, setShown] = useState(value);
  const lastUpdate = useRef(0);

  useEffect(() => {
    if (!active) {
      setShown(value);
      return;
    }
    const wait = lastUpdate.current + intervalMs - Date.now();
    if (wait <= 0) {
      lastUpdate.current = Date.now();
      setShown(value);
      return;
    }
    const timer = window.setTimeout(() => {
      lastUpdate.current = Date.now();
      setShown(value);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [value, intervalMs, active]);

  return shown;
}

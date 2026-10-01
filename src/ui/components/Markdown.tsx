import { type App, Component, MarkdownRenderer } from 'obsidian';
import { useEffect, useRef } from 'preact/hooks';
import { useThrottledValue } from '../hooks';

interface MarkdownProps {
  app: App;
  text: string;
  /** While true, re-rendering is throttled (plan §4.11). */
  streaming?: boolean;
  /** Note path that relative links resolve against. */
  sourcePath?: string;
}

const STREAM_THROTTLE_MS = 100;

/**
 * Renders agent output with Obsidian's own Markdown renderer (wikilinks, callouts, code, themes).
 * Agent text is untrusted: it only ever reaches the DOM through the renderer, never `innerHTML`.
 */
export function Markdown({ app, text, streaming = false, sourcePath = '' }: MarkdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useThrottledValue(text, STREAM_THROTTLE_MS, streaming);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const component = new Component();
    component.load();
    el.empty();
    void MarkdownRenderer.render(app, shown, el, sourcePath, component);
    return () => component.unload();
  }, [app, shown, sourcePath]);

  // Internal links ([[note]]) open in Obsidian instead of navigating the view.
  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const link = target.closest('a.internal-link');
    const href = link?.getAttribute('data-href') ?? link?.getAttribute('href');
    if (!href) return;
    event.preventDefault();
    void app.workspace.openLinkText(href, sourcePath, event.ctrlKey || event.metaKey);
  };

  return <div ref={ref} class="agenthub-markdown markdown-rendered" onClick={onClick} />;
}

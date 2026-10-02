import { type App, Component, MarkdownRenderer } from 'obsidian';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { useThrottledValue } from '../hooks';
import { splitBlocks } from '../markdownBlocks';
import { enqueueRender } from '../renderQueue';

interface MarkdownProps {
  app: App;
  text: string;
  /** While true, re-rendering is throttled (plan §4.11). */
  streaming?: boolean;
  /** Note path that relative links resolve against. */
  sourcePath?: string;
}

const STREAM_THROTTLE_MS = 100;

/** One top-level block; Obsidian re-renders it only when its own text changes (spike S5). */
function MarkdownBlock({ app, text, sourcePath }: { app: App; text: string; sourcePath: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const component = new Component();
    const cancel = enqueueRender(() => {
      component.load();
      el.empty();
      void MarkdownRenderer.render(app, text, el, sourcePath, component);
    });
    return () => {
      cancel();
      component.unload();
    };
  }, [app, text, sourcePath]);
  return <div ref={ref} class="agenthub-markdown-block" />;
}

/**
 * Renders agent output with Obsidian's own Markdown renderer (wikilinks, callouts, code, themes),
 * block by block so streaming stays smooth. Agent text is untrusted: it only reaches the DOM through
 * the renderer, never `innerHTML`.
 */
export function Markdown({ app, text, streaming = false, sourcePath = '' }: MarkdownProps) {
  const shown = useThrottledValue(text, STREAM_THROTTLE_MS, streaming);
  const blocks = useMemo(() => splitBlocks(shown), [shown]);

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

  return (
    <div class="agenthub-markdown markdown-rendered" onClick={onClick}>
      {blocks.map((block, index) => (
        // Index keys: earlier blocks never change while streaming, so they keep their DOM.
        <MarkdownBlock key={index} app={app} text={block} sourcePath={sourcePath} />
      ))}
    </div>
  );
}

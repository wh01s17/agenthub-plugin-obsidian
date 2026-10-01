import { setIcon } from 'obsidian';
import { useEffect, useRef } from 'preact/hooks';

/** Obsidian (Lucide) icon. Decorative: screen readers rely on the surrounding text. */
export function Icon({ name, class: className }: { name: string; class?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) setIcon(ref.current, name);
  }, [name]);
  return <span ref={ref} class={`agenthub-icon ${className ?? ''}`} aria-hidden="true" />;
}

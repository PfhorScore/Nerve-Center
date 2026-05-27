import { useRef, useEffect, useLayoutEffect } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';
import { formatElapsed } from '../utils';

interface StreamingMessageProps {
  html: string;
  elapsedMs: number;
  agentName?: string;
}

/**
 * Streaming message display with live content.
 *
 * Uses append-only DOM manipulation during streaming to avoid the
 * janky "nuke-and-rebuild" behaviour of {@code dangerouslySetInnerHTML}
 * on every frame. A ref tracks the already-rendered prefix; only the
 * newly arrived suffix is appended via direct DOM insertion.
 *
 * IMPORTANT: We do NOT use dangerouslySetInnerHTML — React would reset
 * innerHTML to the prop value on every render, fighting our effect and
 * causing flicker/disappear. All DOM writes go through the ref.
 */
export function StreamingMessage({ html, elapsedMs, agentName = 'Agent' }: StreamingMessageProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const prevHtmlRef = useRef('');

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const prev = prevHtmlRef.current;

    // First paint or stream reset (html went backwards/empty) — full replace
    if (!prev || html.length < prev.length || !html.startsWith(prev)) {
      el.innerHTML = sanitizeHtml(html);
      prevHtmlRef.current = html;
      return;
    }

    // No change — skip
    if (html === prev) return;

    // Append-only: new characters arrived, add just the delta
    const delta = html.slice(prev.length);
    const sanitizedDelta = sanitizeHtml(delta);
    const temp = document.createElement('div');
    temp.innerHTML = sanitizedDelta;
    while (temp.firstChild) {
      el.appendChild(temp.firstChild);
    }
    prevHtmlRef.current = html;
  }, [html]);

  // Reset tracker when streaming ends
  useEffect(() => {
    if (!html) prevHtmlRef.current = '';
  }, [html]);

  return (
    <div className="msg msg-assistant streaming relative max-w-full break-words bg-message-assistant">
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="cockpit-badge" data-tone="success">{agentName}</span>
        {elapsedMs > 0 && (
          <span className="ml-auto font-mono text-[0.667rem] tabular-nums text-muted-foreground">{formatElapsed(elapsedMs)}</span>
        )}
      </div>
      <div className="ml-4 border-l-2 border-green/60 px-4 pb-3 pl-6">
        <div
          ref={contentRef}
          className="msg-body whitespace-pre-wrap text-foreground text-[0.867rem]"
        />
      </div>
    </div>
  );
}

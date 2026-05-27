/**
 * ProcessingIndicator — Compact one-line status shown during generation.
 *
 * Replaces the old multi-row version. Shows a single line at the bottom
 * of the chat with the current stage, elapsed time, and an optional
 * description. When stale (no events for >15s), switches to a warning.
 *
 * All content is on ONE line — no stacked rows, no activity log here.
 * Activity log is shown alongside the streaming message instead.
 */

import { useState, useEffect } from 'react';
import type { ProcessingStage } from '@/contexts/ChatContext';
import { formatElapsed } from '../utils';

interface ProcessingIndicatorProps {
  stage?: ProcessingStage;
  elapsedMs: number;
  lastEventTimestamp: number;
  currentToolDescription: string | null;
  isRecovering?: boolean;
  recoveryReason?: string | null;
}

export function ProcessingIndicator({
  stage,
  elapsedMs,
  lastEventTimestamp,
  currentToolDescription,
  isRecovering = false,
  recoveryReason = null,
}: ProcessingIndicatorProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const secondsSinceEvent = lastEventTimestamp
    ? Math.floor((now - lastEventTimestamp) / 1000)
    : null;
  const isStale = secondsSinceEvent !== null && secondsSinceEvent > 15;

  const stageLabel = stage === 'thinking' ? 'Thinking'
    : stage === 'tool_use' ? 'Using tools'
    : stage === 'streaming' ? 'Streaming'
    : 'Processing';

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <span className="flex items-center gap-1.5 text-[0.667rem] font-medium text-muted-foreground/70">
        <span className="size-1.5 rounded-full bg-primary animate-pulse" />
        <span>{stageLabel}</span>
        <span className="tabular-nums">· {formatElapsed(elapsedMs)}</span>
        {currentToolDescription && (
          <>
            <span className="opacity-40">·</span>
            <span className="truncate max-w-[200px]">{currentToolDescription}</span>
          </>
        )}
        {!currentToolDescription && stage === 'thinking' && (
          <>
            <span className="opacity-40">·</span>
            <span className="italic opacity-60">Reasoning...</span>
          </>
        )}
      </span>
      {isRecovering && (
        <span className="text-[0.6rem] text-primary/60">Resyncing{recoveryReason ? `: ${recoveryReason}` : ''}</span>
      )}
      {isStale && (
        <span className="text-[0.6rem] text-orange animate-pulse">
          ⏳ Still thinking… {secondsSinceEvent}s
        </span>
      )}
    </div>
  );
}

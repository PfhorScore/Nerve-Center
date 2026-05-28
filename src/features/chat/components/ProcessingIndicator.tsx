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


import type { ProcessingStage } from '@/contexts/ChatContext';
import { formatElapsed } from '../utils';

interface ProcessingIndicatorProps {
  stage?: ProcessingStage;
  elapsedMs: number;
  currentToolDescription: string | null;
  isRecovering?: boolean;
  recoveryReason?: string | null;
}

export function ProcessingIndicator({
  stage,
  elapsedMs,
  currentToolDescription,
  isRecovering = false,
  recoveryReason = null,
}: ProcessingIndicatorProps) {



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

      </span>
      {isRecovering && (
        <span className="text-[0.6rem] text-primary/60">Resyncing{recoveryReason ? `: ${recoveryReason}` : ''}</span>
      )}

    </div>
  );
}

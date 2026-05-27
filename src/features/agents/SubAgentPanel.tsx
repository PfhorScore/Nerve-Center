/**
 * SubAgentPanel — Mini panel showing active sub-agents.
 *
 * Fetches from `/api/subagents` periodically and displays running + recent
 * sub-agent tasks with name, duration, and status.
 *
 * Designed to be placed in the right sidebar, only visible when sub-agents
 * are active. Auto-refreshes every 10 seconds while sub-agents exist.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, CheckCircle2, XCircle, Terminal } from 'lucide-react';

interface SubAgentEntry {
  index: number;
  runId: string;
  taskName: string;
  label: string;
  status: string;
  runtime: string;
  runtimeMs: number;
}

interface SubAgentResponse {
  ok: boolean;
  active: SubAgentEntry[];
  recent: SubAgentEntry[];
}

/**
 * Compact panel listing active sub-agents with live status.
 *
 * ## States
 * - **Hidden**: No sub-agents exist (renders nothing).
 * - **Loading**: Fetching (skeleton).
 * - **Active**: One or more sub-agents running. Shows their name, task, duration.
 * - **Recent**: Recently completed sub-agents shown in diminished opacity.
 */
export function SubAgentPanel() {
  const [active, setActive] = useState<SubAgentEntry[]>([]);
  const [recent, setRecent] = useState<SubAgentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSubAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/subagents');
      const data: SubAgentResponse = await res.json();
      if (data.ok) {
        setActive(data.active || []);
        setRecent(data.recent?.slice(0, 3) || []);
      }
    } catch {
      // silently fail — panel just stays empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubAgents();
    // Poll every 10s while sub-agents might be active
    intervalRef.current = setInterval(fetchSubAgents, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchSubAgents]);

  // Hide entirely when nothing is happening
  if (!loading && active.length === 0 && recent.length === 0) return null;

  const formatDuration = (ms: number): string => {
    if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
    const m = Math.floor(ms / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return `${m}m ${s}s`;
  };

  return (
    <div className="border-t border-border/30 px-3 py-2 space-y-1.5">
      {active.length > 0 && (
        <>
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primary animate-pulse shrink-0" />
            <span className="text-[0.533rem] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Sub-Agents ({active.length})
            </span>
          </div>
          {active.map((sa) => (
            <div key={sa.runId} className="flex items-start gap-2 rounded-lg bg-secondary/20 px-2 py-1.5">
              <Loader2 size={10} className="text-primary animate-spin shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-[0.667rem] font-medium text-foreground/80 truncate">
                  {sa.taskName || sa.label?.slice(0, 40) || `Sub-agent ${sa.index}`}
                </div>
                <div className="text-[0.533rem] text-muted-foreground/50 truncate">
                  {sa.label?.slice(0, 60) || 'Working...'}
                </div>
              </div>
              <span className="text-[0.5rem] tabular-nums text-muted-foreground/40 shrink-0 mt-0.5">
                {formatDuration(sa.runtimeMs)}
              </span>
            </div>
          ))}
        </>
      )}

      {recent.length > 0 && active.length > 0 && (
        <div className="border-t border-border/20 my-1" />
      )}

      {recent.length > 0 && (
        <div className="space-y-1">
          <span className="text-[0.533rem] font-semibold uppercase tracking-wider text-muted-foreground/40">
            Recent
          </span>
          {recent.map((sa) => (
            <div key={sa.runId} className="flex items-start gap-2 rounded-lg px-2 py-1 opacity-60">
              {sa.status === 'done' || sa.status === 'completed' ? (
                <CheckCircle2 size={10} className="text-green shrink-0 mt-0.5" />
              ) : sa.status === 'error' ? (
                <XCircle size={10} className="text-red shrink-0 mt-0.5" />
              ) : (
                <Terminal size={10} className="text-muted-foreground/40 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[0.667rem] text-muted-foreground/60 truncate">
                  {sa.taskName || 'Sub-agent'}
                </div>
              </div>
              <span className="text-[0.5rem] tabular-nums text-muted-foreground/30 shrink-0 mt-0.5">
                {formatDuration(sa.runtimeMs)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

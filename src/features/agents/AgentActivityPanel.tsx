/**
 * AgentActivityPanel — Live agent activity feed for the Nerve Center side panel.
 *
 * Combines ephemeral live tool-call data from the ChatContext activity log with
 * persistent tool-call history parsed from the message stream. Designed as a
 * right-sidebar panel that shows what the AI is doing right now while keeping a
 * record of everything it already did.
 *
 * ## Data sources
 *
 * | Source                 | Lifetime   | What it provides                    |
 * |------------------------|------------|-------------------------------------|
 * | `activityLog`          | Ephemeral  | Live tool calls, current stage      |
 * | `processingStage`      | Ephemeral  | 'thinking' / 'tool_use' / ...       |
 * | `messages`             | Persistent | Archived tool & toolResult messages |
 * | `currentToolDescription` | Ephemeral | Current tool description text      |
 *
 * ## Design
 *
 * Each entry is a single expandable row with:
 * - Status icon (pulse for running, checkmark for success, X for error)
 * - Tool name (truncated to one line)
 * - Expandable detail showing args and result
 * - Timestamp
 *
 * The panel matches the existing ToolCallsPanel design language.
 *
 * @module AgentActivityPanel
 */

import { useState, useMemo } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, Terminal } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import type { ChatMsg } from '@/features/chat/types';

/** Props for {@link AgentActivityPanel}. */
interface AgentActivityPanelProps {
  /** Full message history from the current chat session, used to extract archived tool-call entries. */
  messages: ChatMsg[];
}

/**
 * A single entry in the activity feed — either live (from activityLog)
 * or archived (from messages).
 */
interface ActivityEntry {
  /** Monotonically increasing identifier within the current extraction pass. */
  id: number;
  /** Tool name, e.g. `"web_search"` or `"read"`. */
  name: string;
  /** Human-friendly description of what the tool is doing. */
  description: string;
  /** Raw JSON arguments string. */
  args: string;
  /** Result payload (truncated to 500 chars in the UI). */
  result?: string;
  /** When the tool started. */
  timestamp: Date;
  /** Execution status. */
  status: 'running' | 'success' | 'error';
  /** Whether this entry came from the live activity log (vs archived messages). */
  live: boolean;
}

/**
 * Find the index of the last entry with `status === 'running'`.
 *
 * Used to pair incoming `toolResult` messages with their originating
 * `tool` call. Scans from the end of the array for efficiency since
 * results typically arrive shortly after their corresponding call.
 *
 * @param entries - The current list of entries to search.
 * @returns Index of the last running entry, or `-1` if none found.
 */
function findLastRunningIndex(entries: ActivityEntry[]): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].status === 'running') return i;
  }
  return -1;
}

/**
 * Parse the raw chat message array into archived {@link ActivityEntry} objects.
 *
 * ## Parsing rules
 *
 * - **`role === 'tool'`**: A new tool call. Name from `**tool:** \`name\``
 *   pattern in `rawText`. Args from a JSON fenced code block. A
 *   human-friendly preview is extracted from `**description:**` if present.
 *
 * - **`role === 'toolResult'`**: Completion. Matched to the last unresolved
 *   entry. A result containing `"Error:"` or `"error"` signals error status.
 *
 * @param messages - Full chat message history for the current session.
 * @returns Ordered array of archived entries (oldest first).
 */
function extractArchivedEntries(messages: ChatMsg[]): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  let id = 0;

  for (const msg of messages) {
    if (msg.role === 'tool') {
      const nameMatch = msg.rawText.match(/\*\*tool:\*\*\s*`([^`]+)`/);
      const argsMatch = msg.rawText.match(/```json\n([\s\S]*?)\n```/);
      const name = nameMatch ? nameMatch[1] : 'unknown';
      const args = argsMatch ? argsMatch[1] : '';

      // Try to get a human-friendly description/preview
      let description = '';
      const previewMatch = msg.rawText.match(/\*\*description:\*\*\s*(.+?)(?:\n|$)/i);
      if (previewMatch) {
        description = previewMatch[1].trim();
      }
      // Fallback: use the first line of args as the description
      if (!description && args) {
        const firstLine = args.trim().split('\n')[0];
        description = firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine;
      }

      entries.push({
        id: id++,
        name,
        description,
        args,
        timestamp: msg.timestamp,
        status: 'running',
        live: false,
      });
    } else if (msg.role === 'toolResult') {
      const lastRunningIdx = findLastRunningIndex(entries);
      if (lastRunningIdx >= 0) {
        entries[lastRunningIdx].status =
          msg.rawText.includes('Error:') || msg.rawText.includes('error') ? 'error' : 'success';
        entries[lastRunningIdx].result = msg.rawText;
      } else {
        // Orphaned result — no matching tool call found
        entries.push({
          id: id++,
          name: 'result',
          description: '',
          args: '',
          result: msg.rawText,
          timestamp: msg.timestamp,
          status: 'success',
          live: false,
        });
      }
    }
  }

  return entries;
}

/**
 * Convert live {@link import('@/contexts/ChatContext').ActivityLogEntry ActivityLogEntry}
 * objects from the chat context into {@link ActivityEntry} objects for rendering.
 *
 * Live entries always appear at the bottom of the feed (most recent activity).
 *
 * @param log - The raw activity log array from ChatContext.
 * @param nextId - The next available unique ID to use for the first live entry.
 * @returns An array of live activity entries suitable for merging with archived ones.
 */
function extractLiveEntries(
  log: { id: string; toolName: string; description: string; startedAt: number; completedAt?: number; phase: 'running' | 'completed' }[],
  nextId: number,
): ActivityEntry[] {
  return log.map((entry, idx) => ({
    id: nextId + idx,
    name: entry.toolName,
    description: entry.description,
    args: '',
    timestamp: new Date(entry.startedAt),
    status: entry.phase === 'running' ? 'running' : 'success',
    live: true,
  }));
}

/**
 * Merge archived and live entries into a single display list.
 *
 * Live entries are appended at the end (most recent). To avoid showing
 * duplicate entries for the same tool call, any archived entry whose
 * tool name and timestamp are already covered by a live entry is skipped.
 * The heuristic matches on tool name + a 5-second window on timestamps.
 *
 * @param archived - Entries parsed from the message history.
 * @param live - Entries from the current activity log.
 * @returns A merged, chronologically-ordered list of entries.
 */
function mergeEntries(archived: ActivityEntry[], live: ActivityEntry[]): ActivityEntry[] {
  if (live.length === 0) return archived;

  // Build a set of (toolName, timestampSec) tuples from live entries for dedup
  const liveKeys = new Set<string>();
  for (const entry of live) {
    const key = `${entry.name}:${Math.floor(entry.timestamp.getTime() / 5000)}`;
    liveKeys.add(key);
  }

  // Filter archived entries that don't have a matching live entry
  const filteredArchived = archived.filter((entry) => {
    const key = `${entry.name}:${Math.floor(entry.timestamp.getTime() / 5000)}`;
    return !liveKeys.has(key);
  });

  return [...filteredArchived, ...live];
}

/**
 * Render the appropriate status icon for a tool-call entry.
 *
 * - **running (live)**: Blue animated pulse clock.
 * - **running (archived)**: Orange animated pulse clock.
 * - **success**: Green checkmark.
 * - **error**: Red X.
 *
 * @param props.status - The execution status of the entry.
 * @param props.live - Whether this is a live (in-flight) entry.
 * @returns A React node for the status icon.
 */
function StatusIcon({ status, live }: { status: ActivityEntry['status']; live: boolean }): React.ReactNode {
  switch (status) {
    case 'running':
      return live
        ? <Clock size={12} className="text-blue shrink-0 animate-pulse" />
        : <Clock size={12} className="text-orange shrink-0 animate-pulse" />;
    case 'success':
      return <CheckCircle2 size={12} className="text-green shrink-0" />;
    case 'error':
      return <XCircle size={12} className="text-red shrink-0" />;
  }
}

/**
 * Agent Activity Panel — Right sidebar panel showing live tool calls and
 * reasoning steps during AI generation, separate from the chat stream.
 *
 * ## States
 *
 * - **Thinking**: When `processingStage === 'thinking'`, shows a "Thinking..."
 *   indicator with an animated spinner.
 *
 * - **Tool in progress**: When `processingStage === 'tool_use'` or
 *   `activityLog` has running entries, shows live tool call cards with
 *   a pulsing status icon and the tool name.
 *
 * - **Streaming response**: When `processingStage === 'streaming'`, shows
 *   the active tool calls plus any archived history.
 *
 * - **Idle / no activity**: When `generation` is not active and there are
 *   no archived tool calls, shows an empty-state icon with "No activity yet".
 *
 * - **Persistent history**: Archived tool calls from messages remain visible
 *   after generation ends, so the user can review everything that happened.
 *
 * @param props - See {@link AgentActivityPanelProps}.
 * @returns The rendered panel content.
 */
export function AgentActivityPanel({ messages }: AgentActivityPanelProps): React.ReactNode {
  const { processingStage, activityLog, currentToolDescription } = useChat();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Derive archived entries from message history (memoized)
  const archivedEntries = useMemo(() => extractArchivedEntries(messages), [messages]);

  // Derive live entries from the activity log (memoized)
  const liveEntries = useMemo(
    () => extractLiveEntries(activityLog, archivedEntries.length),
    [activityLog, archivedEntries.length],
  );

  // Merge archived and live, deduplicating where they overlap
  const mergedEntries = useMemo(
    () => mergeEntries(archivedEntries, liveEntries),
    [archivedEntries, liveEntries],
  );

  // Determine if there is any ongoing activity
  const isActive = processingStage !== null || activityLog.some(e => e.phase === 'running');

  /**
   * Toggle an entry between expanded (showing args + result) and
   * collapsed (showing only the header row).
   *
   * Uses a `Set<number>` for O(1) lookup.
   */
  const toggleEntry = (id: number): void => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Empty state (no activity and no history) ──
  if (mergedEntries.length === 0 && !isActive) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <Terminal size={20} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-[0.733rem] text-muted-foreground/50">No activity yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {/* ── Thinking indicator ── */}
      {processingStage === 'thinking' && (
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-blue/20 bg-blue/[0.04]">
          <Loader2 size={12} className="text-blue animate-spin shrink-0" />
          <span className="text-[0.667rem] font-medium text-blue/80">Thinking...</span>
          {currentToolDescription && (
            <span className="text-[0.6rem] text-muted-foreground/60 ml-auto truncate max-w-[140px]">
              {currentToolDescription}
            </span>
          )}
        </div>
      )}

      {/* ── Current tool description banner (for tool_use stage, separate from thinking) ── */}
      {processingStage === 'tool_use' && currentToolDescription && !activityLog.some(e => e.phase === 'running') && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-orange/20 bg-orange/[0.04]">
          <Clock size={12} className="text-orange shrink-0 animate-pulse" />
          <span className="text-[0.667rem] font-medium text-foreground/80 truncate">
            {currentToolDescription}
          </span>
        </div>
      )}

      {/* ── Entry list ── */}
      {mergedEntries.map((entry) => {
        const isExpanded = expanded.has(entry.id);
        const statusIcon = <StatusIcon status={entry.status} live={entry.live} />;

        return (
          <div
            key={entry.id}
            className={`rounded-xl border overflow-hidden transition-colors ${
              entry.live && entry.status === 'running'
                ? 'border-blue/30 bg-blue/[0.03]'
                : 'border-border/40 bg-card/30'
            }`}
          >
            {/* Header row — always visible */}
            <button
              onClick={() => toggleEntry(entry.id)}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-foreground/[0.03] transition-colors cursor-pointer"
              type="button"
            >
              <span
                className={`text-[0.533rem] transition-transform ${
                  isExpanded ? 'rotate-90' : ''
                } text-muted-foreground/50 shrink-0`}
              >
                ›
              </span>
              {statusIcon}
              <code className="text-[0.667rem] font-semibold text-foreground/80 truncate flex-1 min-w-0">
                {entry.name}
              </code>
              {/* Small description label next to the name for running entries */}
              {entry.status === 'running' && entry.description && (
                <span className="text-[0.533rem] text-muted-foreground/50 truncate max-w-[100px] hidden sm:inline">
                  {entry.description}
                </span>
              )}
              <span className="text-[0.533rem] text-muted-foreground/40 tabular-nums shrink-0">
                {entry.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {/* Live badge */}
              {entry.live && (
                <span className="text-[0.45rem] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full bg-blue/10 text-blue/70 shrink-0">
                  live
                </span>
              )}
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-3 pb-2 space-y-1.5">
                {entry.args && (
                  <div>
                    <div className="text-[0.533rem] uppercase tracking-wider text-muted-foreground/40 mb-0.5">
                      Args
                    </div>
                    <pre className="bg-background/60 rounded-lg px-2 py-1.5 text-[0.667rem] font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                      {entry.args}
                    </pre>
                  </div>
                )}
                {entry.description && !entry.args && (
                  <div>
                    <div className="text-[0.533rem] uppercase tracking-wider text-muted-foreground/40 mb-0.5">
                      Description
                    </div>
                    <p className="text-[0.667rem] text-muted-foreground px-2 py-1">
                      {entry.description}
                    </p>
                  </div>
                )}
                {entry.result && (
                  <div>
                    <div className="text-[0.533rem] uppercase tracking-wider text-muted-foreground/40 mb-0.5">
                      Result
                    </div>
                    <pre className="bg-background/60 rounded-lg px-2 py-1.5 text-[0.667rem] font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                      {entry.result.length > 500
                        ? entry.result.slice(0, 500) + '…'
                        : entry.result}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

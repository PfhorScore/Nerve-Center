/**
 * ToolCallsPanel — Dedicated side panel for tool call history.
 *
 * Extracts tool/toolResult messages from the current chat session and renders
 * them as a compact, expandable list. Each tool call shows its name, raw
 * arguments, execution status (running/success/error), and truncated result
 * content.
 *
 * ## Message parsing
 *
 * Tool messages use a convention where the tool name is embedded in
 * `rawText` as `**tool:** \`name\`` and args are in a JSON fenced code
 * block. Results are matched to the most recent unresolved tool call by
 * scanning backwards through the entries list.
 *
 * ## Integration
 *
 * Wired into the right sidebar panel system via {@link App.tsx}'s
 * `renderPanelSide`. Registered as a panel with id `'tools'` in the
 * {@link PanelId} union and {@link DEFAULT_LAYOUT}.
 *
 * @module ToolCallsPanel
 */

import { useState, useMemo } from 'react';
import { CheckCircle2, XCircle, Clock, Terminal } from 'lucide-react';
import type { ChatMsg } from '@/features/chat/types';

/** Props for {@link ToolCallsPanel}. */
interface ToolCallsPanelProps {
  /** Full message history from the current chat session, used to extract tool-call entries. */
  messages: ChatMsg[];
}

/**
 * A single parsed tool-call entry displayed in the panel.
 *
 * Built by {@link extractToolCalls} from the raw {@link ChatMsg} stream.
 */
interface ToolCallEntry {
  /** Monotonically increasing identifier within the current extraction pass. */
  id: number;
  /** Tool name parsed from the message raw text, e.g. `"web_search"`. */
  name: string;
  /** Raw JSON arguments string extracted from the message body. */
  args: string;
  /** Result payload (if resolved), truncated to 500 chars in the UI. */
  result?: string;
  /** When the tool message was received. */
  timestamp: Date;
  /** Execution status: unresolved, completed successfully, or errored. */
  status: 'running' | 'success' | 'error';
}

/**
 * Find the index of the last entry with `status === 'running'`.
 *
 * Used to pair incoming `toolResult` messages with their originating
 * `tool` call. Scans from the end of the array for efficiency since
 * results typically arrive shortly after their corresponding call.
 *
 * @returns Index of the last running entry, or `-1` if none found.
 */
function findLastRunningIndex(entries: ToolCallEntry[]): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].status === 'running') return i;
  }
  return -1;
}

/**
 * Parse the raw chat message array into a list of {@link ToolCallEntry}
 * objects suitable for rendering.
 *
 * ## Parsing rules
 *
 * - **`role === 'tool'`**: A new tool call has started. The tool name is
 *   extracted from the pattern `**tool:** \`name\`` in `rawText`.
 *   Arguments are pulled from a JSON fenced code block if present.
 *
 * - **`role === 'toolResult'`**: A previous tool call has completed.
 *   The result is matched to the last unresolved entry (found by
 *   {@link findLastRunningIndex}). If no unresolved entry exists, an
 *   orphaned result entry is created.
 *
 * - **Status detection**: A result containing `"Error:"` or `"error"` is
 *   marked as errored; everything else is treated as success.
 *
 * @param messages - Full chat message history for the current session.
 * @returns Ordered array of tool-call entries (oldest first).
 */
function extractToolCalls(messages: ChatMsg[]): ToolCallEntry[] {
  const entries: ToolCallEntry[] = [];
  let callId = 0;

  for (const msg of messages) {
    if (msg.role === 'tool') {
      // Parse tool name from markdown pattern: **tool:** `name`
      const nameMatch = msg.rawText.match(/\*\*tool:\*\*\s*`([^`]+)`/);
      // Parse JSON arguments from a fenced code block: ```json ... ```
      const argsMatch = msg.rawText.match(/```json\n([\s\S]*?)\n```/);
      const name = nameMatch ? nameMatch[1] : 'unknown';
      const args = argsMatch ? argsMatch[1] : '';

      entries.push({
        id: callId++,
        name,
        args,
        timestamp: msg.timestamp,
        status: 'running',
      });
    } else if (msg.role === 'toolResult') {
      // Match result to the last un-resolved tool call
      const lastRunningIdx = findLastRunningIndex(entries);
      if (lastRunningIdx >= 0) {
        entries[lastRunningIdx].status = msg.rawText.includes('Error:') || msg.rawText.includes('error') ? 'error' : 'success';
        entries[lastRunningIdx].result = msg.rawText;
      } else {
        // Orphaned result
        entries.push({
          id: callId++,
          name: 'result',
          args: '',
          result: msg.rawText,
          timestamp: msg.timestamp,
          status: 'success',
        });
      }
    }
  }

  return entries;
}

/**
 * Side panel that displays extracted tool-call history for the current
 * chat session.
 *
 * ## States
 *
 * - **Empty**: When no tool calls exist in the message history, shows a
 *   centered terminal icon with "No tool calls yet" text.
 *
 * - **Populated**: Renders a scrollable vertical list of tool-call cards.
 *   Each card shows a header row (chevron, status icon, tool name,
 *   timestamp) and an expandable detail section with raw args and result.
 *
 * - **Streaming**: Tool calls with `status === 'running'` receive an
 *   animated pulse clock icon and are auto-resolved when their
 *   corresponding `toolResult` message arrives.
 *
 * ## Performance
 *
 * Uses {@link useMemo} to re-derive the tool-call list only when
 * `messages` changes, avoiding re-parsing on every render.
 *
 * @param props - See {@link ToolCallsPanelProps}.
 */
export function ToolCallsPanel({ messages }: ToolCallsPanelProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toolCalls = useMemo(() => extractToolCalls(messages), [messages]);

  /**
   * Toggle a tool-call entry between expanded (showing args + result)
   * and collapsed (showing only the header row).
   *
   * Uses a `Set<number>` for O(1) lookup rather than a boolean array
   * so we don't re-allocate on every toggle.
   */
  const toggleEntry = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (toolCalls.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <Terminal size={20} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-[0.733rem] text-muted-foreground/50">No tool calls yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {toolCalls.map((entry) => {
        const isExpanded = expanded.has(entry.id);
        const statusIcon = entry.status === 'success'
          ? <CheckCircle2 size={12} className="text-green shrink-0" />
          : entry.status === 'error'
            ? <XCircle size={12} className="text-red shrink-0" />
            : <Clock size={12} className="text-orange shrink-0 animate-pulse" />;

        return (
          <div
            key={entry.id}
            className="rounded-xl border border-border/40 bg-card/30 overflow-hidden"
          >
            {/* Header row — always visible */}
            <button
              onClick={() => toggleEntry(entry.id)}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-foreground/[0.03] transition-colors cursor-pointer"
            >
              <span className={`text-[0.533rem] transition-transform ${isExpanded ? 'rotate-90' : ''} text-muted-foreground/50`}>›</span>
              {statusIcon}
              <code className="text-[0.667rem] font-semibold text-foreground/80 truncate flex-1 min-w-0">
                {entry.name}
              </code>
              <span className="text-[0.533rem] text-muted-foreground/40 tabular-nums shrink-0">
                {entry.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-3 pb-2 space-y-1.5">
                {entry.args && (
                  <div>
                    <div className="text-[0.533rem] uppercase tracking-wider text-muted-foreground/40 mb-0.5">Args</div>
                    <pre className="bg-background/60 rounded-lg px-2 py-1.5 text-[0.667rem] font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                      {entry.args}
                    </pre>
                  </div>
                )}
                {entry.result && (
                  <div>
                    <div className="text-[0.533rem] uppercase tracking-wider text-muted-foreground/40 mb-0.5">Result</div>
                    <pre className="bg-background/60 rounded-lg px-2 py-1.5 text-[0.667rem] font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                      {entry.result.slice(0, 500)}{entry.result.length > 500 ? '…' : ''}
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

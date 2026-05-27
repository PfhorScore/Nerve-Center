/**
 * ThoughtsPanel — Thought-bubble scratch pad for the Nerve Center sidebar.
 *
 * Instead of one big textarea, thoughts are split by `---` markers into
 * individual "thought bubbles." Each bubble has:
 *
 * - Checkbox to mark as completed (dimmed when done)
 * - Hover actions: copy, send to chat, research
 * - Inline editing on click
 * - A "New thought" input at the bottom to add more
 *
 * Storage is the same `scratchpad.md` file on the server — we just render
 * it differently. Completion state is tracked in localStorage so the file
 * stays clean and backward-compatible.
 *
 * @module ThoughtsPanel
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { CheckSquare, Square, Copy, Check, MessageSquare, ExternalLink, Clock } from 'lucide-react';

/** Props for {@link ThoughtsPanel}. */
interface ThoughtsPanelProps {
  /** Raw scratch pad content (markdown with `---` separators). */
  content: string;
  /** Called when the user modifies the content. */
  onContentChange: (content: string) => void;
  /** Called when the user wants to send text to the chat. */
  onSendToChat?: (text: string) => void;
  /** Called when the user wants to research selected text. */
  onResearch?: (text: string) => void;
  /** Whether the AI is currently generating a response. */
  isGenerating?: boolean;
}

/** A single parsed thought. */
interface Thought {
  /** Index within the content array. */
  index: number;
  /** The thought body text (trimmed). */
  text: string;
}

/**
 * Split raw scratch pad content into individual thoughts by `---`.
 */
function parseThoughts(content: string): Thought[] {
  if (!content || !content.trim()) return [];
  return content
    .split(/\n?---\n?/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text, i) => ({ index: i, text }));
}

/** Storage key for completion state. */
const COMPLETED_KEY = 'nerve-scratch-pad-completed';
/** Storage key for pending-completion thought index. */
const PENDING_KEY = 'nerve-scratch-pad-pending';

/**
 * Load the set of completed thought indices from localStorage.
 */
function loadCompleted(): Set<number> {
  try {
    const raw = localStorage.getItem(COMPLETED_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

/**
 * Persist the set of completed thought indices to localStorage.
 */
function saveCompleted(set: Set<number>) {
  try { localStorage.setItem(COMPLETED_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}

/** Load the pending-completion thought index from localStorage. */
function loadPending(): number | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? Number(raw) : null;
  } catch { return null; }
}

/** Save the pending-completion thought index. */
function savePending(idx: number | null) {
  try {
    if (idx !== null) localStorage.setItem(PENDING_KEY, String(idx));
    else localStorage.removeItem(PENDING_KEY);
  } catch { /* ignore */ }
}

/**
 * Thought bubble card component.
 */
function ThoughtCard({
  thought,
  completed,
  pending,
  onToggleComplete,
  onEdit,
  onSendToChat,
  onResearch,
  copied,
  onCopy,
}: {
  thought: Thought;
  completed: boolean;
  pending: boolean;
  onToggleComplete: () => void;
  onEdit: (newText: string) => void;
  onSendToChat?: (text: string) => void;
  onResearch?: (text: string) => void;
  copied: boolean;
  onCopy: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(thought.text);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const startEdit = useCallback(() => {
    setEditText(thought.text);
    setEditing(true);
    setTimeout(() => textRef.current?.focus(), 10);
  }, [thought.text]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    if (editText.trim() !== thought.text.trim()) {
      onEdit(editText.trim());
    }
  }, [editText, thought.text, onEdit]);

  return (
    <div
      className={`group relative rounded-xl border overflow-hidden transition-none ${
        completed
          ? 'border-border/20 bg-muted/10 opacity-50'
          : 'border-border/40 bg-card/30 hover:border-border/60'
      }`}
    >
      <div className="flex items-start gap-2 px-2.5 py-2">
        {/* Status: pending / completed / active */}
        <button
          onClick={onToggleComplete}
          className="mt-0.5 shrink-0 transition-colors"
          title={pending ? 'Waiting for AI response…' : completed ? 'Mark as active' : 'Mark as completed'}
          aria-label={pending ? 'Waiting for AI response' : completed ? 'Mark as active' : 'Mark as completed'}
        >
          {pending
            ? <Clock size={13} className="text-amber/60 animate-pulse" />
            : completed
              ? <CheckSquare size={13} className="text-green/70" />
              : <Square size={13} className="text-muted-foreground/40 hover:text-foreground/60" />
          }
        </button>

        {/* Content area — click to edit, no layout shift */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <textarea
              ref={textRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setEditing(false); setEditText(thought.text); }
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') commitEdit();
              }}
              className="w-full bg-transparent border-none outline-none resize-none text-xs text-foreground/80 font-mono leading-relaxed p-0"
              rows={thought.text.split('\n').length}
              autoFocus
            />
          ) : (
            <div
              onClick={startEdit}
              className={`whitespace-pre-wrap break-words text-xs leading-relaxed cursor-text ${
                completed ? 'text-muted-foreground/50 line-through' : 'text-foreground/80'
              }`}
            >
              {thought.text}
            </div>
          )}
        </div>

        {/* Hover actions */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {onSendToChat && (
            <button
              onClick={(e) => { e.stopPropagation(); onSendToChat(thought.text); }}
              className="size-6 flex items-center justify-center rounded-md text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
              title="Send to chat"
              aria-label="Send to chat"
            >
              <MessageSquare size={11} />
            </button>
          )}
          {onResearch && (
            <button
              onClick={(e) => { e.stopPropagation(); onResearch(thought.text); }}
              className="size-6 flex items-center justify-center rounded-md text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
              title="Research this"
              aria-label="Research this"
            >
              <ExternalLink size={11} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(); }}
            className="size-6 flex items-center justify-center rounded-md text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
            title={copied ? 'Copied!' : 'Copy'}
            aria-label={copied ? 'Copied!' : 'Copy'}
          >
            {copied ? <Check size={11} className="text-green" /> : <Copy size={11} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * ThoughtsPanel — Main component.
 */
export function ThoughtsPanel({ content, onContentChange, onSendToChat, onResearch, isGenerating }: ThoughtsPanelProps) {
  const [completed, setCompleted] = useState<Set<number>>(loadCompleted);
  const [pendingIdx, setPendingIdx] = useState<number | null>(() => loadPending());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [newThought, setNewThought] = useState('');
  const newThoughtRef = useRef<HTMLTextAreaElement>(null);
  const wasGeneratingRef = useRef(isGenerating);

  // When generation finishes, auto-check the pending thought
  useEffect(() => {
    if (wasGeneratingRef.current && !isGenerating && pendingIdx !== null) {
      // Generation just completed — mark the pending thought as done
      setCompleted((prev) => {
        const next = new Set(prev);
        next.add(pendingIdx);
        saveCompleted(next);
        return next;
      });
      setPendingIdx(null);
      savePending(null);
    }
    wasGeneratingRef.current = isGenerating;
  }, [isGenerating, pendingIdx]);

  const thoughts = useMemo(() => parseThoughts(content), [content]);

  /** Rebuild the content string from the current thought array, preserving order. */
  const rebuildContent = useCallback((updatedThoughts: Thought[]) => {
    return updatedThoughts.map((t) => t.text).join('\n\n---\n\n');
  }, []);

  /** Toggle a thought's completed state. */
  const toggleComplete = useCallback((index: number) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      saveCompleted(next);
      return next;
    });
  }, []);

  /** Copy a thought to clipboard. */
  const copyThought = useCallback((index: number, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    });
  }, []);

  /** Add a new thought from the input. */
  const addThought = useCallback(() => {
    const text = newThought.trim();
    if (!text) return;
    const updated = [...thoughts, { index: thoughts.length, text }];
    onContentChange(rebuildContent(updated));
    setNewThought('');
    newThoughtRef.current?.focus();
  }, [newThought, thoughts, onContentChange, rebuildContent]);



  // ── Empty state ──
  if (thoughts.length === 0) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-[0.733rem] text-muted-foreground/50">No thoughts yet</p>
            <p className="text-[0.6rem] text-muted-foreground/40 mt-1">Type below and press Enter to add</p>
          </div>
        </div>
        {/* New thought input */}
        <div className="p-2 border-t border-border/20">
          <textarea
            ref={newThoughtRef}
            value={newThought}
            onChange={(e) => setNewThought(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addThought(); }
              if (e.key === 'Escape') setNewThought('');
            }}
            placeholder="Write a thought…"
            className="w-full bg-transparent border border-border/30 rounded-lg px-2.5 py-2 text-xs text-foreground/70 placeholder:text-muted-foreground/30 font-mono outline-none resize-none focus:border-primary/40 transition-colors"
            rows={2}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Thought list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {/* Active thoughts */}
        {thoughts.map((thought) => (
          <ThoughtCard
            key={thought.index}
            thought={thought}
            completed={completed.has(thought.index)}
            pending={pendingIdx === thought.index}
            onToggleComplete={() => toggleComplete(thought.index)}
            onEdit={(newText) => {
              const updated = thoughts.map((t) =>
                t.index === thought.index ? { ...t, text: newText } : t
              );
              onContentChange(rebuildContent(updated));
            }}
            onSendToChat={(text) => {
            setPendingIdx(thought.index);
            savePending(thought.index);
            onSendToChat?.(text);
          }}
            onResearch={onResearch}
            copied={copiedIndex === thought.index}
            onCopy={() => copyThought(thought.index, thought.text)}
          />
        ))}


      </div>

      {/* New thought input */}
      <div className="p-2 border-t border-border/20">
        <textarea
          ref={newThoughtRef}
          value={newThought}
          onChange={(e) => setNewThought(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addThought(); }
            if (e.key === 'Escape') setNewThought('');
          }}
          placeholder="New thought…"
          className="w-full bg-transparent border border-border/30 rounded-lg px-2.5 py-2 text-xs text-foreground/70 placeholder:text-muted-foreground/30 font-mono outline-none resize-none focus:border-primary/40 transition-colors"
          rows={2}
        />
      </div>
    </div>
  );
}
  // Reference to suppress TS unused warning

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
import { useSettings } from '@/contexts/SettingsContext';
import { CheckSquare, Square, Copy, Check, MessageSquare, ExternalLink, Clock, Trash2, Send, Paperclip } from 'lucide-react';

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
  thoughtNumber,
  completed,
  pending,
  selectMode,
  selected,
  onToggleSelect,
  onToggleComplete,
  onEdit,
  onDelete,
  onSendToChat,
  onResearch,
  copied,
  onCopy,
}: {
  thought: Thought;
  thoughtNumber: number;
  completed: boolean;
  pending: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (shiftKey: boolean) => void;
  onToggleComplete: () => void;
  onEdit: (newText: string) => void;
  onDelete: () => void;
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
      <div className="flex items-start gap-1.5 px-2.5 py-2">
        {selectMode ? (
          <button onClick={(e) => { e.stopPropagation(); onToggleSelect?.(e.shiftKey); }} className="mt-0.5 shrink-0 text-muted-foreground/40 hover:text-primary transition-colors" aria-label={selected ? 'Deselect' : 'Select'}>
            {selected ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
          </button>
        ) : (
          <span className="mt-0.5 shrink-0 text-[0.6rem] font-mono font-semibold text-muted-foreground/30 min-w-[1.2em] text-right select-none">{thoughtNumber}</span>
        )}
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
              className="w-full bg-secondary/40 border border-primary/30 rounded-lg outline-none resize-vertical text-sm text-foreground/90 font-mono leading-relaxed p-2 min-h-[80px]"
              rows={Math.max(3, thought.text.split('\n').length + 1)}
              autoFocus
            />
          ) : (
            <div
              onClick={startEdit}
              className={`whitespace-pre-wrap break-words text-sm leading-relaxed cursor-text ${
                completed ? 'text-muted-foreground/50' : 'text-foreground/80'
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
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="size-6 flex items-center justify-center rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete thought"
            aria-label="Delete thought"
          >
            <Trash2 size={11} />
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [thoughtsTab, setThoughtsTab] = useState<'active' | 'completed'>('active');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedThoughts, setSelectedThoughts] = useState<Set<number>>(new Set());
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);
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

  const sendSelectedThoughts = useCallback(() => {
    if (selectedThoughts.size === 0 || !onSendToChat) return;
    const texts = thoughts.filter(t => selectedThoughts.has(t.index)).sort((a, b) => a.index - b.index).map(t => t.text);
    onSendToChat(texts.join('\n\n---\n\n'));
    setSelectedThoughts(new Set());
    setSelectMode(false);
  }, [selectedThoughts, thoughts, onSendToChat]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const { ctrlEnterToSend } = useSettings();

  /** Handle file attachment for new thought */
  const handleFileAttach = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const prefix = file.type.startsWith('image/') ? '![]' : '[]';
      const link = `${prefix}(uploads/${file.name})`;
      setNewThought(prev => prev ? `${prev}\n${link}` : link);
    } catch { /* ignore */ }
    e.target.value = '';
  }, []);

  const toggleSelectThought = useCallback((index: number, shiftKey: boolean) => {
    setSelectedThoughts(prev => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedIdx !== null) {
        const start = Math.min(lastSelectedIdx, index);
        const end = Math.max(lastSelectedIdx, index);
        for (let i = start; i <= end; i++) next.add(i);
      } else if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
    setLastSelectedIdx(index);
  }, [lastSelectedIdx]);

  /** Detect whether user has scrolled up from the bottom. */
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setShowScrollButton(!atBottom);
  }, []);

  /** Scroll to the bottom of the thought list. */
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, []);

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

  /** Delete a thought by index. */
  const deleteThought = useCallback((index: number) => {
    const updated = thoughts.filter((t) => t.index !== index).map((t, i) => ({ index: i, text: t.text }));
    onContentChange(rebuildContent(updated));
    // Clean up completion state
    setCompleted((prev) => {
      const next = new Set(prev);
      next.delete(index);
      // Shift higher indices down
      const adjusted = new Set<number>();
      for (const v of next) {
        adjusted.add(v > index ? v - 1 : v);
      }
      saveCompleted(adjusted);
      return adjusted;
    });
  }, [thoughts, onContentChange, rebuildContent]);

  /** Add a new thought from the input. */
  const addThought = useCallback(() => {
    const text = newThought.trim();
    if (!text) return;
    const updated = [...thoughts, { index: thoughts.length, text }];
    onContentChange(rebuildContent(updated));
    setNewThought('');
    // Auto-scroll to bottom to show the new thought
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      newThoughtRef.current?.focus();
    }, 50);
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
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); addThought(); }
              if (ctrlEnterToSend && e.key === 'Enter' && e.shiftKey) { e.preventDefault(); addThought(); }
              if (e.key === 'Escape') setNewThought('');
            }}
            placeholder="Write a thought…"
            className="w-full bg-transparent border border-border/30 rounded-lg px-2.5 py-2 text-sm text-foreground/70 placeholder:text-muted-foreground/30 font-mono outline-none resize-none focus:border-primary/40 transition-colors min-h-[60px]"
            rows={3}
          />
          <div className="flex items-center gap-1">
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-2 py-1 rounded-md text-[0.6rem] text-muted-foreground/50 hover:text-foreground hover:bg-foreground/[0.04] transition-colors" title="Attach file"><Paperclip size={12} /></button>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,.md,.txt" className="hidden" onChange={handleFileAttach} />
          </div>
        </div>
      </div>
    );
  }

  const filteredThoughts = thoughtsTab === 'active' ? thoughts.filter(t => !completed.has(t.index)) : thoughts.filter(t => completed.has(t.index));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border/20 shrink-0">
        <button onClick={() => setThoughtsTab('active')} className={`text-[0.6rem] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm transition-colors ${thoughtsTab === 'active' ? 'bg-primary/15 text-primary' : 'text-muted-foreground/60 hover:text-foreground'}`}>Active ({thoughts.length - completed.size})</button>
        {completed.size > 0 && <button onClick={() => setThoughtsTab('completed')} className={`text-[0.6rem] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm transition-colors ${thoughtsTab === 'completed' ? 'bg-primary/15 text-primary' : 'text-muted-foreground/60 hover:text-foreground'}`}>Done ({completed.size})</button>}
        <button onClick={() => { setSelectMode(!selectMode); if (selectMode) setSelectedThoughts(new Set()); }} className={`text-[0.6rem] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm transition-colors ml-auto ${selectMode ? 'bg-primary/15 text-primary' : 'text-muted-foreground/60 hover:text-foreground'}`}>{selectMode ? 'Done' : 'Select'}</button>
      </div>
      {/* Thought list */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-2 space-y-1.5 relative">
        {filteredThoughts.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-[0.667rem] text-muted-foreground/40">{thoughtsTab === 'active' ? 'No active thoughts' : 'No completed thoughts'}</div>
        ) : filteredThoughts.map(thought => (
          <ThoughtCard
            key={thought.index}
            thought={thought}
            thoughtNumber={thought.index + 1}
            completed={completed.has(thought.index)}
            pending={pendingIdx === thought.index}
            selectMode={selectMode}
            selected={selectedThoughts.has(thought.index)}
            onToggleSelect={(shiftKey) => toggleSelectThought(thought.index, shiftKey)}
            onToggleComplete={() => toggleComplete(thought.index)}
            onEdit={(newText) => {
              const updated = thoughts.map((t) =>
                t.index === thought.index ? { ...t, text: newText } : t
              );
              onContentChange(rebuildContent(updated));
            }}
            onDelete={() => deleteThought(thought.index)}
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

        {/* Batch send bar */}
        {selectedThoughts.size > 0 && (
          <div className="sticky bottom-2 flex justify-center pointer-events-none">
            <button onClick={sendSelectedThoughts} className="pointer-events-auto inline-flex items-center gap-2 rounded-xl bg-primary/15 text-primary hover:bg-primary/25 transition-colors px-4 py-2 text-[0.667rem] font-semibold uppercase tracking-wider shadow-sm"><Send size={12} /> Send {selectedThoughts.size} thought{selectedThoughts.size > 1 ? 's' : ''} to chat</button>
          </div>
        )}
        {/* Scroll-to-bottom button */}
        {showScrollButton && selectedThoughts.size === 0 && (
          <div className="sticky bottom-2 flex justify-center pointer-events-none">
            <button
              onClick={scrollToBottom}
              className="pointer-events-auto size-7 flex items-center justify-center rounded-full bg-muted/80 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted shadow-sm transition-all duration-200 animate-in fade-in zoom-in-50"
              title="Scroll to bottom"
              aria-label="Scroll to bottom"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* New thought input */}
      <div className="p-2 border-t border-border/20">
        <textarea
          ref={newThoughtRef}
          value={newThought}
          onChange={(e) => setNewThought(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); addThought(); }
            if (ctrlEnterToSend && e.key === 'Enter' && e.shiftKey) { e.preventDefault(); addThought(); }
            if (e.key === 'Escape') setNewThought('');
          }}
          placeholder="New thought…"
          className="w-full bg-transparent border border-border/30 rounded-lg px-2.5 py-2 text-sm text-foreground/70 placeholder:text-muted-foreground/30 font-mono outline-none resize-none focus:border-primary/40 transition-colors min-h-[60px]"
          rows={3}
        />
        <div className="flex items-center gap-1">
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-2 py-1 rounded-md text-[0.6rem] text-muted-foreground/50 hover:text-foreground hover:bg-foreground/[0.04] transition-colors" title="Attach file"><Paperclip size={12} /></button>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf,.md,.txt" className="hidden" onChange={handleFileAttach} />
        </div>
      </div>
    </div>
  );
}

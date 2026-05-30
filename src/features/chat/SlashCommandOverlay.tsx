/**
 * SlashCommandOverlay — Shows available commands when typing "/" in chat input.
 */

import { useState, useEffect, useRef, useMemo } from 'react';

interface SlashCommand {
  id: string;
  label: string;
  description: string;
  usage: string;
  icon?: string;
}

const COMMANDS: SlashCommand[] = [
  { id: '/btw', label: '/btw <query>', description: 'Background research — sends query to Research tab while chat continues', usage: '/btw What is the weather in Tokyo?', icon: '🔬' },
  { id: '/help', label: '/help', description: 'Show keyboard shortcuts and available commands', usage: '/help', icon: '❓' },
  { id: '/reset', label: '/reset', description: 'Reset the current conversation', usage: '/reset', icon: '🔄' },
  { id: '/new', label: '/new', description: 'Start a new conversation', usage: '/new', icon: '✨' },
];

interface SlashCommandOverlayProps {
  /** Current text in the input (used to filter commands). */
  text: string;
  /** Called when a command is selected — pass the full command text to insert. */
  onSelect: (commandText: string) => void;
  /** Called to close the overlay. */
  onClose: () => void;
  /** Ref for the input element (for focus management). */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function SlashCommandOverlay({ text, onSelect, onClose }: SlashCommandOverlayProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands based on what the user typed after /
  const query = text.startsWith('/') ? text.slice(1).toLowerCase() : '';
  const filtered = useMemo(
    () => COMMANDS.filter(c => c.id.slice(1).toLowerCase().startsWith(query)),
    [query],
  );

  // Reset selection when filtered list changes
  useEffect(() => { setSelectedIdx(0); }, [filtered.length]);

  // Keyboard navigation within the overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered[selectedIdx]) {
          e.preventDefault();
          onSelect(filtered[selectedIdx].usage);
        }
      }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'Backspace' && query === '') { onClose(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [filtered, selectedIdx, onSelect, onClose, query]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 z-50 mx-3">
      <div ref={listRef} className="rounded-xl border border-border/40 bg-card shadow-xl overflow-hidden">
        <div className="px-3 py-1.5 text-[0.55rem] font-semibold uppercase tracking-wider text-muted-foreground/40 border-b border-border/20">
          Commands
        </div>
        {filtered.map((cmd, i) => (
          <button
            key={cmd.id}
            onClick={() => onSelect(cmd.usage)}
            onMouseEnter={() => setSelectedIdx(i)}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left text-xs transition-colors ${
              i === selectedIdx ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-secondary/30'
            }`}
          >
            <span className="text-sm">{cmd.icon}</span>
            <div className="min-w-0 flex-1">
              <span className="font-mono text-[0.65rem] text-primary/80">{cmd.label}</span>
              <p className="text-[0.55rem] text-muted-foreground/60 mt-0.5 line-clamp-1">{cmd.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

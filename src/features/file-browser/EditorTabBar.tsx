import { useState, useRef, useEffect } from 'react';
import { EditorTab } from './EditorTab';
import { Save } from 'lucide-react';
import type { OpenFile } from './types';
import type { OpenBeadTab } from '@/features/beads';

interface EditorTabBarProps {
  activeTab: string;
  openFiles: OpenFile[];
  openBeads?: OpenBeadTab[];
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  /** Create a new markdown file or open a file browser for import. */
  onNewFile?: () => void;
  /** Open file picker for import. */
  onOpenFile?: () => void;
  /** Whether the agent is generating — pulses the chat tab. */
  isGenerating?: boolean;
}

export function EditorTabBar({
  activeTab,
  openFiles,
  openBeads = [],
  onSelectTab,
  onCloseTab,
  onNewFile,
  onOpenFile,
  isGenerating,
}: EditorTabBarProps) {
  return (
    <div
      className="flex items-center h-9 border-b border-border bg-background overflow-x-auto scrollbar-hide"
      role="tablist"
      aria-label="Open files"
    >
      {/* Pinned chat tab */}
      <EditorTab
        id="chat"
        label="Chat"
        active={activeTab === 'chat'}
        pinned
        glow={isGenerating}
        onSelect={() => onSelectTab('chat')}
      />

      {/* File tabs */}
      {openFiles.map((file) => (
        <EditorTab
          key={file.path}
          id={file.path}
          label={file.name}
          active={activeTab === file.path}
          dirty={file.dirty}
          locked={file.locked}
          tooltip={file.path}
          onSelect={() => onSelectTab(file.path)}
          onClose={() => onCloseTab(file.path)}
          onMiddleClick={() => onCloseTab(file.path)}
        />
      ))}

      {/* Bead viewer tabs */}
      {openBeads.map((bead) => (
        <EditorTab
          key={bead.id}
          id={bead.id}
          label={bead.name}
          active={activeTab === bead.id}
          tooltip={bead.beadId}
          onSelect={() => onSelectTab(bead.id)}
          onClose={() => onCloseTab(bead.id)}
          onMiddleClick={() => onCloseTab(bead.id)}
        />
      ))}

      {/* Save button — visible when a file tab is active */}
      {activeTab !== 'chat' && (
        <button
          onClick={() => {
            // Dispatch a custom event that the FileEditor listens for
            window.dispatchEvent(new CustomEvent('nerve:save-file', { detail: { path: activeTab } }));
          }}
          className="flex items-center justify-center h-full min-w-[28px] px-1 text-muted-foreground/50 hover:text-foreground transition-colors shrink-0"
          title="Save file (Ctrl+S)"
          aria-label="Save file"
        >
          <Save size={13} />
        </button>
      )}

      {/* New file / Open file dropdown */}
      {(onNewFile || onOpenFile) && <NewFileDropdown onNewFile={onNewFile} onOpenFile={onOpenFile} />}
    </div>
  );
}

/** Dropdown for new file / open file actions. */
function NewFileDropdown({ onNewFile, onOpenFile }: { onNewFile?: () => void; onOpenFile?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center h-full min-w-[32px] px-1.5 text-muted-foreground/50 hover:text-foreground transition-colors"
        aria-label="Create or open file"
        title="Create or open file"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-xl border border-border/60 bg-card shadow-[0_16px_40px_rgba(0,0,0,0.24)] p-1 overflow-hidden">
          {onNewFile && (
            <button
              onClick={() => { onNewFile(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-[0.733rem] text-foreground/80 hover:bg-foreground/[0.06] rounded-lg transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
              New Markdown file
            </button>
          )}
          {onOpenFile && (
            <button
              onClick={() => { onOpenFile(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-[0.733rem] text-foreground/80 hover:bg-foreground/[0.06] rounded-lg transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Open file
            </button>
          )}
        </div>
      )}
    </div>
  );
}

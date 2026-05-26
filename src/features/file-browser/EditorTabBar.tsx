import { EditorTab } from './EditorTab';
import type { OpenFile } from './types';
import type { OpenBeadTab } from '@/features/beads';

interface EditorTabBarProps {
  activeTab: string;
  openFiles: OpenFile[];
  openBeads?: OpenBeadTab[];
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewFile?: () => void;
}

export function EditorTabBar({
  activeTab,
  openFiles,
  openBeads = [],
  onSelectTab,
  onCloseTab,
  onNewFile,
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

      {/* New file button */}
      {onNewFile && (
        <button
          onClick={onNewFile}
          className="flex items-center justify-center h-full min-w-[32px] px-1.5 text-muted-foreground/50 hover:text-foreground transition-colors shrink-0"
          aria-label="Create new markdown file"
          title="Create new markdown file"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      )}
    </div>
  );
}

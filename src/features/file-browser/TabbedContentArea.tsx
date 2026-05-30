/**
 * TabbedContentArea — Container with tab bar that switches between
 * the chat panel and open file editors.
 *
 * Chat panel is always mounted (hidden via CSS, never unmounted)
 * to preserve scroll position, streaming state, and input draft.
 */

import { type ReactNode, lazy, Suspense, useState, useCallback, useRef } from 'react';
import { Loader2, AlertTriangle, X } from 'lucide-react';
import { EditorTabBar } from './EditorTabBar';
import { ImageViewer } from './ImageViewer';
import { MarkdownDocumentView } from './MarkdownDocumentView';
import { PdfViewer } from './PdfViewer';
import { isImageFile, isMarkdownFile, isPdfFile } from './utils/fileTypes';
import type { OpenFile } from './types';
import { BeadViewerTab, type BeadLinkTarget, type OpenBeadTab } from '@/features/beads';

// Lazy-load CodeMirror editor — keeps it out of the initial bundle
const FileEditor = lazy(() => import('./FileEditor'));

function EditorFallback() {
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground text-xs gap-2">
      <Loader2 className="animate-spin" size={14} />
      Loading editor...
    </div>
  );
}

interface SaveToast {
  agentId?: string;
  path: string;
  type: 'conflict';
}

interface TabbedContentAreaProps {
  activeTab: string;
  openFiles: OpenFile[];
  openBeads?: OpenBeadTab[];
  workspaceAgentId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onContentChange: (path: string, content: string) => void;
  onSaveFile: (path: string) => void;
  onRetryFile: (path: string) => void;
  onReloadFile?: (path: string) => void;
  onOpenWorkspacePath?: (path: string, basePath?: string) => void | Promise<void>;
  onOpenBeadId?: (target: BeadLinkTarget) => void;
  pathLinkPrefixes?: string[];
  pathLinkAliases?: Record<string, string>;
  saveToast?: SaveToast | null;
  onDismissToast?: () => void;
  onNewFile?: () => void;
  onOpenFile?: () => void;
  /** Whether the agent is currently generating — pulses the chat tab. */
  isGenerating?: boolean;
  /** The chat panel rendered as-is (never unmounted). */
  chatPanel: ReactNode;
}

export function TabbedContentArea({
  activeTab,
  openFiles,
  openBeads = [],
  workspaceAgentId,
  onSelectTab,
  onCloseTab,
  onContentChange,
  onSaveFile,
  onRetryFile,
  onReloadFile,
  onOpenWorkspacePath,
  onOpenBeadId,
  pathLinkPrefixes,
  pathLinkAliases,
  saveToast,
  onDismissToast,
  onNewFile,
  onOpenFile,
  isGenerating,
  chatPanel,
}: TabbedContentAreaProps) {
  const hasOpenTabs = openFiles.length > 0 || openBeads.length > 0;
  const visibleSaveToast = saveToast && (!saveToast.agentId || saveToast.agentId === workspaceAgentId)
    ? saveToast
    : null;

  // Split view state — percentage for chat pane width
  const [chatSplitPct, setChatSplitPct] = useState(() => {
    try { return Number(localStorage.getItem('nerve:chat-split-pct')) || 50; } catch { return 50; }
  });
  const [chatCollapsed, setChatCollapsed] = useState(() => {
    try { return localStorage.getItem('nerve:chat-collapsed') === 'true'; } catch { return false; }
  });
  const isResizing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = Math.max(20, Math.min(80, ((ev.clientX - rect.left) / rect.width) * 100));
      setChatSplitPct(pct);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      try { localStorage.setItem('nerve:chat-split-pct', String(chatSplitPct)); } catch {}
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [chatSplitPct]);

  const isSplitView = hasOpenTabs && activeTab !== 'chat';

  return (
    <div className="h-full flex flex-col min-h-0 min-w-0">
      {/* Tab bar — always visible (Chat tab + new file button) */}
      <EditorTabBar
        activeTab={activeTab}
        openFiles={openFiles}
        openBeads={openBeads}
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
        onNewFile={onNewFile}
        onOpenFile={onOpenFile}
        isGenerating={isGenerating}
      />

      {/* Content area */}
      <div ref={containerRef} className="flex-1 min-h-0 relative flex flex-row">
        {isSplitView ? (
          <>
            {/* Chat pane — left side in split view */}
            <div
              className="min-w-0 overflow-hidden border-r border-border/40 flex flex-col"
              style={{ width: chatCollapsed ? 32 : `${chatSplitPct}%` }}
              role="tabpanel"
              id="tabpanel-chat"
              aria-labelledby="tab-chat"
            >
              {chatCollapsed ? (
                <div className="flex items-center justify-center py-2">
                  <button
                    onClick={() => {
                      const next = false;
                      setChatCollapsed(next);
                      try { localStorage.setItem('nerve:chat-collapsed', 'false'); } catch {}
                    }}
                    className="size-6 flex items-center justify-center rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
                    title="Show chat"
                    aria-label="Show chat"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between px-2 py-0.5 shrink-0 border-b border-border/20">
                    <span className="text-[0.6rem] font-semibold tracking-wider text-muted-foreground/60">Chat</span>
                    <button
                      onClick={() => {
                        const next = true;
                        setChatCollapsed(next);
                        try { localStorage.setItem('nerve:chat-collapsed', 'true'); } catch {}
                      }}
                      className="size-5 flex items-center justify-center rounded-md text-muted-foreground/30 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
                      title="Hide chat panel"
                      aria-label="Hide chat panel"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    {chatPanel}
                  </div>
                </div>
              )}
            </div>

            {/* Resize handle — only visible when chat is expanded */}
            {!chatCollapsed && (
              <div
                className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-primary/30 active:bg-primary/50 transition-colors relative z-10"
                onMouseDown={handleMouseDown}
              >
                <div className="absolute inset-y-0 -left-1 -right-1" />
              </div>
            )}

            {/* Document pane — right side in split view */}
            <div
              className="flex-1 min-w-0 overflow-hidden"
            >
              {openFiles.map((file) => (
                <div
                  key={file.path}
                  className={activeTab === file.path ? 'h-full' : 'hidden'}
                  role="tabpanel"
                  id={`tabpanel-${file.path}`}
                  aria-labelledby={`tab-${file.path}`}
                >
                  {isImageFile(file.name) ? (
                    <ImageViewer file={file} agentId={workspaceAgentId} />
                  ) : isPdfFile(file.name) ? (
                    <PdfViewer file={file} agentId={workspaceAgentId} />
                  ) : isMarkdownFile(file.name) ? (
                    <MarkdownDocumentView
                      file={file}
                      onContentChange={onContentChange}
                      onSave={onSaveFile}
                      onRetry={onRetryFile}
                      onOpenWorkspacePath={onOpenWorkspacePath}
                      onOpenBeadId={onOpenBeadId}
                      pathLinkAliases={pathLinkAliases}
                      workspaceAgentId={workspaceAgentId}
                    />
                  ) : (
                    <Suspense fallback={<EditorFallback />}>
                      <FileEditor
                        file={file}
                        onContentChange={onContentChange}
                        onSave={onSaveFile}
                        onRetry={onRetryFile}
                      />
                    </Suspense>
                  )}
                </div>
              ))}
              {/* Bead viewer tabs */}
              {openBeads.map((bead) => (
                <div
                  key={bead.id}
                  className={activeTab === bead.id ? 'h-full' : 'hidden'}
                  role="tabpanel"
                  id={`tabpanel-${bead.id}`}
                  aria-labelledby={`tab-${bead.id}`}
                >
                  <BeadViewerTab
                    beadTarget={{
                      beadId: bead.beadId,
                      explicitTargetPath: bead.explicitTargetPath,
                      currentDocumentPath: bead.currentDocumentPath,
                      workspaceAgentId: bead.workspaceAgentId,
                    }}
                    onOpenBeadId={onOpenBeadId}
                    onOpenWorkspacePath={onOpenWorkspacePath}
                    pathLinkPrefixes={pathLinkPrefixes}
                    pathLinkAliases={pathLinkAliases}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Chat panel — full width when no file is open */}
            <div className="h-full flex-1" role="tabpanel" id="tabpanel-chat" aria-labelledby="tab-chat">
              {chatPanel}
            </div>

            {/* File editors hidden */}
            {openFiles.map((file) => (
              <div key={file.path} className="hidden">
                {isImageFile(file.name) ? (
                  <ImageViewer file={file} agentId={workspaceAgentId} />
                ) : isPdfFile(file.name) ? (
                  <PdfViewer file={file} agentId={workspaceAgentId} />
                ) : isMarkdownFile(file.name) ? (
                  <MarkdownDocumentView
                    file={file}
                    onContentChange={onContentChange}
                    onSave={onSaveFile}
                    onRetry={onRetryFile}
                    onOpenWorkspacePath={onOpenWorkspacePath}
                    onOpenBeadId={onOpenBeadId}
                    pathLinkAliases={pathLinkAliases}
                    workspaceAgentId={workspaceAgentId}
                  />
                ) : (
                  <Suspense fallback={<EditorFallback />}>
                    <FileEditor
                      file={file}
                      onContentChange={onContentChange}
                      onSave={onSaveFile}
                      onRetry={onRetryFile}
                    />
                  </Suspense>
                )}
              </div>
            ))}
            {openBeads.map((bead) => (
              <div key={bead.id} className="hidden">
                <BeadViewerTab
                  beadTarget={{
                    beadId: bead.beadId,
                    explicitTargetPath: bead.explicitTargetPath,
                    currentDocumentPath: bead.currentDocumentPath,
                    workspaceAgentId: bead.workspaceAgentId,
                  }}
                  onOpenBeadId={onOpenBeadId}
                  onOpenWorkspacePath={onOpenWorkspacePath}
                  pathLinkPrefixes={pathLinkPrefixes}
                  pathLinkAliases={pathLinkAliases}
                />
              </div>
            ))}
          </>
        )}

        {/* Save conflict toast — overlaid on top */}
        {visibleSaveToast && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
            <AlertTriangle size={14} className="text-destructive shrink-0" />
            <span className="text-foreground">File changed externally.</span>
            {onReloadFile && (
              <button
                className="text-primary text-xs font-medium hover:underline"
                onClick={() => { onReloadFile(visibleSaveToast.path); onDismissToast?.(); }}
              >
                Reload
              </button>
            )}
            <button
              className="ml-1 p-0.5 text-muted-foreground hover:text-foreground"
              onClick={onDismissToast}
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

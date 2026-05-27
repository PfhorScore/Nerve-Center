/**
 * App.tsx - Main application layout component
 *
 * This component focuses on layout and composition.
 * Connection management is handled by useConnectionManager.
 * Dashboard data fetching is handled by useDashboardData.
 */
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useReducer,
  lazy,
  Suspense,
} from 'react';
import { AlertTriangle, CheckCircle2, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { SidebarStrip } from '@/components/SidebarStrip';
import { ContextMenu, ContextMenuItem, ContextMenuDivider } from '@/components/ContextMenu';
import { useGateway } from '@/contexts/GatewayContext';
import { useSessionContext, type SpawnSessionOpts } from '@/contexts/SessionContext';
import { useChat } from '@/contexts/ChatContext';
import { useSettings, type STTInputMode } from '@/contexts/SettingsContext';
import { getSessionKey } from '@/types';
import { useConnectionManager } from '@/hooks/useConnectionManager';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useGatewayRestart } from '@/hooks/useGatewayRestart';
import { ConnectDialog } from '@/features/connect/ConnectDialog';
import { TopBar } from '@/components/TopBar';
import { StatusBar } from '@/components/StatusBar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { WorkspaceSwitchDialog } from '@/components/WorkspaceSwitchDialog';
import { ChatPanel, type ChatPanelHandle } from '@/features/chat/ChatPanel';
import type { TTSProvider } from '@/features/tts/useTTS';
import type { ViewMode } from '@/features/command-palette/commands';
import { ResizablePanels } from '@/components/ResizablePanels';
import { getContextLimit } from '@/lib/constants';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { createCommands } from '@/features/command-palette/commands';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
import { SpawnAgentDialog } from '@/features/sessions/SpawnAgentDialog';
import { DEFAULT_CHAT_PATH_LINKS_CONFIG, parseChatPathLinksConfig } from '@/features/chat/chatPathLinks';
import { FileTreePanel, TabbedContentArea, useOpenFiles, type FileTreeChangeEvent } from '@/features/file-browser';
import { type BeadLinkTarget, type OpenBeadTab, buildBeadTabId } from '@/features/beads';
import { isImageFile } from '@/features/file-browser/utils/fileTypes';
import { buildAgentRootSessionKey, getSessionDisplayLabel } from '@/features/sessions/sessionKeys';
import { shouldGuardWorkspaceSwitch } from '@/features/workspace/workspaceSwitchGuard';
import { getWorkspaceAgentId, getWorkspaceRootSessionKey } from '@/features/workspace/workspaceScope';
import { SelectionTooltip } from '@/components/SelectionTooltip';
import { ThoughtsPanel } from '@/features/thoughts';

// Lazy-loaded features (not needed in initial bundle)
const SettingsDrawer = lazy(() => import('@/features/settings/SettingsDrawer').then(m => ({ default: m.SettingsDrawer })));
const AgentHubDrawer = lazy(() => import('@/features/agents/AgentHubDrawer').then(m => ({ default: m.AgentHubDrawer })));
const CommandPalette = lazy(() => import('@/features/command-palette/CommandPalette').then(m => ({ default: m.CommandPalette })));

const ResearchPanel = lazy(() => import('@/features/research/ResearchPanel').then(m => ({ default: m.ResearchPanel })));
// Lazy-loaded side panels
const SessionList = lazy(() => import('@/features/sessions/SessionList').then(m => ({ default: m.SessionList })));
const WorkspacePanel = lazy(() => import('@/features/workspace/WorkspacePanel').then(m => ({ default: m.WorkspacePanel })));
const AgentActivityPanel = lazy(() => import('@/features/agents/AgentActivityPanel').then(m => ({ default: m.AgentActivityPanel })));
const LibraryPanel = lazy(() => import('@/features/references/LibraryPanel').then(m => ({ default: m.LibraryPanel })));

// ── Panel System Types ──

/**
 * Unique identifier for each draggable panel in the sidebars.
 *
 * New panels must be added here, to {@link DEFAULT_LAYOUT}, to
 * {@link panelName}, and to the rendering ternary in
 * {@link renderPanelSide}.
 */
type PanelId = 'workspace' | 'agents' | 'memory' | 'thoughts' | 'references' | 'activity';

/** Which sidebar a panel lives in. */
type PanelSide = 'left' | 'right';

/**
 * Complete serialisable description of the panel layout.
 *
 * Persisted to `localStorage` under the key `nerve-panel-layout`.
 * Loaded by {@link loadPanelLayout} on mount.
 */
interface PanelLayout {
  /** Ordered panel IDs for the left sidebar. */
  left: PanelId[];
  /** Ordered panel IDs for the right sidebar. */
  right: PanelId[];
  /** Per-panel collapse state. Missing keys default to `false` (expanded). */
  collapsed: Partial<Record<PanelId, boolean>>;
  /** Per-panel flex weight for vertical space distribution. Missing keys default to `1`. */
  flex: Partial<Record<PanelId, number>>;
}

/**
 * Default panel layout used as the base for merging with persisted
 * user configs and as a fallback when `localStorage` is unavailable.
 */const DEFAULT_LAYOUT: PanelLayout = {
  /** Left sidebar holds the workspace file-tree panel. */
  left: ['workspace'],
  /** Right sidebar panels, rendered top-to-bottom in this order. */
  right: ['thoughts', 'references', 'activity'],
  /** Initial collapse state. Thoughts and references start collapsed. */
  collapsed: { thoughts: true, references: true, activity: false },
  /** Flex weights for vertical space distribution (equal by default). */
  flex: { thoughts: 1, references: 1, activity: 1 },
};

/**
 * Load the persisted panel layout from `localStorage`, falling back to
 * {@link DEFAULT_LAYOUT} when no saved config exists or parsing fails.
 *
 * ## Panel placement enforcement
 *
 * Panels have fixed side assignments — some belong exclusively to the
 * left sidebar, others to the right. On every load, any panel found in
 * the wrong sidebar is moved to its correct home. This prevents
 * duplicates that could arise from drag-and-drop accidents or corrupted
 * `localStorage` state.
 *
 * | Panel       | Side  |
 * |-------------|-------|
 * | `workspace` | left  |
 * | `agents`    | right |
 * | `memory`    | right |
 * | `thoughts`  | right |
 * | `tools`     | right |
 * | `activity`  | right |
 *
 * Merged result: `{ ...DEFAULT_LAYOUT, ...parsed }` — user overrides
 * take precedence for flex weights and collapse state, but side
 * assignments are enforced.
 */
function loadPanelLayout(): PanelLayout {
  try {
    const raw = localStorage.getItem('nerve-panel-layout');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.left)) parsed.left = [...new Set(parsed.left)];
      if (Array.isArray(parsed.right)) parsed.right = [...new Set(parsed.right)];

      // Enforce panel placement: prevent any panel from appearing in BOTH sidebars.
      // Cross-sidebar placement is allowed (user's choice), but duplicates are not.
      // This runs only on load to clean up corrupted localStorage states.

      // If a panel is in both left and right, keep it only in its DEFAULT side
      const RIGHT_DEFAULT = new Set<PanelId>(['agents', 'memory', 'thoughts', 'references', 'activity']);
      if (Array.isArray(parsed.right) && Array.isArray(parsed.left)) {
        for (const id of RIGHT_DEFAULT) {
          if (parsed.left.includes(id) && parsed.right.includes(id)) {
            // Duplicate — keep only in right
            parsed.left = parsed.left.filter((p: string) => p !== id);
          }
        }
      }

      // Migrate: ensure newer panels exist in the correct sidebar
      if (Array.isArray(parsed.right) && !parsed.right.includes('tools')) {
        parsed.right = [...parsed.right, 'tools'];
      }
      if (Array.isArray(parsed.right) && !parsed.right.includes('activity')) {
        parsed.right = [...parsed.right, 'activity'];
      }

      // Migrate v2: remove agents and memory from right sidebar (moved to Agent Hub)
      if (Array.isArray(parsed.right)) {
        parsed.right = parsed.right.filter((p: string) => p !== 'agents' && p !== 'memory');
      }

      // Migrate v3: remove tools panel (merged into activity panel)
      if (Array.isArray(parsed.right)) {
        parsed.right = parsed.right.filter((p: string) => p !== 'tools');
      }
      if (Array.isArray(parsed.left)) {
        parsed.left = parsed.left.filter((p: string) => p !== 'tools');
      }

      // Migrate v4: add references panel if missing
      if (Array.isArray(parsed.right) && !parsed.right.includes('references')) {
        const actIdx = parsed.right.indexOf('activity');
        if (actIdx >= 0) {
          parsed.right.splice(actIdx, 0, 'references');
        } else {
          parsed.right.push('references');
        }
      }

      return { ...DEFAULT_LAYOUT, ...parsed };
    }
  } catch {}
  return DEFAULT_LAYOUT;
}

/**
 * Persist the current panel layout to `localStorage`.
 *
 * Note: Unlike {@link loadPanelLayout}, this does NOT enforce side
 * assignments — it preserves whatever the user arranged via drag-and-drop.
 * Enforcement only runs on load to clean up corrupted storage.
 */
function savePanelLayout(layout: PanelLayout) {
  try { localStorage.setItem('nerve-panel-layout', JSON.stringify(layout)); } catch {}
}

// Lazy-loaded view modes
const KanbanPanel = lazy(() => import('@/features/kanban/KanbanPanel').then(m => ({ default: m.KanbanPanel })));
const MarkdownRenderer = lazy(() => import('@/features/markdown/MarkdownRenderer').then(m => ({ default: m.MarkdownRenderer })));

interface AppProps {
  onLogout?: () => void;
}

interface PendingWorkspaceSwitch {
  targetLabel: string;
  execute: () => Promise<void>;
  resolve: (didSwitch: boolean) => void;
  reject: (error: unknown) => void;
}

function buildWorkspaceSwitchErrorMessage(result: {
  failedPath?: string;
  conflict?: boolean;
}): string {
  const fileLabel = result.failedPath || 'a dirty file';
  if (result.conflict) {
    return `${fileLabel} changed on disk. Resolve it before switching agents.`;
  }
  return `Could not save ${fileLabel}. Resolve it before switching agents.`;
}

function getInitialViewMode(canShowKanban: boolean): ViewMode {
  try {
    const saved = localStorage.getItem('nerve:viewMode');
    if (saved === 'kanban' && canShowKanban) return 'kanban';
  } catch {
    // ignore storage errors
  }

  return 'chat';
}

export default function App({ onLogout }: AppProps) {
  // Gateway state
  const {
    connectionState, connectError, reconnectAttempt, model, sparkline,
  } = useGateway();

  // Session state
  const {
    sessions, sessionsLoading, currentSession, setCurrentSession,
    busyState, agentStatus, unreadSessions, refreshSessions, deleteSession, abortSession, spawnSession, renameSession,
    agentLogEntries, eventEntries,
    agentName,
  } = useSessionContext();

  // Chat state
  const {
    messages, isGenerating, stream, processingStage,
    lastEventTimestamp, activityLog, currentToolDescription,
    handleSend, handleAbort, handleReset,
    loadMore, hasMore,
    showResetConfirm, confirmReset, cancelReset,
  } = useChat();

  // Settings state
  const {
    soundEnabled, toggleSound,
    ttsProvider, ttsModel, setTtsProvider, setTtsModel,
    sttProvider, setSttProvider, sttInputMode, setSttInputMode, sttModel, setSttModel,
    wakeWordEnabled, handleToggleWakeWord, handleWakeWordState,
    liveTranscriptionPreview, toggleLiveTranscriptionPreview,
    panelRatio, setPanelRatio,
    eventsVisible, logVisible,
    toggleEvents, toggleLog, toggleTelemetry,
    setTheme, setFont,
    kanbanVisible,
    commandPaletteButtonVisible,
  } = useSettings();

  // Connection management (extracted hook)
  const {
    dialogOpen,
    editableUrl, setEditableUrl,
    officialUrl,
    editableToken, setEditableToken,
    handleConnect, handleReconnect,
    serverSideAuth,
  } = useConnectionManager();

  // Track file change events for tree refresh. Sequence keeps repeated same-path updates visible.
  const [lastChangedEvent, setLastChangedEvent] = useState<FileTreeChangeEvent | null>(null);
  const [revealRequest, setRevealRequest] = useState<{
    id: number;
    path: string;
    kind: 'file' | 'directory';
    agentId: string;
  } | null>(null);
  const fileTreeChangeSequenceRef = useRef(0);

  const initialCompactLayout = typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;
  const initialDesktopFileBrowserCollapsed = (() => {
    try {
      const saved = localStorage.getItem('nerve-file-tree-collapsed');
      if (saved !== null) return saved === 'true';
    } catch {
      // ignore storage errors and fall back to desktop default
    }

    return false;
  })();

  // File browser collapse state for mobile optimization
  const [fileBrowserCollapsed, setFileBrowserCollapsedState] = useState(() => (
    initialCompactLayout ? true : initialDesktopFileBrowserCollapsed
  ));
  const [desktopFileBrowserCollapsed, setDesktopFileBrowserCollapsed] = useState(initialDesktopFileBrowserCollapsed);

  // ── Panel layout state ──
  const [panelLayout, setPanelLayout] = useState<PanelLayout>(() => loadPanelLayout());

  // ── Sidebar collapse state (sidebar-level, separate from per-panel collapse) ──
  /**
   * Whether the left sidebar is collapsed to a thin vertical strip.
   * When collapsed, hovering over the strip temporarily expands it.
   * Persisted to `localStorage` under `nerve-left-sidebar-collapsed`.
   */
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('nerve-left-sidebar-collapsed') === 'true'; } catch { return false; }
  });

  /** Draggable width for the left sidebar (persisted). */
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => {
    try { return Number(localStorage.getItem('nerve-left-sidebar-width')) || 288; } catch { return 288; }
  });

  /**
   * Whether the right sidebar is collapsed to a thin vertical strip.
   * When collapsed, hovering over the strip temporarily expands it.
   * Persisted to `localStorage` under `nerve-right-sidebar-collapsed`.
   */
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('nerve-right-sidebar-collapsed') === 'true'; } catch { return false; }
  });

  /** Tracks whether the left sidebar is temporarily expanded via hover. */
  const [leftHoverExpanded, setLeftHoverExpanded] = useState(false);
  const leftHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Tracks whether the right sidebar is temporarily expanded via hover. */
  const [rightHoverExpanded, setRightHoverExpanded] = useState(false);
  const rightHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Whether hover-to-expand is enabled for the left sidebar. */
  const [leftHoverEnabled, setLeftHoverEnabled] = useState(() => {
    try { return localStorage.getItem('nerve-left-hover-enabled') !== 'false'; } catch { return true; }
  });

  /** Whether hover-to-expand is enabled for the right sidebar. */
  const [rightHoverEnabled, setRightHoverEnabled] = useState(() => {
    try { return localStorage.getItem('nerve-right-hover-enabled') !== 'false'; } catch { return true; }
  });

  /** Right-click context menu state for sidebar strips. */
  const [sidebarContextMenu, setSidebarContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    side: 'left' | 'right';
  }>({ open: false, x: 0, y: 0, side: 'left' });

  /** Whether the Thoughts panel in research view is collapsed. */
  const [researchThoughtsCollapsed, setResearchThoughtsCollapsed] = useState(() => {
    try { return localStorage.getItem('nerve-research-thoughts-collapsed') === 'true'; } catch { return false; }
  });

  /** Right-click context menu on individual panel headers. */
  const [panelContextMenu, setPanelContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    panelId: PanelId;
    currentSide: PanelSide;
  }>({ open: false, x: 0, y: 0, panelId: 'workspace', currentSide: 'left' });

  /**
   * Saved right panel width in pixels, used when restoring from collapsed
   * to hover-expanded state. Updated by the ResizablePanels resize callback.
   */
  const [savedRightPanelWidth, setSavedRightPanelWidth] = useState<number | null>(null);

  /**
   * Toggle the collapsed state of a single panel and persist the
   * updated layout to `localStorage`.
   *
   * Used by the chevron button in each panel header and by the
   * Cmd+K command palette toggle commands.
   */
  const togglePanelCollapse = useCallback((id: PanelId) => {
    setPanelLayout(prev => {
      const next: PanelLayout = {
        ...prev,
        collapsed: { ...prev.collapsed, [id]: !prev.collapsed[id] },
      };
      savePanelLayout(next);
      return next;
    });
  }, []);

  // ── Sidebar-level collapse callbacks ──

  /**
   * Toggle the left sidebar between expanded and collapsed (strip) states.
   * Persists the choice to `localStorage` so it survives page reloads.
   * Resets the hover-expanded flag when collapsing so the strip starts clean.
   */
  const toggleLeftSidebar = useCallback(() => {
    setLeftSidebarCollapsed(prev => {
      const next = !prev;
      setLeftHoverExpanded(false);
      try { localStorage.setItem('nerve-left-sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  }, []);

  /**
   * Toggle the right sidebar between expanded and collapsed (strip) states.
   * Persists the choice to `localStorage`.
   * Resets the hover-expanded flag when collapsing.
   */
  const toggleRightSidebar = useCallback(() => {
    setRightSidebarCollapsed(prev => {
      const next = !prev;
      setRightHoverExpanded(false);
      try { localStorage.setItem('nerve-right-sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  }, []);

  /** Keep both state and ref in sync for drag target updates. */
  const setDropTargetSynced = useCallback((val: { side: PanelSide; index: number } | null) => {
    setDropTarget(val);
    dropTargetRef.current = val;
  }, []);

  // Drag state for panel reordering
  const [dragPanelId, setDragPanelId] = useState<PanelId | null>(null);
  const [dropTarget, setDropTarget] = useState<{ side: PanelSide; index: number } | null>(null);
  /**
   * Ref mirror of {@link dropTarget} for synchronous reads in drag handlers.
   *
   * React state updates during `dragover` are batched asynchronously, but
   * the `drop` event fires synchronously. Reading from this ref ensures
   * `handlePanelDrop` always sees the latest target, even before React has
   * flushed the state update.
   */
  const dropTargetRef = useRef<{ side: PanelSide; index: number } | null>(null);

  /**
   * Move a panel from one sidebar to the other and persist.
   * Used by the right-click context menu on panel headers.
   */
  const movePanelToSide = useCallback((panelId: PanelId, targetSide: PanelSide) => {
    setPanelLayout(prev => {
      const next: PanelLayout = {
        ...prev,
        left: targetSide === 'left'
          ? [...prev.left.filter(p => p !== panelId), panelId]
          : prev.left.filter(p => p !== panelId),
        right: targetSide === 'right'
          ? [...prev.right.filter(p => p !== panelId), panelId]
          : prev.right.filter(p => p !== panelId),
      };
      savePanelLayout(next);
      return next;
    });
  }, []);

  /**
   * Finalise a panel drag-and-drop reorder operation.
   *
   * Moves the dragged panel from its current position to the drop
   * target index in the target sidebar, then persists the new layout.
   * Clears drag state (`dragPanelId`, `dropTarget`) on completion.
   */
  const handlePanelDrop = useCallback(() => {
    const target = dropTargetRef.current;
    if (!dragPanelId || !target) {
      setDragPanelId(null);
      setDropTargetSynced(null);
      dropTargetRef.current = null;
      return;
    }
    const { side, index } = target;
    setPanelLayout(prev => {
      const left = prev.left.filter(p => p !== dragPanelId);
      const right = prev.right.filter(p => p !== dragPanelId);
      const target = side === 'left' ? left : right;
      target.splice(Math.min(index, target.length), 0, dragPanelId);
      const next: PanelLayout = {
        ...prev,
        left: side === 'left' ? left : prev.left.filter(p => p !== dragPanelId),
        right: side === 'right' ? right : prev.right.filter(p => p !== dragPanelId),
      };
      savePanelLayout(next);
      return next;
    });
    setDragPanelId(null);
    setDropTargetSynced(null);
    dropTargetRef.current = null;
  }, [dragPanelId]);

  // Flex resize is handled inline in the panel render (inline mousedown handler)


  // Responsive layout state (chat-first on smaller viewports)
  const [isCompactLayout, setIsCompactLayout] = useState(initialCompactLayout);

  const persistDesktopFileBrowserCollapsed = useCallback((collapsed: boolean) => {
    setDesktopFileBrowserCollapsed(collapsed);

    try {
      localStorage.setItem('nerve-file-tree-collapsed', String(collapsed));
    } catch {
      // ignore storage errors
    }
  }, []);

  const setFileBrowserCollapsed = useCallback((nextCollapsed: boolean | ((prev: boolean) => boolean)) => {
    setFileBrowserCollapsedState(prevCollapsed => {
      const resolvedCollapsed = typeof nextCollapsed === 'function'
        ? nextCollapsed(prevCollapsed)
        : nextCollapsed;

      if (!isCompactLayout) {
        persistDesktopFileBrowserCollapsed(resolvedCollapsed);
      }

      return resolvedCollapsed;
    });
  }, [isCompactLayout, persistDesktopFileBrowserCollapsed]);

  /** Toggle file browser collapse state (mobile). */
  const handleToggleFileBrowser = useCallback(() => {
    setFileBrowserCollapsed(prev => !prev);
  }, [setFileBrowserCollapsed]);

  const workspaceAgentId = useMemo(() => getWorkspaceAgentId(currentSession), [currentSession]);

  // File browser state
  const {
    openFiles, activeTab, setActiveTab,
    openFile, closeFile, updateContent, saveFile, reloadFile,
    handleFileChanged, remapOpenPaths, closeOpenPathsByPrefix,
    hasDirtyFiles, saveAllDirtyFiles, discardAllDirtyFiles,
  } = useOpenFiles(workspaceAgentId);

  // Save with workspace-scoped conflict toast
  const [saveToast, setSaveToast] = useState<{
    agentId: string;
    path: string;
    type: 'conflict';
    workspaceVersion: number;
  } | null>(null);
  const [workspaceVersion, bumpWorkspaceVersion] = useReducer((version: number) => version + 1, 0);
  const saveToastTimerRef = useRef<number | null>(null);
  const workspaceAgentIdRef = useRef(workspaceAgentId);
  const [pendingWorkspaceSwitch, setPendingWorkspaceSwitch] = useState<PendingWorkspaceSwitch | null>(null);
  const [workspaceSwitchAction, setWorkspaceSwitchAction] = useState<'save' | 'discard' | null>(null);
  const [workspaceSwitchError, setWorkspaceSwitchError] = useState<string | null>(null);

  const clearSaveToastTimer = useCallback(() => {
    if (saveToastTimerRef.current !== null) {
      window.clearTimeout(saveToastTimerRef.current);
      saveToastTimerRef.current = null;
    }
  }, []);

  const dismissSaveToast = useCallback(() => {
    clearSaveToastTimer();
    setSaveToast(null);
  }, [clearSaveToastTimer]);

  const showSaveToastForAgent = useCallback((
    targetAgentId: string,
    nextToast: { path: string; type: 'conflict' },
  ) => {
    if (workspaceAgentIdRef.current !== targetAgentId) return;

    clearSaveToastTimer();
    const toastForAgent = {
      ...nextToast,
      agentId: targetAgentId,
      workspaceVersion,
    };
    setSaveToast(toastForAgent);
    saveToastTimerRef.current = window.setTimeout(() => {
      setSaveToast((currentToast) => (currentToast === toastForAgent ? null : currentToast));
      saveToastTimerRef.current = null;
    }, 5000);
  }, [clearSaveToastTimer, workspaceVersion]);

  useEffect(() => {
    workspaceAgentIdRef.current = workspaceAgentId;
    bumpWorkspaceVersion();
    clearSaveToastTimer();
  }, [clearSaveToastTimer, workspaceAgentId]);

  useEffect(() => () => clearSaveToastTimer(), [clearSaveToastTimer]);

  const handleSaveFile = useCallback(async (filePath: string) => {
    const requestAgentId = workspaceAgentId;
    const result = await saveFile(filePath);

    if (workspaceAgentIdRef.current !== requestAgentId) {
      return;
    }

    if (!result.ok) {
      if (result.conflict) {
        showSaveToastForAgent(requestAgentId, { path: filePath, type: 'conflict' });
      }
      return;
    }

    dismissSaveToast();
  }, [dismissSaveToast, saveFile, showSaveToastForAgent, workspaceAgentId]);

  // Single file.changed handler, feeds both open files and tree refresh.
  const onFileChanged = useCallback((path: string, targetAgentId: string) => {
    handleFileChanged(path, targetAgentId);
    setLastChangedEvent({
      path,
      agentId: targetAgentId,
      sequence: ++fileTreeChangeSequenceRef.current,
    });
  }, [handleFileChanged]);

  // Dashboard data (extracted hook) - single SSE connection handles all events
  const { memories, memoriesLoading, tokenData, remoteWorkspace, refreshMemories } = useDashboardData({
    agentId: workspaceAgentId,
    onFileChanged,
  });

  // UI state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [agentHubOpen, setAgentHubOpen] = useState(false);
  const [booted, setBooted] = useState(false);
  const [logGlow, setLogGlow] = useState(false);
  const [scratchPadContent, setScratchPadContent] = useState(() => {
    try {
      const stored = localStorage.getItem('nerve-scratch-pad');
      if (stored) return stored;
      const backup = sessionStorage.getItem('nerve-scratch-pad-backup');
      if (backup) { localStorage.setItem('nerve-scratch-pad', backup); return backup; }
      return '';
    } catch { return ''; }
  });

  const scratchPadRef = useRef(scratchPadContent);
  const scratchPadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function guessDeviceLabel(): string {
    const ua = navigator.userAgent;
    if (/Firefox/i.test(ua) && !/Seamonkey/i.test(ua)) return 'Zen/Firefox';
    if (/Edg/i.test(ua)) return 'Edge';
    if (/Chrome/i.test(ua) || /Chromium/i.test(ua)) return 'Chromium';
    if (/Safari/i.test(ua)) return 'Safari';
    return 'Other Browser';
  }

  const persistScratchPad = useCallback((content: string) => {
    scratchPadRef.current = content;
    setScratchPadContent(content);
    try { localStorage.setItem('nerve-scratch-pad', content); } catch {}
    try { sessionStorage.setItem('nerve-scratch-pad-backup', content); } catch {}
    if (scratchPadTimer.current) clearTimeout(scratchPadTimer.current);
    scratchPadTimer.current = setTimeout(() => {
      fetch('/api/files/write', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'scratchpad.md', content: scratchPadRef.current }),
      }).catch(() => {});
    }, 500);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/files/read?path=scratchpad.md')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.ok) return;
        const serverContent: string = data.content || '';
        const localContent: string = scratchPadRef.current;
        const alreadyMigrated = localStorage.getItem('nerve-scratch-pad-migrated');
        if (alreadyMigrated) {
          if (serverContent && serverContent !== localContent) {
            persistScratchPad(serverContent);
          }
          return;
        }
        if (serverContent && localContent && serverContent !== localContent) {
          const label = guessDeviceLabel();
          const merged = `${serverContent}\n\n---\n*From ${label} (${new Date().toLocaleDateString()})*\n\n${localContent}`;
          persistScratchPad(merged);
        } else if (serverContent && !localContent) {
          persistScratchPad(serverContent);
        }
        localStorage.setItem('nerve-scratch-pad-migrated', 'true');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const [scratchPadPreview, setScratchPadPreview] = useState(false);
  /**
   * Search query for the Thoughts scratch-pad textarea.
   *
   * When non-empty, matching text in the textarea is highlighted and the
   * first match is scrolled into view. A small search bar is shown at the
   * top of the Thoughts panel when this is active.
   *
   * @see ThoughtsSearchBar
   */
  const [thoughtsSearch, setThoughtsSearch] = useState('');

  /**
   * Selected text + position for the Thoughts "Send to chat" floating button.
   * When the user selects text in either Thoughts textarea, a small "→" button
   * appears near the selection. Clicking it dispatches a `nerve:send-to-chat` event
   * which appends the selected text to the chat input and sends it.
   */
  const [thoughtsSelection, setThoughtsSelection] = useState<{
    text: string;
    /** Y position relative to viewport for the floating button. */
    y: number;
    /** X position relative to viewport for the floating button. */
    x: number;
    source: 'sidebar' | 'research';
  } | null>(null);

  /** Handle "Send to chat" from Thoughts selection */
  /** Clear the Thoughts search state. */
  const clearThoughtsSearch = useCallback(() => setThoughtsSearch(''), []);

  const handleThoughtsSendToChat = useCallback(() => {
    if (!thoughtsSelection?.text.trim()) return;
    window.dispatchEvent(new CustomEvent('nerve:send-to-chat', {
      detail: { text: thoughtsSelection.text.trim() },
    }));
    setThoughtsSelection(null);
  }, [thoughtsSelection]);
  const [isMobileTopBarHidden, setIsMobileTopBarHidden] = useState(false);

  /**
   * Return the effective right-sidebar pixel width for ResizablePanels.
   *
   * Priority:
   * 1. `rightSidebarCollapsed` → 40 px (strip), or `savedRightPanelWidth` when hover-expanded
   * 2. All right panels individually collapsed → 0
   * 4. Otherwise → `null` (percentage mode)
   */
  const computedRightWidthPx = useMemo(() => {
    if (rightSidebarCollapsed) {
      return rightHoverExpanded ? (savedRightPanelWidth ?? 280) : 40;
    }
    if (panelLayout.right.every(p => panelLayout.collapsed[p])) return 0;
    // Non-collapsed expanded mode: use percentage-based layout so the
    // right sidebar naturally shrinks/grows with the browser window.
    return null;
  }, [rightSidebarCollapsed, rightHoverExpanded, savedRightPanelWidth, panelLayout.right, panelLayout.collapsed]);

  /**
   * Unified handler for ResizablePanels `onRightWidthChange`.
   * Keeps `savedRightPanelWidth` up to date so the right panel restores
   * to the correct width after collapse/re-expand.
   */
  const handleRightWidthChange = useCallback((width: number) => {
    setSavedRightPanelWidth(width);
  }, []);

  const prevLogCount = useRef(0);
  const chatPanelRef = useRef<ChatPanelHandle>(null);
  /** Ref for the sidebar Thoughts textarea — used for selection-based "Send to chat" button positioning. */
  const sidebarThoughtsRef = useRef<HTMLTextAreaElement>(null);
  /** Ref for the research-view Thoughts textarea — same purpose as above. */
  const researchThoughtsRef = useRef<HTMLTextAreaElement>(null);

  // Gateway restart
  const {
    showGatewayRestartConfirm,
    gatewayRestarting,
    gatewayRestartNotice,
    handleGatewayRestart,
    cancelGatewayRestart,
    confirmGatewayRestart,
    dismissNotice,
  } = useGatewayRestart();

  // Command palette state
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [spawnDialogOpen, setSpawnDialogOpen] = useState(false);

  // View mode state (chat | kanban), persisted to localStorage
  const [viewMode, setViewModeRaw] = useState<ViewMode>(() => getInitialViewMode(kanbanVisible));
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [openBeads, setOpenBeads] = useState<OpenBeadTab[]>([]);
  const setViewMode = useCallback((mode: ViewMode) => {
    const nextMode = mode === 'kanban' && !kanbanVisible ? 'chat' : mode;
    setViewModeRaw(nextMode);

    if (nextMode === 'kanban' && isCompactLayout) {
      setFileBrowserCollapsed(true);
    }

    try { localStorage.setItem('nerve:viewMode', nextMode); } catch { /* ignore */ }
  }, [isCompactLayout, kanbanVisible, setFileBrowserCollapsed]);
  const [chatPathLinkPrefixes, setChatPathLinkPrefixes] = useState<string[]>(
    DEFAULT_CHAT_PATH_LINKS_CONFIG.prefixes,
  );
  const [chatPathLinkAliases, setChatPathLinkAliases] = useState<Record<string, string>>(
    DEFAULT_CHAT_PATH_LINKS_CONFIG.aliases,
  );
  const [addToChatEnabled, setAddToChatEnabled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ agentId: workspaceAgentId });
    const controller = new AbortController();

    void fetch(`/api/workspace/chatPathLinks?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) {
          setChatPathLinkPrefixes(DEFAULT_CHAT_PATH_LINKS_CONFIG.prefixes);
          setChatPathLinkAliases(DEFAULT_CHAT_PATH_LINKS_CONFIG.aliases);
          return;
        }
        const data = await res.json() as { ok: boolean; content?: string };
        if (!data.ok || !data.content) {
          setChatPathLinkPrefixes(DEFAULT_CHAT_PATH_LINKS_CONFIG.prefixes);
          setChatPathLinkAliases(DEFAULT_CHAT_PATH_LINKS_CONFIG.aliases);
          return;
        }
        const parsed = parseChatPathLinksConfig(data.content);
        setChatPathLinkPrefixes(parsed.prefixes);
        setChatPathLinkAliases(parsed.aliases);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setChatPathLinkPrefixes(DEFAULT_CHAT_PATH_LINKS_CONFIG.prefixes);
          setChatPathLinkAliases(DEFAULT_CHAT_PATH_LINKS_CONFIG.aliases);
        }
      });

    return () => controller.abort();
  }, [workspaceAgentId]);

  useEffect(() => {
    const controller = new AbortController();
    let retryTimer: number | null = null;
    let attempts = 0;
    const maxAttempts = 3;

    const loadUploadConfig = () => {
      attempts += 1;

      void fetch('/api/upload-config', { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (controller.signal.aborted) return;

          if (data) {
            setAddToChatEnabled(Boolean(data.fileReferenceEnabled));
            return;
          }

          if (attempts >= maxAttempts) {
            setAddToChatEnabled(false);
            return;
          }

          retryTimer = window.setTimeout(loadUploadConfig, 1000);
        })
        .catch(() => {
          if (controller.signal.aborted) return;

          if (attempts >= maxAttempts) {
            setAddToChatEnabled(false);
            return;
          }

          retryTimer = window.setTimeout(loadUploadConfig, 1000);
        });
    };

    loadUploadConfig();

    return () => {
      controller.abort();
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, []);

  useEffect(() => {
    if (kanbanVisible || viewMode !== 'kanban') return;
    setViewMode('chat');
  }, [kanbanVisible, setViewMode, viewMode]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { text?: string } | undefined;
      if (detail?.text) {
        handleSend(detail.text);
      }
    };
    window.addEventListener('nerve:send-to-chat', handler);
    return () => window.removeEventListener('nerve:send-to-chat', handler);
  }, [handleSend]);

  /**
   * Selection tracking for Thoughts "Send to chat" button.
   *
   * Listens for `selectionchange` on the document. When the selection is inside
   * one of the Thoughts textareas and has content, shows a floating "→" button
   * positioned relative to the textarea. On `mouseup` outside or empty selection,
   * hides the button.
   */
  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() || '';
      if (text.length > 2 && text.length < 2000) {
        const activeEl = document.activeElement;
        // Only show for the thoughts textareas
        if (activeEl === sidebarThoughtsRef.current || activeEl === researchThoughtsRef.current) {
          const rect = (activeEl as HTMLTextAreaElement).getBoundingClientRect?.();
          // Position the button at the top-right area of the textarea
          if (rect) {
            setThoughtsSelection({ text, x: rect.right, y: rect.top - 4, source: activeEl === sidebarThoughtsRef.current ? 'sidebar' : 'research' });
            return;
          }
        }
      }
      setThoughtsSelection(null);
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  // Send conversation to Research tab
  const handleSendToResearch = useCallback(() => {
    // Skip tool calls/results, only keep user messages and actual assistant text
    const meaningful = messages.filter(m => {
      if (m.role === 'user') return true;
      if (m.role === 'assistant' && !m.isThinking && !m.intermediate) return true;
      return false;
    });

    const transcript = meaningful
      .slice(-15)
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.rawText.slice(0, 2000)}`)
      .join('\n\n');

    if (transcript) {
      try { sessionStorage.setItem('nerve:research-transcript', transcript); } catch {}
    }
    setViewMode('research');
  }, [messages, setViewMode]);

  // Listen for "Research this?" selection tooltip events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.text) {
        try { sessionStorage.setItem('nerve:research-direct-query', detail.text.slice(0, 500)); } catch {}
        setViewMode('research');
      }
    };
    window.addEventListener('nerve:send-to-research', handler);
    return () => window.removeEventListener('nerve:send-to-research', handler);
  }, [setViewMode]);

  const openBeadId = useCallback((target: BeadLinkTarget) => {
    const normalizedBeadId = target.beadId.trim();
    if (!normalizedBeadId) return;

    const normalizedTarget: BeadLinkTarget = {
      beadId: normalizedBeadId,
      explicitTargetPath: target.explicitTargetPath?.trim() || undefined,
      currentDocumentPath: target.currentDocumentPath?.trim() || undefined,
      workspaceAgentId: target.workspaceAgentId?.trim() || workspaceAgentId,
    };

    const tabId = buildBeadTabId(normalizedTarget);
    setOpenBeads((prev) => {
      if (prev.some((bead) => bead.id === tabId)) return prev;
      return [...prev, {
        id: tabId,
        beadId: normalizedBeadId,
        name: normalizedBeadId,
        explicitTargetPath: normalizedTarget.explicitTargetPath,
        currentDocumentPath: normalizedTarget.currentDocumentPath,
        workspaceAgentId: normalizedTarget.workspaceAgentId,
      }];
    });
    setActiveTab(tabId);
  }, [setActiveTab, workspaceAgentId]);

  const visibleOpenBeads = useMemo(() => openBeads.filter((bead) => {
    const beadWorkspaceAgentId = bead.workspaceAgentId?.trim() || workspaceAgentId;
    return beadWorkspaceAgentId === workspaceAgentId;
  }), [openBeads, workspaceAgentId]);

  useEffect(() => {
    if (!activeTab.startsWith('bead:')) return;
    if (visibleOpenBeads.some((bead) => bead.id === activeTab)) return;
    setActiveTab('chat');
  }, [activeTab, setActiveTab, visibleOpenBeads]);

  const closeWorkspaceTab = useCallback((tabId: string) => {
    if (tabId.startsWith('bead:')) {
      setOpenBeads((prev) => prev.filter((bead) => bead.id !== tabId));
      if (activeTab === tabId) {
        setActiveTab('chat');
      }
      return;
    }

    closeFile(tabId);
  }, [activeTab, closeFile, setActiveTab]);

  const handleNewFile = useCallback(async () => {
    const name = window.prompt('New file name:', '');
    if (!name?.trim()) return;
    const filename = name.trim().endsWith('.md') ? name.trim() : `${name.trim()}.md`;
    const content = `# ${filename.replace('.md', '')}\n\n`;
    try {
      const res = await fetch('/api/files/write', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filename, content, agentId: workspaceAgentId }),
      });
      const data = await res.json();
      if (data.ok) {
        setFileBrowserCollapsed(false);
        setRevealRequest({ id: Date.now(), path: data.path || filename, kind: 'file', agentId: workspaceAgentId });
      }
    } catch {}
  }, [workspaceAgentId]);

  const openWorkspacePath = useCallback(async (targetPath: string, basePath?: string) => {
    const params = new URLSearchParams({ path: targetPath, agentId: workspaceAgentId });
    if (basePath) {
      params.set('relativeTo', basePath);
    }
    const res = await fetch(`/api/files/resolve?${params.toString()}`);
    const data = await res.json().catch(() => null) as {
      ok?: boolean;
      path?: string;
      type?: 'file' | 'directory';
      binary?: boolean;
    } | null;

    if (!res.ok || !data?.ok || !data.path || !data.type) return;

    setFileBrowserCollapsed(false);
    setRevealRequest({ id: Date.now(), path: data.path, kind: data.type, agentId: workspaceAgentId });

    if (data.type === 'file' && (!data.binary || isImageFile(data.path))) {
      await openFile(data.path);
    }
  }, [openFile, setFileBrowserCollapsed, workspaceAgentId]);

  const toggleMobileTopBar = useCallback(() => {
    setIsMobileTopBarHidden((prev) => !prev);
  }, []);

  // Build command list with stable references
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const openSpawnDialog = useCallback(() => setSpawnDialogOpen(true), []);

  const commands = useMemo(() => createCommands({
    onNewSession: openSpawnDialog,
    onResetSession: handleReset,
    onToggleSound: toggleSound,
    onSettings: openSettings,
    onSearch: openSearch,
    onAbort: handleAbort,
    onSetTheme: setTheme,
    onSetFont: setFont,
    onTtsProviderChange: setTtsProvider,
    onToggleWakeWord: handleToggleWakeWord,
    onToggleEvents: toggleEvents,
    onToggleLog: toggleLog,
    onToggleTelemetry: toggleTelemetry,
    onOpenSettings: openSettings,
    onRefreshSessions: refreshSessions,
    onRefreshMemory: refreshMemories,
    onSetViewMode: setViewMode,
    canShowKanban: kanbanVisible,
    onToggleFileBrowser: isCompactLayout ? handleToggleFileBrowser : fileBrowserCollapsed ? handleToggleFileBrowser : undefined,
    isFileBrowserCollapsed: fileBrowserCollapsed,
    onNewFile: handleNewFile,
    onTogglePanel: (id) => togglePanelCollapse(id as any),
    panelStates: Object.fromEntries(panelLayout.right.map(p => [p, !panelLayout.collapsed[p]])),
  }), [openSpawnDialog, handleReset, toggleSound, handleAbort, openSettings, openSearch,
    setTheme, setFont, setTtsProvider, handleToggleWakeWord, toggleEvents, toggleLog, toggleTelemetry,
    refreshSessions, refreshMemories, setViewMode, kanbanVisible,
    fileBrowserCollapsed, isCompactLayout, handleToggleFileBrowser, handleNewFile,
    togglePanelCollapse, panelLayout]);

  // Keyboard shortcut handlers with useCallback
  const handleOpenPalette = useCallback(() => setPaletteOpen(true), []);
  const handleCtrlC = useCallback(() => {
    if (isGenerating) {
      handleAbort();
    }
  }, [isGenerating, handleAbort]);
  const toggleSearch = useCallback(() => setSearchOpen(prev => !prev), []);
  const handleEscape = useCallback(() => {
    if (paletteOpen) {
      setPaletteOpen(false);
    } else if (searchOpen) {
      setSearchOpen(false);
    } else if (isGenerating) {
      handleAbort();
    }
  }, [paletteOpen, searchOpen, isGenerating, handleAbort]);

  // Global keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'k', meta: true, handler: handleOpenPalette },
    { key: 'b', meta: true, handler: handleToggleFileBrowser },  // Cmd+B → toggle file browser
    { key: 'f', meta: true, handler: toggleSearch, skipInEditor: true, skipInTextarea: true },  // Cmd+F → chat search (yields to CodeMirror/search in textarea)
    { key: 'c', ctrl: true, handler: handleCtrlC, preventDefault: false },  // Ctrl+C → abort (when generating), allow copy to still work
    { key: 'Escape', handler: handleEscape, skipInEditor: true },
  ]);

  // Get current session's context usage for StatusBar
  const currentSessionData = useMemo(() => {
    return sessions.find(s => getSessionKey(s) === currentSession);
  }, [sessions, currentSession]);

  // Get display name for current session (agent name for main, label for subagents)
  const currentSessionDisplayName = useMemo(() => {
    if (currentSessionData) return getSessionDisplayLabel(currentSessionData, agentName);
    return agentName;
  }, [currentSessionData, agentName]);

  const contextTokens = currentSessionData?.totalTokens ?? 0;
  const contextLimit = currentSessionData?.contextTokens || getContextLimit(model);

  const getWorkspaceSwitchLabel = useCallback((sessionKey: string) => {
    const targetSession = sessions.find((session) => getSessionKey(session) === sessionKey);
    if (targetSession) {
      return getSessionDisplayLabel(targetSession, agentName);
    }

    const targetAgentId = getWorkspaceAgentId(sessionKey);
    return targetAgentId === 'main' ? `${agentName} (main)` : `Agent ${targetAgentId}`;
  }, [agentName, sessions]);

  const requestWorkspaceTransition = useCallback((
    targetSessionKey: string,
    targetLabel: string,
    execute: () => Promise<void>,
  ) => {
    if (!shouldGuardWorkspaceSwitch(currentSession, targetSessionKey, hasDirtyFiles)) {
      return execute().then(() => true);
    }

    setWorkspaceSwitchAction(null);
    setWorkspaceSwitchError(null);

    return new Promise<boolean>((resolve, reject) => {
      setPendingWorkspaceSwitch({
        targetLabel,
        execute,
        resolve,
        reject,
      });
    });
  }, [currentSession, hasDirtyFiles]);

  const handleCancelWorkspaceSwitch = useCallback(() => {
    if (workspaceSwitchAction || !pendingWorkspaceSwitch) return;

    pendingWorkspaceSwitch.resolve(false);
    setPendingWorkspaceSwitch(null);
    setWorkspaceSwitchAction(null);
    setWorkspaceSwitchError(null);
  }, [pendingWorkspaceSwitch, workspaceSwitchAction]);

  const handleSaveAndSwitch = useCallback(async () => {
    if (!pendingWorkspaceSwitch || workspaceSwitchAction) return;

    const pendingSwitch = pendingWorkspaceSwitch;
    setWorkspaceSwitchAction('save');
    setWorkspaceSwitchError(null);

    const result = await saveAllDirtyFiles();
    if (!result.ok) {
      setWorkspaceSwitchAction(null);
      setWorkspaceSwitchError(buildWorkspaceSwitchErrorMessage(result));
      return;
    }

    try {
      await pendingSwitch.execute();
      pendingSwitch.resolve(true);
      setPendingWorkspaceSwitch(null);
      setWorkspaceSwitchError(null);
    } catch (error) {
      pendingSwitch.reject(error);
      setPendingWorkspaceSwitch(null);
      setWorkspaceSwitchError(null);
    } finally {
      setWorkspaceSwitchAction(null);
    }
  }, [pendingWorkspaceSwitch, saveAllDirtyFiles, workspaceSwitchAction]);

  const handleDiscardAndSwitch = useCallback(async () => {
    if (!pendingWorkspaceSwitch || workspaceSwitchAction) return;

    const pendingSwitch = pendingWorkspaceSwitch;
    setWorkspaceSwitchAction('discard');
    setWorkspaceSwitchError(null);
    discardAllDirtyFiles();

    try {
      await pendingSwitch.execute();
      pendingSwitch.resolve(true);
      setPendingWorkspaceSwitch(null);
      setWorkspaceSwitchError(null);
    } catch (error) {
      pendingSwitch.reject(error);
      setPendingWorkspaceSwitch(null);
      setWorkspaceSwitchError(null);
    } finally {
      setWorkspaceSwitchAction(null);
    }
  }, [discardAllDirtyFiles, pendingWorkspaceSwitch, workspaceSwitchAction]);

  const handleSessionChange = useCallback((key: string) => {
    void requestWorkspaceTransition(key, getWorkspaceSwitchLabel(key), async () => {
      setCurrentSession(key);
    });
  }, [getWorkspaceSwitchLabel, requestWorkspaceTransition, setCurrentSession]);

  const handleSpawnSession = useCallback((opts: SpawnSessionOpts) => {
    const targetSessionKey = opts.kind === 'root'
      ? buildAgentRootSessionKey(opts.agentName?.trim() || 'agent', sessions.map(getSessionKey))
      : opts.parentSessionKey?.trim() || getWorkspaceRootSessionKey(currentSession) || currentSession;
    const targetLabel = opts.kind === 'root'
      ? opts.agentName?.trim() || 'New agent'
      : getWorkspaceSwitchLabel(targetSessionKey);

    return requestWorkspaceTransition(targetSessionKey, targetLabel, async () => {
      await spawnSession(opts);
    });
  }, [currentSession, getWorkspaceSwitchLabel, requestWorkspaceTransition, sessions, spawnSession]);

  // Boot sequence: fade in panels when connected
  useEffect(() => {
    if (connectionState === 'connected' && !booted) {
      const timer = setTimeout(() => setBooted(true), 50);
      return () => clearTimeout(timer);
    }
  }, [connectionState, booted]);

  // Log header glow when new entries arrive
  // This effect legitimately needs to set state in response to prop changes
  // (visual feedback for new log entries)
  useEffect(() => {
    const currentCount = agentLogEntries.length;
    if (currentCount > prevLogCount.current) {
      setLogGlow(true);
      const timer = setTimeout(() => setLogGlow(false), 500);
      prevLogCount.current = currentCount;
      return () => clearTimeout(timer);
    }
    prevLogCount.current = currentCount;
  }, [agentLogEntries.length]);

  const handleCompactLayoutChange = useCallback((nextIsCompactLayout: boolean) => {
    setIsCompactLayout(nextIsCompactLayout);
    if (!nextIsCompactLayout) {
      setIsMobileTopBarHidden(false);
    }
    setFileBrowserCollapsedState(prevCollapsed => {
      if (nextIsCompactLayout) {
        persistDesktopFileBrowserCollapsed(prevCollapsed);
        return true;
      }

      return desktopFileBrowserCollapsed;
    });
  }, [desktopFileBrowserCollapsed, persistDesktopFileBrowserCollapsed]);

  // Responsive mode: switch to chat-first layout on smaller screens
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(max-width: 900px)');
    const onChange = (event: MediaQueryListEvent) => {
      handleCompactLayoutChange(event.matches);
    };

    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }

    // Safari fallback
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, [handleCompactLayoutChange]);

  // Handlers for TTS provider/model changes
  const handleTtsProviderChange = useCallback((provider: TTSProvider) => {
    setTtsProvider(provider);
  }, [setTtsProvider]);

  const handleTtsModelChange = useCallback((model: string) => {
    setTtsModel(model);
  }, [setTtsModel]);

  const handleSttProviderChange = useCallback((provider: 'local' | 'openai') => {
    setSttProvider(provider);
  }, [setSttProvider]);

  const handleSttInputModeChange = useCallback((mode: STTInputMode) => {
    setSttInputMode(mode);
  }, [setSttInputMode]);

  const handleSttModelChange = useCallback((model: string) => {
    setSttModel(model);
  }, [setSttModel]);

  const visibleSaveToast = saveToast?.agentId === workspaceAgentId
    && saveToast.workspaceVersion === workspaceVersion
    ? saveToast
    : null;

  const chatContent = (
    <TabbedContentArea
      activeTab={activeTab}
      openFiles={openFiles}
      openBeads={visibleOpenBeads}
      workspaceAgentId={workspaceAgentId}
      onSelectTab={setActiveTab}
      onCloseTab={closeWorkspaceTab}
      onContentChange={updateContent}
      onSaveFile={handleSaveFile}
      saveToast={visibleSaveToast}
      onDismissToast={dismissSaveToast}
      onReloadFile={reloadFile}
      onRetryFile={reloadFile}
      onOpenWorkspacePath={openWorkspacePath}
      onOpenBeadId={openBeadId}
      pathLinkPrefixes={chatPathLinkPrefixes}
      pathLinkAliases={chatPathLinkAliases}
      onNewFile={handleNewFile}
      chatPanel={
        <PanelErrorBoundary name="Chat">
          <ChatPanel
            ref={chatPanelRef}
            id="main-chat"
            messages={messages}
            onSend={handleSend}
            onAbort={handleAbort}
            isGenerating={isGenerating}
            stream={stream}
            processingStage={processingStage}
            lastEventTimestamp={lastEventTimestamp}
            currentToolDescription={currentToolDescription}
            activityLog={activityLog}
            onWakeWordState={handleWakeWordState}
            onReset={handleReset}
            searchOpen={searchOpen}
            onSearchClose={closeSearch}
            agentName={currentSessionDisplayName}
            loadMore={loadMore}
            hasMore={hasMore}
            onToggleFileBrowser={isCompactLayout ? handleToggleFileBrowser : fileBrowserCollapsed ? handleToggleFileBrowser : undefined}
            isFileBrowserCollapsed={fileBrowserCollapsed}
            onToggleMobileTopBar={isCompactLayout ? toggleMobileTopBar : undefined}
            isMobileTopBarHidden={isMobileTopBarHidden}
            onSendToResearch={handleSendToResearch}
            onOpenWorkspacePath={openWorkspacePath}
            pathLinkPrefixes={chatPathLinkPrefixes}
            pathLinkAliases={chatPathLinkAliases}
            onOpenBeadId={openBeadId}
            showCommandPaletteButton={commandPaletteButtonVisible && !paletteOpen && !settingsOpen && viewMode === 'chat'}
            onOpenCommandPalette={handleOpenPalette}
          />
        </PanelErrorBoundary>
      }
    />
  );

  /** Human-readable labels for each panel, used in header bars and accessible names. */
  const panelName: Record<string, string> = {
    workspace: 'Workspace', agents: 'Agents', memory: 'Memory', thoughts: 'Thoughts', references: 'Library', activity: 'Activity',
  };

  /**
   * Shared panel-side renderer used for both the left and right sidebars.
   *
   * Iterates over the panel IDs in the configured order, rendering each
   * as a drag-reorderable, collapsible, vertically-resizable card. Panels
   * share vertical space via proportional flex weights.
   *
   * ## Panel dispatch
   *
   * The inner ternary selects the appropriate component for each
   * {@link PanelId}:
   * - `'workspace'` → {@link FileTreePanel}
   * - `'agents'`     → {@link SessionList}
   * - `'memory'`     → {@link WorkspacePanel}
   * - `'tools'`      → {@link ToolCallsPanel} (new in 2026-05)
   * - `'activity'`   → {@link AgentActivityPanel} (new in 2026-05)
   * - `'thoughts'`   → Scratch Pad (markdown editor / preview)
   *
   * @param side - Which sidebar to render (`'left'` or `'right'`).
   * @param onSelect - Session selection callback (only used by the agents
   *   panel on the right side).
   */
  const renderPanelSide = (side: 'left' | 'right', onSelect: ((key: string) => Promise<void> | void) | null) => {
    const ids = side === 'left' ? panelLayout.left : panelLayout.right;
    const flexSum = ids.reduce((s, id) => s + (panelLayout.flex[id] ?? 1), 0);
    
    return (
      <div className="flex-1 flex flex-col gap-3 min-h-0"
        onDragOver={(e) => {
          e.preventDefault();
          // Default drop target: append to end of this sidebar's panel list.
          // Individual panel onDragOver handlers will override with specific
          // indices when the cursor is directly over a panel.
          setDropTargetSynced({ side, index: ids.length });
        }}
        onDrop={handlePanelDrop}
      >
        {ids.map((id, idx) => {
          const collapsed = panelLayout.collapsed[id] ?? false;
          const flexVal = (panelLayout.flex[id] ?? 1) / flexSum;
          /**
           * The ID of the next panel below this one, or `null` for the
           * last panel. Only non-null panels get a vertical resize handle
           * at their bottom edge, allowing the two adjacent panels to be
           * resized proportionally via drag.
           */
          const nextId = idx < ids.length - 1 ? ids[idx + 1] : null;
          return (
            <div key={id}
              data-panel-id={id}
              className={`shell-panel flex flex-col min-h-0 overflow-hidden rounded-[28px] relative transition-all duration-200 ${collapsed ? 'shrink-0' : ''} ${dragPanelId === id ? 'opacity-50 scale-[0.98] ring-2 ring-primary/30' : ''} ${dropTarget?.side === side && dropTarget.index === idx ? 'ring-2 ring-primary/50' : ''}`}
              style={collapsed ? {} : { flex: `${flexVal} 1 0%` }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropTargetSynced({ side, index: idx }); }}
            >
              {/* Drop indicator above */}
              {dragPanelId && dragPanelId !== id && dropTarget?.side === side && dropTarget.index === idx && (
                <div className="absolute -top-[3px] left-4 right-4 h-[3px] rounded-full bg-primary/60 z-20 animate-pulse" />
              )}
              <div
                draggable
                onDragStart={() => setDragPanelId(id)}
                onDragEnd={() => { setDragPanelId(null); setDropTargetSynced(null); }}
                onContextMenu={(e) => {
                  // Only prevent default on the header element itself (draggable panel title bar).
                  // The native browser context menu (copy/paste) in the content area below
                  // must NOT be blocked — this preventDefault only applies to the header.
                  e.preventDefault();
                  e.stopPropagation();
                  setPanelContextMenu({ open: true, x: e.clientX, y: e.clientY, panelId: id as PanelId, currentSide: side });
                }}
                className={`flex items-center gap-2 w-full px-2.5 py-1 cursor-grab active:cursor-grabbing select-none transition-colors shrink-0 ${dragPanelId === id ? 'bg-primary/5' : 'hover:bg-foreground/[0.02]'}`}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); togglePanelCollapse(id); }}
                  className="text-muted-foreground/40 hover:text-foreground/70 transition-colors shrink-0"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${collapsed ? '' : 'rotate-90'}`}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <span className="text-[0.667rem] font-semibold tracking-wider text-foreground/70 flex-1 min-w-0" title={id === 'thoughts' ? 'Use --- to split thoughts into separate cards. Check off when done, click to edit.' : undefined}>{panelName[id]}</span>
                {id === 'agents' && (
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSpawnDialogOpen(true); }}
                      aria-label="Create session"
                      title="Create session"
                      className="size-6 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); refreshSessions(); }}
                      aria-label="Refresh sessions"
                      title="Refresh sessions"
                      className={'size-6 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-foreground/[0.06] transition-colors ' + (sessionsLoading ? 'animate-spin' : '')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 014.85-5.67A9 9 0 0018.36 7.64"/><path d="M20.49 15a9 9 0 01-4.85 5.67A9 9 0 005.64 16.36"/></svg>
                    </button>
                  </div>
                )}
                {id === 'thoughts' && !collapsed && (
                  <button onClick={(e) => { e.stopPropagation(); setScratchPadPreview(!scratchPadPreview); }}
                    className="text-[0.5rem] px-2 py-0.5 rounded-md bg-muted/30 text-muted-foreground/60 hover:text-foreground/80 transition-colors"
                  >{scratchPadPreview ? 'Edit' : 'Preview'}</button>
                )}
                {/* Activity indicator — always far right */}
                {isGenerating && <span className="size-1.5 rounded-full bg-primary animate-pulse shrink-0 ml-2" title="Generating..." />}
              </div>
              {!collapsed && (
                <div className="flex-1 min-h-0 flex flex-col panel-content-scroll">
                  <PanelErrorBoundary name={panelName[id]}>
                    {id === 'workspace' ? (
                      <FileTreePanel workspaceAgentId={workspaceAgentId} onOpenFile={openFile}
                        onAddToChat={(path, kind, agentId) => chatPanelRef.current?.addWorkspacePath(path, kind, agentId ?? workspaceAgentId)}
                        addToChatEnabled={addToChatEnabled} lastChangedEvent={lastChangedEvent}
                        revealRequest={revealRequest} onRemapOpenPaths={remapOpenPaths}
                        onCloseOpenPaths={closeOpenPathsByPrefix} isCompactLayout={false} hideHeader collapsed={false}

                      />
                    ) : id === 'agents' ? (
                      <SessionList sessions={sessions} currentSession={currentSession}
                        busyState={busyState} agentStatus={agentStatus} unreadSessions={unreadSessions}
                        onSelect={onSelect!} onRefresh={refreshSessions} onDelete={deleteSession}
                        onSpawn={handleSpawnSession} onRename={renameSession} onAbort={abortSession}
                        isLoading={sessionsLoading} agentName={agentName} hideHeader
                      />
                    ) : id === 'memory' ? (
                      <WorkspacePanel workspaceAgentId={workspaceAgentId} memories={memories}
                        onRefreshMemories={refreshMemories} memoriesLoading={memoriesLoading}
                        remoteWorkspace={remoteWorkspace}
                      />
                    ) : id === 'references' ? (
                      <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted-foreground text-xs bg-background">Loading...</div>}>
                        <LibraryPanel messages={messages} />
                      </Suspense>
                    ) : id === 'activity' ? (
                      <AgentActivityPanel messages={messages} />
                    ) : (
                      scratchPadPreview ? (
                        <Suspense fallback={<div className="flex-1 p-3 text-xs text-muted-foreground/50">Loading preview...</div>}>
                          <div className="flex-1 overflow-y-auto p-3 prose prose-zinc dark:prose-invert max-w-none prose-headings:text-foreground/90 prose-strong:text-foreground/90 prose-p:text-xs prose-p:leading-relaxed break-words">
                            <MarkdownRenderer content={scratchPadContent || '*Nothing yet...*'} />
                          </div>
                        </Suspense>
                      ) : (
                        <div className="flex-1 flex flex-col min-h-0">
                          {/* Thoughts search bar */}
                          {thoughtsSearch !== '' && (
                            <div className="flex items-center gap-1 px-2 py-1 shrink-0 border-b border-border/20">
                              <input
                                value={thoughtsSearch}
                                onChange={(e) => setThoughtsSearch(e.target.value)}
                                placeholder="Search thoughts…"
                                className="flex-1 bg-transparent border-none outline-none text-[0.667rem] text-foreground/70 placeholder:text-muted-foreground/30"
                                autoFocus
                                onKeyDown={(e) => { if (e.key === 'Escape') clearThoughtsSearch(); }}
                              />
                              <button
                                onClick={clearThoughtsSearch}
                                className="size-4 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground transition-colors"
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
                          )}
                          <ThoughtsPanel
                            content={scratchPadContent}
                            onContentChange={persistScratchPad}
                            isGenerating={isGenerating}
                            onSendToChat={(text) => {
                              window.dispatchEvent(new CustomEvent('nerve:send-to-chat', { detail: { text } }));
                            }}
                          />
                        </div>
                      )
                    )}
                  </PanelErrorBoundary>
                </div>
              )}
              {nextId && (
                <div onMouseDown={(e) => { e.preventDefault(); const startY = e.clientY; const p1 = (panelLayout.flex[id] ?? 1); const initP1 = p1; const p2 = (panelLayout.flex[nextId] ?? 1); const onMove = (ev: MouseEvent) => { const delta = (ev.clientY - startY) / 30; setPanelLayout(prev => ({ ...prev, flex: { ...prev.flex, [id]: Math.max(0.5, initP1 + delta), [nextId]: Math.max(0.5, p2 - delta) } })); }; const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }; window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); }}
                  onDoubleClick={() => {
                    // Auto-size both panels to fit their content
                    // Measures the content scrollHeight and distributes proportionally
                    const panelEls = document.querySelectorAll(`[data-panel-id="${id}"], [data-panel-id="${nextId}"]`);
                    if (panelEls.length < 2) {
                      // Fallback: equal distribution
                      setPanelLayout(prev => ({ ...prev, flex: { ...prev.flex, [id]: 1, [nextId]: 1 } }));
                      return;
                    }
                    const heights: number[] = [];
                    for (const el of panelEls) {
                      const content = el.querySelector('.panel-content-scroll');
                      heights.push(content ? content.scrollHeight : 100);
                    }
                    const total = heights[0] + heights[1];
                    if (total > 0) {
                      const f1 = Math.max(0.5, (heights[0] / total) * 4);
                      const f2 = Math.max(0.5, (heights[1] / total) * 4);
                      setPanelLayout(prev => ({ ...prev, flex: { ...prev.flex, [id]: f1, [nextId]: f2 } }));
                    }
                  }}
                  className="absolute bottom-0 left-2 right-2 h-1 cursor-row-resize z-10 rounded-full bg-border/30 hover:bg-primary/55 hover:shadow-[0_0_16px_rgba(0,0,0,0.22)] transition-colors"
                />
              )}
            </div>
          );
        })}
        {dragPanelId && dropTarget?.side === side && dropTarget.index >= ids.length && <div className="h-1 rounded-full bg-primary/40 mx-2" />}
      </div>
    );
  };

  const renderRightPanels = (onSelect: (key: string) => Promise<void> | void) => {
    const showStrip = rightSidebarCollapsed && !rightHoverExpanded;

    if (showStrip) {
      return (
        <div
          onMouseEnter={() => {
            if (!rightHoverEnabled) return;
            rightHoverTimerRef.current = setTimeout(() => setRightHoverExpanded(true), 250);
          }}
          onMouseLeave={() => {
            if (rightHoverTimerRef.current) { clearTimeout(rightHoverTimerRef.current); rightHoverTimerRef.current = null; }
            setRightHoverExpanded(false);
          }}
          onContextMenu={(e) => {
            // Don't block native context menu on text inputs (copy/paste)
            if ((e.target as HTMLElement)?.closest?.('textarea, input, [contenteditable]')) return;
            e.preventDefault(); setSidebarContextMenu({ open: true, x: e.clientX, y: e.clientY, side: 'right' });
          }}
          className="h-full flex"
        >
          <SidebarStrip
            side="right"
            panelIds={panelLayout.right}
            onPanelClick={(id: string) => togglePanelCollapse(id as PanelId)}
            onToggleSidebar={toggleRightSidebar}
          />
        </div>
      );
    }

    return (
      <div
        onMouseLeave={() => rightSidebarCollapsed && setRightHoverExpanded(false)}
        onContextMenu={(e) => {
            if ((e.target as HTMLElement)?.closest?.('textarea, input, [contenteditable]')) return;
            e.preventDefault(); setSidebarContextMenu({ open: true, x: e.clientX, y: e.clientY, side: 'right' });
          }}
        className="min-h-0 flex flex-1"
      >
        {/* Collapse toggle strip at left edge of expanded right sidebar */}
        <button
          onClick={toggleRightSidebar}
          className="flex flex-col items-center justify-center w-5 shrink-0 hover:bg-foreground/[0.04] transition-colors cursor-pointer group"
          title="Collapse sidebar"
          aria-label="Collapse right sidebar"
        >
          <ChevronRight size={14} className="text-muted-foreground/30 group-hover:text-foreground/70 transition-colors" />
        </button>
        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted-foreground text-xs bg-background">Loading...</div>}>
          {renderPanelSide('right', onSelect)}
        </Suspense>
      </div>
    );
  };

  const drawerAgentsPanel = (
    <Suspense fallback={<div className="p-4 text-muted-foreground text-xs">Loading sessions...</div>}>
      <PanelErrorBoundary name="Sessions">
        <SessionList
          sessions={sessions}
          currentSession={currentSession}
          busyState={busyState}
          agentStatus={agentStatus}
          unreadSessions={unreadSessions}
          onSelect={handleSessionChange}
          onRefresh={refreshSessions}
          onDelete={deleteSession}
          onSpawn={handleSpawnSession}
          onRename={renameSession}
          onAbort={abortSession}
          isLoading={sessionsLoading}
          agentName={agentName}
          hideHeader
        />
      </PanelErrorBoundary>
    </Suspense>
  );

  const drawerMemoryPanel = (
    <Suspense fallback={<div className="p-4 text-muted-foreground text-xs">Loading...</div>}>
      <PanelErrorBoundary name="Memory">
        <WorkspacePanel
          workspaceAgentId={workspaceAgentId}
          memories={memories}
          onRefreshMemories={refreshMemories}
          memoriesLoading={memoriesLoading}
          remoteWorkspace={remoteWorkspace}
          compact
        />
      </PanelErrorBoundary>
    </Suspense>
  );

  const compactSessionsPanel = (
    <Suspense fallback={<div className="p-4 text-muted-foreground text-xs">Loading sessions...</div>}>
      <PanelErrorBoundary name="Sessions">
        <SessionList
          sessions={sessions}
          currentSession={currentSession}
          busyState={busyState}
          agentStatus={agentStatus}
          unreadSessions={unreadSessions}
          onSelect={handleSessionChange}
          onRefresh={refreshSessions}
          onDelete={deleteSession}
          onSpawn={handleSpawnSession}
          onRename={renameSession}
          onAbort={abortSession}
          isLoading={sessionsLoading}
          agentName={agentName}
          compact
        />
      </PanelErrorBoundary>
    </Suspense>
  );

  const compactWorkspacePanel = (
    <Suspense fallback={<div className="p-4 text-muted-foreground text-xs">Loading workspace...</div>}>
      <PanelErrorBoundary name="Workspace">
        <WorkspacePanel
          workspaceAgentId={workspaceAgentId}
          memories={memories}
          onRefreshMemories={refreshMemories}
          memoriesLoading={memoriesLoading}
          remoteWorkspace={remoteWorkspace}
          compact
        />
      </PanelErrorBoundary>
    </Suspense>
  );

  const showCompactFileBrowser = isCompactLayout && viewMode !== 'kanban' && viewMode !== 'research' && !fileBrowserCollapsed;

  // Pulse tab title during generation
  useEffect(() => {
    if (isGenerating) {
      document.title = '⚡ Thinking...';
    } else {
      document.title = 'Nerve Center';
    }
  }, [isGenerating]);

  return (
    <div className="scan-lines relative h-screen flex flex-col overflow-hidden" data-booted={booted}>
      {/* Skip to main content link for keyboard navigation */}
      <a
        href="#main-chat"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:font-bold focus:text-sm"
      >
        Skip to chat
      </a>
      <ConnectDialog
        open={dialogOpen && connectionState !== 'connected' && connectionState !== 'reconnecting'}
        onConnect={handleConnect}
        error={connectError}
        defaultUrl={editableUrl}
        defaultToken={editableToken}
        officialUrl={officialUrl}
        serverSideAuth={serverSideAuth}
      />

      {/*
       * Gateway state banners.
       * Kept compact and centered so they read as transient shell notices instead of old alarm strips.
       */}
      {connectionState === 'reconnecting' && !gatewayRestarting && (
        <div className="fixed left-1/2 top-12 z-50 flex max-w-[calc(100vw-1.067rem)] -translate-x-1/2 items-start gap-2 rounded-2xl border border-destructive/25 bg-card/94 px-4 py-2 text-xs font-medium text-foreground shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <span className="inline-flex size-7 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle size={14} aria-hidden="true" />
          </span>
          <span className="min-w-0 text-left leading-5">
            Signal lost. Reconnecting{reconnectAttempt > 1 ? `, attempt ${reconnectAttempt}` : ''}.
          </span>
          <span className="size-2 rounded-full bg-destructive animate-pulse" aria-hidden="true" />
        </div>
      )}

      {gatewayRestarting && (
        <div className="fixed left-1/2 top-12 z-50 flex max-w-[calc(100vw-1.067rem)] -translate-x-1/2 items-start gap-2 rounded-2xl border border-orange/25 bg-card/94 px-4 py-2 text-xs font-medium text-foreground shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <span className="inline-flex size-7 items-center justify-center rounded-xl bg-orange/10 text-orange">
            <RotateCw size={14} className="animate-spin" aria-hidden="true" />
          </span>
          <span className="min-w-0 text-left leading-5">Gateway restarting...</span>
        </div>
      )}

      {!gatewayRestarting && gatewayRestartNotice && (
        <button
          type="button"
          onClick={dismissNotice}
          className={`fixed left-1/2 top-12 z-50 flex max-w-[calc(100vw-1.067rem)] -translate-x-1/2 cursor-pointer items-start gap-2 rounded-2xl border px-4 py-2 text-xs font-medium shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-transform hover:-translate-x-1/2 hover:-translate-y-px ${
            gatewayRestartNotice.ok
              ? 'border-green/25 bg-card/94 text-foreground'
              : 'border-destructive/25 bg-card/94 text-foreground'
          }`}
        >
          <span className={`inline-flex size-7 items-center justify-center rounded-xl ${
            gatewayRestartNotice.ok ? 'bg-green/10 text-green' : 'bg-destructive/10 text-destructive'
          }`}>
            {gatewayRestartNotice.ok ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
          </span>
          <span className="min-w-0 text-left leading-5">{gatewayRestartNotice.message}</span>
        </button>
      )}

      {(!isCompactLayout || !isMobileTopBarHidden) && (
        <TopBar
          onSettings={openSettings}
          onOpenAgentHub={() => setAgentHubOpen(true)}
          agentLogEntries={agentLogEntries}
          tokenData={tokenData}
          logGlow={logGlow}
          eventEntries={eventEntries}
          eventsVisible={eventsVisible}
          logVisible={logVisible}
          mobilePanelButtonsVisible={isCompactLayout}
          sessionsPanel={compactSessionsPanel}
          workspacePanel={compactWorkspacePanel}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showKanbanView={kanbanVisible}
          leftSidebarOffset={!isCompactLayout && !fileBrowserCollapsed ? leftSidebarWidth + 12 : 0}
        />
      )}

      <PanelErrorBoundary name="Settings">
        <Suspense fallback={null}>
          <SettingsDrawer
            open={settingsOpen}
            onClose={closeSettings}
            gatewayUrl={editableUrl}
            gatewayToken={editableToken}
            onUrlChange={setEditableUrl}
            onTokenChange={setEditableToken}
            onReconnect={handleReconnect}
            connectionState={connectionState}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
            ttsProvider={ttsProvider}
            ttsModel={ttsModel}
            onTtsProviderChange={handleTtsProviderChange}
            onTtsModelChange={handleTtsModelChange}
            sttProvider={sttProvider}
            sttInputMode={sttInputMode}
            sttModel={sttModel}
            onSttProviderChange={handleSttProviderChange}
            onSttInputModeChange={handleSttInputModeChange}
            onSttModelChange={handleSttModelChange}
            wakeWordEnabled={wakeWordEnabled}
            onToggleWakeWord={handleToggleWakeWord}
            liveTranscriptionPreview={liveTranscriptionPreview}
            onToggleLiveTranscriptionPreview={toggleLiveTranscriptionPreview}
            agentName={agentName}
            onLogout={onLogout}
            onGatewayRestart={handleGatewayRestart}
            gatewayRestarting={gatewayRestarting}
          />
        </Suspense>
      </PanelErrorBoundary>

      {/* Agent Hub drawer */}
      <PanelErrorBoundary name="Agent Hub">
        <Suspense fallback={null}>
          <AgentHubDrawer
            open={agentHubOpen}
            onClose={() => setAgentHubOpen(false)}
            agentsPanel={drawerAgentsPanel}
            memoryPanel={drawerMemoryPanel}
          />
        </Suspense>
      </PanelErrorBoundary>

      <div className="flex-1 flex gap-3 overflow-hidden min-h-0 px-2 pt-1.5 pb-2 sm:px-4 sm:pt-2 sm:pb-2">
        {/* Left bar - collapsible sidebar with hover-to-expand, resizable */}
        {!isCompactLayout && !fileBrowserCollapsed && viewMode !== 'research' && (() => {
          const isCollapsed = leftSidebarCollapsed && !leftHoverExpanded;
          const displayWidth = isCollapsed ? 40 : leftSidebarWidth;
          return (
            <div
              className="relative h-full flex shrink-0"
              style={{ width: displayWidth, transition: isCollapsed ? 'width 400ms ease-in-out' : undefined }}
              onMouseEnter={() => {
                if (!leftSidebarCollapsed || !leftHoverEnabled) return;
                leftHoverTimerRef.current = setTimeout(() => setLeftHoverExpanded(true), 250);
              }}
              onMouseLeave={() => {
                if (leftHoverTimerRef.current) { clearTimeout(leftHoverTimerRef.current); leftHoverTimerRef.current = null; }
                setLeftHoverExpanded(false);
              }}
              onContextMenu={(e) => {
                if ((e.target as HTMLElement)?.closest?.('textarea, input, [contenteditable]')) return;
                e.preventDefault(); setSidebarContextMenu({ open: true, x: e.clientX, y: e.clientY, side: 'left' });
              }}
            >
              {isCollapsed ? (
                <SidebarStrip
                  side="left"
                  panelIds={panelLayout.left}
                  onPanelClick={(id: string) => togglePanelCollapse(id as PanelId)}
                  onToggleSidebar={toggleLeftSidebar}
                />
              ) : (
                <>
                  {/* Toggle button at right edge (expanded state) */}
                  <button
                    onClick={toggleLeftSidebar}
                    className="absolute -right-3 top-2 z-10 flex items-center justify-center size-6 rounded-full bg-card border border-border/40 text-muted-foreground/40 hover:text-foreground hover:border-foreground/20 shadow-sm transition-all opacity-50 hover:opacity-100"
                    title="Collapse sidebar"
                    aria-label="Collapse left sidebar"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <div className="h-full min-h-0 flex-1 min-w-0 flex flex-col overflow-hidden">
                    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted-foreground text-xs bg-background">Loading...</div>}>
                      {renderPanelSide('left', null)}
                    </Suspense>
                  </div>
                  {/* Horizontal resize handle — drag to resize left sidebar width */}
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const startX = e.clientX;
                      const startWidth = displayWidth;
                      let currentWidth = displayWidth;
                      const onMove = (ev: MouseEvent) => {
                        currentWidth = Math.max(160, Math.min(600, startWidth + (ev.clientX - startX)));
                        setLeftSidebarWidth(currentWidth);
                      };
                      const onUp = () => {
                        try { localStorage.setItem('nerve-left-sidebar-width', String(currentWidth)); } catch {}
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                      };
                      window.addEventListener('mousemove', onMove);
                      window.addEventListener('mouseup', onUp);
                    }}
                    className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize opacity-0 hover:opacity-100 transition-opacity"
                    title="Resize sidebar"
                  />
                </>
              )}
            </div>
          );
        })()}

        {showCompactFileBrowser && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-30 hidden bg-black/48 backdrop-blur-sm max-[900px]:block"
              onClick={() => setFileBrowserCollapsed(true)}
              aria-label="Close file explorer"
            />
            <div className={`pointer-events-none fixed inset-0 z-40 hidden px-2 pb-[4.25rem] max-[900px]:flex ${isMobileTopBarHidden ? 'pt-2' : 'pt-[4.5rem]'}`}>
              <div className="pointer-events-auto h-full w-[min(86vw,320px)] max-w-full animate-in slide-in-from-left-4 duration-200">
                <PanelErrorBoundary name="File Explorer">
                  <FileTreePanel
                    workspaceAgentId={workspaceAgentId}
                    onOpenFile={openFile}
                    onAddToChat={(path, kind, agentId) => chatPanelRef.current?.addWorkspacePath(path, kind, agentId ?? workspaceAgentId)}
                    addToChatEnabled={addToChatEnabled}
                    lastChangedEvent={lastChangedEvent}
                    revealRequest={revealRequest}
                    onRemapOpenPaths={remapOpenPaths}
                    onCloseOpenPaths={closeOpenPathsByPrefix}
                    isCompactLayout={true}
                    collapsed={false}
                    onCollapseChange={setFileBrowserCollapsed}
                  />
                </PanelErrorBoundary>
              </div>
            </div>
          </>
        )}

        {/*
         * Chat panel is always rendered but hidden when kanban is active.
         * This keeps ChatPanel → InputBar → useVoiceInput mounted so that
         * in-progress voice recording / STT transcription survives tab switches.
         * See: https://github.com/.../issues/64
         */}
        {/* Kanban view — kept mounted but hidden when inactive to preserve task state */}
        <div style={{ display: viewMode === 'kanban' ? undefined : 'none' }} className="shell-panel boot-panel flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden rounded-[28px]">
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted-foreground text-xs bg-background">Loading...</div>}>
            <KanbanPanel initialTaskId={pendingTaskId} onInitialTaskConsumed={() => setPendingTaskId(null)} />
          </Suspense>
        </div>
        {/* Research view — kept mounted but hidden when inactive to preserve threads + history */}
        <div style={{ display: viewMode === 'research' ? undefined : 'none' }} className="shell-panel boot-panel flex-1 flex flex-row min-w-0 min-h-0 overflow-hidden rounded-[28px]">
          {/* Research panel — left column */}
          <div className="flex-1 flex flex-col min-w-0">
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted-foreground text-xs bg-background">Loading...</div>}>
              <ResearchPanel />
            </Suspense>
          </div>
          {/* Thoughts scratch-pad — right column, collapsible */}
          <div className={`${researchThoughtsCollapsed ? 'w-8' : 'w-64'} shrink-0 border-l border-border/40 flex flex-col overflow-hidden transition-all duration-300 ease-in-out`}
          >
            {/* Collapse toggle header */}
            <div className="flex items-center gap-1 px-1.5 py-1 shrink-0 border-b border-border/30">
              {!researchThoughtsCollapsed && (
                <span className="text-[0.6rem] font-semibold tracking-wider text-muted-foreground/60 ml-1">Thoughts</span>
              )}
              <button
                onClick={() => {
                  const next = !researchThoughtsCollapsed;
                  setResearchThoughtsCollapsed(next);
                  try { localStorage.setItem('nerve-research-thoughts-collapsed', String(next)); } catch {}
                }}
                className={`${researchThoughtsCollapsed ? 'mx-auto' : 'ml-auto'} flex items-center justify-center size-5 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-colors`}
                title={researchThoughtsCollapsed ? 'Show thoughts' : 'Hide thoughts'}
                aria-label={researchThoughtsCollapsed ? 'Show thoughts' : 'Hide thoughts'}
              >
                <ChevronRight size={12} className={`transition-transform ${researchThoughtsCollapsed ? '' : 'rotate-180'}`} />
              </button>
            </div>
            {!researchThoughtsCollapsed && (
              <>
                <div className="flex items-center gap-2 px-3 py-0.5 border-b border-border/20">
                  <button
                    onClick={(e) => { e.stopPropagation(); setScratchPadPreview(!scratchPadPreview); }}
                    className="text-[0.5rem] px-2 py-0.5 rounded-md bg-muted/30 text-muted-foreground/60 hover:text-foreground/80 transition-colors ml-auto"
                  >
                    {scratchPadPreview ? 'Edit' : 'Preview'}
                  </button>
                </div>
                {scratchPadPreview ? (
                  <Suspense fallback={<div className="flex-1 px-3 pb-2 text-xs text-muted-foreground/50">Loading preview…</div>}>
                    <div className="flex-1 overflow-y-auto px-3 pb-2 prose prose-zinc dark:prose-invert max-w-none prose-headings:text-foreground/90 prose-strong:text-foreground/90 prose-p:text-xs prose-p:leading-relaxed break-words">
                      <MarkdownRenderer content={scratchPadContent || '*Nothing yet...*'} />
                    </div>
                  </Suspense>
                ) : (
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Thoughts search bar */}
                    {thoughtsSearch !== '' && (
                      <div className="flex items-center gap-1 px-3 py-1 shrink-0 border-b border-border/20">
                        <input
                          value={thoughtsSearch}
                          onChange={(e) => setThoughtsSearch(e.target.value)}
                          placeholder="Search thoughts…"
                          className="flex-1 bg-transparent border-none outline-none text-[0.667rem] text-foreground/70 placeholder:text-muted-foreground/30"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Escape') clearThoughtsSearch(); }}
                        />
                        <button
                          onClick={clearThoughtsSearch}
                          className="size-4 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground transition-colors"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    )}
                    <ThoughtsPanel
                      content={scratchPadContent}
                      onContentChange={persistScratchPad}
                      isGenerating={isGenerating}
                      onSendToChat={(text) => {
                        window.dispatchEvent(new CustomEvent('nerve:send-to-chat', { detail: { text } }));
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>  {/* end research view */}
        {isCompactLayout ? (
          <div className={`shell-panel flex-1 min-w-0 min-h-0 overflow-hidden rounded-[28px] boot-panel${viewMode === 'kanban' || viewMode === 'research' ? ' hidden' : ''}`}>
            {chatContent}
          </div>
        ) : (
          <div style={{ display: viewMode === 'kanban' || viewMode === 'research' ? 'none' : 'contents' }}>
            <ResizablePanels
              leftPercent={panelRatio}
              onResize={setPanelRatio}
              minLeftPercent={30}
              maxLeftPercent={85}
              rightWidthPx={computedRightWidthPx}
              onRightWidthChange={handleRightWidthChange}
              leftClassName="shell-panel boot-panel rounded-[28px] overflow-hidden"
              rightClassName="boot-panel flex flex-col"
              left={chatContent}
              right={renderRightPanels(handleSessionChange)}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="boot-panel" style={{ transitionDelay: '200ms' }}>
        <StatusBar
          connectionState={connectionState}
          sessionCount={sessions.length}
          sparkline={sparkline}
          contextTokens={contextTokens}
          contextLimit={contextLimit}
        />
      </div>

      {/* Command Palette */}
      <PanelErrorBoundary name="Command Palette">
        <Suspense fallback={null}>
          <CommandPalette
            open={paletteOpen}
            onClose={closePalette}
            commands={commands}
          />
        </Suspense>
      </PanelErrorBoundary>

      {/* Reset Session Confirmation */}
      <ConfirmDialog
        open={showResetConfirm}
        title="Reset Session"
        message="This will start fresh and clear all context."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onConfirm={confirmReset}
        onCancel={cancelReset}
        variant="danger"
      />

      {/* Gateway Restart Confirmation */}
      <ConfirmDialog
        open={showGatewayRestartConfirm}
        title="Restart OpenClaw Gateway"
        message="This will briefly interrupt gateway connectivity. Continue?"
        confirmLabel="Restart"
        cancelLabel="Cancel"
        onConfirm={confirmGatewayRestart}
        onCancel={cancelGatewayRestart}
        variant="warning"
      />

      <WorkspaceSwitchDialog
        open={pendingWorkspaceSwitch !== null}
        targetLabel={pendingWorkspaceSwitch?.targetLabel || 'the other agent'}
        pendingAction={workspaceSwitchAction}
        error={workspaceSwitchError}
        onSaveAndSwitch={handleSaveAndSwitch}
        onDiscardAndSwitch={handleDiscardAndSwitch}
        onCancel={handleCancelWorkspaceSwitch}
      />

      {/* Spawn Agent Dialog (from command palette) */}
      <SpawnAgentDialog
        open={spawnDialogOpen}
        onOpenChange={setSpawnDialogOpen}
        onSpawn={handleSpawnSession}
      />
      <SelectionTooltip />

      {/* Thoughts "Send to chat" floating button — appears at the top-right of the Thoughts textarea when text is selected */}
      {thoughtsSelection && (
        <div
          className="fixed z-[9999] pointer-events-auto"
          style={{
            right: Math.min(window.innerWidth - thoughtsSelection.x, window.innerWidth - 40),
            top: Math.max(thoughtsSelection.y, 8),
          }}
        >
          <button
            onClick={handleThoughtsSendToChat}
            className="flex items-center justify-center size-6 rounded-full border border-border/50 bg-primary/85 text-primary-foreground shadow-lg text-sm font-bold transition-all hover:bg-primary hover:scale-110 active:scale-95"
            title="Send to chat"
            aria-label="Send selected text to chat"
          >
            →
          </button>
        </div>
      )}

      {/* Panel header right-click context menu: move to other sidebar */}
      <ContextMenu
        open={panelContextMenu.open}
        position={{ x: panelContextMenu.x, y: panelContextMenu.y }}
        onClose={() => setPanelContextMenu(prev => ({ ...prev, open: false }))}
      >
        <ContextMenuItem
          onClick={() => {
            const targetSide = panelContextMenu.currentSide === 'left' ? 'right' : 'left';
            movePanelToSide(panelContextMenu.panelId, targetSide);
          }}
          onClose={() => setPanelContextMenu(prev => ({ ...prev, open: false }))}
        >
          Move to {panelContextMenu.currentSide === 'left' ? 'right' : 'left'} sidebar
        </ContextMenuItem>
      </ContextMenu>

      {/* Sidebar right-click context menu for hover toggle */}
      <ContextMenu
        open={sidebarContextMenu.open}
        position={{ x: sidebarContextMenu.x, y: sidebarContextMenu.y }}
        onClose={() => setSidebarContextMenu(prev => ({ ...prev, open: false }))}
      >
        <ContextMenuItem
          active={sidebarContextMenu.side === 'left' ? leftHoverEnabled : rightHoverEnabled}
          onClick={() => {
            if (sidebarContextMenu.side === 'left') {
              const next = !leftHoverEnabled;
              setLeftHoverEnabled(next);
              try { localStorage.setItem('nerve-left-hover-enabled', String(next)); } catch {}
            } else {
              const next = !rightHoverEnabled;
              setRightHoverEnabled(next);
              try { localStorage.setItem('nerve-right-hover-enabled', String(next)); } catch {}
            }
          }}
          onClose={() => setSidebarContextMenu(prev => ({ ...prev, open: false }))}
        >
          Show on hover
        </ContextMenuItem>
        <ContextMenuDivider />
        <ContextMenuItem
          onClick={() => {
            if (sidebarContextMenu.side === 'left') toggleLeftSidebar();
            else toggleRightSidebar();
          }}
          onClose={() => setSidebarContextMenu(prev => ({ ...prev, open: false }))}
        >
          {sidebarContextMenu.side === 'left'
            ? (leftSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')
            : (rightSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}
        </ContextMenuItem>
        <ContextMenuDivider />
        <ContextMenuItem
          onClick={() => {
            const sel = window.getSelection();
            const text = sel?.toString();
            if (text) navigator.clipboard.writeText(text).catch(() => {});
          }}
          onClose={() => setSidebarContextMenu(prev => ({ ...prev, open: false }))}
        >
          Copy selected
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            navigator.clipboard.readText().then(text => {
              const el = document.activeElement as HTMLElement;
              if (el?.tagName === 'TEXTAREA' || el?.tagName === 'INPUT' || el?.isContentEditable) {
                const start = (el as HTMLTextAreaElement).selectionStart ?? 0;
                const end = (el as HTMLTextAreaElement).selectionEnd ?? start;
                const val = 'value' in el ? (el as HTMLTextAreaElement).value : el.textContent ?? '';
                const newVal = val.slice(0, start) + text + val.slice(end);
                if ('value' in el) (el as HTMLTextAreaElement).value = newVal;
                el.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }).catch(() => {});
          }}
          onClose={() => setSidebarContextMenu(prev => ({ ...prev, open: false }))}
        >
          Paste
        </ContextMenuItem>
      </ContextMenu>
    </div>
  );
}

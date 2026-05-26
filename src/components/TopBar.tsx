import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  lazy,
  Suspense,
  type ReactNode,
} from "react";
import {
  Activity,
  BarChart3,
  Settings,
  Radio,
  Users,
  Brain,
  MessageSquare,
  LayoutGrid,
  Search,
} from "lucide-react";
import type { ViewMode } from "@/features/command-palette/commands";
import type { AgentLogEntry, EventEntry, TokenData } from "@/types";
import NerveLogo from "./NerveLogo";

const AgentLog = lazy(() =>
  import("@/features/activity/AgentLog").then((m) => ({ default: m.AgentLog })),
);
const EventLog = lazy(() =>
  import("@/features/activity/EventLog").then((m) => ({ default: m.EventLog })),
);
const TokenUsage = lazy(() =>
  import("@/features/dashboard/TokenUsage").then((m) => ({
    default: m.TokenUsage,
  })),
);

/** Identifies which dropdown panel is currently open, or `null` for none. */
type PanelId =
  | "agent-log"
  | "usage"
  | "events"
  | "sessions"
  | "workspace"
  | null;

type PanelConfig = {
  boxClass: string;
  heightClass: string;
  contentClass: string;
};

const PANEL_CONFIG: Record<Exclude<PanelId, null> | "default", PanelConfig> = {
  sessions: {
    boxClass: "w-[440px] max-w-[calc(100vw-1.067rem)]",
    heightClass: "max-h-[70vh] opacity-100",
    contentClass: "max-h-[65vh] overflow-y-auto",
  },
  workspace: {
    boxClass: "w-[600px] max-w-[calc(100vw-1.067rem)]",
    heightClass: "max-h-[75vh] opacity-100",
    contentClass: "h-[70vh] max-h-[70vh] overflow-hidden",
  },
  "agent-log": {
    boxClass: "w-[480px] max-w-[calc(100vw-1.067rem)]",
    heightClass: "max-h-[400px] opacity-100",
    contentClass: "max-h-[400px] overflow-y-auto",
  },
  usage: {
    boxClass: "w-[480px] max-w-[calc(100vw-1.067rem)]",
    heightClass: "max-h-[400px] opacity-100",
    contentClass: "max-h-[400px] overflow-y-auto",
  },
  events: {
    boxClass: "w-[480px] max-w-[calc(100vw-1.067rem)]",
    heightClass: "max-h-[400px] opacity-100",
    contentClass: "max-h-[400px] overflow-y-auto",
  },
  default: {
    boxClass: "w-[480px] max-w-[calc(100vw-1.067rem)]",
    heightClass: "max-h-[400px] opacity-100",
    contentClass: "max-h-[400px] overflow-y-auto",
  },
};

/** Props for {@link TopBar}. */
interface TopBarProps {
  /** Callback to open the settings modal. */
  onSettings: () => void;
  /** Agent log entries rendered in the dropdown log panel. */
  agentLogEntries: AgentLogEntry[];
  /** Token usage data for the usage panel (null while loading). */
  tokenData: TokenData | null;
  /** Whether the agent-log icon should pulse green to indicate recent activity. */
  logGlow: boolean;
  /** Event log entries for the events panel. */
  eventEntries: EventEntry[];
  /** Whether the Events button/panel should be shown (feature flag). */
  eventsVisible: boolean;
  /** Whether the Log button/panel should be shown (feature flag). */
  logVisible: boolean;
  /** Show compact-layout panel launchers (Sessions/Workspace). */
  mobilePanelButtonsVisible?: boolean;
  /** Renderable Sessions panel content (compact mode). */
  sessionsPanel?: ReactNode;
  /** Renderable Workspace panel content (compact mode). */
  workspacePanel?: ReactNode;
  /** Current view mode (chat or kanban). */
  viewMode?: ViewMode;
  /** Callback to change the view mode. */
  onViewModeChange?: (mode: ViewMode) => void;
  /** Whether the Tasks/Kanban view toggle should be shown. */
  showKanbanView?: boolean;
}

/**
 * Top navigation bar for the Nerve cockpit.
 *
 * Displays the Nerve logo/brand, and provides toggle buttons for the
 * Agent Log, Events, Token Usage, and (in compact mode) Sessions +
 * Workspace panels.
 */
export function TopBar({
  onSettings,
  agentLogEntries,
  tokenData,
  logGlow,
  eventEntries,
  eventsVisible,
  logVisible,
  mobilePanelButtonsVisible = false,
  sessionsPanel,
  workspacePanel,
  viewMode = "chat",
  onViewModeChange,
  showKanbanView = true,
}: TopBarProps) {
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [hoveredView, setHoveredView] = useState<ViewMode | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);

  const togglePanel = useCallback((panel: PanelId) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  const isPanelAvailable = useCallback(
    (panel: PanelId) => {
      if (!panel) return true;
      if (panel === "events") return eventsVisible;
      if (panel === "agent-log") return logVisible;
      if (panel === "sessions")
        return mobilePanelButtonsVisible && Boolean(sessionsPanel);
      if (panel === "workspace")
        return mobilePanelButtonsVisible && Boolean(workspacePanel);
      return true;
    },
    [
      eventsVisible,
      logVisible,
      mobilePanelButtonsVisible,
      sessionsPanel,
      workspacePanel,
    ],
  );

  const visiblePanel = useMemo<PanelId>(() => {
    if (!activePanel) return null;
    return isPanelAvailable(activePanel) ? activePanel : null;
  }, [activePanel, isPanelAvailable]);

  // Clear stale panel state asynchronously when panel availability changes.
  useEffect(() => {
    if (!activePanel || visiblePanel) return;
    const timer = window.setTimeout(() => setActivePanel(null), 0);
    return () => window.clearTimeout(timer);
  }, [activePanel, visiblePanel]);

  // Click outside to close
  useEffect(() => {
    if (!visiblePanel) return;
    function handleClick(e: MouseEvent) {
      const targetNode = e.target as Node;
      if (
        panelRef.current?.contains(targetNode) ||
        buttonsRef.current?.contains(targetNode)
      )
        return;

      const targetElement = e.target instanceof Element ? e.target : null;
      // Keep topbar panel open while interacting with modal/portal content
      // launched from inside the panel (e.g., Spawn Agent, Add Memory dialogs).
      if (
        targetElement?.closest(
          '[data-slot="dialog-content"], [data-slot="dialog-overlay"], [role="dialog"], [data-radix-popper-content-wrapper]',
        )
      ) {
        return;
      }

      setActivePanel(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [visiblePanel]);

  // Escape to close
  useEffect(() => {
    if (!visiblePanel) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActivePanel(null);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [visiblePanel]);

  const totalCost = useMemo(() => {
    if (!tokenData) return null;
    const cost = tokenData.persistent?.totalCost ?? tokenData.totalCost ?? 0;
    return "$" + cost.toFixed(2);
  }, [tokenData]);

  const panelConfig = useMemo(() => {
    if (!visiblePanel) return PANEL_CONFIG.default;
    return PANEL_CONFIG[visiblePanel] ?? PANEL_CONFIG.default;
  }, [visiblePanel]);

  const panelBoxClass = panelConfig.boxClass;
  const panelHeightClass = visiblePanel
    ? panelConfig.heightClass
    : "max-h-0 opacity-0 pointer-events-none";
  const panelContentClass = panelConfig.contentClass;

  const buttonBase = "shell-icon-button h-11 min-w-11 px-3 max-[371px]:h-[38px] max-[371px]:min-w-[38px] max-[371px]:gap-0.5 max-[371px]:px-2 max-[371px]:[&_svg]:size-3 sm:h-10 sm:min-w-9 sm:px-3";

  return (
    <div className="relative z-40 px-2 pt-2 sm:px-4 sm:pt-3">
      <header className="topbar-mobile-compact shell-panel flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-3 py-2 shrink-0 max-[371px]:gap-x-1.5 max-[371px]:px-2 sm:flex-nowrap sm:px-4">
        <div className="flex min-w-0 items-center gap-3 max-[371px]:gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-background/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] max-[371px]:h-9 max-[371px]:w-9">
            <NerveLogo size={24} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold uppercase tracking-[0.34em] text-primary max-[371px]:text-xs max-[371px]:tracking-[0.22em] sm:text-base">
                Nerve Center
              </span>
            </div>
            <div className="hidden xl:block text-[0.733rem] text-muted-foreground/80">
              OpenClaw Cockpit{" "}
            </div>
          </div>
        </div>
        {/* View mode toggle */}
        {onViewModeChange && (
          <div className="order-3 flex w-full items-center gap-2 max-[371px]:gap-1 sm:order-none sm:ml-2 sm:w-auto relative">
            <button
              onClick={() => onViewModeChange("chat")}
              onMouseEnter={() => setHoveredView("chat")}
              onMouseLeave={() => setHoveredView(null)}
              aria-label="Switch to chat view"
              aria-pressed={viewMode === "chat"}
              data-active={viewMode === "chat"}
              className="shell-chip min-h-11 flex-1 justify-center text-[0.733rem] uppercase tracking-[0.14em] max-[371px]:min-h-[38px] max-[371px]:gap-1 max-[371px]:px-2 max-[371px]:text-[0.667rem] max-[371px]:tracking-[0.08em] max-[371px]:[&_svg]:size-3 sm:min-h-10 sm:flex-none"
            >
              <MessageSquare size={13} aria-hidden="true" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => onViewModeChange("research")}
              onMouseEnter={() => setHoveredView("research")}
              onMouseLeave={() => setHoveredView(null)}
              aria-label="Switch to research view"
              aria-pressed={viewMode === "research"}
              data-active={viewMode === "research"}
              className="shell-chip min-h-11 flex-1 justify-center text-[0.733rem] uppercase tracking-[0.14em] max-[371px]:min-h-[38px] max-[371px]:gap-1 max-[371px]:px-2 max-[371px]:text-[0.667rem] max-[371px]:tracking-[0.08em] max-[371px]:[&_svg]:size-3 sm:min-h-10 sm:flex-none"
            >
              <Search size={13} aria-hidden="true" />
              <span>Research</span>
            </button>
            {showKanbanView && (
              <button
                onClick={() => onViewModeChange("kanban")}
                onMouseEnter={() => setHoveredView("kanban")}
                onMouseLeave={() => setHoveredView(null)}
                aria-label="Switch to tasks view"
                aria-pressed={viewMode === "kanban"}
                data-active={viewMode === "kanban"}
                className="shell-chip min-h-11 flex-1 justify-center text-[0.733rem] uppercase tracking-[0.14em] max-[371px]:min-h-[38px] max-[371px]:gap-1 max-[371px]:px-2 max-[371px]:text-[0.667rem] max-[371px]:tracking-[0.08em] max-[371px]:[&_svg]:size-3 sm:min-h-10 sm:flex-none"
              >
                <LayoutGrid size={13} aria-hidden="true" />
                <span>Tasks</span>
              </button>
            )}

            {/* Hover preview card */}
            {hoveredView && (
              <div
                className="absolute top-full left-0 mt-2 z-50 w-56 rounded-2xl border border-border/40 bg-card shadow-xl p-3 pointer-events-none"
                onMouseEnter={() => setHoveredView(null)}
              >
                <div className="flex items-center gap-2 mb-2">
                  {hoveredView === 'chat' && <MessageSquare size={12} className="text-primary/60" />}
                  {hoveredView === 'research' && <Search size={12} className="text-primary/60" />}
                  {hoveredView === 'kanban' && <LayoutGrid size={12} className="text-primary/60" />}
                  <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {hoveredView === 'chat' ? 'Chat' : hoveredView === 'research' ? 'Research' : 'Tasks'}
                  </span>
                </div>
                {hoveredView === 'chat' && (
                  <svg width="100%" height="80" viewBox="0 0 200 80" className="opacity-70">
                    <rect x="10" y="10" width="140" height="20" rx="10" fill="var(--color-primary)" opacity="0.15" />
                    <rect x="50" y="14" width="90" height="4" rx="2" fill="var(--color-foreground)" opacity="0.3" />
                    <rect x="50" y="22" width="60" height="3" rx="1.5" fill="var(--color-foreground)" opacity="0.15" />
                    <rect x="40" y="40" width="150" height="24" rx="10" fill="var(--color-muted)" opacity="0.3" />
                    <rect x="50" y="46" width="110" height="4" rx="2" fill="var(--color-foreground)" opacity="0.3" />
                    <rect x="50" y="54" width="80" height="3" rx="1.5" fill="var(--color-foreground)" opacity="0.15" />
                  </svg>
                )}
                {hoveredView === 'research' && (
                  <svg width="100%" height="80" viewBox="0 0 200 80" className="opacity-70">
                    <rect x="20" y="6" width="160" height="28" rx="8" fill="var(--color-primary)" opacity="0.12" />
                    <circle cx="34" cy="20" r="6" fill="none" stroke="var(--color-muted-foreground)" strokeWidth="1.5" opacity="0.4" />
                    <line x1="38" y1="24" x2="44" y2="30" stroke="var(--color-muted-foreground)" strokeWidth="1.5" opacity="0.4" />
                    <rect x="52" y="14" width="90" height="4" rx="2" fill="var(--color-foreground)" opacity="0.25" />
                    <rect x="20" y="46" width="160" height="24" rx="8" fill="var(--color-muted)" opacity="0.25" />
                    <rect x="30" y="52" width="60" height="4" rx="2" fill="var(--color-foreground)" opacity="0.25" />
                    <rect x="100" y="52" width="50" height="3" rx="1.5" fill="var(--color-foreground)" opacity="0.12" />
                  </svg>
                )}
                {hoveredView === 'kanban' && (
                  <svg width="100%" height="80" viewBox="0 0 200 80" className="opacity-70">
                    <rect x="10" y="8" width="52" height="64" rx="8" fill="var(--color-primary)" opacity="0.1" />
                    <rect x="18" y="16" width="36" height="4" rx="2" fill="var(--color-foreground)" opacity="0.3" />
                    <rect x="18" y="28" width="36" height="14" rx="4" fill="var(--color-muted)" opacity="0.3" />
                    <rect x="18" y="48" width="36" height="14" rx="4" fill="var(--color-muted)" opacity="0.2" />
                    <rect x="74" y="8" width="52" height="64" rx="8" fill="var(--color-primary)" opacity="0.1" />
                    <rect x="82" y="16" width="36" height="4" rx="2" fill="var(--color-foreground)" opacity="0.3" />
                    <rect x="82" y="28" width="36" height="14" rx="4" fill="var(--color-muted)" opacity="0.3" />
                    <rect x="82" y="48" width="36" height="14" rx="4" fill="var(--color-muted)" opacity="0.2" />
                    <rect x="138" y="8" width="52" height="64" rx="8" fill="var(--color-primary)" opacity="0.1" />
                    <rect x="146" y="16" width="36" height="4" rx="2" fill="var(--color-foreground)" opacity="0.3" />
                    <rect x="146" y="28" width="36" height="14" rx="4" fill="var(--color-muted)" opacity="0.15" />
                  </svg>
                )}
              </div>
            )}
          </div>
        )}
        <div ref={buttonsRef} className="ml-auto flex min-w-0 max-w-full items-center justify-end gap-1.5 overflow-x-auto pb-1 max-[371px]:gap-0.5 sm:max-w-none sm:gap-2 sm:overflow-visible sm:pb-0">
          {/* Compact layout launchers (chat-first mode) */}
          {mobilePanelButtonsVisible && sessionsPanel && (
            <button
              onClick={() => togglePanel("sessions")}
              title="Sessions"
              aria-label="Toggle sessions panel"
              aria-expanded={visiblePanel === "sessions"}
              aria-haspopup="true"
              aria-controls="topbar-panel"
              data-active={visiblePanel === "sessions"}
              className={buttonBase}
            >
              <Users size={14} aria-hidden="true" />
              <span className="hidden sm:inline">Sessions</span>
            </button>
          )}

          {mobilePanelButtonsVisible && workspacePanel && (
            <button
              onClick={() => togglePanel("workspace")}
              title="Workspace"
              aria-label="Toggle workspace panel"
              aria-expanded={visiblePanel === "workspace"}
              aria-haspopup="true"
              aria-controls="topbar-panel"
              data-active={visiblePanel === "workspace"}
              className={buttonBase}
            >
              <Brain size={14} aria-hidden="true" />
              <span className="hidden sm:inline">Workspace</span>
            </button>
          )}

          {/* Agent Log button */}
          {logVisible && (
            <button
              onClick={() => togglePanel("agent-log")}
              title="Agent Log"
              aria-label="Toggle agent log panel"
              aria-expanded={visiblePanel === "agent-log"}
              aria-haspopup="true"
              aria-controls="topbar-panel"
              data-active={visiblePanel === "agent-log"}
              className={buttonBase}
            >
              <Activity
                size={14}
                className={logGlow ? "text-green" : ""}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Log</span>
              {agentLogEntries.length > 0 && (
                <span className="hidden min-w-5 items-center justify-center rounded-full bg-background/80 px-1.5 py-0.5 text-[0.6rem] tabular-nums text-foreground/80 md:inline-flex">
                  {agentLogEntries.length}
                </span>
              )}
            </button>
          )}

          {/* Events button */}
          {eventsVisible && (
            <button
              onClick={() => togglePanel("events")}
              title="Events"
              aria-label="Toggle events panel"
              aria-expanded={visiblePanel === "events"}
              aria-haspopup="true"
              aria-controls="topbar-panel"
              data-active={visiblePanel === "events"}
              className={buttonBase}
            >
              <Radio size={14} aria-hidden="true" />
              <span className="hidden sm:inline">Events</span>
              {eventEntries.length > 0 && (
                <span className="hidden min-w-5 items-center justify-center rounded-full bg-background/80 px-1.5 py-0.5 text-[0.6rem] tabular-nums text-foreground/80 md:inline-flex">
                  {eventEntries.length}
                </span>
              )}
            </button>
          )}

          {/* Usage button */}
          <button
            onClick={() => togglePanel("usage")}
            title="Token Usage"
            aria-label="Toggle usage panel"
            aria-expanded={visiblePanel === "usage"}
            aria-haspopup="true"
            aria-controls="topbar-panel"
            data-active={visiblePanel === "usage"}
            className={buttonBase}
          >
            <BarChart3 size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Usage</span>
            {totalCost && (
              <span className="hidden rounded-full bg-background/80 px-2 py-0.5 text-[0.6rem] tabular-nums text-foreground/80 lg:inline-flex">
                {totalCost}
              </span>
            )}
          </button>

          {/* Settings button */}
          <button
            onClick={onSettings}
            title="Settings"
            aria-label="Open settings"
            className="shell-icon-button size-11 px-0 max-[371px]:size-[38px] max-[371px]:[&_svg]:size-3 sm:size-10"
          >
            <Settings size={14} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Expandable dropdown panel */}
      <div
        ref={panelRef}
        id="topbar-panel"
        role="region"
        aria-label={visiblePanel ? `${visiblePanel} panel` : undefined}
        hidden={!visiblePanel}
        className={`shell-panel absolute right-0 mt-2 overflow-hidden rounded-2xl transition-all duration-200 ease-out ${panelBoxClass} ${panelHeightClass}`}
        style={{ top: "100%" }}
      >
        <div className={panelContentClass}>
          <Suspense
            fallback={
              <div className="p-4 text-muted-foreground text-xs">Loading…</div>
            }
          >
            {visiblePanel === "agent-log" && (
              <AgentLog entries={agentLogEntries} glow={logGlow} />
            )}
            {visiblePanel === "events" && <EventLog entries={eventEntries} />}
            {visiblePanel === "usage" && <TokenUsage data={tokenData} />}
            {visiblePanel === "sessions" && sessionsPanel}
            {visiblePanel === "workspace" && workspacePanel}
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/**
 * SidebarStrip.tsx - Collapsed sidebar icon strip
 *
 * When a sidebar is collapsed, this component renders a thin vertical strip
 * (~40px wide) with icon buttons for each panel in that sidebar. Hovering
 * over the strip triggers sidebar expansion (handled by the parent via
 * `onHover`), and clicking an icon toggles that panel's expanded state.
 *
 * Inspired by VS Code's activity bar / icon strip pattern.
 *
 * @example
 * ```tsx
 * <SidebarStrip
 *   side="left"
 *   panelIds={['workspace']}
 *   onPanelClick={togglePanelCollapse}
 *   onToggleSidebar={() => setLeftSidebarCollapsed(false)}
 * />
 * ```
 */
import { type LucideIcon, FolderTree, Bot, Brain, Lightbulb, BookMarked, Activity, ChevronLeft, ChevronRight } from 'lucide-react';

/** Internal icon-to-component mapping for known panel IDs. */
const PANEL_ICONS: Record<string, LucideIcon> = {
  workspace: FolderTree,
  agents: Bot,
  memory: Brain,
  thoughts: Lightbulb,
  references: BookMarked,
  activity: Activity,
};

/** Props for the {@link SidebarStrip} component. */
interface SidebarStripProps {
  /** Which side of the screen the strip is on. Affects chevron direction. */
  side: 'left' | 'right';
  /** Ordered list of panel IDs to render icon buttons for. */
  panelIds: string[];
  /**
   * Called when a panel icon is clicked.
   * Receives the panel's string ID (e.g., `'workspace'`, `'agents'`).
   * Typically wired to `togglePanelCollapse`.
   */
  onPanelClick?: (id: string) => void;
  /** Called when the user clicks the expand/collapse toggle button. */
  onToggleSidebar?: () => void;
}

/**
 * A thin vertical strip (~40px) shown when a sidebar is collapsed.
 *
 * Maps each panel ID to its corresponding Lucide icon and renders them
 * as clickable, tooltipped buttons. A chevron toggle at the top/bottom
 * allows re-expanding the sidebar.
 *
 * The `side` prop controls chevron direction:
 * - `'left'` strip → chevron points right (→ to expand)
 * - `'right'` strip → chevron points left (← to expand)
 */
export function SidebarStrip({ side, panelIds, onPanelClick, onToggleSidebar }: SidebarStripProps) {
  const ChevronIcon = side === 'left' ? ChevronRight : ChevronLeft;

  return (
    <div
      className={`flex flex-col items-center gap-1.5 py-3 w-10 h-full shrink-0 bg-card border-${side === 'left' ? 'r' : 'l'} border-border/40 overflow-hidden`}
      role="toolbar"
      aria-label={`${side === 'left' ? 'Left' : 'Right'} sidebar collapsed icons`}
    >
      {/* Toggle sidebar button */}
      <button
        onClick={onToggleSidebar}
        className="flex items-center justify-center size-7 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-colors mb-1"
        title={side === 'left' ? 'Expand sidebar' : 'Expand sidebar'}
        aria-label={side === 'left' ? 'Expand left sidebar' : 'Expand right sidebar'}
      >
        <ChevronIcon size={16} />
      </button>

      {/* Separator */}
      <div className="w-5 h-px bg-border/30 mb-1.5" />

      {/* Panel icon buttons */}
      {panelIds.map((id) => {
        const Icon = PANEL_ICONS[id];
        if (!Icon) return null;

        const label = id.charAt(0).toUpperCase() + id.slice(1);

        return (
          <button
            key={id}
            onClick={() => onPanelClick?.(id)}
            className="group relative flex items-center justify-center size-8 rounded-lg text-muted-foreground/45 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
            title={label}
            aria-label={`Toggle ${label} panel`}
          >
            <Icon size={18} />
          </button>
        );
      })}
    </div>
  );
}

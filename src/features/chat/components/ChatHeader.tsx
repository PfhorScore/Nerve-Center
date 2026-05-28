import { ChevronDown, ChevronUp, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface ChatHeaderProps {
  onAbort: () => void;
  isGenerating: boolean;
  onToggleFileBrowser?: () => void;
  isFileBrowserCollapsed?: boolean;
  onToggleMobileTopBar?: () => void;
  isMobileTopBarHidden?: boolean;
}

/**
 * COMMS header with model/effort selectors and controls.
 *
 * Model and effort state management is delegated to useModelEffort() —
 * this component is purely presentational + event wiring.
 */
export function ChatHeader({
  onAbort,
  isGenerating,
  onToggleFileBrowser,
  isFileBrowserCollapsed = true,
  onToggleMobileTopBar,
  isMobileTopBarHidden = false,
}: ChatHeaderProps) {
  return (
    <div className="panel-header items-center gap-2 overflow-x-auto border-l-[3px] border-l-primary/70 px-2.5 py-2 whitespace-nowrap sm:gap-2.5 sm:px-3 sm:py-3">
      {/* Mobile chrome controls */}
      {onToggleMobileTopBar ? (
        <div className="shell-panel flex size-11 shrink-0 flex-col overflow-hidden max-[371px]:size-[38px]">
          <button
            type="button"
            onClick={onToggleMobileTopBar}
            className="flex flex-1 items-center justify-center border-b border-border/70 text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            title={isMobileTopBarHidden ? 'Show header controls' : 'Hide header controls'}
            aria-label={isMobileTopBarHidden ? 'Show header controls' : 'Hide header controls'}
          >
            {isMobileTopBarHidden ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button
            type="button"
            onClick={onToggleFileBrowser}
            disabled={!onToggleFileBrowser}
            className="flex flex-1 items-center justify-center text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
            title={`${isFileBrowserCollapsed ? 'Open' : 'Close'} file explorer (Ctrl+B)`}
            aria-label={`${isFileBrowserCollapsed ? 'Open' : 'Close'} file explorer`}
          >
            {isFileBrowserCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
        </div>
      ) : onToggleFileBrowser && (
        <button
          onClick={onToggleFileBrowser}
          className="shell-icon-button size-11 shrink-0 px-0 sm:size-10 relative"
          title="Open file explorer (Ctrl+B)"
          aria-label="Open file explorer"
        >
          <PanelLeftOpen size={17} />
        </button>
      )}


      {/* Abort button during generation */}
      <div className="ml-auto flex items-center gap-1">
        {isGenerating && (
          <button
            onClick={onAbort}
            aria-label="Stop generating"
            title="Stop generating"
            className="shell-icon-button size-9 shrink-0 px-0 relative"
          >
            <span className="absolute -inset-0.5 rounded-full bg-primary/8 animate-ping" />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}

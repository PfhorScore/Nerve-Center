/**
 * AgentHubDrawer — Slide-out drawer for agent management and memory.
 *
 * Renders the Agents panel (SessionList) and Memory panel (WorkspacePanel)
 * in a right-side drawer, identical in pattern to SettingsDrawer.
 *
 * Frees up sidebar real estate by moving these system-management panels
 * out of the main chat layout and into a dedicated overlay.
 */

import { useEffect, useRef } from 'react';
import { Users, X } from 'lucide-react';
import { SubAgentPanel } from './SubAgentPanel';

interface AgentHubDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Agents panel content (SessionList wrapped in PanelErrorBoundary). */
  agentsPanel: React.ReactNode;
  /** Memory panel content (WorkspacePanel wrapped in PanelErrorBoundary). */
  memoryPanel: React.ReactNode;
}

/**
 * Right-slide-out drawer for the Agent Hub.
 *
 * Mirrors the exact animation and structure of {@link SettingsDrawer}
 * — backdrop overlay, slide-in-right panel, close on backdrop click
 * or Escape key.
 */
export function AgentHubDrawer({ open, onClose, agentsPanel, memoryPanel }: AgentHubDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap: focus close button on open
  useEffect(() => {
    if (open) {
      // Small delay to let the animation start before focusing
      const timer = setTimeout(() => closeButtonRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 animate-fade-in bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-hub-title"
        className="fixed right-0 top-0 z-50 flex h-full w-full flex-col overflow-hidden border-l border-border/80 bg-card/92 shadow-[0_32px_90px_rgba(0,0,0,0.36)] backdrop-blur-2xl animate-slide-in-right sm:w-[480px] sm:max-w-[94vw]"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-border/70 bg-secondary/45 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <span className="cockpit-kicker" id="agent-hub-title">
                <Users size={14} className="text-primary" aria-hidden="true" />
                Agent Hub
              </span>
              <div className="cockpit-title text-[1.1rem]">Sessions &amp; Memory</div>
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="shell-icon-button size-10 shrink-0"
              aria-label="Close agent hub"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
        {/* Agents section */}
          <div className="border-b border-border/40">
            <div className="px-5 py-3">
              <h3 className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground/60">Active Sessions</h3>
            </div>
            <SubAgentPanel />
            <div className="px-2 pb-3">
              {agentsPanel}
            </div>
          </div>

          {/* Memory section */}
          <div className="border-b border-border/40 flex flex-col">
            <div className="px-5 py-3">
              <h3 className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground/60">Memory &amp; Configuration</h3>
            </div>
            <div className="px-2 pb-3 h-[400px] overflow-y-auto">
              {memoryPanel}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/40 px-5 py-3 text-[0.6rem] text-muted-foreground/40 text-center">
          Manage your agents, sessions, and memories
        </div>
      </div>
    </>
  );
}

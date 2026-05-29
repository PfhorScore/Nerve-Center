import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ContextMeter } from './ContextMeter';
import { UpdateBadge } from './UpdateBadge';
import { useGateway } from '@/contexts/GatewayContext';
import { Cpu, Gauge, X } from 'lucide-react';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { useModelEffort } from '@/features/chat/components/useModelEffort';

/** Props for {@link StatusBar}. */
interface StatusBarProps {
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  sessionCount: number;
  sparkline: string;
  contextTokens?: number;
  contextLimit?: number;
  rightPanelCollapsed?: boolean;
  onToggleRightPanel?: () => void;
  isGenerating?: boolean;
  onReset?: () => void;
}

function formatUptime(seconds: number): string {
  if (seconds < 0) return '00:00:00';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return d > 0 ? `${d}d ${h}:${m}:${s}` : `${h}:${m}:${s}`;
}

function formatServerTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour12: false });
}

/** Fetch server time and gateway uptime from /api/server-info */
async function fetchServerInfo(): Promise<{ serverTime?: number; gatewayStartedAt?: number; serverStartedAt?: number } | null> {
  try {
    const res = await fetch('/api/server-info');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Bottom status bar for the Nerve cockpit.
 *
 * Shows connection state, server time, session count, gateway uptime,
 * an optional context-window meter, a sparkline, and the app version.
 */
export function StatusBar({ connectionState, sessionCount, sparkline, contextTokens, contextLimit, rightPanelCollapsed, onToggleRightPanel, onReset }: StatusBarProps) {
  useGateway();
  const {
    modelOptions, effortOptions, selectedModel, selectedEffort, selectedEffortLabel,
    handleModelChange, handleEffortChange, controlsDisabled, uiError,
  } = useModelEffort();

  // Server time: offset between local clock and server clock
  const [serverTimeOffset, setServerTimeOffset] = useState<number | null>(null);
  // Gateway start time (epoch ms) — persists across page loads
  const [gatewayStartedAt, setGatewayStartedAt] = useState<number | null>(null);
  // Ticking display values
  const [now, setNow] = useState(() => Date.now());

  // Changelog dialog
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [changelogContent, setChangelogContent] = useState('');

  useEffect(() => {
    if (changelogOpen && !changelogContent) {
      fetch('/CHANGELOG.md').then(r => r.text()).then(t => setChangelogContent(t)).catch(() => {});
    }
  }, [changelogOpen, changelogContent]);

  // Use connectionState as key to trigger CSS animation on change
  const flashKey = connectionState;

  // Sync server info helper
  const syncServerInfo = useCallback(async (signal: { cancelled: boolean }) => {
    const data = await fetchServerInfo();
    if (signal.cancelled || !data) return;
    const localNow = Date.now();
    if (typeof data.serverTime === 'number') {
      setServerTimeOffset(data.serverTime - localNow);
    }
    if (typeof data.gatewayStartedAt === 'number') {
      setGatewayStartedAt(data.gatewayStartedAt);
    } else if (typeof data.serverStartedAt === 'number') {
      // Fallback to Nerve server start time when gateway PID is not found
      setGatewayStartedAt(data.serverStartedAt);
    }
  }, []);

  // Fetch server info on mount and reconnect
  useEffect(() => {
    // Skip if disconnected/connecting (except initial mount)
    if (connectionState !== 'connected' && connectionState !== 'disconnected') return;
    const signal = { cancelled: false };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch with cancellation is valid
    syncServerInfo(signal);
    return () => { signal.cancelled = true; };
  }, [connectionState, syncServerInfo]);

  // Tick every second
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const statusColor = connectionState === 'connected'
    ? 'border-green/30 bg-green/10 text-green'
    : connectionState === 'connecting' || connectionState === 'reconnecting'
    ? 'border-orange/30 bg-orange/10 text-orange animate-pulse-dot'
    : 'border-red/30 bg-red/10 text-red';

  const statusLabel = connectionState === 'connected'
    ? 'CONNECTED'
    : connectionState === 'connecting'
    ? 'CONNECTING'
    : connectionState === 'reconnecting'
    ? 'RECONNECTING'
    : 'OFFLINE';

  // Server time = local time + offset
  const serverTime = serverTimeOffset !== null
    ? new Date(now + serverTimeOffset)
    : null;

  // Gateway uptime = (server now) - gatewayStartedAt
  const gatewayUptimeSecs = gatewayStartedAt && serverTimeOffset !== null
    ? Math.floor((now + serverTimeOffset - gatewayStartedAt) / 1000)
    : null;

  return (
    <div className="shell-panel mx-2 mb-2 flex min-h-10 flex-wrap items-center gap-y-1 overflow-hidden rounded-2xl px-3 py-2 text-[0.667rem] text-muted-foreground shrink-0 select-none max-[378px]:min-h-9 max-[378px]:gap-y-0.5 max-[378px]:px-2.5 max-[378px]:py-1.5 max-[378px]:text-[0.6rem] sm:mx-4 sm:mb-3 sm:flex-nowrap sm:gap-y-0 sm:overflow-x-auto sm:px-4 sm:text-[0.733rem]">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 overflow-visible whitespace-normal max-[378px]:gap-x-2 max-[378px]:gap-y-0.5 sm:flex-nowrap sm:gap-x-3 sm:gap-y-0 sm:whitespace-nowrap">
        {/* Connection status */}
        <span
          key={flashKey}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.08em] max-[378px]:gap-0.5 max-[378px]:px-1.5 max-[378px]:py-0.5 max-[378px]:text-[0.533rem] max-[378px]:tracking-[0.06em] sm:gap-1.5 sm:px-2.5 sm:tracking-[0.12em] ${statusColor} animate-status-flash`}
        >
          <span className="text-[0.533rem] max-[378px]:text-[0.4375rem]" aria-hidden="true">●</span>
          <span>{statusLabel}</span>
        </span>

        {/* Server time (hidden on narrow screens) */}
        <span className="hidden text-border md:inline">•</span>
        {serverTime ? (
          <span className="hidden font-mono tabular-nums text-foreground/72 md:inline">{formatServerTime(serverTime)}</span>
        ) : (
          <span className="hidden font-mono text-muted-foreground/40 md:inline">--:--:--</span>
        )}

        <span className="text-border max-[378px]:text-[0.533rem]">•</span>

        {/* Session count */}
        <span className="shrink-0 text-foreground/78 max-[378px]:text-[0.6rem]">
          <span className="font-mono tabular-nums text-foreground">{sessionCount}</span>
          <span className="ml-1 sm:hidden">sessions</span>
          <span className="ml-1 hidden sm:inline">active sessions</span>
        </span>

        {/* Gateway uptime (hidden on narrow/medium screens) */}
        <span className="hidden text-border lg:inline">•</span>
        <span className="hidden text-foreground/72 lg:inline">
          Uptime <span className="font-mono tabular-nums">{gatewayUptimeSecs !== null ? formatUptime(gatewayUptimeSecs) : '--:--:--'}</span>
        </span>

        {/* Context Meter (always visible when available) */}
        {contextTokens != null && contextLimit != null && contextLimit > 0 && (
          <>
            <span className="text-border max-[378px]:text-[0.533rem]">•</span>
            <span className="inline-flex shrink-0">
              <ContextMeter used={contextTokens} limit={contextLimit} />
            </span>
          </>
        )}
      </div>

      {/* Right side controls (hidden on smaller screens) */}
      <div className="ml-3 hidden shrink-0 items-center gap-2 lg:flex">
        {/* Model selector */}
        <div className="flex items-center gap-1">
          <Cpu size={11} className="shrink-0 text-muted-foreground/50" />
          <InlineSelect
            value={controlsDisabled ? '' : selectedModel}
            onChange={handleModelChange}
            ariaLabel="Model"
            disabled={controlsDisabled}
            title={controlsDisabled ? 'Connect to gateway to change model' : uiError || undefined}
            triggerClassName="max-w-[110px] rounded-xl border-border/75 bg-background/65 px-2 py-1 text-[0.6rem] font-sans text-foreground"
            menuClassName="min-w-[160px] rounded-2xl border-border/80 bg-card/98 p-1 shadow-[0_20px_50px_rgba(0,0,0,0.28)]"
            options={modelOptions}
          />
        </div>
        {/* Effort selector */}
        <div className="flex items-center gap-1">
          <Gauge size={11} className="shrink-0 text-muted-foreground/50" />
          <InlineSelect
            value={controlsDisabled ? '' : selectedEffort}
            onChange={handleEffortChange}
            ariaLabel="Effort"
            disabled={controlsDisabled}
            triggerClassName="max-w-[80px] rounded-xl border-border/75 bg-background/65 px-2 py-1 text-[0.6rem] font-sans text-foreground"
            menuClassName="rounded-2xl border-border/80 bg-card/98 p-1 shadow-[0_20px_50px_rgba(0,0,0,0.28)]"
            displayLabel={selectedEffortLabel}
            options={effortOptions}
          />
        </div>
        {/* Reset session button */}
        {onReset && (
          <button
            onClick={() => onReset()}
            title="Reset session (start fresh)"
            aria-label="Reset session"
            className="flex items-center justify-center size-6 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36"/></svg>
          </button>
        )}
        {/* Sidebar collapse toggle */}
        {onToggleRightPanel && (
          <button
            onClick={onToggleRightPanel}
            className="flex items-center justify-center size-6 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
            title={rightPanelCollapsed ? 'Expand right panels' : 'Collapse right panels'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {rightPanelCollapsed
                ? <><polyline points="9 18 15 12 9 6" /></>
                : <><polyline points="15 18 9 12 15 6" /></>
              }
            </svg>
          </button>
        )}
        <span className="rounded-full border border-border/70 bg-background/75 px-2.5 py-1 font-mono text-[0.667rem] tracking-[-0.08em] text-muted-foreground">
          {sparkline}<span className="ml-1 text-primary animate-alive">_</span>
        </span>
        <span
          onClick={() => setChangelogOpen(true)}
          className="text-[0.6rem] font-medium uppercase tracking-[0.18em] text-muted-foreground/55 hover:text-primary/70 hover:underline cursor-pointer transition-colors"
          title="Click for changelog"
        >v{__APP_VERSION__}</span>
        <UpdateBadge />
      </div>

      {/* Changelog dialog — portal to body to escape shell-panel's backdrop-filter */}
      {changelogOpen && createPortal(
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setChangelogOpen(false)} />
          <div className="fixed inset-4 z-50 m-auto flex max-h-[80vh] max-w-[600px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_32px_90px_rgba(0,0,0,0.4)] sm:inset-auto">
            <div className="flex items-center justify-between border-b border-border/50 px-5 py-3 shrink-0">
              <span className="text-[0.667rem] font-semibold tracking-wider text-foreground/80">Changelog — v{__APP_VERSION__}</span>
              <button onClick={() => setChangelogOpen(false)} className="shell-icon-button size-8" aria-label="Close">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="whitespace-pre-wrap text-[0.733rem] text-foreground/80 font-sans leading-relaxed">
                {changelogContent || 'Loading...'}
              </pre>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

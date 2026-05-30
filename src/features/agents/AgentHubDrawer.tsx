/**
 * AgentHubDrawer — Slide-out drawer for agent management and memory.
 *
 * Renders the Agents panel (SessionList) and Memory panel (WorkspacePanel)
 * in a right-side drawer, identical in pattern to SettingsDrawer.
 *
 * Frees up sidebar real estate by moving these system-management panels
 * out of the main chat layout and into a dedicated overlay.
 */

import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { Users, X, Upload, ChevronDown, BarChart3 } from 'lucide-react';
import { SubAgentPanel } from './SubAgentPanel';
import type { TokenData } from '@/types';

const TokenUsage = lazy(() => import('@/features/dashboard/TokenUsage').then(m => ({ default: m.TokenUsage })));

interface AgentHubDrawerProps {
  open: boolean;
  onClose: () => void;
  agentsPanel: React.ReactNode;
  memoryPanel: React.ReactNode;
  /** List of known agent names for per-agent avatar selection. */
  agentNames?: string[];
  /** Token usage data for the dashboard section. */
  tokenData?: TokenData | null;
}

/**
 * Right-slide-out drawer for the Agent Hub.
 *
 * Mirrors the exact animation and structure of {@link SettingsDrawer}
 * — backdrop overlay, slide-in-right panel, close on backdrop click
 * or Escape key.
 */
export function AgentHubDrawer({ open, onClose, agentsPanel, memoryPanel, agentNames, tokenData }: AgentHubDrawerProps) {
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

          {/* Usage section — collapsed by default */}
          <details className="border-b border-border/40 group">
            <summary className="flex items-center gap-2 px-4 py-2 border-b border-border/20 flex items-center justify-between">
              <BarChart3 size={12} className="text-muted-foreground/40" />
              Usage &amp; Tokens
              <span className="ml-auto text-[0.5rem] text-muted-foreground/30 group-open:hidden">▸</span>
              <span className="ml-auto text-[0.5rem] text-muted-foreground/30 hidden group-open:inline">▾</span>
            </summary>
            <div className="px-3 pb-3">
              {tokenData ? (
                <Suspense fallback={<div className="p-4 text-[0.667rem] text-muted-foreground">Loading...</div>}>
                  <TokenUsage data={tokenData} />
                </Suspense>
              ) : (
                <div className="py-4 text-center text-[0.667rem] text-muted-foreground/50">No usage data yet</div>
              )}
            </div>
          </details>

          {/* Avatar section */}
          <AvatarSection knownAgents={agentNames} />

        {/* Agents section */}
          <div className="border-b border-border/40">
            <div className="px-5 py-3">
              <span className="text-xs font-semibold text-muted-foreground/80">Active Sessions</span>
            </div>
            <SubAgentPanel />
            <div className="px-2 pb-3">
              {agentsPanel}
            </div>
          </div>

          {/* Memory section */}
          <div className="border-b border-border/40 flex flex-col">
            <div className="px-5 py-3">
              <span className="text-xs font-semibold text-muted-foreground/80">Memory &amp; Configuration</span>
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

function getAvatarKey(name: string): string {
  return `nerve-avatar-${name}`;
}

/**
 * AvatarSection — Upload and manage per-agent avatars.
 * Stores each agent's avatar URL in localStorage keyed by agent name.
 */
function AvatarSection({ knownAgents }: { knownAgents?: string[] }) {
  const agentNames = useMemo(() => {
    const names = new Set(knownAgents || []);
    names.add('You');
    return Array.from(names).sort();
  }, [knownAgents]);
  const [agentName, setAgentName] = useState(() => {
    try { return localStorage.getItem('nerve-agent-name') || 'You'; } catch { return 'You'; }
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    try { return localStorage.getItem(getAvatarKey(agentName)) || ''; } catch { return ''; }
  });
  const [uploading, setUploading] = useState(false);

  const refreshAvatar = useCallback((name: string) => {
    setAgentName(name);
    try { setAvatarUrl(localStorage.getItem(getAvatarKey(name)) || ''); } catch { setAvatarUrl(''); }
  }, []);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB.'); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload-reference/resolve', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok && data.items?.[0]?.absolutePath) {
        const path = data.items[0].absolutePath;
        localStorage.setItem(getAvatarKey(agentName), path);
        setAvatarUrl(path);
      }
    } catch (err) { console.error('Avatar upload failed:', err); }
    finally { setUploading(false); }
  }, [agentName]);

  const handleRemove = useCallback(() => {
    localStorage.removeItem(getAvatarKey(agentName));
    setAvatarUrl('');
  }, [agentName]);

  return (
    <div className="border-b border-border/40">
      <div className="px-5 py-3">
        <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">Avatar</span>
        <div className="flex items-center gap-4">
          {/* Preview */}
          <div className="size-14 rounded-full border-2 border-border/50 overflow-hidden bg-secondary/30 flex items-center justify-center shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-muted-foreground/40">{agentName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          {/* Controls */}
          <div className="flex flex-col gap-1.5">
            <label className="shell-icon-button inline-flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-[0.667rem]">
              <Upload size={12} />
              <span>{uploading ? 'Uploading…' : 'Upload'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
            {avatarUrl && <button onClick={handleRemove} className="text-[0.6rem] text-muted-foreground/50 hover:text-destructive transition-colors text-left">Remove</button>}
          </div>
        </div>
        <div className="mt-2 relative">
          <span className="text-[0.533rem] text-muted-foreground/40 block mb-1">Set avatar for:</span>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 w-full bg-transparent border border-border/30 rounded-lg px-2.5 py-1.5 text-[0.667rem] text-foreground/70 hover:border-primary/40 transition-colors"
          >
            <span className="flex-1 text-left">{agentName}</span>
            <ChevronDown size={12} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showDropdown && (
            <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-xl border border-border/70 bg-card shadow-[0_8px_30px_rgba(0,0,0,0.28)] p-1 max-h-[200px] overflow-y-auto">
              {agentNames.map((name) => (
                <button
                  key={name}
                  onClick={() => { refreshAvatar(name); setShowDropdown(false); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[0.667rem] transition-colors ${name === agentName ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-foreground/[0.04]'}`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-[0.533rem] text-muted-foreground/40 mt-1">PNG, JPG or WebP up to 2MB. Per-agent avatars.</p>
      </div>
    </div>
  );
}

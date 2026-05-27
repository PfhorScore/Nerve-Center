/**
 * WorkspacePanel — Tabbed container replacing the standalone MemoryList.
 * Tabs: Memory, Crons, Config (with Files/Skills sub-views)
 * Active tab persisted in localStorage. Content lazy-loaded per tab.
 * Tab action buttons (add, refresh) render in the tab bar header.
 */

import { useState, useCallback, lazy, Suspense } from 'react';
import { WorkspaceTabs, type TabId } from './WorkspaceTabs';
import { CronsTab, ConfigTab, SkillsTab } from './tabs';
import { useCrons } from './hooks/useCrons';
import { getWorkspaceStorageKey } from './workspaceScope';
import type { Memory } from '@/types';

const MemoryList = lazy(() => import('@/features/dashboard/MemoryList').then(m => ({ default: m.MemoryList })));

const CONFIG_VIEW_KEY = 'nerve-config-view';

type ConfigView = 'files' | 'skills';

function getInitialConfigView(agentId: string): ConfigView {
  try {
    if (localStorage.getItem(CONFIG_VIEW_KEY) === 'skills') {
      return 'skills';
    }

    const stored = localStorage.getItem(getWorkspaceStorageKey('config-view', agentId));
    if (stored === 'files') {
      return 'files';
    }
  } catch {
    // ignore storage errors
  }

  return 'files';
}

function persistConfigView(view: ConfigView, agentId: string) {
  try {
    if (view === 'skills') {
      localStorage.setItem(CONFIG_VIEW_KEY, 'skills');
      return;
    }

    localStorage.removeItem(CONFIG_VIEW_KEY);
    localStorage.setItem(getWorkspaceStorageKey('config-view', agentId), 'files');
  } catch {
    // ignore storage errors
  }
}

interface ConfigWithSkillsProps {
  agentId: string;
  cronWarning?: string | null;
}

/** Combined Config tab with Files/Skills sub-view toggle. */
function ConfigWithSkills({ agentId, cronWarning = null }: ConfigWithSkillsProps) {
  const [view, setView] = useState<ConfigView>(() => getInitialConfigView(agentId));

  const switchView = useCallback((nextView: ConfigView) => {
    setView(nextView);
    persistConfigView(nextView, agentId);
  }, [agentId]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border/40">
        {(['files', 'skills'] as const).map(nextView => (
          <button
            key={nextView}
            onClick={() => switchView(nextView)}
            className={`text-[0.667rem] uppercase tracking-wider px-2 py-0.5 rounded-sm border-0 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-purple/50 focus-visible:ring-offset-0 ${
              view === nextView
                ? 'bg-purple/15 text-purple font-semibold'
                : 'bg-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {nextView}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {view === 'files' ? <ConfigTab key={agentId} agentId={agentId} cronWarning={cronWarning} /> : <SkillsTab key={agentId} agentId={agentId} />}
      </div>
    </div>
  );
}

const STORAGE_KEY = 'nerve-workspace-tab';

function getInitialTab(): TabId {
  const allowedTabs: TabId[] = ['memory', 'crons', 'config'];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && allowedTabs.includes(stored as TabId)) {
      return stored as TabId;
    }
  } catch { /* ignore */ }
  return 'memory';
}

interface WorkspacePanelProps {
  workspaceAgentId: string;
  memories: Memory[];
  onRefreshMemories: (signal?: AbortSignal) => void | Promise<void>;
  memoriesLoading?: boolean;
  /** True when the workspace lives in a remote sandbox (gateway RPC mode). */
  remoteWorkspace?: boolean;
  /** Render in compact dropdown mode (chat-first topbar panel). */
  compact?: boolean;
}

export function WorkspacePanel({
  workspaceAgentId,
  memories,
  onRefreshMemories,
  memoriesLoading,
  remoteWorkspace = false,
  compact = false,
}: WorkspacePanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>(() => getInitialTab());
  const { activeCount, cronWarning } = useCrons();

  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(() => new Set([activeTab]));

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setVisitedTabs(prev => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    try {
      localStorage.setItem(STORAGE_KEY, tab);
    } catch { /* ignore */ }
  }, []);

  return (
    <div className={compact ? 'h-[70vh] max-h-[70vh] flex flex-col min-h-0' : 'flex-1 min-h-0 flex flex-col'}>
      <WorkspaceTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        cronCount={activeCount || undefined}
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={activeTab === 'memory' ? 'flex-1 min-h-0' : 'hidden'} hidden={activeTab !== 'memory'} role="tabpanel" id="workspace-tabpanel-memory" aria-labelledby="workspace-tab-memory">
          {visitedTabs.has('memory') && (
            <Suspense fallback={<div className="flex items-center justify-center text-muted-foreground text-xs p-4">Loading…</div>}>
              <MemoryList
                key={workspaceAgentId}
                agentId={workspaceAgentId}
                memories={memories}
                onRefresh={onRefreshMemories}
                isLoading={memoriesLoading}
                remoteWorkspace={remoteWorkspace}
                hideHeader
                compact={compact}
              />
            </Suspense>
          )}
        </div>
        <div className={activeTab === 'crons' ? 'flex-1 min-h-0' : 'hidden'} hidden={activeTab !== 'crons'} role="tabpanel" id="workspace-tabpanel-crons" aria-labelledby="workspace-tab-crons">
          {visitedTabs.has('crons') && (
            <CronsTab />
          )}
        </div>
        <div className={activeTab === 'config' ? 'flex-1 min-h-0' : 'hidden'} hidden={activeTab !== 'config'} role="tabpanel" id="workspace-tabpanel-config" aria-labelledby="workspace-tab-config">
          {visitedTabs.has('config') && <ConfigWithSkills key={workspaceAgentId} agentId={workspaceAgentId} cronWarning={cronWarning} />}
        </div>
      </div>
    </div>
  );
}

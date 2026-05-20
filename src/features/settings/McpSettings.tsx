import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  RefreshCw,
  Server,
  Plug,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Wrench,
  Eye,
  EyeOff,
  Terminal,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { McpServerFormModal } from './McpServerFormModal';
import { getMcpChatVisibility, setMcpChatVisibility } from '@/lib/mcp-visibility';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface McpServerConfig {
  command?: string;
  args?: string[];
  url?: string;
  transport?: string;
  env?: Record<string, string>;
  cwd?: string;
  workingDirectory?: string;
}

interface McpServerEntry extends McpServerConfig {
  name: string;
  type: 'stdio' | 'http';
}

interface McpServersResponse {
  servers: McpServerEntry[];
}

interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface McpTestResponse {
  ok: boolean;
  output?: string;
  tools?: McpToolInfo[];
  toolCount?: number;
  error?: string;
}

interface TestResult {
  status: 'idle' | 'testing' | 'ok' | 'error';
  message?: string;
  tools?: McpToolInfo[];
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

function useMcpServers() {
  const [servers, setServers] = useState<McpServerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/mcp/servers', { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) {
        throw new Error(`Server returned ${resp.status}`);
      }
      const data = await resp.json() as McpServersResponse;
      setServers(data.servers || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const addServer = useCallback(async (config: McpServerEntry) => {
    const resp = await fetch('/api/mcp/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'Failed to save server');
    await fetchServers();
  }, [fetchServers]);

  const deleteServer = useCallback(async (name: string) => {
    const resp = await fetch(`/api/mcp/servers/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'Failed to delete server');
    await fetchServers();
  }, [fetchServers]);

  const testServer = useCallback(async (name: string): Promise<TestResult> => {
    try {
      const resp = await fetch(`/api/mcp/servers/${encodeURIComponent(name)}/test`, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
      });
      const data = await resp.json() as McpTestResponse;
      if (data.ok) {
        return {
          status: 'ok',
          message: `${data.toolCount || 0} tool${data.toolCount !== 1 ? 's' : ''} available`,
          tools: data.tools || [],
        };
      }
      return {
        status: 'error',
        message: data.error || 'Connection failed',
        tools: data.tools || [],
      };
    } catch (err) {
      return { status: 'error', message: (err as Error).message };
    }
  }, []);

  return { servers, loading, error, fetchServers, addServer, deleteServer, testServer };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getServerLabel(server: McpServerEntry): string {
  if (server.command) {
    const args = server.args?.slice(0, 2).join(' ') || '';
    return `${server.command} ${args}`.trim();
  }
  return server.url || '';
}

function getServerMeta(server: McpServerEntry): string {
  if (server.command) {
    const count = server.args?.length || 0;
    const envCount = server.env ? Object.keys(server.env).length : 0;
    const parts = [`${count} arg${count !== 1 ? 's' : ''}`];
    if (envCount > 0) parts.push(`${envCount} env var${envCount !== 1 ? 's' : ''}`);
    return parts.join(' · ');
  }
  return server.transport || 'streamable-http';
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface McpSettingsProps {
  /** Optional callback for when any server config changes */
  onChange?: () => void;
}

/** Settings panel for managing MCP servers. */
export function McpSettings({ onChange }: McpSettingsProps) {
  const { servers, loading, error, fetchServers, addServer, deleteServer, testServer } = useMcpServers();
  const [showForm, setShowForm] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServerEntry | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showMcpInChat, setShowMcpInChat] = useState(() => getMcpChatVisibility());

  const handleAdd = useCallback(() => {
    setEditingServer(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((server: McpServerEntry) => {
    setEditingServer(server);
    setShowForm(true);
  }, []);

  const handleSave = useCallback(async (server: McpServerEntry) => {
    setSaving(true);
    try {
      await addServer(server);
      setShowForm(false);
      setEditingServer(null);
      onChange?.();
    } catch (err) {
      throw err;
    } finally {
      setSaving(false);
    }
  }, [addServer, onChange]);

  const handleDelete = useCallback(async (name: string) => {
    try {
      await deleteServer(name);
      setDeleteConfirm(null);
      // Clear test result for deleted server
      setTestResults(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      onChange?.();
    } catch (err) {
      console.error('[McpSettings] delete failed:', err);
    }
  }, [deleteServer, onChange]);

  const handleTest = useCallback(async (name: string) => {
    setTestResults(prev => ({ ...prev, [name]: { status: 'testing' } }));
    const result = await testServer(name);
    setTestResults(prev => ({ ...prev, [name]: result }));
  }, [testServer]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <span className="cockpit-kicker">
          <Plug size={14} className="text-primary" aria-hidden="true" />
          MCP Servers
        </span>
        <p className="text-xs text-muted-foreground">
          Connect external tools and data sources using the Model Context Protocol.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="cockpit-note" data-tone="danger">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="text-xs">{error}</span>
          <button onClick={fetchServers} className="cockpit-toolbar-button ml-auto">
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
          <span className="ml-2 text-xs text-muted-foreground">Loading servers...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && servers.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/50 px-6 py-10 text-center">
          <Server size={28} className="text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium text-foreground/70">No MCP servers configured</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Add a server to give your assistant access to external tools.
            </p>
          </div>
          <button onClick={handleAdd} className="cockpit-toolbar-button">
            <Plus size={14} />
            Add MCP Server
          </button>
        </div>
      )}

      {/* Server list */}
      {!loading && servers.length > 0 && (
        <div className="space-y-2">
          {servers.map((server) => {
            const testResult = testResults[server.name];

            return (
              <div
                key={server.name}
                className="group rounded-2xl border border-border/50 bg-card/42 px-4 py-3 transition-colors hover:bg-card/68"
              >
                <div className="flex items-start justify-between gap-2">
                  {/* Server info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="cockpit-badge text-[0.667rem]">{server.type}</code>
                      <span className="truncate text-sm font-medium text-foreground">
                        {server.name}
                      </span>
                      {testResult?.status === 'ok' && (
                        <span title="Connected"><CheckCircle2 size={12} className="shrink-0 text-green" /></span>
                      )}
                      {testResult?.status === 'error' && (
                        <span title={testResult.message}><XCircle size={12} className="shrink-0 text-red" /></span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {getServerLabel(server)}
                    </p>
                    <p className="mt-0.5 text-[0.667rem] text-muted-foreground/60">
                      {getServerMeta(server)}
                    </p>
                    {testResult?.message && (
                      <p className={`mt-1 text-[0.667rem] ${
                        testResult.status === 'ok' ? 'text-green' : 'text-red'
                      }`}>
                        {testResult.message}
                      </p>
                    )}

                    {/* Tool listing from test */}
                    {testResult?.tools && testResult.tools.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {testResult.tools.map((tool) => (
                          <div
                            key={tool.name}
                            className="flex items-start gap-2 rounded-xl bg-background/40 px-2.5 py-1.5"
                          >
                            <Terminal size={10} className="mt-0.5 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <code className="text-[0.667rem] font-medium text-foreground/80">
                                {tool.name}
                              </code>
                              {tool.description && (
                                <p className="mt-0.5 text-[0.6rem] text-muted-foreground/70 line-clamp-2">
                                  {tool.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => handleTest(server.name)}
                      disabled={testResult?.status === 'testing'}
                      className="shell-icon-button min-h-8 px-2.5"
                      title="Test connection"
                    >
                      {testResult?.status === 'testing'
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Wrench size={13} />
                      }
                    </button>
                    <button
                      onClick={() => handleEdit(server)}
                      className="shell-icon-button min-h-8 px-2.5"
                      title="Edit server"
                    >
                      <Wrench size={13} />
                    </button>
                    {deleteConfirm === server.name ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(server.name)}
                          className="shell-icon-button min-h-8 px-2.5 text-red hover:bg-red/10"
                          title="Confirm delete"
                        >
                          <Trash2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="shell-icon-button min-h-8 px-2.5"
                          title="Cancel"
                        >
                          <span className="text-[0.667rem] text-muted-foreground">No</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(server.name)}
                        className="shell-icon-button min-h-8 px-2.5 opacity-0 transition-opacity group-hover:opacity-100"
                        title="Delete server"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add button */}
          <button
            onClick={handleAdd}
            className="cockpit-toolbar-button w-full justify-center border border-dashed border-border/50"
          >
            <Plus size={14} />
            Add MCP Server
          </button>
        </div>
      )}

      {/* Toggle MCP visibility in chat */}
      <div className="cockpit-row mt-2">
        <div className="flex min-w-0 items-center gap-3">
          {showMcpInChat ? <Eye size={14} className="text-primary" /> : <EyeOff size={14} className="text-muted-foreground" />}
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Show MCP tool calls in chat</p>
            <p className="text-xs text-muted-foreground">
              {showMcpInChat
                ? 'MCP tool call blocks will be visible with server badges'
                : 'MCP tool calls will be hidden from the chat feed'}
            </p>
          </div>
        </div>
        <Switch
          checked={showMcpInChat}
          onCheckedChange={(checked) => {
            setShowMcpInChat(checked);
            setMcpChatVisibility(checked);
            // Notify ChatPanel of the change
            window.dispatchEvent(new CustomEvent('nerve:mcp-visibility-changed', { detail: { visible: checked } }));
          }}
          aria-label="Toggle MCP tool call visibility in chat"
        />
      </div>

      <div className="cockpit-divider my-2" />

      {/* Info footer */}
      <div className="cockpit-note" data-tone="info">
        <Plug size={12} className="shrink-0" />
        <span className="text-[0.667rem] text-muted-foreground">
          MCP servers give your agent access to external tools, databases, and APIs.
          Changes are saved to your OpenClaw config and picked up on the next agent session.
        </span>
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <McpServerFormModal
          server={editingServer}
          saving={saving}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditingServer(null);
          }}
        />
      )}
    </div>
  );
}

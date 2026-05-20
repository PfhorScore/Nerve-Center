import { useState, useCallback } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface McpServerEntry {
  name: string;
  type: 'stdio' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  transport?: string;
  env?: Record<string, string>;
  cwd?: string;
  workingDirectory?: string;
}

interface McpServerFormModalProps {
  server: McpServerEntry | null;
  saving: boolean;
  onSave: (server: McpServerEntry) => Promise<void>;
  onClose: () => void;
}

type ServerType = 'stdio' | 'http';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const SERVER_TYPE_OPTIONS: { value: ServerType; label: string; desc: string }[] = [
  { value: 'stdio', label: 'Stdio', desc: 'Local process via command + args' },
  { value: 'http', label: 'HTTP', desc: 'Remote server via URL' },
];

// ─── Component ─────────────────────────────────────────────────────────────────

/** Modal for adding or editing an MCP server configuration. */
export function McpServerFormModal({ server, saving, onSave, onClose }: McpServerFormModalProps) {
  const isEditing = server !== null;

  const [name, setName] = useState(server?.name || '');
  const [type, setType] = useState<ServerType>(server?.type || 'stdio');
  const [command, setCommand] = useState(server?.command || '');
  const [argsText, setArgsText] = useState(server?.args?.join('\n') || '');
  const [url, setUrl] = useState(server?.url || '');
  const [transport, setTransport] = useState(server?.transport || 'streamable-http');
  const [envText, setEnvText] = useState(
    server?.env ? Object.entries(server.env).map(([k, v]) => `${k}=${v}`).join('\n') : ''
  );
  const [cwd, setCwd] = useState(server?.cwd || server?.workingDirectory || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Server name is required');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
      setError('Name must be alphanumeric with hyphens/underscores only');
      return;
    }

    // Build config
    const config: McpServerEntry = {
      name: trimmedName,
      type,
    };

    if (type === 'stdio') {
      if (!command.trim()) {
        setError('Command is required for stdio servers');
        return;
      }
      config.command = command.trim();
      const args = argsText
        .split('\n')
        .map(a => a.trim())
        .filter(a => a.length > 0 && !a.startsWith('#'));
      if (args.length > 0) config.args = args;
      if (cwd.trim()) config.workingDirectory = cwd.trim();
    } else {
      if (!url.trim()) {
        setError('URL is required for HTTP servers');
        return;
      }
      config.url = url.trim();
      config.transport = transport;
    }

    // Parse environment variables
    const envLines = envText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('#'));
    if (envLines.length > 0) {
      const env: Record<string, string> = {};
      for (const line of envLines) {
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) {
          setError(`Invalid env var format: "${line}". Use KEY=VALUE`);
          return;
        }
        const key = line.slice(0, eqIdx).trim();
        const value = line.slice(eqIdx + 1).trim();
        if (!key) {
          setError(`Invalid env var: "${line}". Key cannot be empty`);
          return;
        }
        env[key] = value;
      }
      config.env = env;
    }

    try {
      await onSave(config);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [name, type, command, argsText, url, transport, envText, cwd, onSave]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 animate-fade-in bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mcp-form-title"
          className="w-full max-w-lg rounded-2xl border border-border/80 bg-card shadow-[0_32px_90px_rgba(0,0,0,0.36)] animate-scale-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
            <span className="cockpit-kicker" id="mcp-form-title">
              {isEditing ? `Edit: ${server!.name}` : 'Add MCP Server'}
            </span>
            <button
              onClick={onClose}
              className="shell-icon-button min-h-9 px-3"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
            {/* Error */}
            {error && (
              <div className="cockpit-note" data-tone="danger">
                <AlertTriangle size={14} className="shrink-0" />
                <span className="text-xs">{error}</span>
              </div>
            )}

            {/* Server name */}
            <label className="cockpit-field">
              <span className="cockpit-field-label">Server Name</span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="cockpit-input cockpit-input-mono"
                placeholder="my-database-server"
                disabled={isEditing}
                required
              />
              <span className="cockpit-field-hint">
                {isEditing ? 'Name cannot be changed after creation' : 'A unique identifier (alphanumeric, hyphens, underscores)'}
              </span>
            </label>

            {/* Server type */}
            <label className="cockpit-field">
              <span className="cockpit-field-label">Type</span>
              <div className="grid grid-cols-2 gap-2">
                {SERVER_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`cockpit-toolbar-button justify-center ${
                      type === opt.value ? 'border-primary/50 bg-primary/8 text-primary' : ''
                    }`}
                  >
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-[0.667rem] text-muted-foreground">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </label>

            {/* Stdio fields */}
            {type === 'stdio' && (
              <>
                <label className="cockpit-field">
                  <span className="cockpit-field-label">Command</span>
                  <input
                    type="text"
                    value={command}
                    onChange={e => setCommand(e.target.value)}
                    className="cockpit-input cockpit-input-mono"
                    placeholder="npx, uvx, bun, node, python..."
                    required
                  />
                  <span className="cockpit-field-hint">The executable to run (e.g., npx, uvx, python)</span>
                </label>

                <label className="cockpit-field">
                  <span className="cockpit-field-label">Arguments</span>
                  <textarea
                    value={argsText}
                    onChange={e => setArgsText(e.target.value)}
                    className="cockpit-input cockpit-input-mono min-h-[64px] resize-y py-2"
                    placeholder="--port&#10;3000&#10;# lines starting with # are ignored"
                    rows={3}
                  />
                  <span className="cockpit-field-hint">One argument per line. Lines starting with # are ignored.</span>
                </label>

                <label className="cockpit-field">
                  <span className="cockpit-field-label">Working Directory</span>
                  <input
                    type="text"
                    value={cwd}
                    onChange={e => setCwd(e.target.value)}
                    className="cockpit-input cockpit-input-mono"
                    placeholder="/home/user/projects (optional)"
                  />
                  <span className="cockpit-field-hint">Optional. Leave blank to inherit Nerve's working directory.</span>
                </label>
              </>
            )}

            {/* HTTP fields */}
            {type === 'http' && (
              <>
                <label className="cockpit-field">
                  <span className="cockpit-field-label">URL</span>
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    className="cockpit-input cockpit-input-mono"
                    placeholder="https://mcp.example.com"
                    required
                  />
                  <span className="cockpit-field-hint">The MCP server endpoint URL</span>
                </label>

                <label className="cockpit-field">
                  <span className="cockpit-field-label">Transport</span>
                  <select
                    value={transport}
                    onChange={e => setTransport(e.target.value)}
                    className="cockpit-input"
                  >
                    <option value="streamable-http">Streamable HTTP</option>
                    <option value="sse">SSE (Server-Sent Events)</option>
                  </select>
                  <span className="cockpit-field-hint">Protocol for communicating with the server</span>
                </label>
              </>
            )}

            {/* Environment variables */}
            <label className="cockpit-field">
              <span className="cockpit-field-label">Environment Variables</span>
              <textarea
                value={envText}
                onChange={e => setEnvText(e.target.value)}
                className="cockpit-input cockpit-input-mono min-h-[64px] resize-y py-2"
                placeholder="API_KEY=sk-xxx&#10;BASE_URL=http://localhost:8080&#10;# lines starting with # are ignored"
                rows={3}
              />
              <span className="cockpit-field-hint">One per line, KEY=VALUE format. Lines starting with # are ignored.</span>
            </label>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="cockpit-toolbar-button"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="cockpit-chip min-h-10 px-5 text-sm font-medium"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {isEditing ? 'Save Changes' : 'Add Server'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

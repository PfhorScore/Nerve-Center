/**
 * MCP utilities for detecting MCP tool calls in chat messages.
 *
 * Provides a lightweight cache of configured MCP server names
 * so the chat renderer can badge MCP-sourced tool calls without
 * fetching server data on every render.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

interface McpServerEntry {
  name: string;
  type: 'stdio' | 'http';
}

/** Results of checking a tool call against known MCP servers */
export interface McpToolMatch {
  /** The MCP server that this tool belongs to */
  serverName: string;
  /** The extracted tool name (without server prefix) */
  toolName: string;
}

// ─── Cache ─────────────────────────────────────────────────────────────────────

let cachedServers: McpServerEntry[] | null = null;
let cachePromise: Promise<McpServerEntry[]> | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

/** Fetch configured MCP servers from the Nerve API, with caching. */
async function fetchMcpServers(): Promise<McpServerEntry[]> {
  const now = Date.now();
  if (cachedServers && (now - cacheTime) < CACHE_TTL_MS) {
    return cachedServers;
  }

  // Deduplicate concurrent fetches
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    try {
      const resp = await fetch('/api/mcp/servers', { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return [];
      const data = await resp.json() as { servers?: McpServerEntry[] };
      cachedServers = data.servers || [];
      cacheTime = Date.now();
      return cachedServers;
    } catch {
      return cachedServers || [];
    } finally {
      cachePromise = null;
    }
  })();

  return cachePromise;
}

/** Clear cached MCP server list (call when a server is added/removed) */
export function clearMcpServerCache(): void {
  cachedServers = null;
  cacheTime = 0;
}

// ─── Tool name matching ────────────────────────────────────────────────────────

/**
 * Try to identify if a tool call text originates from an MCP server.
 *
 * Checks if the tool call preview contains a known MCP server name
 * followed by a dot (e.g. "database.query_users" → server: "database").
 */
export async function matchMcpToolCall(preview: string): Promise<McpToolMatch | null> {
  if (!preview) return null;

  const servers = await fetchMcpServers();
  if (servers.length === 0) return null;

  const lowerPreview = preview.toLowerCase();

  // Try to match "serverName.toolName" pattern
  for (const server of servers) {
    const prefix = `${server.name.toLowerCase()}.`;
    if (lowerPreview.startsWith(prefix)) {
      const toolName = preview.slice(server.name.length + 1).trim();
      return { serverName: server.name, toolName };
    }
  }

  // Fallback: check if the preview contains the server name anywhere
  // (catches cases where the tool name format might differ)
  for (const server of servers) {
    if (lowerPreview.includes(server.name.toLowerCase())) {
      return { serverName: server.name, toolName: preview };
    }
  }

  return null;
}

/**
 * Get the list of MCP server names (for display purposes).
 */
export async function getMcpServerNames(): Promise<string[]> {
  const servers = await fetchMcpServers();
  return servers.map(s => s.name);
}

/**
 * Check if a tool call preview matches an MCP tool, returning the server name if so.
 * Synchronous version for use in render functions (returns cached data only).
 */
export function matchMcpToolCallSync(preview: string, serverNames: string[]): McpToolMatch | null {
  if (!preview || serverNames.length === 0) return null;

  const lowerPreview = preview.toLowerCase();

  for (const name of serverNames) {
    const prefix = `${name.toLowerCase()}.`;
    if (lowerPreview.startsWith(prefix)) {
      const toolName = preview.slice(name.length + 1).trim();
      return { serverName: name, toolName };
    }
  }

  for (const name of serverNames) {
    if (lowerPreview.includes(name.toLowerCase())) {
      return { serverName: name, toolName: preview };
    }
  }

  return null;
}

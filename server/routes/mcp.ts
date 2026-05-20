/**
 * MCP Server Management Routes
 *
 * GET    /api/mcp/servers        — List all configured MCP servers
 * POST   /api/mcp/servers        — Add or update an MCP server config entry
 * DELETE /api/mcp/servers/:name  — Remove an MCP server config entry
 * POST   /api/mcp/servers/:name/test — Test connectivity to an MCP server
 */

import { Hono } from 'hono';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { rateLimitGeneral } from '../middleware/rate-limit.js';
import { resolveOpenclawBin } from '../lib/openclaw-bin.js';

const app = new Hono();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const openclawBin = resolveOpenclawBin();
const nodeBinDir = process.execPath.replace(/\/node$/, '');

interface McpServerEntry {
  command?: string;
  args?: string[];
  url?: string;
  transport?: string;
  env?: Record<string, string>;
  cwd?: string;
  workingDirectory?: string;
}

interface ParsedConfig {
  mcp?: {
    servers?: Record<string, McpServerEntry>;
  };
}

async function resolveConfigPath(): Promise<string> {
  return process.env.OPENCLAW_CONFIG_PATH?.trim() ||
    path.join(process.env.HOME || '/home/pfhor', '.openclaw', 'openclaw.json');
}

async function readMcpServers(): Promise<Record<string, McpServerEntry>> {
  const configPath = await resolveConfigPath();
  try {
    const raw = await readFile(configPath, 'utf8');
    // Use JSON5.parse for the full file, but MCP config is standard JSON
    // We'll require standard JSON for our operations
    const config = JSON.parse(raw) as ParsedConfig;
    return config.mcp?.servers || {};
  } catch (err) {
    console.warn('[mcp] failed to read config:', (err as Error).message);
    return {};
  }
}

function runOpenclaw(args: string[], timeoutMs = 10_000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(openclawBin, args, {
      timeout: timeoutMs,
      maxBuffer: 512 * 1024,
      env: {
        ...process.env,
        PATH: `${nodeBinDir}:${process.env.PATH || '/usr/bin:/bin'}`,
      },
    }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, stdout, stderr: stderr || err.message });
      } else {
        resolve({ ok: true, stdout, stderr });
      }
    });
  });
}

// ─── Schemas ───────────────────────────────────────────────────────────────────

const mcpServerSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Name must be alphanumeric with hyphens/underscores'),
  command: z.string().min(1).optional(),
  args: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  transport: z.enum(['streamable-http', 'sse']).optional(),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional(),
  workingDirectory: z.string().optional(),
}).refine(
  (data) => data.command || data.url,
  { message: 'Either command (stdio) or url (HTTP) is required' },
);

type McpServerInput = z.infer<typeof mcpServerSchema>;

// ─── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/mcp/servers
 *
 * Returns all configured MCP servers with their current config.
 */
app.get('/api/mcp/servers', rateLimitGeneral, async (c) => {
  const servers = await readMcpServers();

  // Enrich each entry with its server type for the UI
  const enriched = Object.entries(servers).map(([name, entry]) => ({
    name,
    type: entry.command ? 'stdio' : 'http',
    ...entry,
  }));

  return c.json({ servers: enriched });
});

/**
 * POST /api/mcp/servers
 *
 * Add or update an MCP server configuration.
 * Validates the input, then uses `openclaw mcp set` to persist.
 */
app.post('/api/mcp/servers', rateLimitGeneral, async (c) => {
  let body: McpServerInput;
  try {
    const raw = await c.req.json();
    const parsed = mcpServerSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Invalid server config',
      }, 400);
    }
    body = parsed.data;
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  // Build the server config JSON object
  const configObj: Record<string, unknown> = {};
  if (body.command) configObj.command = body.command;
  if (body.args && body.args.length > 0) configObj.args = body.args;
  if (body.url) configObj.url = body.url;
  if (body.transport) configObj.transport = body.transport;
  if (body.env && Object.keys(body.env).length > 0) configObj.env = body.env;
  if (body.cwd) configObj.workingDirectory = body.cwd;
  if (body.workingDirectory) configObj.workingDirectory = body.workingDirectory;

  const jsonArg = JSON.stringify(configObj);

  const result = await runOpenclaw(['mcp', 'set', body.name, jsonArg]);

  if (!result.ok) {
    return c.json({
      ok: false,
      error: result.stderr.trim() || 'Failed to save MCP server config',
    }, 500);
  }

  return c.json({ ok: true, name: body.name });
});

/**
 * DELETE /api/mcp/servers/:name
 *
 * Remove an MCP server configuration.
 */
app.delete('/api/mcp/servers/:name', rateLimitGeneral, async (c) => {
  const name = c.req.param('name')?.trim();
  if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    return c.json({ ok: false, error: 'Invalid server name' }, 400);
  }

  const result = await runOpenclaw(['mcp', 'unset', name]);

  if (!result.ok) {
    return c.json({
      ok: false,
      error: result.stderr.trim() || 'Failed to remove MCP server',
    }, 500);
  }

  return c.json({ ok: true, name });
});

/**
 * POST /api/mcp/servers/:name/test
 *
 * Test connectivity to an MCP server by doing a direct tools/list call.
 * For stdio servers, spawns the process and sends a JSON-RPC request.
 * For HTTP servers, sends a POST to the server URL.
 */
app.post('/api/mcp/servers/:name/test', rateLimitGeneral, async (c) => {
  const name = c.req.param('name')?.trim();
  if (!name) {
    return c.json({ ok: false, error: 'Server name is required' }, 400);
  }

  const servers = await readMcpServers();
  const server = servers[name];
  if (!server) {
    return c.json({ ok: false, error: `Server '${name}' not found` }, 404);
  }

  // --- Stdio server test: spawn process, send tools/list, read response ---
  if (server.command) {
    try {
      const result = await testStdioServer(server);
      return c.json({
        ok: result.ok,
        output: result.output,
        tools: result.tools,
        toolCount: result.tools.length,
        ...(result.ok ? {} : { error: result.error }),
      });
    } catch (err) {
      return c.json({ ok: false, error: (err as Error).message, tools: [] });
    }
  }

  // --- HTTP server test: POST to the server URL ---
  if (server.url) {
    try {
      const result = await testHttpServer(server);
      return c.json({
        ok: result.ok,
        output: result.output,
        tools: result.tools,
        toolCount: result.tools.length,
        ...(result.ok ? {} : { error: result.error }),
      });
    } catch (err) {
      return c.json({ ok: false, error: (err as Error).message, tools: [] });
    }
  }

  return c.json({ ok: false, error: 'Server has neither command nor url', tools: [] });
});

interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface TestResult {
  ok: boolean;
  output: string;
  tools: ToolInfo[];
  error?: string;
}

/**
 * Test a stdio MCP server by spawning it and sending a tools/list request.
 */
async function testStdioServer(server: McpServerEntry): Promise<TestResult> {
  const args = server.args || [];
  const cwd = server.workingDirectory || server.cwd || undefined;

  return new Promise((resolve) => {
    const child = execFile(
      server.command!,
      args,
      {
        timeout: 10_000,
        maxBuffer: 256 * 1024,
        cwd,
        env: {
          ...process.env,
          ...server.env,
          PATH: `${nodeBinDir}:${process.env.PATH || '/usr/bin:/bin'}`,
        },
      },
      (err, stdout, stderr) => {
        const stderrStr = stderr?.trim() || '';
        const stdoutStr = stdout?.trim() || '';

        // Try to parse tools/list response from stdout
        let tools: ToolInfo[] = [];
        let matched = false;

        // MCP servers output JSON-RPC responses on stdout, one per line
        for (const line of stdoutStr.split('\n')) {
          try {
            const parsed = JSON.parse(line);
            if (parsed?.result?.tools && Array.isArray(parsed.result.tools)) {
              tools = parsed.result.tools.map((t: Record<string, unknown>) => ({
                name: String(t.name || ''),
                description: String(t.description || ''),
                inputSchema: t.inputSchema as Record<string, unknown> | undefined,
              }));
              matched = true;
              break;
            }
          } catch { /* not JSON, skip */ }
        }

        if (matched) {
          resolve({ ok: true, output: `${tools.length} tool(s) found`, tools });
        } else if (err) {
          const errorMsg = stderrStr || err.message || 'Process exited unexpectedly';
          resolve({ ok: false, output: errorMsg, tools: [], error: errorMsg });
        } else {
          // Process ran but no tools/list response — might need stdin trigger
          const output = (stdoutStr + ' | ' + stderrStr).trim() || 'Process started but no tools/list response. Some servers require stdin connection.';
          resolve({ ok: true, output, tools: [] });
        }
      },
    );

    // Send tools/list as JSON-RPC 2.0 request via stdin
    if (child.stdin) {
      const toolsRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-1',
        method: 'tools/list',
      }) + '\n';
      child.stdin.write(toolsRequest);
      child.stdin.end();
    }
  });
}

/**
 * Test an HTTP MCP server by POSTing tools/list to the URL.
 */
async function testHttpServer(server: McpServerEntry): Promise<TestResult> {
  const url = server.url!;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-1',
        method: 'tools/list',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const text = await response.text();
    let tools: ToolInfo[] = [];
    try {
      const parsed = JSON.parse(text);
      if (parsed?.result?.tools && Array.isArray(parsed.result.tools)) {
        tools = parsed.result.tools.map((t: Record<string, unknown>) => ({
          name: String(t.name || ''),
          description: String(t.description || ''),
          inputSchema: t.inputSchema as Record<string, unknown> | undefined,
        }));
      }
    } catch { /* not JSON */ }

    return {
      ok: response.ok,
      output: `${tools.length} tool(s) found`,
      tools,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (err) {
    return { ok: false, output: (err as Error).message, tools: [], error: (err as Error).message };
  }
}

export default app;

/**
 * Sub-Agents API Route
 *
 * GET /api/subagents — List active sub-agents via gateway tool invocation.
 *
 * Mirrors the crons route pattern: proxies to the gateway's `subagents` tool
 * and returns structured data for the SubAgentPanel frontend component.
 */

import { Hono } from 'hono';
import { invokeGatewayTool } from '../lib/gateway-client.js';

const app = new Hono();

/** Response shape returned to the frontend. */
interface SubAgentEntry {
  index: number;
  runId: string;
  taskName: string;
  label: string;
  status: string;
  runtime: string;
  runtimeMs: number;
  startedAt: number;
  model?: string;
}

/**
 * GET /api/subagents — List active + recent sub-agents.
 */
app.get('/api/subagents', async (c) => {
  try {
    const result = await invokeGatewayTool('subagents', { action: 'list' }) as {
      active?: SubAgentEntry[];
      recent?: SubAgentEntry[];
      text?: string;
    };

    return c.json({
      ok: true,
      active: result?.active || [],
      recent: result?.recent || [],
    });
  } catch (err) {
    console.warn('[subagents] failed to list sub-agents:', (err as Error).message);
    return c.json({ ok: false, error: 'Failed to list sub-agents' }, 500);
  }
});

export default app;

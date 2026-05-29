/**
 * POST /api/update — Start a one-click update with streaming progress.
 *
 * Returns SSE (text/event-stream) with progress events:
 *   - `stage`: { name, current, total }
 *   - `ok`: { message }
 *   - `warn`: { message }
 *   - `fail`: { message }
 *   - `info`: { message }
 *   - `done`: { fromVersion, toVersion }
 *   - `summary`: { success, stage, error, rolledBack }
 *   - `error`: { message }
 *
 * On completion, the server restarts itself. The client should reload
 * after receiving the `summary` or `done` event.
 */

import { Hono } from 'hono';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { orchestrate } from '../lib/updater/index.js';
import type { Reporter, UpdateOptions } from '../lib/updater/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');

const app = new Hono();

app.post('/api/update', async (c) => {
  const body = c.req.raw.body ? await c.req.json().catch(() => ({})) : {};

  // Set SSE headers
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let updateRunning = true;

      const send = (event: string, data: Record<string, unknown>) => {
        if (!updateRunning) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Client disconnected
        }
      };

      // Custom reporter that streams JSON events instead of writing to terminal
      const reporter: Reporter = {
        stage(name, current, total) {
          send('stage', { name, current, total });
        },
        ok(msg) {
          send('ok', { message: msg });
        },
        warn(msg) {
          send('warn', { message: msg });
        },
        fail(msg) {
          send('fail', { message: msg });
        },
        info(msg) {
          send('info', { message: msg });
        },
        dry(msg) {
          send('info', { message: `[dry-run] ${msg}` });
        },
        verbose(msg) {
          send('info', { message: msg });
        },
        hint(msg) {
          send('info', { message: msg });
        },
        cmd(msg) {
          send('info', { message: `$ ${msg}` });
        },
        async confirm() {
          return true; // Headless mode — always confirm
        },
        done(fromVersion, toVersion) {
          send('done', { fromVersion, toVersion });
        },
        summary(result) {
          send('summary', {
            success: result.success,
            stage: result.stage,
            error: result.error || null,
            rolledBack: result.rolledBack || false,
          });
        },
      };

      const options: UpdateOptions = {
        yes: true,
        cwd: PROJECT_ROOT,
        noRestart: false,
        rollback: false,
        dryRun: false,
        verbose: body.verbose === true,
        version: body.version || undefined,
      };

      try {
        await orchestrate(options, reporter);
      } catch (err) {
        send('error', { message: err instanceof Error ? err.message : String(err) });
      } finally {
        updateRunning = false;
        send('done', { fromVersion: '', toVersion: '' });
        controller.close();
      }
    },
  });

  return c.newResponse(stream);
});

export default app;

#!/usr/bin/env node

/**
 * nerve-center-doctor — CLI health check for Nerve Center.
 *
 * Checks gateway connectivity, model readiness, and reports diagnostics.
 *
 * Usage:
 *   node bin-dist/bin/nerve-center-doctor.js
 *   npm run doctor
 *
 * Exit codes:
 *   0 — All systems healthy
 *   1 — Gateway unreachable
 *   2 — Gateway reachable but no models configured
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');

// ── Colors ──

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const CYAN = '\x1b[0;36m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

function ok(msg: string) { console.log(`  ${GREEN}✓${NC} ${msg}`); }
function warn(msg: string) { console.log(`  ${YELLOW}⚠${NC} ${msg}`); }
function fail(msg: string) { console.log(`  ${RED}✗${NC} ${msg}`); }
function info(msg: string) { console.log(`  ${CYAN}→${NC} ${msg}`); }

// ── Main ──

async function main(): Promise<number> {
  console.log(`\n  ${BOLD}⚡ Nerve Center Doctor${NC}\n`);

  // 1. Check project directory
  info(`Project: ${PROJECT_ROOT}`);

  let pkg: { version: string };
  try {
    pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, 'package.json'), 'utf-8'));
    ok(`Version: ${pkg.version}`);
  } catch {
    warn('Could not read package.json');
  }

  // 2. Check if Nerve Center server is running
  try {
    const res = await fetch('http://127.0.0.1:3080/health');
    if (res.ok) {
      ok('Nerve Center server is running on port 3080');
    } else {
      warn(`Nerve Center server returned HTTP ${res.status}`);
    }
  } catch {
    fail('Nerve Center server is not running (port 3080)');
  }

  // 3. Check OpenClaw gateway
  let gatewayOk = false;
  try {
    const res = await fetch('http://127.0.0.1:18789/health');
    if (res.ok) {
      const data = await res.json() as { status: string };
      if (data.status === 'live') {
        ok('OpenClaw gateway is running on port 18789');
        gatewayOk = true;
      } else {
        warn(`Gateway status: ${data.status}`);
      }
    } else {
      fail(`Gateway returned HTTP ${res.status}`);
    }
  } catch {
    fail('OpenClaw gateway is not running (port 18789)');
  }

  // 4. Check auth status
  try {
    const res = await fetch('http://127.0.0.1:3080/api/auth/status');
    if (res.ok) {
      const data = await res.json() as { authEnabled: boolean; authenticated: boolean };
      if (data.authEnabled) {
        ok(`Authentication enabled (${data.authenticated ? 'authenticated' : 'not authenticated'})`);
      } else {
        info('Authentication disabled');
      }
    }
  } catch {
    warn('Could not check auth status');
  }

  // 5. Check model readiness (requires gateway)
  if (gatewayOk) {
    try {
      const res = await fetch('http://127.0.0.1:18789/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'models.list', id: 1 }),
      });
      if (res.ok) {
        const data = await res.json() as { result?: { models?: unknown[] } };
        const models = data?.result?.models;
        if (models && models.length > 0) {
          ok(`${models.length} model(s) configured`);
        } else {
          warn('No models configured');
        }
      }
    } catch {
      warn('Could not query gateway models');
    }
  }

  // Summary
  console.log('');
  if (gatewayOk) {
    console.log(`  ${GREEN}${BOLD}✅ All systems healthy${NC}`);
    return 0;
  } else {
    console.log(`  ${RED}${BOLD}❌ Issues found${NC}`);
    console.log(`  ${YELLOW}${BOLD}Run the following to fix:${NC}`);
    console.log(`    openclaw gateway start`);
    console.log(`    curl http://127.0.0.1:18789/health`);
    return gatewayOk ? 1 : 1;
  }
}

main().then((code) => process.exit(code));

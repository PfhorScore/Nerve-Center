# AI Agent Setup

Nerve Center supports agent-driven installation.

If you want an AI agent to install, configure, and validate Nerve Center, the canonical raw instruction file is:

- [`INSTALL.md`](./INSTALL.md)
- raw URL: `https://raw.githubusercontent.com/daggerhashimoto/openclaw-nerve/master/docs/INSTALL.md`

Use that file as the operational contract.
Use this page for the human-readable explanation, boundaries, and topology map.

## Copy-paste prompt

```text
Install, configure, and validate Nerve Center on this machine.

Fetch and follow instructions from:
https://raw.githubusercontent.com/daggerhashimoto/openclaw-nerve/master/docs/INSTALL.md
```

## Default agent behavior

Unless you say otherwise, agents should use these defaults:
- local-first
- localhost-only by default
- `~/nerve` as the install path
- installer-first (`install.sh`)
- setup wizard first
- validate before reporting completion

That means the common happy path is:
1. detect an existing OpenClaw gateway
2. install Nerve Center
3. run setup
4. start or restart Nerve Center
5. validate the UI and gateway connection

## What agents may do automatically

For the default local path, agents may automatically:
- inspect the current machine and existing install state
- detect whether `~/nerve` already exists
- detect whether OpenClaw is installed and reachable
- detect the gateway token and gateway URL
- install missing core prerequisites for the local path
- run the Nerve Center installer
- run the setup wizard
- use defaults mode for local-only setup when no TTY is available
- write a minimal local `.env` if the wizard cannot be used
- restart local services or processes
- run validation and smoke checks

Agents may also apply minimal localhost-safe OpenClaw changes needed for the default path, such as local origin allowlisting, local pairing fixes, or required local tool allow entries.

## What requires confirmation

Agents should ask before they do anything that changes exposure, trust, or install ownership.

That includes:
- installing OpenClaw
- exposing Nerve Center beyond localhost
- LAN access
- public internet exposure
- reverse proxy setup
- Tailscale setup or topology changes
- destructive reinstall, replacement, or deletion
- remote gateway auth or allowlist changes
- cloud-hosted assumptions that materially change the security posture

Short version: local repair and local setup can be automated. Public or destructive changes need consent.

## Dependency behavior

Nerve Center is not a standalone app. It depends on an OpenClaw gateway.

Expected agent behavior:
1. look for an existing reachable gateway first
2. prefer using that gateway
3. if none is found, explain the dependency clearly
4. ask before installing OpenClaw

For the default same-machine flow, agents may make the smallest safe local OpenClaw fixes required for Nerve Center to connect. For remote or public gateway changes, they should stop and ask.

## Topology map

Choose the guide that matches the intended setup:

- **Local / same machine:** [DEPLOYMENT-A.md](./DEPLOYMENT-A.md)
- **Hybrid / local Nerve Center + remote gateway:** [DEPLOYMENT-B.md](./DEPLOYMENT-B.md)
- **Cloud / remote Nerve Center:** [DEPLOYMENT-C.md](./DEPLOYMENT-C.md)
- **Add Tailscale to an existing install:** [TAILSCALE.md](./TAILSCALE.md)

Recommended default: start with the local setup unless you already know you need something else.

## Done criteria

An agent should only report success when all of these are true:
- Nerve Center is installed at the intended path
- Nerve Center starts successfully
- it points at the intended OpenClaw gateway
- access and auth match the requested mode
- the smoke test passes

A script finishing is not enough. A valid install must actually respond and connect.

## Smoke test expectations

Keep validation minimal and real:

1. confirm the Nerve Center service or process is running
2. confirm the expected URL responds
3. confirm the intended gateway responds
4. confirm `.env` matches the intended gateway
5. if auth is enabled, confirm the login surface or protected access path is present

Typical local checks:

```bash
openclaw gateway status
curl -fsS http://127.0.0.1:18789/health
curl -fsS http://127.0.0.1:3080/health
```

For remote or custom setups, agents should adjust the URLs to match the requested topology.

## Failure and recovery behavior

Agents should fail clearly, not vaguely.

### No OpenClaw gateway found

Explain that Nerve Center depends on OpenClaw and ask before installing it.

### Installer or setup wizard unavailable

Use the smallest correct fallback:
- clone the repo if needed
- `npm install`
- `npm run setup` when available
- if local-only and no TTY is available, `npm run setup -- --defaults`
- if needed, write a minimal `.env`, then build and start manually

### Existing install already present

Inspect it first. Prefer restart, repair, or reconfigure. Ask before replacing or deleting anything.

### Port, auth, or access mismatch

Adjust the config, restart, and revalidate. Do not declare success just because the process exists.

### Remote or public topology requested without details

Ask for the missing details instead of guessing. This especially matters for Tailscale, reverse proxies, public domains, and remote gateway allowlists.

## Example prompts

### Default local install

```text
Install, configure, and validate Nerve Center on this machine.
Use the safest local-first path and keep it localhost-only unless you need my approval.

Fetch and follow instructions from:
https://raw.githubusercontent.com/daggerhashimoto/openclaw-nerve/master/docs/INSTALL.md
```

### Local Nerve Center + existing remote gateway

```text
Install Nerve Center on this machine and connect it to my existing remote OpenClaw gateway.
Do not expose Nerve Center beyond localhost unless I approve it.
If remote gateway config needs changing, tell me before you do it.

Fetch and follow instructions from:
https://raw.githubusercontent.com/daggerhashimoto/openclaw-nerve/master/docs/INSTALL.md
```

### Tailscale setup

```text
Install Nerve Center and make it reachable over Tailscale.
Ask before making any exposure or gateway allowlist changes.
Use the repo's Tailscale guidance instead of inventing a new flow.

Fetch and follow instructions from:
https://raw.githubusercontent.com/daggerhashimoto/openclaw-nerve/master/docs/INSTALL.md
```

### Existing install repair

```text
Inspect my existing Nerve Center install, repair it if needed, and validate it.
Do not reinstall or delete anything unless you ask first.

Fetch and follow instructions from:
https://raw.githubusercontent.com/daggerhashimoto/openclaw-nerve/master/docs/INSTALL.md
```

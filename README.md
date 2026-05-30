<div align="center">
  <h1>⚡ Nerve Center</h1>
  <p><em>Create alongside your agents</em></p>

  <p align="center"><strong>More than a chat window.</strong> Nerve Center is a connected workspace built on your <strong>OpenClaw gateway</strong> — where your ideas flow between thought, research, chat, files, and tasks. No app-switching. No copy-paste between tabs. Just you and your agents, building together.</p>

  <a href="docs/screenshot-2.png"><img src="docs/screenshot-2.png" width="45%" alt="Thoughts panel and workspace" /></a>
  <br />
  <a href="docs/screenshot-3.png"><img src="docs/screenshot-3.png" width="45%" alt="Research view and library" /></a>
  <a href="docs/screenshot-4.png"><img src="docs/screenshot-4.png" width="45%" alt="Custom panel layout" /></a>
  <br />
  <em>⚠️ Screenshots from v0.1.0 — the v0.2.0 layout has evolved significantly. Fresh ones coming soon.</em>
  <br /><em>Click any image to view full size</em>

  <br /><br />

  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#panels">Panels</a> •
  <a href="#first-launch">First Launch</a> •
  <a href="#what-makes-nerve-center-different">Why Nerve Center</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#credits">Credits</a>
</div>

---
## Quick Start
```bash
curl -fsSL https://raw.githubusercontent.com/PfhorScore/Nerve-Center/main/install.sh | bash
```

**Runs on:** Node.js 22+ and a running [OpenClaw gateway](https://openclaw.ai).

### Manual install

```bash
git clone https://github.com/PfhorScore/Nerve-Center.git
cd Nerve-Center
npm install
npm run build
npm run setup
```

> **New to Nerve Center?** The install script handles everything. Unhappy with it? `npm run setup` walks through every option.

---
## Features
Nerve Center is built around a simple idea: your ideas shouldn't be trapped in one mode. Jot thoughts while your agent researches in the background. Send them to chat when you're ready. Refine into a file, a task, or the next research query — all without leaving the page. The modes connect. The work flows.

### 🧩 Work, Research, and Tasks

Work with your agents instead of just delegating and waiting.

- **Work** — Chat with agents, create and edit files, browse the workspace in real time
- **Research** — Deep research mode generates reports with inline citations, sources, and images
- **Tasks** — Full Kanban board with AI-assisted card management and agent-driven workflows

### 🧠 Deep Research
A Perplexity-class research interface built right into your agent workspace:
- **Quick & Deep** search modes using any OpenClaw-compatible model provider
- **Rich markdown answers** with inline citation links `[1]`, sources, and images
- **AI auto-sort** — one click splits a conversation into topic-based threads _(no other AI service offers this)_
- **Hover previews** on every source — favicon, title, snippet at a glance
- **Tabbed results**: All, Sources, Images, Links
- **Follow-up suggestions** — click to dive deeper without retyping
- **Thread sidebar** with AI-generated titles
- **Fullscreen research view** — workspace sidebar hides, just you and the research
- **No middleman** — your API keys, your models, your data stay yours
### 📋 Kanban & Tasks
A full Kanban board for managing work alongside your agent. Not a toy — real columns, real workflows.
- **Drag-and-drop cards** between columns (Backlog, In Progress, Review, Done)
- **AI-assisted card creation** — describe the task, the agent helps flesh it out
- **Task detail drawer** — full description, linked files, agent assignments, status history
- **Proposal inbox** — agents can propose tasks for your approval
- **Quick view** — peek at task details without leaving the board
- **Configurable columns** — adapt the workflow to match your process
### 🔌 MCP Integration
Extend your agents with third-party tools through the Model Context Protocol.
- **MCP Server Manager** — register, enable, and disable MCP servers from the UI
- **Tool call visibility** — toggle MCP tool blocks on/off in chat with one click
- **MCP server badges** — see which server a tool belongs to at a glance
- **Inline embedded apps** — MCP servers that return interactive content (like tldraw canvases) render inline in the chat stream
### 📊 Monitoring & Management
Keep tabs on your agents without context-switching.
- **Dashboard** — token usage charts, memory list, usage limits at a glance
- **Full Memory Browser** — add, edit, delete, and search agent memories. Not just read-only — you can refine what your agent remembers
- **Charts & data viz** — inline charts, lightweight financial charts, and TradingView widget support for data-rich conversations
- **Agent system monitoring** — connection status, gateway health, session list
### 🔗 Connect & Security
- **Node pairing dialog** — pair Nerve Center with remote machines via Tailscale or LAN
- **Password-protected login** — enable `NERVE_AUTH=true` for a gate before anyone accesses your workspace
- **Gateway token auth** — secure communication between Nerve Center and your OpenClaw gateway
### ⌨️ Clean Input
- Buttons below the text area — attach files, research, send
- Live markdown preview toggle
- File upload accepts all types (`.md`, `.txt`, images, etc.)
- Send button becomes a stop button during generation
- **Image lightbox** — click any chat image to view full size
- **Cmd+K command palette** — panel switching, view controls, file creation
- **Right-click context menus** — Copy, Paste, Move panel
### 🔄 One-Click Updates
- Update Nerve Center with a single button click from the UI
- Real-time SSE progress bar during the update
- Automatic restart when complete — no terminal required
### 🛠 Everything OpenClaw Provides
Multi-agent fleet control, voice I/O (TTS/STT), Kanban workflows, workspace file management, session trees, cron jobs, system monitoring charts, and more.
---
## Panels — How Ideas Flow
Nerve Center's panels aren't a static dashboard — they're stations in a workflow. **Capture** in Thoughts. **Discuss** in Chat. **Research** deeper. **Save** to files. **Track** with tasks. Each one feeds the next, and your agent moves alongside you.
Drag any panel between sides, resize, or collapse to icon strips — set up your flow how it makes sense for what you're doing right now.
### 📁 Workspace Panel
> *Edit files and browse your agent's workspace without leaving the chat.*
Full file management in the sidebar:
- **File tree** browser with folder navigation and context menus
- **Built-in file editor** with syntax highlighting (CodeMirror)
- **Code editing** for markdown, JavaScript, Python, and more
- **Smart workspace root** — auto-detects agent workspace paths
- **Hidden file support** — toggle visibility for dotfiles
- **Create, rename, move, and delete** files directly from the panel
- **File watcher** — live updates when files change on disk
### 🧠 Thoughts Panel
> *Jot ideas while your agent works. They don't wait for each other.*
Your brain, organized into thought bubbles — capture while your agent is mid-research, then send thoughts to chat when you're ready:
- **`Ctrl+Enter`** splits your notes into individual cards
- **Check off completed** thoughts (dimmed, stays for reference)
- **Auto-detect completion** — send to chat, auto-checks when the AI finishes
- **Hover actions** — copy, send to chat, or research each thought
- **Click to edit** any thought inline
- **Server-backed sync** via `Thoughts.md` — notes available across all devices
### 📚 Library Panel
> *Every link, citation, and image, auto-organized.*
All your chat references in one place:
- **Auto-extracts** all URLs, citations, and images from messages
- **Deduplicated by URL** — clean, no clutter
- **Tabs** for All / Links / Images with live counts
- **Search** to filter specific references
- **Favicon previews** and image thumbnails
### ⚡ Activity Panel
> *Watch your agents work without the chat clutter.*
Tool calls grouped by message (collapsed by default):
- Shows tool name, description, arguments, and status (running ✓ error)
- **Jump to message** — click the icon to scroll to the corresponding chat entry
- Finished activity persists in an archive for later review
- Separate from the chat stream — clean conversations
### 🧑‍💼 Agent Hub
> *Your fleet at a glance. Switch, browse, configure.*
Central drawer for managing your agent fleet:
- **Agent selector** — switch between agents, view session status
- **Memory browser** — read and search agent memories
- **Settings** — configure TTS, STT, theme, panel layout, and more
- **Avatars** — upload per-agent profile images for chat headers and session list
- **System monitoring** — token usage, connection status, gateway health
*Tip: Customize the layout further with collapsible sidebars, drag-and-drop panel reordering, and resizable panels — see [Quality of Life](#-quality-of-life).*
---
## First Launch
Once Nerve Center is running (`node server-dist/index.js` or via the install script), here's your first 5 minutes:
1. **Open your browser** to `http://localhost:3080`
2. **Nerve Center auto-detects your gateway** — if OpenClaw is running, you're authenticated
3. **Pick an agent** from the Agent Hub (icon in the top-right toolbar)
4. **Say hello** — type a message and hit send. Watch the response stream in real time
5. **Try research** — click the Research tab in the view switcher and ask a deep question
6. **Open the panels** — Workspace on the left, Library on the right. Drag them between sides to see how panels move
7. **Hit `Cmd+K`** (or `Ctrl+K`) — the command palette pops up. Search for "thoughts" to jump to the Thoughts panel
8. **Save your thoughts** — type something in the Thoughts panel and press `Ctrl+Enter` to split it into a card
> **Pro tip:** If you're accessing from another machine (like your phone), set `HOST=0.0.0.0` in `.env` or use Tailscale for a secure tunnel.
### Troubleshooting
| Symptom | Fix |
|---|---|
| Browser says "Connection refused" | Make sure OpenClaw gateway is running (`openclaw gateway status`) |
| Port 3080 already in use | Change `PORT` in `.env` and restart |
| `NERVE_AUTH` locked me out | Check the password you set in `.env` |
| Can't reach from another device | Set `HOST=0.0.0.0` in `.env` or connect via Tailscale |
| Research tab shows no models | Make sure your gateway has at least one model provider configured |
| Panels look wrong or missing | Try a hard refresh (`Ctrl+Shift+R`). Layout resets to defaults if you clear localStorage |
---
## What Makes Nerve Center Different
Nerve Center is a **feature fork** of the original Nerve. It adds capabilities you won't find in the upstream:
| Feature | Nerve Center |
|---|---|
| Deep Research Tab | ✅ Full Perplexity-class research with AI auto-sort, citations, threads |
| Kanban & Tasks | ✅ Drag-and-drop board, AI-assisted cards, proposal inbox |
| MCP Integration | ✅ Server manager, tool call visibility, inline embedded apps |
| Dashboard & Monitoring | ✅ Token usage charts, memory browser, agent health |
| Charts & Data Viz | ✅ Inline charts, lightweight charts, TradingView widgets |
| Workspace Panel | ✅ File tree, code editor, live file watcher |
| Thoughts Panel v2 | ✅ Card-based notes with completion tracking, server sync |
| Library Panel | ✅ Auto-extracted references, URLs, images from chat |
| Activity Panel | ✅ Live agent activity separate from chat stream |
| Agent Hub | ✅ Central drawer for agents, memory, settings, avatars |
| Clean Input Bar | ✅ Buttons below text, file upload, image lightbox |
| One-Click Updates | ✅ Update & restart from the UI with progress |
| Auth & Security | ✅ Password login, gateway token auth |
| Node Pairing | ✅ Connect remote machines via Tailscale or LAN |
| Collapsible sidebars | ✅ VS Code-style hover-to-expand |
| Drag-and-drop layout | ✅ Move and reorder panels between sides |
| Avatars | ✅ Per-agent profile images |
| Discord-style messages | ✅ Clean username + avatar + timestamp layout |
| Research view | ✅ Dedicated fullscreen research workspace |
All of this sits on top of the rock-solid OpenClaw gateway and agent infrastructure.
---
## Architecture
```text
Browser ─── Nerve Center (:3080) ─── OpenClaw Gateway (:18789)
 │            │
 ├─ WS ───────┤ proxied to gateway
 ├─ SSE ──────┤ file watchers, real-time sync
 └─ REST ─────┘ files, memories, TTS, models
```
**Frontend:** React 19 · Tailwind CSS 4 · shadcn/ui · Vite 7
**Backend:** Hono 4 on Node.js 22+
### Configuration
Configure Nerve Center through a `.env` file in the project root. Key settings:
| Variable | Default | Description |
|---|---|---|
| `PORT` | `3080` | HTTP listen port |
| `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` for LAN/remote) |
| `NERVE_AUTH` | `false` | Enable password-protected login |
| `GATEWAY_TOKEN` | — | Your OpenClaw gateway auth token |
| `AGENT_NAME` | `Agent` | Display name for the agent |
Run `npm run setup` for an interactive configuration walkthrough.
---
## Development
```bash
git clone https://github.com/PfhorScore/Nerve-Center.git
cd Nerve-Center
npm install
# Start the dev server with hot reload
npm run dev
# Or build for production
npm run build
node server-dist/index.js
```
Dev server runs on `localhost:5173` — API calls proxy to the production server.
---
## Changelog
See [CHANGELOG.md](CHANGELOG.md) for the full release history.
---
## Credits
A fork of **[Nerve](https://github.com/daggerhashimoto/openclaw-nerve)** by daggerhashimoto. All original work belongs to the Nerve contributors. This fork pushes further into research workflows, panel customization, and AI-assisted productivity.
---
## License
[MIT](LICENSE)

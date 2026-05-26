<div align="center">

<img src="docs/nerve-logo-animated.svg" alt="Nerve Center" width="200" />

# Nerve Center

**The AI cockpit. Forked, enhanced, and personalized.**

*A community fork of [Nerve](https://github.com/daggerhashimoto/openclaw-nerve) — the OpenClaw dashboard that makes you say "oh, now I get it."*


[![Star Nerve Center](https://img.shields.io/github/stars/PfhorScore/Nerve-Center?style=for-the-badge&logo=github&label=Star%20Nerve%20Center&color=0f172a)](https://github.com/PfhorScore/Nerve-Center)
[![MIT License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![Changelog](https://img.shields.io/badge/changelog-see%20what%27s%20new-brightgreen?style=for-the-badge)](NERVE-CHANGELOG.md)

</div>

```bash
curl -fsSL https://raw.githubusercontent.com/PfhorScore/Nerve-Center/main/install.sh | bash
```
> *Run the installer, live in 60 seconds*

---

## What makes Nerve Center different

All the power of Nerve, plus a whole lot more:

### 🧩 Drag-and-Drop Panel System
Your workspace, your layout:
- **Drag panels** to reorder left/right — no settings, just grab and go
- **Collapse individually** or nuke the whole right sidebar with one button
- **Resize vertically** with slick drag handles
- Everything **persists** across sessions (localStorage, no DB required)

### 🧠 AI-Powered Research Tab
Full Perplexity-class research experience built right in:
- **Quick & Deep search modes** using any OpenClaw-compatible provider
- **Rich markdown answers** with inline citation links `[1]`
- **Hover previews** — favicon, title, and snippet on any source
- **Tabbed results**: All, Sources, Images, Links
- **AI auto-sort** — one click splits conversations into topic-based threads
- **Follow-up suggestion chips** — click to dive deeper
- **Thread sidebar** with AI-generated titles
- **Smart persistence** — fresh start after inactivity, old threads accessible

### 📝 Scratch Pad (Thoughts Panel)
Your brain while the AI is thinking:
- **Markdown editor** with live preview toggle
- Notes auto-save to localStorage — never lose a thought
- Collapsible, lives in the right panel bar

### 🔧 Clean Chat Mode
Toggle agent activity visibility with the wrench icon:
- **Visible** — see tool calls, thinking, and agent actions
- **Hidden** — clean text-only conversation, like a normal chat app
- Pulsing dot when hidden and model is generating

### 🎯 Quality-of-Life
- **Copy button** on messages (subtle icon, appears on hover)
- **"Still thinking…"** indicator at 15s with hourglass pulse
- **Collapse only chevron** — no more accidentally collapsing messages
- **Cmd+K** command palette with panel toggles, file creation, and navigation
- **Research This?** tooltip — select text anywhere, send to research with one click
- **NERVE CENTER** branding — it's not just a fork, it's its own thing

### 🎨 And everything Nerve already gives you
Multi-agent fleet control, voice I/O, kanban workflows, workspace management, session trees, crons, charts, and more.

---

## Get started

### One command

```bash
curl -fsSL https://raw.githubusercontent.com/PfhorScore/Nerve-Center/main/install.sh | bash
```

### Manual install

```bash
git clone https://github.com/PfhorScore/Nerve-Center.git
cd Nerve-Center
npm install
npm run build
```

**Requires:** Node.js 22+ and an [OpenClaw gateway](https://openclaw.ai).

---

## What's new

### v0.1.0 — May 26, 2026 — The Big One 🚀

**Panel System** — Workspace, Agents, Memory, and Thoughts are now fully draggable, collapsible, resizable, and persistent. Move panels between left/right bars, stack them however you want, and it remembers your layout.

**Research Tab v2** — Hero empty state with suggestion chips, history search filtering, icon-only search buttons, and no more phantom empty threads on refresh.

**Chat UX** — Only the chevron collapses messages (no more rage-clicks), copy button with feedback, "Still thinking…" at 15s, always-wrench activity toggle with pulsing dot.

**Thoughts Panel** — Markdown scratch pad that saves its content. Edit, preview, collapse. Perfect for jotting ideas while the AI works.

**Cmd+K** — Command palette packed with panel controls, view switching, and file creation.

**v0.1.0** marks Nerve Center's first independent version — no longer tracking upstream v1.5.x.

See the full **[changelog](NERVE-CHANGELOG.md)** for detailed changes.

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
**Backend:** Hono 4 on Node.js

---

## Credits

Nerve Center is a fork of **[Nerve](https://github.com/daggerhashimoto/openclaw-nerve)** by daggerhashimoto. All original work belongs to the Nerve contributors. This fork adds custom enhancements and personalizations on top of that solid foundation.

---

## License

[MIT](LICENSE)

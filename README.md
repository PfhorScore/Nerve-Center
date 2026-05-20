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

All the power of Nerve, plus enhancements you won't find anywhere else:

### 🧠 AI-Powered Research Tab
Full Perplexity-class research experience built right in:
- **Quick & Deep search modes** using OpenClaw-compatible providers
- **Rich markdown answers** with inline citation links `[1]`
- **Hover previews** — favicon, title, and snippet on any source
- **Tabbed results**: All, Sources, Images, Links
- **AI auto-sort** — one click splits conversations into topic-based threads
- **Follow-up suggestion chips** — click to dive deeper
- **Thread sidebar** with AI-generated titles
- **Smart persistence** — fresh start after inactivity, old threads accessible

### 🔧 Clean Chat Mode
Toggle agent activity visibility with the wrench icon:
- **Visible** — see tool calls, thinking, and agent actions
- **Hidden** — clean text-only conversation, like a normal chat app
- Pulsing dot when hidden and model is generating

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

See the full **[changelog](NERVE-CHANGELOG.md)** for detailed changes.

### May 19, 2026 — Research Tab Full Overhaul 🚀
- AI-powered Research tab with Quick/Deep modes
- Citation hover cards, inline `[1]` links, source pills
- Thread sidebar with AI-generated titles
- AI auto-sort conversations by topic
- Tabbed results (All, Sources, Images, Links)
- Follow-up suggestion chips
- Agent activity toggle (clean chat mode)
- Provider-agnostic search backend
- Full Nerve fork with MIT license

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

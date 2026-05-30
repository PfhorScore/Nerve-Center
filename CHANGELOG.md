# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.5] - 2026-05-30

### Highlights — Massive Session 🚀

**Message flow bugs fixed (finally!).** Three separate bugs were causing out-of-order messages: empty `chat_final` triggering false recovery, stale stream content bleeding into new responses, and assistant messages being duplicated when `chat_final` arrived after the user sent a new message. Multiple passes across three files — confirmed working after extended testing.

**Split view (chat + documents).** Open a file while keeping the chat visible side-by-side with a draggable resize handle. Collapse the chat to a thin strip when you need full document width.

**Thoughts panel overhaul.** Tabs (Active/Done), thought numbers for easy reference, file attachments, and multi-select with batch send. Completion state now syncs to a server-side file (`.thoughts-state.json`) so both you and the agent can check off thoughts.

**Onboarding state.** When the gateway is unreachable, Nerve Center shows a clean onboarding screen with diagnostics and quick-fix steps instead of a broken UI.

**One-click Update & Restart.** The update badge now has a button that streams progress via SSE and auto-restarts when complete.

**AgentOS competitive research.** Full architecture analysis, adapter pattern, readiness model, and UI inspiration documented in `docs/BACKEND-ADAPTER.md`.

### Added
- `/BTW` background research routing — type `/btw` + query to send to Research tab while chat continues
- Research button icon changed to BookOpen, text to "Research this…"
- Research mode defaults to Quick instead of Deep
- Thoughts panel: localStorage keys rebranded to nerve-center-* prefix
- Progress indicator: subtle `box-shadow` glow during generation
- Modes buttons centering: `flex-1` layout for proper alignment
- Split view: chat + document side-by-side with draggable resize handle
- Chat collapse toggle in split view (hide chat to full-width document)
- Thoughts panel tabs (Active / Done) with counts
- Thought numbers (`#1`, `#2`, etc.) on every card
- File attachments for thoughts (paperclip button)
- Multi-select mode + batch send for thoughts (Shift+click range select)
- Server-backed thoughts state (`.thoughts-state.json` — agent can check off thoughts)
- Onboarding state when gateway is unreachable
- One-click Update & Restart with SSE progress streaming
- Ctrl+Enter to send toggle (Settings → Audio)
- Shift+Enter sends in Ctrl+Enter mode across chat, thoughts, research
- Doctor CLI command (`npm run doctor`) — checks gateway, server, models
- Cmd+B sidebar toggle toast notification
- Tab refresh button (reload file from disk)
- Window split ratio saved to localStorage
- Changelog dialog portaled to `document.body` (was broken by `backdrop-filter`)
- `docs/BACKEND-ADAPTER.md` — backend adapter architecture blueprint

### Changed
- Research button: icon Search → BookOpen, text "Research" → "Research this…"
- Voice section in README: rewritten to emphasize real-time voice USP
- MCP section in README: trimmed from 5 bullets to 3
- Research view: Thoughts panel moved to left column
- Research view sidebar width matches Work view (uses saved `leftSidebarWidth`)
- Memory panel: refreshed visual design (removed OG Nerve purple/diamond styling)
- Library images: button instead of link to prevent accidental navigation
- Message hover buttons: larger (13px icons), more padding, higher opacity
- README: reordered screenshots to first-time-user flow, added post-install next-steps
- README: filled Work, Voice, MCP Integration, Agent Monitoring sections
- Install path: `/nerve` → `/nerve-center`
- All internal code comments updated to reference Nerve Center

### Fixed
- **Message ordering (multi-pass fix):**
  - Empty `chat_final` no longer triggers false recovery (was causing double history reload + viewport desync)
  - `lastStreamHtmlRef` cleared when `isGenerating` transitions (prevents stale content bleed)
  - `mergeFinalMessages` scans recent 30 messages for matching assistant messages (prevents duplicates)
- Sidebar: individual panel collapse no longer collapses entire right sidebar
- Panel migration: memory/agents now filtered from both sidebars, not just right

### Session 2 — May 30 (04:40-08:00) — Create Mode, /btw Fix, Thoughts Audit 🧠

**Create tab prototype shipped.** New 4th view mode with CodeMirror editor, multi-file tabs (HTML/CSS/JS/MD/JSON/PY/YAML/TXT), live HTML preview with debounced iframe rendering, file save to workspace, file open/new, and inline chat sidebar for agent commands.

**Bug fixes.** `/btw` background research pill no longer stuck forever (added `nerve:btw-done` event dispatch + auto-trigger search). Chat auto-scrolls to bottom when new generation starts. Research threads now persist to localStorage immediately on creation (fixes "current thread not in history" bug). Thoughts panel state merge → replace (server is authoritative source of truth).

**UI tweaks.** Usage section moved from TopBar dropdown to collapsible section at top of Agent Hub. Thoughts panel footer shows completion stats ("12/83 complete · 14%"). Esc cancels inline thought editing (already implemented). Structured Q&A directive added to SOUL.md.

**Design/concept.** 5 Meridian UI mockups (workspace, canvas design view, agent hub, create mode, chat peek overlay). Demo tour-guide agent created with full workspace + gateway registration. Design view integration plan with 15-point checklist.

### Added
- Create tab (4th view mode) with CodeMirror, multi-file tabs, live HTML preview, file save
- Chat sidebar in Create mode for agent commands while editing
- Thoughts stats footer (completed/total count + percentage)
- Thoughts state now server-authoritative (replace instead of merge)
- Chat auto-scroll forced on new generation start
- `/btw` research completion now properly dispatches `nerve:btw-done` event
- Research threads saved to localStorage immediately on creation
- Demo tour-guide agent with dedicated workspace and gateway registration
- 'Create' view mode added to ViewMode type, TopBar tabs, and command palette

### Changed
- Usage section: TopBar dropdown → collapsible Agent Hub section
- README: restructured Features hierarchy (added `## ✨ Features` umbrella), added emojis to Workflow and First Launch, "Think about..." → "Think about this?"
- SOUL.md: added "Asking Questions" section for structured Q&A
- TODO.md: cleaned up and reorganized with realistic time estimates

### Fixed
- `/btw` Research pill stuck on screen (missing `nerve:btw-done` dispatch)
- Chat not auto-scrolling to bottom on new response
- Thoughts state using merge instead of replace (stale localStorage persisted)
- Research thread not appearing in thread history after refresh
- Agent Hub "error loading dynamically imported module" (stale chunk cache)
- Settings-Integrations: duplicate wrench icon (already fixed — test uses Zap, edit uses Wrench)

### Session 2b — Batch 2 (Quick Wins)
- Scroll-to-top button for Thoughts panel (mirrors scroll-to-bottom)
- One-click launcher script (`nerve-center.sh`)
- Ctrl+F search for Thoughts panel (search bar, keyboard shortcut, text filtering)
- OpenClud update browser notification (fires when version check finds new release)
- Browser notification on research completion (catches `nerve:btw-done` event)
- Voice input button for Thoughts (🎤 uses browser SpeechRecognition)
- Agent Hub section headers styled to match regular panel design

### Changed
- Thoughts panel tabs: removed `uppercase` CSS → "Active" and "Completed" (sentence case)
- TopBar: Usage button + panel fully removed (only in Agent Hub now)
- View mode tab order: Work/Research/Create/Tasks
- TopBar no longer receives `tokenData` prop (cleanup from Usage removal)
- UpdateBadge: requests notification permission and fires browser notification

### Added
- `nerve-center.sh` one-click launcher (checks gateway, starts server, opens browser)
- VoiceInputButton component for Thoughts panel (browser SpeechRecognition)
- Thoughts panel: search state + keyboard shortcut for Ctrl+F
- Agent Hub: `tokenData` prop wired through from App.tsx



## [Unreleased]

### Highlights — 2026-05-27 — Avatars, Chat Cleanup, Polish 🎨

**Avatars!** Agent Hub now has an avatar section — upload per-agent images shown in message headers and session lists. Falls back to colored initials. Stored in localStorage keyed by agent name.

**Chat Header Removed.** Model/Effort/Reset controls moved to the StatusBar at the bottom of the screen. The chat area is now just messages + input — much cleaner.

**Send Button Becomes Stop.** During generation, the send button turns into a red stop square. No more separate abort button.

**Discord-Style Messages.** Username on its own line above the message body, timestamp next to it. Inline name prefix removed.

**"↑ older messages" is now clickable.** Replaced the IntersectionObserver sentinel with a proper button.

**Left sidebar hover animation fixed.** Transition now uses the permanent collapsed state so hover-to-expand animates smoothly.

### Added
- `/BTW` background research routing — type `/btw` + query to send to Research tab while chat continues
- Research button icon changed to BookOpen, text to "Research this…"
- Research mode defaults to Quick instead of Deep
- Thoughts panel: localStorage keys rebranded to nerve-center-* prefix
- Progress indicator: subtle `box-shadow` glow during generation
- Modes buttons centering: `flex-1` layout for proper alignment
- AvatarIcon component (`src/components/AvatarIcon.tsx`) — per-agent avatars with initial fallback
- AvatarSection in Agent Hub — upload UI with agent dropdown
- Avatars shown in SessionNode (session list) and MessageBubble (chat headers)

### Changed
- Research button: icon Search → BookOpen, text "Research" → "Research this…"
- Voice section in README: rewritten to emphasize real-time voice USP
- MCP section in README: trimmed from 5 bullets to 3
- ChatHeader removed entirely — Model/Effort/Reset now in StatusBar
- InputBar send button becomes stop button during generation
- MessageBubble: Discord-style username header with avatar, no inline name prefix
- "older messages" sentinel → clickable button
- Left sidebar hover uses `leftSidebarCollapsed` for smooth transition
- package.json bumped to v0.2.1

### Fixed
- Left sidebar hover animation snapping (transition was conditional on wrong state)
- "↑ older messages" not triggering (IntersectionObserver → button)
- Agent names not populating in avatar dropdown (was hitting 404 API endpoint)

### Highlights — 2026-05-27 — Thoughts v2, Library, Perplexity Input 🧠

**Thoughts Panel v2.** Complete redesign. Instead of one big textarea, thoughts are now individual cards split by `---` markers. Each card has a completion checkbox, inline editing, and hover actions (copy, send to chat, research). Send a thought to chat and it auto-checks off when the AI finishes generating. Completion state persists in localStorage.

**Library Panel.** New sidebar panel that automatically extracts all URLs, citation links, and images from chat conversations. Deduplicated by URL with tabs for All/Links/Images, search filter, favicon previews, and image thumbnails.

**Server-Backed Scratchpad.** Thoughts now sync across all devices via a `scratchpad.md` file on the server (`POST /api/files/write`). Debounced at 500ms. One-time migration merges content from multiple browsers with device labels. localStorage is preserved as instant cache.

**Perplexity-Style Input Bar.** Send/attach buttons moved below the text input area in a labeled toolbar (Attach, Research, TTS, Markdown preview, Send). File upload accept changed from `image/*` to `*/*` so .md and other file types work.

**Activity Panel Improvements.** Tool calls now appear exclusively in the Activity Panel — hidden from the chat stream for a clean conversation view. Each call is individually expandable. Removed redundant Tool Calls panel (merged into Activity panel).

**Chat Header Cleanup.** Removed the collapse right sidebar button and the show/hide agent activity toggle. Header now shows just Model + Effort selectors and the reset button.

**Tool Calls Hidden from Chat.** Tool messages and thinking indicators are no longer rendered in the chat view. They appear exclusively in the Activity Panel sidebar.

**Research View Simplified.** Removed the workspace/file-explorer sidebar from research mode. Research view now shows only the thread sidebar, research panel, and thoughts panel.

**Sidebar Width Fix.** Right sidebar now uses percentage-based layout when expanded (instead of fixed pixel width), so it naturally shrinks/grows with the browser window. Root container has `overflow-x-hidden` to prevent page-level horizontal scroll.

**TopBar Alignment.** Chat/Research/Tasks buttons now offset by the left sidebar width (`leftSidebarOffset` prop) so they align with the chat content area.

**AgentActivityPanel reverted to individual entries.** The grouping experiment was reverted for stability. Each tool call is its own expandable entry in the activity panel.

### Added
- `/BTW` background research routing — type `/btw` + query to send to Research tab while chat continues
- Research button icon changed to BookOpen, text to "Research this…"
- Research mode defaults to Quick instead of Deep
- Thoughts panel: localStorage keys rebranded to nerve-center-* prefix
- Progress indicator: subtle `box-shadow` glow during generation
- Modes buttons centering: `flex-1` layout for proper alignment
- ThoughtsPanel component (`src/features/thoughts/ThoughtsPanel.tsx`) — thought-bubble scratch pad
- LibraryPanel component (`src/features/references/LibraryPanel.tsx`) — auto-extracted references from chat
- Server-backed scratchpad sync via `scratchpad.md` with one-time cross-browser merge
- `ThoughtsPanel` integrated into both sidebar and research view
- `LibraryPanel` as a right-sidebar panel with BookMarked icon
- TopBar `leftSidebarOffset` prop for view button alignment
- Tooltip on Thoughts panel header explaining `---` workflow

### Changed
- Research button: icon Search → BookOpen, text "Research" → "Research this…"
- Voice section in README: rewritten to emphasize real-time voice USP
- MCP section in README: trimmed from 5 bullets to 3
- InputBar: moved from inline button row to Perplexity-style button bar below textarea
- InputBar: file accept changed from `image/*` to `*/*`
- ChatHeader: removed collapse sidebar and agent activity toggle buttons
- ChatPanel: tool calls permanently hidden from chat (activity panel only)
- computedRightWidthPx: uses percentage mode for expanded sidebar
- Research view: removed workspace sidebar, uses full-width thoughts panel
- DEFAULT_LAYOUT: replaced 'tools' with 'references' panel
- loadPanelLayout: added migrate v3 (remove tools) and v4 (add references)
- SidebarStrip: added BookMarked icon, removed Wrench icon
- package.json: bumped to v0.2.0

### Fixed
- Right sidebar width not adapting to window resize (was fixed pixel via `fileBrowserCollapsed`)
- File upload filter blocking .md and non-image files
- TopBar view buttons misaligned with chat area when left sidebar visible
- Subagents route path fix (`/` → `/api/subagents`)

### Removed
- ToolCallsPanel from imports, PanelId, DEFAULT_LAYOUT, panelName, rendering
- `onToggleRightPanel` and `showAgentActivity` from ChatHeader and ChatPanel
- `tools` from SidebarStrip icon mapping
- `handleJumpToMessage` and related jump-to-message code (reverted with AgentActivityPanel)
- `desktopRightPanelWidth` unused state
- ResearchPanel removed from research view (restored later)

## [Unreleased]

### Highlights — 2026-05-26

**Panel system overhaul with sidebar enforcement.** Duplicate panels no longer appear in both sidebars — a strict placement enforcement system ensures Workspace lives only in the left sidebar and Agents/Memory/Thoughts/Tool Calls live only in the right. Corrupted localStorage layouts are auto-healed on every page load.

**Tool Calls panel** is now a first-class sidebar citizen with full "Expand/Collapse" Cmd+K command and scrollable expandable entry cards showing tool name, args, status (running/success/error), and truncated results.

**Research tab state survives tab switches.** Research and Kanban panels now stay mounted (hidden via `display: none`) instead of unmounting when switching to Chat, preserving threads, search history, and task state.

**Smooth streaming text.** The streaming message display now uses append-only DOM manipulation instead of full `innerHTML` replacement on every frame, eliminating the janky/choppy animation during generation.

**Collapsible sidebars with hover-to-expand.** Both left and right sidebars can be collapsed to a ~40px icon strip. Hovering the strip temporarily expands the sidebar to full width with smooth CSS transitions. Collapse state is persisted to localStorage independently for each sidebar.

**Live markdown preview in composer.** A Preview/Edit toggle in the chat input bar renders markdown in real-time (bold, italic, code, links) using the existing MarkdownRenderer. Enter sends from preview mode, Escape returns to editing.

**Auto-fit double-click on the main panel divider.** Double-clicking the resize handle between chat and right sidebar now auto-sizes the right panel to fit its content (measured via synchronous `scrollWidth` with no visual flash), capped at 70% container width.

**Full documentation audit.** All touched files (ResizablePanels, ToolCallsPanel, App.tsx, commands.ts, StreamingMessage) now have comprehensive JSDoc with `@param`/`@returns`/`@link` cross-references and inline architecture notes.

### Added
- `/BTW` background research routing — type `/btw` + query to send to Research tab while chat continues
- Research button icon changed to BookOpen, text to "Research this…"
- Research mode defaults to Quick instead of Deep
- Thoughts panel: localStorage keys rebranded to nerve-center-* prefix
- Progress indicator: subtle `box-shadow` glow during generation
- Modes buttons centering: `flex-1` layout for proper alignment
- Tool Calls panel (`src/features/tools/ToolCallsPanel.tsx`) integrated into the right sidebar panel system
- SidebarStrip component (`src/components/SidebarStrip.tsx`) for collapsed sidebar icon strips
- Cmd+K command for "Expand/Collapse Tool Calls Panel"
- Compact Thoughts panel (full Edit/Preview toggle) at the bottom of the Research view
- Markdown preview toggle in the chat input composer (Eye icon button)
- `sharp` dependency for image attachment processing

### Changed
- Research button: icon Search → BookOpen, text "Research" → "Research this…"
- Voice section in README: rewritten to emphasize real-time voice USP
- MCP section in README: trimmed from 5 bullets to 3
- Double-click on resize handle now auto-fits right panel to content (was: reset to 55%)
- Research and Kanban panels stay mounted (CSS-hidden) instead of unmounting on tab switch
- Streaming message rendering uses append-only DOM updates via ref for smooth animation
- Panel placement is now strictly enforced on every `loadPanelLayout()` and `savePanelLayout()`
- Left sidebar is hard-limited to Workspace only; right sidebar to Agents/Memory/Thoughts/Tools

### Fixed
- Broken `DEFAULT_LAYOUT` constant (partially deleted declaration causing orphan object properties at module scope)
- `nextId` scope bug in vertical inter-panel resize handle's `onDoubleClick` handler
- Duplicate Thoughts and Tool Calls panels appearing in both left and right sidebars
- Research tab losing all threads/history when switching to Chat view
- Janky/choppy text streaming caused by full `innerHTML` replacement on every rAF frame
- Streaming text flickering/disappearing caused by `dangerouslySetInnerHTML` racing with `useLayoutEffect`
- Right sidebar scrolling/resizing broken by `h-full` on collapsible wrapper (changed to `flex-1`)
- Drag-and-drop blocked by `savePanelLayout` enforcement stripping wrong-side panels
- Drag-and-drop cross-sidebar drop targets missing (container fallback + `stopPropagation`)
- Drag-and-drop racy `dropTarget` React state (switched to ref for synchronous reads)
- Workspace panel double header (FileTreePanel internal header now respects `hideHeader` prop)
- Workspace panel internal resize handle conflicting with panel system (hidden when `hideHeader`)
- Memory panel not scrolling (changed `overflow-hidden` → `overflow-y-auto` in WorkspacePanel)
- Panel header labels in ALL CAPS (removed `uppercase` CSS class)
- OCR dependency: installed `sharp` for image attachment processing

### Added
- `/BTW` background research routing — type `/btw` + query to send to Research tab while chat continues
- Research button icon changed to BookOpen, text to "Research this…"
- Research mode defaults to Quick instead of Deep
- Thoughts panel: localStorage keys rebranded to nerve-center-* prefix
- Progress indicator: subtle `box-shadow` glow during generation
- Modes buttons centering: `flex-1` layout for proper alignment (continued)
- Right-click context menu on sidebar strips: Show on hover toggle, Expand/Collapse
- Right-click context menu on panel headers: Move to left/right sidebar
- Hover delay (250ms) before sidebar expands to prevent accidental triggers
- Thoughts content dual-persistence: `sessionStorage` backup in case `localStorage` is cleared
- Sidebar bar-level scrolling (`overflow-y-auto` on right sidebar wrapper)
- `ContextMenu` / `ContextMenuItem` / `ContextMenuDivider` reusable components

### Documentation
- All exported functions and non-trivial helpers in modified files now have JSDoc
- Panel system types (`PanelId`, `PanelLayout`) now have inline documentation for adding new panels
- `loadPanelLayout()` includes a side-assignment table in its JSDoc
- `StreamingMessage` documents the append-only DOM manipulation technique

## [1.5.3] - 2026-04-21

### Highlights

**Workspace context is much more usable inside chat.** Nerve can now add files and directories to chat, open rendered markdown documents in-app, and follow configurable workspace path links and aliases directly from messages or docs (PR #239, PR #248, PR #271, PR #273, PR #288).

**File browsing works better on real devices.** The file browser now supports in-app PDF viewing, moves compact actions into kebab menus, and handles touch long-press context menus more reliably on mobile (PR #254, PR #299, PR #303, PR #307).

**Session visibility got less confusing.** Spawned child sessions survive refreshes, channel sessions show up in the agent sidebar, root agent labels derive more reliably from identity, and orphaned agent sessions no longer disappear from the tree (PR #226, PR #236, PR #259, PR #297).

**Uploads and shell controls got cleaner.** The paperclip is now the primary upload flow, attachments use a canonical upload reference contract, and the command palette has clearer launchers and visibility toggles across desktop and mobile layouts (PR #229, PR #231, PR #291, PR #292, PR #293).

### Added
- `/BTW` background research routing — type `/btw` + query to send to Research tab while chat continues
- Research button icon changed to BookOpen, text to "Research this…"
- Research mode defaults to Quick instead of Deep
- Thoughts panel: localStorage keys rebranded to nerve-center-* prefix
- Progress indicator: subtle `box-shadow` glow during generation
- Modes buttons centering: `flex-1` layout for proper alignment
- In-app PDF viewing with file type checks in the file browser (PR #254)
- An in-app bead viewer with context-safe bead links (PR #275)
- Configurable workspace path links plus `CHAT_PATH_LINKS` alias mapping for chat references (PR #239, PR #288)
- File-tree actions to add individual files or whole directories to chat (PR #271, PR #273)
- A hidden-workspace-entries toggle for the workspace panel (PR #274)
- Support for adaptive thinking selection in the UI (PR #302)

### Changed
- Research button: icon Search → BookOpen, text "Research" → "Research this…"
- Voice section in README: rewritten to emphasize real-time voice USP
- MCP section in README: trimmed from 5 bullets to 3
- The paperclip is now the primary upload entry point in chat (PR #231)
- Workspace markdown documents now render in a dedicated navigable document view instead of forcing raw file reads (PR #248)
- Compact file-browser actions now live behind kebab menus to reduce accidental taps and visual noise (PR #307)
- The command palette now has clearer launchers, mobile entry points, and visibility controls (PR #291, PR #292, PR #293)
- Built-in Kanban can now be disabled from settings while remaining enabled by default for existing installs (PR #242)
- The updater now surfaces a copy-paste command during update flows for easier manual recovery (PR #295)

### Fixed
- Spawned child sessions now remain visible after refresh instead of disappearing from the sidebar (PR #226)
- Uploaded user images now survive history reconciliation correctly (PR #220)
- The workspace watcher again refreshes config changes and restores workspace labels correctly (PR #261, PR #284)
- Local chat path link configuration now self-heals safer defaults, and inline workspace references replay correctly after follow-up renders (PR #267, PR #285)
- Session roots now derive stable labels from identity, keep inherited effort labels after reload, and continue showing channel and orphaned sessions in the sidebar (PR #236, PR #257, PR #259, PR #297)
- Kanban assigned execution now falls back to the full session list when needed instead of dropping valid targets (PR #287)
- Panel dividers stay interactive when the sidebar is collapsed, and resizable panel lint regressions are cleaned up (PR #281, PR #289)
- ArrowUp history recall, untrusted system event parsing, and nested edit diff rendering all behave correctly in chat again (PR #278, PR #280, PR #308)
- The server-side upload config endpoint is available again, and subagent lifecycle handling now lives on the server for more reliable spawn cleanup (PR #247, PR #265)
- Tailscale serve docs and examples now use valid command syntax again (PR #276, PR #277)

### Documentation
- Refreshed local setup wording in the README to better match current install expectations

## [1.5.2] - 2026-03-30

### Highlights

**Kanban execution now matches the real session tree.** Assigned tasks launch as real child sessions beneath the selected assignee root, task completion and failures report back to the parent root, and background root notifications no longer misfire while those updates land (PR #198).

**Remote and hybrid installs are less brittle.** Nerve now supports remote-gateway installation up front via `--gateway-url`, resolves gateway RPC origins from public config for remote workspace access, and explains missing cron capability with a clear remediation path instead of a dead-end warning (PR #181, PR #197, PR #200).

**Session and agent state are less misleading.** The model picker now reflects the active OpenClaw config, duplicate root-agent creation correctly registers suffixed agents in `openclaw.json`, direct-message sessions nest under the correct agent root, and the main root label stays canonical (PR #174, PR #185, PR #192, PR #196).

**Docs and setup guidance caught back up to reality.** AI setup docs landed, setup now prints the right deployment guide links, and stale operator docs were refreshed to match the current runtime and installer behavior (PR #179, PR #182, PR #191).

### Added
- `/BTW` background research routing — type `/btw` + query to send to Research tab while chat continues
- Research button icon changed to BookOpen, text to "Research this…"
- Research mode defaults to Quick instead of Deep
- Thoughts panel: localStorage keys rebranded to nerve-center-* prefix
- Progress indicator: subtle `box-shadow` glow during generation
- Modes buttons centering: `flex-1` layout for proper alignment
- Installer support for `--gateway-url` so Nerve can target a remote gateway from first boot (PR #181)
- AI agent setup docs and a raw install contract for agent-driven installs (PR #182)
- A dedicated `GET /api/kanban/tasks/:id` endpoint for direct Kanban task lookup by id (PR #176)
- An assignee picker for Kanban task forms so users no longer need to enter raw assignee values manually (PR #203)
- Support for custom board column keys via board config (PR #173)
- Shebang-based syntax highlighting for extensionless executable files (PR #190)

### Changed
- Research button: icon Search → BookOpen, text "Research" → "Research this…"
- Voice section in README: rewritten to emphasize real-time voice USP
- MCP section in README: trimmed from 5 bullets to 3
- Setup now prints deployment guide links after configuration so operators can jump straight to the right topology docs (PR #179)
- Setup now ensures `sessions_spawn` is allowlisted alongside the other required gateway tools for Kanban execution on current OpenClaw builds (PR #159)
- Model selection now comes from the active OpenClaw config instead of Nerve-side fallback lists (PR #174)
- Chat input helper text now points users at the command palette more clearly (PR #175)

### Fixed
- Skills API parsing now falls back to structured stderr JSON output when tools emit machine-readable results there (PR #161)
- Sidebar session tree cleanup: only real roots are shown, direct-message sessions nest under their owning agent root, and `agent:main:main` always renders with a canonical label (PR #177, PR #185, PR #196)
- Session selection click targets are more forgiving thanks to a small hover delay that reduces accidental steals while moving through the tree (PR #187)
- Duplicate root-agent creation now registers the correct suffixed agent in `openclaw.json` so config, workspace, and session roots stay aligned (PR #192)
- Assigned Kanban tasks now launch as real child sessions, clean up orphaned child sessions on partial launch failures, and report completion back to the parent root that owns the work (PR #198)
- Background top-level root updates now set unread state correctly and only ping on terminal events (PR #198)
- Remote-workspace gateway RPC now derives its request origin from public config instead of hardcoded loopback values, fixing hybrid/cloud `origin not allowed` failures (PR #200)

### Documentation
- Added AI setup docs and refreshed stale repo docs so installation, deployment, configuration, and troubleshooting guidance line up with the current runtime (PR #182, PR #191)

## [1.5.1] - 2026-03-25

### Fixed
- Restored the browser websocket auth identity to `webchat-ui` so remote deployments do not trip the gateway's stricter Control UI device-identity requirement on non-secure page origins. This fixes the 1.5.0 login failure reported by users connecting to remote gateway endpoints from plain remote HTTP Nerve pages.

## [1.5.0] - 2026-03-25

### Highlights

**Workspace context now follows the owning top-level agent**. File browser state, Memory, Config, and Skills now switch with the selected top-level agent instead of leaking across agents, and dirty editor tabs now block cross-agent switches with an explicit save / discard / cancel choice (PR #123).

**Agent runtime flows got tighter**. Subagents can now choose whether they stay visible after one-shot runs, subagent deletion is more reliable, the model catalog waits longer on cold starts so configured Codex and other models are more likely to appear in the spawn dialog, and remote or sandboxed workspace access now falls back cleanly through the gateway when local filesystem access is unavailable (PR #119, PR #120, PR #124, PR #145).

**Voice and readability both moved forward**. Xiaomi MiMo joins as a first-class TTS provider, the new global font size control now reaches more of the UI, and small-screen inputs keep a fixed 16px size to avoid mobile auto-zoom regressions (PR #128, PR #129, PR #130).

**Installer, setup, and execution hardening all moved up a notch**. Tailscale setup now supports distinct IP and Serve flows, wake word is disabled on mobile web, setup defaults are stricter around device approval and can infer the agent name from local metadata, and kanban reruns now keep stable identifiers without stale completion state leaking across runs (PR #116, PR #118, PR #122, PR #141, PR #143, PR #151).

**Workspace navigation got smoother**. Markdown and chat workspace path references can now resolve and reveal files safely in the file browser, with follow-up fixes for missing-path semantics and refreshed open handlers (PR #148, PR #149).

### Added
- `/BTW` background research routing — type `/btw` + query to send to Research tab while chat continues
- Research button icon changed to BookOpen, text to "Research this…"
- Research mode defaults to Quick instead of Deep
- Thoughts panel: localStorage keys rebranded to nerve-center-* prefix
- Progress indicator: subtle `box-shadow` glow during generation
- Modes buttons centering: `flex-1` layout for proper alignment
- Tailscale IP and Tailscale Serve setup flows in the installer, with matching installer-step documentation (PR #116)
- An **After run** selector for one-shot subagents, with **Keep** and **Delete** cleanup options (PR #120)
- **Font size setting** in Appearance settings, adjustable from 10px to 24px via dropdown, stored in `localStorage`, and applied instantly via a CSS custom property (PR #128)
- **Xiaomi MiMo** as a first-class TTS provider, including API key plumbing, server-side synthesis support, and Audio settings controls for model, voice, and style (PR #129)
- **Gateway RPC fallback for remote and sandboxed workspace access**, including a sandboxed-workspace notice in the Memory panel when local filesystem access is unavailable (PR #145)
- **Safe workspace path resolve and reveal** from markdown and chat references into the file browser (PR #148)

### Changed
- Research button: icon Search → BookOpen, text "Research" → "Research this…"
- Voice section in README: rewritten to emphasize real-time voice USP
- MCP section in README: trimmed from 5 bullets to 3
- Workspace scope is now derived from the owning top-level agent, including when viewing subagent sessions (PR #123)
- File browser tabs, selection state, drafts, Memory, Config, and Skills now persist per top-level agent instead of globally (PR #123)
- Cross-agent workspace switches now show **Save and switch**, **Discard and switch**, or **Cancel** when dirty editor tabs exist (PR #123)
- Model catalog fetches now allow a longer cold-start timeout before giving up, so configured Codex and other models appear more reliably in the spawn dialog (PR #124)
- Mobile web now disables wake word and points users to manual mic activation instead (PR #118)
- Right sidebar resizing now allows a narrower minimum width (PR #122)
- Cron list and dialog typography now fully follows the global font size system, with the remaining fixed pixel sizes converted to `rem` units (PR #130)
- Setup defaults now infer `AGENT_NAME` from local identity metadata when the value is not already explicitly set (PR #151)

### Fixed
- Subagent session deletion no longer fails on the Nerve side when the gateway closes a proxied WebSocket normally during delete flows (PR #119)
- Agent-scoped workspace switching no longer leaks same-path editor state, save toasts, watcher refreshes, or async file reads across top-level agents (PR #123)
- Tailscale origin handling is more robust during setup and follow-up gateway patching (PR #116)
- Small-screen text inputs now stay at 16px so mobile browsers do not auto-zoom the composer and settings controls after font size changes (PR #130)
- Older top-level agent chats stay visible in the sidebar instead of disappearing once they fall outside the recent-activity query window (PR #134)
- Kanban runtime data now lives under `${NERVE_DATA_DIR:-~/.nerve}/kanban`, and legacy installs automatically migrate data from old `server-dist/data/kanban` or `server/data/kanban` locations on first run (PR #135)
- Setup no longer attempts to approve malformed pending device request IDs, and gateway auth validation now uses a working token probe during defaults and check flows (PR #141)
- Kanban run completion now accepts stable child identifiers, ignores stale client `run` patches, stops stale pollers after reruns, and normalizes spawn session aliases consistently (PR #143)
- Remote and sandboxed workspace gateway fallback now authenticates correctly with device identity in real OpenShell-style deployments (PR #145)
- Workspace path resolve now returns `404` for safe missing targets, and markdown file-link handlers refresh when workspace path callbacks change (PR #149)

### Documentation
- Added a dedicated Tailscale guide for existing installs, linked from the docs index and configuration docs (PR #117)
- Refreshed the API, architecture, configuration, troubleshooting, and changelog docs to match agent-scoped workspace behavior and newer gateway and file APIs (PR #126)
- Rewrote the README around current positioning, capabilities, install flow, and embedded demo video, with follow-up formatting and video asset fixes (PR #136)

---

## [1.4.9] — 2026-03-18

### Highlights

**Multi-agent support expanded** — Nerve now supports multiple top-level agents, making multi-agent workflows less awkward and more flexible (PR #111).

**Installer and startup flow hardened** — setup and service startup are now more resilient around edge cases and failure paths (PR #115).

**UX got a broad polish pass** — cron runs, session surfacing, mobile responsiveness, and chat chrome all got tighter and more usable on real screens (PR #112, PR #113, PR #114).

### Added
- `/BTW` background research routing — type `/btw` + query to send to Research tab while chat continues
- Research button icon changed to BookOpen, text to "Research this…"
- Research mode defaults to Quick instead of Deep
- Thoughts panel: localStorage keys rebranded to nerve-center-* prefix
- Progress indicator: subtle `box-shadow` glow during generation
- Modes buttons centering: `flex-1` layout for proper alignment
- Custom workspace root support via `FILE_BROWSER_ROOT` (PR #92, thanks @jamesjmartin)
- Server-side token injection for trusted clients (PR #109, thanks @jamesjmartin)
- Support for multiple top-level agents (PR #111)

### Changed
- Research button: icon Search → BookOpen, text "Research" → "Research this…"
- Voice section in README: rewritten to emphasize real-time voice USP
- MCP section in README: trimmed from 5 bullets to 3
- File browser now collapses responsively on mobile layouts (PR #96, thanks @jamesjmartin)
- Shell, responsive layout, and Kanban UX refined (PR #108)
- Cron runs, session surfacing, and general UX polished (PR #112)
- Mobile responsiveness and connect dialog behavior hardened (PR #113)
- Mobile chat header toggle added for smaller screens (PR #114)
- Installer edge cases and service startup paths hardened (PR #115)
- Composer actions aligned to the textarea baseline
- Docs refreshed for the current gateway auth flow

### Fixed
- Inotify exhaustion prevented, with better WebSocket reconnect and subagent visibility (PR #102, thanks @DerrickBarra)
- Invalid paths evicted from the file tree cache (PR #105, thanks @jamesjmartin)
- Session model transcript 404s avoided (PR #107, thanks @DerrickBarra)
- Gateway trust boundary and connection auto-connect behavior corrected
- Infinite reconnect loops on auth failure prevented
- `Ctrl+B` shortcut handling restored
- `install.sh` execute permission restored
- Connect dialog overflow fixed on smaller screens
- Markdown list markers restored in chat bubbles
- Operator messages now render right-aligned in chat while keeping message text left-aligned

---

## [1.4.8] — 2026-03-04

### Highlights

**Voice input overhauled** — Free voice input modes improved with better finalization, shortened wake/send chimes, and reduced mic delay from 800ms to 370ms to stop clipping the first word. English phrase fallback no longer bleeds into non-English sessions.

**Kanban skill bundled** — `nerve-kanban` skill now auto-installs during setup. Agents can use the kanban skill to manage the Nerve task board directly: create tasks, move columns, update status, all through natural conversation.

### Added
- `/BTW` background research routing — type `/btw` + query to send to Research tab while chat continues
- Research button icon changed to BookOpen, text to "Research this…"
- Research mode defaults to Quick instead of Deep
- Thoughts panel: localStorage keys rebranded to nerve-center-* prefix
- Progress indicator: subtle `box-shadow` glow during generation
- Modes buttons centering: `flex-1` layout for proper alignment
- Bundled `nerve-kanban` skill with auto-install during setup (PR #83)
- Improved free voice input modes and finalization (PR #80)

### Fixed
- File browser no longer overwrites dirty editor content when re-opening an already-open file (PR #85)
- Infinite scroll no longer stalls after loading older messages (PR #86)
- `groupToolMessages` and `mergeFinalMessages` no longer mutate shared React state objects (PR #86)

### Session 3 — Release Polish (11:00-11:30)

**Bug fixes.** Research thread tooltip: "Q" → "question". Empty threads no longer appear in sidebar. `/btw` research now creates a new thread instead of appending to current. Completed thoughts tab scrolls to top on switch. Hover toolbar on messages: larger buttons (14px icons, .667rem text), full opacity on hover, more padding. Status bar now shows pulsing "thinking" indicator during generation.

**Changed.** "New Research" → "New Search" default thread title. Thread auto-naming fallback: when Perplexity AI title fails, uses first 60 chars of the query.

### Added
- Status bar "thinking" indicator with animated pulse dot during generation

### Fixed
- Research thread tooltip: "Q" → "question" (#114)
- Empty research threads filtered from sidebar (#115)
- `/btw` queries now create a dedicated thread instead of appending (#87)
- Completed thoughts tab: scrolls to top on switch (#86)
- Message hover toolbar: larger buttons, full opacity, more padding (#16/#34)
- Research thread auto-naming: falls back to query text when AI title fails
- Chat message sends use atomic state updates to prevent race conditions with streaming events (PR #86)
- Stale WebSocket `onclose` handlers no longer kill active connections during reconnect (PR #87)
- TTS voice flag resets on session switch, preventing phantom auto-speak in new sessions (PR #88)
- TTS config fetch/save now checks response status before parsing JSON (PR #88)
- TTS audio fetch includes credentials for cookie-based auth (PR #88)
- Voice phrase editor uses stable keys instead of array indices, fixing stale input values on delete (PR #88)
- ConfirmDialog Enter key no longer fires confirm when Cancel is focused (PR #89)
- Dockerfile and Makefile syntax highlighting works correctly in the file browser (PR #89)
- Theme switch no longer reloads the highlight.js stylesheet redundantly (PR #89)
- Updater rollback now completes before releasing the lock (PR #90)
- `.env` parser strips surrounding quotes from values (PR #90)
- Image compression rejects oversized output instead of silently exceeding the WebSocket payload limit (PR #90)
- Kanban drag-and-drop no longer crashes if a task is deleted by a concurrent refresh (PR #90)
- Duplicate task execution is rejected with 409 instead of spawning a second agent session (PR #90)
- Shortened wake and send voice chimes and reduced post-wake mic delay from 800ms to 370ms to prevent first-word clipping (PR #91)
- File browser wrapper has proper height constraint for vertical scroll (PR #84)
- Kanban config migration backfills missing fields (PR #82)
- English phrase fallback no longer merges into non-English sessions (PR #81)

---

## [1.4.7] — 2026-03-03

### Changed
- Research button: icon Search → BookOpen, text "Research" → "Research this…"
- Voice section in README: rewritten to emphasize real-time voice USP
- MCP section in README: trimmed from 5 bullets to 3
- Added a **Live Transcription Preview** toggle in Audio settings so browser interim transcript rendering can be enabled/disabled per user (PR #78)
- Fresh defaults for local Whisper STT now use multilingual `base` across installer, server fallback, and fresh UI state (PR #78)
- Installer Whisper bootstrap now resolves and normalizes `WHISPER_MODEL` from `.env` (supports quotes/comments/aliases like `tiny`, `base`, `small` and `.en` variants) (PR #78)

### Fixed
- Edge TTS voice now auto-switches on language change and validates language-compatible voice overrides to prevent language/voice mismatch (PR #78)
- English custom `en-*` Edge voice overrides are preserved during auto-reconcile; server-side English override detection is now gender-aware (PR #78)
- Local Whisper model management now cancels stale model downloads and syncs active server model state on startup (PR #79)

---

## [1.4.6] — 2026-03-03

### Added
- `/BTW` background research routing — type `/btw` + query to send to Research tab while chat continues
- Research button icon changed to BookOpen, text to "Research this…"
- Research mode defaults to Quick instead of Deep
- Thoughts panel: localStorage keys rebranded to nerve-center-* prefix
- Progress indicator: subtle `box-shadow` glow during generation
- Modes buttons centering: `flex-1` layout for proper alignment
- Live interim transcription preview in chat input during voice recording (PR #75)
- OpenAI TTS voice options expanded to all 13 supported voices (PR #72)
- Voice interaction sounds upgraded from oscillator beeps to custom MP3 effects (PR #70)

### Changed
- Research button: icon Search → BookOpen, text "Research" → "Research this…"
- Voice section in README: rewritten to emphasize real-time voice USP
- MCP section in README: trimmed from 5 bullets to 3
- System notifications in chat now render as collapsible strips (PR #69)
- Kanban task IDs and session labels are now human-readable (PR #67)

### Fixed
- Voice audio playback quality improvements (PR #74)
- Chat panel remains mounted during tab switches to avoid voice/session disruption (PR #71)
- Chat keydown handling now safely guards IME composition input (PR #68)

---

## [1.4.5] — 2026-03-01

### Added
- `/BTW` background research routing — type `/btw` + query to send to Research tab while chat continues
- Research button icon changed to BookOpen, text to "Research this…"
- Research mode defaults to Quick instead of Deep
- Thoughts panel: localStorage keys rebranded to nerve-center-* prefix
- Progress indicator: subtle `box-shadow` glow during generation
- Modes buttons centering: `flex-1` layout for proper alignment
- **Task board** with full kanban workflow: drag-and-drop, agent execution, proposals, SSE live updates, board configuration, and audit log (PR #61)
- **Gateway restart button** in the top bar for one-click gateway restarts (PR #49 by @jamesjmartin)
- **File browser operations**: rename, move, trash, and restore files from the workspace panel (PR #44)
- Deployment guides for three topology scenarios: localhost, LAN/tailnet, and public cloud (PR #60)
- Updater now resolves the latest published GitHub release instead of defaulting to master HEAD (PR #45)

### Fixed
- Server build (`build:server`) now included in `npm run build`; `npm run prod` runs both builds (PR #47 by @jamesjmartin)
- Memory collapse toggle: first click to expand no longer silently ignored due to key mismatch and nullish default (PR #62 by @jamesjmartin)
- Kanban board columns scroll vertically when tasks overflow viewport (PR #63)
- Switching TTS provider no longer sends the previous provider's model ID, which caused 400 errors

### Contributors
- **@jamesjmartin** -- build fix (#47), gateway restart button (#49), memory toggle fix (#62)

---

## [1.4.3] — 2026-02-27

### Added
- `/BTW` background research routing — type `/btw` + query to send to Research tab while chat continues
- Research button icon changed to BookOpen, text to "Research this…"
- Research mode defaults to Quick instead of Deep
- Thoughts panel: localStorage keys rebranded to nerve-center-* prefix
- Progress indicator: subtle `box-shadow` glow during generation
- Modes buttons centering: `flex-1` layout for proper alignment
- Update-available badge in status bar with server-side version check (PR #31)
- Cron UX rework: "When done" framing, auto-detected channels, context-aware placeholders (PR #32)
- WS proxy and SSE connections tagged with unique IDs for structured logging
- WS keepalive pings (30s) prevent silent connection drops during idle
- Connection close logs include duration and message counts
- Installer detects port conflicts before writing config (closes #38)

### Fixed
- Gateway token removed as login password, login-only scrypt hash (PR #33)
- Login rate limit tightened to 5 req/min (PR #33)
- Server refuses to start network-exposed without auth (PR #33)
- WS proxy path/port validation prevents proxying to arbitrary hosts (PR #33)
- TTS fallback now works for non-Latin scripts (PR #33)
- WS proxy challenge-nonce timing race causing failed device identity injection
- Config mutations via typed updateConfig() instead of unsafe direct writes
- ChatContext render loops from unmemoized hook return values
- AudioContext singleton prevents competing audio contexts during voice input
- STT sync race where recognition started before audio context was ready
- Gateway reconnect no longer killed by stale keepalive state
- Installer traps for cleanup, build rollback on failure
- Cron delivery-only failures show warning instead of error (PR #32)

### Changed
- Research button: icon Search → BookOpen, text "Research" → "Research this…"
- Voice section in README: rewritten to emphasize real-time voice USP
- MCP section in README: trimmed from 5 bullets to 3
- ChatContext split into 4 composable hooks (useChatMessages, useChatStreaming, useChatRecovery, useChatTTS)
- Normalized config references across .env.example, README, and CONFIGURATION.md

---

## [1.4.0] — 2026-02-26

### Added
- `/BTW` background research routing — type `/btw` + query to send to Research tab while chat continues
- Research button icon changed to BookOpen, text to "Research this…"
- Research mode defaults to Quick instead of Deep
- Thoughts panel: localStorage keys rebranded to nerve-center-* prefix
- Progress indicator: subtle `box-shadow` glow during generation
- Modes buttons centering: `flex-1` layout for proper alignment
- **`nerve update` command** — git-based updater with automatic rollback. Supports `--dry-run`, `--version`, `--rollback`, `--no-restart`, and `--verbose` flags. See [docs/UPDATING.md](docs/UPDATING.md).
- Memory filenames are no longer restricted to `YYYY-MM-DD.md` format — any safe filename is accepted (PR #29).

### Fixed
- `git checkout` during updates now uses `--force` to handle dirty working trees.
- `/api/version` endpoint is now public (required for updater health checks with auth enabled).

---

## [1.3.0] — 2026-02-18

### Added
- `/BTW` background research routing — type `/btw` + query to send to Research tab while chat continues
- Research button icon changed to BookOpen, text to "Research this…"
- Research mode defaults to Quick instead of Deep
- Thoughts panel: localStorage keys rebranded to nerve-center-* prefix
- Progress indicator: subtle `box-shadow` glow during generation
- Modes buttons centering: `flex-1` layout for proper alignment
- Multilingual voice control across 12 languages: `en`, `zh`, `hi`, `es`, `fr`, `ar`, `bn`, `pt`, `ru`, `ja`, `de`, `tr`.
- Language and phrase APIs for runtime voice configuration:
  - `GET/PUT /api/language`
  - `GET /api/language/support`
  - `GET/PUT /api/transcribe/config`
  - `GET /api/voice-phrases`
  - `GET /api/voice-phrases/status`
  - `GET/PUT /api/voice-phrases/:lang`
- Event-driven realtime chat streaming pipeline (PR #16): direct WebSocket-driven chat updates, reduced transcript polling, and recovery-aware rendering.
- Mutex-protected env writer (`server/lib/env-file.ts`) to serialize `.env` updates.

### Changed
- Research button: icon Search → BookOpen, text "Research" → "Research this…"
- Voice section in README: rewritten to emphasize real-time voice USP
- MCP section in README: trimmed from 5 bullets to 3
- Voice language is now explicit (auto-detect removed from UI flow).
- Default/fallback language behavior is English (`en`) for missing/invalid values.
- Primary env key is now `NERVE_LANGUAGE` (legacy `LANGUAGE` remains a read fallback).
- Wake phrase behavior is single-primary-phrase per language (custom phrase takes precedence).
- Settings categories are now `Connection`, `Audio`, and `Appearance`.
- Voice phrase overrides now persist as runtime state at `~/.nerve/voice-phrases.json` (configurable via `NERVE_VOICE_PHRASES_PATH`).
- Local STT default model is now multilingual `tiny`.
- Chat rendering now prefers event-first WebSocket updates instead of periodic full-history polling (PR #16).
- Setup/config flow now uses one bundled consent prompt for OpenClaw gateway config patches, including `gateway.tools.allow` updates for cron management (PR #15).
- UI is now fully responsive across desktop, tablet, and mobile with adaptive small-screen navigation and controls (PR #24).

### Fixed
- Unicode-safe stop/cancel matching for non-Latin scripts (removed brittle `\b` behavior).
- Reduced Latin stop-phrase false positives inside larger words.
- Wake phrase edits now apply immediately in-session (no page refresh required).
- Edge TTS SSML locale now derives from selected voice locale (not hardcoded `en-US`).
- Improved 4xx/5xx separation for language/transcribe config update failures.
- Improved voice-phrase modal reliability (load/save error handling and request-abort race handling).
- Accessibility: icon-only remove-phrase controls now include accessible labels.
- `ws-proxy` now enriches `PATH` before `openclaw` CLI calls, fixing restricted RPC methods under nvm/systemd environments (PR #12).
- Session and memory row actions are now reliably accessible on touch devices (no hover-only dependency) (PR #24).

### Documentation
- Updated API, architecture, configuration, troubleshooting, installer notes, and README to match multilingual voice behavior and runtime config.
- Removed internal planning notes from public docs.

## Unreleased

### Added
- `/BTW` background research routing — type `/btw` + query to send to Research tab while chat continues
- Research button icon changed to BookOpen, text to "Research this…"
- Research mode defaults to Quick instead of Deep
- Thoughts panel: localStorage keys rebranded to nerve-center-* prefix
- Progress indicator: subtle `box-shadow` glow during generation
- Modes buttons centering: `flex-1` layout for proper alignment
- **Split view** — Chat and documents side-by-side with draggable resize handle. Collapse chat to thin strip when you need full document width. (#chat-as-panel)
- **Thoughts panel tabs** — Active and Done tabs to filter thoughts by completion state.
- **Thought numbers** — Each thought card shows a `#N` label for easy reference in chat.
- **Thought attachments** — Paperclip button to attach images/files to new thoughts.
- **Ctrl+Enter to send toggle** — Setting in Audio preferences to switch between Enter and Ctrl+Enter as the primary send key. Shift+Enter also works in Ctrl+Enter mode.
- **Tab refresh button** — Reload file from disk without closing and reopening.
- **AgentOS competitive research** — Architecture analysis, adapter pattern, readiness model, and UI inspiration documented in `docs/BACKEND-ADAPTER.md`.

### Changed
- Research button: icon Search → BookOpen, text "Research" → "Research this…"
- Voice section in README: rewritten to emphasize real-time voice USP
- MCP section in README: trimmed from 5 bullets to 3
- **Research view** — Thoughts panel moved to left column, consistent sidebar width with Work view.
- **Message hover buttons** — Larger icons (13px), more padding, higher hover opacity.
- **Library images** — Use button instead of link to prevent accidental navigation.
- **README** — Reordered screenshots to follow first-time user flow, added post-install next-steps.

### Fixed
- **Message duplicates** — `mergeFinalMessages` now scans recent 30 messages for matching assistant messages, preventing duplicates when `chat_final` arrives after user sends a new message.
- **Stream ghost content** — `lastStreamHtmlRef` cleared when `isGenerating` transitions, preventing old response text from bleeding into new streams.
- **Empty `chat_final` recovery** — No longer triggers `triggerRecovery('unrenderable-final')` on empty finals (was causing double history reload and viewport desync).

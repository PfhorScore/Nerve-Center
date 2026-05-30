# Backend Adapter — Concept

Make Nerve Center backend-agnostic by defining a common interface that any agent runtime can implement.

## Target Backends

| Runtime | Status |
|---|---|
| OpenClaw | ✅ Native (current) |
| Hermes Agent | 🔜 Planned |
| Others | TBD |

## Adapter Interface

Every backend adapter implements this contract. The UI never imports backend-specific types directly.

```typescript
interface AgentRuntimeAdapter {
  // Connection
  health(): Promise<HealthStatus>
  status(): Promise<RuntimeStatus>

  // Chat
  sendMessage(sessionId: string, message: string): AsyncIterable<StreamChunk>
  listSessions(): Promise<Session[]>
  getSession(id: string): Promise<SessionDetail>

  // Models
  listModels(): Promise<Model[]>

  // Files
  listFiles(path: string): Promise<FileEntry[]>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>

  // Memory
  searchMemory(query: string): Promise<MemoryEntry[]>

  // Tasks
  listTasks(): Promise<Task[]>
  createTask(task: TaskInput): Promise<Task>

  // Runtime Events
  subscribeEvents(callbacks: EventCallbacks): Subscription
}
```

## Architecture

```
┌──────────────────────────────┐
│     Nerve Center UI          │  ← Panels, Research, Chat, etc.
│   (React components)         │     Never imports backend types
└──────────┬───────────────────┘
           │
┌──────────▼───────────────────┐
│   lib/backend/contracts.ts   │  ← Common types (Session, Model,
│                              │     StreamChunk, FileEntry, etc.)
└──────────┬───────────────────┘
           │
     ┌─────┴──────┐
     │            │
┌────▼────┐ ┌────▼────┐
│OpenClaw │ │ Hermes  │  ← One adapter per backend
│Adapter  │ │ Adapter │
└─────────┘ └─────────┘
```

## OpenClaw Adapter

Thin wrapper around existing `gatewayUrls.ts` + `GatewayContext`. Maps OpenClaw API calls to the common interface. Exists already in spirit — just needs extraction.

## Hermes Adapter (Future)

Would wrap Hermes' HTTP API (or CLI) to match the same interface. Exact surface depends on what Hermes exposes — needs investigation.

## Migration Path

1. Define `lib/backend/contracts.ts` with common types
2. Create `lib/backend/adapters/openclaw.ts` — extract existing OpenClaw calls behind the interface
3. Swap UI imports from `lib/openclaw/...` to `lib/backend/...`
4. Ship as-is (OpenClaw-only), no behavior change
5. Add Hermes adapter later without touching UI code

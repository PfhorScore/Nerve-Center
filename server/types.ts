/**
 * Shared types for the Nerve Center server.
 *
 * Centralised type definitions used across routes, services, and lib modules.
 * @module
 */

/** A single entry in the in-memory TTS audio cache. */
export interface TtsCacheEntry {
  /** Raw audio buffer (typically MP3). */
  buf: Buffer;
  /** Epoch ms when the entry was first cached. */
  createdAt: number;
  /** Epoch ms of the most recent cache hit (used for LRU eviction). */
  lastAccess: number;
}

/** A single entry in the agent activity log (persisted to agent-log.json). */
export interface AgentLogEntry {
  /** Epoch ms timestamp of the log entry. */
  ts: number;
  /** Arbitrary additional fields. */
  [key: string]: unknown;
}

/**
 * Parsed memory item returned by GET /api/memories.
 *
 * - `section` — a `## Heading` from MEMORY.md
 * - `item`    — a bullet point under a section in MEMORY.md
 * - `daily`   — a `## Heading` from a daily file (memory/YYYY-MM-DD.md)
 */
export interface MemoryItem {
  /** Discriminator for the memory source. */
  type: 'section' | 'item' | 'daily';
  /** The text content (section title or bullet text, markdown stripped). */
  text: string;
  /** Date string (YYYY-MM-DD) — present only for `daily` items. */
  date?: string;
}

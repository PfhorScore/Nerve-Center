export interface Citation {
  title: string;
  url: string;
  snippet?: string;
}

export interface SearchResult {
  query: string;
  answer: string;
  citations: Citation[];
  provider: 'perplexity' | 'vane';
  timestamp?: number;
  context?: Array<{ role: string; content: string }>;
  images?: Array<{ url: string; title?: string }>;
}

/** A single research thread containing a title and ordered list of Q&A entries. */
export interface ResearchThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  entries: SearchResult[];
}

export const THREADS_KEY = 'nerve:research-threads';
export const ACTIVE_KEY = 'nerve:research-active';
export const MAX_THREADS = 50;

/** Load all saved threads from localStorage. */
export function loadThreads(): ResearchThread[] {
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Persist threads array to localStorage, capped to MAX_THREADS. */
export function saveThreads(threads: ResearchThread[]) {
  try {
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads.slice(0, MAX_THREADS)));
  } catch {
    // localStorage may be unavailable or quota-limited; keep UI state in memory.
  }
}

/** Read the last-active thread ID from localStorage. */
export function loadActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

/** Save the active thread ID so it persists across sessions. */
export function saveActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // localStorage may be unavailable; active ID will reset next mount.
  }
}

/** Generate a short unique ID for new threads. */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

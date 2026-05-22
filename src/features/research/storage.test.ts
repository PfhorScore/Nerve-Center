import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_KEY, MAX_THREADS, THREADS_KEY, generateId, loadActiveId, loadThreads, saveActiveId, saveThreads } from './storage';

const thread = {
  id: 'thread-1',
  title: 'Thread One',
  createdAt: 1,
  updatedAt: 2,
  entries: [],
};

describe('research storage helpers', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('loads an empty list when no threads are saved', () => {
    expect(loadThreads()).toEqual([]);
  });

  it('saves and loads threads from localStorage', () => {
    saveThreads([thread]);
    expect(JSON.parse(localStorage.getItem(THREADS_KEY) || '[]')).toEqual([thread]);
    expect(loadThreads()).toEqual([thread]);
  });

  it('caps persisted threads', () => {
    const threads = Array.from({ length: MAX_THREADS + 5 }, (_, index) => ({
      ...thread,
      id: `thread-${index}`,
    }));
    saveThreads(threads);
    expect(loadThreads()).toHaveLength(MAX_THREADS);
  });

  it('returns an empty thread list when saved JSON is invalid', () => {
    localStorage.setItem(THREADS_KEY, 'not-json');
    expect(loadThreads()).toEqual([]);
  });

  it('saves and clears the active thread id', () => {
    saveActiveId('thread-1');
    expect(loadActiveId()).toBe('thread-1');
    expect(localStorage.getItem(ACTIVE_KEY)).toBe('thread-1');

    saveActiveId(null);
    expect(loadActiveId()).toBeNull();
  });

  it('generates non-empty ids', () => {
    expect(generateId()).toEqual(expect.any(String));
    expect(generateId().length).toBeGreaterThan(6);
  });
});

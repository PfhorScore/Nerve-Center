import { describe, expect, it } from 'vitest';
import { researchThreadToJson, researchThreadToMarkdown, safeResearchFilename } from './export';

const thread = {
  id: 'thread-1',
  title: 'Formal Methods / Research?',
  createdAt: Date.UTC(2026, 4, 21, 20, 30),
  updatedAt: Date.UTC(2026, 4, 21, 20, 35),
  entries: [
    {
      query: 'What is new in autoformalization?',
      answer: 'A concise answer with citations [1].',
      citations: [{ title: 'Autoformalization Survey', url: 'https://example.com/survey' }],
      provider: 'perplexity' as const,
    },
  ],
};

describe('research export helpers', () => {
  it('builds safe filenames with a useful fallback', () => {
    expect(safeResearchFilename(thread.title, 'md')).toBe('research-Formal-Methods-Research.md');
    expect(safeResearchFilename('!!!', 'json')).toBe('research-thread.json');
  });

  it('serializes a thread as markdown with sources', () => {
    expect(researchThreadToMarkdown(thread)).toContain('# Formal Methods / Research?');
    expect(researchThreadToMarkdown(thread)).toContain('## Q: What is new in autoformalization?');
    expect(researchThreadToMarkdown(thread)).toContain('1. [Autoformalization Survey](https://example.com/survey)');
  });

  it('serializes a thread as formatted JSON', () => {
    expect(JSON.parse(researchThreadToJson(thread))).toEqual(thread);
    expect(researchThreadToJson(thread)).toContain('\n  "title": "Formal Methods / Research?",\n');
  });
});

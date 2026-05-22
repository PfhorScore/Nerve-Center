import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const fsMock = vi.hoisted(() => ({
  readFileSync: vi.fn(),
}));

const gatewayMock = vi.hoisted(() => ({
  invokeGatewayTool: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const mock = { ...actual, readFileSync: fsMock.readFileSync };
  return { ...mock, default: mock };
});

vi.mock('../lib/gateway-client.js', () => ({
  invokeGatewayTool: gatewayMock.invokeGatewayTool,
}));

vi.mock('../middleware/rate-limit.js', () => ({
  rateLimitGeneral: vi.fn((_c: unknown, next: () => Promise<void>) => next()),
}));

import researchRoutes from './research.js';

function buildApp() {
  const app = new Hono();
  app.route('/', researchRoutes);
  return app;
}

function setOpenClawConfig(config: Record<string, unknown>) {
  fsMock.readFileSync.mockReturnValue(JSON.stringify(config));
}

describe('research routes', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    process.env.HOME = '/tmp/nerve-test-home';
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('POST /api/research/search', () => {
    it('rejects an empty query', async () => {
      const app = buildApp();

      const res = await app.request('/api/research/search', {
        method: 'POST',
        body: JSON.stringify({ query: '   ' }),
        headers: { 'content-type': 'application/json' },
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, error: 'Query is required' });
    });

    it('uses gateway web_search when Perplexity is not configured', async () => {
      setOpenClawConfig({ search: { provider: 'duckduckgo' } });
      gatewayMock.invokeGatewayTool.mockResolvedValue({
        details: {
          results: [
            {
              title: '<<<EXTERNAL_UNTRUSTED_CONTENT>>>Result One<<<END_EXTERNAL_UNTRUSTED_CONTENT>>>',
              url: 'https://example.com/one',
              description: 'Source: Web Search\n---\n<p>First result</p>',
            },
          ],
        },
      });

      const app = buildApp();
      const res = await app.request('/api/research/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'openclaw research', mode: 'quick' }),
        headers: { 'content-type': 'application/json' },
      });

      expect(res.status).toBe(200);
      expect(gatewayMock.invokeGatewayTool).toHaveBeenCalledWith('web_search', { query: 'openclaw research' });
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.provider).toBe('duckduckgo');
      expect(json.data.answer).toContain('[1] Result One: First result');
      expect(json.data.citations).toEqual([
        { title: 'Result One', url: 'https://example.com/one', snippet: '<p>First result</p>' },
      ]);
    });

    it('selects Perplexity model by search mode and deduplicates citations', async () => {
      setOpenClawConfig({
        tools: { web: { search: { provider: 'perplexity' } } },
        plugins: { entries: { perplexity: { config: { webSearch: { apiKey: 'pplx-test' } } } } },
      });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          citations: ['https://example.com/one', 'https://example.com/one', 'https://example.com/two'],
          search_results: [
            { title: 'One', url: 'https://example.com/one', content: 'First source' },
            { title: 'Duplicate One', url: 'https://example.com/one', content: 'Duplicate' },
            { title: 'Two', url: 'https://example.com/two', content: 'Second source' },
          ],
          choices: [{ message: { content: 'Answer [1] [2]' } }],
        }),
      } as Response);

      const app = buildApp();
      const res = await app.request('/api/research/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'deep topic',
          mode: 'deep',
          context: [{ role: 'user', content: 'previous question' }],
        }),
        headers: { 'content-type': 'application/json' },
      });

      expect(res.status).toBe(200);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, request] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(String((request as RequestInit).body));
      expect(body.model).toBe('sonar-pro');
      expect(body.max_tokens).toBe(16384);

      const json = await res.json();
      expect(json.data.provider).toBe('perplexity');
      expect(json.data.citations).toEqual([
        { title: 'One', url: 'https://example.com/one', snippet: 'First source' },
        { title: 'Two', url: 'https://example.com/two', snippet: 'Second source' },
      ]);
      expect(json.data.context.map((m: { content: string }) => m.content)).toEqual([
        'previous question',
        'deep topic',
        'Answer [1] [2]',
      ]);
    });

    it('returns a 500 when Perplexity responds with an error', async () => {
      setOpenClawConfig({
        web: { search: { provider: 'perplexity' } },
        plugins: { entries: { perplexity: { config: { webSearch: { apiKey: 'pplx-test' } } } } },
      });
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 } as Response);

      const app = buildApp();
      const res = await app.request('/api/research/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'rate limited', mode: 'quick', context: [{ role: 'user', content: 'existing' }] }),
        headers: { 'content-type': 'application/json' },
      });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ ok: false, error: 'Perplexity API returned 429' });
    });
  });
});

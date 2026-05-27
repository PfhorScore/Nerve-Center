/**
 * Research API Routes
 *
 * POST /api/research/search  — Runs a web search via the gateway and returns cited results.
 * POST /api/research/brief   — Generates a research brief from a chat transcript.
 *
 * Supports both Perplexity (via gateway) and local/Vane modes.
 */

import { Hono } from 'hono';
import { invokeGatewayTool } from '../lib/gateway-client.js';
import { rateLimitGeneral } from '../middleware/rate-limit.js';

const app = new Hono();

interface SearchResult {
  query: string;
  answer: string;
  citations: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
  provider: 'perplexity' | 'vane';
}

/**
 * POST /api/research/search
 *
 * Runs a web search using the configured provider.
 * Accepts `mode: 'quick' | 'deep'` to switch between sonar and sonar-pro.
 */
app.post('/api/research/search', rateLimitGeneral, async (c) => {
  const body: { query?: string; mode?: string; context?: Array<{ role: string; content: string }> } = await c.req.json().catch(() => ({}));
  const query = body.query?.trim();
  const mode = body.mode === 'deep' ? 'deep' : 'quick';
  const prevContext = Array.isArray(body.context) ? body.context.slice(-10) : [];
  if (!query) {
    return c.json({ ok: false, error: 'Query is required' }, 400);
  }

  try {
    const { readFileSync } = await import('node:fs');
    const cfgPath = process.env.HOME + '/.openclaw/openclaw.json';
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));

    // Auto-detect search provider from OpenClaw config
    const searchProvider = cfg?.tools?.web?.search?.provider || cfg?.web?.search?.provider || cfg?.search?.provider || '';
    const pplxKey = cfg?.plugins?.entries?.perplexity?.config?.webSearch?.apiKey || '';
    const hasPerplexity = searchProvider === 'perplexity' && !!pplxKey;
    const isQuick = mode === 'quick';

    if (!hasPerplexity) {
      // Generic fallback path: search via the gateway's web_search tool.
      // This works with any OpenClaw-compatible search provider (not just Perplexity).
      // Returns raw search snippets rather than an LLM-synthesized answer.
      const raw = await invokeGatewayTool('web_search', { query }) as Record<string, unknown>;
      const details = (raw as Record<string, unknown>).details as Record<string, unknown> | undefined;
      let resultsList: Array<{ title: string; url: string; description?: string }> = [];
      if (details?.results && Array.isArray(details.results)) {
        resultsList = details.results as Array<{ title: string; url: string; description?: string }>;
      }
      // Strip the safety wrapping that gateway adds to untrusted external content
      const strip = (s: string) => s.replace(/<<<EXTERNAL_UNTRUSTED_CONTENT[^>]*>>>/g, '').replace(/<<<END_EXTERNAL_UNTRUSTED_CONTENT[^>]*>>>/g, '').replace(/Source: Web Search\n---\n/, '').trim();
      const answer = resultsList.slice(0, 5).map((r, i) => `[${i+1}] ${strip(r.title)}: ${strip((r.description || '').replace(/<[^>]*>/g, '')).slice(0, 300)}`).join('\n\n') || 'No results.';
      return c.json({
        ok: true,
        data: {
          query,
          answer,
          citations: resultsList.map(r => ({ title: strip(r.title || ''), url: r.url || '', snippet: strip((r.description || '').slice(0, 300)) })),
          provider: searchProvider || 'gateway',
          context: [...prevContext, { role: 'user', content: query }, { role: 'assistant', content: answer }],
        },
      });
    }

    // Perplexity path
    const systemPrompt = isQuick
      ? `You are a research assistant inside Nerve UI. Provide concise, accurate answers with citations.

Answer structure:
- Start with a direct 1-2 sentence answer.
- Use short sections with markdown headers if the topic needs structure.
- Use bullet lists for steps or options.

Citations:
- Use numbered citations like [1], [2], etc., matching the sources you reference.
- Each claim should have at least one citation.

Tone: Direct, calm, matter-of-fact. Avoid hype and filler.`
      : `You are a research assistant inside Nerve UI. Produce comprehensive, in-depth research reports.

Structure:
- Start with a brief executive summary of the key finding.
- Then write a thorough, multi-section report using ## and ### headers.
- Each section should fully explore its subtopic — don't rush.
- Use bullet lists, tables, and comparisons to organize information.
- Write as much as needed to cover the topic thoroughly.

Citations:
- Use numbered citations like [1], [2], etc. throughout.
- Every factual claim needs a citation.
- Cite multiple independent sources for important claims.
- When sources disagree, explain the disagreement and which view is better supported.

Tone:
- Direct, informative, and thorough. No marketing language or filler.
- Be honest about uncertainty and gaps in information.
- Focus on practical understanding and key trade-offs.

Follow-up suggestions:
- End with 2-4 follow-up questions under a "Next questions" bullet list.`;

    const model = mode === 'deep' ? 'sonar-pro' : 'sonar';
    const maxTokens = mode === 'deep' ? 16384 : isQuick ? 2048 : 4096;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pplxKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...prevContext.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: query }
        ],
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API returned ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const choices = data?.choices as Array<Record<string, unknown>> | undefined;
    const message = choices?.[0]?.message as Record<string, string> | undefined;
    const fullAnswer = message?.content?.trim() || 'No answer generated.';

    // Perplexity returns citations as URL strings; search_results has details
    const citationUrls = (data?.citations as string[] | undefined) || [];
    const searchResults = (data?.search_results as Array<{ title?: string; url?: string; content?: string }> | undefined) || [];

    // Extract images from Perplexity response
    const images = (data?.images as Array<{ url?: string; title?: string; description?: string }> | undefined) || [];
    // Also check search_results for image URLs
    const resultImages = searchResults
      .filter((r) => (r as Record<string, unknown>).image)
      .slice(0, 10)
      .map((r) => ({
        url: (r as Record<string, unknown>).image as string,
        title: r.title || '',
      }));
    const allImages = [...images, ...resultImages].filter((img) => img.url).slice(0, 12);

    // Build citations from search_results, deduplicated by URL
    const seen = new Set<string>();
    const citations = citationUrls
      .map((url, i) => {
        const exact = searchResults.find((r) => r.url === url);
        const result = exact || searchResults[i] || {};
        const normUrl = url || result.url || '';
        return {
          title: result.title || normUrl.replace(/^https?:\/\//, '').slice(0, 60),
          url: normUrl,
          snippet: (result.content || '').slice(0, 300),
        };
      })
      .filter((c) => {
        if (!c.url) return false;
        if (seen.has(c.url)) return false;
        seen.add(c.url);
        return true;
      });

    // Generate AI title on first query (no previous context = first message)
    let aiTitle: string | null = null;
    if (prevContext.length === 0) {
      try {
        const titleResp = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${pplxKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              { role: 'system', content: 'Generate a concise, descriptive title (3-6 words) capturing the core topic of this research query. Be specific. Output ONLY the title, no quotes.' },
              { role: 'user', content: query }
            ],
            max_tokens: 20,
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (titleResp.ok) {
          const titleData = await titleResp.json() as Record<string, unknown>;
          const choices = titleData?.choices as Array<Record<string, unknown>> | undefined;
          const title = (choices?.[0]?.message as Record<string, string> | undefined)?.content?.trim().replace(/^["']|["']$/g, '');
          if (title && title.length > 2 && title.length < 80) aiTitle = title;
        }
      } catch {}
    }

    // Build updated context for follow-up queries
    const updatedContext = [
      ...prevContext,
      { role: 'user' as const, content: query },
      { role: 'assistant' as const, content: fullAnswer },
    ];

    return c.json({
      ok: true,
      data: { query, answer: fullAnswer, citations, provider: 'perplexity', context: updatedContext, images: allImages, aiTitle },
    });
  } catch (err) {
    console.warn('[research] search error:', (err as Error).message);
    return c.json({ ok: false, error: (err as Error).message }, 500);
  }
});

/**
 * POST /api/research/brief
 *
 * Takes a chat transcript and generates a focused research question.
 */
app.post('/api/research/brief', rateLimitGeneral, async (c) => {
  const body: { transcript?: string; topic?: string } = await c.req.json().catch(() => ({}));
  const transcript = body.transcript?.trim();

  if (!transcript) {
    return c.json({ ok: false, error: 'Transcript is required' }, 400);
  }

  // Parse transcript into labeled messages
  const allLines = transcript.split('\n');

  const isFiller = (text: string) => {
    const t = text.trim();
    if (t.length < 12) return true;
    if (/^[\s!.,?👍✅❌🎉😄😂💀👀🔥✨🫡]+$/.test(t)) return true;
    if (/^(ok|okay|k|kk|yes|yep|yeah|no|nope|nah|sure|gotcha|bet|nice|cool|dope|lol|lmao|thanks|ty|good|great|awesome|sounds good|hell yeah|fair enough|for sure|no worries|will do|on it)[!.,\s]*$/i.test(t)) return true;
    return false;
  };

  const userMsgs: string[] = [];
  const assistantMsgs: string[] = [];
  let currentSpeaker = '';
  let currentMsg = '';

  for (const line of allLines) {
    if (line.startsWith('User:')) {
      if (currentSpeaker && currentMsg.trim()) {
        if (currentSpeaker === 'User') userMsgs.push(currentMsg.trim());
        else assistantMsgs.push(currentMsg.trim());
      }
      currentSpeaker = 'User';
      currentMsg = line.replace(/^User:\s*/, '');
    } else if (line.startsWith('Assistant:')) {
      if (currentSpeaker && currentMsg.trim()) {
        if (currentSpeaker === 'User') userMsgs.push(currentMsg.trim());
        else assistantMsgs.push(currentMsg.trim());
      }
      currentSpeaker = 'Assistant';
      currentMsg = line.replace(/^Assistant:\s*/, '');
    } else if (currentSpeaker) {
      currentMsg += ' ' + line;
    }
  }
  if (currentSpeaker && currentMsg.trim()) {
    if (currentSpeaker === 'User') userMsgs.push(currentMsg.trim());
    else assistantMsgs.push(currentMsg.trim());
  }

  const cleanUser = userMsgs.filter(m => !isFiller(m));
  const cleanAssistant = assistantMsgs.filter(m => !isFiller(m));

  const userQuestions = cleanUser.filter(m => m.includes('?'));
  const userOther = cleanUser.filter(m => !m.includes('?'));
  const priority = [...userQuestions, ...userOther];

  const topUser = priority.slice(-5);
  const topAssistant = cleanAssistant.slice(-3);
  const lastMessages = [...topUser, ...topAssistant].slice(-7).join('\n\n');

  // Use Perplexity sonar-pro for brief generation
  try {
    const { readFileSync } = await import('node:fs');
    const cfgPath = process.env.HOME + '/.openclaw/openclaw.json';
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    const pplxKey = cfg?.plugins?.entries?.perplexity?.config?.webSearch?.apiKey || '';

    if (pplxKey) {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pplxKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [
            {
              role: 'system',
              content: 'Generate ONE focused, detailed research question from the conversation below. Include relevant names, technologies, and context. Output ONLY the research question.'
            },
            {
              role: 'user',
              content: `Generate a research question from:\n\n${lastMessages.slice(0, 4000)}`
            }
          ],
          max_tokens: 200,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = await response.json() as Record<string, unknown>;
        const choices = data?.choices as Array<Record<string, unknown>> | undefined;
        const brief = (choices?.[0]?.message as Record<string, string> | undefined)?.content?.trim();
        if (brief && brief.length > 5) {
          return c.json({ ok: true, data: { brief: brief.slice(0, 500), topic: 'chat-conversation' } });
        }
      }
    }
  } catch (err) {
    console.warn('[research] brief API call failed:', (err as Error).message);
  }

  const lastTopic = userMsgs.filter(m => !isFiller(m)).slice(-1)[0] || '';
  const fallback = lastTopic.endsWith('?') ? lastTopic : `Tell me more about ${lastTopic.slice(0, 200)}`;
  return c.json({
    ok: true,
    data: {
      brief: fallback.slice(0, 500),
      topic: 'chat-conversation',
    },
  });
});

/**
 * POST /api/research/title
 *
 * Generates a short AI title for a research thread based on the first query.
 */
app.post('/api/research/title', rateLimitGeneral, async (c) => {
  const body: { query?: string } = await c.req.json().catch(() => ({}));
  const query = body.query?.trim();
  if (!query) {
    return c.json({ ok: false, error: 'Query is required' }, 400);
  }

  try {
    const { readFileSync } = await import('node:fs');
    const cfgPath = process.env.HOME + '/.openclaw/openclaw.json';
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    const pplxKey = cfg?.plugins?.entries?.perplexity?.config?.webSearch?.apiKey || '';

    if (pplxKey) {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pplxKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: 'Generate a concise, descriptive title (3-6 words) that captures the core topic of this research query. Be specific — include key names, technologies, or concepts. Output ONLY the title, no quotes, no markdown, no punctuation at the end.'
            },
            { role: 'user', content: query }
          ],
          max_tokens: 20,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json() as Record<string, unknown>;
        const choices = data?.choices as Array<Record<string, unknown>> | undefined;
        const title = (choices?.[0]?.message as Record<string, string> | undefined)?.content?.trim().replace(/^["']|["']$/g, '');
        if (title && title.length > 2 && title.length < 80) {
          return c.json({ ok: true, data: { title } });
        }
      }
    }
  } catch {}

  // Fallback: just use the first few words of the query
  const fallback = query.replace(/^[\s!.,?]+/, '').slice(0, 60).replace(/:$/, '');
  return c.json({ ok: true, data: { title: fallback } });
});

/**
 * POST /api/research/split-thread
 *
 * Takes a thread's entries and uses AI to group them by topic.
 * Returns an array of suggested groupings (arrays of entry indices).
 */
app.post('/api/research/split-thread', rateLimitGeneral, async (c) => {
  const body: { entries?: Array<{ query: string; answer: string }> } = await c.req.json().catch(() => ({}));
  const entries = body.entries || [];
  if (entries.length < 2) {
    return c.json({ ok: false, error: 'Need at least 2 entries to split' }, 400);
  }

  const conversationText = entries.map((e, i) => `[${i}] Q: ${e.query}\nA: ${(e.answer || '').slice(0, 300)}`).join('\n\n');

  try {
    const { readFileSync } = await import('node:fs');
    const cfgPath = process.env.HOME + '/.openclaw/openclaw.json';
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    const pplxKey = cfg?.plugins?.entries?.perplexity?.config?.webSearch?.apiKey || '';

    if (pplxKey) {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${pplxKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: `You are a conversation analyzer. Group the following conversation entries by topic.\n\nFor each entry [0], [1], [2], etc., decide which topic group it belongs to.\n\nReturn ONLY a JSON array of arrays, like [[0,1],[2,3]] meaning entries 0-1 are one topic, 2-3 are another.\nEach entry must appear in exactly one group. Groups must preserve the original order.\nDo not output anything other than the JSON array.`
            },
            { role: 'user', content: conversationText }
          ],
          max_tokens: 500,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = await response.json() as Record<string, unknown>;
        const choices = data?.choices as Array<Record<string, unknown>> | undefined;
        const content = (choices?.[0]?.message as Record<string, string> | undefined)?.content?.trim() || '';
        const jsonMatch = content.match(/\[(\[\d+(?:,\s*\d+)*\](?:,\s*\[\d+(?:,\s*\d+)*\])*)\]/);
        if (jsonMatch) {
          const groups = JSON.parse(`[${jsonMatch[1]}]`) as number[][];
          if (Array.isArray(groups) && groups.length > 0) {
            return c.json({ ok: true, data: { groups } });
          }
        }
      }
    }
  } catch {}

  // Fallback:  split at the midpoint
  return c.json({ ok: true, data: { groups: [[0], entries.slice(1).map((_, i) => i + 1)] } });
});

/**
 * POST /api/research/images
 *
 * Fetches image results from DuckDuckGo for a given query.
 */
app.post('/api/research/images', rateLimitGeneral, async (c) => {
  const body: { query?: string } = await c.req.json().catch(() => ({}));
  const query = body.query?.trim();
  if (!query) {
    return c.json({ ok: false, error: 'Query is required' }, 400);
  }

  const images: Array<{ url: string; title: string }> = [];

  // Fetch images from Wikipedia (free, reliable, no key)
  try {
    const wikiResp = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=12&gsrsearch=${encodeURIComponent(query)}&prop=pageimages&pithumbsize=300`,
      { headers: { 'User-Agent': 'NerveCenter/1.0 (research; https://github.com/PfhorScore/Nerve-Center)' }, signal: AbortSignal.timeout(6000) }
    );
    if (wikiResp.ok) {
      const wikiData = await wikiResp.json() as Record<string, unknown>;
      const pages = (wikiData?.query as Record<string, unknown> | undefined)?.pages as Record<string, { title?: string; thumbnail?: { source?: string } }> | undefined;
      if (pages) {
        for (const page of Object.values(pages)) {
          if (page.thumbnail?.source && images.length < 12) {
            images.push({ url: page.thumbnail.source, title: page.title || '' });
          }
        }
      }
    }
  } catch {}

  return c.json({ ok: true, data: { images } });
});

// ── Streaming search ────────────────────────────────────────────────

/**
 * GET /api/research/search/stream
 * Streams research answer tokens from Perplexity.
 * Query: q=...&mode=quick|deep
 */
app.get('/api/research/search/stream', rateLimitGeneral, async (c) => {
  const query = c.req.query('q')?.trim();
  const mode = c.req.query('mode') === 'deep' ? 'deep' : 'quick';
  if (!query) return c.json({ ok: false, error: 'Query required' }, 400);

  try {
    const { readFileSync } = await import('node:fs');
    const cfgPath = process.env.HOME + '/.openclaw/openclaw.json';
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    const pplxKey = cfg?.plugins?.entries?.perplexity?.config?.webSearch?.apiKey || '';
    if (!pplxKey) return c.json({ ok: false, error: 'No Perplexity key' }, 400);

    const isQuick = mode === 'quick';
    const model = mode === 'deep' ? 'sonar-pro' : 'sonar';
    const sysP = isQuick
      ? 'You are a research assistant. Provide concise answers with citations [1], [2].'
      : 'You are a research assistant. Write thorough research reports with citations [1], [2]. Use ## headers, bullet lists. Write as much as needed.';

    const pplx = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + pplxKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: sysP }, { role: 'user', content: query }],
        max_tokens: isQuick ? 2048 : 16384,
        stream: true,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!pplx.ok) return c.json({ ok: false, error: 'Perplexity ' + pplx.status }, 502);

    // Stream Perplexity's SSE response back to the client token-by-token
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    const reader = pplx.body?.getReader();
    if (!reader) return c.json({ ok: false, error: 'No reader' }, 500);

    const dec = new TextDecoder();
    let buf = '';

    const stream = new ReadableStream({
      async pull(ctl) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { ctl.close(); break; }
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const d = line.slice(6).trim();
            if (d === '[DONE]') { ctl.close(); return; }
            try {
              const j = JSON.parse(d);
              const t = j?.choices?.[0]?.delta?.content || '';
              if (t) ctl.enqueue(new TextEncoder().encode(t));
            } catch {}
          }
        }
      },
    });

    return new Response(stream);
  } catch (err) {
    console.warn('[research] stream err:', (err as Error).message);
    return c.json({ ok: false, error: (err as Error).message }, 500);
  }
});

export default app;

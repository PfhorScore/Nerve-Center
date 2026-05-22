import { readFileSync } from 'node:fs';
import { invokeGatewayTool } from '../lib/gateway-client.js';

interface SearchContextMessage {
  role: string;
  content: string;
}

interface ResearchCitation {
  title: string;
  url: string;
  snippet?: string;
}

interface ResearchImage {
  url: string;
  title?: string;
}

interface ResearchSearchOptions {
  query: string;
  mode: 'quick' | 'deep';
  context: SearchContextMessage[];
}

interface ResearchSearchResult {
  query: string;
  answer: string;
  citations: ResearchCitation[];
  provider: string;
  context: SearchContextMessage[];
  images?: ResearchImage[];
  aiTitle?: string | null;
}

interface OpenClawSearchConfig {
  provider: string;
  perplexityApiKey: string;
}

export async function runResearchSearch(options: ResearchSearchOptions): Promise<ResearchSearchResult> {
  const config = readOpenClawSearchConfig();
  if (!hasPerplexity(config)) {
    return runGatewaySearch(options, config.provider);
  }
  return runPerplexitySearch(options, config.perplexityApiKey);
}

function readOpenClawSearchConfig(): OpenClawSearchConfig {
  const cfgPath = `${process.env.HOME}/.openclaw/openclaw.json`;
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  return {
    provider: cfg?.tools?.web?.search?.provider || cfg?.web?.search?.provider || cfg?.search?.provider || '',
    perplexityApiKey: cfg?.plugins?.entries?.perplexity?.config?.webSearch?.apiKey || '',
  };
}

function hasPerplexity(config: OpenClawSearchConfig): boolean {
  return config.provider === 'perplexity' && Boolean(config.perplexityApiKey);
}

async function runGatewaySearch(
  { query, context }: ResearchSearchOptions,
  provider: string,
): Promise<ResearchSearchResult> {
  const raw = await invokeGatewayTool('web_search', { query }) as Record<string, unknown>;
  const details = raw.details as Record<string, unknown> | undefined;
  let resultsList: Array<{ title: string; url: string; description?: string }> = [];
  if (details?.results && Array.isArray(details.results)) {
    resultsList = details.results as Array<{ title: string; url: string; description?: string }>;
  }

  const answer = resultsList
    .slice(0, 5)
    .map((result, index) => {
      const description = stripGatewaySearchWrapping((result.description || '').replace(/<[^>]*>/g, '')).slice(0, 300);
      return `[${index + 1}] ${stripGatewaySearchWrapping(result.title)}: ${description}`;
    })
    .join('\n\n') || 'No results.';

  return {
    query,
    answer,
    citations: resultsList.map((result) => ({
      title: stripGatewaySearchWrapping(result.title || ''),
      url: result.url || '',
      snippet: stripGatewaySearchWrapping((result.description || '').slice(0, 300)),
    })),
    provider: provider || 'gateway',
    context: [...context, { role: 'user', content: query }, { role: 'assistant', content: answer }],
  };
}

function stripGatewaySearchWrapping(value: string): string {
  return value
    .replace(/<<<EXTERNAL_UNTRUSTED_CONTENT[^>]*>>>/g, '')
    .replace(/<<<END_EXTERNAL_UNTRUSTED_CONTENT[^>]*>>>/g, '')
    .replace(/Source: Web Search\n---\n/, '')
    .trim();
}

async function runPerplexitySearch(
  { query, mode, context }: ResearchSearchOptions,
  apiKey: string,
): Promise<ResearchSearchResult> {
  const isQuick = mode === 'quick';
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: mode === 'deep' ? 'sonar-pro' : 'sonar',
      messages: [
        { role: 'system', content: systemPromptForMode(mode) },
        ...context.map((message) => ({ role: message.role, content: message.content })),
        { role: 'user', content: query },
      ],
      max_tokens: mode === 'deep' ? 16384 : isQuick ? 2048 : 4096,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API returned ${response.status}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const choices = data?.choices as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.message as Record<string, string> | undefined;
  const answer = message?.content?.trim() || 'No answer generated.';
  const searchResults = (data?.search_results as Array<{ title?: string; url?: string; content?: string }> | undefined) || [];

  return {
    query,
    answer,
    citations: dedupePerplexityCitations((data?.citations as string[] | undefined) || [], searchResults),
    provider: 'perplexity',
    context: [...context, { role: 'user', content: query }, { role: 'assistant', content: answer }],
    images: extractPerplexityImages(data, searchResults),
    aiTitle: context.length === 0 ? await generatePerplexityTitle(query, apiKey) : null,
  };
}

function dedupePerplexityCitations(
  citationUrls: string[],
  searchResults: Array<{ title?: string; url?: string; content?: string }>,
): ResearchCitation[] {
  const seen = new Set<string>();
  return citationUrls
    .map((url, index) => {
      const exact = searchResults.find((result) => result.url === url);
      const result = exact || searchResults[index] || {};
      const normUrl = url || result.url || '';
      return {
        title: result.title || normUrl.replace(/^https?:\/\//, '').slice(0, 60),
        url: normUrl,
        snippet: (result.content || '').slice(0, 300),
      };
    })
    .filter((citation) => {
      if (!citation.url) return false;
      if (seen.has(citation.url)) return false;
      seen.add(citation.url);
      return true;
    });
}

function extractPerplexityImages(
  data: Record<string, unknown>,
  searchResults: Array<{ title?: string; url?: string; content?: string }>,
): ResearchImage[] {
  const images = (data?.images as Array<{ url?: string; title?: string; description?: string }> | undefined) || [];
  const resultImages = searchResults
    .filter((result) => (result as Record<string, unknown>).image)
    .slice(0, 10)
    .map((result) => ({
      url: (result as Record<string, unknown>).image as string,
      title: result.title || '',
    }));
  return [...images, ...resultImages].filter((image) => image.url).slice(0, 12) as ResearchImage[];
}

async function generatePerplexityTitle(query: string, apiKey: string): Promise<string | null> {
  try {
    const titleResp = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: 'Generate a very short title (3-7 words) summarizing this research query. Output ONLY the title, no quotes.' },
          { role: 'user', content: query },
        ],
        max_tokens: 20,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!titleResp.ok) return null;
    const titleData = await titleResp.json() as Record<string, unknown>;
    const choices = titleData?.choices as Array<Record<string, unknown>> | undefined;
    const title = (choices?.[0]?.message as Record<string, string> | undefined)?.content?.trim().replace(/^["']|["']$/g, '');
    return title && title.length > 2 && title.length < 80 ? title : null;
  } catch {
    return null;
  }
}

function systemPromptForMode(mode: 'quick' | 'deep'): string {
  if (mode === 'quick') {
    return `You are a research assistant inside Nerve UI. Provide concise, accurate answers with citations.

Answer structure:
- Start with a direct 1-2 sentence answer.
- Use short sections with markdown headers if the topic needs structure.
- Use bullet lists for steps or options.

Citations:
- Use numbered citations like [1], [2], etc., matching the sources you reference.
- Each claim should have at least one citation.

Tone: Direct, calm, matter-of-fact. Avoid hype and filler.`;
  }

  return `You are a research assistant inside Nerve UI. Produce comprehensive, in-depth research reports.

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
}

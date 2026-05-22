export interface Citation {
  title: string;
  url: string;
  snippet?: string;
}

/** Extract readable domain from a URL. */
export function domainOnly(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

/** Favicon URL for a citation, using DuckDuckGo for higher-res icons. */
export function faviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  } catch {
    return '';
  }
}

/** Bold the opening sentence for visual impact. */
export function boldLead(text: string): string {
  const match = text.match(/^(.{10,200}?)(?:\.\s|\n|$)/);
  if (match) {
    const lead = match[1].replace(/^\*\*|\*\*$/g, '');
    const rest = text.slice(lead.length);
    return `**${lead}**${rest}`;
  }
  return text;
}

/** Extract unique URLs from markdown links in answer text. */
export function extractLinks(text: string): string[] {
  const urls: string[] = [];
  const regex = /\(https?:\/\/[^)]+\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const url = match[0].slice(1, -1);
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}

/** Parse follow-up questions from answer text, looking for a "Next questions" bullet list. */
export function parseFollowUps(text: string): string[] {
  const lines = text.split('\n');
  let inSection = false;
  const results: string[] = [];
  const headerPattern = /next\s+questions/i;
  for (const line of lines) {
    const trimmed = line.trim();
    if (headerPattern.test(trimmed.replace(/[*#[\]]/g, ''))) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const q = trimmed.replace(/^[-*]\s+/, '').trim();
        if (q.length > 5) results.push(q);
      } else if (trimmed === '' || trimmed.startsWith('#')) {
        break;
      }
    }
  }
  return results;
}

/**
 * Convert valid [N] citation markers in research answers into clickable markdown anchor links.
 *
 * Only markers that point at an existing citation are linked, so incidental bracketed
 * numbers such as "[2024]" or invalid references remain untouched.
 */
export function linkCitations(text: string, citations: Citation[], convIdx?: number): string {
  const prefix = convIdx !== undefined ? `${convIdx + 1}-` : '';
  return text.replace(/\[(\d+)\]/g, (match, num: string) => {
    const idx = Number.parseInt(num, 10) - 1;
    const cite = citations[idx];
    if (!cite) return match;

    const title = cite.title ? cite.title.replace(/"/g, '&quot;').slice(0, 100) : '';
    const displayText = `[${num}]`;
    if (title) return `[${displayText}](#cite-${prefix}${num} "${title}") `;
    return `[${displayText}](#cite-${prefix}${num}) `;
  });
}

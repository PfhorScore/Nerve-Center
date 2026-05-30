/**
 * LibraryPanel — Persistent reference library for Nerve Center.
 *
 * Extracts URLs, links, and images from chat messages and displays them
 * in a clean, Perplexity-style reference list. Deduplicated by URL.
 * Shows favicons and page titles when available.
 *
 * Available as a right-sidebar panel in both chat and research views.
 *
 * @module LibraryPanel
 */

import { useMemo, useState } from 'react';
import { ExternalLink, Image, Link, FileText, Search, X } from 'lucide-react';
import type { ChatMsg } from '@/features/chat/types';

/** Props for {@link LibraryPanel}. */
interface LibraryPanelProps {
  /** Full message history from the current chat session. */
  messages: ChatMsg[];
}

/** A single library entry — URL, image, or research citation. */
interface LibraryEntry {
  /** Unique key for React. */
  id: string;
  /** Entry type. */
  type: 'link' | 'image' | 'citation';
  /** The URL. */
  url: string;
  /** Display title (domain for links, filename for images, citation number). */
  title: string;
  /** Optional thumbnail/preview URL for images. */
  thumbnail?: string;
  /** Optional favicon URL for links. */
  favicon?: string;
  /** When the entry was first seen. */
  timestamp: Date;
}

/**
 * Extract all URLs from a text string.
 */
function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"']+/g;
  const matches = text.match(urlRegex);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Get favicon URL for a domain.
 */
function getFavicon(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  } catch {
    return '';
  }
}

/**
 * Extract a display title from a URL.
 */
function urlTitle(url: string, maxLen = 60): string {
  try {
    const u = new URL(url);
    const domain = u.hostname.replace(/^www\./, '');
    const path = u.pathname.length > 1 ? u.pathname : '';
    const full = domain + path;
    return full.length > maxLen ? full.slice(0, maxLen) + '\u2026' : full;
  } catch {
    return url.slice(0, maxLen);
  }
}

/**
 * Extract all library entries from chat messages.
 */
function extractEntries(messages: ChatMsg[]): LibraryEntry[] {
  const seen = new Set<string>();
  const entries: LibraryEntry[] = [];
  let citationCounter = 0;

  for (const msg of messages) {
    const text = msg.rawText || '';

    // Extract citation-style links from research answers: [N](url)
    const citationRegex = /\[(\d+)\]\(https?:\/\/[^)]+\)/g;
    let citeMatch;
    while ((citeMatch = citationRegex.exec(text)) !== null) {
      const url = citeMatch[0].match(/https?:\/\/[^)]+/)?.[0];
      if (url && !seen.has(url)) {
        seen.add(url);
        citationCounter++;
        entries.push({
          id: `cite-${citationCounter}`,
          type: 'citation',
          url,
          title: urlTitle(url),
          favicon: getFavicon(url),
          timestamp: msg.timestamp,
        });
      }
    }

    // Extract bare URLs
    const urls = extractUrls(text);
    for (const url of urls) {
      if (!seen.has(url)) {
        seen.add(url);
        entries.push({
          id: `link-${entries.length}`,
          type: 'link',
          url,
          title: urlTitle(url),
          favicon: getFavicon(url),
          timestamp: msg.timestamp,
        });
      }
    }

    // Extract images from message image attachments
    if (msg.images) {
      for (const img of msg.images) {
        const url = (img as any).preview || (img as any).url || '';
        if (url && !seen.has(url)) {
          seen.add(url);
          entries.push({
            id: `img-${entries.length}`,
            type: 'image',
            url,
            title: (img as any).name || 'Image',
            thumbnail: url,
            timestamp: msg.timestamp,
          });
        }
      }
    }

    // Extract files from upload attachments (file_reference mode)
    if (msg.uploadAttachments) {
      for (const att of msg.uploadAttachments) {
        if (att.mimeType?.startsWith('image/') && att.name) {
          entries.push({
            id: `upload-${entries.length}`,
            type: 'image',
            url: att.reference?.path || att.name,
            title: att.name,
            timestamp: msg.timestamp,
          });
        }
      }
    }

    // Extract images from extractedImages field
    if (msg.extractedImages) {
      for (const img of msg.extractedImages) {
        if (img.url && !seen.has(img.url)) {
          seen.add(img.url);
          entries.push({
            id: `img-${entries.length}`,
            type: 'image',
            url: img.url,
            title: img.alt || 'Image',
            thumbnail: img.url,
            timestamp: msg.timestamp,
          });
        }
      }
    }
  }

  return entries;
}

/** Tab for filtering entries. */
type TabType = 'all' | 'links' | 'images';

/**
 * LibraryPanel — displays a deduplicated list of references from chat.
 */
export function LibraryPanel({ messages }: LibraryPanelProps) {
  const [tab, setTab] = useState<TabType>('all');
  const [search, setSearch] = useState('');

  const entries = useMemo(() => extractEntries(messages), [messages]);

  const filtered = useMemo(() => {
    let result = entries;
    if (tab === 'links') result = result.filter(e => e.type === 'link' || e.type === 'citation');
    if (tab === 'images') result = result.filter(e => e.type === 'image');
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e => e.title.toLowerCase().includes(q) || e.url.toLowerCase().includes(q));
    }
    return result;
  }, [entries, tab, search]);

  const linkCount = useMemo(() => entries.filter(e => e.type === 'link' || e.type === 'citation').length, [entries]);
  const imageCount = useMemo(() => entries.filter(e => e.type === 'image').length, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <FileText size={20} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-[0.733rem] text-muted-foreground/50">No references yet</p>
          <p className="text-[0.6rem] text-muted-foreground/40 mt-1">Links and images from chat will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-2 py-1 shrink-0 border-b border-border/20">
        <button
          onClick={() => setTab('all')}
          className={`text-[0.6rem] px-2 py-1 rounded-md transition-colors ${tab === 'all' ? 'bg-primary/10 text-primary' : 'text-muted-foreground/60 hover:text-foreground/80'}`}
        >
          All ({entries.length})
        </button>
        <button
          onClick={() => setTab('links')}
          className={`text-[0.6rem] px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${tab === 'links' ? 'bg-primary/10 text-primary' : 'text-muted-foreground/60 hover:text-foreground/80'}`}
        >
          <Link size={10} /> Links ({linkCount})
        </button>
        <button
          onClick={() => setTab('images')}
          className={`text-[0.6rem] px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${tab === 'images' ? 'bg-primary/10 text-primary' : 'text-muted-foreground/60 hover:text-foreground/80'}`}
        >
          <Image size={10} /> Images ({imageCount})
        </button>
      </div>

      {/* Search bar */}
      {search !== '' && (
        <div className="flex items-center gap-1 px-2 py-1 shrink-0 border-b border-border/20">
          <Search size={11} className="text-muted-foreground/40 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter references\u2026"
            className="flex-1 bg-transparent border-none outline-none text-[0.6rem] text-foreground/70 placeholder:text-muted-foreground/30"
            autoFocus
          />
          <button onClick={() => setSearch('')} className="size-4 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground transition-colors">
            <X size={10} />
          </button>
        </div>
      )}

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-4">
            <p className="text-[0.6rem] text-muted-foreground/40">No matching references</p>
          </div>
        ) : (
          filtered.map((entry) => {
            const common = (
              <>
                {/* Icon */}
                <div className="mt-0.5 shrink-0 size-5 flex items-center justify-center rounded bg-muted/30">
                  {entry.type === 'image' ? (
                    <Image size={10} className="text-muted-foreground/50" />
                  ) : entry.type === 'citation' ? (
                    <FileText size={10} className="text-primary/60" />
                  ) : (
                    <Link size={10} className="text-muted-foreground/50" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {entry.favicon && (
                      <img src={entry.favicon} alt="" className="size-3 rounded shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <span className="text-[0.6rem] font-medium text-foreground/80 truncate">{entry.title}</span>
                  </div>
                  <div className="text-[0.533rem] text-muted-foreground/50 truncate mt-0.5">{entry.url}</div>
                </div>

                {/* Thumbnail for images */}
                {entry.thumbnail && (
                  <div className="shrink-0 size-8 rounded overflow-hidden border border-border/30 bg-muted/20">
                    <img src={entry.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}

                <ExternalLink size={10} className="text-muted-foreground/30 group-hover:text-foreground/60 transition-colors shrink-0 mt-1" />
              </>
            );

            // Images open inline via lightbox, links open in new tab
            return entry.type === 'image' ? (
              <button
                key={entry.id}
                onClick={() => window.open(entry.url, '_blank')}
                className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg hover:bg-foreground/[0.03] transition-colors group w-full text-left"
              >
                {common}
              </button>
            ) : (
              <a
                key={entry.id}
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg hover:bg-foreground/[0.03] transition-colors group"
              >
                {common}
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}

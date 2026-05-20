import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { Search, Loader2, MessageSquare, Sparkles, ChevronRight, Copy, Check, Download } from 'lucide-react';

const MarkdownRenderer = lazy(() => import('@/features/markdown/MarkdownRenderer').then(m => ({ default: m.MarkdownRenderer })));

/** Extract readable domain from a URL */
function domainOnly(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch { return url.slice(0, 40); }
}

/** Favicon URL for a citation — uses DuckDuckGo for higher-res icons */
function faviconUrl(url: string, _size = 16): string {
  try {
    const domain = new URL(url).hostname;
    // DuckDuckGo returns the site's actual favicon at native resolution
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  } catch { return ''; }
}

/** Bold the opening sentence for visual impact */
function boldLead(text: string): string {
  // Bold up to the first sentence break (period + space, colon, or newline), max 200 chars
  const match = text.match(/^(.{10,200}?)(?:\.\s|\n|$)/);
  if (match) {
    const lead = match[1].replace(/^\*\*|\*\*$/g, ''); // don't double-bold
    const rest = text.slice(lead.length);
    return `**${lead}**${rest}`;
  }
  return text;
}

/** Extract all URLs from a markdown text */
function extractLinks(text: string): string[] {
  const urls: string[] = [];
  const regex = /\(https?:\/\/[^)]+\)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const url = match[0].slice(1, -1);
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}

/** Parse follow-up questions from answer text (looks for "Next questions" bullet list) */
function parseFollowUps(text: string): string[] {
  const lines = text.split('\n');
  let inSection = false;
  const results: string[] = [];
  const headerPattern = /next\s+questions/i;
  for (const line of lines) {
    const trimmed = line.trim();
    // Match any line that says "Next questions" — heading, bold, plain, with colon
    if (headerPattern.test(trimmed.replace(/[*#\[\]]/g, ''))) {
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

/** Convert [N] citation markers to anchor links with hover tooltips */
function linkCitations(text: string, citations: Citation[], convIdx?: number): string {
  const prefix = convIdx !== undefined ? `${convIdx + 1}-` : '';
  return text.replace(/\[(\d+)\]/g, (_, num) => {
    const idx = parseInt(num) - 1;
    const cite = citations[idx];
    const title = cite?.title ? cite.title.replace(/"/g, '&quot;').slice(0, 100) : '';
    const displayText = `[${num}]`;
    // Add a tiny space after each citation link so they don't clump together
    if (title) return `[${displayText}](#cite-${prefix}${num} "${title}") `;
    return `[${displayText}](#cite-${prefix}${num}) `;
  });
}

interface Citation {
  title: string;
  url: string;
  snippet?: string;
}

interface SearchResult {
  query: string;
  answer: string;
  citations: Citation[];
  provider: 'perplexity' | 'vane';
  timestamp?: number;
  context?: Array<{ role: string; content: string }>;
  images?: Array<{ url: string; title?: string }>;
}

const THREADS_KEY = 'nerve:research-threads';
const ACTIVE_KEY = 'nerve:research-active';
const MAX_THREADS = 50;

interface ResearchThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  entries: SearchResult[];
}

function loadThreads(): ResearchThread[] {
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveThreads(threads: ResearchThread[]) {
  try { localStorage.setItem(THREADS_KEY, JSON.stringify(threads.slice(0, MAX_THREADS))); } catch {}
}

function loadActiveId(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

function saveActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {}
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function ResearchPanel() {
  const [query, setQuery] = useState('');
  const [threads, setThreads] = useState<ResearchThread[]>(() => loadThreads());
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => loadActiveId());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefing] = useState(false);
  const [mode, setMode] = useState<'quick' | 'deep'>('deep');
  const [showSidebar, setShowSidebar] = useState(true);
  const [copied, setCopied] = useState(false);
  const [hoveredThread, setHoveredThread] = useState<string | null>(null);
  const [citeCard, setCiteCard] = useState<{ cite: Citation; top: number; left: number } | null>(null);
  const [placeholder, setPlaceholder] = useState('Ask anything...');
  const [resultTab, setResultTab] = useState<'all' | 'sources' | 'images' | 'links'>('all');
  const [expandedQuery, setExpandedQuery] = useState<number | null>(null);
  const citeHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Derive active thread's entries as the conversation
  const activeThread = threads.find((t) => t.id === activeThreadId) || null;
  const conversation = activeThread?.entries || [];
  const lastResult = conversation.length > 0 ? conversation[conversation.length - 1] : null;

  // Scroll persistence + auto-scroll
  const prevConvoLen = useRef(0);
  const mountedAt = useRef(Date.now());

  // On mount: restore saved scroll, then mark ready for auto-scroll
  useEffect(() => {
    if (!scrollRef.current || !activeThreadId) return;
    const saved = sessionStorage.getItem(`nerve:scroll-${activeThreadId}`);
    if (saved) {
      const pos = parseInt(saved, 10);
      if (!isNaN(pos) && pos > 0) {
        scrollRef.current.scrollTop = pos;
      }
    }
    // Ready for auto-scroll after a short delay
    const timer = setTimeout(() => { mountedAt.current = 0; }, 100);
    return () => clearTimeout(timer);
  }, [activeThreadId]);

  // Rotating placeholder text
  useEffect(() => {
    const texts = [
      'Ask anything...',
      'Compare two tools...',
      'Explain a concept...',
      'Plan a migration...',
      'Summarize a topic...',
      'Research a question...',
    ];
    let i = 1;
    const interval = setInterval(() => {
      setPlaceholder(texts[i % texts.length]);
      i++;
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Save scroll to sessionStorage on every scroll (passive, no debounce)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !activeThreadId) return;
    const save = () => {
      try { sessionStorage.setItem(`nerve:scroll-${activeThreadId}`, String(el.scrollTop)); } catch {}
    };
    el.addEventListener('scroll', save, { passive: true });
    return () => el.removeEventListener('scroll', save);
  }, [activeThreadId]);

  // Hover card for citation links [1] [2] in answer text
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const showCard = (e: MouseEvent) => {
      let target = e.target as HTMLElement | null;
      while (target && target.tagName !== 'A') target = target.parentElement;
      if (!target) return;
      // Check href for inline citations (#cite-N-M) or id for source pills (cite-N-M)
      const a = target as HTMLAnchorElement;
      let match = a.getAttribute('href')?.match(/^#cite-(\d+)-(\d+)$/) || null;
      let convIdx: number, citeIdx: number;
      if (match) {
        convIdx = parseInt(match[1]) - 1;
        citeIdx = parseInt(match[2]) - 1;
      } else {
        // Try to match element id pattern cité-N-M
        match = a.id?.match(/^cite-(\d+)-(\d+)$/);
        if (!match) return;
        convIdx = parseInt(match[1]) - 1;
        citeIdx = parseInt(match[2]) - 1;
      }
      const entry = conversation[convIdx];
      const cite = entry?.citations[citeIdx];
      if (!cite) return;
      const rect = target.getBoundingClientRect();
      const below = rect.bottom + 2;
      const above = rect.top - 128;
      setCiteCard({
        cite,
        top: Math.max(2, below + 130 < window.innerHeight ? below : above),
        left: Math.max(2, Math.min(rect.left, Math.max(2, window.innerWidth - 268))),
      });
    };
    const scheduleHide = () => {
      if (citeHideTimer.current !== null) clearTimeout(citeHideTimer.current);
      citeHideTimer.current = setTimeout(() => setCiteCard(null), 250);
    };
    el.addEventListener('mouseover', showCard as EventListener);
    el.addEventListener('mouseleave', scheduleHide);
    return () => {
      el.removeEventListener('mouseover', showCard as EventListener);
      el.removeEventListener('mouseleave', scheduleHide);
      if (citeHideTimer.current !== null) clearTimeout(citeHideTimer.current);
    };
  }, [conversation]);

  // Auto-scroll only when new results arrive AND we're past initial mount
  useEffect(() => {
    const len = conversation.length;
    if (mountedAt.current === 0 && len > prevConvoLen.current) {
      resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevConvoLen.current = len;
  }, [conversation.length]);

  // Reset to fresh thread if away for more than 30 minutes
  const AWAY_THRESHOLD_MS = 10 * 60 * 1000;
  const LAST_SEEN_KEY = 'nerve:research-last-seen';

  useEffect(() => {
    const savedId = loadActiveId();
    const savedThreads = loadThreads();
    const lastSeen = (() => { try { return parseInt(localStorage.getItem(LAST_SEEN_KEY) || '0', 10); } catch { return 0; } })();
    const away = Date.now() - lastSeen > AWAY_THRESHOLD_MS;

    // If away for a while, start fresh
    if (away || (!savedId && savedThreads.length === 0)) {
      const id = generateId();
      const thread: ResearchThread = {
        id, title: 'New Research', createdAt: Date.now(), updatedAt: Date.now(), entries: [],
      };
      setThreads([thread, ...savedThreads.slice(0, 9)]);
      saveThreads([thread, ...savedThreads.slice(0, 9)]);
      setActiveThreadId(id);
      saveActiveId(id);
    } else if (savedId && savedThreads.some((t) => t.id === savedId)) {
      setActiveThreadId(savedId);
      saveActiveId(savedId);
    } else if (savedThreads.length > 0) {
      setActiveThreadId(savedThreads[0].id);
      saveActiveId(savedThreads[0].id);
      setThreads(savedThreads);
    }
  }, []);

  // Save last-seen timestamp when leaving the tab
  useEffect(() => {
    const save = () => {
      try { localStorage.setItem(LAST_SEEN_KEY, String(Date.now())); } catch {}
    };
    document.addEventListener('visibilitychange', save);
    return () => {
      document.removeEventListener('visibilitychange', save);
      save();
    };
  }, []);

  const newThread = useCallback(() => {
    const id = generateId();
    const thread: ResearchThread = {
      id,
      title: 'New Research',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      entries: [],
    };
    setThreads((prev) => {
      const updated = [thread, ...prev];
      saveThreads(updated);
      return updated;
    });
    setActiveThreadId(id);
    saveActiveId(id);
    setQuery('');
    setError(null);
    inputRef.current?.focus();
  }, []);

  const switchThread = useCallback((id: string) => {
    setActiveThreadId(id);
    saveActiveId(id);
    setError(null);
  }, []);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    // Ensure we have an active thread
    let targetId = activeThreadId;
    if (!targetId) {
      targetId = generateId();
      const thread: ResearchThread = {
        id: targetId,
        title: 'New Research',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        entries: [],
      };
      setThreads((prev) => {
        const updated = [thread, ...prev];
        saveThreads(updated);
        return updated;
      });
      setActiveThreadId(targetId);
      saveActiveId(targetId);
    }

    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { query: q, mode };
      if (lastResult?.context) {
        body.context = lastResult.context;
      }

      const resp = await fetch('/api/research/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'Search failed');

      const entry: SearchResult = { ...data.data, timestamp: Date.now() };
      const aiTitle = data.data?.aiTitle as string | undefined;

      setThreads((prev) => {
        const updated = prev.map((t) => {
          if (t.id !== targetId) return t;
          return {
            ...t,
            title: aiTitle || t.title,
            entries: [...t.entries, entry],
            updatedAt: Date.now(),
          };
        });
        saveThreads(updated);
        return updated;
      });

      setQuery('');
      inputRef.current?.focus();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query, mode, activeThreadId, conversation.length, lastResult]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !loading) handleSearch();
    },
    [handleSearch, loading],
  );

  const copyAnswer = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const rewriteLast = useCallback((entry: SearchResult) => {
    // Remove the last entry and re-run the search
    setThreads((prev) => {
      const updated = prev.map((t) => {
        if (t.id !== activeThreadId) return t;
        return { ...t, entries: t.entries.slice(0, -1) };
      });
      saveThreads(updated);
      return updated;
    });
    setQuery(entry.query);
    // Focus and trigger search on next tick
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, [activeThreadId]);

  const autoSortThread = useCallback(async () => {
    if (!activeThreadId) return;
    const thread = threads.find((t) => t.id === activeThreadId);
    if (!thread || thread.entries.length < 2) return;

    try {
      const resp = await fetch('/api/research/split-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: thread.entries.map((e) => ({ query: e.query, answer: e.answer })),
        }),
      });
      const data = await resp.json();
      if (!data.ok || !data.data?.groups) return;

      const groups = data.data.groups as number[][];
      if (groups.length <= 1) return;

      const newThreads: ResearchThread[] = groups.map((indices) => {
        const entries = indices.map((i) => thread.entries[i]).filter(Boolean);
        if (entries.length === 0) return null;
        return {
          id: generateId(),
          title: entries[0].query.slice(0, 60).replace(/[?.:!]+$/, '').trim(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          entries,
        };
      }).filter(Boolean) as ResearchThread[];

      if (newThreads.length <= 1) return;

      setThreads((prev) => {
        const without = prev.filter((t) => t.id !== activeThreadId);
        const updated = [...newThreads, ...without];
        saveThreads(updated);
        return updated;
      });
      setActiveThreadId(newThreads[0].id);
      saveActiveId(newThreads[0].id);
    } catch {}
  }, [activeThreadId, threads]);

  const splitThreadAt = useCallback((entryIndex: number) => {
    if (!activeThreadId) return;
    const thread = threads.find((t) => t.id === activeThreadId);
    if (!thread) return;
    const toMove = thread.entries.slice(entryIndex);
    const toKeep = thread.entries.slice(0, entryIndex);
    if (toMove.length === 0) return;

    const newId = generateId();
    const q = toMove[0].query.slice(0, 60).replace(/[?.:!]+$/, '').trim();
    const newThread: ResearchThread = {
      id: newId, title: q, createdAt: Date.now(), updatedAt: Date.now(), entries: toMove,
    };

    setThreads((prev) => {
      const updated = prev.map((t) => {
        if (t.id !== activeThreadId) return t;
        return { ...t, entries: toKeep };
      });
      const result = [newThread, ...updated];
      saveThreads(result);
      return result;
    });
    setActiveThreadId(newId);
    saveActiveId(newId);
  }, [activeThreadId, threads]);

  const sendToChat = useCallback((text: string) => {
    window.dispatchEvent(new CustomEvent('nerve:send-to-chat', { detail: { text } }));
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header with sidebar toggle + export */}
      <div className="border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="shell-icon-button min-h-7 px-2"
            title={showSidebar ? 'Hide threads' : 'Show threads'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <Sparkles size={16} className="text-primary" />
          <span className="text-sm font-medium">Research</span>
          <div className="ml-auto flex items-center gap-1">
            {activeThread && activeThread.entries.length > 0 && (
              <>
                <button
                  onClick={() => {
                    const md = `# ${activeThread.title}\n\n_Research thread — ${new Date(activeThread.createdAt).toLocaleString()}_\n\n---\n\n${activeThread.entries.map((e) => `## Q: ${e.query}\n\n${e.answer}\n\n### Sources\n${e.citations.map((c, i) => `${i + 1}. [${c.title || 'Untitled'}](${c.url})`).join('\n')}`).join('\n\n---\n\n')}`;
                    const blob = new Blob([md], { type: 'text/markdown' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `research-${activeThread.title.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 40)}.md`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                  className="shell-icon-button min-h-7 px-2"
                  title="Export thread as markdown"
                >
                  <Download size={13} />
                </button>
                <button
                  onClick={newThread}
                  className="shell-icon-button min-h-7 px-2"
                  title="New research thread"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                {activeThread.entries.length > 1 && (
                  <button
                    onClick={autoSortThread}
                    className="shell-icon-button min-h-7 px-2"
                    title="Auto-sort thread by topic"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="3" x2="18" y2="21" /><line x1="12" y1="3" x2="12" y2="21" /><line x1="6" y1="3" x2="6" y2="21" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main area: sidebar + content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        {showSidebar && (
          <div className="w-60 shrink-0 border-r border-border/30 flex flex-col bg-secondary/10 relative">
            <div className="flex-1 overflow-y-auto p-2 space-y-1 relative">
              {threads.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <p className="text-xs text-muted-foreground/50">No threads yet</p>
                </div>
              )}
              {threads.map((thread) => (
                <div key={thread.id} className="relative">
                  <button
                    onClick={() => switchThread(thread.id)}
                    onMouseEnter={() => {
                      if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
                      setHoveredThread(thread.id);
                    }}
                    onMouseLeave={() => {
                      hoverTimer.current = setTimeout(() => setHoveredThread(null), 200);
                    }}
                    className={`group flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-xs transition-colors ${
                      thread.id === activeThreadId
                        ? 'bg-primary/10 border border-primary/20'
                        : 'border border-transparent hover:bg-secondary/40'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block text-[0.6rem] font-medium text-foreground/80 line-clamp-1">{thread.title}</span>
                      <span className="block mt-0.5 text-[0.55rem] text-muted-foreground/50">
                        {thread.createdAt ? new Date(thread.createdAt).toLocaleDateString() : ''} · {thread.entries.length} Q
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const remaining = threads.filter((t) => t.id !== thread.id);
                        setThreads((prev) => {
                          const updated = prev.filter((t) => t.id !== thread.id);
                          saveThreads(updated);
                          return updated;
                        });
                        if (activeThreadId === thread.id) {
                          if (remaining.length > 0) {
                            setActiveThreadId(remaining[0].id);
                            saveActiveId(remaining[0].id);
                          } else {
                            setActiveThreadId(null);
                            saveActiveId(null);
                          }
                        }
                      }}
                      className="shrink-0 rounded-md p-1 text-muted-foreground/30 opacity-0 transition-opacity hover:text-danger hover:bg-danger/10 group-hover:opacity-100"
                      title="Delete thread"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </button>


                </div>
              ))}
            </div>

            {/* Hover dropdown — positioned to the right of the sidebar */}
            {hoveredThread && (() => {
              const thread = threads.find((t) => t.id === hoveredThread);
              if (!thread || thread.entries.length === 0) return null;
              return (
                <div
                  onMouseEnter={() => { if (hoverTimer.current !== null) clearTimeout(hoverTimer.current); }}
                  onMouseLeave={() => setHoveredThread(null)}
                  className="absolute left-full top-0 ml-2 min-w-[220px] max-w-[280px] rounded-xl border border-border/40 bg-card shadow-lg p-2"
                >
                  <div className="space-y-0.5">
                    {thread.entries.map((entry, ei) => (
                      <button
                        key={ei}
                        onClick={() => {
                          switchThread(thread.id);
                          setHoveredThread(null);
                          setTimeout(() => {
                            const el = document.getElementById(`q-${thread.id}-${ei}`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 100);
                        }}
                        className="flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-[0.55rem] transition-colors hover:bg-secondary/40"
                      >
                        <span className="shrink-0 mt-0.5 text-primary/60 font-mono font-semibold">Q{ei + 1}</span>
                        <span className="line-clamp-2 text-muted-foreground/80">{entry.query}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="p-2 border-t border-border/20">
              <button
                onClick={newThread}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground/70 transition-colors hover:bg-secondary/40"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>New Thread</span>
              </button>
            </div>
          </div>
        )}



        {/* Results area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {briefing && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 size={16} className="animate-spin mr-2" />
              <span className="text-xs">Generating research brief...</span>
            </div>
          )}
          {error && <div className="cockpit-note mx-4 mt-3" data-tone="danger">{error}</div>}
          {loading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 size={20} className="animate-spin mr-2" />
              <span className="text-xs">Searching...</span>
            </div>
          )}

          {conversation.length > 0 && (
            <div className="space-y-4 px-4 py-3">
              {conversation.map((entry, ci) => (
                <div key={ci} className="group/convo">
                  {/* Query label */}
                  <div id={`q-${activeThreadId}-${ci}`} className="mb-1.5 flex items-center gap-2 px-1 scroll-mt-4">
                    <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-primary/70">Q{ci > 0 ? ci + 1 : ''}</span>
                    <span
                      className={`text-xs text-foreground/70 font-medium cursor-pointer transition-all ${expandedQuery === ci ? '' : 'line-clamp-1'}`}
                      onClick={() => setExpandedQuery(expandedQuery === ci ? null : ci)}
                      title={expandedQuery === ci ? 'Collapse' : 'Expand query'}
                    >{entry.query}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover/convo:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(entry.query);
                        }}
                        className="shell-icon-button min-h-5 px-1.5 text-[0.5rem]"
                        title="Copy query"
                      >
                        <Copy size={10} />
                      </button>
                      {conversation.length > 1 && ci < conversation.length - 1 && (
                        <button
                          onClick={() => splitThreadAt(ci)}
                          className="shell-icon-button min-h-5 px-1.5 text-[0.5rem]"
                          title="Split thread here — move from this Q onward to a new thread"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="3" x2="18" y2="21" /><line x1="12" y1="3" x2="12" y2="21" /><line x1="6" y1="3" x2="6" y2="21" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <span className="text-[0.55rem] text-muted-foreground/40">
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : ''}
                    </span>
                  </div>

                  {/* Answer card */}
                  <div className="rounded-2xl border border-border/50 bg-card shadow-sm px-5 py-4">
                    <div className="prose prose-zinc dark:prose-invert max-w-none prose-headings:text-foreground/90 prose-strong:text-foreground/90 prose-p:text-base prose-p:leading-relaxed">
                      <Suspense fallback={<p className="text-sm text-muted-foreground/70 whitespace-pre-wrap">{entry.answer}</p>}>
                        <MarkdownRenderer content={ci === conversation.length - 1 ? boldLead(linkCitations(entry.answer, entry.citations, ci)) : linkCitations(entry.answer, entry.citations, ci)} />
                      </Suspense>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => sendToChat(entry.answer)}
                        className="shell-icon-button min-h-7 px-2.5 text-[0.667rem]"
                      >
                        <MessageSquare size={11} className="mr-1" />
                        Send to Chat
                      </button>
                      <button
                        onClick={() => copyAnswer(entry.answer)}
                        className="shell-icon-button min-h-7 px-2.5 text-[0.667rem]"
                      >
                        {copied ? <Check size={11} className="mr-1 text-green-500" /> : <Copy size={11} className="mr-1" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                      {ci === conversation.length - 1 && (
                        <button
                          onClick={() => rewriteLast(entry)}
                          className="shell-icon-button min-h-7 px-2.5 text-[0.667rem]"
                          title="Remove last answer and regenerate"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                          </svg>
                          Rewrite
                        </button>
                      )}
                      <span className="text-[0.6rem] text-muted-foreground/50">via {entry.provider}</span>
                    </div>

                    {/* Tab bar */}
                    <div className="mt-2.5 flex items-center gap-0.5 border-b border-border/20">
                      {(['all', 'sources', 'images', 'links'] as const).map((tab) => {
                        let count = 0;
                        if (tab === 'all') count = 0;
                        else if (tab === 'sources') count = entry.citations.filter((c,i,a) => c.url && a.findIndex(x => x.url === c.url) === i).length;
                        else if (tab === 'images') count = entry.images?.length || 0;
                        else if (tab === 'links') count = extractLinks(entry.answer).length;
                        if (tab !== 'all' && count === 0) return null;
                        return (
                          <button
                            key={tab}
                            onClick={() => setResultTab(tab === resultTab ? 'all' : tab)}
                            className={`px-2.5 py-1.5 text-[0.55rem] font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-[1px] ${
                              resultTab === tab
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground/50 hover:text-foreground/70'
                            }`}
                          >
                            {tab}{tab !== 'all' ? ` (${count})` : ''}
                          </button>
                        );
                      })}
                    </div>

                    {/* Follow-up chips — only when on 'all' tab */}
                    {resultTab === 'all' && ci === conversation.length - 1 && parseFollowUps(entry.answer).length > 0 && (
                      <div className="mt-3">
                        <span className="text-[0.55rem] font-semibold uppercase tracking-wider text-muted-foreground/50 ml-1">Next Questions</span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {parseFollowUps(entry.answer).map((q, qi) => (
                            <button
                              key={qi}
                              onClick={() => {
                                setQuery(q);
                                inputRef.current?.focus();
                              }}
                              className="rounded-lg border border-border/30 bg-secondary/15 px-2.5 py-1 text-[0.6rem] text-muted-foreground/80 transition-colors hover:bg-secondary/30 hover:text-foreground text-left max-w-[240px]"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tab content: Images */}
                  {resultTab === 'images' && entry.images && entry.images.length > 0 && (
                    <div className="mt-3 px-1">
                      <div className="flex flex-wrap gap-2">
                        {entry.images.map((img, ii) => (
                          <a
                            key={ii}
                            href={img.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group/image relative block w-24 h-24 rounded-lg overflow-hidden border border-border/30 bg-card/50 hover:border-primary/40 transition-colors"
                          >
                            <img
                              src={img.url}
                              alt={img.title || ''}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tab content: Links */}
                  {resultTab === 'links' && (
                    <div className="mt-3 px-1">
                      <div className="space-y-1">
                        {(() => {
                          const links = extractLinks(entry.answer);
                          if (links.length === 0) {
                            // Fall back to showing citation URLs
                            return entry.citations.filter((c,i,a) => c.url && a.findIndex(x => x.url === c.url) === i).map((cite, ii) => (
                              <a key={ii} href={cite.url} target="_blank" rel="noopener noreferrer"
                                className="block text-[0.6rem] text-muted-foreground/70 hover:text-primary truncate py-0.5"
                              >{cite.title || cite.url}</a>
                            ));
                          }
                          return links.map((link, ii) => (
                            <a key={ii} href={link} target="_blank" rel="noopener noreferrer"
                              className="block text-[0.6rem] text-muted-foreground/70 hover:text-primary truncate py-0.5"
                            >{link}</a>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Tab content: Sources (compact inline) — shown on 'all' or 'sources' tab */}
                  {(resultTab === 'all' || resultTab === 'sources') && entry.citations.filter((c, i, a) => c.url && a.findIndex((x) => x.url === c.url) === i).length > 0 && (
                    <div className="mt-3">
                      <span className="text-[0.55rem] font-semibold uppercase tracking-wider text-muted-foreground/50 ml-1">Sources</span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {entry.citations.filter((c, i, a) => c.url && a.findIndex((x) => x.url === c.url) === i).map((cite, i) => (
                          <a
                            id={`cite-${ci + 1}-${i + 1}`}
                            key={i}
                            href={cite.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="scroll-mt-4 inline-flex items-center gap-1 rounded-lg border border-border/30 bg-card/30 px-2 py-1 text-[0.6rem] text-muted-foreground/70 transition-colors hover:bg-card/50 hover:text-foreground/80"
                          >
                            <span className="relative w-4 h-4 rounded shrink-0 flex items-center justify-center bg-primary/10 text-[0.45rem] font-bold text-primary/60">
                              {(cite.title || 'W')[0].toUpperCase()}
                              <img src={faviconUrl(cite.url)} alt="" className="absolute inset-0 w-full h-full rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </span>
                            <span className="max-w-[140px] truncate">{cite.title || domainOnly(cite.url)}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {ci < conversation.length - 1 && (
                    <div className="border-t border-border/20 my-2" />
                  )}
                </div>
              ))}
              <div ref={resultsEndRef} />
            </div>
          )}

          {conversation.length === 0 && !loading && !error && !briefing && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Sparkles size={32} className="text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground/60">Search the web with cited sources</p>
              {threads.length > 0 && (
                <div className="mt-6 w-full max-w-sm">
                  <span className="cockpit-kicker mb-2 block text-center">Previous Threads</span>
                  <div className="space-y-1">
                    {threads.filter((t) => t.entries.length > 0).slice(0, 10).map((thread) => (
                      <button key={thread.id} onClick={() => switchThread(thread.id)}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-xs text-muted-foreground/70 transition-colors hover:bg-secondary/50">
                        <ChevronRight size={10} />
                        {thread.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Citation hover card */}
        {citeCard && (
          <div
            className="fixed z-[9999] w-[260px] rounded-xl border border-border/40 bg-card shadow-xl p-3"
            style={{ top: Math.max(4, citeCard.top), left: Math.max(4, citeCard.left) }}
            onMouseEnter={() => {
              if (citeHideTimer.current) { clearTimeout(citeHideTimer.current); citeHideTimer.current = null; }
            }}
            onMouseLeave={() => {
              citeHideTimer.current = setTimeout(() => setCiteCard(null), 250);
            }}
          >
            <div className="flex items-start gap-3">
              {faviconUrl(citeCard.cite.url, 64) && (
                <img
                  src={faviconUrl(citeCard.cite.url, 64)}
                  alt=""
                  className="w-9 h-9 rounded-lg border border-border/30 shrink-0 bg-white"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-foreground/90 line-clamp-2">{citeCard.cite.title || 'Untitled'}</span>
                <span className="block mt-0.5 text-[0.55rem] text-muted-foreground/50">{domainOnly(citeCard.cite.url)}</span>
                {citeCard.cite.snippet && (
                  <p className="mt-1 text-[0.6rem] text-muted-foreground/70 line-clamp-3 leading-relaxed">{citeCard.cite.snippet}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scroll buttons */}
        {conversation.length > 0 && (
          <div className="absolute bottom-3 right-4 flex gap-1.5 z-10">
            <button
              onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              className="shell-icon-button min-h-7 px-2.5 text-[0.6rem] shadow-md bg-card/90 backdrop-blur-sm"
              title="Scroll to top"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
              <span className="ml-1">Top</span>
            </button>
            <button
              onClick={() => resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="shell-icon-button min-h-7 px-2.5 text-[0.6rem] shadow-md bg-card/90 backdrop-blur-sm"
              title="Scroll to bottom"
            >
              <span className="mr-1">Bottom</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Search bar — bottom dock */}
      <div className="border-t border-border/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-border/50 bg-secondary/20 px-2.5 has-[input:focus]:border-primary/50 has-[input:focus]:bg-secondary/30 transition-colors">
            <button
              onClick={() => setMode('quick')}
              className={`shrink-0 rounded-lg px-2 py-1 text-[0.6rem] font-medium transition-colors ${mode === 'quick' ? 'bg-primary/15 text-primary' : 'text-muted-foreground/60 hover:text-foreground/80'}`}
            >⚡ Quick</button>
            <button
              onClick={() => setMode('deep')}
              className={`shrink-0 rounded-lg px-2 py-1 text-[0.6rem] font-medium transition-colors ${mode === 'deep' ? 'bg-primary/15 text-primary' : 'text-muted-foreground/60 hover:text-foreground/80'}`}
            >🔬 Deep</button>
            <span className="h-4 w-px bg-border/40 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
              disabled={loading}
              autoFocus
            />
          </div>
          <button
            id="research-search-btn"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="cockpit-chip min-h-9 px-4 text-sm shrink-0"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            <span className="ml-1.5">{loading ? 'Searching...' : 'Search'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

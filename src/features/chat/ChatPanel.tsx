import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { ProcessingStage, ActivityLogEntry, ChatStreamState } from '@/contexts/ChatContext';
import { ToolCallBlock } from './ToolCallBlock';
import { MessageBubble } from './MessageBubble';
import { InputBar, type InputBarHandle } from './InputBar';
import { SearchBar } from './SearchBar';
import { useMessageSearch } from './useMessageSearch';
import { ActivityLog, ProcessingIndicator, ScrollToBottomButton, StreamingMessage, ToolGroupBlock } from './components';
import { isMessageCollapsible } from './types';
import type { ChatMsg, ImageAttachment, OutgoingUploadPayload } from './types';
import type { BeadLinkTarget } from '@/features/beads';

interface ChatPanelProps {
  messages: ChatMsg[];
  onSend: (text: string, attachments?: ImageAttachment[], uploadPayload?: OutgoingUploadPayload) => void | Promise<void>;
  onAbort: () => void;
  isGenerating: boolean;
  stream: ChatStreamState;
  processingStage?: ProcessingStage;
  currentToolDescription?: string | null;
  activityLog?: ActivityLogEntry[];
  onWakeWordState?: (enabled: boolean, toggle: () => void) => void;
  /** Externally controlled search open state */
  searchOpen?: boolean;
  /** Called when search should close */
  onSearchClose?: () => void;
  /** HTML id for skip-to-content link */
  id?: string;
  /** Agent display name */
  agentName?: string;
  /** Load more (older) messages — returns true if still more available */
  loadMore?: () => boolean;
  /** Whether there are older messages to load */
  hasMore?: boolean;
  /** Mobile file browser toggle handler */
  /** Whether the mobile file browser is currently collapsed. */
  /** Mobile top bar toggle handler. */
  /** Whether the mobile top bar is currently hidden. */
  /** Open or reveal a safe workspace path in the file explorer/editor. */
  onOpenWorkspacePath?: (path: string) => void | Promise<void>;
  /** Configured path prefixes that should render as clickable inline path links. */
  pathLinkPrefixes?: string[];
  /** Configured shorthand aliases that should normalize to canonical workspace paths. */
  pathLinkAliases?: Record<string, string>;
  /** Open a dedicated bead viewer tab. */
  onOpenBeadId?: (target: BeadLinkTarget) => void | Promise<void>;
  /** Whether to show the compact Commands launcher inside the composer. */
  showCommandPaletteButton?: boolean;
  /** Open the command palette from the compact composer launcher. */
  onOpenCommandPalette?: () => void;
  /** Send current conversation to the Research tab with an auto-generated brief. */
  onSendToResearch?: () => void;
}

export interface ChatPanelHandle {
  focusInput: () => void;
  addWorkspacePath: (path: string, kind: 'file' | 'directory', agentId?: string) => Promise<void>;
  /** Scroll to a message by its index in the messages array. Returns true if found. */
  scrollToMessage: (messageIndex: number) => boolean;
}

/** Main chat panel with message list, infinite scroll, search, and input bar. */
// Fetch MCP server names and visibility for MCP tool badge detection
function useMcpState(): { serverNames: string[]; visible: boolean } {
  const [serverNames, setServerNames] = useState<string[]>([]);
  const [visible, setVisible] = useState(() => {
    try {
      const stored = localStorage.getItem('nerve:mcp:show-in-chat');
      return stored === null ? true : stored === 'true';
    } catch { return true; }
  });

  useEffect(() => {
    let cancelled = false;
    const fetchNames = async () => {
      try {
        const resp = await fetch('/api/mcp/servers', { signal: AbortSignal.timeout(5000) });
        if (!resp.ok) return;
        const data = await resp.json() as { servers?: { name: string }[] };
        if (!cancelled) {
          setServerNames(data.servers?.map(s => s.name) || []);
        }
      } catch {
        // servers not available, no badges shown
      }
    };
    fetchNames();

    // Listen for visibility changes from settings
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { visible: boolean } | undefined;
      if (detail) setVisible(detail.visible);
    };
    window.addEventListener('nerve:mcp-visibility-changed', handler);

    return () => {
      cancelled = true;
      window.removeEventListener('nerve:mcp-visibility-changed', handler);
    };
  }, []);

  return { serverNames, visible };
}

export const ChatPanel = forwardRef<ChatPanelHandle, ChatPanelProps>(function ChatPanel({
  messages,
  onSend, onAbort, isGenerating, stream,
  processingStage,
  currentToolDescription = null, activityLog = [],
  onWakeWordState, searchOpen, onSearchClose, id, agentName = 'Agent',
  loadMore, hasMore = false,
  onOpenWorkspacePath,
  pathLinkPrefixes,
  pathLinkAliases,
  onOpenBeadId,
  showCommandPaletteButton = false,
  onOpenCommandPalette,
  onSendToResearch,
}, ref) {
  const { serverNames: mcpServerNames, visible: mcpVisible } = useMcpState();
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const inputBarRef = useRef<InputBarHandle>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string | number, boolean>>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [processingTime, setProcessingTime] = useState(0);
  const processingStart = useRef<number | null>(null);
  const prevMessageCount = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isLoadingMore = useRef(false);
  const loadMoreRef = useRef(loadMore);
  const hasMoreRef = useRef(hasMore);

  // Keep refs in sync so the observer callback always sees current values
  useEffect(() => { loadMoreRef.current = loadMore; }, [loadMore]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

  // Infinite scroll — load older messages when sentinel enters viewport
  useEffect(() => {
    if (!loadMoreRef.current || !hasMoreRef.current) return;
    const sentinel = sentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || isLoadingMore.current || !loadMoreRef.current || !hasMoreRef.current) return;
        isLoadingMore.current = true;

        // Preserve scroll position: record distance from bottom before prepend
        const prevScrollHeight = container.scrollHeight;
        const prevScrollTop = container.scrollTop;

        loadMoreRef.current();

        // After React commits DOM updates, restore scroll position.
        // Double-rAF ensures we run after React's commit + browser layout.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const newScrollHeight = container.scrollHeight;
            const delta = newScrollHeight - prevScrollHeight;
            container.scrollTop = prevScrollTop + delta;
            isLoadingMore.current = false;
          });
        });
      },
      { root: container, rootMargin: '200px 0px 0px 0px', threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  // Keep a ref to the latest messages for useImperativeHandle (avoids stale closures)
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    focusInput: () => inputBarRef.current?.focus(),
    addWorkspacePath: async (path: string, kind: 'file' | 'directory', agentId?: string) => {
      await inputBarRef.current?.addWorkspacePath(path, kind, agentId);
    },
    scrollToMessage: (messageIndex: number) => {
      const msgs = messagesRef.current;
      if (messageIndex < 0 || messageIndex >= msgs.length) return false;

      const msgElement = messageRefs.current.get(messageIndex);
      if (!msgElement || !scrollRef.current) return false;

      // Expand the message if it's collapsed
      const collapseKey = msgs[messageIndex]?.msgId || msgs[messageIndex]?.tempId || messageIndex;
      if (collapsed[collapseKey]) {
        setCollapsed(prev => ({ ...prev, [collapseKey]: false }));
      }

      msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setAutoScroll(false);
      return true;
    },
  }), [messages, collapsed]);

  // Clean up stale messageRefs when messages change
  useEffect(() => {
    const validIndices = new Set(messages.map((_, i) => i));
    for (const key of messageRefs.current.keys()) {
      if (!validIndices.has(key)) messageRefs.current.delete(key);
    }
  }, [messages]);

  // Message search
  const search = useMessageSearch(messages);

  // Sync external search state with internal
  // We intentionally only react to searchOpen changes to avoid infinite loops
  useEffect(() => {
    if (searchOpen && !search.isActive) {
      search.open();
    } else if (!searchOpen && search.isActive) {
      search.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync on external searchOpen changes
  }, [searchOpen]);

  // Wrap close to also notify parent
  const handleSearchClose = useCallback(() => {
    search.close();
    onSearchClose?.();
  }, [search, onSearchClose]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current && autoScroll) {
      const el = scrollRef.current;
      try {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } catch {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [autoScroll]);

  // Debounced scroll to bottom — skips rapid repeated calls during streaming
  const scrollScheduledRef = useRef(false);
  const scheduleScrollToBottom = useCallback(() => {
    if (scrollScheduledRef.current) return;
    scrollScheduledRef.current = true;
    requestAnimationFrame(() => {
      scrollScheduledRef.current = false;
      scrollToBottom();
    });
  }, [scrollToBottom]);

  /** Holds the last streaming HTML to prevent flash when stream transitions to final message. */
  const lastStreamHtmlRef = useRef('');

  // Clear the streaming ghost when a new non-streaming message is added.
  // We delay slightly to let the final message render first, preventing flash.
  const msgCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > msgCountRef.current) {
      msgCountRef.current = messages.length;
      const timer = setTimeout(() => { lastStreamHtmlRef.current = ''; }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  useEffect(scheduleScrollToBottom, [stream.html, scheduleScrollToBottom]);
  useEffect(scrollToBottom, [messages, scrollToBottom]);

  // NOTE: Cmd+F and Escape are now handled globally in App.tsx via useKeyboardShortcuts

  // Scroll to current match when it changes
  useEffect(() => {
    if (search.currentMatch) {
      const msgElement = messageRefs.current.get(search.currentMatch.messageIndex);
      if (msgElement && scrollRef.current) {
        // Expand the message if it's collapsed
        const msgIndex = search.currentMatch.messageIndex;
        const searchMsg = messages[msgIndex];
        const searchCollapseKey = searchMsg?.msgId || searchMsg?.tempId || msgIndex;
        if (collapsed[searchCollapseKey]) {
          setCollapsed(prev => ({ ...prev, [searchCollapseKey]: false }));
        }
        // Scroll to the message
        msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setAutoScroll(false);
      }
    }
  }, [search.currentMatch, search.currentMatchIndex, collapsed, messages]);

  // Track unread messages when scrolled up
  useEffect(() => {
    if (!autoScroll && messages.length > prevMessageCount.current) {
      setUnreadCount(prev => prev + (messages.length - prevMessageCount.current));
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, autoScroll]);

  // Listen for nerve:jump-to-message events from the Activity Panel
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.msgId) return;

      // Find the message index by msgId
      const msgIndex = messages.findIndex(
        (m) => m.msgId === detail.msgId || m.tempId === detail.msgId
      );
      if (msgIndex < 0) return;

      const msgElement = messageRefs.current.get(msgIndex);
      if (msgElement && scrollRef.current) {
        // Expand the message if it's collapsed
        const collapseKey = messages[msgIndex]?.msgId || messages[msgIndex]?.tempId || msgIndex;
        if (collapsed[collapseKey]) {
          setCollapsed(prev => ({ ...prev, [collapseKey]: false }));
        }
        // Scroll to the message
        msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setAutoScroll(false);
      }
    };

    window.addEventListener('nerve:jump-to-message', handler);
    return () => window.removeEventListener('nerve:jump-to-message', handler);
  }, [messages, collapsed]);

  // Processing timer
  useEffect(() => {
    if (isGenerating) {
      processingStart.current = Date.now();
      const iv = setInterval(() => {
        if (processingStart.current) {
          setProcessingTime(Date.now() - processingStart.current);
        }
      }, 250);
      return () => clearInterval(iv);
    } else {
      processingStart.current = null;
      setProcessingTime(0);
    }
  }, [isGenerating]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(isAtBottom);
    if (isAtBottom) setUnreadCount(0);
  };

  const handleScrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
      setUnreadCount(0);
    }
  };

  const toggleCollapse = (idx: number) => {
    // Resolve to stable msgId so collapse state survives list reordering.
    const msg = messages[idx];
    const key = msg?.msgId || msg?.tempId || idx;
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleMemory = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !(prev[key] ?? true) }));
  };

  // First message time for mission time calculation
  const firstMessageTime = messages.length > 0 ? messages[0].timestamp : null;

  return (
    <div id={id} className="h-full flex flex-col border-r border-border min-w-0 relative">


      {/* Search Bar */}
      {search.isActive && (
        <SearchBar
          query={search.query}
          onQueryChange={search.setQuery}
          matchCount={search.matchCount}
          currentMatchIndex={search.currentMatchIndex}
          onNext={search.nextMatch}
          onPrev={search.prevMatch}
          onClose={handleSearchClose}
        />
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Chat messages"
        className="flex-1 overflow-y-auto overflow-x-hidden py-3 flex flex-col gap-1"
      >
        {/* Load older messages */}
        {hasMore && (
          <button
            onClick={() => loadMore?.()}
            className="w-full flex items-center justify-center py-2 text-muted-foreground/60 hover:text-foreground/80 text-[0.667rem] tracking-widest uppercase select-none transition-colors cursor-pointer"
          >
            ↑ older messages
          </button>
        )}
        {messages.map((msg, i) => {
          const isTool = msg.role === 'tool' || msg.role === 'toolResult';
          const collapseKey = msg.msgId || msg.tempId || i;
          const isCollapsed = collapsed[collapseKey] ?? (msg.isThinking || isMessageCollapsible(msg));
          const memoryKey = `mem-${collapseKey}`;
          const isMemoryCollapsed = collapsed[memoryKey] ?? true;
          const isCurrentMatch = search.currentMatch?.messageIndex === i;
          const stableKey = msg.msgId || msg.tempId || `${msg.role}-${msg.timestamp.getTime()}-${i}`;

          // Tool/toolResult messages with embed markers go through MessageBubble
          // so AppEmbed components render properly
          const hasEmbed = isTool && /<!--\s*nerve-app\s+/.test(msg.rawText);

          // Tool calls and thinking messages are hidden from the chat —
          // they appear in the Activity Panel instead.
          if (isTool || msg.isThinking) return null;

          if (isTool && !hasEmbed) {
            // Grouped tool bubble (multiple consecutive tool calls)
            if (msg.toolGroup) {
              return (
                <div
                  key={stableKey}
                  data-message-index={i}
                  ref={(el) => { if (el) messageRefs.current.set(i, el); }}
                >
                  <ToolGroupBlock
                    msg={msg}
                    index={i}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={toggleCollapse}
                  />
                </div>
              );
            }
            // Single tool call
            return (
              <div
                key={stableKey}
                data-message-index={i}
                ref={(el) => { if (el) messageRefs.current.set(i, el); }}
              >
                <ToolCallBlock
                  msg={msg}
                  index={i}
                  isCollapsed={isCollapsed}
                  onToggleCollapse={toggleCollapse}
                  mcpServerNames={mcpServerNames}
                  mcpVisible={mcpVisible}
                />
              </div>
            );
          }

          return (
            <div
              key={stableKey}
              data-message-index={i}
              ref={(el) => { if (el) messageRefs.current.set(i, el); }}
            >
              <MessageBubble
                msg={msg}
                index={i}
                isCollapsed={isCollapsed}
                isMemoryCollapsed={isMemoryCollapsed}
                memoryKey={memoryKey}
                onToggleCollapse={toggleCollapse}
                onToggleMemory={toggleMemory}
                firstMessageTime={firstMessageTime}
                searchQuery={search.query}
                isCurrentMatch={isCurrentMatch}
                agentName={agentName}
                onOpenWorkspacePath={onOpenWorkspacePath}
                pathLinkPrefixes={pathLinkPrefixes}
                pathLinkAliases={pathLinkAliases}
                onOpenBeadId={onOpenBeadId}
              />
            </div>
          );
        })}

        {/* Processing indicator — compact single-line status at bottom of chat */}
        {isGenerating && !stream.html && (
          <ProcessingIndicator
            stage={processingStage}
            elapsedMs={processingTime}
            currentToolDescription={currentToolDescription}
            isRecovering={Boolean(stream.isRecovering)}
            recoveryReason={stream.recoveryReason}
          />
        )}

        {/* Streaming message — persists last content during the transition to final message */}
        {(() => {
          // Keep last stream.html alive while transitioning (isGenerating just turned off)
          if (stream.html) lastStreamHtmlRef.current = stream.html;
          // Only show streaming ghost when actively generating AND stream is temporarily empty
          // (e.g., tool calls clearing the buffer). If generation is done AND messages exist,
          // the final message has already landed — no ghost needed.
          const isStreamActive = isGenerating && stream.html;
          const isTransitioning = isGenerating && !stream.html && lastStreamHtmlRef.current;
          const showHtml = isStreamActive ? stream.html : (isTransitioning ? lastStreamHtmlRef.current : '');
          if (!showHtml) return null;
          return (
            <>
              <StreamingMessage html={showHtml} elapsedMs={processingTime} agentName={agentName} />
              {activityLog.length > 0 && (
                <div className="px-4 pb-2" style={{ paddingLeft: '2rem' }}>
                  <ActivityLog entries={activityLog} />
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Scroll-to-bottom button */}
      {!autoScroll && (
        <ScrollToBottomButton onClick={handleScrollToBottom} unreadCount={unreadCount} />
      )}

      {/* Input area */}
      <InputBar
        ref={inputBarRef}
        onSend={onSend}
        isGenerating={isGenerating}
        onWakeWordState={onWakeWordState}
        agentName={agentName}
        showCommandPaletteButton={showCommandPaletteButton}
        onOpenCommandPalette={onOpenCommandPalette}
        onResearch={onSendToResearch}
        onAbort={onAbort}
      />

    </div>
  );
});

// Re-export types for backward compatibility
export type { ChatMsg, ImageAttachment } from './types';

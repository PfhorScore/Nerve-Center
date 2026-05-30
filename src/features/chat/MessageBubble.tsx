import { useState, useCallback, useMemo, lazy, Suspense, memo } from 'react';
import { ClipboardCopy, Brain, BookOpen, Volume2, Trash2 } from 'lucide-react';
import { MemoriesSection } from './MemoriesSection';
import { ImageLightbox } from './ImageLightbox';
import { isMessageCollapsible } from './types';
import { decodeHtmlEntities } from '@/lib/formatting';
import { isStructuredMarkdown } from '@/lib/text/isStructuredMarkdown';
import { extractAppEmbeds, stripAppEmbeds } from '@/lib/nerve-app';
import { AppEmbed } from '@/features/chat/components/AppEmbed';
import { AvatarIcon } from '@/components/AvatarIcon';
import { useSettings } from '@/contexts/SettingsContext';
import type { ChatMsg } from './types';
import type { BeadLinkTarget } from '@/features/beads';

// Lazy-load markdown renderer (includes highlight.js)
const MarkdownRenderer = lazy(() => import('@/features/markdown/MarkdownRenderer').then(m => ({ default: m.MarkdownRenderer })));
const InlineChart = lazy(() => import('@/features/charts/InlineChart'));

// Extract relevant-memories section from user messages
function extractMemories(rawText: string): { memories: string | null; content: string } {
  const match = rawText.match(/<relevant-memories>([\s\S]*?)<\/relevant-memories>\s*/);
  if (match) {
    const memories = match[1].trim();
    const content = rawText.replace(match[0], '').trim();
    return { memories, content };
  }
  return { memories: null, content: rawText };
}

function formatMissionTime(msgTime: Date, firstTime: Date | null): string {
  if (!firstTime) return '';
  const diff = Math.max(0, msgTime.getTime() - firstTime.getTime());
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `T+${h}:${m}:${s}`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(/\.0$/, '')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

/** Format timestamp according to user preference. */
function formatTime(date: Date, use24h: boolean): string {
  try {
    return date.toLocaleTimeString(use24h ? 'en-GB' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
}

interface MessageBubbleProps {
  msg: ChatMsg;
  index: number;
  isCollapsed: boolean;
  isMemoryCollapsed: boolean;
  memoryKey?: string;
  onToggleCollapse: (idx: number) => void;
  onToggleMemory: (key: string) => void;
  firstMessageTime?: Date | null;
  searchQuery?: string;
  isCurrentMatch?: boolean;
  agentName?: string;
  onOpenWorkspacePath?: (path: string) => void | Promise<void>;
  pathLinkPrefixes?: string[];
  pathLinkAliases?: Record<string, string>;
  onOpenBeadId?: (target: BeadLinkTarget) => void | Promise<void>;
}

const bgClass = (role: string) => {
  if (role === 'user') return 'bg-message-user';
  if (role === 'assistant') return 'bg-message-assistant';
  if (role === 'system' || role === 'event') return 'bg-message-system';
  return '';
};

function MessageBubbleInner({ msg, index, isCollapsed, isMemoryCollapsed, memoryKey, onToggleCollapse, onToggleMemory, firstMessageTime, searchQuery, isCurrentMatch, agentName, onOpenWorkspacePath, pathLinkPrefixes, pathLinkAliases, onOpenBeadId }: MessageBubbleProps) {
  const { speak } = useSettings();
  const isUser = msg.role === 'user';
  const isAssistant = msg.role === 'assistant';
  const isSystem = msg.role === 'system' || msg.role === 'event';
  const { use24hTime } = useSettings();
  const timeStr = formatTime(msg.timestamp, use24hTime);
  const missionTime = formatMissionTime(msg.timestamp, firstMessageTime ?? null);
  const isCollapsible = isMessageCollapsible(msg);
  const [copied, setCopied] = useState(false);
  const [sysExpanded, setSysExpanded] = useState(false);

  // useCallback must be called unconditionally (before any early returns)
  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(msg.rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn('Clipboard copy failed', err);
    }
  }, [msg.rawText]);

  // System notification strip (subagent/cron completions) — collapsible, not a full bubble
  if (msg.isSystemNotification) {
    const statusIcon = msg.systemLabel?.includes('failed') || msg.systemLabel?.includes('timed out') ? '⚠' : '⚡';
    return (
      <div className="group relative border-b border-border/20">
        <button
          type="button"
          onClick={() => setSysExpanded(!sysExpanded)}
          aria-expanded={sysExpanded}
          className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-4 py-2 text-[0.733rem] text-muted-foreground transition-colors hover:bg-secondary/50"
        >
          <span className={`shrink-0 w-3 transition-transform ${sysExpanded ? 'rotate-90' : ''}`}>›</span>
          <span>{statusIcon}</span>
          <span className="truncate font-medium text-info">{msg.systemLabel || 'System notification'}</span>
          <span className="ml-auto shrink-0 font-mono text-[0.667rem] text-info/40">{timeStr}</span>
        </button>
        {sysExpanded && (
          <div className="max-h-[300px] overflow-y-auto border-t border-border/20 bg-secondary/30 px-8 py-3 text-[0.8rem] text-muted-foreground">
            <pre className="whitespace-pre-wrap font-mono text-[0.667rem] leading-relaxed">{msg.rawText}</pre>
          </div>
        )}
      </div>
    );
  }

  const { memories, content: cleanContent } = isUser ? extractMemories(msg.rawText) : { memories: null, content: msg.rawText };
  const rawForDisplay = isUser && memories ? cleanContent : msg.rawText;
  const isVoiceMessage = isUser && (msg.isVoice || rawForDisplay.includes('[voice] '));
  // Strip [voice] tag and timestamp prefix like [Wed 2026-02-18 17:35 GMT+1]
  const displayContent = (() => {
    let text = rawForDisplay;
    if (isUser) {
      text = text.replace(/^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+GMT[+-]\d+\]\s*/g, '');
      text = text.replace(/\[voice\]\s*/g, '');
    }
    return text;
  })();

  // Parse app embeds from message
  const appEmbeds = useMemo(() => extractAppEmbeds(msg.rawText), [msg.rawText]);
  // Strip app markers from display content
  const cleanDisplayContent = useMemo(() => {
    if (appEmbeds.length > 0) return stripAppEmbeds(displayContent);
    return displayContent;
  }, [appEmbeds, displayContent]);

  // Generate preview: first non-empty line, truncated, for system/event messages
  const systemPreview = isSystem && msg.rawText
    ? (() => {
        const firstLine = msg.rawText.split('\n').find(l => l.trim()) || msg.rawText;
        const clean = firstLine.replace(/^#+\s*/, '').replace(/```\w*/g, '').trim();
        return decodeHtmlEntities(clean.slice(0, 80) + (clean.length > 80 ? '…' : ''));
      })()
    : '';

  const preview = isCollapsible && msg.rawText
    ? decodeHtmlEntities(systemPreview || msg.rawText.slice(0, 60).replace(/\n/g, ' ') + (msg.rawText.length > 60 ? '…' : ''))
    : '';

  const memoryCollapsedKey = memoryKey ?? `mem-${msg.msgId || msg.tempId || index}`;

  // Visual indicator for current search match
  const matchClass = isCurrentMatch ? 'ring-2 ring-primary/60 ring-offset-1 ring-offset-background' : '';
  
  // Pending/failed state classes for optimistic updates
  const pendingClass = msg.pending ? 'msg-pending' : '';
  const failedClass = msg.failed ? 'msg-failed' : '';

  // Intermediate assistant messages: narration between tool calls, not the final answer
  const isIntermediate = msg.intermediate && isAssistant;

  // Thinking bubbles: compact, dimmed, no collapse toggle
  if (msg.isThinking) {
    return (
      <div className="group msg msg-assistant relative max-w-full break-words ml-8 mr-4 my-0.5">
        <div className="flex items-start gap-2 rounded-2xl border border-primary/10 bg-primary/[0.03] px-3 py-2 transition-colors select-none hover:border-primary/18 hover:bg-primary/[0.05]">
          <span className="mt-0.5 shrink-0 text-[0.667rem] text-primary/60">💭</span>
          <span className="shrink-0 text-[0.733rem] font-medium text-primary/78">Thinking</span>
          {msg.thinkingDurationMs && (
            <span className="shrink-0 text-[0.667rem] tabular-nums text-primary/52">
              • {msg.thinkingDurationMs >= 1000
                ? `${(msg.thinkingDurationMs / 1000).toFixed(1)}s`
                : `${msg.thinkingDurationMs}ms`}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[0.667rem] italic text-primary/44">
            {msg.rawText.slice(0, 100)}{msg.rawText.length > 100 ? '…' : ''}
          </span>
          <span className="mt-0.5 shrink-0 font-mono text-[0.667rem] tabular-nums text-primary/36">{timeStr}</span>
        </div>
      </div>
    );
  }

  // Intermediate messages get a compact, de-emphasized render
  if (isIntermediate) {
    return (
      <div className="group msg msg-assistant relative max-w-full break-words ml-8 mr-4 my-0.5">
        <div className="flex items-start gap-2 select-none hover:bg-foreground/[0.02] transition-colors py-1 px-2 rounded">
          <span className="w-4 shrink-0" />
          <span
            role="button"
            tabIndex={0}
            aria-expanded={!isCollapsed}
            className={`text-muted-foreground text-[0.667rem] shrink-0 w-3 mt-0.5 transition-transform cursor-pointer hover:text-foreground/70 ${!isCollapsed ? 'rotate-90' : ''}`}
            onClick={() => onToggleCollapse(index)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCollapse(index); } }}
          >›</span>
          <span className="text-muted-foreground/50 text-[0.667rem] shrink-0 mt-0.5">💬</span>
          {isCollapsed ? (
            <span className="text-muted-foreground/70 text-[0.733rem] truncate flex-1 min-w-0 italic">
              {msg.rawText.split('\n').find(l => l.trim())?.slice(0, 100) || msg.rawText.slice(0, 100)}
              {msg.rawText.length > 100 ? '…' : ''}
            </span>
          ) : (
            <div className="text-muted-foreground/70 text-[0.8rem] flex-1 min-w-0 msg-body-intermediate">
              <Suspense fallback={<span className="text-muted-foreground text-xs">…</span>}>
                <MarkdownRenderer content={displayContent} searchQuery={searchQuery} suppressImages={isAssistant} onOpenWorkspacePath={onOpenWorkspacePath} pathLinkPrefixes={pathLinkPrefixes} pathLinkAliases={pathLinkAliases} onOpenBeadId={onOpenBeadId} />
              </Suspense>
            </div>
          )}
          <span className="text-muted-foreground/40 text-[0.667rem] shrink-0 tabular-nums mt-0.5">{timeStr}</span>
        </div>
      </div>
    );
  }

  return (
    <div data-msg-id={msg.msgId} className={`group msg msg-${msg.role} relative max-w-full break-words ${isUser ? 'ml-auto w-fit max-w-full overflow-visible flex flex-col sm:max-w-[72ch]' : 'overflow-hidden'} ${bgClass(msg.role)} ${matchClass} ${pendingClass} ${failedClass}`}>
      {/* Collapsible memories section for user messages */}
      {isUser && memories && (
        <MemoriesSection
          memories={memories}
          isCollapsed={isMemoryCollapsed}
          onToggle={() => onToggleMemory(memoryCollapsedKey)}
        />
      )}
      {/* Message header */}
      <div
        className={`flex items-center py-1.5 gap-2 select-none ${isUser ? 'px-3 sm:px-4 flex-row-reverse' : 'px-3 sm:px-4'}`}
      >
        {/* Chevron — far left for both message types */}
        {!isUser && (
          <span
            role="button"
            tabIndex={0}
            aria-expanded={!isCollapsed}
            className={`text-muted-foreground/50 text-xs w-3 cursor-pointer transition-transform hover:text-foreground/70 shrink-0 ${!isCollapsed ? 'rotate-90' : ''}`}
            onClick={() => onToggleCollapse(index)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCollapse(index); } }}
          >›</span>
        )}
        {/* ✏️ Canvas badge — visible even when collapsed, helps locate canvases in chat history */}
        {appEmbeds.length > 0 && (
          <span className="cockpit-badge" data-tone="info" title="Contains embedded canvas">✏️ Canvas</span>
        )}
        {/* 📎 Attachment indicator — paperclip + count when message has images or uploads */}
        {(msg.images?.length || msg.uploadAttachments?.length) ? (
          <span className="cockpit-badge" data-tone="info" title={`${(msg.images?.length || 0) + (msg.uploadAttachments?.length || 0)} file(s) attached`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-0.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
            {(msg.images?.length || 0) + (msg.uploadAttachments?.length || 0)}
          </span>
        ) : null}
        {isCollapsed && preview && (
          <span className="text-muted-foreground text-[0.667rem] opacity-60 overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">
            {isSystem && msg.rawText && /```/.test(msg.rawText) && (
              <span className="text-orange/70 mr-1" title="Contains code">{'</>'}</span>
            )}
            {preview}
          </span>
        )}

        {/* User chevron — last DOM element, far left in flex-row-reverse */}
        {isUser && (
          <span
            role="button"
            tabIndex={0}
            aria-expanded={!isCollapsed}
            className={`text-muted-foreground/50 text-xs w-3 cursor-pointer transition-transform hover:text-foreground/70 shrink-0 ${!isCollapsed ? 'rotate-90' : ''}`}
            onClick={() => onToggleCollapse(index)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCollapse(index); } }}
          >›</span>
        )}
      </div>
      {!isCollapsed && (
        <div className={`relative pb-2 ${isUser ? 'px-3 sm:px-4' : 'px-3 sm:px-4'}`}>
          {msg.images && msg.images.length > 0 && !(isAssistant && msg.extractedImages && msg.extractedImages.length > 0) && (
            <div className={`flex gap-2 flex-wrap mb-2 ${isUser ? 'justify-end' : ''}`}>
              {msg.images.map((img, j) => 
                isAssistant ? (
                  <ImageLightbox key={j} src={img.preview} alt={img.name || 'image'} thumbnailClassName="max-w-[200px] max-h-[150px] rounded border border-border/60 object-contain cursor-pointer hover:border-primary/60 transition-colors" />
                ) : (
                  <img key={j} src={img.preview} alt={img.name || 'image'} className="max-w-[200px] max-h-[150px] rounded border border-border/60 object-contain" />
                )
              )}
            </div>
          )}
          <div className="flex items-center gap-2 mb-0.5">
            <AvatarIcon name={msg.role === 'user' ? 'You' : (agentName || 'Agent')} size="sm" />
            <span className="text-[0.733rem] font-semibold text-foreground/80">{msg.role === 'user' ? 'You' : (agentName || 'Agent')}</span>
            <span className="text-[0.6rem] text-muted-foreground/50 tabular-nums">{timeStr}{missionTime ? <span className="ml-1 opacity-60">· {missionTime}</span> : ''}</span>
          </div>
          <div className={`msg-body text-foreground text-[0.867rem] ${isUser ? 'block w-full min-w-0 max-w-full pr-1.5 text-left sm:pr-0' : ''} ${isAssistant ? (isStructuredMarkdown(msg.rawText) ? 'max-w-[1120px]' : 'max-w-[68ch]') : ''}`}>
            {isVoiceMessage && (
              <span className="cockpit-badge mr-2 inline-flex align-middle" data-tone="primary">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                Voice
              </span>
            )}
            {cleanDisplayContent && (
              <Suspense fallback={<div className="text-muted-foreground text-xs">Loading…</div>}>
                <MarkdownRenderer content={cleanDisplayContent} searchQuery={searchQuery} suppressImages={isAssistant} onOpenWorkspacePath={onOpenWorkspacePath} pathLinkPrefixes={pathLinkPrefixes} pathLinkAliases={pathLinkAliases} onOpenBeadId={onOpenBeadId} />
              </Suspense>
            )}

            {/* Embedded apps */}
            {appEmbeds.length > 0 && (
              <div className="mt-2 space-y-2">
                {appEmbeds.map((embedConfig: import('@/lib/nerve-app').AppEmbedConfig, idx: number) => (
                  <AppEmbed key={idx} config={embedConfig} onExtract={(extractedData: unknown) => {
                    // Save extracted canvas data back to the tldraw server
                    try {
                      const src = embedConfig.src;
                      if (src) {
                        const url = new URL(src);
                        const sessionId = url.searchParams.get('session');
                        const origin = url.origin;
                        if (sessionId && origin) {
                          // Extract the tldraw snapshot from the postMessage payload
                          const payload = (extractedData && typeof extractedData === 'object')
                            ? (extractedData as Record<string, unknown>)
                            : {};
                          const snapshot = ((payload as { data?: unknown }).data) || payload;
                          const summary = typeof (payload as { summary?: string }).summary === 'string'
                            ? (payload as { summary: string }).summary
                            : 'extracted from canvas';
                          fetch(`${origin}/api/canvas/${encodeURIComponent(sessionId)}/state`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ snapshot, summary }),
                          }).catch(() => {/* best-effort */});
                        }
                      }
                    } catch {/* ignore */}
                  }} />
                ))}
              </div>
            )}
          </div>
          {msg.charts && msg.charts.length > 0 && (
            <div className="w-full max-w-[1120px]">
              <Suspense fallback={<div className="text-muted-foreground text-xs">Loading chart…</div>}>
                {msg.charts.map((chart, ci) => (
                  <InlineChart key={ci} chart={chart} />
                ))}
              </Suspense>
            </div>
          )}
          {msg.uploadAttachments && msg.uploadAttachments.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {msg.uploadAttachments.map((attachment) => (
                <div key={attachment.id} className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-[0.733rem] text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{attachment.name}</span>
                    <span className="cockpit-badge" data-tone={attachment.mode === 'file_reference' ? 'warning' : 'primary'}>
                      {attachment.mode === 'file_reference' ? 'Local File' : 'Inline'}
                    </span>
                    <span>{formatBytes(attachment.sizeBytes)}</span>
                    <span>{attachment.mimeType}</span>
                  </div>
                  {attachment.reference?.path && (
                    <div className="mt-1 font-mono text-[0.667rem] text-muted-foreground/90">{attachment.reference.path}</div>
                  )}
                </div>
              ))}
            </div>
          )}
          {msg.extractedImages && msg.extractedImages.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {msg.extractedImages.map((img, idx) => (
                <ImageLightbox
                  key={idx}
                  src={img.url}
                  alt={img.alt || 'Agent image'}
                />
              ))}
            </div>
          )}

          {/* Bottom toolbar — visible on hover with improved visibility */}
          {!msg.streaming && (
            <div className="flex items-center gap-1 mt-1.5 opacity-0 transition-opacity duration-200 delay-300 group-hover:opacity-85 hover:!opacity-100">
              <button
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[0.6rem] text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
                aria-label="Copy message to clipboard"
                title="Copy message"
                onClick={handleCopy}
              >
                <ClipboardCopy size={13} className={copied ? 'text-green' : ''} />
              </button>
              <span className="text-[0.6rem] text-muted-foreground/30">·</span>
              <button
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[0.6rem] text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
                aria-label="Think about this"
                title="Think about this"
              >
                <Brain size={13} />
              </button>
              <span className="text-[0.6rem] text-muted-foreground/30">·</span>
              <button
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[0.6rem] text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
                aria-label="Research this"
                title="Research this"
              >
                <BookOpen size={13} />
              </button>
              <span className="text-[0.6rem] text-muted-foreground/30">·</span>
              <button
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[0.6rem] text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
                aria-label="Read aloud"
                title="Read aloud"
                onClick={() => speak(msg.rawText)}
              >
                <Volume2 size={13} />
              </button>
              <span className="text-[0.5rem] text-muted-foreground/30">·</span>
              <button
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.533rem] text-muted-foreground/70 hover:text-foreground hover:bg-danger/70 transition-colors"
                aria-label="Delete message"
                title="Delete message"
              >
                <Trash2 size={11} />
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

/**
 * Memoized MessageBubble to prevent unnecessary re-renders.
 * 
 * Re-renders only when:
 * - Message content/state changes (tempId, pending, failed, streaming)
 * - Collapse state changes
 * - Search highlighting changes (query or current match status)
 * 
 * This is critical for chat performance as messages array can grow large,
 * and each keypress/scroll shouldn't re-render all messages.
 */
export const MessageBubble = memo(MessageBubbleInner, (prev, next) => {
  // Return true if props are equal (skip re-render)
  // Return false if props changed (do re-render)
  
  // Message identity and state
  if (prev.msg.tempId !== next.msg.tempId) return false;
  if (prev.msg.pending !== next.msg.pending) return false;
  if (prev.msg.failed !== next.msg.failed) return false;
  if (prev.msg.streaming !== next.msg.streaming) return false;
  
  // Collapse states
  if (prev.isCollapsed !== next.isCollapsed) return false;
  if (prev.isMemoryCollapsed !== next.isMemoryCollapsed) return false;
  
  // Search highlighting
  if (prev.searchQuery !== next.searchQuery) return false;
  if (prev.isCurrentMatch !== next.isCurrentMatch) return false;
  
  // Content changes (for streaming updates)
  if (prev.msg.rawText !== next.msg.rawText) return false;
  if (prev.msg.html !== next.msg.html) return false;
  
  // System notification fields
  if (prev.msg.isSystemNotification !== next.msg.isSystemNotification) return false;
  if (prev.msg.systemLabel !== next.msg.systemLabel) return false;
  
  // Thinking state
  if (prev.msg.isThinking !== next.msg.isThinking) return false;
  if (prev.msg.thinkingDurationMs !== next.msg.thinkingDurationMs) return false;
  
  // Charts
  if (prev.msg.charts?.length !== next.msg.charts?.length) return false;
  
  // Images and attachment metadata
  if (prev.msg.images?.length !== next.msg.images?.length) return false;
  if (prev.msg.extractedImages?.length !== next.msg.extractedImages?.length) return false;
  if ((prev.msg.uploadAttachments?.length || 0) !== (next.msg.uploadAttachments?.length || 0)) return false;
  if ((prev.msg.uploadAttachments || []).some((attachment, idx) => {
    const nextAttachment = next.msg.uploadAttachments?.[idx];
    return !nextAttachment
      || attachment.id !== nextAttachment.id
      || attachment.name !== nextAttachment.name
      || attachment.mode !== nextAttachment.mode
      || attachment.sizeBytes !== nextAttachment.sizeBytes
      || attachment.mimeType !== nextAttachment.mimeType
      || attachment.reference?.path !== nextAttachment.reference?.path;
  })) return false;
  
  // Agent name (rare change but must re-render when it does)
  if (prev.agentName !== next.agentName) return false;
  if (prev.onOpenWorkspacePath !== next.onOpenWorkspacePath) return false;
  if (prev.pathLinkPrefixes !== next.pathLinkPrefixes) return false;
  if (prev.pathLinkAliases !== next.pathLinkAliases) return false;
  if (prev.onOpenBeadId !== next.onOpenBeadId) return false;
  
  // All relevant props are equal, skip re-render
  return true;
});

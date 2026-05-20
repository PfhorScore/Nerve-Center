import { useRef, useState, useCallback, useEffect } from 'react';
import { X, Maximize2, Minimize2, Download, Loader2, ExternalLink, PanelRightOpen } from 'lucide-react';
import type { AppEmbedConfig } from '@/lib/nerve-app';

interface AppEmbedProps {
  config: AppEmbedConfig;
  /** Called with extracted data when the user clicks "extract" */
  onExtract?: (data: unknown) => void;
}

/** Render an embedded app in a sandboxed iframe with interaction controls. */
export function AppEmbed({ config, onExtract }: AppEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const embedRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [popout, setPopout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [extracted, setExtracted] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const height = expanded ? Math.min(window.innerHeight * 0.85, 800) : config.height || 400;

  // Listen for postMessage data from the iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'nerve:extract') return;
      setExtracted(JSON.stringify(event.data.payload, null, 2));
      onExtract?.(event.data.payload);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onExtract]);

  // Deactivate iframe when clicking outside
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      if (embedRef.current && !embedRef.current.contains(e.target as Node)) {
        setActive(false);
      }
    };
    // Delay adding listener so the activation click doesn't immediately trigger it
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handler);
    };
  }, [active]);

  const handleExtract = useCallback(() => {
    const src = config.src;
    if (!src) return;
    
    let canvasOrigin = '';
    let sessionId = '';
    try {
      const url = new URL(src);
      sessionId = url.searchParams.get('session') || '';
      canvasOrigin = url.origin;
    } catch { return; }
    if (!sessionId || !canvasOrigin) return;

    // 1. Tell the iframe to save to the server (postMessage TO iframe works)
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'nerve:save-and-extract' },
        '*',
      );
    }

    // 2. Also send the old get-data message for backward compat
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'nerve:get-data' }, '*');
    }

    // 3. Poll the server for saved data after a short delay
    setExtracted('Saving canvas...');
    
    const pollServer = (attempts: number) => {
      if (attempts <= 0) {
        setExtracted((prev) =>
          prev === 'Saving canvas...'
            ? 'No data saved yet. Draw something and try again.'
            : prev,
        );
        return;
      }

      fetch(`${canvasOrigin}/api/canvas/${encodeURIComponent(sessionId)}/state`, {
        signal: AbortSignal.timeout(4000),
      })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (data?.ok && data.data?.snapshot) {
            const pretty = JSON.stringify(data.data.snapshot, null, 2);
            setExtracted(pretty);
            onExtract?.(data.data.snapshot);
          } else {
            // Try again after a delay
            setTimeout(() => pollServer(attempts - 1), 1000);
          }
        })
        .catch(() => {
          setTimeout(() => pollServer(attempts - 1), 1000);
        });
    };

    // Poll up to 6 times (6 seconds total)
    pollServer(6);
  }, [config.src, onExtract]);

  const handleOpenExternal = useCallback(() => {
    if (config.src) {
      window.open(config.src, '_blank', 'noopener');
    }
  }, [config.src]);

  const iframeSrc = useCallback(() => {
    if (config.type === 'html' && config.html) {
      // For inline HTML, create a blob URL
      const blob = new Blob([config.html], { type: 'text/html' });
      return URL.createObjectURL(blob);
    }
    return config.src || '';
  }, [config]);

  const src = iframeSrc();

  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-secondary/30 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="cockpit-badge text-[0.6rem] uppercase tracking-wider">
            {config.type === 'tldraw' ? '✏️ Canvas' : config.type === 'html' ? '🖥 App' : '🔗 Embed'}
          </span>
          {config.src && (
            <span className="truncate text-[0.667rem] text-muted-foreground max-w-[200px]">
              {config.src}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Extract data */}
          {onExtract && (
            <button
              onClick={handleExtract}
              className="shell-icon-button min-h-7 px-2 text-[0.667rem]"
              title="Extract data from this app"
            >
              <Download size={11} />
              Extract
            </button>
          )}
          {/* Popout — float above chat */}
          {config.src && (
            <button
              onClick={() => setPopout(true)}
              className="shell-icon-button min-h-7 px-2"
              title="Pop out canvas"
            >
              <PanelRightOpen size={11} />
            </button>
          )}
          {/* Toggle expanded */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="shell-icon-button min-h-7 px-2"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 size={16} className="animate-spin mr-2" />
          <span className="text-xs">Loading embedded app...</span>
        </div>
      )}

      {/* Iframe wrapper with pointer-events management */}
      <div
        ref={embedRef}
        className="transition-all duration-200 overflow-hidden relative"
        style={{ height: loading ? 0 : height }}
      >
        {src ? (
          <>
            <iframe
              ref={iframeRef}
              src={src}
              className="h-full w-full border-0"
              style={{ pointerEvents: active ? 'auto' : 'none' }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="Embedded app"
              onLoad={() => { setLoading(false); setActive(false); }}
              onError={() => setLoading(false)}
            />
            {!active && (
              // Overlay to capture first click and activate the iframe
              <div
                className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-black/10 backdrop-blur-[1px] transition-opacity hover:bg-black/15"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setActive(true);
                }}
              >
                <div className="rounded-lg bg-black/50 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm">
                  Click to interact
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <span className="text-xs">No source URL provided for this embedded app.</span>
          </div>
        )}
      </div>

      {/* Extracted data display */}
      {extracted && (
        <div className="border-t border-border/40 bg-background/40">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[0.6rem] font-medium uppercase tracking-wider text-muted-foreground">
              Extracted Data
            </span>
            <button
              onClick={() => setExtracted(null)}
              className="shell-icon-button min-h-6 px-1.5"
            >
              <X size={10} />
            </button>
          </div>
          <pre className="max-h-[200px] overflow-auto px-3 pb-2 font-mono text-[0.667rem] text-foreground/80 whitespace-pre-wrap">
            {extracted}
          </pre>
        </div>
      )}

      {/* Popout overlay — floats above chat */}
      {popout && src && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setPopout(false)}
        >
          <div
            className="relative flex h-[90vh] w-[90vw] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popout toolbar */}
            <div className="flex items-center justify-between border-b border-border/40 bg-secondary/30 px-4 py-3">
              <span className="text-sm font-medium text-foreground/80">
                ✏️ Canvas {config.src?.includes('session=') ? config.src.split('session=')[1]?.split(/[&?]/)[0] : ''}
              </span>
              <div className="flex items-center gap-2">
                {onExtract && (
                  <button
                    onClick={handleExtract}
                    className="shell-icon-button min-h-8 px-3 text-xs"
                  >
                    <Download size={12} className="mr-1" />
                    Extract
                  </button>
                )}
                <button
                  onClick={handleOpenExternal}
                  className="shell-icon-button min-h-8 px-3 text-xs"
                  title="Open in browser tab"
                >
                  <ExternalLink size={12} className="mr-1" />
                  New Tab
                </button>
                <button
                  onClick={() => setPopout(false)}
                  className="shell-icon-button min-h-8 px-3"
                  title="Close popout"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {/* Popout iframe */}
            <iframe
              src={src}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="Canvas popout"
            />
          </div>
        </div>
      )}
    </div>
  );
}

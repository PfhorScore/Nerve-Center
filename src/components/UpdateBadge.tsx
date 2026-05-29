import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUpCircle, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface VersionCheck {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  projectDir?: string | null;
}

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Shows an update badge next to the version in the status bar
 * when a newer version is available. Clicking it opens a modal
 * with update instructions and an "Update & Restart" button.
 */
export function UpdateBadge() {
  const [versionInfo, setVersionInfo] = useState<VersionCheck | null>(null);
  const [open, setOpen] = useState(false);
  const [updateState, setUpdateState] = useState<'idle' | 'updating' | 'done' | 'error'>('idle');
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    const check = async () => {
      try {
        const res = await fetch('/api/version/check', { signal: ac.signal });
        if (!res.ok) return;
        const data: VersionCheck = await res.json();
        setVersionInfo(data);
      } catch {
        // Silently ignore
      }
    };
    check();
    const iv = setInterval(check, CHECK_INTERVAL_MS);
    return () => { ac.abort(); clearInterval(iv); };
  }, []);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [updateLog]);

  const handleUpdate = useCallback(async () => {
    setUpdateState('updating');
    setUpdateLog([]);
    setUpdateError(null);

    try {
      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        setUpdateError(`Server returned ${res.status}`);
        setUpdateState('error');
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setUpdateError('No response body');
        setUpdateState('error');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            // event type — skip to data line
            continue;
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              let msg = '';
              if (data.message) msg = data.message;
              else if (data.name) msg = `${data.name} (${data.current}/${data.total})`;
              
              if (msg) {
                setUpdateLog(prev => [...prev, msg]);
              }

              if (data.success !== undefined) {
                if (data.success) {
                  setUpdateState('done');
                } else {
                  setUpdateError(data.error || 'Update failed');
                  setUpdateState('error');
                }
              }
            } catch {
              // Skip unparseable data
            }
          }
        }
      }

      // Stream ended — if not already done/error, check once more
      setUpdateState(prev => prev === 'updating' ? 'done' : prev);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : String(err));
      setUpdateState('error');
    }
  }, []);

  if (!versionInfo?.updateAvailable || !versionInfo.latest || !versionInfo.projectDir) return null;

  const quotedProjectDir = shellQuote(versionInfo.projectDir);
  const updateCommand = `cd ${quotedProjectDir} && npm run update -- --yes`;
  const dryRunCommand = `cd ${quotedProjectDir} && npm run update -- --dry-run`;
  const pinVersionCommand = `cd ${quotedProjectDir} && npm run update -- --version v${versionInfo.latest} --yes`;
  const docsCommand = `cd ${quotedProjectDir} && cat docs/UPDATING.md`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[0.6rem] text-primary hover:text-primary/80 transition-colors cursor-pointer ml-1.5"
        title={`Update available: v${versionInfo.latest}`}
        aria-label={`Update available: version ${versionInfo.latest}. Click for instructions.`}
      >
        <ArrowUpCircle className="w-3 h-3" />
        <span className="uppercase tracking-wide font-bold">update</span>
      </button>

      <Dialog open={open} onOpenChange={(next) => { if (!next && updateState !== 'updating') { setOpen(false); setUpdateState('idle'); setUpdateLog([]); setUpdateError(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Available</DialogTitle>
            <DialogDescription>
              Nerve Center{' '}
              <span className="font-mono font-semibold text-foreground">v{versionInfo.latest}</span> is
              available. You're running{' '}
              <span className="font-mono text-muted-foreground">v{versionInfo.current}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {updateState === 'idle' && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Project directory</p>
                  <pre className="bg-secondary rounded-md px-3 py-2 text-xs font-mono text-muted-foreground select-all whitespace-pre-wrap break-all">
                    {versionInfo.projectDir}
                  </pre>
                </div>
                <button
                  onClick={handleUpdate}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/15 text-primary hover:bg-primary/25 transition-colors px-4 py-2.5 text-[0.733rem] font-semibold uppercase tracking-wider"
                >
                  <ArrowUpCircle size={16} />
                  Update & Restart
                </button>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>This will fetch the latest release, rebuild, restart, and verify health.</p>
                  <p>If anything fails, Nerve Center automatically rolls back to your current version.</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Or manually:</p>
                  <pre className="bg-secondary rounded-md px-3 py-2 text-xs font-mono text-muted-foreground whitespace-pre-wrap">
{`# Copy and paste this into a terminal:
${updateCommand}

# Preview first
${dryRunCommand}

# Pin to a specific version
${pinVersionCommand}

# See full docs
${docsCommand}`}
                  </pre>
                </div>
              </>
            )}

            {updateState === 'updating' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-foreground/80">
                  <Loader2 size={16} className="animate-spin text-primary" />
                  Updating...
                </div>
                <div className="bg-secondary/50 rounded-xl px-3 py-2 max-h-[200px] overflow-y-auto text-[0.667rem] font-mono text-muted-foreground">
                  {updateLog.map((msg, i) => (
                    <div key={i} className="py-0.5">{msg}</div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            )}

            {updateState === 'done' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green">
                  <CheckCircle size={16} />
                  Update complete!
                </div>
                <p className="text-xs text-muted-foreground">
                  The server has been updated. The page will reload to connect to the new version.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/15 text-primary hover:bg-primary/25 transition-colors px-4 py-2.5 text-[0.733rem] font-semibold uppercase tracking-wider"
                >
                  Reload
                </button>
              </div>
            )}

            {updateState === 'error' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-red">
                  <AlertCircle size={16} />
                  Update failed
                </div>
                {updateError && (
                  <pre className="bg-red/5 border border-red/20 rounded-xl px-3 py-2 text-[0.667rem] font-mono text-red/80 whitespace-pre-wrap">
                    {updateError}
                  </pre>
                )}
                <div className="bg-secondary/50 rounded-xl px-3 py-2 max-h-[200px] overflow-y-auto text-[0.667rem] font-mono text-muted-foreground">
                  {updateLog.map((msg, i) => (
                    <div key={i} className="py-0.5">{msg}</div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  You can also update manually by running the command in a terminal.
                </p>
                <button
                  onClick={handleUpdate}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/15 text-primary hover:bg-primary/25 transition-colors px-4 py-2.5 text-[0.733rem] font-semibold uppercase tracking-wider"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

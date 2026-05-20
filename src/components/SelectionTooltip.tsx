import { useState, useEffect, useCallback } from 'react';

/**
 * "Research this?" tooltip — appears when the user selects text anywhere in Nerve.
 * Clicking it sends the selected text to the Research tab for deep search.
 */
export function SelectionTooltip() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');

  const handleResearch = useCallback(() => {
    if (!selectedText.trim()) return;
    // Store as a direct query (not a transcript) so Research tab populates search bar directly
    try {
      sessionStorage.setItem('nerve:research-direct-query', selectedText.trim().slice(0, 500));
    } catch {}
    window.dispatchEvent(new CustomEvent('nerve:send-to-research', { detail: { text: selectedText.trim() } }));
    setPos(null);
    setSelectedText('');
  }, [selectedText]);

  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      // Small delay to let the browser update the selection
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim() || '';
        if (text.length > 5 && text.length < 1000) {
          setSelectedText(text);
          setPos({ x: e.clientX, y: e.clientY });
        } else {
          // Hide if clicking elsewhere, but with a delay so button clicks work
          setTimeout(() => { setPos(null); setSelectedText(''); }, 200);
        }
      }, 10);
    };

    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

  if (!pos || !selectedText) return null;

  return (
    <div
      className="fixed z-[9999] pointer-events-auto"
      style={{ left: pos.x - 60, top: pos.y + 12 }}
    >
      <button
        onClick={handleResearch}
        className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card shadow-lg px-3 py-1.5 text-[0.6rem] font-medium text-foreground/80 transition-colors hover:bg-secondary/40 hover:text-primary whitespace-nowrap"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        Research this
      </button>
    </div>
  );
}

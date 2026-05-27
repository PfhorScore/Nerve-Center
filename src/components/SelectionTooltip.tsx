import { useState, useEffect, useCallback, useRef } from 'react';
import { Search } from 'lucide-react';

function isExcludedElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  // Walk up the DOM to check if any ancestor is an excluded element
  let el: HTMLElement | null = target;
  while (el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'button' || tag === 'header' || tag === 'nav') return true;
    if (el.getAttribute('role') === 'button') return true;
    if (el.closest('.panel-header, .shell-panel, .cockpit-badge, .shell-chip, .shell-icon-button, .cockpit-chip, .topbar-mobile-compact, .panel-label')) return true;
    el = el.parentElement;
  }
  return false;
}

/**
 * "Research this?" tooltip — appears when the user selects text in the chat area.
 * Ignores selections in UI chrome (headers, buttons, badges).
 * Uses a debounce delay to avoid flashing on accidental selections.
 * Semi-transparent by default, full opacity on hover.
 */
export function SelectionTooltip() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleResearch = useCallback(() => {
    if (!selectedText.trim()) return;
    try {
      sessionStorage.setItem('nerve:research-direct-query', selectedText.trim().slice(0, 500));
    } catch {}
    window.dispatchEvent(new CustomEvent('nerve:send-to-research', { detail: { text: selectedText.trim() } }));
    setPos(null);
    setSelectedText('');
    setVisible(false);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
  }, [selectedText]);

  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      // Don't trigger on UI chrome elements
      if (isExcludedElement(e.target)) return;

      if (showTimer.current !== null) clearTimeout(showTimer.current);
      if (hideTimer.current !== null) clearTimeout(hideTimer.current);

      // Small delay to let the browser update the selection
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim() || '';
        if (text.length > 10 && text.length < 1000) {
          setSelectedText(text);
          setPos({ x: e.clientX, y: e.clientY });
          // Delay before showing — prevents flashing on accidental selections
          showTimer.current = setTimeout(() => {
            setVisible(true);
            // Auto-fade after 4 seconds so it doesn't linger forever
            fadeTimer.current = setTimeout(() => {
              setVisible(false);
              hideTimer.current = setTimeout(() => { setPos(null); setSelectedText(''); }, 300);
            }, 4000);
          }, 1200);
        } else {
          setVisible(false);
          hideTimer.current = setTimeout(() => { setPos(null); setSelectedText(''); }, 200);
        }
      }, 10);
    };

    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      if (showTimer.current !== null) clearTimeout(showTimer.current);
      if (hideTimer.current !== null) clearTimeout(hideTimer.current);
      if (fadeTimer.current !== null) clearTimeout(fadeTimer.current);
    };
  }, []);

  if (!pos || !selectedText) return null;

  return (
    <div
      className={`fixed z-[9999] pointer-events-auto transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      // Position lower and further from cursor to avoid obscuring the selection
      style={{ left: pos.x - 60, top: pos.y + 32 }}
    >
      <button
        onClick={handleResearch}
        onMouseEnter={() => {
          if (showTimer.current) clearTimeout(showTimer.current);
          if (fadeTimer.current) clearTimeout(fadeTimer.current);
          setVisible(true);
        }}
        onMouseLeave={() => {
          // Restart fade countdown when leaving
          if (fadeTimer.current) clearTimeout(fadeTimer.current);
          fadeTimer.current = setTimeout(() => {
            setVisible(false);
            hideTimer.current = setTimeout(() => { setPos(null); setSelectedText(''); }, 300);
          }, 2000);
        }}
        className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/70 backdrop-blur-sm shadow-lg px-3 py-1.5 text-[0.6rem] font-medium text-foreground/60 transition-all hover:bg-secondary/40 hover:text-primary hover:text-foreground/90 whitespace-nowrap"
      >
        <Search size={12} />
        Research this
      </button>
    </div>
  );
}

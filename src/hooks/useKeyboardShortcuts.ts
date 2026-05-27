import { useEffect, useCallback, useRef } from 'react';

export interface ShortcutConfig {
  key: string;
  meta?: boolean;      // Cmd on Mac, Ctrl on Win/Linux
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  preventDefault?: boolean;
  /** If true, the shortcut only fires when no input/textarea is focused */
  global?: boolean;
  /** If true, the shortcut is skipped when a CodeMirror editor is focused */
  skipInEditor?: boolean;
  /** If true, the shortcut is skipped when a textarea (e.g. Thoughts) is focused */
  skipInTextarea?: boolean;
}

/**
 * Global keyboard shortcuts hook.
 * - `meta` matches Cmd (Mac) or Ctrl (Win/Linux)
 * - Shortcuts are disabled when typing in inputs unless `global: true`
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  // Use ref to avoid recreating listener on every render
  const shortcutsRef = useRef(shortcuts);
  
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
      (e.target as HTMLElement)?.tagName
    ) || (e.target as HTMLElement)?.isContentEditable;

    const isInCodeMirror = Boolean(
      (e.target as HTMLElement)?.closest?.('.cm-editor')
    );

    for (const shortcut of shortcutsRef.current) {
      // Skip global shortcuts when focused on input (unless explicitly allowed)
      if (shortcut.global && isInputFocused) continue;
      // Let CodeMirror handle its own shortcuts (e.g. Cmd+F for search)
      if (shortcut.skipInEditor && isInCodeMirror) continue;
      // Let textareas (e.g. Thoughts scratch-pad) handle their own shortcuts
      if (shortcut.skipInTextarea && isInputFocused) continue;

      const metaMatch = shortcut.meta 
        ? (e.metaKey || e.ctrlKey) 
        : (!e.metaKey || shortcut.ctrl);
      const ctrlMatch = shortcut.ctrl 
        ? e.ctrlKey 
        : (!e.ctrlKey || shortcut.meta);
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey;
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

      if (metaMatch && ctrlMatch && shiftMatch && altMatch && keyMatch) {
        if (shortcut.preventDefault !== false) {
          e.preventDefault();
          e.stopPropagation();
        }
        shortcut.handler();
        return;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleKeyDown]);
}

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Props for {@link ContextMenu}.
 */
interface ContextMenuProps {
  /** Whether the menu is visible. */
  open: boolean;
  /** Pixel position where the menu should appear. */
  position: { x: number; y: number };
  /** Called when the menu should close (click outside, Escape, action taken). */
  onClose: () => void;
  /** Menu items to render. */
  children: ReactNode;
}

/**
 * Lightweight right-click context menu.
 *
 * Renders at the cursor position with a subtle entrance animation and
 * auto-closes on outside click, Escape key, or after an action is taken.
 * Position is clamped to stay within the viewport.
 *
 * ## Usage
 *
 * ```tsx
 * const [menu, setMenu] = useState<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 });
 *
 * <div onContextMenu={(e) => { e.preventDefault(); setMenu({ open: true, x: e.clientX, y: e.clientY }); }}>
 *   <ContextMenu open={menu.open} position={{ x: menu.x, y: menu.y }} onClose={() => setMenu({ ...menu, open: false })}>
 *     <button onClick={...}>Action</button>
 *   </ContextMenu>
 * </div>
 * ```
 */
export function ContextMenu({ open, position, onClose, children }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the right-click event itself triggering close
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  // Clamp position to viewport edges (leave 8px breathing room)
  const clampedX = Math.min(position.x, window.innerWidth - 8);
  const clampedY = Math.min(position.y, window.innerHeight - 8);

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] animate-in fade-in zoom-in-95 duration-100"
      style={{ left: clampedX, top: clampedY }}
      role="menu"
      aria-orientation="vertical"
    >
      <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-[0_16px_48px_rgba(0,0,0,0.35)] py-1 min-w-[180px]">
        {children}
      </div>
    </div>
  );
}

/**
 * A single item in a {@link ContextMenu}.
 *
 * Supports an active/selected state (e.g., for toggle checkmarks) and
 * auto-closes the parent menu via {@link onClose} when clicked.
 */
export function ContextMenuItem({
  children,
  onClick,
  active,
  danger,
  onClose,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  onClose: () => void;
}) {
  return (
    <button
      onClick={() => {
        onClick();
        onClose();
      }}
      className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-[0.733rem] transition-colors ${
        danger
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-foreground/80 hover:bg-foreground/[0.06] hover:text-foreground'
      }`}
      role="menuitem"
    >
      {/* Checkmark placeholder for active state */}
      <span className="w-4 shrink-0 text-[0.6rem]">
        {active ? '✓' : ''}
      </span>
      <span className="flex-1">{children}</span>
    </button>
  );
}

/**
 * Visual divider between groups of {@link ContextMenuItem} entries.
 */
export function ContextMenuDivider() {
  return <div className="my-1 mx-3 border-t border-border/40" />;
}

import { useState, useRef, useCallback, useEffect, useLayoutEffect, type ReactNode } from 'react';

/** Props for {@link ResizablePanels}. */
interface ResizablePanelsProps {
  /** Content rendered in the left pane. */
  left: ReactNode;
  /** Content rendered in the right pane. */
  right: ReactNode;
  /** Current width of the left pane as a percentage (0–100). */
  leftPercent: number;
  /** Callback fired on drag-end with the new left-pane percentage. */
  onResize: (leftPercent: number) => void;
  /** Minimum left-pane width percentage. @default 30 */
  minLeftPercent?: number;
  /** Maximum left-pane width percentage. @default 85 */
  maxLeftPercent?: number;
  /** Additional class names for the left pane wrapper. */
  leftClassName?: string;
  /** Additional class names for the right pane wrapper. */
  rightClassName?: string;
  /** Fixed pixel width for the right pane. When set, the left pane absorbs remaining width. */
  rightWidthPx?: number | null;
  /** Reports the computed right pane width while ratio mode is active. */
  onRightWidthChange?: (width: number) => void;
}

/**
 * Horizontally resizable two-pane layout with a draggable divider.
 *
 * Supports drag resizing, clamped min/max constraints, and double-click
 * to auto-size the right panel to fit its content. Used as the main
 * layout container in the Nerve Center cockpit (sessions list + chat area).
 */
export function ResizablePanels({
  left,
  right,
  leftPercent,
  onResize,
  minLeftPercent = 30,
  maxLeftPercent = 85,
  leftClassName = '',
  rightClassName = '',
  rightWidthPx = null,
  onRightWidthChange,
}: ResizablePanelsProps) {
  const [localPercent, setLocalPercent] = useState(leftPercent);
  const [localRightWidth, setLocalRightWidth] = useState<number | null>(rightWidthPx);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Sync local state when prop changes (e.g., from localStorage load)
  useEffect(() => {
    if (!isDragging.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync from controlled prop
      setLocalPercent(leftPercent);
    }
  }, [leftPercent]);

  useEffect(() => {
    if (!isDragging.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync from controlled prop in fixed-width mode
      setLocalRightWidth(rightWidthPx);
    }
  }, [rightWidthPx]);

  useLayoutEffect(() => {
    if (!containerRef.current || rightWidthPx !== null || !onRightWidthChange) return;

    const reportWidth = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.getBoundingClientRect().width;
      const width = containerWidth * ((100 - localPercent) / 100);
      onRightWidthChange(width);
    };

    reportWidth();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => reportWidth());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [localPercent, onRightWidthChange, rightWidthPx]);

  /**
   * Clamp a percentage value within the configured min/max bounds.
   *
   * Used by both the drag resize and double-click auto-fit paths to
   * ensure the left panel never shrinks below {@link minLeftPercent}
   * or grows beyond {@link maxLeftPercent}.
   */
  const clampPercent = useCallback((percent: number) => (
    Math.max(minLeftPercent, Math.min(maxLeftPercent, percent))
  ), [minLeftPercent, maxLeftPercent]);

  /**
   * Convert a pointer X coordinate to a clamped left-panel percentage
   * and update local state accordingly.
   *
   * Called on every `mousemove` during an active drag. Also handles
   * the fixed-pixel-width mode (`rightWidthPx`) by recalculating the
   * right panel's pixel width alongside the percentage.
   *
   * @returns The clamped percentage that was applied, or `null` if
   *   the container ref is unavailable.
   */
  const applyPointerPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return null;

    const rect = containerRef.current.getBoundingClientRect();
    const rawPercent = ((clientX - rect.left) / rect.width) * 100;
    const clampedPercent = clampPercent(rawPercent);

    setLocalPercent(clampedPercent);

    if (rightWidthPx !== null) {
      const nextRightWidth = rect.width * ((100 - clampedPercent) / 100);
      setLocalRightWidth(nextRightWidth);
      onRightWidthChange?.(nextRightWidth);
    }

    return clampedPercent;
  }, [clampPercent, onRightWidthChange, rightWidthPx]);

  /**
   * Begin a resize drag operation.
   *
   * Sets the `isDragging` flag (a ref to avoid re-renders during drag)
   * and applies body-level cursor/user-select overrides so the drag
   * feels native even if the pointer leaves the handle element.
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  /**
   * Global `mousemove` listener — only active while {@link isDragging}
   * is `true`. Delegates to {@link applyPointerPosition} for the actual
   * percentage calculation.
   */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    applyPointerPosition(e.clientX);
  }, [applyPointerPosition]);

  /**
   * End a resize drag operation.
   *
   * Resets the dragging flag, restores body styles, and commits the
   * final percentage to the parent via {@link onResize}.
   */
  const handleMouseUp = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onResize(localPercent);
    }
  }, [localPercent, onResize]);

  /**
   * Double-click handler: auto-sizes the right panel to fit its content.
   *
   * ## Measurement technique
   *
   * To determine the right panel's natural content width, we temporarily
   * unconstrain it (`flex: 0 0 auto; width: max-content`), read
   * `scrollWidth`, and restore the original styles — all synchronously
   * within the same event handler tick. The browser does not paint between
   * the style mutation and the measurement read, so there is no visible
   * flash.
   *
   * The measured width is padded by 40 px for visual breathing room and
   * capped at 70 % of the container width (so the right panel never eats
   * more than 70 % of the screen).
   *
   * ## Edge cases
   *
   * - **No right panel found** (`children[2]` missing): Falls back to a
   *   55 % left / 45 % right split.
   * - **`rightWidthPx` mode**: When the right panel uses a fixed pixel
   *   width instead of a percentage, the auto-fit calculates the
   *   appropriate pixel width and propagates it via
   *   {@link onRightWidthChange}.
   * - **Synchronous layout**: The `getAttribute`/`setAttribute` round-trip
   *   ensures React-managed inline styles are not accidentally clobbered.
   */
  const handleDoubleClick = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerWidth = container.getBoundingClientRect().width;

    // Find the right panel (third child: left, handle, right)
    const rightPanel = container.children[2] as HTMLElement | undefined;

    let targetLeftPercent: number;

    if (rightPanel) {
      // Save original style so we can restore it after measurement
      const originalStyle = rightPanel.getAttribute('style') ?? '';

      // Temporarily unconstrain the right panel to measure its natural width
      rightPanel.style.flex = '0 0 auto';
      rightPanel.style.width = 'max-content';
      rightPanel.style.minWidth = '0';

      // Force synchronous layout and read natural content width
      const naturalWidth = rightPanel.scrollWidth;

      // Restore original style before we apply the new percentage
      rightPanel.setAttribute('style', originalStyle);

      // Add comfortable padding and cap at 70% of container
      const paddedWidth = Math.min(naturalWidth + 40, containerWidth * 0.7);
      const targetRightPercent = (paddedWidth / containerWidth) * 100;
      targetLeftPercent = clampPercent(100 - targetRightPercent);
    } else {
      // Fallback: reset to a sensible default
      targetLeftPercent = 55;
    }

    setLocalPercent(targetLeftPercent);

    if (rightWidthPx !== null) {
      const nextRightWidth = containerWidth * ((100 - targetLeftPercent) / 100);
      setLocalRightWidth(nextRightWidth);
      onRightWidthChange?.(nextRightWidth);
    }

    onResize(targetLeftPercent);
  }, [clampPercent, onResize, onRightWidthChange, rightWidthPx]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const effectiveRightWidth = rightWidthPx !== null ? Math.max(0, localRightWidth ?? rightWidthPx) : null;

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden">
      {/* Left panel */}
      <div
        className={`min-h-0 overflow-hidden ${leftClassName}`}
        style={effectiveRightWidth !== null ? { flex: '1 1 auto', minWidth: 0 } : { flex: `${localPercent} 1 0%`, minWidth: 0 }}
      >
        {left}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        className="group relative flex w-3 cursor-col-resize shrink-0 items-stretch justify-center"
        title="Drag to resize. Double click to auto-fit"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
      >
        <div className="pointer-events-none my-3 w-px rounded-full bg-border transition-colors group-hover:bg-primary/55 group-hover:shadow-[0_0_16px_rgba(0,0,0,0.22)] group-active:bg-primary/70" />
      </div>

      {/* Right panel — CSS transition for smooth sidebar collapse/expand */}
      <div
        className={`min-h-0 overflow-hidden ${rightClassName}`}
        style={effectiveRightWidth !== null ? { flex: '0 0 auto', width: `${effectiveRightWidth}px`, minWidth: 0, transition: 'width 400ms ease-in-out' } : { flex: `${100 - localPercent} 1 0%`, minWidth: 0 }}
      >
        {right}
      </div>
    </div>
  );
}

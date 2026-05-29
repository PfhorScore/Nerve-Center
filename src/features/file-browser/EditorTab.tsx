import { X, MessageSquare, LockKeyhole } from 'lucide-react';

interface EditorTabProps {
  id: string;
  label: string;
  active: boolean;
  pinned?: boolean;
  dirty?: boolean;
  locked?: boolean;
  tooltip?: string;
  /** Show a pulsing glow animation on the tab (used on the Chat tab during generation). */
  glow?: boolean;
  onSelect: () => void;
  onClose?: () => void;
  onMiddleClick?: () => void;
}

export function EditorTab({
  id,
  label,
  active,
  pinned,
  dirty,
  locked,
  tooltip,
  glow,
  onSelect,
  onClose,
  onMiddleClick,
}: EditorTabProps) {
  const isChat = id === 'chat';

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle-click to close
    if (e.button === 1 && !pinned && onMiddleClick) {
      e.preventDefault();
      onMiddleClick();
    }
  };

  return (
    <button
      role="tab"
      aria-selected={active}
      aria-controls={`tabpanel-${id}`}
      id={`tab-${id}`}
      className={`flex items-center gap-1.5 px-3 h-full text-[0.8rem] whitespace-nowrap border-b-2 shrink-0 ${
        glow && active
          ? 'border-primary text-foreground bg-background animate-pulse shadow-[0_0_12px_-2px_var(--color-primary)]'
          : active
            ? 'border-primary text-foreground bg-background'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
      } transition-colors`}
      onClick={onSelect}
      onMouseDown={handleMouseDown}
      title={tooltip || label}
    >
      {/* Icon */}
      {isChat && <MessageSquare size={13} className={active ? 'text-primary' : ''} />}
      {locked && <LockKeyhole size={11} className="text-primary" />}

      {/* Dirty indicator */}
      {dirty && !locked && (
        <span className="text-primary text-[0.667rem] leading-none">●</span>
      )}

      {/* Label */}
      <span className="max-w-[120px] truncate">{label}</span>

      {/* Close button */}
      {!pinned && onClose && (
        <button
          className="ml-1 p-0.5 rounded hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label={`Close ${label}`}
          tabIndex={-1}
        >
          <X size={12} />
        </button>
      )}
    </button>
  );
}

/**
 * Toast — Lightweight notification system for Nerve Center.
 *
 * Provides a global toast queue with auto-dismiss, click-to-navigate,
 * and accessibility support. Toasts appear in the top-right corner.
 */

import { useState, useCallback, useRef, useEffect, createContext, useContext, type ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, ExternalLink } from 'lucide-react';

/** Severity levels for toasts. */
export type ToastLevel = 'info' | 'success' | 'warning' | 'error';

/** A single toast notification. */
export interface Toast {
  id: string;
  message: string;
  level: ToastLevel;
  /** Optional click action — navigates to a view or runs a callback. */
  action?: { label: string; onClick: () => void };
  /** Auto-dismiss timeout in ms (0 = persistent, default 4000). */
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Counter for unique toast IDs. */
let toastIdCounter = 0;

/**
 * Provider — wraps the app and renders the toast stack.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${++toastIdCounter}`;
    const duration = toast.duration ?? 4000;
    const entry: Toast = { ...toast, id };
    setToasts(prev => [...prev, entry]);
    if (duration > 0) {
      const timer = setTimeout(() => removeToast(id), duration);
      timersRef.current.set(id, timer);
    }
    return id;
  }, [removeToast]);

  // Cleanup timers on unmount
  useEffect(() => () => { timersRef.current.forEach(t => clearTimeout(t)); }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast stack — fixed position top-right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-200 rounded-xl border shadow-xl px-4 py-3 flex items-start gap-3 ${
              toast.level === 'success' ? 'bg-green/10 border-green/20 text-green' :
              toast.level === 'error' ? 'bg-red/10 border-red/20 text-red' :
              toast.level === 'warning' ? 'bg-orange/10 border-orange/20 text-orange' :
              'bg-card border-border/40 text-foreground'
            }`}
          >
            {toast.level === 'success' ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> :
             toast.level === 'error' ? <AlertCircle size={16} className="shrink-0 mt-0.5" /> :
             toast.level === 'warning' ? <AlertCircle size={16} className="shrink-0 mt-0.5" /> :
             <Info size={16} className="shrink-0 mt-0.5 text-muted-foreground" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs leading-relaxed">{toast.message}</p>
              {toast.action && (
                <button
                  onClick={() => { toast.action!.onClick(); removeToast(toast.id); }}
                  className="inline-flex items-center gap-1 mt-1 text-[0.6rem] font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity"
                >
                  {toast.action.label}
                  <ExternalLink size={10} />
                </button>
              )}
            </div>
            <button onClick={() => removeToast(toast.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Hook to add toasts from anywhere in the app. */
export function useToast(): Omit<ToastContextValue, 'toasts'> & { toast: (msg: string, level?: ToastLevel, action?: Toast['action']) => string } {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  const toast = useCallback((msg: string, level: ToastLevel = 'info', action?: Toast['action']) =>
    ctx.addToast({ message: msg, level, action }), [ctx]);
  return { addToast: ctx.addToast, removeToast: ctx.removeToast, toast };
}

/** Hook to read the current toast stack (for debugging or custom rendering). */
export function useToasts(): Toast[] {
  const ctx = useContext(ToastContext);
  if (!ctx) return [];
  return ctx.toasts;
}

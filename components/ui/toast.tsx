'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const toastStyles: Record<ToastType, { bg: string; border: string; icon: string; title: string }> = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-500',
    title: 'text-green-800',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-500',
    title: 'text-red-800',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    title: 'text-blue-800',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'text-amber-500',
    title: 'text-amber-800',
  },
};

const ToastIcon: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const styles = toastStyles[toast.type];
  const Icon = ToastIcon[toast.type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg',
        'animate-in slide-in-from-right-full duration-300',
        styles.bg,
        styles.border
      )}
      role="alert"
    >
      <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', styles.icon)} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', styles.title)}>{toast.title}</p>
        {toast.message && (
          <p className={cn('text-sm mt-1', styles.title, 'opacity-80')}>{toast.message}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className={cn('p-1 rounded hover:bg-black/5 transition-colors', styles.icon)}
        aria-label="Stäng"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string, duration = 5000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const toast: Toast = { id, type, title, message, duration };

      setToasts((prev) => [...prev, toast]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  const success = useCallback(
    (title: string, message?: string) => showToast('success', title, message),
    [showToast]
  );

  const error = useCallback(
    (title: string, message?: string) => showToast('error', title, message, 8000),
    [showToast]
  );

  const info = useCallback(
    (title: string, message?: string) => showToast('info', title, message),
    [showToast]
  );

  const warning = useCallback(
    (title: string, message?: string) => showToast('warning', title, message, 6000),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning, dismiss }}>
      {children}
      {/* Toast Container */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={() => dismiss(toast.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Inline alert component for forms and static messages
interface AlertProps {
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  children: ReactNode;
  className?: string;
  onDismiss?: () => void;
}

export function Alert({ type, title, children, className, onDismiss }: AlertProps) {
  const styles = toastStyles[type];
  const Icon = ToastIcon[type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border',
        styles.bg,
        styles.border,
        className
      )}
      role="alert"
    >
      <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', styles.icon)} />
      <div className="flex-1 min-w-0">
        {title && <p className={cn('text-sm font-medium', styles.title)}>{title}</p>}
        <div className={cn('text-sm', styles.title, title ? 'mt-1 opacity-80' : '')}>
          {children}
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={cn('p-1 rounded hover:bg-black/5 transition-colors', styles.icon)}
          aria-label="Stäng"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

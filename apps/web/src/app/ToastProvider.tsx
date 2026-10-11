import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Toast } from '../components';
import styles from './ToastProvider.module.css';

interface ToastOptions {
  message: string;
  action?: string;
  onAction?: () => void;
}

const ToastContext = createContext<((toast: ToastOptions) => void) | null>(null);

const VISIBLE_MS = 8000;

/** Shows one short confirmation at a time at the foot of the screen. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((next: ToastOptions) => {
    clearTimeout(timer.current);
    setToast(next);
    timer.current = setTimeout(() => setToast(null), VISIBLE_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div className={styles.host}>
          <Toast
            action={toast.action}
            onAction={() => {
              clearTimeout(timer.current);
              setToast(null);
              toast.onAction?.();
            }}
          >
            {toast.message}
          </Toast>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast needs a ToastProvider above it');
  return show;
}

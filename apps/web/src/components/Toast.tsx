import type { ReactNode } from 'react';
import styles from './Toast.module.css';

/** Ink confirmation toast with optional action (e.g. Poništi). */
export interface ToastProps {
  children?: ReactNode;
  action?: string;
  onAction?: () => void;
}

export function Toast({ children, action, onAction }: ToastProps) {
  return (
    <div role="status" className={styles.toast}>
      <span className={styles.dot} />
      <span className={styles.text}>{children}</span>
      {action && (
        <button type="button" onClick={onAction} className={styles.action}>
          {action}
        </button>
      )}
    </div>
  );
}

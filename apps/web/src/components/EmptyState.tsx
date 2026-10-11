import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

/** Calm empty state: Cinzel title, one line of guidance, optional action. */
export interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <span className={styles.title}>{title}</span>
      {children && <span className={styles.body}>{children}</span>}
      {action}
    </div>
  );
}

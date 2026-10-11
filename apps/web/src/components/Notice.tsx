import type { ReactNode } from 'react';
import styles from './Notice.module.css';

/** Blush attention block: unpaid items, health notes. */
export interface NoticeProps {
  title?: string;
  children?: ReactNode;
}

export function Notice({ title, children }: NoticeProps) {
  return (
    <div className={styles.notice}>
      {title && <span className={styles.title}>{title}</span>}
      <span className={styles.body}>{children}</span>
    </div>
  );
}

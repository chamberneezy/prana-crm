import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

/** Cinzel page title with right-aligned actions (search, one primary button). */
export interface PageHeaderProps {
  title: string;
  children?: ReactNode;
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {children}
    </div>
  );
}

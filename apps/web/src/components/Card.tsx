import type { CSSProperties, ReactNode } from 'react';
import styles from './Card.module.css';

/** White surface with a hairline border and 10px radius. No shadow. */
export interface CardProps {
  padding?: number | string;
  title?: string;
  overline?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Card({ padding = 24, title, overline, style, children }: CardProps) {
  return (
    <div className={styles.card} style={{ padding, ...style }}>
      {overline && <span className={styles.overline}>{overline}</span>}
      {title && <span className={styles.title}>{title}</span>}
      {children}
    </div>
  );
}

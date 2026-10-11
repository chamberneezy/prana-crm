import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './Tag.module.css';

/** Small label: plan (ink), flag (dashed sage), health (blush), neutral (mist). */
export interface TagProps {
  kind?: 'plan' | 'flag' | 'health' | 'neutral';
  children?: ReactNode;
}

export function Tag({ kind = 'neutral', children }: TagProps) {
  return <span className={cx(styles.tag, styles[kind])}>{children}</span>;
}

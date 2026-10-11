import { cx } from './cx';
import styles from './Stat.module.css';

/** Label + tabular metric. attention turns it clay (debts). */
export interface StatProps {
  label: string;
  value: string | number;
  attention?: boolean;
}

export function Stat({ label, value, attention = false }: StatProps) {
  return (
    <div className={cx(styles.stat, attention && styles.attention)}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}

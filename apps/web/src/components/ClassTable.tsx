import { useLang } from '../i18n';
import styles from './ClassTable.module.css';
import { cx } from './cx';

export interface ClassItem {
  time: string;
  title: string;
  /** A class token, e.g. `var(--class-spine)`. */
  color: string;
  teacher: string;
  booked: number;
  capacity: number;
  waitlist?: number;
}

/** Day schedule with class colour, teacher and capacity bar (terracotta when full). */
export interface ClassTableProps {
  date?: string;
  classes: ClassItem[];
  compact?: boolean;
}

export function ClassTable({ date, classes, compact = false }: ClassTableProps) {
  const { t } = useLang();
  return (
    <div className={styles.card}>
      {date && <div className={styles.date}>{date}</div>}
      <div className={styles.scroll}>
        <div className={cx(styles.table, compact && styles.compact)} role="table">
          <div className={styles.head} role="row">
            <span className={styles.time} role="columnheader">{t('classTable.time')}</span>
            <span className={styles.title} role="columnheader">{t('classTable.class')}</span>
            <span className={styles.teacher} role="columnheader">{t('classTable.teacher')}</span>
            <span className={styles.occupancy} role="columnheader">{t('classTable.occupancy')}</span>
          </div>
          {classes.map((c, i) => {
            const full = c.capacity > 0 && c.booked >= c.capacity;
            const pct = c.capacity > 0 ? Math.min(100, Math.round((c.booked / c.capacity) * 100)) : 0;
            return (
              <div key={i} className={styles.row} role="row">
                <span className={styles.time} role="cell">{c.time}</span>
                <span className={styles.title} role="cell">
                  <span className={styles.pill} style={{ background: c.color }} />
                  {c.title}
                </span>
                <span className={styles.teacher} role="cell">{c.teacher}</span>
                <span className={styles.occupancy} role="cell">
                  <span className={styles.bar}>
                    <span className={cx(styles.fill, full && styles.full)} style={{ width: `${pct}%` }} />
                  </span>
                  <span className={styles.count}>
                    {c.booked}/{c.capacity}
                    {c.waitlist ? ` · +${c.waitlist}` : ''}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useLang } from '../i18n';
import { cx } from './cx';
import styles from './MembershipCard.module.css';

/** Monthly usage of a weekly membership (1×/2×/3× tjedno ≈ 4/8/12 visits, or unlimited). */
export interface MembershipCardProps {
  plan?: string;
  used?: number;
  /** Visits per month; 0 = unlimited. */
  total?: number;
  /** dd.mm. date shown as an amber "Obnova" chip. */
  renewal?: string;
  period?: string;
}

export function MembershipCard({ plan = '2× tjedno', used = 0, total = 8, renewal, period }: MembershipCardProps) {
  const { t } = useLang();
  const unlimited = !total;
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.plan}>{plan}</span>
        {renewal && <span className={styles.renewal}>{t('membership.renewal', { date: renewal })}</span>}
      </div>
      {unlimited ? (
        <div className={styles.unlimitedBar} />
      ) : (
        <div className={styles.segments} style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={cx(styles.segment, i < used && styles.used)} />
          ))}
        </div>
      )}
      <div className={styles.foot}>
        {unlimited ? (
          <>
            <span>{t('membership.visits', { used })}</span>
            <span>{period || t('membership.unlimited')}</span>
          </>
        ) : (
          <>
            <span>{t('membership.usedOf', { used, total })}</span>
            <span>
              <strong className={styles.left}>{Math.max(0, total - used)}</strong> {t('membership.left')}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

import type { ApiMemberStatus } from '@prana/shared';
import type { ReactNode } from 'react';
import { useLang } from '../i18n';
import { cx } from './cx';
import styles from './StatusChip.module.css';

/** Membership / payment status chip: always a dot plus a word (trial is a dashed outline). */
export interface StatusChipProps {
  /** `none` (no current membership) is shown in stone, like frozen. */
  status?: ApiMemberStatus;
  /** Override the default label, e.g. "Ističe za 3 dana". */
  children?: ReactNode;
}

export function StatusChip({ status = 'active', children }: StatusChipProps) {
  const { t } = useLang();
  return (
    <span className={cx(styles.chip, styles[status])}>
      {status !== 'trial' && <span className={styles.dot} />}
      {children || t(`status.${status}`)}
    </span>
  );
}

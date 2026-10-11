import type { MemberStatus } from '@prana/shared';
import { Avatar } from './Avatar';
import { cx } from './cx';
import styles from './MemberRow.module.css';
import { StatusChip } from './StatusChip';
import { Tag } from './Tag';

/** One member in a list: avatar, name, plan/last visit, optional health note, status. */
export interface MemberRowProps {
  name: string;
  sub?: string;
  note?: string;
  status?: MemberStatus;
  statusLabel?: string;
  compact?: boolean;
  onClick?: () => void;
}

export function MemberRow({ name, sub, note, status = 'active', statusLabel, compact = false, onClick }: MemberRowProps) {
  const content = (
    <>
      <Avatar name={name} />
      <span className={styles.text}>
        <strong className={styles.name}>{name}</strong>
        {sub && <span className={styles.sub}>{sub}</span>}
      </span>
      <span className={styles.chips}>
        {note && <Tag kind="health">{note}</Tag>}
        <StatusChip status={status}>{statusLabel}</StatusChip>
      </span>
    </>
  );
  const className = cx(styles.row, compact && styles.compact);
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(className, styles.clickable)}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

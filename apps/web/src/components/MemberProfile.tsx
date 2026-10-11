import { ageFromDob, type ApiMemberStatus, type UpisnicaValue } from '@prana/shared';
import type { ReactNode } from 'react';
import { useLang } from '../i18n';
import { Avatar } from './Avatar';
import { Button } from './Button';
import styles from './MemberProfile.module.css';
import { StatusChip } from './StatusChip';
import { Tag } from './Tag';

/** Member profile built from the upisnica: plan, student flag, contacts with age, highlighted health note, consents. */
export interface MemberProfileProps {
  member: Partial<UpisnicaValue>;
  status?: ApiMemberStatus;
  /** Overrides the plan tag, e.g. for a trial. */
  planLabel?: string;
  /** Overrides the chip label, e.g. "Ističe za 3 dana". */
  statusLabel?: string;
  /** dd.mm.yyyy. */
  since?: string;
  onEdit?: () => void;
}

function Field({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{children || '—'}</span>
    </div>
  );
}

export function MemberProfile({ member: m, status = 'active', statusLabel, planLabel, since = '', onEdit }: MemberProfileProps) {
  const { t } = useLang();
  const age = m.dob ? ageFromDob(m.dob) : null;
  return (
    <div className={styles.profile}>
      <div className={styles.head}>
        <Avatar name={m.name || '?'} size={52} />
        <div className={styles.identity}>
          <span className={styles.name}>{m.name || t('profile.newMember')}</span>
          <span className={styles.since}>
            {t('profile.since', { date: since })}
            {m.consent ? ` · ${t('profile.signed')}` : ''}
          </span>
        </div>
        {onEdit && (
          <Button variant="secondary" size="sm" onClick={onEdit}>
            {t('profile.edit')}
          </Button>
        )}
      </div>

      <div className={styles.chips}>
        <StatusChip status={status}>{statusLabel}</StatusChip>
        {m.plan && status !== 'none' && <Tag kind="plan">{planLabel ?? t(`plan.${m.plan}`)}</Tag>}
        {m.student && <Tag kind="flag">{t('profile.student')}</Tag>}
        {m.news && <Tag kind="neutral">{t('profile.newsletter')}</Tag>}
      </div>

      <div className={styles.fields}>
        <Field label={t('profile.email')}>{m.email}</Field>
        <Field label={t('profile.phone')}>{m.phone}</Field>
        <Field label={t('profile.dob')}>{m.dob ? `${m.dob}${age === null ? '' : ` (${age})`}` : ''}</Field>
      </div>

      {m.health ? (
        <div className={styles.health}>
          <span className={styles.healthTitle}>{t('profile.healthTitle')}</span>
          <span className={styles.healthText}>{m.healthText || '—'}</span>
        </div>
      ) : (
        <span className={styles.noHealth}>{t('profile.noHealth')}</span>
      )}

      <div className={styles.consents}>
        <span>{m.consent ? `✓ ${t('profile.confirmed', { date: since })}` : `○ ${t('profile.pending')}`}</span>
        <span>{m.news ? `✓ ${t('profile.newsYes')}` : `○ ${t('profile.newsNo')}`}</span>
      </div>
    </div>
  );
}

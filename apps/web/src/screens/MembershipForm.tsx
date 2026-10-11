import { addDays, isoToDisplayDate, localDate, type MembershipView, monthPeriodEnd } from '@prana/shared';
import { type FormEvent, useState } from 'react';
import { errorMessage } from '../api/client';
import { useAddMembership, useFreezeMembership, usePlans, useRenewMembership } from '../api/queries';
import { useToast } from '../app/ToastProvider';
import { useMe } from '../auth/AuthProvider';
import { Button, Input, Notice, Select } from '../components';
import { useLang } from '../i18n';
import styles from './forms.module.css';

const period = (start: string) => `${isoToDisplayDate(start)}–${isoToDisplayDate(monthPeriodEnd(start))}`;

/** Start a membership for a member who has none: plan and first day; the period is one month. */
export function AddMembershipForm({ memberId, onDone }: { memberId: string; onDone: () => void }) {
  const { t, lang } = useLang();
  const toast = useToast();
  const { business } = useMe();
  const plans = usePlans();
  const add = useAddMembership();
  const [planId, setPlanId] = useState('');
  const [start, setStart] = useState(localDate(new Date(), business.timezone));
  const [tried, setTried] = useState(false);
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(start);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!planId || !validStart) return;
    add.mutate(
      { member_id: memberId, plan_id: planId, period_start: start },
      {
        onSuccess: () => {
          toast({ message: t('toast.membershipAdded') });
          onDone();
        },
      },
    );
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {add.error && <Notice>{errorMessage(add.error, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>}
      <Select
        label={t('membershipForm.plan')}
        value={planId}
        onChange={setPlanId}
        placeholder=""
        options={(plans.data?.plans ?? []).map((p) => ({ value: p.id, label: p.name }))}
        error={tried && !planId ? t('membershipForm.planRequired') : undefined}
      />
      <Input label={t('membershipForm.start')} type="date" value={start} onChange={(e) => setStart(e.target.value)} error={tried && !validStart ? t('sessionForm.dateRequired') : undefined} hint={validStart ? `${t('membershipForm.period')}: ${period(start)}` : undefined} />
      <div className={styles.actions}>
        <Button type="submit" disabled={add.isPending}>
          {t('membershipForm.save')}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

/** Renew: the next month, starting the day after the current period ends (or today, if that has passed). */
export function RenewMembershipForm({ membership, onDone }: { membership: MembershipView; onDone: () => void }) {
  const { t, lang } = useLang();
  const toast = useToast();
  const { business } = useMe();
  const plans = usePlans();
  const renew = useRenewMembership(membership.id);
  const [planId, setPlanId] = useState(membership.plan_id);

  const today = localDate(new Date(), business.timezone);
  const dayAfter = addDays(membership.period_end, 1);
  const start = dayAfter > today ? dayAfter : today;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    renew.mutate(planId === membership.plan_id ? undefined : planId, {
      onSuccess: ({ membership: next }) => {
        toast({ message: t('toast.membershipRenewed', { date: isoToDisplayDate(next.period_end) }) });
        onDone();
      },
    });
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {renew.error && <Notice>{errorMessage(renew.error, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>}
      <Select label={t('membershipForm.plan')} value={planId} onChange={setPlanId} options={(plans.data?.plans ?? [{ id: membership.plan_id, name: membership.plan_name }]).map((p) => ({ value: p.id, label: p.name }))} />
      <Input label={t('membershipForm.period')} readOnly value={period(start)} />
      <div className={styles.actions}>
        <Button type="submit" disabled={renew.isPending}>
          {t('membershipActions.renew')}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

/** Freeze until a date (the last frozen day). */
export function FreezeMembershipForm({ membership, onDone }: { membership: MembershipView; onDone: () => void }) {
  const { t, lang } = useLang();
  const toast = useToast();
  const { business } = useMe();
  const freeze = useFreezeMembership(membership.id);
  const today = localDate(new Date(), business.timezone);
  const [until, setUntil] = useState(addDays(today, 14));
  const [tried, setTried] = useState(false);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(until) && until >= today;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!valid) return;
    freeze.mutate(until, {
      onSuccess: () => {
        toast({ message: t('toast.membershipFrozen', { date: isoToDisplayDate(until) }) });
        onDone();
      },
    });
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {freeze.error && <Notice>{errorMessage(freeze.error, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>}
      <Input label={t('membershipForm.freezeUntil')} type="date" value={until} onChange={(e) => setUntil(e.target.value)} error={tried && !valid ? t('membershipForm.freezeInvalid') : undefined} hint={t('membershipForm.freezeHint')} />
      <div className={styles.actions}>
        <Button type="submit" disabled={freeze.isPending}>
          {t('membershipActions.freeze')}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

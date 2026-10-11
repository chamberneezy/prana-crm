import { formatMoney, formatMoneyInput, localDate, type MemberSummary, parseMoney, type PaymentMethod, zonedTimeToUtc } from '@prana/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import { useMembers, useRecordPayment } from '../api/queries';
import { useToast } from '../app/ToastProvider';
import { useMe } from '../auth/AuthProvider';
import { Avatar, Button, Choice, Input, Notice } from '../components';
import { useLang } from '../i18n';
import { memberSubline } from '../lib/member';
import styles from './forms.module.css';

interface Props {
  /** The member the payment is for. Left out: the form starts with a member search. */
  member?: MemberSummary;
  onDone: () => void;
}

const SEARCH_DELAY_MS = 250;

/** "Zabilježi uplatu": cash, card or bank transfer, recorded by hand. */
export function PaymentForm({ member: given, onDone }: Props) {
  const strings = useLang();
  const { t, lang } = strings;
  const toast = useToast();
  const { business } = useMe();
  const record = useRecordPayment();
  const today = localDate(new Date(), business.timezone);

  const [member, setMember] = useState<MemberSummary | undefined>(given);
  // Start from what is owed, when something is.
  const [amount, setAmount] = useState(given && given.debt_cents > 0 ? formatMoneyInput(given.debt_cents) : '');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);
  const found = useMembers({ q }, !member && q.length >= 2);

  const pick = (m: MemberSummary) => {
    setMember(m);
    if (!amount.trim() && m.debt_cents > 0) setAmount(formatMoneyInput(m.debt_cents));
  };

  const cents = parseMoney(amount);
  const errors = {
    member: !member ? t('paymentForm.memberRequired') : undefined,
    amount: cents === null || cents < 1 ? t('plans.priceInvalid') : undefined,
    date: !/^\d{4}-\d{2}-\d{2}$/.test(date) ? t('sessionForm.dateRequired') : undefined,
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!member || cents === null || errors.amount || errors.date) return;
    record.mutate(
      {
        member_id: member.id,
        amount_cents: cents,
        method,
        // Today's payments keep the time they were recorded; back-dated ones are placed at midday.
        paid_at: date === today ? new Date().toISOString() : zonedTimeToUtc(date, '12:00', business.timezone),
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          toast({ message: t('toast.paymentSaved') });
          onDone();
        },
      },
    );
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {record.error && <Notice>{errorMessage(record.error, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>}

      {member ? (
        <div className={styles.labelled}>
          <span className={styles.label}>{t('paymentForm.member')}</span>
          <div className={styles.chosen}>
            <Avatar name={member.full_name} size={32} />
            <span className={styles.chosenText}>
              <strong>{member.full_name}</strong>
              <span>{memberSubline({ ...member, last_visit_at: null }, strings)}</span>
            </span>
            {!given && (
              <Button variant="ghost" size="sm" onClick={() => setMember(undefined)}>
                {t('paymentForm.change')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <Input label={t('paymentForm.member')} placeholder={t('members.search.placeholder')} value={text} onChange={(e) => setText(e.target.value)} error={tried ? errors.member : undefined} />
          {q.length >= 2 && found.data && (
            <ul className={styles.results}>
              {found.data.members.map((m) => (
                <li key={m.id}>
                  <button type="button" className={styles.result} onClick={() => pick(m)}>
                    <Avatar name={m.full_name} size={32} />
                    <span className={styles.chosenText}>
                      <strong>{m.full_name}</strong>
                      <span>{memberSubline({ ...m, last_visit_at: null }, strings)}</span>
                    </span>
                  </button>
                </li>
              ))}
              {found.data.members.length === 0 && <li className={styles.noResults}>{t('session.checkIn.noResults')}</li>}
            </ul>
          )}
        </>
      )}

      <Input
        label={t('paymentForm.amount')}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0,00"
        error={tried ? errors.amount : undefined}
        hint={member && member.debt_cents > 0 ? t('paymentForm.debtHint', { amount: formatMoney(member.debt_cents) }) : undefined}
      />
      <div className={styles.labelled}>
        <span className={styles.label}>{t('paymentForm.method')}</span>
        <Choice
          value={method}
          onChange={setMethod}
          options={[
            { value: 'cash', label: t('method.cash.label') },
            { value: 'card', label: t('method.card.label') },
            { value: 'transfer', label: t('method.transfer.label') },
          ]}
        />
      </div>
      <Input label={t('paymentForm.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} error={tried ? errors.date : undefined} />
      <Input label={t('paymentForm.note')} multiline value={note} onChange={(e) => setNote(e.target.value)} />

      <div className={styles.actions}>
        <Button type="submit" disabled={record.isPending}>
          {t('payments.record')}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

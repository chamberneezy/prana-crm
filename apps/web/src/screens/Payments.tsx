import { addDays, addMonths, formatDate, formatMoney, localDate, startOfMonth } from '@prana/shared';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { errorMessage } from '../api/client';
import { usePayments } from '../api/queries';
import { useMe } from '../auth/AuthProvider';
import { Button, EmptyState, Notice, PageHeader, SidePanel, Stat } from '../components';
import { useLang } from '../i18n';
import { PaymentForm } from './PaymentForm';
import styles from './Plans.module.css';

/** "Uplate": payments by month with the total. */
export function Payments() {
  const { t, tn, lang } = useLang();
  const { business } = useMe();
  const thisMonth = startOfMonth(localDate(new Date(), business.timezone));

  // The month shown lives in the address ("?mjesec=2026-10").
  const [params, setParams] = useSearchParams();
  const asked = params.get('mjesec');
  const month = asked && /^\d{4}-\d{2}$/.test(asked) ? `${asked}-01` : thisMonth;
  const goTo = (first: string) => setParams(first === thisMonth ? {} : { mjesec: first.slice(0, 7) });

  const { data, error } = usePayments(month, addDays(addMonths(month, 1), -1));
  const [recording, setRecording] = useState(false);
  const monthNumber = Number(month.slice(5, 7));

  return (
    <>
      <PageHeader title={t('payments.title')}>
        <div className={styles.monthNav}>
          <Button variant="ghost" size="sm" aria-label={t('payments.prevMonth')} onClick={() => goTo(addMonths(month, -1))}>
            ‹
          </Button>
          <span className={styles.monthLabel}>
            {t(`month.${monthNumber}` as 'month.1')} {month.slice(0, 4)}.
          </span>
          <Button variant="ghost" size="sm" aria-label={t('payments.nextMonth')} disabled={month >= thisMonth} onClick={() => goTo(addMonths(month, 1))}>
            ›
          </Button>
        </div>
        <Button onClick={() => setRecording(true)}>{t('payments.record')}</Button>
      </PageHeader>

      {error && <Notice title={t('payments.loadFailed')}>{errorMessage(error, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>}

      {data && (
        <>
          <div className={styles.summary}>
            <Stat label={t('payments.total', { month: t(`month.in.${monthNumber}` as 'month.in.1') })} value={formatMoney(data.total_cents)} />
            <span className={styles.count}>{tn('payments.count', data.payments.length)}</span>
          </div>

          <section className={styles.card} aria-label={t('payments.title')}>
            {data.payments.length === 0 ? (
              <div className={styles.empty}>
                <EmptyState title={t('payments.empty.title')}>{t('payments.empty.body')}</EmptyState>
              </div>
            ) : (
              <div className={styles.scroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{t('sessionForm.date')}</th>
                      <th scope="col">{t('paymentForm.member')}</th>
                      <th scope="col">{t('plans.col.plan')}</th>
                      <th scope="col">{t('paymentForm.method')}</th>
                      <th scope="col" className={styles.number}>
                        {t('payments.amount')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{formatDate(p.paid_at)}</td>
                        <td>
                          {p.member_name ? (
                            <Link to={`/clanovi/${p.member_id}`} className={styles.memberLink}>
                              {p.member_name}
                            </Link>
                          ) : (
                            <span className={styles.muted}>{t('payments.deletedMember')}</span>
                          )}
                        </td>
                        <td className={styles.muted}>{p.plan_name ?? t('common.none')}</td>
                        <td className={styles.muted}>{t(`method.${p.method}`)}</td>
                        <td className={styles.number}>
                          <strong>{formatMoney(p.amount_cents)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {recording && (
        <SidePanel title={t('payments.record')} onClose={() => setRecording(false)}>
          <PaymentForm onDone={() => setRecording(false)} />
        </SidePanel>
      )}
    </>
  );
}

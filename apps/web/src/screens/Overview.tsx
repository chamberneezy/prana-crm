import { addDays, formatMoney, formatTimeRange, isoToDisplayDate, type MemberSummary, type SessionView, weekdayIndex } from '@prana/shared';
import { Link, useNavigate } from 'react-router';
import { errorMessage } from '../api/client';
import { useDashboard } from '../api/queries';
import { Button, Card, ClassTable, EmptyState, MemberRow, Notice, PageHeader, Stat } from '../components';
import { useLang } from '../i18n';
import { memberSubline, planLabel, statusLabel } from '../lib/member';
import styles from './Overview.module.css';

export function Overview() {
  const strings = useLang();
  const { t, tn, lang } = strings;
  const navigate = useNavigate();
  const { data, error } = useDashboard();

  const weekday = (date: string) => t(`weekday.long.${weekdayIndex(date)}` as 'weekday.long.1');
  const dayLabel = (date: string) => `${weekday(date)}, ${isoToDisplayDate(date).slice(0, 6)}`;
  const rows = (sessions: SessionView[]) =>
    sessions.map((s) => ({
      time: formatTimeRange(s.starts_at, s.ends_at),
      title: s.offering_name,
      color: `var(--${s.color_token})`,
      teacher: s.teacher_name ?? t('common.none'),
      booked: s.booked,
      capacity: s.effective_capacity ?? 0,
    }));

  // In "Za provjeru" an unpaid member's line shows what is owed rather than visits.
  const attentionSub = (m: MemberSummary) => (m.status === 'unpaid' && m.membership ? `${planLabel(m.membership.plan_code, strings)} · ${formatMoney(m.debt_cents)}` : memberSubline({ ...m, last_visit_at: null }, strings));

  const header = (
    <div className={styles.header}>
      {data && (
        <span className={styles.date}>
          {weekday(data.date)}, {isoToDisplayDate(data.date)}
        </span>
      )}
      <PageHeader title={t('overview.title')}>
        <Button onClick={() => navigate('/clanovi/novi')}>{t('overview.newMember')}</Button>
      </PageHeader>
    </div>
  );

  if (error) {
    return (
      <>
        {header}
        <Notice title={t('overview.loadFailed')}>{errorMessage(error, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>
      </>
    );
  }
  if (!data) return <div aria-busy="true">{header}</div>;

  const { counts, attention } = data;
  const month = Number(data.date.slice(5, 7));
  const unpaid = attention.filter((m) => m.status === 'unpaid');
  const first = unpaid[0];

  return (
    <>
      {header}

      <section aria-label={t('overview.title')} className={styles.stats}>
        <Card padding={20}>
          <Stat label={t('overview.stat.active')} value={counts.active_members} />
        </Card>
        <Card padding={20}>
          <Stat label={t('overview.stat.expiring')} value={counts.expiring_this_week} />
        </Card>
        <Card padding={20}>
          {/* Terracotta only when there is something to look at. */}
          <Stat label={t('overview.stat.debts')} value={formatMoney(counts.debts_total_cents)} attention={counts.debts_total_cents > 0} />
        </Card>
        <Card padding={20}>
          <Stat label={t('overview.stat.payments', { month: t(`month.in.${month}` as 'month.in.1') })} value={formatMoney(counts.payments_this_month_cents)} />
        </Card>
      </section>

      <div className={styles.columns}>
        <div className={styles.column}>
          <ClassTable date={`${t('overview.today')} · ${dayLabel(data.date)}`} classes={rows(data.today)} emptyText={t('overview.noSessions')} />
          <ClassTable date={`${t('overview.tomorrow')} · ${dayLabel(addDays(data.date, 1))}`} classes={rows(data.tomorrow)} emptyText={t('overview.noSessions')} />
          <Link to="/raspored" className={styles.link}>
            {t('overview.fullSchedule')} ›
          </Link>
        </div>

        <section className={styles.attention} aria-label={t('overview.attention')}>
          <div className={styles.attentionHead}>
            <h2>{t('overview.attention')}</h2>
            {unpaid.length > 0 && (
              <Notice title={tn('overview.unpaid', unpaid.length)}>
                {unpaid.length === 1 && first?.membership
                  ? `${first.full_name}, ${planLabel(first.membership.plan_code, strings)} · ${formatMoney(first.debt_cents)}.`
                  : t('overview.unpaidTotal', { amount: formatMoney(counts.debts_total_cents) })}
              </Notice>
            )}
            {attention.length === 0 && <EmptyState title={t('overview.allGood.title')}>{t('overview.allGood.body')}</EmptyState>}
          </div>
          {attention.map((m) => (
            <MemberRow key={m.id} name={m.full_name} sub={attentionSub(m)} status={m.status} statusLabel={statusLabel(m.status, m.days_left, strings)} onClick={() => navigate(`/clanovi/${m.id}`)} />
          ))}
        </section>
      </div>
    </>
  );
}

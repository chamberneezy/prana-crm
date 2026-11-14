import { type AnalyticsResponse, formatDayMonth, formatMoney, type MessageKey } from '@prana/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../api/client';
import { useAnalytics } from '../api/queries';
import { EmptyState, Notice, PageHeader, Stat } from '../components';
import { cx } from '../components/cx';
import { useLang } from '../i18n';
import styles from './Analytics.module.css';

const RANGES = [3, 6, 12] as const;

/** A month as a short name: "stu", "Nov". */
function monthName(month: string, lang: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'hr-HR', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, 1)));
}

/**
 * Columns, one per month: a single measure over time. Every bar has its value on hover and for screen readers;
 * only the latest month is labelled on the chart, so the numbers don't crowd it.
 */
function MonthBars({ title, months, value, format }: { title: string; months: AnalyticsResponse['months']; value: (m: AnalyticsResponse['months'][number]) => number; format: (n: number) => string }) {
  const { lang } = useLang();
  const max = Math.max(1, ...months.map(value));
  const last = months.at(-1);
  return (
    <section className={styles.card} aria-label={title}>
      <div className={styles.cardHead}>
        <h2>{title}</h2>
        {last && <span className={styles.headValue}>{`${monthName(last.month, lang)}: ${format(value(last))}`}</span>}
      </div>
      <ul className={styles.columns}>
        {months.map((m) => {
          const label = `${monthName(m.month, lang)} ${m.month.slice(0, 4)}: ${format(value(m))}`;
          return (
            <li key={m.month} className={styles.column} title={label} aria-label={label}>
              <span className={styles.columnTrack}>
                <span className={styles.columnBar} style={{ height: `${(value(m) / max) * 100}%` }} />
              </span>
              <span className={styles.columnLabel} aria-hidden>
                {monthName(m.month, lang)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Horizontal bars with their value written beside them: compare a handful of named things. */
function BarList({ title, hint, items }: { title: string; hint?: string; items: Array<{ key: string; label: string; dot?: string; value: number; text: string }> }) {
  const { t } = useLang();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <section className={styles.card} aria-label={title}>
      <div className={styles.cardHead}>
        <h2>{title}</h2>
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}
      {items.length === 0 ? (
        <p className={styles.hint}>{t('analytics.empty')}</p>
      ) : (
        <ul className={styles.bars}>
          {items.map((i) => (
            <li key={i.key} className={styles.barRow} title={`${i.label}: ${i.text}`}>
              <span className={styles.barLabel}>
                {i.dot && <span className={styles.dot} style={{ background: `var(--${i.dot})` }} aria-hidden />}
                {i.label}
              </span>
              <span className={styles.barTrack} aria-hidden>
                <span className={styles.bar} style={{ width: `${(i.value / max) * 100}%` }} />
              </span>
              <span className={styles.barValue}>{i.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Weekday × start hour: one hue, darker for more check-ins. Each cell carries its count. */
function WhenHeatmap({ slots }: { slots: AnalyticsResponse['by_slot'] }) {
  const { t, tn } = useLang();
  const hours = [...new Set(slots.map((s) => s.hour))].sort((a, b) => a - b);
  const max = Math.max(1, ...slots.map((s) => s.visits));
  const at = (weekday: number, hour: number) => slots.find((s) => s.weekday === weekday && s.hour === hour)?.visits ?? 0;
  const days = [1, 2, 3, 4, 5, 6, 7];
  return (
    <section className={styles.card} aria-label={t('analytics.whenTitle')}>
      <div className={styles.cardHead}>
        <h2>{t('analytics.whenTitle')}</h2>
      </div>
      <p className={styles.hint}>{t('analytics.whenHint')}</p>
      {hours.length === 0 ? (
        <p className={styles.hint}>{t('analytics.empty')}</p>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.heatmap}>
            <thead>
              <tr>
                <th scope="col">
                  <span className={styles.srOnly}>{t('sessionForm.start')}</span>
                </th>
                {days.map((d) => (
                  <th key={d} scope="col">
                    {t(`weekday.short.${d}` as MessageKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((h) => (
                <tr key={h}>
                  <th scope="row">{`${String(h).padStart(2, '0')}:00`}</th>
                  {days.map((d) => {
                    const n = at(d, h);
                    const label = `${t(`weekday.short.${d}` as MessageKey)} ${String(h).padStart(2, '0')}:00 · ${n} ${tn('visits', n)}`;
                    return (
                      <td key={d} title={label} aria-label={label} className={cx(n === 0 && styles.cellEmpty, n / max > 0.55 && styles.cellDark)} style={n ? { background: `color-mix(in srgb, var(--sage-deep) ${Math.round(12 + (n / max) * 88)}%, var(--surface-card))` } : undefined}>
                        {n || ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MemberList({ title, hint, members }: { title: string; hint?: string; members: AnalyticsResponse['most_active'] }) {
  const { t, tn } = useLang();
  return (
    <section className={styles.card} aria-label={title}>
      <div className={styles.cardHead}>
        <h2>{title}</h2>
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}
      {members.length === 0 ? (
        <p className={styles.hint}>{t('analytics.empty')}</p>
      ) : (
        <ol className={styles.people}>
          {members.map((m) => (
            <li key={m.id}>
              <Link to={`/clanovi/${m.id}`} className={styles.person}>
                <span className={styles.personName}>{m.full_name}</span>
                <span className={styles.personSub}>{m.last_visit_at ? t('analytics.lastVisit', { date: formatDayMonth(m.last_visit_at) }) : t('analytics.neverCame')}</span>
              </Link>
              <span className={styles.barValue}>{`${m.visits} ${tn('visits', m.visits)}`}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** "Analitika": attendance and income over the last few calendar months. */
export function Analytics() {
  const { t, tn, lang } = useLang();
  const [months, setMonths] = useState<(typeof RANGES)[number]>(6);
  const { data, error } = useAnalytics(months);
  const money = (n: number) => formatMoney(n);
  const visits = (n: number) => `${n} ${tn('visits', n)}`;

  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <PageHeader title={t('analytics.title')}>
          <div role="tablist" aria-label={t('analytics.range')} className={styles.filters}>
            {RANGES.map((n) => (
              <button key={n} type="button" role="tab" aria-selected={n === months} onClick={() => setMonths(n)} className={cx(styles.filter, n === months && styles.filterSelected)}>
                {t('analytics.months', { n })}
              </button>
            ))}
          </div>
        </PageHeader>
        <p>{t('analytics.intro')}</p>
      </div>

      {error && <Notice title={t('analytics.loadFailed')}>{errorMessage(error, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>}

      {data && data.totals.visits === 0 && data.totals.income_cents === 0 && <EmptyState title={t('analytics.empty')} />}

      {data && (
        <>
          <section className={styles.stats} aria-label={t('analytics.title')}>
            <Stat label={t('analytics.stat.visits')} value={data.totals.visits} />
            <Stat label={t('analytics.stat.income')} value={money(data.totals.income_cents)} />
            <Stat label={t('analytics.stat.classSize')} value={data.totals.average_class_size.toLocaleString(lang === 'en' ? 'en-GB' : 'hr-HR')} />
            <Stat label={t('analytics.stat.members')} value={data.totals.members_who_came} />
          </section>

          <div className={styles.grid}>
            <MonthBars title={t('analytics.visitsByMonth')} months={data.months} value={(m) => m.visits} format={visits} />
            <MonthBars title={t('analytics.incomeByMonth')} months={data.months} value={(m) => m.income_cents} format={money} />
            <BarList
              title={t('analytics.byOffering')}
              items={data.by_offering.map((o) => ({ key: o.offering_id, label: o.name, dot: o.color_token, value: o.visits, text: `${visits(o.visits)} · ${t('analytics.sessions', { n: o.sessions })}` }))}
            />
            <WhenHeatmap slots={data.by_slot} />
            <MemberList title={t('analytics.mostActive')} members={data.most_active} />
            <MemberList title={t('analytics.leastActive')} hint={t('analytics.leastActiveHint')} members={data.least_active} />
            <BarList title={t('analytics.byMethod')} items={data.by_method.map((m) => ({ key: m.method, label: t(`method.${m.method}.label` as MessageKey), value: m.cents, text: money(m.cents) }))} />
            <BarList
              title={t('analytics.byPlan')}
              items={data.by_plan.map((p) => ({
                key: p.plan_name ?? '',
                label: p.plan_name === null ? t('analytics.noPlan') : p.plan_code && p.plan_code !== 'custom' ? (p.plan_code === 'trial' ? t('status.trial') : t(`plan.${p.plan_code}` as MessageKey)) : p.plan_name,
                value: p.cents,
                text: money(p.cents),
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}

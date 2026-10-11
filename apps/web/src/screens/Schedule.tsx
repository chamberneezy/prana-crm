import { addDays, formatTimeRange, formatWeekRange, isoToDisplayDate, localDate, type SessionView, startOfWeek } from '@prana/shared';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { errorMessage } from '../api/client';
import { useOfferings, useSessions } from '../api/queries';
import { useMe } from '../auth/AuthProvider';
import { Button, Notice, PageHeader, SidePanel } from '../components';
import { cx } from '../components/cx';
import { useLang } from '../i18n';
import { sessionMeta } from '../lib/session';
import styles from './Schedule.module.css';
import { SessionForm } from './SessionForm';
import { SessionPanel } from './SessionPanel';

type Panel = { kind: 'session'; id: string } | { kind: 'new'; offeringId?: string; date?: string } | null;

const DAYS = [0, 1, 2, 3, 4, 5, 6];

export function Schedule() {
  const strings = useLang();
  const { t, lang } = strings;
  const { business } = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  const today = localDate(new Date(), business.timezone);

  // The week shown lives in the address, so a reload or a shared link keeps it.
  const [params, setParams] = useSearchParams();
  const asked = params.get('tjedan');
  const monday = startOfWeek(asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : today);
  const goTo = (date: string) => setParams(date === startOfWeek(today) ? {} : { tjedan: date });

  const [panel, setPanel] = useState<Panel>(null);

  // "Zakaži" on the class types page arrives here with the class type to start from.
  const newFrom = (location.state as { newFrom?: string } | null)?.newFrom;
  useEffect(() => {
    if (!newFrom) return;
    setPanel({ kind: 'new', offeringId: newFrom });
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [newFrom, navigate, location.pathname, location.search]);

  const sessions = useSessions(monday, addDays(monday, 6));
  const offerings = useOfferings();
  const all = offerings.data?.offerings ?? [];
  const error = sessions.error ?? offerings.error;

  const byDay = new Map<string, SessionView[]>();
  for (const s of sessions.data?.sessions ?? []) {
    const day = localDate(s.starts_at, business.timezone);
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }

  // A new session defaults to today when this week is shown, otherwise to that week's Monday.
  const defaultDate = today >= monday && today <= addDays(monday, 6) ? today : monday;

  return (
    <>
      <PageHeader title={t('schedule.title')}>
        <div className={styles.weekNav}>
          <Button variant="ghost" size="sm" aria-label={t('schedule.prevWeek')} onClick={() => goTo(addDays(monday, -7))}>
            ‹
          </Button>
          <span className={styles.weekLabel}>{formatWeekRange(monday)}</span>
          <Button variant="ghost" size="sm" aria-label={t('schedule.nextWeek')} onClick={() => goTo(addDays(monday, 7))}>
            ›
          </Button>
          {monday !== startOfWeek(today) && (
            <Button variant="ghost" size="sm" onClick={() => goTo(startOfWeek(today))}>
              {t('schedule.thisWeek')}
            </Button>
          )}
        </div>
        <Button onClick={() => setPanel({ kind: 'new', date: defaultDate })}>{t('schedule.newSession')}</Button>
      </PageHeader>

      {error && <Notice title={t('schedule.loadFailed')}>{errorMessage(error, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>}

      <div className={styles.scroll}>
        <div className={styles.grid} role="group" aria-label={t('schedule.gridLabel')} aria-busy={sessions.isPending}>
          {DAYS.map((offset) => {
            const date = addDays(monday, offset);
            return (
              <section key={date} className={styles.day} aria-label={`${t(`weekday.long.${offset + 1}` as 'weekday.long.1')}, ${isoToDisplayDate(date)}`}>
                <div className={styles.dayHead}>
                  <span className={styles.dayName}>{t(`weekday.short.${offset + 1}` as 'weekday.short.1')}</span>
                  <span className={cx(styles.dayDate, date === today && styles.today)}>{isoToDisplayDate(date).slice(0, 6)}</span>
                </div>
                <div className={styles.dayBody}>
                  {(byDay.get(date) ?? []).map((s) => (
                    <button key={s.id} type="button" className={cx(styles.session, panel?.kind === 'session' && panel.id === s.id && styles.sessionOpen)} onClick={() => setPanel({ kind: 'session', id: s.id })}>
                      <span className={styles.sessionTime}>
                        <span className={styles.pill} style={{ background: `var(--${s.color_token})` }} />
                        {formatTimeRange(s.starts_at, s.ends_at)}
                      </span>
                      <span className={styles.sessionName}>{s.offering_name}</span>
                      <span className={styles.sessionMeta}>{sessionMeta(s, strings)}</span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <section className={styles.addFrom}>
        <div className={styles.addHead}>
          <h2>{t('schedule.addFrom')}</h2>
          <Link to="/vrste-satova">{t('schedule.editOfferings')} ›</Link>
        </div>
        <div className={styles.templates}>
          {all
            .filter((o) => o.active)
            .map((o) => (
              <button key={o.id} type="button" className={styles.template} onClick={() => setPanel({ kind: 'new', offeringId: o.id, date: defaultDate })}>
                <span className={styles.pill} style={{ background: `var(--${o.color_token})` }} />
                {o.name}
              </button>
            ))}
          {offerings.data && all.length === 0 && <span className={styles.none}>{t('schedule.noOfferings')}</span>}
        </div>
      </section>

      {panel?.kind === 'new' && (
        <SidePanel title={t('sessionForm.newTitle')} onClose={() => setPanel(null)}>
          {/* Wait for the class types, so the chosen one and its length are filled in. */}
          {offerings.data && <SessionForm key={`${panel.offeringId}-${panel.date}`} offerings={all} offeringId={panel.offeringId} date={panel.date ?? defaultDate} onDone={() => setPanel(null)} />}
        </SidePanel>
      )}
      {panel?.kind === 'session' && <SessionPanel key={panel.id} sessionId={panel.id} offerings={all} onClose={() => setPanel(null)} />}
    </>
  );
}

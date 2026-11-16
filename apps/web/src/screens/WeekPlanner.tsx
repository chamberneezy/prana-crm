import { addDays, formatTime, formatWeekRange, isoToDisplayDate, localDate, type SessionView, startOfWeek, weekdayIndex } from '@prana/shared';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { errorMessage } from '../api/client';
import { useClosures, useFetchWeek, useOfferings, useSaveWeekPlan, useSaveWeekTemplate, useSessions, useStaff, useWeekTemplate } from '../api/queries';
import { useToast } from '../app/ToastProvider';
import { useMe } from '../auth/AuthProvider';
import { Button, Notice, PageHeader, Tag } from '../components';
import { cx } from '../components/cx';
import { useLang } from '../i18n';
import { ClosuresPanel } from './ClosuresPanel';
import scheduleStyles from './Schedule.module.css';
import styles from './WeekPlanner.module.css';

/** One class of the week being planned. Text fields hold what is typed; `id` is the session it was loaded from. */
interface Row {
  key: string;
  id?: string;
  date: string;
  start_time: string;
  duration: string;
  offering_id: string;
  teacher_staff_id: string;
  /** Check-ins on the session; a row with any can't be removed. */
  booked: number;
}
type Planned = Omit<Row, 'key' | 'id' | 'booked'>;

let lastKey = 0;
const newKey = () => `new-${++lastKey}`;

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const byTime = (a: Row, b: Row) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time);
/** What is saved, to tell whether anything changed. */
const saved = (rows: Row[]) => JSON.stringify(rows.map(({ id, date, start_time, duration, offering_id, teacher_staff_id }) => [id, date, start_time, duration, offering_id, teacher_staff_id]));
const validDuration = (text: string) => /^\d+$/.test(text.trim()) && Number(text) >= 5 && Number(text) <= 1440;
const rowValid = (r: Row) => !!r.offering_id && /^\d{2}:\d{2}$/.test(r.start_time) && validDuration(r.duration);

function fromSession(s: SessionView, timeZone: string): Row {
  return {
    key: s.id,
    id: s.id,
    date: localDate(s.starts_at, timeZone),
    start_time: formatTime(s.starts_at),
    duration: String(Math.round((Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60_000)),
    offering_id: s.offering_id,
    teacher_staff_id: s.teacher_staff_id ?? '',
    booked: s.booked,
  };
}

/** "Tjedni plan": lay out a week's classes (by hand, from the standard week or from the week before) and save them. */
export function WeekPlanner() {
  const { t, lang } = useLang();
  const toast = useToast();
  const { business } = useMe();
  const today = localDate(new Date(), business.timezone);
  const fallback = { generic: t('error.generic'), offline: t('error.offline') };

  const [params, setParams] = useSearchParams();
  const asked = params.get('tjedan');
  const monday = startOfWeek(asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : today);
  const sunday = addDays(monday, 6);

  const sessions = useSessions(monday, sunday);
  const closures = useClosures(monday, sunday);
  const offerings = useOfferings();
  const staff = useStaff();
  const template = useWeekTemplate();
  const fetchWeek = useFetchWeek();
  const save = useSaveWeekPlan(monday);
  const saveTemplate = useSaveWeekTemplate();

  // The week as saved; null while another week's sessions are still on screen.
  const loaded = sessions.data && !sessions.isPlaceholderData ? sessions.data.sessions.map((s) => fromSession(s, business.timezone)) : null;
  const baseline = loaded ?? [];
  // What has been changed here and not saved yet; null = nothing, the saved week is shown.
  const [edited, setEdited] = useState<Row[] | null>(null);
  const rows = edited ?? baseline;
  const dirty = edited !== null && saved(edited) !== saved(baseline);
  const [tried, setTried] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [closuresOpen, setClosuresOpen] = useState(false);

  const closed = new Map((closures.data?.closures ?? []).map((c) => [c.date, c.name]));
  const all = offerings.data?.offerings ?? [];
  const people = staff.data?.staff ?? [];
  const offeringById = (id: string) => all.find((o) => o.id === id);

  const goTo = (date: string) => {
    setEdited(null);
    setTried(false);
    setNotice(null);
    setParams(date === startOfWeek(today) ? {} : { tjedan: date });
  };

  const change = (key: string, patch: Partial<Row>) => setEdited(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const pickClass = (row: Row, id: string) => {
    const o = offeringById(id);
    // A class brings its usual length and teacher with it.
    change(row.key, { offering_id: id, ...(o ? { duration: String(o.default_duration_min), teacher_staff_id: o.teacher_ids[0] ?? '' } : {}) });
  };
  const addRow = (date: string) => setEdited([...rows, { key: newKey(), date, start_time: '', duration: '', offering_id: '', teacher_staff_id: '', booked: 0 }]);
  const removeRow = (key: string) => setEdited(rows.filter((r) => r.key !== key));

  /**
   * Fills the week with planned classes, skipping closed days. A class already in the week at the same time keeps its
   * session (and its check-ins, capacity and note); sessions people were checked in to always stay.
   */
  const fill = (planned: Planned[]) => {
    const pool = [...baseline];
    const next = planned
      .filter((p) => !closed.has(p.date))
      .map((p): Row => {
        const i = pool.findIndex((s) => s.date === p.date && s.start_time === p.start_time && s.offering_id === p.offering_id);
        if (i < 0) return { ...p, key: newKey(), booked: 0 };
        const [same] = pool.splice(i, 1);
        return { ...same!, ...p };
      });
    setEdited([...next, ...pool.filter((s) => s.booked > 0)].sort(byTime));
    setTried(false);
    setNotice(null);
    toast({ message: t('toast.weekFilled') });
  };

  const fromTemplate = () => {
    const slots = template.data?.slots ?? [];
    if (!slots.length) return setNotice(t('planner.templateEmpty'));
    fill(slots.map((s) => ({ date: addDays(monday, s.weekday - 1), start_time: s.start_time, duration: String(s.duration_min), offering_id: s.offering_id, teacher_staff_id: s.teacher_staff_id ?? '' })));
  };

  const [copying, setCopying] = useState(false);
  const copyPrevious = async () => {
    setCopying(true);
    try {
      const previous = await fetchWeek(addDays(monday, -7), addDays(monday, -1));
      fill(
        previous.sessions.map((s) => {
          const r = fromSession(s, business.timezone);
          return { date: addDays(r.date, 7), start_time: r.start_time, duration: r.duration, offering_id: r.offering_id, teacher_staff_id: r.teacher_staff_id };
        }),
      );
    } catch (error) {
      setNotice(errorMessage(error, lang, fallback));
    } finally {
      setCopying(false);
    }
  };

  const allValid = () => {
    setTried(true);
    if (rows.every(rowValid)) return true;
    setNotice(t('planner.invalid'));
    return false;
  };

  const submit = () => {
    if (!allValid()) return;
    setNotice(null);
    save.mutate(
      {
        sessions: rows.map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          date: r.date,
          start_time: r.start_time,
          duration_min: Number(r.duration),
          offering_id: r.offering_id,
          teacher_staff_id: r.teacher_staff_id || null,
        })),
      },
      {
        onSuccess: () => {
          setEdited(null);
          setTried(false);
          toast({ message: t('toast.weekSaved', { week: formatWeekRange(monday) }) });
        },
      },
    );
  };

  const submitTemplate = () => {
    if (!allValid()) return;
    setNotice(null);
    saveTemplate.mutate(
      {
        slots: rows.map((r) => ({
          weekday: weekdayIndex(r.date),
          start_time: r.start_time,
          duration_min: Number(r.duration),
          offering_id: r.offering_id,
          teacher_staff_id: r.teacher_staff_id || null,
        })),
      },
      { onSuccess: () => toast({ message: t('toast.templateSaved') }) },
    );
  };

  const busy = !loaded || !closures.data || save.isPending;
  const loadError = sessions.error ?? offerings.error ?? closures.error;
  const failure = save.error ?? saveTemplate.error;

  return (
    <>
      <div className={styles.intro}>
        <PageHeader title={t('planner.title')}>
          <div className={scheduleStyles.weekNav}>
            <Button variant="ghost" size="sm" aria-label={t('schedule.prevWeek')} disabled={dirty} onClick={() => goTo(addDays(monday, -7))}>
              ‹
            </Button>
            <span className={scheduleStyles.weekLabel}>{formatWeekRange(monday)}</span>
            <Button variant="ghost" size="sm" aria-label={t('schedule.nextWeek')} disabled={dirty} onClick={() => goTo(addDays(monday, 7))}>
              ›
            </Button>
            {monday !== startOfWeek(today) && (
              <Button variant="ghost" size="sm" disabled={dirty} onClick={() => goTo(startOfWeek(today))}>
                {t('schedule.thisWeek')}
              </Button>
            )}
          </div>
          <Button disabled={!dirty || busy} onClick={submit}>
            {t('planner.save')}
          </Button>
        </PageHeader>
        <p>{t('planner.intro')}</p>
      </div>

      <div className={styles.toolbar}>
        <Button variant="secondary" size="sm" disabled={busy || !template.data} onClick={fromTemplate}>
          {t('planner.fromTemplate')}
        </Button>
        <Button variant="secondary" size="sm" disabled={busy || copying} onClick={() => void copyPrevious()}>
          {t('planner.copyPrevious')}
        </Button>
        <Button variant="secondary" size="sm" disabled={busy || saveTemplate.isPending || rows.length === 0} onClick={submitTemplate}>
          {t('planner.saveTemplate')}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setClosuresOpen(true)}>
          {t('closures.button')}
        </Button>
        {dirty && (
          <Button variant="ghost" size="sm" onClick={() => goTo(monday)}>
            {t('planner.discard')}
          </Button>
        )}
      </div>

      {dirty && <p className={styles.muted}>{t('planner.unsavedNav')}</p>}
      {loadError && <Notice title={t('planner.loadFailed')}>{errorMessage(loadError, lang, fallback)}</Notice>}
      {notice && <Notice>{notice}</Notice>}
      {failure && <Notice>{errorMessage(failure, lang, fallback)}</Notice>}

      <div className={styles.days} aria-busy={busy}>
        {DAYS.map((offset) => {
          const date = addDays(monday, offset);
          const dayName = t(`weekday.long.${offset + 1}` as 'weekday.long.1');
          const dayRows = rows.filter((r) => r.date === date);
          const closure = closed.get(date);
          return (
            <section key={date} className={cx(styles.day, closure && styles.closedDay)} aria-label={`${dayName}, ${isoToDisplayDate(date)}`}>
              <header className={styles.dayHead}>
                <h2>
                  {dayName} <span className={styles.dayDate}>{isoToDisplayDate(date).slice(0, 6)}</span>
                </h2>
                {closure && <Tag kind="flag">{t('planner.closedDay', { name: closure })}</Tag>}
              </header>
              {dayRows.length === 0 && <p className={styles.muted}>{t('planner.empty')}</p>}
              {dayRows.map((r) => {
                const o = offeringById(r.offering_id);
                const label = o?.name ?? t('planner.class');
                const invalid = tried && !rowValid(r);
                return (
                  <div key={r.key} className={styles.row} role="group" aria-label={`${label} ${r.start_time}`.trim()}>
                    <span className={styles.pill} style={{ background: o ? `var(--${o.color_token})` : 'var(--border-field)' }} />
                    <select className={cx(styles.control, styles.classSelect)} aria-label={t('planner.class')} aria-invalid={invalid && !r.offering_id ? true : undefined} value={r.offering_id} onChange={(e) => pickClass(r, e.target.value)}>
                      <option value="">{t('planner.chooseClass')}</option>
                      {all
                        .filter((x) => x.active || x.id === r.offering_id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                    </select>
                    <input
                      className={styles.control}
                      type="time"
                      aria-label={t('planner.start')}
                      aria-invalid={invalid && !/^\d{2}:\d{2}$/.test(r.start_time) ? true : undefined}
                      value={r.start_time}
                      onChange={(e) => change(r.key, { start_time: e.target.value })}
                    />
                    <input
                      className={cx(styles.control, styles.duration)}
                      inputMode="numeric"
                      aria-label={t('planner.duration')}
                      aria-invalid={invalid && !validDuration(r.duration) ? true : undefined}
                      value={r.duration}
                      onChange={(e) => change(r.key, { duration: e.target.value })}
                    />
                    <select className={cx(styles.control, styles.teacherSelect)} aria-label={t('planner.teacher')} value={r.teacher_staff_id} onChange={(e) => change(r.key, { teacher_staff_id: e.target.value })}>
                      <option value="">{t('planner.noTeacher')}</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={t('planner.removeLabel', { name: label, time: r.start_time || '—' })}
                      title={r.booked > 0 ? t('planner.hasVisits') : undefined}
                      disabled={r.booked > 0}
                      onClick={() => removeRow(r.key)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <div>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => addRow(date)} aria-label={`${t('planner.addClass')}: ${dayName}`}>
                  + {t('planner.addClass')}
                </Button>
              </div>
            </section>
          );
        })}
      </div>

      {closuresOpen && <ClosuresPanel monday={monday} date={today >= monday && today <= sunday ? today : monday} onClose={() => setClosuresOpen(false)} />}
    </>
  );
}

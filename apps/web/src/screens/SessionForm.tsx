import { formatTime, localDate, type OfferingView, type SessionView, zonedTimeToUtc } from '@prana/shared';
import { type FormEvent, useState } from 'react';
import { errorMessage } from '../api/client';
import { useSaveSession, useStaff } from '../api/queries';
import { useToast } from '../app/ToastProvider';
import { useMe } from '../auth/AuthProvider';
import { Button, Input, Notice, Select } from '../components';
import { useLang } from '../i18n';
import { wholeNumber } from '../lib/session';
import styles from './forms.module.css';

interface Props {
  offerings: OfferingView[];
  /** Left out: a new session. */
  session?: SessionView;
  /** For a new session: the class type to start from. */
  offeringId?: string;
  /** For a new session: the day to start from (YYYY-MM-DD). */
  date?: string;
  onDone: () => void;
}

/** "Novi termin": pick a class type, then the day, time, teacher and capacity. */
export function SessionForm({ offerings, session, offeringId, date, onDone }: Props) {
  const { t, lang } = useLang();
  const toast = useToast();
  const { business } = useMe();
  const staff = useStaff();
  const save = useSaveSession(session?.id);

  const byId = (id: string) => offerings.find((o) => o.id === id);
  const start = session ? byId(session.offering_id) : offeringId ? byId(offeringId) : undefined;

  const [offering, setOffering] = useState(start?.id ?? '');
  const [day, setDay] = useState(session ? localDate(session.starts_at, business.timezone) : (date ?? ''));
  const [time, setTime] = useState(session ? formatTime(session.starts_at) : '');
  const [duration, setDuration] = useState(String(session ? Math.round((Date.parse(session.ends_at) - Date.parse(session.starts_at)) / 60_000) : (start?.default_duration_min ?? '')));
  const [teacher, setTeacher] = useState(session?.teacher_staff_id ?? '');
  const [capacity, setCapacity] = useState(session?.capacity ? String(session.capacity) : '');
  const [note, setNote] = useState(session?.note ?? '');
  const [tried, setTried] = useState(false);

  // Choosing another class type brings its usual length with it.
  const pickOffering = (id: string) => {
    setOffering(id);
    const next = byId(id);
    if (next) setDuration(String(next.default_duration_min));
  };

  const minutes = wholeNumber(duration);
  const places = wholeNumber(capacity);
  const errors = {
    offering: !offering ? t('sessionForm.offeringRequired') : undefined,
    day: !/^\d{4}-\d{2}-\d{2}$/.test(day) ? t('sessionForm.dateRequired') : undefined,
    time: !/^\d{2}:\d{2}$/.test(time) ? t('sessionForm.startRequired') : undefined,
    duration: minutes === null || Number.isNaN(minutes) || minutes < 5 || minutes > 1440 ? t('offeringForm.durationInvalid') : undefined,
    capacity: places !== null && (Number.isNaN(places) || places < 1 || places > 1000) ? t('offeringForm.capacityInvalid') : undefined,
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    // The time typed is studio time, whatever the computer's own time zone.
    const starts_at = zonedTimeToUtc(day, time, business.timezone);
    save.mutate(
      {
        offering_id: offering,
        starts_at,
        ends_at: new Date(Date.parse(starts_at) + (minutes ?? 60) * 60_000).toISOString(),
        teacher_staff_id: teacher || null,
        capacity: places,
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          toast({ message: t(session ? 'toast.sessionSaved' : 'toast.sessionAdded') });
          onDone();
        },
      },
    );
  };

  const selectable = offerings.filter((o) => o.active || o.id === session?.offering_id);
  const defaultCapacity = byId(offering)?.default_capacity;

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {save.error && <Notice>{errorMessage(save.error, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>}
      <Select
        label={t('sessionForm.offering')}
        value={offering}
        onChange={pickOffering}
        placeholder=""
        options={selectable.map((o) => ({ value: o.id, label: o.name }))}
        error={tried ? errors.offering : undefined}
      />
      <div className={styles.pair}>
        <Input label={t('sessionForm.date')} type="date" value={day} onChange={(e) => setDay(e.target.value)} error={tried ? errors.day : undefined} />
        <Input label={t('sessionForm.start')} type="time" value={time} onChange={(e) => setTime(e.target.value)} error={tried ? errors.time : undefined} />
      </div>
      <div className={styles.pair}>
        <Input label={t('sessionForm.duration')} value={duration} onChange={(e) => setDuration(e.target.value)} error={tried ? errors.duration : undefined} />
        <Input
          label={t('sessionForm.capacity')}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder={defaultCapacity ? String(defaultCapacity) : undefined}
          error={tried ? errors.capacity : undefined}
          hint={t('offeringForm.capacityHint')}
        />
      </div>
      <Select
        label={t('sessionForm.teacher')}
        value={teacher}
        onChange={setTeacher}
        placeholder={t('sessionForm.noTeacher')}
        options={(staff.data?.staff ?? []).map((s) => ({ value: s.id, label: s.name }))}
      />
      <Input label={t('sessionForm.note')} multiline value={note} onChange={(e) => setNote(e.target.value)} />

      <div className={styles.actions}>
        <Button type="submit" disabled={save.isPending}>
          {t(session ? 'common.save' : 'sessionForm.add')}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

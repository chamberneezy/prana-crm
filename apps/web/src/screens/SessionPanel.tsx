import { formatDate, formatTimeRange, localDate, type OfferingView, weekdayIndex } from '@prana/shared';
import { useEffect, useState } from 'react';
import { ApiClientError, errorMessage } from '../api/client';
import { useCheckIn, useDeleteSession, useMembers, useRemoveVisit, useSession } from '../api/queries';
import { useToast } from '../app/ToastProvider';
import { Avatar, Button, Input, Notice, SidePanel, Tag } from '../components';
import { useLang } from '../i18n';
import { memberSubline } from '../lib/member';
import { entryNote } from '../lib/session';
import { SessionForm } from './SessionForm';
import styles from './SessionPanel.module.css';

interface Props {
  sessionId: string;
  offerings: OfferingView[];
  onClose: () => void;
}

const SEARCH_DELAY_MS = 250;

/** One session: details, the class list with health notes, check-in, edit and delete. */
export function SessionPanel({ sessionId, offerings, onClose }: Props) {
  const strings = useLang();
  const { t, tn, lang } = strings;
  const toast = useToast();
  const { data, error } = useSession(sessionId);
  const checkIn = useCheckIn(sessionId);
  const removeVisit = useRemoveVisit();
  const remove = useDeleteSession();
  const [mode, setMode] = useState<'view' | 'edit' | 'confirmDelete'>('view');
  const [failure, setFailure] = useState<string | null>(null);
  const fallback = { generic: t('error.generic'), offline: t('error.offline') };

  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);
  const found = useMembers({ q }, q.length >= 2);

  if (error) {
    return (
      <SidePanel title={t('schedule.title')} onClose={onClose}>
        <Notice title={t('session.loadFailed')}>{errorMessage(error, lang, fallback)}</Notice>
      </SidePanel>
    );
  }
  if (!data) return <SidePanel title={t('common.loading')} onClose={onClose} />;

  const { session, attendees } = data;
  const lead = <span className={styles.pill} style={{ background: `var(--${session.color_token})` }} />;

  if (mode === 'edit') {
    return (
      <SidePanel title={t('sessionForm.editTitle')} lead={lead} onClose={onClose}>
        {/* No key here: remounting the form when the saved session reloads would drop its "saved" callback. */}
        <SessionForm session={session} offerings={offerings} onDone={() => setMode('view')} />
      </SidePanel>
    );
  }

  const day = localDate(session.starts_at);
  const present = new Set(attendees.map((a) => a.member_id));
  const full = session.effective_capacity !== null && session.booked >= session.effective_capacity;
  const entry = entryNote(session.entry_rule, session.starts_at, strings);

  const onCheckIn = (memberId: string) => {
    setFailure(null);
    checkIn.mutate(memberId, {
      onSuccess: ({ summary }) => {
        toast({ message: t('toast.checkedIn', { name: summary.full_name }) });
        setText('');
      },
      onError: (err) => setFailure(errorMessage(err, lang, fallback)),
    });
  };

  const onDelete = () =>
    remove.mutate(session.id, {
      onSuccess: () => {
        toast({ message: t('toast.sessionDeleted') });
        onClose();
      },
      onError: (err) => {
        setMode('view');
        setFailure(err instanceof ApiClientError ? errorMessage(err, lang, fallback) : t('error.generic'));
      },
    });

  return (
    <SidePanel title={session.offering_name} lead={lead} onClose={onClose}>
      {failure && <Notice>{failure}</Notice>}

      <dl className={styles.facts}>
        <div>
          <dt>{t('sessionForm.date')}</dt>
          <dd>
            {t(`weekday.long.${weekdayIndex(day)}` as 'weekday.long.1')}, {formatDate(session.starts_at)}
          </dd>
        </div>
        <div>
          <dt>{t('classTable.time')}</dt>
          <dd>{formatTimeRange(session.starts_at, session.ends_at)}</dd>
        </div>
        <div>
          <dt>{t('session.teacher')}</dt>
          <dd>{session.teacher_name ?? t('common.none')}</dd>
        </div>
        <div>
          <dt>{t('session.entry')}</dt>
          <dd>{entry ? entry.charAt(0).toUpperCase() + entry.slice(1) : t('offerings.entryDefault')}</dd>
        </div>
        <div>
          <dt>{t('session.booked')}</dt>
          <dd className={full ? styles.full : undefined}>
            {session.effective_capacity === null ? session.booked : `${session.booked}/${session.effective_capacity}`}
            {full && ` · ${t('session.full')}`}
          </dd>
        </div>
        {session.note && (
          <div className={styles.wide}>
            <dt>{t('session.note')}</dt>
            <dd>{session.note}</dd>
          </div>
        )}
      </dl>

      <section className={styles.section}>
        <h3 className={styles.overline}>
          {t('session.attendees')} · {tn('signups', attendees.length)}
        </h3>
        {attendees.length === 0 && <p className={styles.none}>{t('session.noAttendees')}</p>}
        <ul className={styles.list}>
          {attendees.map((a) => (
            <li key={a.visit_id} className={styles.person}>
              <Avatar name={a.full_name} size={32} />
              <span className={styles.personText}>
                <strong>{a.full_name}</strong>
                {/* The health note is here because this is the teacher's class list. */}
                {a.health_text && (
                  <span className={styles.health}>
                    <Tag kind="health">{a.health_text}</Tag>
                  </span>
                )}
              </span>
              <Button variant="ghost" size="sm" aria-label={t('session.removeVisitLabel', { name: a.full_name })} disabled={removeVisit.isPending} onClick={() => removeVisit.mutate(a.visit_id)}>
                {t('session.removeVisit')}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h3 className={styles.overline}>{t('session.checkIn')}</h3>
        <Input placeholder={t('members.search.placeholder')} label={t('session.checkIn.search')} value={text} onChange={(e) => setText(e.target.value)} />
        {q.length >= 2 && found.data && (
          <ul className={styles.list}>
            {found.data.members.map((m) => (
              <li key={m.id} className={styles.person}>
                <Avatar name={m.full_name} size={32} />
                <span className={styles.personText}>
                  <strong>{m.full_name}</strong>
                  <span className={styles.sub}>{memberSubline(m, strings)}</span>
                </span>
                {present.has(m.id) ? (
                  <span className={styles.done}>{t('session.checkIn.done')}</span>
                ) : (
                  <Button variant="secondary" size="sm" aria-label={`${t('session.checkIn.action')}: ${m.full_name}`} disabled={checkIn.isPending} onClick={() => onCheckIn(m.id)}>
                    {t('session.checkIn.action')}
                  </Button>
                )}
              </li>
            ))}
            {found.data.members.length === 0 && <li className={styles.none}>{t('session.checkIn.noResults')}</li>}
          </ul>
        )}
      </section>

      {mode === 'confirmDelete' ? (
        <Notice title={t('session.deleteConfirm.title')}>
          {t('session.deleteConfirm.body')}
          <span className={styles.confirm}>
            <Button variant="attention" size="sm" disabled={remove.isPending} onClick={onDelete}>
              {t('session.deleteConfirm.yes')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setMode('view')}>
              {t('common.cancel')}
            </Button>
          </span>
        </Notice>
      ) : (
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setMode('edit')}>
            {t('session.edit')}
          </Button>
          <Button variant="attention" onClick={() => setMode('confirmDelete')}>
            {t('session.delete')}
          </Button>
        </div>
      )}
    </SidePanel>
  );
}

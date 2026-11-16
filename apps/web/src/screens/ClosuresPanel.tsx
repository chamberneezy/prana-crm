import { addDays, isoToDisplayDate } from '@prana/shared';
import { type FormEvent, useState } from 'react';
import { errorMessage } from '../api/client';
import { useAddClosure, useClosures, useRemoveClosure } from '../api/queries';
import { useToast } from '../app/ToastProvider';
import { Button, Input, Notice, SidePanel } from '../components';
import { useLang } from '../i18n';
import formStyles from './forms.module.css';
import styles from './WeekPlanner.module.css';

interface Props {
  /** The week shown; its closed days are listed. */
  monday: string;
  /** The day the form starts on. */
  date: string;
  onClose: () => void;
}

/** "Neradni dani": close a day (a holiday) or open it again. Its sessions are cancelled, not deleted. */
export function ClosuresPanel({ monday, date, onClose }: Props) {
  const { t, lang } = useLang();
  const toast = useToast();
  const closures = useClosures(monday, addDays(monday, 6));
  const add = useAddClosure();
  const remove = useRemoveClosure();
  const [day, setDay] = useState(date);
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);
  const fallback = { generic: t('error.generic'), offline: t('error.offline') };

  const errors = {
    day: !/^\d{4}-\d{2}-\d{2}$/.test(day) ? t('closures.dateRequired') : undefined,
    name: !name.trim() ? t('closures.nameRequired') : undefined,
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (errors.day || errors.name) return;
    add.mutate(
      { date: day, name: name.trim() },
      {
        onSuccess: () => {
          toast({ message: t('toast.closureAdded', { date: isoToDisplayDate(day) }) });
          setName('');
          setTried(false);
        },
      },
    );
  };

  const list = closures.data?.closures ?? [];
  const failure = add.error ?? remove.error;

  return (
    <SidePanel title={t('closures.title')} onClose={onClose}>
      <form className={formStyles.form} onSubmit={submit} noValidate>
        <p className={formStyles.hint}>{t('closures.intro')}</p>
        {failure && <Notice>{errorMessage(failure, lang, fallback)}</Notice>}
        <div className={formStyles.pair}>
          <Input label={t('closures.date')} type="date" value={day} onChange={(e) => setDay(e.target.value)} error={tried ? errors.day : undefined} />
          <Input label={t('closures.name')} value={name} placeholder={t('closures.namePlaceholder')} onChange={(e) => setName(e.target.value)} error={tried ? errors.name : undefined} />
        </div>
        <div className={formStyles.actions}>
          <Button type="submit" disabled={add.isPending}>
            {t('closures.add')}
          </Button>
        </div>
      </form>

      <section className={styles.closures} aria-label={t('closures.inWeek')}>
        <h3 className={styles.overline}>{t('closures.inWeek')}</h3>
        {closures.data && list.length === 0 && <p className={styles.muted}>{t('closures.none')}</p>}
        <ul className={styles.closureList}>
          {list.map((c) => (
            <li key={c.id} className={styles.closureRow}>
              <span>
                <strong>{isoToDisplayDate(c.date)}</strong> · {c.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t('closures.removeLabel', { name: `${isoToDisplayDate(c.date)} ${c.name}` })}
                disabled={remove.isPending}
                onClick={() => remove.mutate(c.id, { onSuccess: () => toast({ message: t('toast.closureRemoved', { date: isoToDisplayDate(c.date) }) }) })}
              >
                {t('closures.remove')}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </SidePanel>
  );
}

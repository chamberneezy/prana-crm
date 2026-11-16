import { addDays, localDate, type OfferingView, type Staff, startOfWeek } from '@prana/shared';
import { type FormEvent, useState } from 'react';
import { useAccess } from '../auth/access';
import { errorMessage } from '../api/client';
import { useAddTeacher, useOfferings, useRemoveTeacher, useRenameTeacher, useSessions, useSetTeacherOfferings, useStaff } from '../api/queries';
import { useToast } from '../app/ToastProvider';
import { useMe } from '../auth/AuthProvider';
import { Button, Checkbox, EmptyState, Input, Notice, PageHeader, SidePanel, Tag } from '../components';
import { useLang } from '../i18n';
import formStyles from './forms.module.css';
import styles from './Offerings.module.css';

type Panel = { kind: 'new' } | { kind: 'edit'; person: Staff } | null;

interface FormProps {
  /** Left out: a new teacher. */
  person?: Staff;
  offerings: OfferingView[];
  onDone: () => void;
}

/** Add or edit a teacher: their name and the class types they teach. */
function TeacherForm({ person, offerings, onDone }: FormProps) {
  const { t, lang } = useLang();
  const toast = useToast();
  const add = useAddTeacher();
  const rename = useRenameTeacher(person?.id ?? '');
  const setOfferings = useSetTeacherOfferings();
  const remove = useRemoveTeacher();
  const isOwner = person?.role === 'owner';

  const [name, setName] = useState(person?.name ?? '');
  const [ticked, setTicked] = useState<string[]>(person ? offerings.filter((o) => o.teacher_ids.includes(person.id)).map((o) => o.id) : []);
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const toggle = (id: string, on: boolean) => setTicked((list) => (on ? [...list, id] : list.filter((x) => x !== id)));

  const nameError = !isOwner && !name.trim() ? t('teacherForm.nameRequired') : undefined;
  const pending = add.isPending || rename.isPending || setOfferings.isPending || remove.isPending;
  const failure = add.error ?? rename.error ?? setOfferings.error ?? remove.error;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (nameError) return;
    try {
      let id = person?.id;
      let saved = person?.name ?? name.trim();
      if (!person) {
        const created = await add.mutateAsync({ name: name.trim() });
        id = created.staff.id;
        saved = created.staff.name;
      } else if (!isOwner && name.trim() !== person.name) {
        saved = (await rename.mutateAsync({ name: name.trim() })).staff.name;
      }
      await setOfferings.mutateAsync({ id: id!, offering_ids: ticked });
      toast({ message: t(person ? 'toast.teacherSaved' : 'toast.teacherAdded', { name: saved }) });
      onDone();
    } catch {
      // Shown from the mutation's error.
    }
  };

  const removeTeacher = () =>
    remove.mutate(person!.id, {
      onSuccess: () => {
        toast({ message: t('toast.teacherRemoved', { name: person!.name }) });
        onDone();
      },
    });

  return (
    <form className={formStyles.form} onSubmit={(e) => void submit(e)} noValidate>
      {failure && <Notice>{errorMessage(failure, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>}
      <Input label={t('teacherForm.name')} value={name} readOnly={isOwner} hint={isOwner ? t('teacherForm.ownerName') : undefined} onChange={(e) => setName(e.target.value)} error={tried ? nameError : undefined} />
      <fieldset className={formStyles.fieldset}>
        <legend className={formStyles.label}>{t('teacherForm.classes')}</legend>
        {offerings.map((o) => (
          <Checkbox key={o.id} checked={ticked.includes(o.id)} onChange={(on) => toggle(o.id, on)}>
            {o.name}
          </Checkbox>
        ))}
        <span className={formStyles.hint}>{t('teacherForm.classesHint')}</span>
      </fieldset>

      {confirming ? (
        <Notice title={t('teacherForm.removeConfirm.title', { name: person!.name })}>
          <p>{t('teacherForm.removeConfirm.body')}</p>
          <div className={formStyles.actions}>
            <Button variant="attention" size="sm" disabled={pending} onClick={removeTeacher}>
              {t('teacherForm.removeConfirm.yes')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </Notice>
      ) : (
        <div className={formStyles.actions}>
          <Button type="submit" disabled={pending}>
            {t(person ? 'common.save' : 'teacherForm.save')}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            {t('common.cancel')}
          </Button>
          {person && !isOwner && (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              {t('teacherForm.remove')}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

/** "Učitelji": who teaches which classes, and how many classes each has this week. */
export function Teachers() {
  const { canEdit } = useAccess();
  const { t, lang } = useLang();
  const { business } = useMe();
  const staff = useStaff();
  const offerings = useOfferings();
  const monday = startOfWeek(localDate(new Date(), business.timezone));
  const week = useSessions(monday, addDays(monday, 6));
  const [panel, setPanel] = useState<Panel>(null);
  const close = () => setPanel(null);

  const people = staff.data?.staff ?? [];
  const all = offerings.data?.offerings ?? [];
  const error = staff.error ?? offerings.error;
  const thisWeek = (id: string) => (week.data?.sessions ?? []).filter((s) => s.teacher_staff_id === id && !s.closure_name).length;

  return (
    <>
      <div className={styles.intro}>
        <PageHeader title={t('teachers.title')}>
          <Button hidden={!canEdit('teachers')} disabled={!offerings.data} onClick={() => setPanel({ kind: 'new' })}>
            {t('teachers.new')}
          </Button>
        </PageHeader>
        <p>{t('teachers.intro')}</p>
      </div>

      {error && <Notice title={t('teachers.loadFailed')}>{errorMessage(error, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>}

      {staff.data && people.length === 0 && <EmptyState title={t('teachers.empty.title')}>{t('teachers.empty.body')}</EmptyState>}

      {people.length > 0 && (
        <section className={styles.group} aria-label={t('teachers.title')}>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('teachers.col.name')}</th>
                  <th scope="col">{t('teachers.col.classes')}</th>
                  <th scope="col" className={styles.number}>
                    {t('teachers.col.thisWeek')}
                  </th>
                  <th scope="col">
                    <span className={styles.srOnly}>{t('teachers.col.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => {
                  const teaches = all.filter((o) => o.teacher_ids.includes(p.id));
                  return (
                    <tr key={p.id}>
                      <td>
                        <span className={styles.name}>
                          {p.name}
                          {p.role === 'owner' && <Tag>{t('teachers.owner')}</Tag>}
                        </span>
                      </td>
                      <td className={styles.muted}>
                        {teaches.length === 0
                          ? t('common.none')
                          : teaches.map((o) => (
                              <span key={o.id} className={styles.name} style={{ marginRight: 12 }}>
                                <span className={styles.pill} style={{ background: `var(--${o.color_token})` }} />
                                {o.name}
                              </span>
                            ))}
                      </td>
                      <td className={styles.number}>{week.data ? thisWeek(p.id) : ''}</td>
                      <td className={styles.actions}>
                        <Button variant="ghost" size="sm" hidden={!canEdit('teachers')} disabled={!offerings.data} onClick={() => setPanel({ kind: 'edit', person: p })} aria-label={`${t('teachers.edit')}: ${p.name}`}>
                          {t('teachers.edit')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {panel?.kind === 'new' && (
        <SidePanel title={t('teacherForm.newTitle')} onClose={close}>
          <TeacherForm offerings={all} onDone={close} />
        </SidePanel>
      )}
      {panel?.kind === 'edit' && (
        <SidePanel title={t('teacherForm.editTitle')} onClose={close}>
          <TeacherForm key={panel.person.id} person={panel.person} offerings={all} onDone={close} />
        </SidePanel>
      )}
    </>
  );
}

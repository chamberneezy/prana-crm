import type { Offering } from '@prana/shared';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { errorMessage } from '../api/client';
import { useCreateOfferingGroup, useOfferingGroups, useOfferings } from '../api/queries';
import { useToast } from '../app/ToastProvider';
import { Button, EmptyState, Input, Notice, PageHeader, SidePanel, Tag } from '../components';
import { useLang } from '../i18n';
import formStyles from './forms.module.css';
import { OfferingForm } from './OfferingForm';
import styles from './Offerings.module.css';

type Panel = { kind: 'new' } | { kind: 'edit'; offering: Offering } | { kind: 'group' } | null;

function GroupForm({ onDone }: { onDone: () => void }) {
  const { t, lang } = useLang();
  const toast = useToast();
  const create = useCreateOfferingGroup();
  const [name, setName] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim() },
      {
        onSuccess: ({ group }) => {
          toast({ message: t('toast.groupSaved', { name: group.name }) });
          onDone();
        },
      },
    );
  };

  return (
    <form className={formStyles.form} onSubmit={submit} noValidate>
      {create.error && <Notice>{errorMessage(create.error, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>}
      <Input label={t('offerings.newGroup.name')} value={name} onChange={(e) => setName(e.target.value)} />
      <div className={formStyles.actions}>
        <Button type="submit" disabled={create.isPending || !name.trim()}>
          {t('offerings.newGroup.save')}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

export function Offerings() {
  const { t, tn, lang } = useLang();
  const navigate = useNavigate();
  const groups = useOfferingGroups();
  const offerings = useOfferings();
  const [panel, setPanel] = useState<Panel>(null);
  const close = () => setPanel(null);

  const error = groups.error ?? offerings.error;
  const groupList = groups.data?.groups ?? [];
  const all = offerings.data?.offerings ?? [];

  return (
    <>
      <div className={styles.intro}>
        <PageHeader title={t('offerings.title')}>
          <Button onClick={() => setPanel({ kind: 'new' })} disabled={groupList.length === 0}>
            {t('offerings.new')}
          </Button>
        </PageHeader>
        <p>{t('offerings.intro')}</p>
      </div>

      {error && <Notice title={t('offerings.loadFailed')}>{errorMessage(error, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>}

      {groupList.map((group) => {
        const rows = all.filter((o) => o.group_id === group.id);
        return (
          <section key={group.id} className={styles.group} aria-label={group.name}>
            <div className={styles.groupHead}>
              <h2>{group.name}</h2>
              <span>{tn('offerings.count', rows.length)}</span>
            </div>
            {rows.length === 0 ? (
              <div className={styles.emptyGroup}>{t('offerings.emptyGroup')}</div>
            ) : (
              <div className={styles.scroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{t('offerings.col.class')}</th>
                      <th scope="col">{t('offerings.col.duration')}</th>
                      <th scope="col">{t('offerings.col.entry')}</th>
                      <th scope="col" className={styles.number}>
                        {t('offerings.col.thisWeek')}
                      </th>
                      <th scope="col">
                        <span className={styles.srOnly}>{t('offerings.col.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <span className={styles.name}>
                            <span className={styles.pill} style={{ background: `var(--${o.color_token})` }} />
                            {o.name}
                            {!o.active && <Tag>{t('offerings.inactive')}</Tag>}
                          </span>
                        </td>
                        <td className={styles.tabular}>{t('common.minutes', { n: o.default_duration_min })}</td>
                        <td className={styles.muted}>{o.entry_rule ?? t('offerings.entryDefault')}</td>
                        <td className={styles.number}>{o.sessions_this_week}</td>
                        <td className={styles.actions}>
                          {o.active && (
                            <button type="button" className={styles.link} onClick={() => navigate('/raspored', { state: { newFrom: o.id } })}>
                              {t('offerings.schedule')}
                            </button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setPanel({ kind: 'edit', offering: o })}>
                            {t('offerings.edit')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {groups.data && (
        <section className={styles.newGroup}>
          <EmptyState
            title={t('offerings.newGroup.title')}
            action={
              <Button variant="secondary" size="sm" onClick={() => setPanel({ kind: 'group' })}>
                {t('offerings.newGroup.add')}
              </Button>
            }
          >
            {t('offerings.newGroup.body')}
          </EmptyState>
        </section>
      )}

      {panel?.kind === 'new' && (
        <SidePanel title={t('offeringForm.newTitle')} onClose={close}>
          <OfferingForm groups={groupList} onDone={close} />
        </SidePanel>
      )}
      {panel?.kind === 'edit' && (
        <SidePanel title={t('offeringForm.editTitle')} onClose={close}>
          <OfferingForm key={panel.offering.id} offering={panel.offering} groups={groupList} onDone={close} />
        </SidePanel>
      )}
      {panel?.kind === 'group' && (
        <SidePanel title={t('offerings.newGroup.title')} onClose={close}>
          <GroupForm onDone={close} />
        </SidePanel>
      )}
    </>
  );
}

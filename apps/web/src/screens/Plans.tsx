import { formatMoney, formatMoneyInput, parseMoney, type Plan } from '@prana/shared';
import { type FormEvent, useState } from 'react';
import { CanEdit, useAccess } from '../auth/access';
import { errorMessage } from '../api/client';
import { useCreatePlan, useDeletePlan, usePlans, useSavePlan } from '../api/queries';
import { useToast } from '../app/ToastProvider';
import { Button, Input, Notice, PageHeader, SidePanel } from '../components';
import { useLang } from '../i18n';
import formStyles from './forms.module.css';
import styles from './Plans.module.css';

/** Edit a plan, or (without `plan`) add one of the studio's own. Own plans also set their visits and can be removed. */
function PlanForm({ plan, onDone }: { plan?: Plan; onDone: () => void }) {
  const { t, lang } = useLang();
  const toast = useToast();
  const own = !plan || plan.code === 'custom';
  const create = useCreatePlan();
  const save = useSavePlan(plan?.id ?? '');
  const remove = useDeletePlan();
  const [name, setName] = useState(plan?.name ?? '');
  const [visits, setVisits] = useState(plan?.visits_per_month == null ? '' : String(plan.visits_per_month));
  const [price, setPrice] = useState(plan?.price_cents == null ? '' : formatMoneyInput(plan.price_cents));
  const [tried, setTried] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const cents = price.trim() ? parseMoney(price) : null;
  const visitsNumber = visits.trim() ? Number(visits.trim()) : null;
  const errors = {
    name: !name.trim() ? t('offeringForm.nameRequired') : undefined,
    price: price.trim() && cents === null ? t('plans.priceInvalid') : undefined,
    visits: visitsNumber !== null && (!Number.isInteger(visitsNumber) || visitsNumber < 1 || visitsNumber > 100) ? t('plans.visitsInvalid') : undefined,
  };
  const failed = create.error ?? save.error ?? remove.error;
  const busy = create.isPending || save.isPending || remove.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (errors.name || errors.price || (own && errors.visits)) return;
    const done = (message: string) => {
      toast({ message });
      onDone();
    };
    if (!plan) {
      create.mutate({ name: name.trim(), visits_per_month: visitsNumber, price_cents: cents }, { onSuccess: ({ plan: added }) => done(t('plans.added', { name: added.name })) });
      return;
    }
    save.mutate({ name: name.trim(), price_cents: cents, ...(own ? { visits_per_month: visitsNumber } : {}) }, { onSuccess: ({ plan: saved }) => done(t('toast.planSaved', { name: saved.name })) });
  };

  return (
    <form className={formStyles.form} onSubmit={submit} noValidate>
      {failed && <Notice>{errorMessage(failed, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>}
      <Input label={t('plans.name')} value={name} onChange={(e) => setName(e.target.value)} error={tried ? errors.name : undefined} />
      {own && <Input label={t('plans.visits')} inputMode="numeric" value={visits} onChange={(e) => setVisits(e.target.value)} error={tried ? errors.visits : undefined} hint={t('plans.visitsHint')} />}
      <Input label={t('plans.price')} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" error={tried ? errors.price : undefined} hint={t('plans.priceHint')} />
      <div className={formStyles.actions}>
        <Button type="submit" disabled={busy}>
          {t('common.save')}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
      {plan && own && (
        <div className={formStyles.actions}>
          {confirmRemove ? (
            <>
              <span className={styles.muted}>{t('plans.removeConfirm', { name: plan.name })}</span>
              <Button variant="attention" disabled={busy} onClick={() =>
                  remove.mutate(plan.id, {
                    onSuccess: () => {
                      toast({ message: t('plans.removed', { name: plan.name }) });
                      onDone();
                    },
                  })
                }>
                {t('plans.remove')}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmRemove(true)}>
              {t('plans.remove')}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

/** "Članarine": the plans and what each costs for a month. */
export function Plans() {
  const { canEdit } = useAccess();
  const { t, tn, lang } = useLang();
  const { data, error } = usePlans();
  // A plan being edited, `new` for adding one, or null.
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);

  return (
    <>
      <div className={styles.intro}>
        <PageHeader title={t('plans.title')}>
          <CanEdit area="plans">
            <Button onClick={() => setEditing('new')}>{t('plans.new')}</Button>
          </CanEdit>
        </PageHeader>
        <p>{t('plans.intro')}</p>
      </div>

      {error && <Notice title={t('plans.loadFailed')}>{errorMessage(error, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>}

      {data && (
        <section className={styles.card} aria-label={t('plans.title')}>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('plans.col.plan')}</th>
                  <th scope="col">{t('plans.col.visits')}</th>
                  <th scope="col" className={styles.number}>
                    {t('plans.col.price')}
                  </th>
                  <th scope="col">
                    <span className={styles.srOnly}>{t('offerings.col.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.plans.map((p) => (
                  <tr key={p.id}>
                    <td className={styles.name}>
                      {p.name}
                      {p.code === 'custom' && <span className={styles.muted}> · {t('plans.own')}</span>}
                    </td>
                    <td className={styles.muted}>{p.visits_per_month === null ? t('plans.unlimited') : t('plans.visitsPerMonth', { n: `${p.visits_per_month} ${tn('visits', p.visits_per_month)}` })}</td>
                    <td className={styles.number}>{p.price_cents === null ? <span className={styles.muted}>{t('plans.noPrice')}</span> : <strong>{formatMoney(p.price_cents)}</strong>}</td>
                    <td className={styles.actions}>
                      <Button variant="ghost" size="sm" hidden={!canEdit('plans')} aria-label={`${t('plans.edit')}: ${p.name}`} onClick={() => setEditing(p)}>
                        {t('plans.edit')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing && (
        <SidePanel title={t(editing === 'new' ? 'plans.newTitle' : 'plans.editTitle')} onClose={() => setEditing(null)}>
          <PlanForm key={editing === 'new' ? 'new' : editing.id} plan={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
        </SidePanel>
      )}
    </>
  );
}

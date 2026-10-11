import { formatMoney, formatMoneyInput, parseMoney, type Plan } from '@prana/shared';
import { type FormEvent, useState } from 'react';
import { errorMessage } from '../api/client';
import { usePlans, useSavePlan } from '../api/queries';
import { useToast } from '../app/ToastProvider';
import { Button, Input, Notice, PageHeader, SidePanel } from '../components';
import { useLang } from '../i18n';
import formStyles from './forms.module.css';
import styles from './Plans.module.css';

function PlanForm({ plan, onDone }: { plan: Plan; onDone: () => void }) {
  const { t, lang } = useLang();
  const toast = useToast();
  const save = useSavePlan(plan.id);
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(plan.price_cents === null ? '' : formatMoneyInput(plan.price_cents));
  const [tried, setTried] = useState(false);

  const cents = price.trim() ? parseMoney(price) : null;
  const errors = {
    name: !name.trim() ? t('offeringForm.nameRequired') : undefined,
    price: price.trim() && cents === null ? t('plans.priceInvalid') : undefined,
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (errors.name || errors.price) return;
    save.mutate(
      { name: name.trim(), price_cents: cents },
      {
        onSuccess: ({ plan: saved }) => {
          toast({ message: t('toast.planSaved', { name: saved.name }) });
          onDone();
        },
      },
    );
  };

  return (
    <form className={formStyles.form} onSubmit={submit} noValidate>
      {save.error && <Notice>{errorMessage(save.error, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>}
      <Input label={t('plans.name')} value={name} onChange={(e) => setName(e.target.value)} error={tried ? errors.name : undefined} />
      <Input label={t('plans.price')} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" error={tried ? errors.price : undefined} hint={t('plans.priceHint')} />
      <div className={formStyles.actions}>
        <Button type="submit" disabled={save.isPending}>
          {t('common.save')}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

/** "Karte i članarine": the plans and what each costs for a month. */
export function Plans() {
  const { t, tn, lang } = useLang();
  const { data, error } = usePlans();
  const [editing, setEditing] = useState<Plan | null>(null);

  return (
    <>
      <div className={styles.intro}>
        <PageHeader title={t('plans.title')} />
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
                    <td className={styles.name}>{p.name}</td>
                    <td className={styles.muted}>{p.visits_per_month === null ? t('plans.unlimited') : t('plans.visitsPerMonth', { n: `${p.visits_per_month} ${tn('visits', p.visits_per_month)}` })}</td>
                    <td className={styles.number}>{p.price_cents === null ? <span className={styles.muted}>{t('plans.noPrice')}</span> : <strong>{formatMoney(p.price_cents)}</strong>}</td>
                    <td className={styles.actions}>
                      <Button variant="ghost" size="sm" aria-label={`${t('plans.edit')}: ${p.name}`} onClick={() => setEditing(p)}>
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
        <SidePanel title={t('plans.editTitle')} onClose={() => setEditing(null)}>
          <PlanForm key={editing.id} plan={editing} onDone={() => setEditing(null)} />
        </SidePanel>
      )}
    </>
  );
}

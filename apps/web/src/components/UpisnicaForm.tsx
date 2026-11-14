import { formatDate, formatMoney, tidyDisplayDate, typingDate, type UpisnicaPlan, type UpisnicaValue } from '@prana/shared';
import { type ReactNode, useState } from 'react';
import { useLang } from '../i18n';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Choice } from './Choice';
import { Input } from './Input';
import styles from './UpisnicaForm.module.css';

const PLANS: UpisnicaPlan[] = ['1x', '2x', '3x', 'unl'];

const EMPTY: UpisnicaValue = { name: '', email: '', phone: '', dob: '', student: false, plan: '2x', health: false, healthText: '', consent: false, news: false };

/** Where and when the form was signed, as typed: a place and a dd.mm.yyyy. date. */
export interface UpisnicaSigned {
  place: string;
  date: string;
}

/** The studio's paper enrolment form (upisnica): details, student flag, plan, health note, two consents, place/date, signature. */
export interface UpisnicaFormProps {
  initial?: Partial<UpisnicaValue>;
  /** Where the form was signed. Shown in its own field, which the owner can correct. */
  place?: string;
  /** dd.mm.yyyy.; today when left out. */
  date?: string;
  onChange?: (v: UpisnicaValue) => void;
  /** Only fires when the accuracy consent is ticked and a name is given. */
  onSave?: (v: UpisnicaValue, signed: UpisnicaSigned) => void;
  onCancel?: () => void;
  /** `edit` changes an existing member: no plan picker, and the button says "Spremi promjene". */
  mode?: 'new' | 'edit';
  /** Messages for fields that need attention; shown in the error state. */
  errors?: Partial<Record<'name' | 'email' | 'phone' | 'dob' | 'healthText' | 'date', string>>;
  /** A save is in progress. */
  busy?: boolean;
  /** Each plan's price in cents (null: none set). Shown with the plans; a plan without a price skips "Plaćeno?". */
  prices?: Partial<Record<UpisnicaPlan, number | null>>;
}

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        {n} · {title}
      </div>
      {children}
    </div>
  );
}

export function UpisnicaForm({ initial, place, date, onChange, onSave, onCancel, mode = 'new', errors = {}, busy = false, prices }: UpisnicaFormProps) {
  const edit = mode === 'edit';
  const { t } = useLang();
  const [v, setV] = useState<UpisnicaValue>({ ...EMPTY, ...initial });
  const [tried, setTried] = useState(false);
  const [signed, setSigned] = useState<UpisnicaSigned>({ place: place ?? '', date: date ?? formatDate(new Date()) });

  const set = (patch: Partial<UpisnicaValue>) => {
    const next = { ...v, ...patch };
    setV(next);
    onChange?.(next);
  };
  const price = prices?.[v.plan];
  // Asked only on a new member, and only when the chosen plan has something to pay.
  const askPaid = !edit && price !== null && price !== 0;
  const save = () => {
    setTried(true);
    if (askPaid && !v.paid) return;
    if (v.consent && v.name.trim()) onSave?.(askPaid ? v : { ...v, paid: undefined }, { place: signed.place.trim(), date: signed.date.trim() });
  };

  return (
    <div className={styles.form}>
      <div className={styles.intro}>
        <div className={styles.title}>{t(edit ? 'upisnica.editTitle' : 'upisnica.title')}</div>
        {!edit && <p className={styles.text}>{t('upisnica.intro')}</p>}
      </div>

      <Section n="01" title={t('upisnica.section.details')}>
        <div className={styles.fields}>
          <Input
            label={t('upisnica.name')}
            value={v.name}
            onChange={(e) => set({ name: e.target.value })}
            error={tried && !v.name.trim() ? t('upisnica.nameRequired') : errors.name}
            style={{ gridColumn: '1 / -1' }}
          />
          <Input label={t('upisnica.email')} type="email" value={v.email} onChange={(e) => set({ email: e.target.value })} error={errors.email} />
          <Input label={t('upisnica.phone')} type="tel" value={v.phone} onChange={(e) => set({ phone: e.target.value })} error={errors.phone} />
          <Input
            label={t('upisnica.dob')}
            placeholder={t('upisnica.dobPlaceholder')}
            inputMode="decimal"
            value={v.dob}
            onChange={(e) => set({ dob: typingDate(v.dob, e.target.value) })}
            onBlur={() => set({ dob: tidyDisplayDate(v.dob) })}
            error={errors.dob}
          />
          <div className={styles.labelled}>
            <span className={styles.label}>{t('upisnica.student')}</span>
            <Choice
              value={v.student}
              onChange={(student) => set({ student })}
              options={[
                { value: false, label: t('upisnica.no') },
                { value: true, label: t('upisnica.yes') },
              ]}
            />
          </div>
        </div>
      </Section>

      {!edit && (
        <Section n="02" title={t('upisnica.section.plan')}>
          <Choice
            layout="grid"
            columns={2}
            value={v.plan}
            onChange={(plan) => set({ plan })}
            options={PLANS.map((plan) => {
              const cost = prices?.[plan];
              return { value: plan, label: t(`plan.${plan}`), sub: cost ? `${t(`plan.${plan}.sub`)} · ${formatMoney(cost)}` : t(`plan.${plan}.sub`) };
            })}
          />
          {askPaid && (
            <div className={styles.labelled}>
              <span className={styles.label}>{price ? t('upisnica.paidAmount', { amount: formatMoney(price) }) : t('upisnica.paid')}</span>
              <Choice<NonNullable<UpisnicaValue['paid']>>
                value={v.paid}
                onChange={(paid) => set({ paid })}
                options={[
                  { value: 'cash', label: t('method.cash.label') },
                  { value: 'card', label: t('method.card.label') },
                  { value: 'transfer', label: t('method.transfer.label') },
                  { value: 'later', label: t('upisnica.paid.later') },
                ]}
              />
              {tried && !v.paid ? <span className={styles.error}>{t('upisnica.paidRequired')}</span> : <span className={styles.hint}>{t('upisnica.paidHint')}</span>}
            </div>
          )}
        </Section>
      )}

      <Section n="03" title={t('upisnica.section.health')}>
        <p className={styles.text}>{t('upisnica.healthQuestion')}</p>
        <Choice
          value={v.health}
          onChange={(health) => set({ health })}
          options={[
            { value: false, label: t('upisnica.healthNo') },
            { value: true, label: t('upisnica.healthYes') },
          ]}
        />
        {v.health && <Input label={t('upisnica.healthDetail')} multiline value={v.healthText} onChange={(e) => set({ healthText: e.target.value })} error={errors.healthText} />}
        <span className={styles.hint}>{t('upisnica.healthHint')}</span>
      </Section>

      <Section n="04" title={t('upisnica.section.consents')}>
        <Checkbox checked={v.consent} onChange={(consent) => set({ consent })} required invalid={tried && !v.consent}>
          {t('upisnica.consentAccuracy')}
        </Checkbox>
        <Checkbox checked={v.news} onChange={(news) => set({ news })}>
          {t('upisnica.consentNews')}
        </Checkbox>
      </Section>

      <div className={styles.footer}>
        <Input label={t('upisnica.place')} value={signed.place} onChange={(e) => setSigned({ ...signed, place: e.target.value })} />
        <Input
          label={t('upisnica.signedDate')}
          placeholder={t('upisnica.dobPlaceholder')}
          inputMode="decimal"
          value={signed.date}
          onChange={(e) => setSigned({ ...signed, date: typingDate(signed.date, e.target.value) })}
          onBlur={() => setSigned({ ...signed, date: tidyDisplayDate(signed.date) })}
          error={errors.date}
        />
        <div className={styles.signatureField}>
          <span className={styles.label}>{t('upisnica.signature')}</span>
          <div className={styles.signatureBox}>
            <span className={styles.signature}>{v.name}</span>
            <span className={styles.signatureHint}>{t('upisnica.signatureHint')}</span>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Button onClick={save} disabled={!v.consent || busy}>
          {t(edit ? 'upisnica.saveChanges' : 'upisnica.save')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('upisnica.cancel')}
        </Button>
        {!v.consent && <span className={styles.consentNeeded}>{t('upisnica.consentNeeded')}</span>}
      </div>
    </div>
  );
}

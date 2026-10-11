import { formatDate, type UpisnicaPlan, type UpisnicaValue } from '@prana/shared';
import { type ReactNode, useState } from 'react';
import { useLang } from '../i18n';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Choice } from './Choice';
import { Input } from './Input';
import styles from './UpisnicaForm.module.css';

const PLANS: UpisnicaPlan[] = ['1x', '2x', '3x', 'unl'];

const EMPTY: UpisnicaValue = { name: '', email: '', phone: '', dob: '', student: false, plan: '2x', health: false, healthText: '', consent: false, news: false };

/** The studio's paper enrolment form (upisnica): details, student flag, plan, health note, two consents, place/date, signature. */
export interface UpisnicaFormProps {
  initial?: Partial<UpisnicaValue>;
  place?: string;
  /** dd.mm.yyyy.; today when left out. */
  date?: string;
  onChange?: (v: UpisnicaValue) => void;
  /** Only fires when the accuracy consent is ticked and a name is given. */
  onSave?: (v: UpisnicaValue) => void;
  onCancel?: () => void;
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

export function UpisnicaForm({ initial, place, date, onChange, onSave, onCancel }: UpisnicaFormProps) {
  const { t } = useLang();
  const [v, setV] = useState<UpisnicaValue>({ ...EMPTY, ...initial });
  const [tried, setTried] = useState(false);

  const set = (patch: Partial<UpisnicaValue>) => {
    const next = { ...v, ...patch };
    setV(next);
    onChange?.(next);
  };
  const save = () => {
    setTried(true);
    if (v.consent && v.name.trim()) onSave?.(v);
  };

  return (
    <div className={styles.form}>
      <div className={styles.intro}>
        <div className={styles.title}>{t('upisnica.title')}</div>
        <p className={styles.text}>{t('upisnica.intro')}</p>
      </div>

      <Section n="01" title={t('upisnica.section.details')}>
        <div className={styles.fields}>
          <Input
            label={t('upisnica.name')}
            value={v.name}
            onChange={(e) => set({ name: e.target.value })}
            error={tried && !v.name.trim() ? t('upisnica.nameRequired') : undefined}
            style={{ gridColumn: '1 / -1' }}
          />
          <Input label={t('upisnica.email')} type="email" value={v.email} onChange={(e) => set({ email: e.target.value })} />
          <Input label={t('upisnica.phone')} type="tel" value={v.phone} onChange={(e) => set({ phone: e.target.value })} />
          <Input label={t('upisnica.dob')} placeholder={t('upisnica.dobPlaceholder')} value={v.dob} onChange={(e) => set({ dob: e.target.value })} />
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

      <Section n="02" title={t('upisnica.section.plan')}>
        <Choice
          layout="grid"
          columns={2}
          value={v.plan}
          onChange={(plan) => set({ plan })}
          options={PLANS.map((plan) => ({ value: plan, label: t(`plan.${plan}`), sub: t(`plan.${plan}.sub`) }))}
        />
      </Section>

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
        {v.health && <Input label={t('upisnica.healthDetail')} multiline value={v.healthText} onChange={(e) => set({ healthText: e.target.value })} />}
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
        <Input label={t('upisnica.placeDate')} readOnly value={[place, date ?? formatDate(new Date())].filter(Boolean).join(', ')} />
        <div className={styles.labelled}>
          <span className={styles.label}>{t('upisnica.signature')}</span>
          <div className={styles.signatureBox}>
            <span className={styles.signature}>{v.name}</span>
            <span className={styles.signatureHint}>{t('upisnica.signatureHint')}</span>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Button onClick={save} disabled={!v.consent}>
          {t('upisnica.save')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('upisnica.cancel')}
        </Button>
        {!v.consent && <span className={styles.consentNeeded}>{t('upisnica.consentNeeded')}</span>}
      </div>
    </div>
  );
}

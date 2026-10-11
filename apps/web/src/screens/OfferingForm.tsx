import { COLOR_TOKENS, type ColorToken, type Offering, type OfferingGroup } from '@prana/shared';
import { type FormEvent, useState } from 'react';
import { errorMessage } from '../api/client';
import { useSaveOffering } from '../api/queries';
import { useToast } from '../app/ToastProvider';
import { Button, Checkbox, Input, Notice, Select } from '../components';
import { cx } from '../components/cx';
import { useLang } from '../i18n';
import { wholeNumber } from '../lib/session';
import styles from './forms.module.css';

interface Props {
  /** Left out: a new class type. */
  offering?: Offering;
  groups: OfferingGroup[];
  onDone: () => void;
}

/** Create or edit a class type: a template with no day or time. */
export function OfferingForm({ offering, groups, onDone }: Props) {
  const { t, lang } = useLang();
  const toast = useToast();
  const save = useSaveOffering(offering?.id);

  const [name, setName] = useState(offering?.name ?? '');
  const [groupId, setGroupId] = useState(offering?.group_id ?? groups[0]?.id ?? '');
  const [color, setColor] = useState<ColorToken>(offering?.color_token ?? 'class-spine');
  const [duration, setDuration] = useState(String(offering?.default_duration_min ?? 60));
  const [entryRule, setEntryRule] = useState(offering?.entry_rule ?? '');
  const [capacity, setCapacity] = useState(offering?.default_capacity ? String(offering.default_capacity) : '');
  const [active, setActive] = useState(offering?.active ?? true);
  const [tried, setTried] = useState(false);

  const minutes = wholeNumber(duration);
  const places = wholeNumber(capacity);
  const errors = {
    name: !name.trim() ? t('offeringForm.nameRequired') : undefined,
    duration: minutes === null || Number.isNaN(minutes) || minutes < 5 || minutes > 1440 ? t('offeringForm.durationInvalid') : undefined,
    capacity: places !== null && (Number.isNaN(places) || places < 1 || places > 1000) ? t('offeringForm.capacityInvalid') : undefined,
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (errors.name || errors.duration || errors.capacity || !groupId) return;
    save.mutate(
      { group_id: groupId, name: name.trim(), color_token: color, default_duration_min: minutes ?? 60, entry_rule: entryRule.trim() || null, default_capacity: places, active },
      {
        onSuccess: ({ offering: saved }) => {
          toast({ message: t('toast.offeringSaved', { name: saved.name }) });
          onDone();
        },
      },
    );
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {save.error && <Notice>{errorMessage(save.error, lang, { generic: t('error.generic'), offline: t('error.offline') })}</Notice>}
      <Input label={t('offeringForm.name')} value={name} onChange={(e) => setName(e.target.value)} error={tried ? errors.name : undefined} />
      <Select label={t('offeringForm.group')} value={groupId} onChange={setGroupId} options={groups.map((g) => ({ value: g.id, label: g.name }))} />

      <div className={styles.labelled}>
        <span className={styles.label} id="offering-color">
          {t('offeringForm.color')}
        </span>
        <div role="radiogroup" aria-labelledby="offering-color" className={styles.swatches}>
          {COLOR_TOKENS.map((token) => (
            <button key={token} type="button" role="radio" aria-checked={token === color} aria-label={t(`color.${token}`)} title={t(`color.${token}`)} onClick={() => setColor(token)} className={cx(styles.swatch, token === color && styles.swatchSelected)}>
              <span className={styles.pill} style={{ background: `var(--${token})` }} />
            </button>
          ))}
        </div>
      </div>

      <div className={styles.pair}>
        <Input label={t('offeringForm.duration')} value={duration} onChange={(e) => setDuration(e.target.value)} error={tried ? errors.duration : undefined} />
        <Input label={t('offeringForm.capacity')} value={capacity} onChange={(e) => setCapacity(e.target.value)} error={tried ? errors.capacity : undefined} hint={t('offeringForm.capacityHint')} />
      </div>
      <Input label={t('offeringForm.entry')} value={entryRule} onChange={(e) => setEntryRule(e.target.value)} hint={t('offeringForm.entryHint')} />
      <Checkbox checked={active} onChange={setActive}>
        {t('offeringForm.active')}
      </Checkbox>

      <div className={styles.actions}>
        <Button type="submit" disabled={save.isPending}>
          {t(offering ? 'common.save' : 'offeringForm.save')}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

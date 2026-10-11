import { displayToIsoDate, type DocumentResponse, localDate, type MemberResponse, SCAN_FIELDS, type ScanField, STUDIO_PLACE, type UpisnicaValue } from '@prana/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, ApiClientError, errorMessage } from '../api/client';
import { Button, MemberProfile, Notice, PageHeader, Toast, UpisnicaForm } from '../components';
import { cx } from '../components/cx';
import { useLang } from '../i18n';
import { isPdf } from '../import/extract';
import { fieldErrors, planLabel, statusLabel, type UpisnicaErrors, upisnicaToInput, validateUpisnica } from '../lib/member';
import type { ImportedForm } from './ImportMember';
import styles from './ReviewImport.module.css';

interface Props {
  imported: ImportedForm;
  onAnother: () => void;
}

// The form fields that can show an error state.
const TEXT_FIELDS = ['name', 'email', 'phone', 'dob', 'healthText'] as const;

/** "Provjerite podatke": the original beside the pre-filled form. Nothing is saved until the owner says so. */
export function ReviewImport({ imported, onAnother }: Props) {
  const strings = useLang();
  const { t, tn, lang } = strings;
  const queryClient = useQueryClient();
  const { file, extracted, scan } = imported;

  const initial: UpisnicaValue = { name: scan.name, email: scan.email, phone: scan.phone, dob: scan.dob, student: scan.student, plan: scan.plan, health: scan.health, healthText: scan.healthText, consent: scan.consent, news: scan.news };
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<UpisnicaErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState<MemberResponse | null>(null);
  const [fileStored, setFileStored] = useState(true);

  const noText = extracted.lines.length === 0;
  const flagged = noText ? [] : scan.needsReview;

  // A flagged field stays marked until the owner changes it.
  const reviewErrors: UpisnicaErrors = {};
  for (const field of TEXT_FIELDS) {
    if (flagged.includes(field) && value[field] === initial[field]) reviewErrors[field] = t(initial[field] ? 'review.fieldCheck' : 'review.fieldEmpty');
  }

  const signedDate = (scan.date && displayToIsoDate(scan.date)) || localDate(new Date());
  // A form that doesn't say where it was signed is taken to be signed at the studio.
  const signedPlace = scan.place || STUDIO_PLACE;

  /** Stores the original with the member, along with what was read from it (for audit and later tuning). */
  const storeFile = async (memberId: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('source', isPdf(file) ? 'pdf' : 'image');
    const { document } = await api<DocumentResponse>('POST', '/documents', form);
    await api<DocumentResponse>('PATCH', `/documents/${document.id}`, { member_id: memberId, ocr_json: { version: 1, source: noText ? 'none' : 'pdf-text', result: { ...scan, regions: undefined }, lines: extracted.lines } });
  };

  const save = async (v: UpisnicaValue) => {
    const found = validateUpisnica(v, strings);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;

    setBusy(true);
    let created: MemberResponse;
    try {
      created = await api<MemberResponse>('POST', '/members', upisnicaToInput(v, { place: signedPlace, date: signedDate }));
    } catch (error) {
      const rejected = error instanceof ApiClientError && error.code === 'invalid_input' ? fieldErrors(error.fields, strings) : {};
      setErrors(rejected);
      if (!Object.keys(rejected).length) setFailure(errorMessage(error, lang, { generic: t('error.generic'), offline: t('error.offline') }));
      setBusy(false);
      return;
    }

    setValue(v);
    setSaved(created);
    try {
      await storeFile(created.member.id);
      setFileStored(true);
    } catch {
      setFileStored(false);
    }
    await queryClient.invalidateQueries({ queryKey: ['members'] });
    setBusy(false);
  };

  const retryFile = async () => {
    if (!saved) return;
    setBusy(true);
    try {
      await storeFile(saved.member.id);
      setFileStored(true);
      await queryClient.invalidateQueries({ queryKey: ['members'] });
    } catch {
      setFileStored(false);
    }
    setBusy(false);
  };

  // "Poništi": the member and their stored file are removed, and the form is back as it was.
  const undo = async () => {
    if (!saved) return;
    setBusy(true);
    try {
      await api<void>('DELETE', `/members/${saved.member.id}`);
      setSaved(null);
      await queryClient.invalidateQueries({ queryKey: ['members'] });
    } catch (error) {
      setFailure(errorMessage(error, lang, { generic: t('error.generic'), offline: t('error.offline') }));
    }
    setBusy(false);
  };

  const fieldName = (field: ScanField) => t(`review.field.${field}`);
  const box = (field: ScanField) => {
    const region = scan.regions[field];
    if (!region) return null;
    // A little room around the text, as a share of the page so it scales with the image.
    const pad = 3;
    return {
      left: `${((region.x - pad) / extracted.pageWidth) * 100}%`,
      top: `${((region.y - pad) / extracted.pageHeight) * 100}%`,
      width: `${((region.width + 2 * pad) / extracted.pageWidth) * 100}%`,
      height: `${((region.height + 2 * pad) / extracted.pageHeight) * 100}%`,
    };
  };

  return (
    <>
      <button type="button" className={styles.back} onClick={onAnother}>
        ‹ {t('review.back')}
      </button>
      <PageHeader title={t('review.title')}>
        <Button variant="secondary" onClick={onAnother}>
          {t('review.otherFile')}
        </Button>
      </PageHeader>

      {saved && (
        <div className={styles.saved}>
          <Toast action={t('toast.undo')} onAction={() => void undo()}>
            {t('toast.memberSaved', { name: saved.member.full_name })}
          </Toast>
          <Link to={`/clanovi/${saved.member.id}`} className={styles.link}>
            {t('review.openProfile')} ›
          </Link>
        </div>
      )}
      {saved && !fileStored && (
        <Notice title={t('review.uploadFailed.title')}>
          {t('review.uploadFailed.body')}{' '}
          <button type="button" className={styles.retry} disabled={busy} onClick={() => void retryFile()}>
            {t('review.uploadRetry')}
          </button>
        </Notice>
      )}
      {failure && <Notice>{failure}</Notice>}

      <div className={styles.columns}>
        <section aria-label={t('review.originalLabel')} className={styles.original}>
          <div className={styles.originalHead}>
            <h2 className={styles.overline}>{t('review.original')}</h2>
            <span className={styles.fileName}>
              {file.name} · {t('review.pages', { n: extracted.pages })}
            </span>
          </div>
          <div className={styles.page}>
            <img src={extracted.previewUrl} alt={t('review.originalLabel')} />
            {SCAN_FIELDS.map((field) => {
              const style = box(field);
              // Place and date share one line on the form, so one outline is enough.
              if (!style || noText || (field === 'date' && scan.regions.place)) return null;
              const check = flagged.includes(field) || (field === 'place' && flagged.includes('date'));
              return <span key={field} title={fieldName(field)} className={cx(styles.region, check && styles.regionCheck)} style={style} />;
            })}
          </div>
          {!noText && (
            <div className={styles.legend}>
              <span>
                <span className={cx(styles.swatch, styles.swatchCheck)} />
                {t('review.legend.check')}
              </span>
              <span>
                <span className={styles.swatch} />
                {t('review.legend.sure')}
              </span>
            </div>
          )}
        </section>

        <section aria-label={t('review.recognised')} className={styles.fields}>
          {saved ? (
            <MemberProfile
              member={value}
              status={saved.summary.status}
              statusLabel={statusLabel(saved.summary.status, saved.summary.days_left, strings)}
              planLabel={saved.summary.membership ? planLabel(saved.summary.membership.plan_code, strings) : undefined}
              since={t('overview.today').toLowerCase()}
            />
          ) : (
            <>
              {noText && <Notice title={t('review.noText.title')}>{t('review.noText.body')}</Notice>}
              {flagged.length > 0 && <Notice title={tn('review.count', flagged.length)}>{t('review.countBody', { fields: flagged.map(fieldName).join(', ') })}</Notice>}
              <UpisnicaForm initial={value} place={signedPlace} date={scan.date || undefined} errors={{ ...reviewErrors, ...errors }} busy={busy} onChange={setValue} onSave={(v) => void save(v)} onCancel={onAnother} />
            </>
          )}
        </section>
      </div>
    </>
  );
}

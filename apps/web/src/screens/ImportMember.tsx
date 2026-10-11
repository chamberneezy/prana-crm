import { parseUpisnica, type UpisnicaScan } from '@prana/shared';
import { Camera, FileUp, Pencil } from 'lucide-react';
import { type DragEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button, Notice, PageHeader } from '../components';
import { cx } from '../components/cx';
import { DEMO } from '../auth/session';
import { useLang } from '../i18n';
import { checkFile, type Extracted, extractFile, type ImportStep } from '../import/extract';
import styles from './ImportMember.module.css';
import { ReviewImport } from './ReviewImport';

const STEPS: ImportStep[] = ['loading', 'reading', 'filling'];

type Problem = 'type' | 'size' | 'many' | 'unreadable';

export interface ImportedForm {
  file: File;
  extracted: Extracted;
  scan: UpisnicaScan;
}

/** "Novi član": import a filled-in upisnica, or go to manual entry. Nothing is saved before the review. */
export function ImportMember() {
  const { t } = useLang();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState<ImportStep | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [imported, setImported] = useState<ImportedForm | null>(null);

  // The page image lives in the browser's memory; let it go when it is no longer shown.
  const previewUrl = imported?.extracted.previewUrl;
  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);

  const take = async (files: FileList | null) => {
    setProblem(null);
    if (!files?.length) return;
    if (files.length > 1) return setProblem('many');
    const file = files[0]!;
    const wrong = checkFile(file);
    if (wrong) return setProblem(wrong);

    try {
      const extracted = await extractFile(file, setStep);
      setStep('filling');
      setImported({ file, extracted, scan: parseUpisnica(extracted.lines) });
    } catch {
      setProblem('unreadable');
    } finally {
      setStep(null);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void take(e.dataTransfer.files);
  };

  if (imported) return <ReviewImport imported={imported} onAnother={() => setImported(null)} />;

  return (
    <div className={styles.page}>
      <Link to="/clanovi" className={styles.back}>
        ‹ {t('profileScreen.back')}
      </Link>
      <div className={styles.intro}>
        <PageHeader title={t('import.title')} />
        <p>{t('import.intro')}</p>
      </div>

      {problem && <Notice>{t(`import.error.${problem}`)}</Notice>}

      <section
        aria-label={t('import.zoneLabel')}
        className={cx(styles.zone, dragging && styles.zoneOver)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className={styles.zoneIcon}>
          <FileUp size={28} strokeWidth={1.5} aria-hidden />
        </span>
        {step ? (
          <ol className={styles.steps} aria-live="polite">
            {STEPS.map((s) => (
              <li key={s} aria-current={s === step ? 'step' : undefined} className={cx(s === step && styles.stepNow, STEPS.indexOf(s) < STEPS.indexOf(step) && styles.stepDone)}>
                {t(`import.step.${s}`)}
              </li>
            ))}
          </ol>
        ) : (
          <>
            <span className={styles.zoneTitle}>{t('import.drop')}</span>
            <span className={styles.zoneLimits}>{t('import.limits')}</span>
            <Button style={{ minHeight: 44, marginTop: 6 }} onClick={() => input.current?.click()}>
              {t('import.choose')}
            </Button>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
          className={styles.fileInput}
          aria-label={t('import.choose')}
          tabIndex={-1}
          onChange={(e) => {
            void take(e.target.files);
            // So choosing the same file again still counts as a change.
            e.target.value = '';
          }}
        />
      </section>

      <div className={styles.options}>
        <Link to="/clanovi/novi/rucno" className={styles.option}>
          <span className={styles.optionIcon}>
            <Pencil size={22} strokeWidth={1.5} aria-hidden />
          </span>
          <span className={styles.optionText}>
            <strong>{t('import.manual.title')}</strong>
            <span>{t('import.manual.body')}</span>
          </span>
        </Link>
        <div className={styles.option}>
          <span className={styles.optionIcon}>
            <Camera size={22} strokeWidth={1.5} aria-hidden />
          </span>
          <span className={styles.optionText}>
            <strong>{t('import.paper.title')}</strong>
            <span>{t('import.paper.body')}</span>
          </span>
        </div>
      </div>

      <p className={styles.footer}>{t('import.footer')}</p>
      {DEMO && (
        <a className={styles.sample} href={`${import.meta.env.BASE_URL}primjer-upisnice.pdf`} download>
          {t('demo.sample')}
        </a>
      )}
    </div>
  );
}

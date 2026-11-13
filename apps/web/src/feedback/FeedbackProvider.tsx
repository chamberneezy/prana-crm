import type { MessageKey } from '@prana/shared';
import { X } from 'lucide-react';
import { type FormEvent, type ReactNode, type RefObject, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useToast } from '../app/ToastProvider';
import { useMe } from '../auth/AuthProvider';
import { Button, Choice, Input, Notice } from '../components';
import { cx } from '../components/cx';
import { useLang } from '../i18n';
import styles from './Feedback.module.css';
import { FEEDBACK_ENABLED, type FeedbackKind, sendFeedback } from './send';
import { selectorOf, type Target, targetsAt } from './target';

/**
 * Right-click on anything in the signed-in app opens a short form for feedback about it.
 * Shift + right-click keeps the browser's own menu. Off where feedback has nowhere to go.
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [targets, setTargets] = useState<Target[] | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!FEEDBACK_ENABLED) return;
    const onContextMenu = (e: MouseEvent) => {
      if (e.shiftKey || !(e.target instanceof Element)) return;
      // Inside the form itself the usual menu stays, e.g. to paste into the comment.
      if (dialog.current?.contains(e.target)) return;
      e.preventDefault();
      // While the form is open, the shaded page around it is not a target.
      if (e.target.closest('[data-feedback-backdrop]')) return;
      setTargets(targetsAt(e.target));
    };
    document.addEventListener('contextmenu', onContextMenu);
    return () => document.removeEventListener('contextmenu', onContextMenu);
  }, []);

  return (
    <>
      {children}
      {targets && <FeedbackDialog key={targets.map((t) => t.name).join('|')} targets={targets} dialogRef={dialog} onClose={() => setTargets(null)} />}
    </>
  );
}

/** The small hint under the account in the sidebar, where feedback is on. */
export function FeedbackHint({ className }: { className?: string }) {
  const { t } = useLang();
  if (!FEEDBACK_ENABLED) return null;
  return <span className={className}>{t('feedback.hint')}</span>;
}

function useTargetLabel() {
  const { t } = useLang();
  return useCallback((target: Target) => {
    const kind = t(`feedback.target.${target.kind}` as MessageKey);
    if (target.kind === 'page') return `${kind}: ${target.name}`;
    return target.name ? `${kind} „${target.name}”` : `${kind} (${t('feedback.unnamed')})`;
  }, [t]);
}

/** Draws a frame around the chosen target, following it as the page scrolls. */
function Highlight({ el }: { el: Element }) {
  const [box, setBox] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setBox(el.getBoundingClientRect()));
    };
    setBox(el.getBoundingClientRect());
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [el]);
  if (!box) return null;
  const pad = 4;
  return <div aria-hidden className={styles.highlight} style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} />;
}

interface DialogProps {
  targets: Target[];
  dialogRef: RefObject<HTMLDivElement>;
  onClose: () => void;
}

function FeedbackDialog({ targets, dialogRef, onClose }: DialogProps) {
  const { t, lang } = useLang();
  const { staff } = useMe();
  const { pathname } = useLocation();
  const toast = useToast();
  const label = useTargetLabel();
  const titleId = useId();
  const [chosen, setChosen] = useState(0);
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'editing' | 'sending' | 'failed'>('editing');

  // Start in the comment box: the target is already picked by the click.
  useEffect(() => {
    dialogRef.current?.querySelector('textarea')?.focus();
  }, [dialogRef]);

  // There is always at least the clicked element.
  const target = targets[chosen] ?? targets[0]!;
  const page = targets.find((x) => x.kind === 'page');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || state === 'sending') return;
    setState('sending');
    try {
      await sendFeedback({
        kind,
        comment: comment.trim().slice(0, 4000),
        target: {
          label: label(target).slice(0, 400),
          // From the page down to the chosen target.
          path: targets.slice(chosen).map(label).reverse().slice(-12),
          selector: selectorOf(target.el),
        },
        // The address without its query: a search there can hold a member's name.
        page: { path: pathname.slice(0, 300), title: (page?.name ?? document.title).slice(0, 200) },
        lang,
        authorName: staff.name,
      });
      toast({ message: t('feedback.sent') });
      onClose();
    } catch {
      setState('failed');
    }
  };

  return (
    <>
      <div data-feedback-backdrop className={styles.backdrop} onClick={onClose} />
      <Highlight el={target.el} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.dialog}
        onKeyDown={(e) => {
          // Close only this form, not a side panel open beneath it.
          if (e.key === 'Escape') {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            onClose();
          }
        }}
      >
        <header className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {t('feedback.title')}
          </h2>
          <button type="button" className={styles.close} aria-label={t('common.close')} onClick={onClose}>
            <X size={20} strokeWidth={1.5} aria-hidden />
          </button>
        </header>

        <form className={styles.body} onSubmit={(e) => void submit(e)}>
          <fieldset className={styles.group}>
            <legend className={styles.legend}>{t('feedback.about')}</legend>
            <div role="radiogroup" className={styles.targets}>
              {targets.map((x, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={i === chosen}
                  className={cx(styles.target, i === chosen && styles.targetChosen)}
                  onClick={() => setChosen(i)}
                >
                  {label(x)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend className={styles.legend}>{t('feedback.kind')}</legend>
            <Choice<FeedbackKind>
              value={kind}
              onChange={setKind}
              options={[
                { value: 'bug', label: t('feedback.kind.bug') },
                { value: 'idea', label: t('feedback.kind.idea') },
                { value: 'question', label: t('feedback.kind.question') },
              ]}
            />
          </fieldset>

          <Input
            label={t('feedback.comment')}
            multiline
            rows={4}
            value={comment}
            placeholder={t('feedback.placeholder')}
            onChange={(e) => {
              setComment(e.target.value);
              if (state === 'failed') setState('editing');
            }}
          />

          {state === 'failed' && <Notice>{t('feedback.failed')}</Notice>}

          <footer className={styles.foot}>
            <span className={styles.hint}>{t('feedback.shiftHint')}</span>
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!comment.trim() || state === 'sending'}>
              {state === 'sending' ? t('feedback.sending') : t('feedback.send')}
            </Button>
          </footer>
        </form>
      </div>
    </>
  );
}

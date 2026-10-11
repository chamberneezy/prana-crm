import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { useLang } from '../i18n';
import styles from './SidePanel.module.css';

/** A panel on the right edge for a form or a detail view. Esc or the close button dismisses it. */
export interface SidePanelProps {
  title: string;
  /** Shown before the title, e.g. a class colour pill. */
  lead?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
}

export function SidePanel({ title, lead, onClose, children }: SidePanelProps) {
  const { t } = useLang();
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Move focus into the panel when it opens, so keyboard users land in it.
  useEffect(() => panel.current?.focus(), []);

  return (
    <aside ref={panel} role="dialog" aria-label={title} tabIndex={-1} className={styles.panel}>
      <header className={styles.head}>
        {lead}
        <h2 className={styles.title}>{title}</h2>
        <button type="button" className={styles.close} aria-label={t('common.close')} onClick={onClose}>
          <X size={20} strokeWidth={1.5} aria-hidden />
        </button>
      </header>
      <div className={styles.body}>{children}</div>
    </aside>
  );
}

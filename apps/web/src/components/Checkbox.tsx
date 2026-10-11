import type { ReactNode } from 'react';
import { useLang } from '../i18n';
import styles from './Checkbox.module.css';
import { cx } from './cx';

/** Consent-style checkbox with a wrapping label. */
export interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Appends "Obavezno." to the label. */
  required?: boolean;
  /** Required but not ticked: terracotta border + blush ring. */
  invalid?: boolean;
  children?: ReactNode;
}

export function Checkbox({ checked = false, onChange, required = false, invalid = false, children }: CheckboxProps) {
  const { t } = useLang();
  const toggle = () => onChange?.(!checked);
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      aria-required={required || undefined}
      aria-invalid={(invalid && !checked) || undefined}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggle();
        }
      }}
      className={styles.checkbox}
    >
      <span className={cx(styles.box, checked && styles.checked, invalid && !checked && styles.invalid)}>{checked ? '✓' : ''}</span>
      <span className={styles.label}>
        {children}
        {required && <strong className={styles.required}> {t('checkbox.required')}</strong>}
      </span>
    </div>
  );
}

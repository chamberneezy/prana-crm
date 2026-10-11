import type { ChangeEvent, CSSProperties } from 'react';
import { cx } from './cx';
import styles from './Input.module.css';

/** Labelled text field (single or multi-line) with focus, error and read-only states. */
export interface InputProps {
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  /** Error message; turns the border terracotta. */
  error?: string;
  hint?: string;
  readOnly?: boolean;
  multiline?: boolean;
  rows?: number;
  type?: string;
  style?: CSSProperties;
}

export function Input({ label, value, defaultValue, onChange, placeholder, error, hint, readOnly = false, multiline = false, rows = 2, type = 'text', style }: InputProps) {
  const field = {
    value,
    defaultValue,
    onChange,
    placeholder,
    readOnly,
    'aria-invalid': error ? true : undefined,
    className: cx(styles.control, multiline && styles.multiline, readOnly && styles.readOnly, error && styles.invalid),
  };
  return (
    <label className={styles.field} style={style}>
      {label && <span className={styles.label}>{label}</span>}
      {multiline ? <textarea rows={rows} {...field} /> : <input type={type} {...field} />}
      {error && <span className={styles.error}>{error}</span>}
      {!error && hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}

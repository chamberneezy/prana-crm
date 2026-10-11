import { type ChangeEvent, type CSSProperties, useId } from 'react';
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
  name?: string;
  autoComplete?: string;
  style?: CSSProperties;
}

export function Input({ label, value, defaultValue, onChange, placeholder, error, hint, readOnly = false, multiline = false, rows = 2, type = 'text', name, autoComplete, style }: InputProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const field = {
    id,
    value,
    defaultValue,
    onChange,
    placeholder,
    readOnly,
    name,
    autoComplete,
    'aria-invalid': error ? true : undefined,
    // The message belongs to the field as a description, so the label stays just the label.
    'aria-describedby': error || hint ? noteId : undefined,
    className: cx(styles.control, multiline && styles.multiline, readOnly && styles.readOnly, error && styles.invalid),
  };
  return (
    <div className={styles.field} style={style}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
      {multiline ? <textarea rows={rows} {...field} /> : <input type={type} {...field} />}
      {error && (
        <span id={noteId} className={styles.error}>
          {error}
        </span>
      )}
      {!error && hint && (
        <span id={noteId} className={styles.hint}>
          {hint}
        </span>
      )}
    </div>
  );
}

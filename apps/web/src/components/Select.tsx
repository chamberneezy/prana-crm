import { cx } from './cx';
import inputStyles from './Input.module.css';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

/** Labelled drop-down that looks and behaves like Input. */
export interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown as the first, empty choice. */
  placeholder?: string;
  error?: string;
}

export function Select({ label, value, onChange, options, placeholder, error }: SelectProps) {
  return (
    <label className={inputStyles.field}>
      {label && <span className={inputStyles.label}>{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} className={cx(inputStyles.control, styles.select, error && inputStyles.invalid)}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className={inputStyles.error}>{error}</span>}
    </label>
  );
}

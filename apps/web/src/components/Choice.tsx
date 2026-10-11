import styles from './Choice.module.css';
import { cx } from './cx';

export interface ChoiceOption<T extends string | number | boolean = string | number | boolean> {
  value: T;
  label: string;
  sub?: string;
}

/** Single-select choice: inline yes/no buttons, or a grid of option cards (e.g. membership plans). */
export interface ChoiceProps<T extends string | number | boolean = string | number | boolean> {
  options: ChoiceOption<T>[];
  value?: T;
  onChange?: (value: T) => void;
  layout?: 'inline' | 'grid';
  columns?: number;
}

export function Choice<T extends string | number | boolean>({ options, value, onChange, layout = 'inline', columns = 2 }: ChoiceProps<T>) {
  const grid = layout === 'grid';
  return (
    <div
      role="radiogroup"
      className={grid ? styles.grid : styles.inline}
      style={grid ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange?.(o.value)}
            className={cx(styles.option, selected && styles.selected)}
          >
            <span className={styles.label}>{o.label}</span>
            {o.sub && <span className={styles.sub}>{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

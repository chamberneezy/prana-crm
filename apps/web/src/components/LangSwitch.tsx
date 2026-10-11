import { cx } from './cx';
import styles from './LangSwitch.module.css';

/** HR / EN interface language switch. Use dark on the ink sidebar. */
export interface LangSwitchProps {
  value?: string;
  onChange?: (lang: string) => void;
  dark?: boolean;
  options?: string[];
}

export function LangSwitch({ value = 'HR', onChange, dark = false, options = ['HR', 'EN'] }: LangSwitchProps) {
  return (
    <div className={cx(styles.switch, dark && styles.dark)}>
      {options.map((l) => (
        <button key={l} type="button" aria-pressed={l === value} onClick={() => onChange?.(l)} className={cx(styles.option, l === value && styles.selected)}>
          {l}
        </button>
      ))}
    </div>
  );
}

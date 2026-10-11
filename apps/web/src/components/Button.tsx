import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import styles from './Button.module.css';
import { cx } from './cx';

/** Prana action button. One primary per view; attention only for money/destructive actions. */
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'attention';
  size?: 'md' | 'sm';
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', disabled = false, type = 'button', onClick, style, children }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cx(styles.button, styles[variant], size === 'sm' && styles.sm)}
      style={style}
    >
      {children}
    </button>
  );
}

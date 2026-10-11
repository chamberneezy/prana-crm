import type { ReactNode } from 'react';
import { cx } from './cx';
import { LangSwitch } from './LangSwitch';
import styles from './Sidebar.module.css';

export interface SidebarItem {
  id: string;
  label: string;
}

/** Ink app sidebar with logo, sections and language switch. */
export interface SidebarProps {
  items: SidebarItem[];
  active?: string;
  onSelect?: (id: string) => void;
  logoSrc?: string;
  lang?: string;
  onLang?: (lang: string) => void;
  /** Shown at the foot, above the language switch (e.g. sign out). */
  children?: ReactNode;
}

export function Sidebar({ items, active, onSelect, logoSrc, lang = 'HR', onLang, children }: SidebarProps) {
  return (
    <nav className={styles.sidebar}>
      {logoSrc && <img src={logoSrc} alt="Prana" className={styles.logo} />}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-current={item.id === active ? 'page' : undefined}
          onClick={() => onSelect?.(item.id)}
          className={cx(styles.item, item.id === active && styles.active)}
        >
          {item.label}
        </button>
      ))}
      <div className={styles.foot}>
        {children}
        <LangSwitch dark value={lang} onChange={onLang} />
      </div>
    </nav>
  );
}

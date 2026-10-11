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
}

export function Sidebar({ items, active, onSelect, logoSrc, lang = 'HR', onLang }: SidebarProps) {
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
        <LangSwitch dark value={lang} onChange={onLang} />
      </div>
    </nav>
  );
}

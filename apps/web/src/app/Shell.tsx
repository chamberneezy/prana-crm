import type { MessageKey } from '@prana/shared';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import logo from '../assets/prana-mark.png';
import { useAuth, useMe } from '../auth/AuthProvider';
import { DEMO, REAL_SIGN_IN } from '../auth/session';
import { LangSwitch, Sidebar } from '../components';
import { cx } from '../components/cx';
import { useLang } from '../i18n';
import styles from './Shell.module.css';

export const SECTIONS: Array<{ id: string; path: string; label: MessageKey }> = [
  { id: 'overview', path: '/pregled', label: 'nav.overview' },
  { id: 'schedule', path: '/raspored', label: 'nav.schedule' },
  { id: 'offerings', path: '/vrste-satova', label: 'nav.offerings' },
  { id: 'members', path: '/clanovi', label: 'nav.members' },
  { id: 'plans', path: '/karte', label: 'nav.plans' },
  { id: 'payments', path: '/uplate', label: 'nav.payments' },
];

/** The signed-in app: ink sidebar beside the linen workspace; a top bar with a menu below 768 px. */
export function Shell() {
  const { t, lang, setLang } = useLang();
  const { signOut } = useAuth();
  const { staff } = useMe();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Navigating closes the mobile menu.
  useEffect(() => setMenuOpen(false), [pathname]);

  const items = SECTIONS.map((s) => ({ id: s.id, label: t(s.label) }));
  const active = SECTIONS.find((s) => pathname === s.path || pathname.startsWith(`${s.path}/`))?.id;
  const select = (id: string) => navigate(SECTIONS.find((s) => s.id === id)?.path ?? '/');
  const langCode = lang.toUpperCase();
  const onLang = (code: string) => setLang(code === 'EN' ? 'en' : 'hr');

  const account = (
    <div className={styles.account}>
      <span className={styles.staffName}>
        {staff.name}
        {DEMO && ` · ${t(REAL_SIGN_IN ? 'preview.note.title' : 'demo.tag')}`}
      </span>
      <button type="button" className={styles.signOut} onClick={() => void signOut()}>
        {t('auth.logout')}
      </button>
    </div>
  );

  return (
    <div className={styles.shell}>
      <div className={styles.sidebar}>
        <Sidebar items={items} active={active} onSelect={select} logoSrc={logo} lang={langCode} onLang={onLang}>
          {account}
        </Sidebar>
      </div>

      <header className={styles.topBar}>
        <img src={logo} alt="Prana" className={styles.topLogo} />
        <button type="button" className={styles.menuButton} aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={20} strokeWidth={1.5} aria-hidden /> : <Menu size={20} strokeWidth={1.5} aria-hidden />}
          {t('shell.menu')}
        </button>
      </header>
      {menuOpen && (
        <nav id="mobile-menu" className={styles.menu}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={item.id === active ? 'page' : undefined}
              className={cx(styles.menuItem, item.id === active && styles.menuItemActive)}
              onClick={() => select(item.id)}
            >
              {item.label}
            </button>
          ))}
          <div className={styles.menuFoot}>
            {account}
            <LangSwitch dark value={langCode} onChange={onLang} />
          </div>
        </nav>
      )}

      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

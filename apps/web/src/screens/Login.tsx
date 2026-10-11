import { FirebaseError } from 'firebase/app';
import { GoogleAuthProvider, OAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { type FormEvent, useState } from 'react';
import logo from '../assets/prana-mark.png';
import type { AuthNotice } from '../auth/AuthProvider';
import { auth } from '../auth/firebase';
import { Button, Input, LangSwitch } from '../components';
import { useLang } from '../i18n';
import styles from './Login.module.css';

const WRONG_CREDENTIALS = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email', 'auth/missing-password'];
// The owner closed the pop-up: not an error worth a message.
const CANCELLED = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];

export function Login({ notice }: { notice: AuthNotice | null }) {
  const { t, lang, setLang } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'wrong' | 'failed' | null>(null);

  const attempt = async (signIn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : '';
      if (!CANCELLED.includes(code)) setError(WRONG_CREDENTIALS.includes(code) ? 'wrong' : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void attempt(() => signInWithEmailAndPassword(auth, email.trim(), password));
  };

  const message = error === 'wrong' ? t('auth.wrong') : error === 'failed' ? t('auth.failed') : notice === 'noAccess' ? t('auth.noAccess') : notice === 'offline' ? t('error.offline') : notice === 'failed' ? t('auth.failed') : null;

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <img src={logo} alt="Prana" className={styles.logo} />
        <h1 className={styles.title}>{t('auth.title')}</h1>

        {message && (
          <p role="alert" className={styles.message}>
            {message}
          </p>
        )}

        <div className={styles.providers}>
          <Button variant="secondary" disabled={busy} onClick={() => void attempt(() => signInWithPopup(auth, new OAuthProvider('apple.com')))}>
            {t('auth.apple')}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void attempt(() => signInWithPopup(auth, new GoogleAuthProvider()))}>
            {t('auth.google')}
          </Button>
        </div>

        <div className={styles.divider}>
          <span>{t('auth.or')}</span>
        </div>

        <form className={styles.form} onSubmit={submit} noValidate>
          <Input label={t('auth.email')} type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label={t('auth.password')} type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" disabled={busy || !email.trim() || !password}>
            {t('auth.submit')}
          </Button>
        </form>
      </div>
      <LangSwitch value={lang.toUpperCase()} onChange={(code) => setLang(code === 'EN' ? 'en' : 'hr')} />
    </main>
  );
}

import { type FormEvent, useState } from 'react';
import logo from '../assets/prana-mark.png';
import type { AuthNotice } from '../auth/AuthProvider';
import { DEMO, offers, REAL_SIGN_IN, session, SignInFailure } from '../auth/session';
import { Button, Input, LangSwitch } from '../components';
import { useLang } from '../i18n';
import styles from './Login.module.css';

export function Login({ notice }: { notice: AuthNotice | null }) {
  const { t, lang, setLang } = useLang();
  // The plain demo has no accounts, so the fields come filled in and any button lets the visitor in.
  const [email, setEmail] = useState(REAL_SIGN_IN ? '' : 'mario@prana.test');
  const [password, setPassword] = useState(REAL_SIGN_IN ? '' : 'demo');
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'wrong' | 'failed' | null>(null);

  const attempt = async (signIn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await signIn();
    } catch (err) {
      const problem = err instanceof SignInFailure ? err.problem : 'failed';
      if (problem !== 'cancelled') setError(problem);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void attempt(() => session.signInWithEmail(email.trim(), password));
  };

  const forgot = async () => {
    setError(null);
    if (!email.trim()) return setInfo(t('auth.forgotNeedsEmail'));
    await session.sendPasswordReset(email.trim());
    setInfo(t('auth.resetSent'));
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
        {DEMO && (
          <p className={styles.demo}>
            <strong>{t(REAL_SIGN_IN ? 'preview.note.title' : 'demo.note.title')}</strong>
            {t(REAL_SIGN_IN ? 'preview.note.body' : 'demo.note.body')}
          </p>
        )}
        {info && (
          <p role="status" className={styles.demo}>
            {info}
          </p>
        )}

        {(offers('apple') || offers('google')) && (
          <>
            <div className={styles.providers}>
              {offers('apple') && (
                <Button variant="secondary" disabled={busy} onClick={() => void attempt(() => session.signInWithProvider('apple'))}>
                  {t('auth.apple')}
                </Button>
              )}
              {offers('google') && (
                <Button variant="secondary" disabled={busy} onClick={() => void attempt(() => session.signInWithProvider('google'))}>
                  {t('auth.google')}
                </Button>
              )}
            </div>
            {offers('password') && (
              <div className={styles.divider}>
                <span>{t('auth.or')}</span>
              </div>
            )}
          </>
        )}

        {offers('password') && (
          <form className={styles.form} onSubmit={submit} noValidate>
            <Input label={t('auth.email')} type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label={t('auth.password')} type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" disabled={busy || !email.trim() || !password}>
              {t('auth.submit')}
            </Button>
            {REAL_SIGN_IN && (
              <button type="button" className={styles.forgot} onClick={() => void forgot()}>
                {t('auth.forgot')}
              </button>
            )}
          </form>
        )}
      </div>
      <LangSwitch value={lang.toUpperCase()} onChange={(code) => setLang(code === 'EN' ? 'en' : 'hr')} />
      {DEMO && (
        <Button variant="ghost" size="sm" onClick={() => void import('../demo-backend').then((m) => m.resetDemo())}>
          {t('demo.reset')}
        </Button>
      )}
    </main>
  );
}

import { type Lang, type MessageKey, translate, translatePlural } from '@prana/shared';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;
type TranslatePlural = (base: Parameters<typeof translatePlural>[1], n: number, vars?: Record<string, string | number>) => string;

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translate;
  /** Plural-aware: picks the .one / .few / .other form for the count. */
  tn: TranslatePlural;
}

const STORAGE_KEY = 'prana.lang';

// Croatian is the default, so components also work outside a provider.
const LangContext = createContext<LangContextValue>({
  lang: 'hr',
  setLang: () => {},
  t: (key, vars) => translate('hr', key, vars),
  tn: (base, n, vars) => translatePlural('hr', base, n, vars),
});

function storedLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'hr';
  } catch {
    return 'hr';
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(storedLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // the choice just won't be remembered
    }
  }, []);

  const value = useMemo<LangContextValue>(
    () => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars), tn: (base, n, vars) => translatePlural(lang, base, n, vars) }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  return useContext(LangContext);
}

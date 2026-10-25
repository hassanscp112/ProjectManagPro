import { useContext } from 'react';
import { DEFAULT_LANGUAGE, LANGUAGES, translate } from './index.js';
import { I18nContext } from './context.js';

// Safe outside a provider: falls back to the default language.
export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  const fallback = {
    t: (key, vars) => translate(DEFAULT_LANGUAGE, key, vars),
    lang: DEFAULT_LANGUAGE,
    setLang: () => {},
    isRTL: true,
    dir: 'rtl',
    languages: LANGUAGES,
  };
  return fallback;
};

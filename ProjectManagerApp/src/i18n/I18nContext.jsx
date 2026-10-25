import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LANGUAGES, languageDir, loadLanguage, saveLanguage, translate,
} from './index.js';
import { I18nContext } from './context.js';

// Wraps the app. Syncs <html dir/lang> so global CSS and the browser treat
// the whole document as RTL/LTR, and persists the choice.
export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState(loadLanguage);
  const dir = languageDir(lang);

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    saveLanguage(lang);
  }, [lang, dir]);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  const value = useMemo(
    () => ({ t, lang, setLang, isRTL: dir === 'rtl', dir, languages: LANGUAGES }),
    [t, lang, dir]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

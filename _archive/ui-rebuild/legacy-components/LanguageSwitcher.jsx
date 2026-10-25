import { useI18n } from './useI18n.js';

// Compact language toggle for the top bar (عربي / EN).
const LanguageSwitcher = () => {
  const { lang, setLang, languages } = useI18n();
  if (languages.length < 2) return null;

  return (
    <div className="lang-switcher" title="Language / اللغة">
      {languages.map((l) => (
        <button
          key={l.code}
          type="button"
          className={`lang-btn ${lang === l.code ? 'active' : ''}`}
          onClick={() => setLang(l.code)}
        >
          {l.code === 'ar' ? 'عربي' : 'EN'}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;

// ═══════════════════════════════════════════════════════════
// Theme — light / dark / follow the device.
// Storage key: 'pm-theme' ('light' | 'dark' | 'system'; default 'light').
// Applied as <html data-theme="light|dark">; 'system' removes the
// attribute so src/ui/tokens.css follows prefers-color-scheme.
// ═══════════════════════════════════════════════════════════

export const THEME_STORAGE_KEY = 'pm-theme';
export const THEMES = ['light', 'dark', 'system'];
export const DEFAULT_THEME = 'light';

export const loadTheme = () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.includes(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

export const saveTheme = (theme) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, THEMES.includes(theme) ? theme : DEFAULT_THEME);
  } catch {
    // unavailable — the choice lasts for this session
  }
};

export const applyTheme = (theme, root = document.documentElement) => {
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
};

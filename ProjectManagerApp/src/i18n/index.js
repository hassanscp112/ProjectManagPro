// ─────────────────────────────────────────────────────────────
// i18n core — languages, dictionary assembly, translate, formatters.
//
// Adding a language: create dictionaries/<code>/… files mirroring the
// `ar` folder, register the code in LANGUAGES below and import its
// modules into DICTIONARIES. Everything else (provider, switcher,
// dir switching) follows automatically.
// ─────────────────────────────────────────────────────────────

import arCommon from './dictionaries/ar/common.js';
import arApp from './dictionaries/ar/app.js';
import arDashboard from './dictionaries/ar/dashboard.js';
import arGantt from './dictionaries/ar/gantt.js';
import arOrders from './dictionaries/ar/orders.js';
import arPlanning from './dictionaries/ar/planning.js';
import arActivity from './dictionaries/ar/activity.js';
import arSnapshots from './dictionaries/ar/snapshots.js';
import arReports from './dictionaries/ar/reports.js';
import arTaskDetails from './dictionaries/ar/taskDetails.js';
import arTemplates from './dictionaries/ar/templates.js';
import arRegistries from './dictionaries/ar/registries.js';
import arFinance from './dictionaries/ar/finance.js';
import arCalculator from './dictionaries/ar/calculator.js';
import arFiles from './dictionaries/ar/files.js';
import arUi from './dictionaries/ar/ui.js';
import arRecord from './dictionaries/ar/record.js';
import arHome from './dictionaries/ar/home.js';
import arSchedule from './dictionaries/ar/schedule.js';
import arLibrary from './dictionaries/ar/library.js';
import arPeople from './dictionaries/ar/people.js';
import arSettings from './dictionaries/ar/settings.js';

import enCommon from './dictionaries/en/common.js';
import enApp from './dictionaries/en/app.js';
import enDashboard from './dictionaries/en/dashboard.js';
import enGantt from './dictionaries/en/gantt.js';
import enOrders from './dictionaries/en/orders.js';
import enPlanning from './dictionaries/en/planning.js';
import enActivity from './dictionaries/en/activity.js';
import enSnapshots from './dictionaries/en/snapshots.js';
import enReports from './dictionaries/en/reports.js';
import enTaskDetails from './dictionaries/en/taskDetails.js';
import enTemplates from './dictionaries/en/templates.js';
import enRegistries from './dictionaries/en/registries.js';
import enFinance from './dictionaries/en/finance.js';
import enCalculator from './dictionaries/en/calculator.js';
import enFiles from './dictionaries/en/files.js';
import enUi from './dictionaries/en/ui.js';
import enRecord from './dictionaries/en/record.js';
import enHome from './dictionaries/en/home.js';
import enSchedule from './dictionaries/en/schedule.js';
import enLibrary from './dictionaries/en/library.js';
import enPeople from './dictionaries/en/people.js';
import enSettings from './dictionaries/en/settings.js';

export const LANGUAGES = [
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'en', label: 'English', dir: 'ltr' },
];

export const DEFAULT_LANGUAGE = 'ar';
const LANGUAGE_KEY = 'pm-language';

const DICTIONARIES = {
  ar: {
    common: arCommon, app: arApp, dashboard: arDashboard, gantt: arGantt,
    orders: arOrders, planning: arPlanning, activity: arActivity,
    snapshots: arSnapshots, reports: arReports, taskDetails: arTaskDetails,
    templates: arTemplates, registries: arRegistries,
    finance: arFinance, calculator: arCalculator, files: arFiles, ui: arUi, record: arRecord, home: arHome, schedule: arSchedule,
    library: arLibrary, people: arPeople, settings: arSettings,
  },
  en: {
    common: enCommon, app: enApp, dashboard: enDashboard, gantt: enGantt,
    orders: enOrders, planning: enPlanning, activity: enActivity,
    snapshots: enSnapshots, reports: enReports, taskDetails: enTaskDetails,
    templates: enTemplates, registries: enRegistries,
    finance: enFinance, calculator: enCalculator, files: enFiles, ui: enUi, record: enRecord, home: enHome, schedule: enSchedule,
    library: enLibrary, people: enPeople, settings: enSettings,
  },
};

export const languageDir = (code) =>
  (LANGUAGES.find((l) => l.code === code) || LANGUAGES[0]).dir;

export const loadLanguage = () => {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch { /* storage unavailable */ }
  return DEFAULT_LANGUAGE;
};

export const saveLanguage = (code) => {
  try {
    localStorage.setItem(LANGUAGE_KEY, code);
  } catch { /* storage unavailable */ }
};

// t('orders.newOrder') → looks the key up in every module dictionary of the
// active language (keys are globally unique via module prefixes). Falls back
// to Arabic, then to the key itself. Interpolation: t('x', { n: 5 }) replaces {n}.
export const translate = (lang, key, vars) => {
  const modules = DICTIONARIES[lang] || DICTIONARIES[DEFAULT_LANGUAGE];
  let str;
  for (const dict of Object.values(modules)) {
    if (dict && dict[key] != null) { str = dict[key]; break; }
  }
  if (str == null) {
    for (const dict of Object.values(DICTIONARIES[DEFAULT_LANGUAGE])) {
      if (dict && dict[key] != null) { str = dict[key]; break; }
    }
  }
  if (str == null) return key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = String(str).replaceAll(`{${k}}`, String(v));
    });
  }
  return str;
};

// Locale-aware formatting helpers (kept consistent with the app's existing
// conventions: Western digits, ISO dates).
export const formatNumber = (n) => {
  const value = Number(n);
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
};

export const formatCurrency = (n, lang) => {
  const value = Number(n);
  if (!Number.isFinite(value)) return '—';
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(value));
  return lang === 'en' ? `${formatted} IQD` : `${formatted} د.ع`;
};

export const compactCurrency = (n, lang) => {
  const value = Number(n);
  if (!Number.isFinite(value)) return '—';
  if (lang === 'en') {
    if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B IQD`;
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M IQD`;
    return `${new Intl.NumberFormat('en-US').format(Math.round(value))} IQD`;
  }
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)} مليار د.ع`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)} مليون د.ع`;
  return `${new Intl.NumberFormat('en-US').format(Math.round(value))} د.ع`;
};

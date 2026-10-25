// Month and weekday names in the UI language ('YYYY-MM[-DD]' strings, read
// as UTC days). Arabic uses ar-IQ (Levantine month names) with Latin digits.

const locale = (lang) => (lang === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-GB');
const utcDate = (ymd) => new Date(`${ymd}T00:00:00Z`);

/** '2026-10' → 'تشرين الأول 2026' / 'October 2026'. */
export const monthLabel = (mKey, lang) =>
  new Intl.DateTimeFormat(locale(lang), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(utcDate(`${mKey}-01`));

/** '2026-10-25' → 'الأحد' / 'Sunday'. */
export const weekdayLabel = (ymd, lang) => new Intl.DateTimeFormat(locale(lang), { weekday: 'long', timeZone: 'UTC' }).format(utcDate(ymd));

/** Short month name for chart and calendar labels: 'تشرين 1' / 'Oct'. */
export const shortMonthLabel = (month1to12, lang) =>
  new Intl.DateTimeFormat(locale(lang), { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month1to12 - 1, 1)));

/** 'DD/MM/YYYY HH:MM' in local time — when a report sheet was produced. */
export const issueStamp = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// Text helpers shared by the History* components (labels, times, stamps).
// Pass the i18n `t`; nothing here reads storage.

const pad = (n) => String(n).padStart(2, '0');

/** An ISO time → local 'DD/MM/YYYY HH:MM'; a bare day 'YYYY-MM-DD' → 'DD/MM/YYYY'; '' if none. */
export const whenText = (iso) => {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.split('-').reverse().join('/');
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 'dailyRate' → 'daily rate' (a field no dictionary names). */
const humanize = (field) =>
  String(field)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();

/** A field's label: history.field.<name>, else its own name in words. */
export const fieldName = (field, t) => {
  const key = `history.field.${field}`;
  const label = t(key);
  return label && label !== key ? label : humanize(field);
};

/** A diff entry's place: 'Manpower › Steel fixer › Count'. */
export const fieldLabel = (segments, t) =>
  segments.map((seg) => (seg.field !== undefined ? fieldName(seg.field, t) : seg.item)).join(' › ') || t('history.field.payload');

/** The kind of record: history.collection.<…> (historyModel COLLECTION_KEYS). */
export const collectionName = (keys, collection, t) => t(keys[collection] || 'history.collection.other');

/** 'Recorded by Ali · 01/10/2026 08:00' (time left out with { time: false } or when unknown). */
export const stampText = (stamp, t, { time = true } = {}) => {
  const text = t(`history.stamp.${stamp.kind}`, { name: stamp.name });
  const at = time ? whenText(stamp.at) : '';
  return at ? t('history.stampAt', { stamp: text, time: at }) : text;
};

/** The first characters of a device id (enough to tell devices apart). */
export const shortDevice = (id) => String(id || '').slice(0, 6);

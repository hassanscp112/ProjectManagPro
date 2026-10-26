// ─────────────────────────────────────────────────────────────
// BoqImport — a bill of quantities pasted from Excel → BOQ lines.
//
//   parseTable(text)               Excel clipboard (tab-separated, quoted
//                                  multi-line cells) → rows of cells
//   detectHeader(rows)             index of the header row (or -1)
//   guessColumns(rows, header)     { no, description, unit, qty, rate, amount }
//   boqLines(rows, columns, header) → [{ row, no, description, unit, qty,
//                                  rate, amount, kind: 'item'|'section', wbs }]
//   parseNumber / normalizeUnit    Arabic-Indic digits, separators; م3 / m3 /
//                                  م³ / متر مكعب → 'م3' …
// Pure; tested in __tests__/boqImport.test.js.
// ─────────────────────────────────────────────────────────────

/** Excel's clipboard text → rows of trimmed cells (empty rows dropped). */
export const parseTable = (text) => {
  const src = String(text || '').replace(/\r\n?/g, '\n');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"' && cell === '') {
      quoted = true;
    } else if (c === '\t') {
      row.push(cell);
      cell = '';
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((x) => x.replace(/\s+/g, ' ').trim())).filter((r) => r.some((x) => x !== ''));
};

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;
const digitOf = (ch) => {
  const code = ch.charCodeAt(0);
  return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
};

/**
 * A number from a cell: Arabic-Indic / Persian digits, thousands
 * separators (, ٬ and spaces), decimal point or Arabic comma (٫), units
 * after it ignored; null when the cell doesn't start with a number.
 */
export const parseNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').replace(ARABIC_DIGITS, digitOf).trim();
  // The number a cell starts with ("150 متر مكعب" → 150); none for "م3".
  const lead = text.match(/^-?[\d٫.,٬\s]*\d/);
  if (!lead) return null;
  const s = lead[0].replace(/٫/g, '.').replace(/[٬,\s]/g, '');
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const UNIT_ALIASES = [
  ['م3', ['م3', 'م٣', 'م³', 'm3', 'm³', 'cum', 'cu.m', 'cu m', 'متر مكعب', 'مترمكعب', 'م مكعب', 'م.مكعب']],
  ['م2', ['م2', 'م٢', 'م²', 'm2', 'm²', 'sqm', 'sq.m', 'sq m', 'متر مربع', 'مترمربع', 'م مربع', 'م.مربع']],
  ['م.ط', ['م.ط', 'م ط', 'مط', 'م/ط', 'متر طولي', 'مترطولي', 'م.طولي', 'lm', 'l.m', 'rm', 'r.m', 'm', 'م', 'متر']],
  ['طن', ['طن', 'ton', 'tons', 't', 'tonne']],
  ['كغم', ['كغم', 'كغ', 'kg', 'كيلو']],
  ['عدد', ['عدد', 'no', 'no.', 'nr', 'nos', 'each', 'ea', 'pcs', 'pc', 'set', 'unit', 'وحدة', 'قطعة', 'قطع']],
  ['نقطة', ['نقطة', 'نقطه', 'point', 'pt', 'pts']],
  ['مقطوعية', ['مقطوعية', 'مقطوعيه', 'مقطوع', 'ls', 'l.s', 'l.s.', 'lump sum', 'lumpsum', 'item']],
  ['لتر', ['لتر', 'l', 'liter', 'litre']],
];
const UNIT_INDEX = new Map(UNIT_ALIASES.flatMap(([canon, list]) => list.map((a) => [a, canon])));

/** A unit in the app's form ('م3', 'م2', 'م.ط', 'طن', 'عدد', …); unknown units as typed. */
export const normalizeUnit = (unit) => {
  const raw = String(unit ?? '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/[ً-ْ]/g, '').replace(/\s+/g, ' ');
  return UNIT_INDEX.get(key) || UNIT_INDEX.get(key.replace(/[.\s]/g, '')) || raw;
};

/** Units that measure the same thing (for matching). */
export const unitFamily = (unit) => {
  const u = normalizeUnit(unit);
  if (u === 'عدد' || u === 'قطعة') return 'count';
  return u;
};

/* ─────────────── header and columns ─────────────── */

const HEADER_WORDS = {
  no: ['ت', 'تسلسل', 'التسلسل', 'رقم', 'رقم الفقرة', 'الرقم', 'no', 'no.', 'item no', 'item', 'ref', '#', 's/n', 'sn'],
  description: ['الوصف', 'وصف', 'الفقرة', 'وصف الفقرة', 'البند', 'تفاصيل', 'التفاصيل', 'نوع العمل', 'description', 'desc', 'works', 'item description'],
  unit: ['الوحدة', 'وحدة', 'وحده', 'الوحده', 'وحدة القياس', 'unit', 'units', 'uom'],
  qty: ['الكمية', 'كمية', 'الكميه', 'كميه', 'الكميات', 'qty', 'quantity', 'quantities', 'qnt'],
  rate: ['السعر', 'سعر', 'سعر الوحدة', 'سعر الفقرة', 'الفئة', 'فئة', 'rate', 'price', 'unit price', 'unit rate'],
  amount: ['المبلغ', 'مبلغ', 'المبلغ الكلي', 'الكلفة', 'الكلفة الكلية', 'الاجمالي', 'الإجمالي', 'المجموع', 'amount', 'total', 'cost'],
};
const normHeader = (s) => String(s || '').toLowerCase().replace(/[ً-ْ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
const headerRole = (cell) => {
  const c = normHeader(cell);
  if (!c) return null;
  for (const [role, words] of Object.entries(HEADER_WORDS)) {
    if (words.some((w) => normHeader(w) === c)) return role;
  }
  // Partial matches: the specific headings first ("سعر الفقرة" is a rate, not a description).
  for (const role of ['qty', 'rate', 'amount', 'unit', 'no', 'description']) {
    if (HEADER_WORDS[role].some((w) => normHeader(w).length > 2 && c.includes(normHeader(w)))) return role;
  }
  return null;
};

/** Index of the header row among the first rows (≥ 2 recognised headings), or -1. */
export const detectHeader = (rows) => {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const roles = new Set(rows[i].map(headerRole).filter(Boolean));
    if (roles.size >= 2) return i;
  }
  return -1;
};

const isNumeric = (cell) => parseNumber(cell) !== null;

/**
 * Which column holds what: { no, description, unit, qty, rate, amount }
 * (column indexes, or -1). From the header names first, then from the
 * contents (the longest text is the description; numeric columns in order
 * are qty, rate, amount — amount ≈ qty × rate when all three exist).
 */
export const guessColumns = (rows, headerIndex = -1) => {
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const cols = { no: -1, description: -1, unit: -1, qty: -1, rate: -1, amount: -1 };
  if (headerIndex >= 0) {
    rows[headerIndex].forEach((cell, i) => {
      const role = headerRole(cell);
      if (role && cols[role] === -1) cols[role] = i;
    });
  }
  const body = rows.slice(headerIndex + 1);
  const stats = Array.from({ length: width }, (_, i) => {
    const cells = body.map((r) => r[i] ?? '').filter((x) => x !== '');
    const numeric = cells.filter(isNumeric).length;
    return {
      i,
      filled: cells.length,
      numericShare: cells.length ? numeric / cells.length : 0,
      avgText: cells.length ? cells.reduce((s, x) => s + (isNumeric(x) ? 0 : x.length), 0) / cells.length : 0,
      unitShare: cells.length ? cells.filter((x) => normalizeUnit(x) !== x || UNIT_INDEX.has(x.toLowerCase())).length / cells.length : 0,
    };
  });
  const taken = () => new Set(Object.values(cols).filter((x) => x >= 0));
  if (cols.description === -1) {
    const best = stats.filter((s) => !taken().has(s.i)).sort((a, b) => b.avgText - a.avgText)[0];
    if (best && best.avgText > 3) cols.description = best.i;
  }
  if (cols.unit === -1) {
    const best = stats.filter((s) => !taken().has(s.i) && s.unitShare > 0.4).sort((a, b) => b.unitShare - a.unitShare)[0];
    if (best) cols.unit = best.i;
  }
  const numericCols = stats.filter((s) => !taken().has(s.i) && s.numericShare > 0.6 && s.filled > 0).map((s) => s.i);
  // A leading numeric column of small whole numbers is the item number.
  if (cols.no === -1 && numericCols.length && numericCols[0] < (cols.description === -1 ? Infinity : cols.description)) {
    const first = numericCols[0];
    const values = body.map((r) => parseNumber(r[first])).filter((x) => x !== null);
    if (values.every((v) => v < 1000) && values.length) {
      cols.no = first;
      numericCols.shift();
    }
  }
  ['qty', 'rate', 'amount'].forEach((role) => {
    if (cols[role] === -1 && numericCols.length) cols[role] = numericCols.shift();
  });
  return cols;
};

/* ─────────────── lines ─────────────── */

const ITEM_NO = /^([0-9٠-٩]+([.\-/][0-9٠-٩]+)*|[a-zA-Zأ-ي]{1,2}[.)-]?)$/;

/**
 * The BOQ lines: items (with a quantity) and section headings (text, no
 * quantity, no unit — "أولاً / الأعمال الترابية"). Each item gets a WBS:
 * its own number when the numbers are hierarchical (1.2.3), else the
 * section's number + a running number.
 */
export const boqLines = (rows, cols, headerIndex = -1) => {
  const get = (r, k) => (cols[k] >= 0 ? r[cols[k]] ?? '' : '');
  const out = [];
  let section = 0;
  let inSection = 0;
  rows.slice(headerIndex + 1).forEach((r, offset) => {
    const description = String(get(r, 'description')).trim();
    const qty = parseNumber(get(r, 'qty'));
    const rate = parseNumber(get(r, 'rate'));
    const amount = parseNumber(get(r, 'amount'));
    const unit = normalizeUnit(get(r, 'unit'));
    const no = String(get(r, 'no')).trim();
    const row = headerIndex + 1 + offset;
    if (!description && qty === null) return;
    if (qty === null && !unit && description) {
      section += 1;
      inSection = 0;
      out.push({ row, kind: 'section', no, description, wbs: String(section) });
      return;
    }
    if (section === 0) section = 1;
    inSection += 1;
    const ownWbs = no && ITEM_NO.test(no) && /[.\-/]/.test(no) ? no.replace(/[-/]/g, '.').replace(/[٠-٩]/g, digitOf) : null;
    out.push({
      row,
      kind: 'item',
      no,
      description: description || no,
      unit,
      qty: qty ?? 0,
      rate: rate ?? (amount !== null && qty ? amount / qty : null),
      amount: amount ?? (rate !== null && qty !== null ? rate * qty : null),
      wbs: ownWbs || `${section}.${inSection}`,
    });
  });
  return out;
};

/** Everything at once: text → { rows, header, columns, lines }. */
export const readBoq = (text, columns = null) => {
  const rows = parseTable(text);
  const header = detectHeader(rows);
  const cols = columns || guessColumns(rows, header);
  return { rows, header, columns: cols, lines: boqLines(rows, cols, header) };
};

// ─────────────────────────────────────────────────────────────
// Matcher — which work type a BOQ line describes (local, no AI).
//
// Text is normalised the way Arabic BOQs need it: diacritics and tatweel
// removed, alef / ya / ta marbuta / hamza forms unified, Arabic-Indic
// digits, light stemming (ال / وال / بال …, ات / ة endings) and the words
// every government BOQ line repeats ("تجهيز المواد وتنفيذ … بموجب
// المخططات") dropped. A line scores against each work type by the content
// words it shares with the work type's name, keywords and aliases, whole
// keyword phrases found in it, and its unit (same kind of unit +, another
// kind −). A line once matched by hand is stored as an alias of the work
// type and then matches exactly. Pure; tested in __tests__/matcher.test.js.
// ─────────────────────────────────────────────────────────────

import { unitFamily } from './BoqImport.js';

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;

/** Lower-case, unified Arabic letters, Western digits, single spaces. */
export const normalizeText = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(DIACRITICS, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const PREFIXES = ['وال', 'بال', 'كال', 'فال', 'لل', 'ال'];
const SUFFIXES = ['ات', 'ين', 'ون', 'يه', 'ه'];

/** A light stem: article / conjunction prefixes and plural / feminine endings off. */
export const stem = (word) => {
  let w = word;
  for (const p of PREFIXES) {
    if (w.startsWith(p) && w.length - p.length >= 3) {
      w = w.slice(p.length);
      break;
    }
  }
  if (w.length >= 5 && 'وبلكف'.includes(w[0])) w = w.slice(1);
  for (const s of SUFFIXES) {
    if (w.endsWith(s) && w.length - s.length >= 3) {
      w = w.slice(0, -s.length);
      break;
    }
  }
  if (w.length >= 5 && w.endsWith('ي')) w = w.slice(0, -1); // خرساني → خرسان
  return w;
};

// Words every BOQ line repeats; they say nothing about the kind of work.
const STOP = new Set(
  [
    'تجهيز', 'مواد', 'ماده', 'تنفيذ', 'اعمال', 'عمل', 'قيام', 'مع', 'في', 'من', 'على', 'علي', 'الى', 'الي', 'حسب', 'بموجب',
    'مخطط', 'مخططات', 'مواصفات', 'مواصفه', 'فني', 'فنيه', 'ناجح', 'ناجحه', 'مختبري', 'مختبريا', 'لازم', 'لازمه', 'معدات', 'معد',
    'سعر', 'يشمل', 'شامل', 'كاف', 'كافه', 'جميع', 'لكل', 'او', 'و', 'اي', 'ذلك', 'التي', 'الذي', 'بها', 'به', 'لها', 'ما', 'عن',
    'هذه', 'هذا', 'نوع', 'حيث', 'كما', 'تعليمات', 'مهندس', 'مشرف', 'وفق', 'طبقا', 'ضمن', 'كل', 'the', 'and', 'of', 'for', 'to',
    'with', 'in', 'as', 'per', 'all', 'supply', 'install', 'including', 'complete', 'works', 'work', 'item', 'drawings', 'specs',
    'نصب', 'توريد', 'تركيب', 'تصنيع', 'فرش', 'ضد', 'سمك', 'صنف', 'طبقه', 'طبقات', 'داخل', 'خارج المبنى', 'بناي', 'مبنى',
  ].map((w) => stem(normalizeText(w)))
);

/** Content words of a text (normalised, stemmed, stop words and short tokens out). */
export const contentWords = (text) =>
  normalizeText(text)
    .split(' ')
    .map(stem)
    .filter((w) => w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w));

// How informative each word is across the library (rare words weigh more):
// "لبخ" or "درج" tell more than "خرسانة" or "مسلحة", which many types share.
const idfCache = new WeakMap();
const idfOf = (workTypes) => {
  let idf = idfCache.get(workTypes);
  if (idf) return idf;
  const df = new Map();
  workTypes.forEach((wt) => profileOf(wt).words.forEach((w) => df.set(w, (df.get(w) || 0) + 1)));
  const n = Math.max(1, workTypes.length);
  idf = (w) => (df.has(w) ? Math.log(1 + n / df.get(w)) : Math.log(1 + n / 2));
  idfCache.set(workTypes, idf);
  return idf;
};

const profileCache = new WeakMap();
const profileOf = (wt) => {
  let p = profileCache.get(wt);
  if (p) return p;
  const texts = [wt.name, wt.nameEn, ...(wt.keywords || [])].map(normalizeText).filter((x) => x.length >= 3);
  const words = new Set(texts.flatMap((x) => contentWords(x)));
  // Keyword phrases as stemmed word sequences ("لجسور الربط" contains "جسور ربط").
  const phrases = [...new Set(texts.map((x) => contentWords(x).join(' ')).filter((x) => x.length >= 4))];
  p = { phrases, words, aliases: new Set((wt.aliases || []).map(normalizeText)), unit: unitFamily(wt.unit) };
  profileCache.set(wt, p);
  return p;
};

/**
 * How well a BOQ line fits a work type: 0–1. `idf` weighs words by how
 * rare they are in the library (default: by length only).
 */
export const scoreLine = (line, wt, idf = null) => {
  const desc = normalizeText(line.description);
  const p = profileOf(wt);
  if (p.aliases.has(desc)) return 1;
  const sequence = contentWords(line.description);
  const words = [...new Set(sequence)];
  if (!words.length) return 0;
  const stemmed = ` ${sequence.join(' ')} `;
  const weight = idf || ((w) => Math.min(3, w.length / 2));
  const total = words.reduce((s, w) => s + weight(w), 0);
  const shared = words.filter((w) => p.words.has(w)).reduce((s, w) => s + weight(w), 0);
  let score = 0.75 * (shared / total) + Math.min(0.45, p.phrases.filter((ph) => stemmed.includes(` ${ph} `)).length * 0.2);
  if (shared === 0 && score === 0) return 0;
  const lu = unitFamily(line.unit);
  if (lu && p.unit) score += lu === p.unit ? 0.15 : -0.35;
  return Math.max(0, Math.min(1, score));
};

export const CONFIDENCE = { high: 0.55, medium: 0.3 };

/** 'high' | 'medium' | 'low' for a score. */
export const confidenceOf = (score) => (score >= CONFIDENCE.high ? 'high' : score >= CONFIDENCE.medium ? 'medium' : 'low');

/**
 * The best work types for one line: { best: { workTypeId, score } | null,
 * candidates: [{ workTypeId, score }] (top `limit`) }. A best under the
 * medium threshold is no match.
 */
export const matchLine = (line, workTypes, limit = 5) => {
  const list = (workTypes || []).filter((wt) => wt && !wt.legacy);
  const idf = idfOf(workTypes || []);
  const scored = list
    .map((wt) => ({ workTypeId: wt.id, score: scoreLine(line, wt, idf) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  const best = scored[0] && scored[0].score >= CONFIDENCE.medium ? scored[0] : null;
  return { best, candidates: scored };
};

/** Match every item line: Map row → { best, candidates }. */
export const matchBoq = (lines, workTypes) => {
  const out = new Map();
  (lines || []).forEach((line) => {
    if (line.kind === 'item') out.set(line.row, matchLine(line, workTypes));
  });
  return out;
};

/** The work type with this line's description added to its aliases (a confirmed manual match). */
export const withAlias = (wt, description) => {
  const alias = normalizeText(description);
  if (!alias || (wt.aliases || []).map(normalizeText).includes(alias)) return wt;
  return { ...wt, aliases: [...(wt.aliases || []), alias] };
};

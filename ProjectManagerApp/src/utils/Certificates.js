// ─────────────────────────────────────────────────────────────
// Certificates — payment certificates (ذرعات): the only owner of
// 'pm-certificates' (project-scoped, always read via projectKey).
//
//   {
//     settings: { retentionPct: 5, retentionLimit, advanceAmount,
//                 advanceRecoveryPct, currencyLabel },
//     rates: { [contractorId]: { [taskId]: rate } },   // agreed subcontract rates
//     certificates: [Certificate],
//   }
//
// Certificate:
//   { id, kind: 'subcontractor' | 'employer', contractorId (null for employer),
//     number,                     // 1, 2, 3 … per series (kind + contractor)
//     periodEnd: 'YYYY-MM-DD', status: 'draft' | 'issued',
//     terms: { retentionPct, retentionLimit, advanceAmount, advanceRecoveryPct },
//     deductions: [{ id, label, amount }],   // other deductions, this certificate
//     note, createdAt, createdBy,
//     // frozen when issued:
//     issuedAt, issuedBy: { id, name, role }, periodStart, lines, totals, orderIds }
//
// A draft is live: its lines and totals are computed from the order
// ledger every time (state/certificateModel.js). Issuing freezes them,
// with the ids of the orders it certified (certifiedOrderIds()).
// Settings are the defaults for a new series: retention for both kinds,
// the advance for the main contract (a subcontractor's advance is set on
// its first certificate). Each certificate keeps its own terms, copied
// from the one before it in the series.
// ─────────────────────────────────────────────────────────────

import { loadLanguage, translate } from '../i18n/index.js';
import { logAppEvent } from './ActivityLog.js';
import { currentActor } from './Identity.js';
import { projectKey } from './Projects.js';
import { loadRegistries } from './Registries.js';
import { notifyStoreChange } from './storeEvents.js';

export const CERTIFICATES_STORAGE_KEY = 'pm-certificates';
export const CERTIFICATE_KINDS = ['subcontractor', 'employer'];

export const DEFAULT_SETTINGS = Object.freeze({
  retentionPct: 5,
  retentionLimit: 0, // 0 = no limit
  advanceAmount: 0,
  advanceRecoveryPct: 0,
  currencyLabel: '', // empty = the UI's IQD label
});

const asArray = (value) => (Array.isArray(value) ? value : []);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isDay = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Number from user input; '' / null / garbage → `fallback`. */
const numOr = (value, fallback) => {
  if (value === '' || value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const pct = (value, fallback) => Math.min(100, Math.max(0, numOr(value, fallback)));
const amount = (value) => Math.max(0, numOr(value, 0));

export const createCertificateId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `cert_${Date.now()}_${Math.random().toString(36).slice(2)}`;

/* ---------- normalizers (fill missing fields, keep extras) ---------- */

export const normalizeSettings = (settings = {}) => {
  const src = isObject(settings) ? settings : {};
  return {
    ...src,
    retentionPct: pct(src.retentionPct, DEFAULT_SETTINGS.retentionPct),
    retentionLimit: amount(src.retentionLimit),
    advanceAmount: amount(src.advanceAmount),
    advanceRecoveryPct: pct(src.advanceRecoveryPct, DEFAULT_SETTINGS.advanceRecoveryPct),
    currencyLabel: typeof src.currencyLabel === 'string' ? src.currencyLabel : '',
  };
};

export const normalizeTerms = (terms = {}) => {
  const src = isObject(terms) ? terms : {};
  return {
    retentionPct: pct(src.retentionPct, DEFAULT_SETTINGS.retentionPct),
    retentionLimit: amount(src.retentionLimit),
    advanceAmount: amount(src.advanceAmount),
    advanceRecoveryPct: pct(src.advanceRecoveryPct, 0),
  };
};

const normalizeRates = (rates) => {
  const out = {};
  if (!isObject(rates)) return out;
  Object.entries(rates).forEach(([contractorId, byTask]) => {
    if (!isObject(byTask)) return;
    const clean = {};
    Object.entries(byTask).forEach(([taskId, rate]) => {
      const n = numOr(rate, null);
      if (n != null && n >= 0) clean[taskId] = n;
    });
    if (Object.keys(clean).length) out[contractorId] = clean;
  });
  return out;
};

const normalizeDeduction = (d = {}) => ({
  id: d.id || createCertificateId(),
  label: typeof d.label === 'string' ? d.label : '',
  amount: numOr(d.amount, 0),
});

const normalizeCertificate = (c) => {
  const kind = CERTIFICATE_KINDS.includes(c.kind) ? c.kind : 'subcontractor';
  return {
    ...c,
    kind,
    contractorId: kind === 'employer' ? null : c.contractorId || null,
    number: Math.max(1, Math.round(numOr(c.number, 1))),
    periodEnd: isDay(c.periodEnd) ? c.periodEnd : '',
    status: c.status === 'issued' ? 'issued' : 'draft',
    terms: normalizeTerms(c.terms),
    deductions: asArray(c.deductions).filter(isObject).map(normalizeDeduction),
    note: typeof c.note === 'string' ? c.note : '',
  };
};

export const normalizeCertificatesDoc = (doc) => {
  const src = isObject(doc) ? doc : {};
  return {
    settings: normalizeSettings(src.settings),
    rates: normalizeRates(src.rates),
    certificates: asArray(src.certificates)
      .filter((c) => isObject(c) && c.id)
      .map(normalizeCertificate),
  };
};

/* ---------- load / save ---------- */

/** Read the open project's 'pm-certificates' (missing / corrupt → empty defaults). */
export const loadCertificates = () => {
  try {
    const raw = localStorage.getItem(projectKey(CERTIFICATES_STORAGE_KEY));
    return normalizeCertificatesDoc(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeCertificatesDoc(null);
  }
};

/** Persist the whole document (normalized) and announce it. Returns what was saved. */
export const saveCertificates = (doc) => {
  const safe = normalizeCertificatesDoc(doc);
  localStorage.setItem(projectKey(CERTIFICATES_STORAGE_KEY), JSON.stringify(safe));
  notifyStoreChange(CERTIFICATES_STORAGE_KEY);
  return safe;
};

/* ---------- series (one numbering per kind + contractor) ---------- */

export const seriesKey = (kind, contractorId) => `${kind}:${kind === 'employer' ? '' : contractorId || ''}`;

/** The certificates of one series, oldest first. */
export const seriesOf = (certificates, kind, contractorId) => {
  const key = seriesKey(kind, contractorId);
  return asArray(certificates)
    .filter((c) => seriesKey(c.kind, c.contractorId) === key)
    .sort((a, b) => a.number - b.number);
};

export const nextNumber = (certificates, kind, contractorId) =>
  seriesOf(certificates, kind, contractorId).reduce((max, c) => Math.max(max, c.number), 0) + 1;

/** The series' draft, if it has one (a series has at most one). */
export const openDraft = (certificates, kind, contractorId) =>
  seriesOf(certificates, kind, contractorId).find((c) => c.status === 'draft') || null;

/** Issued certificates of the same series numbered before `cert`, oldest first. */
export const previousCertificates = (certificates, cert) =>
  seriesOf(certificates, cert.kind, cert.contractorId).filter((c) => c.status === 'issued' && c.number < cert.number);

/**
 * Why a certificate with these details can't be prepared (null = it can):
 *   'kind' · 'contractor' (subcontractor without one) · 'date' ·
 *   'openDraft' (the series already has a draft) ·
 *   'beforePrevious' (the period must end after the last issued one).
 * `selfId` skips that certificate (editing its own draft).
 */
export const certificateProblem = (certificates, { kind, contractorId, periodEnd }, selfId = null) => {
  if (!CERTIFICATE_KINDS.includes(kind)) return 'kind';
  if (kind === 'subcontractor' && !contractorId) return 'contractor';
  if (!isDay(periodEnd)) return 'date';
  const series = seriesOf(certificates, kind, contractorId).filter((c) => c.id !== selfId);
  if (!selfId && series.some((c) => c.status === 'draft')) return 'openDraft';
  const lastIssued = series.filter((c) => c.status === 'issued').pop();
  if (lastIssued && periodEnd <= lastIssued.periodEnd) return 'beforePrevious';
  return null;
};

/**
 * Terms for a new certificate: the last one in the series, else the
 * settings (a subcontractor starts with no advance and no retention limit —
 * the settings' advance is the main contract's).
 */
export const defaultTerms = (doc, kind, contractorId) => {
  const last = seriesOf(doc.certificates, kind, contractorId).pop();
  if (last) return normalizeTerms(last.terms);
  const s = normalizeSettings(doc.settings);
  return normalizeTerms(
    kind === 'employer'
      ? s
      : { retentionPct: s.retentionPct, retentionLimit: 0, advanceAmount: 0, advanceRecoveryPct: s.advanceRecoveryPct }
  );
};

/** Ids of every order in an issued certificate (they must not change any more). */
export const certifiedOrderIds = (doc = loadCertificates()) => {
  const ids = new Set();
  asArray(doc?.certificates).forEach((c) => {
    if (c.status === 'issued') asArray(c.orderIds).forEach((id) => ids.add(id));
  });
  return ids;
};

/** orderId → the issued certificates holding it ([{ id, number, kind, contractorId }]), for "In certificate #N". */
export const certificatesByOrder = (doc = loadCertificates()) => {
  const map = new Map();
  asArray(doc?.certificates).forEach((c) => {
    if (c.status !== 'issued') return;
    const ref = { id: c.id, number: c.number, kind: c.kind, contractorId: c.contractorId };
    asArray(c.orderIds).forEach((id) => map.set(id, [...(map.get(id) || []), ref]));
  });
  return map;
};

/* ---------- changes (load → change → save; return null when refused) ---------- */

const replace = (doc, cert) => ({ ...doc, certificates: doc.certificates.map((c) => (c.id === cert.id ? cert : c)) });

/** Start a draft certificate; returns it, or null when certificateProblem() refuses. */
export const createCertificate = ({ kind, contractorId = null, periodEnd }, actor = currentActor(), now = new Date()) => {
  const doc = loadCertificates();
  if (certificateProblem(doc.certificates, { kind, contractorId, periodEnd })) return null;
  const cert = normalizeCertificate({
    id: createCertificateId(),
    kind,
    contractorId,
    number: nextNumber(doc.certificates, kind, contractorId),
    periodEnd,
    status: 'draft',
    terms: defaultTerms(doc, kind, contractorId),
    deductions: [],
    note: '',
    createdAt: now.toISOString(),
    createdBy: actor?.name || '',
  });
  saveCertificates({ ...doc, certificates: [...doc.certificates, cert] });
  return cert;
};

const DRAFT_FIELDS = ['periodEnd', 'terms', 'deductions', 'note'];

/** Change a draft's period end, terms, deductions or note. Issued certificates never change. */
export const updateDraft = (id, patch = {}) => {
  const doc = loadCertificates();
  const cert = doc.certificates.find((c) => c.id === id);
  if (!cert || cert.status !== 'draft') return null;
  const allowed = Object.fromEntries(Object.entries(patch).filter(([k]) => DRAFT_FIELDS.includes(k)));
  const next = normalizeCertificate({ ...cert, ...allowed });
  if (next.periodEnd !== cert.periodEnd && certificateProblem(doc.certificates, next, id)) return null;
  saveCertificates(replace(doc, next));
  return next;
};

/** Delete a draft (issued certificates stay). Returns true when deleted. */
export const deleteDraft = (id) => {
  const doc = loadCertificates();
  const cert = doc.certificates.find((c) => c.id === id);
  if (!cert || cert.status !== 'draft') return false;
  saveCertificates({ ...doc, certificates: doc.certificates.filter((c) => c.id !== id) });
  return true;
};

/**
 * Issue a draft: freeze the computed `{ periodStart, lines, totals, orderIds }`
 * (certificateModel.computeCertificate), stamp who and when, log it in the
 * activity feed. Returns the issued certificate, or null.
 */
export const issueCertificate = (id, frozen, actor = currentActor(), now = new Date()) => {
  const doc = loadCertificates();
  const cert = doc.certificates.find((c) => c.id === id);
  if (!cert || cert.status !== 'draft' || !frozen) return null;
  const issued = {
    ...cert,
    status: 'issued',
    issuedAt: now.toISOString(),
    issuedBy: { id: actor?.id ?? null, name: actor?.name || '', role: actor?.role || '' },
    periodStart: frozen.periodStart || '',
    lines: JSON.parse(JSON.stringify(asArray(frozen.lines))),
    totals: JSON.parse(JSON.stringify(frozen.totals || {})),
    orderIds: [...new Set(asArray(frozen.orderIds))],
  };
  saveCertificates(replace(doc, issued));

  const lang = loadLanguage();
  const party =
    issued.kind === 'employer'
      ? translate(lang, 'certificates.kindEmployer')
      : loadRegistries().contractors.find((c) => c.id === issued.contractorId)?.name || translate(lang, 'certificates.unknownContractor');
  logAppEvent({
    actor: issued.issuedBy.name,
    kind: 'certificate',
    summary: translate(lang, 'certificates.issuedLog', { number: issued.number, party }),
    refType: 'certificate',
    refId: issued.id,
    payload: {
      number: issued.number,
      kind: issued.kind,
      contractorId: issued.contractorId,
      periodEnd: issued.periodEnd,
      netPayable: issued.totals?.netPayable ?? null,
      orderCount: issued.orderIds.length,
    },
  });
  return issued;
};

/** Merge a patch into the settings. Returns the saved settings. */
export const saveSettings = (patch = {}) => {
  const doc = loadCertificates();
  return saveCertificates({ ...doc, settings: { ...doc.settings, ...patch } }).settings;
};

/** Set (or with '' / null, clear) one contractor's agreed rate for an item. */
export const setRate = (contractorId, taskId, rate) => {
  if (!contractorId || !taskId) return null;
  const doc = loadCertificates();
  const byTask = { ...(doc.rates[contractorId] || {}) };
  const n = numOr(rate, null);
  if (n == null || n < 0) delete byTask[taskId];
  else byTask[taskId] = n;
  return saveCertificates({ ...doc, rates: { ...doc.rates, [contractorId]: byTask } }).rates;
};

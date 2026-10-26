// Unit tests for src/utils/Certificates.js (node:test) with the in-memory
// localStorage shim. No project is open in node, so projectKey() is the
// base key.

import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment } from './helpers.js';

installNodeTestEnvironment();

const {
  CERTIFICATES_STORAGE_KEY,
  certificateProblem,
  certificatesByOrder,
  certifiedOrderIds,
  createCertificate,
  deleteDraft,
  issueCertificate,
  loadCertificates,
  saveSettings,
  setRate,
  updateDraft,
} = await import('../Certificates.js');
const { ACTIVITY_STORAGE_KEY, loadAppEvents } = await import('../ActivityLog.js');

const actor = { id: 'u1', name: 'Huda', role: 'pm' };
const frozen = (orderIds, netPayable = 100) => ({
  periodStart: '2026-09-01',
  lines: [{ taskId: 'a', cumQty: 10, rate: 10, cumAmount: 100 }],
  totals: { gross: { prev: 0, this: 100, cum: 100 }, netPayable },
  orderIds,
});

beforeEach(() => {
  localStorage.removeItem(CERTIFICATES_STORAGE_KEY);
  localStorage.removeItem(ACTIVITY_STORAGE_KEY);
});

describe('Certificates store', () => {
  it('starts empty with the default settings (retention 5 %)', () => {
    const doc = loadCertificates();
    assert.deepEqual(doc.certificates, []);
    assert.deepEqual(doc.rates, {});
    assert.equal(doc.settings.retentionPct, 5);
    assert.equal(doc.settings.advanceAmount, 0);
  });

  it('survives corrupt storage', () => {
    localStorage.setItem(CERTIFICATES_STORAGE_KEY, '{not json');
    assert.deepEqual(loadCertificates().certificates, []);
  });

  it('numbers certificates per kind and contractor', () => {
    const a1 = createCertificate({ kind: 'subcontractor', contractorId: 'k1', periodEnd: '2026-09-30' }, actor);
    const b1 = createCertificate({ kind: 'subcontractor', contractorId: 'k2', periodEnd: '2026-09-30' }, actor);
    const e1 = createCertificate({ kind: 'employer', contractorId: 'k1', periodEnd: '2026-09-30' }, actor);
    assert.deepEqual([a1.number, b1.number, e1.number, e1.contractorId], [1, 1, 1, null]);
    assert.equal(a1.createdBy, 'Huda');

    // One draft per series: the next one waits until this one is issued.
    assert.equal(createCertificate({ kind: 'subcontractor', contractorId: 'k1', periodEnd: '2026-10-31' }, actor), null);
    issueCertificate(a1.id, frozen(['o1']), actor);
    const a2 = createCertificate({ kind: 'subcontractor', contractorId: 'k1', periodEnd: '2026-10-31' }, actor);
    assert.equal(a2.number, 2);
  });

  it('refuses bad details and periods that do not move forward', () => {
    const list = loadCertificates().certificates;
    assert.equal(certificateProblem(list, { kind: 'x', periodEnd: '2026-09-30' }), 'kind');
    assert.equal(certificateProblem(list, { kind: 'subcontractor', periodEnd: '2026-09-30' }), 'contractor');
    assert.equal(certificateProblem(list, { kind: 'employer', periodEnd: '30/09/2026' }), 'date');
    const c1 = createCertificate({ kind: 'employer', periodEnd: '2026-09-30' }, actor);
    assert.equal(certificateProblem(loadCertificates().certificates, { kind: 'employer', periodEnd: '2026-10-31' }), 'openDraft');
    issueCertificate(c1.id, frozen([]), actor);
    assert.equal(createCertificate({ kind: 'employer', periodEnd: '2026-09-30' }, actor), null);
    assert.equal(certificateProblem(loadCertificates().certificates, { kind: 'employer', periodEnd: '2026-09-30' }), 'beforePrevious');
  });

  it('new certificates take their terms from the last one in the series, else the settings', () => {
    saveSettings({ retentionPct: 10, advanceAmount: 5000, advanceRecoveryPct: 20 });
    const e1 = createCertificate({ kind: 'employer', periodEnd: '2026-09-30' }, actor);
    assert.deepEqual(e1.terms, { retentionPct: 10, retentionLimit: 0, advanceAmount: 5000, advanceRecoveryPct: 20 });
    // A subcontractor's advance is its own (the settings' advance is the main contract's).
    const s1 = createCertificate({ kind: 'subcontractor', contractorId: 'k1', periodEnd: '2026-09-30' }, actor);
    assert.deepEqual(s1.terms, { retentionPct: 10, retentionLimit: 0, advanceAmount: 0, advanceRecoveryPct: 20 });
    updateDraft(s1.id, { terms: { ...s1.terms, advanceAmount: 800 } });
    issueCertificate(s1.id, frozen([]), actor);
    const s2 = createCertificate({ kind: 'subcontractor', contractorId: 'k1', periodEnd: '2026-10-31' }, actor);
    assert.equal(s2.terms.advanceAmount, 800);
  });

  it('issuing freezes the certificate, records who issued it and logs the activity', () => {
    const c1 = createCertificate({ kind: 'subcontractor', contractorId: 'k1', periodEnd: '2026-09-30' }, actor);
    const issued = issueCertificate(c1.id, frozen(['o1', 'o2', 'o1'], 92), actor, new Date('2026-10-02T10:00:00Z'));
    assert.equal(issued.status, 'issued');
    assert.deepEqual(issued.issuedBy, actor);
    assert.equal(issued.issuedAt, '2026-10-02T10:00:00.000Z');
    assert.deepEqual(issued.orderIds, ['o1', 'o2']);
    assert.equal(issued.totals.netPayable, 92);

    const events = loadAppEvents();
    assert.equal(events.length, 1);
    assert.deepEqual([events[0].kind, events[0].refType, events[0].refId, events[0].actor], ['certificate', 'certificate', c1.id, 'Huda']);
    assert.equal(events[0].payload.netPayable, 92);

    // Frozen: no second issue, no edits, no delete.
    assert.equal(issueCertificate(c1.id, frozen(['o3']), actor), null);
    assert.equal(updateDraft(c1.id, { note: 'changed', periodEnd: '2026-09-20' }), null);
    assert.equal(deleteDraft(c1.id), false);
    const stored = loadCertificates().certificates[0];
    assert.deepEqual([stored.note, stored.periodEnd, stored.orderIds], ['', '2026-09-30', ['o1', 'o2']]);
  });

  it('certifiedOrderIds holds the orders of issued certificates only', () => {
    const c1 = createCertificate({ kind: 'subcontractor', contractorId: 'k1', periodEnd: '2026-09-30' }, actor);
    const e1 = createCertificate({ kind: 'employer', periodEnd: '2026-09-30' }, actor);
    issueCertificate(c1.id, frozen(['o1', 'o2']), actor);
    assert.deepEqual([...certifiedOrderIds()].sort(), ['o1', 'o2']);
    issueCertificate(e1.id, frozen(['o2', 'o3']), actor);
    assert.deepEqual([...certifiedOrderIds()].sort(), ['o1', 'o2', 'o3']);
    assert.deepEqual(certificatesByOrder().get('o2').map((r) => [r.kind, r.number]), [['subcontractor', 1], ['employer', 1]]);
  });

  it('drafts can be edited and deleted', () => {
    const c1 = createCertificate({ kind: 'subcontractor', contractorId: 'k1', periodEnd: '2026-09-30' }, actor);
    const edited = updateDraft(c1.id, { periodEnd: '2026-09-25', note: 'n', deductions: [{ label: 'Fine', amount: '30' }], status: 'issued' });
    assert.deepEqual([edited.periodEnd, edited.note, edited.status, edited.deductions[0].amount], ['2026-09-25', 'n', 'draft', 30]);
    assert.equal(updateDraft(c1.id, { periodEnd: 'bad' }), null);
    assert.equal(deleteDraft(c1.id), true);
    assert.deepEqual(loadCertificates().certificates, []);
  });

  it('rates: set, clear, never negative', () => {
    setRate('k1', 'a', '12.5');
    setRate('k1', 'b', 0);
    assert.deepEqual(loadCertificates().rates, { k1: { a: 12.5, b: 0 } });
    setRate('k1', 'a', '');
    setRate('k1', 'b', -3);
    assert.deepEqual(loadCertificates().rates, {});
  });

  it('settings keep percentages within 0–100 and amounts non-negative', () => {
    const s = saveSettings({ retentionPct: 140, advanceAmount: -5, advanceRecoveryPct: '15', currencyLabel: 'USD' });
    assert.deepEqual([s.retentionPct, s.advanceAmount, s.advanceRecoveryPct, s.currencyLabel], [100, 0, 15, 'USD']);
    assert.equal(saveSettings({ retentionPct: '' }).retentionPct, 5);
  });
});

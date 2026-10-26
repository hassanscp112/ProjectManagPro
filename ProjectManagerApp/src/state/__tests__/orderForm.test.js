import { test } from 'node:test';
import assert from 'node:assert/strict';
import { certificatesByOrder } from '../../utils/Certificates.js';
import { ORDER_TYPES } from '../../utils/OrderEngine.js';
import {
  EMPTY_FILTERS,
  OUTLIER_MIN_SAMPLES,
  approvalBlock,
  buildOrderFromDraft,
  draftWarnings,
  filterOrders,
  hasActiveFilters,
  latestOrder,
  missingRequiredFields,
  orderKpis,
  orderLock,
  ordersOnDay,
  pendingOrders,
  repeatOrderDraft,
  taskQuantityStatus,
  toNumberOrNull,
} from '../orderForm.js';

const tasks = [{ id: '2.1.2', wbs: '2.1.2', name: 'دفن القنوات الفرعية', unit: 'م3' }];

test('toNumberOrNull keeps finite numbers only', () => {
  assert.equal(toNumberOrNull(''), null);
  assert.equal(toNumberOrNull('12.5'), 12.5);
  assert.equal(toNumberOrNull('abc'), null);
});

test('missingRequiredFields follows each type spec', () => {
  const quick = { type: 'quick_work', date: '2026-10-25', taskId: '', quantity: '0' };
  assert.deepEqual(missingRequiredFields(quick, ORDER_TYPES.quick_work).map((f) => f.key), ['taskId', 'quantity']);
  const concrete = { type: 'concrete_test', date: '2026-10-25', taskId: '2.1.2', location: '  ' };
  assert.deepEqual(missingRequiredFields(concrete, ORDER_TYPES.concrete_test).map((f) => f.key), ['location']);
  const fuel = { type: 'fuel', date: '', amount: '50000' };
  assert.deepEqual(missingRequiredFields(fuel, ORDER_TYPES.fuel).map((f) => f.key), ['date']);
});

test('quick value orders are approved at once with the task unit as fallback', () => {
  const draft = { type: 'quick_work', date: '2026-10-25', taskId: '2.1.2', quantity: '1200', unit: '', who: { kind: 'contractor', contractorId: 'c1' }, note: '' };
  const order = buildOrderFromDraft(draft, ORDER_TYPES.quick_work, { tasks, userName: 'Eng', id: 'o1', now: 'T' });
  assert.deepEqual(
    { status: order.status, approvedBy: order.approvedBy, qty: order.quantity, unit: order.unit, wbs: order.taskWbs, amount: order.amount, who: order.who },
    { status: 'approved', approvedBy: 'Eng', qty: 1200, unit: 'م3', wbs: '2.1.2', amount: null, who: { kind: 'contractor', contractorId: 'c1' } }
  );
});

test('formal orders start recorded; expenses carry amount and category, not quantity', () => {
  const formal = buildOrderFromDraft(
    { type: 'concrete_test', date: '2026-10-25', taskId: '2.1.2', location: ' 0+950 ', sampleRef: 'C25-041', who: { kind: 'none' } },
    ORDER_TYPES.concrete_test,
    { tasks, userName: 'Eng', id: 'o2', now: 'T' }
  );
  assert.deepEqual({ status: formal.status, approvedBy: formal.approvedBy, details: formal.details }, { status: 'recorded', approvedBy: null, details: { location: '0+950', sampleRef: 'C25-041' } });

  const fuel = buildOrderFromDraft({ type: 'fuel', date: '2026-10-25', amount: '75000', who: { kind: 'contractor', contractorId: '' } }, ORDER_TYPES.fuel, { tasks, id: 'o3', now: 'T' });
  assert.deepEqual({ qty: fuel.quantity, amount: fuel.amount, cat: fuel.category, who: fuel.who, task: fuel.taskId }, { qty: null, amount: 75000, cat: ORDER_TYPES.fuel.label, who: { kind: 'none' }, task: null });
});

test('evidence: the stored photo ids go on the order; none by default', () => {
  const draft = { type: 'quick_work', date: '2026-10-25', taskId: '2.1.2', quantity: '5', who: { kind: 'none' } };
  const withPhotos = buildOrderFromDraft(draft, ORDER_TYPES.quick_work, { tasks, id: 'o4', now: 'T', evidence: ['f1', '', 'f2', null] });
  assert.deepEqual(withPhotos.evidence, ['f1', 'f2']);
  assert.deepEqual(buildOrderFromDraft(draft, ORDER_TYPES.quick_work, { tasks, id: 'o5', now: 'T' }).evidence, []);
  // A draft never smuggles evidence in: only the ids passed at save time count.
  assert.deepEqual(buildOrderFromDraft({ ...draft, evidence: ['x'] }, ORDER_TYPES.quick_work, { tasks, id: 'o6', now: 'T' }).evidence, []);
  // Every type carries the field (photos are offered on every type).
  Object.values(ORDER_TYPES).forEach((spec) => {
    const order = buildOrderFromDraft({ type: spec.type, date: '2026-10-25', who: { kind: 'none' } }, spec, { tasks, id: 'o', now: 'T', evidence: ['p'] });
    assert.deepEqual(order.evidence, ['p'], spec.type);
  });
});

test('repeat last order copies no photos', () => {
  const last = { id: 'b', type: 'material', taskId: '2.1.2', unit: 'م3', amount: 9, evidence: ['f1', 'f2'], who: { kind: 'none' }, recordedAt: 'T' };
  const draft = repeatOrderDraft(last);
  assert.equal('evidence' in draft, false);
  assert.equal('photos' in draft, false);
  const again = buildOrderFromDraft({ ...draft, amount: '10' }, ORDER_TYPES.material, { tasks, id: 'o7', now: 'T2' });
  assert.deepEqual(again.evidence, []);
});

test('latestOrder and repeatOrderDraft reproduce the last order without its quantity', () => {
  const orders = [
    { id: 'a', type: 'fuel', recordedAt: '2026-10-24T08:00:00Z' },
    { id: 'b', type: 'quick_work', taskId: '2.1.2', unit: 'م3', quantity: 900, who: { kind: 'contractor', contractorId: 'c1' }, recordedAt: '2026-10-25T09:40:00Z' },
  ];
  const last = latestOrder(orders);
  assert.equal(last.id, 'b');
  const draft = repeatOrderDraft(last);
  assert.deepEqual(
    { type: draft.type, taskId: draft.taskId, unit: draft.unit, quantity: draft.quantity, who: draft.who },
    { type: 'quick_work', taskId: '2.1.2', unit: 'م3', quantity: '', who: { kind: 'contractor', contractorId: 'c1' } }
  );
  assert.equal(latestOrder([]), null);
  assert.equal(repeatOrderDraft(null), null);
});

test('filterOrders filters and sorts newest first; hasActiveFilters detects any filter', () => {
  const orders = [
    { id: '1', type: 'fuel', date: '2026-10-20', recordedAt: '1', who: { kind: 'contractor', contractorId: 'c1' } },
    { id: '2', type: 'quick_work', date: '2026-10-25', recordedAt: '1', taskId: 't', who: { kind: 'contractor', contractorId: 'c2' } },
    { id: '3', type: 'quick_work', date: '2026-10-25', recordedAt: '2', taskId: 't', who: { kind: 'none' } },
  ];
  assert.deepEqual(filterOrders(orders, EMPTY_FILTERS).map((o) => o.id), ['3', '2', '1']);
  assert.deepEqual(filterOrders(orders, { ...EMPTY_FILTERS, contractorId: 'c1' }).map((o) => o.id), ['1']);
  assert.deepEqual(filterOrders(orders, { ...EMPTY_FILTERS, from: '2026-10-21', type: 'quick_work' }).map((o) => o.id), ['3', '2']);
  assert.equal(hasActiveFilters(EMPTY_FILTERS), false);
  assert.equal(hasActiveFilters({ ...EMPTY_FILTERS, taskId: 't' }), true);
});

test('pendingOrders, ordersOnDay and orderKpis', () => {
  const orders = [
    { id: 'p1', tier: 'formal', status: 'recorded', family: 'value', date: '2026-10-25', recordedAt: '2', quantity: 0 },
    { id: 'q1', tier: 'quick', status: 'approved', family: 'value', date: '2026-10-25', recordedAt: '3', quantity: 1200 },
    { id: 'e1', tier: 'quick', status: 'approved', family: 'expense', type: 'fuel', date: '2026-10-22', recordedAt: '1', amount: 50000 },
  ];
  assert.deepEqual(pendingOrders(orders).map((o) => o.id), ['p1']);
  assert.deepEqual(ordersOnDay(orders, '2026-10-25').map((o) => o.id), ['q1', 'p1']);
  assert.deepEqual(orderKpis(orders, '2026-10-25', '2026-10-19'), {
    todayValueCount: 2,
    todayQty: 1200,
    todayExpenses: 0,
    weekValueCount: 2,
    weekExpenses: 50000,
  });
});

test('taskQuantityStatus reports done / total / left for leaves with a contract quantity', () => {
  assert.deepEqual(taskQuantityStatus({ qty: 142535.6, actualQty: 135000, unit: 'م3' }), { done: 135000, total: 142535.6, left: 7535.600000000006, unit: 'م3' });
  assert.equal(taskQuantityStatus({ isGroup: true, qty: 5 }), null);
  assert.equal(taskQuantityStatus({ qty: 0 }), null);
});

/* ─────────────── recordedById ─────────────── */

test('built orders carry the recorder id next to the name (null without accounts)', () => {
  const draft = { type: 'completion', date: '2026-10-25', taskId: '2.1.2', quantity: '10', who: { kind: 'none' } };
  const signedIn = buildOrderFromDraft(draft, ORDER_TYPES.completion, { tasks, userName: 'Huda', recordedById: 'u1', id: 'o1', now: 'T' });
  assert.deepEqual({ by: signedIn.recordedBy, byId: signedIn.recordedById }, { by: 'Huda', byId: 'u1' });
  const local = buildOrderFromDraft(draft, ORDER_TYPES.completion, { tasks, userName: 'Huda', id: 'o2', now: 'T' });
  assert.equal(local.recordedById, null);
  Object.values(ORDER_TYPES).forEach((spec) => {
    const order = buildOrderFromDraft({ type: spec.type, date: '2026-10-25', who: { kind: 'none' } }, spec, { tasks, recordedById: 'u9', id: 'o', now: 'T' });
    assert.equal(order.recordedById, 'u9', spec.type);
  });
});

/* ─────────────── draftWarnings ─────────────── */

const engineTasks = [
  { id: 't1', wbs: '1.1', unit: 'م3', qty: 100, actualQty: 60 },
  { id: 't2', wbs: '1.2', unit: 'م2', qty: 0, actualQty: 0 },
];
const ctx = (orders = [], extra = {}) => ({ orders, tasks: engineTasks, projectStart: '2026-01-01', today: '2026-10-25', ...extra });
const codes = (list) => list.map((w) => w.code);
const work = (patch = {}) => ({
  type: 'quick_work',
  date: '2026-10-25',
  taskId: 't1',
  quantity: '10',
  unit: '',
  who: { kind: 'contractor', contractorId: 'c1' },
  ...patch,
});

test('draftWarnings: a clean draft gives none; no draft or an unknown type gives none', () => {
  assert.deepEqual(draftWarnings(work(), ctx()), []);
  assert.deepEqual(draftWarnings(null, ctx()), []);
  assert.deepEqual(draftWarnings({ type: 'nope' }, ctx()), []);
});

test('draftWarnings: quantity over what is left on the contract (orders awaiting approval count)', () => {
  assert.deepEqual(draftWarnings(work({ quantity: '40' }), ctx()), []); // exactly what is left
  assert.deepEqual(draftWarnings(work({ quantity: '41' }), ctx()), [{ code: 'overLeft', qty: 41, left: 40, pending: 0, unit: 'م3' }]);
  const pending = [
    { id: 'p', type: 'completion', family: 'value', tier: 'formal', status: 'recorded', taskId: 't1', quantity: 30, date: '2026-10-20', who: { kind: 'none' } },
  ];
  assert.deepEqual(draftWarnings(work({ quantity: '15', unit: 'm3' }), ctx(pending)), [{ code: 'overLeft', qty: 15, left: 10, pending: 30, unit: 'm3' }]);
  // Already over the contract: nothing is left, any quantity warns.
  const over = [{ id: 't1', unit: 'م3', qty: 100, actualQty: 120 }];
  assert.deepEqual(codes(draftWarnings(work({ quantity: '1' }), ctx([], { tasks: over }))), ['overLeft']);
  // No contract quantity, an unknown item, or a type without quantity: no check.
  assert.deepEqual(draftWarnings(work({ taskId: 't2', quantity: '999' }), ctx()), []);
  assert.deepEqual(draftWarnings(work({ taskId: 'missing', quantity: '999' }), ctx()), []);
  assert.deepEqual(draftWarnings({ type: 'concrete_test', date: '2026-10-25', taskId: 't1', location: 'A', who: { kind: 'none' } }, ctx()), []);
});

test('draftWarnings: a likely duplicate (same type, item, date, quantity and who)', () => {
  const existing = {
    id: 'old',
    type: 'quick_work',
    family: 'value',
    status: 'approved',
    date: '2026-10-25',
    taskId: 't1',
    quantity: 10,
    who: { kind: 'contractor', contractorId: 'c1' },
    details: {},
  };
  assert.deepEqual(draftWarnings(work(), ctx([existing])), [{ code: 'duplicate', orderId: 'old' }]);
  // Any one of them different → not a duplicate.
  assert.deepEqual(draftWarnings(work({ quantity: '11' }), ctx([existing])), []);
  assert.deepEqual(draftWarnings(work({ date: '2026-10-24' }), ctx([existing])), []);
  assert.deepEqual(draftWarnings(work({ who: { kind: 'contractor', contractorId: 'c2' } }), ctx([existing])), []);
  assert.deepEqual(draftWarnings(work({ type: 'completion' }), ctx([existing])), []);
  assert.deepEqual(draftWarnings(work({ taskId: 't2' }), ctx([existing])), []);
  // The same workers in another order, or an empty contractor (saved as none), still match.
  const crew = { ...existing, who: { kind: 'workers', workerIds: ['w1', 'w2'] } };
  assert.deepEqual(codes(draftWarnings(work({ who: { kind: 'workers', workerIds: ['w2', 'w1'] } }), ctx([crew]))), ['duplicate']);
  const nobody = { ...existing, who: { kind: 'none' } };
  assert.deepEqual(codes(draftWarnings(work({ who: { kind: 'contractor', contractorId: '' } }), ctx([nobody]))), ['duplicate']);
  // Expenses compare the amount.
  const fuel = { id: 'f', type: 'fuel', family: 'expense', date: '2026-10-25', taskId: null, amount: 50000, who: { kind: 'none' }, details: {} };
  const fuelDraft = { type: 'fuel', date: '2026-10-25', taskId: '', amount: '50000', who: { kind: 'none' } };
  assert.deepEqual(codes(draftWarnings(fuelDraft, ctx([fuel]))), ['duplicate']);
  assert.deepEqual(draftWarnings({ ...fuelDraft, amount: '50001' }, ctx([fuel])), []);
  // Two tests on one item and day are told apart by location / sample / depth.
  const cube = {
    id: 'c',
    type: 'concrete_test',
    family: 'value',
    date: '2026-10-25',
    taskId: 't1',
    quantity: null,
    who: { kind: 'none' },
    details: { location: '0+950', sampleRef: 'S1' },
  };
  const cubeDraft = { type: 'concrete_test', date: '2026-10-25', taskId: 't1', location: ' 0+950 ', sampleRef: 'S1', who: { kind: 'none' } };
  assert.deepEqual(codes(draftWarnings(cubeDraft, ctx([cube]))), ['duplicate']);
  assert.deepEqual(draftWarnings({ ...cubeDraft, sampleRef: 'S2' }, ctx([cube])), []);
});

test('draftWarnings: a date in the future or before the project start', () => {
  assert.deepEqual(draftWarnings(work({ date: '2026-10-26' }), ctx()), [{ code: 'futureDate', today: '2026-10-25' }]);
  assert.deepEqual(draftWarnings(work({ date: '2025-12-31' }), ctx()), [{ code: 'beforeStart', start: '2026-01-01' }]);
  assert.deepEqual(draftWarnings(work({ date: '2026-01-01' }), ctx()), []);
  // A full ISO start counts by its day; no start → no check.
  assert.deepEqual(codes(draftWarnings(work({ date: '2025-12-31' }), ctx([], { projectStart: '2026-01-01T00:00:00.000Z' }))), ['beforeStart']);
  assert.deepEqual(draftWarnings(work({ date: '2025-12-31' }), ctx([], { projectStart: '' })), []);
});

test('draftWarnings: an expense amount more than 10× the median for its type', () => {
  const fuels = [100, 120, 80, 5000].map((amount, i) => ({
    id: `f${i}`,
    type: 'fuel',
    family: 'expense',
    date: `2026-10-0${i + 1}`,
    amount,
    who: { kind: 'none' },
  }));
  const fuelDraft = (amount) => ({ type: 'fuel', date: '2026-10-25', amount: String(amount), who: { kind: 'none' } });
  // Median of 80, 100, 120, 5000 = 110 → above 1100 warns.
  assert.deepEqual(draftWarnings(fuelDraft(1100), ctx(fuels)), []);
  assert.deepEqual(draftWarnings(fuelDraft(1101), ctx(fuels)), [{ code: 'amountOutlier', amount: 1101, median: 110 }]);
  // Other types do not count; too few earlier orders → nothing to compare with.
  const others = fuels.map((o) => ({ ...o, type: 'material' }));
  assert.deepEqual(draftWarnings(fuelDraft(99999), ctx(others)), []);
  assert.deepEqual(draftWarnings(fuelDraft(99999), ctx(fuels.slice(0, OUTLIER_MIN_SAMPLES - 1))), []);
  assert.deepEqual(codes(draftWarnings(fuelDraft(99999), ctx(fuels.slice(0, OUTLIER_MIN_SAMPLES)))), ['amountOutlier']);
});

test('draftWarnings: several at once, duplicate first', () => {
  const existing = {
    id: 'old',
    type: 'quick_work',
    family: 'value',
    status: 'approved',
    date: '2026-11-01',
    taskId: 't1',
    quantity: 50,
    who: { kind: 'contractor', contractorId: 'c1' },
  };
  assert.deepEqual(codes(draftWarnings(work({ date: '2026-11-01', quantity: '50' }), ctx([existing]))), ['duplicate', 'overLeft', 'futureDate']);
});

/* ─────────────── approving and the certificate lock ─────────────── */

test('approvalBlock: nobody approves their own formal order; roles without approve cannot', () => {
  const order = { id: 'o', tier: 'formal', status: 'recorded', recordedBy: 'Huda', recordedById: 'u1' };
  assert.equal(approvalBlock(order, { id: 'u1', name: 'Huda', role: 'pm' }), 'own');
  assert.equal(approvalBlock(order, { id: 'u2', name: 'Ali', role: 'pm' }), null);
  assert.equal(approvalBlock(order, { id: 'u2', name: 'Ali', role: 'site' }), 'role');
  assert.equal(approvalBlock(order, { id: 'u2', name: 'Ali', role: 'viewer' }), 'role');
  assert.equal(approvalBlock(order, null), 'role');
  // An order from before accounts (name only) is matched by name once signed in.
  assert.equal(approvalBlock({ ...order, recordedById: null }, { id: 'u1', name: 'Huda', role: 'office' }), 'own');
  // No accounts yet: the one local user (id null) approves their own, as before.
  assert.equal(approvalBlock(order, { id: null, name: 'Huda', role: 'admin' }), null);
  assert.equal(approvalBlock({ ...order, recordedById: null }, { id: null, name: 'Huda', role: 'admin' }), null);
});

test('certificate lock: only orders in an ISSUED certificate are locked', () => {
  const doc = {
    certificates: [
      { id: 'c1', kind: 'subcontractor', contractorId: 'k1', number: 2, status: 'issued', orderIds: ['a', 'b'] },
      { id: 'c2', kind: 'employer', contractorId: null, number: 1, status: 'issued', orderIds: ['b'] },
      { id: 'c3', kind: 'subcontractor', contractorId: 'k1', number: 3, status: 'draft', orderIds: ['d'] },
    ],
  };
  const byOrder = certificatesByOrder(doc);
  assert.deepEqual(orderLock({ id: 'a' }, byOrder), [{ id: 'c1', number: 2, kind: 'subcontractor', contractorId: 'k1' }]);
  assert.deepEqual(orderLock({ id: 'b' }, byOrder).map((c) => c.id), ['c1', 'c2']);
  assert.equal(orderLock({ id: 'd' }, byOrder), null); // drafts never lock
  assert.equal(orderLock({ id: 'zz' }, byOrder), null);
  assert.equal(orderLock({ id: 'a' }, undefined), null);
  // A locked order is never approved again, whoever asks.
  const admin = { id: null, name: '', role: 'admin' };
  assert.equal(approvalBlock({ id: 'a' }, admin, { certified: Boolean(orderLock({ id: 'a' }, byOrder)) }), 'certified');
  assert.equal(approvalBlock({ id: 'd' }, admin, { certified: Boolean(orderLock({ id: 'd' }, byOrder)) }), null);
});

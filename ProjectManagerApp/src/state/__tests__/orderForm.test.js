import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORDER_TYPES } from '../../utils/OrderEngine.js';
import {
  EMPTY_FILTERS,
  buildOrderFromDraft,
  filterOrders,
  hasActiveFilters,
  latestOrder,
  missingRequiredFields,
  orderKpis,
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

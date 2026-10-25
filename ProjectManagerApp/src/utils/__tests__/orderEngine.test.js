// Unit tests for the PURE aggregation/draft helpers of src/utils/OrderEngine.js
// (node:test). The persistence functions (loadOrdersData & friends) touch
// localStorage at call time and are intentionally not covered here.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sumValueOrdersByTask,
  sumExpenses,
  ordersInRange,
  ordersForContractor,
  createOrderDraft,
} from '../OrderEngine.js';

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

describe('sumValueOrdersByTask', () => {
  it('sums only APPROVED VALUE orders per task and splits formal vs quick', () => {
    const orders = [
      { family: 'value', status: 'approved', tier: 'formal', taskId: 't1', quantity: 30 },
      { family: 'value', status: 'approved', tier: 'quick', taskId: 't1', quantity: 20 },
      { family: 'value', status: 'recorded', tier: 'formal', taskId: 't1', quantity: 40 }, // awaiting approval
      { family: 'expense', status: 'approved', taskId: 't1', amount: 500 }, // wrong family
      { family: 'value', status: 'approved', tier: 'quick', quantity: 9 }, // no taskId → skipped
      null, // defensive
    ];
    const map = sumValueOrdersByTask(orders);

    assert.equal(map.size, 1);
    assert.deepEqual(map.get('t1'), { total: 50, formalQty: 30, quickQty: 20, orderCount: 2 });
  });

  it('accepts numeric-string quantities and SKIPS zero/garbage-quantity orders', () => {
    const orders = [
      { family: 'value', status: 'approved', tier: 'quick', taskId: 't2', quantity: '12.5' },
      { family: 'value', status: 'approved', tier: 'quick', taskId: 't3', quantity: 'abc' }, // NaN → skipped
      { family: 'value', status: 'approved', tier: 'quick', taskId: 't4', quantity: 0 },    // 0 → skipped
    ];
    const map = sumValueOrdersByTask(orders);

    assert.deepEqual(map.get('t2'), { total: 12.5, formalQty: 0, quickQty: 12.5, orderCount: 1 });
    // Zero/garbage quantities must NOT create entries: an entry makes the
    // engine treat the task as order-driven and would zero its manual actuals.
    assert.equal(map.has('t3'), false);
    assert.equal(map.has('t4'), false);
  });

  it('returns an empty map for non-array input', () => {
    assert.equal(sumValueOrdersByTask(undefined).size, 0);
    assert.equal(sumValueOrdersByTask('nope').size, 0);
  });
});

describe('sumExpenses', () => {
  const orders = [
    { family: 'expense', date: '2030-01-05', amount: 250, category: 'وقود' },
    { family: 'expense', date: '2030-01-06', amount: 100, type: 'material' }, // label fallback
    { family: 'expense', date: '2030-01-20', amount: 75, category: 'وقود' },
    { family: 'expense', amount: 40, category: 'نقدية' }, // undated → always counted
    { family: 'expense', date: '2030-01-07', amount: 7, type: 'zzz' }, // unknown type fallback
    { family: 'value', date: '2030-01-05', amount: 999 }, // wrong family
    null,
  ];

  it('totals expenses by category across all orders', () => {
    const result = sumExpenses(orders);
    assert.equal(result.total, 250 + 100 + 75 + 40 + 7);
    assert.equal(result.byCategory['وقود'], 325);
    assert.equal(result.byCategory['شراء مواد'], 100); // ORDER_TYPES.material.label
    assert.equal(result.byCategory['نقدية'], 40);
    assert.equal(result.byCategory['مصروف آخر'], 7); // unknown-type fallback
  });

  it('filters by date range with INCLUSIVE bounds', () => {
    const result = sumExpenses(orders, { dateFrom: '2030-01-05', dateTo: '2030-01-06' });
    // 01-05 and 01-06 are inside (inclusive); the undated order is kept by design.
    assert.equal(result.total, 250 + 100 + 40);
    assert.equal(result.byCategory['وقود'], 250);
  });

  it('applies only one bound when the other is missing', () => {
    assert.equal(sumExpenses(orders, { dateTo: '2030-01-06' }).total, 250 + 100 + 40);
    assert.equal(sumExpenses(orders, { dateFrom: '2030-01-07' }).total, 75 + 7 + 40); // undated kept
  });

  it('returns zero totals for non-array input', () => {
    assert.deepEqual(sumExpenses(undefined), { total: 0, byCategory: {} });
  });
});

describe('ordersInRange', () => {
  const orders = [
    { date: '2030-01-01' },
    { date: '2030-01-10' },
    { date: '2030-01-20' },
    { date: null }, // undated → kept regardless of bounds
    null, // defensive
  ];

  it('keeps orders within [dateFrom, dateTo] inclusive', () => {
    const kept = ordersInRange(orders, '2030-01-05', '2030-01-10');
    assert.equal(kept.length, 2); // 01-10 + the undated one
    assert.ok(kept.includes(orders[1]));
    assert.ok(kept.includes(orders[3]));
  });

  it('returns everything for missing bounds', () => {
    assert.equal(ordersInRange(orders).length, 4); // nulls dropped, undated kept
    assert.equal(ordersInRange(orders, null, null).length, 4);
  });

  it('handles non-array input', () => {
    assert.deepEqual(ordersInRange(undefined, '2030-01-01', '2030-01-31'), []);
  });
});

describe('ordersForContractor', () => {
  const orders = [
    { who: { kind: 'contractor', contractorId: 'c1' }, date: '2030-01-05' },
    { who: { kind: 'contractor', contractorId: 'c2' }, date: '2030-01-05' },
    { who: { kind: 'team', teamId: 'c1' }, date: '2030-01-05' }, // right id, wrong kind
    { who: { kind: 'contractor', contractorId: 'c1' }, date: '2030-02-01' },
    { who: { contractorId: 'c1' } }, // kindless
    null,
  ];

  it('matches who.kind contractor AND contractorId', () => {
    const kept = ordersForContractor(orders, 'c1');
    assert.equal(kept.length, 2);
    assert.ok(kept.every((o) => o.who.contractorId === 'c1' && o.who.kind === 'contractor'));
  });

  it('applies the optional date range on top of the contractor match', () => {
    const kept = ordersForContractor(orders, 'c1', { dateFrom: '2030-01-01', dateTo: '2030-01-31' });
    assert.equal(kept.length, 1);
    assert.equal(kept[0].date, '2030-01-05');
  });

  it('returns empty for no matches / non-array input', () => {
    assert.deepEqual(ordersForContractor(orders, 'zz'), []);
    assert.deepEqual(ordersForContractor(undefined, 'c1'), []);
  });
});

describe('createOrderDraft', () => {
  it('returns null for an unknown order type', () => {
    assert.equal(createOrderDraft('nope'), null);
  });

  it('prefills today (local) and the last-used who for that type', () => {
    const lastWho = { quick_work: { kind: 'contractor', contractorId: 'c9' } };
    const draft = createOrderDraft('quick_work', { lastWho });

    assert.equal(draft.type, 'quick_work');
    assert.equal(draft.date, localToday());
    assert.deepEqual(draft.who, { kind: 'contractor', contractorId: 'c9' });
    assert.equal(draft.taskId, '');
    assert.equal(draft.quantity, '');
    assert.equal(draft.amount, '');
    assert.equal(draft.note, '');
  });

  it('falls back to the type default who when no last-used entry exists', () => {
    assert.deepEqual(createOrderDraft('material').who, { kind: 'contractor' }); // whoDefault
    assert.deepEqual(createOrderDraft('completion').who, { kind: 'none' });
    assert.equal(createOrderDraft('payroll').date, localToday());
  });
});

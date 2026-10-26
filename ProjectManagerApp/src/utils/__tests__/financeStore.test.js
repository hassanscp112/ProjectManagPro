// Finance.js storage: the old ledger stays exactly as stored when the
// migrated flag is set, and the move itself is idempotent against storage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment } from './helpers.js';

installNodeTestEnvironment();
const { FINANCE_DATA_KEY, loadFinanceData, loadFinanceMigration, saveFinanceMigration } = await import('../Finance.js');
const { ORDERS_STORAGE_KEY, addOrders, loadOrdersData } = await import('../OrderEngine.js');
const { migrationFlag, planFinanceMigration } = await import('../../state/financeModel.js');

const LEDGER = {
  machinery: [{ id: '1', date: '2026-10-01', machineType: 'شفل', operator: 'a', machineHours: 2, machineRate: 10, totalPrice: 20 }],
  materials: [],
  pettyCash: [{ id: '2', date: '2026-10-02', expenseType: 'اطعام', totalPrice: 5 }],
  payroll: [],
  extra: 'kept',
};

const reset = () => {
  localStorage.clear();
  localStorage.setItem(FINANCE_DATA_KEY, JSON.stringify(LEDGER));
};

test('the migrated flag never changes or deletes the old ledger records', () => {
  reset();
  assert.equal(loadFinanceMigration(), null);
  assert.equal(saveFinanceMigration({ migratedAt: 'T', migratedBy: 'A', count: 2 }), true);
  const stored = JSON.parse(localStorage.getItem(FINANCE_DATA_KEY));
  const { migration, ...rest } = stored;
  assert.deepEqual(rest, LEDGER);
  assert.deepEqual(migration, { migratedAt: 'T', migratedBy: 'A', count: 2 });
  assert.deepEqual(loadFinanceMigration(), migration);
  assert.deepEqual(loadFinanceData().machinery, LEDGER.machinery);
});

test('an unreadable stored ledger is left alone', () => {
  localStorage.clear();
  localStorage.setItem(FINANCE_DATA_KEY, '{broken');
  assert.equal(saveFinanceMigration({ migratedAt: 'T' }), false);
  assert.equal(localStorage.getItem(FINANCE_DATA_KEY), '{broken');
});

test('moving twice through storage adds each record once', () => {
  reset();
  const run = () => {
    const previous = loadFinanceMigration();
    const plan = planFinanceMigration(loadFinanceData(), loadOrdersData().orders, { migration: previous, actorName: 'A', now: 'T' });
    addOrders(plan.orders);
    saveFinanceMigration(migrationFlag(plan, { previous, actorName: 'A', now: 'T' }));
    return plan.orders.length;
  };
  assert.equal(run(), 2);
  assert.equal(run(), 0);
  const { orders } = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY));
  assert.deepEqual(orders.map((o) => [o.id, o.amount]), [['fin-machinery-1', 20], ['fin-pettyCash-2', 5]]);
  assert.equal(loadFinanceMigration().count, 2);
});

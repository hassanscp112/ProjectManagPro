import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkChange } from '../../sync/rules.js';
import { ORDER_TYPES, createOrderDraft, sumExpenses } from '../../utils/OrderEngine.js';
import {
  DEDUCTED_STATUS,
  MIGRATION_SOURCE,
  addListItem,
  draftAfterSave,
  filterLedger,
  financeTotals,
  ledgerAddType,
  ledgerOrders,
  ledgerTotal,
  legacyRecordToOrder,
  migratedOrderId,
  migrationCheck,
  migrationFlag,
  planFinanceMigration,
  removeListItem,
} from '../financeModel.js';

const order = (id, type, date, amount, details = {}, extra = {}) => ({
  id,
  type,
  family: ORDER_TYPES[type].family,
  tier: 'quick',
  date,
  recordedAt: `${date}T08:00:00.000Z`,
  amount,
  details,
  status: 'approved',
  ...extra,
});

/* ── views over expense orders ── */

const ORDERS = [
  order('m1', 'machinery', '2026-10-01', 10, { machineType: 'شفل', driver: 'a' }),
  order('m2', 'machinery', '2026-10-05', 20, { machineType: 'حفارة', driver: 'b' }),
  order('m3', 'machinery', '2026-10-09', 5, { machineType: 'شفل', driver: 'b' }),
  order('mat', 'material', '2026-10-02', 7, { material: 'رمل' }),
  order('oth', 'other_expense', '2026-10-03', 3, { expenseType: 'اطعام' }),
  order('fuel', 'fuel', '2026-10-04', 2),
  order('pay', 'payroll', '2026-10-06', 100, { employee: 'علي' }),
  { id: 'w', type: 'quick_work', family: 'value', date: '2026-10-07', quantity: 9 },
  null,
];

test('each ledger shows its expense order types, newest first; Add opens the first type', () => {
  assert.deepEqual(ledgerOrders(ORDERS, 'machinery').map((o) => o.id), ['m3', 'm2', 'm1']);
  assert.deepEqual(ledgerOrders(ORDERS, 'materials').map((o) => o.id), ['mat']);
  assert.deepEqual(ledgerOrders(ORDERS, 'pettyCash').map((o) => o.id), ['fuel', 'oth']);
  assert.deepEqual(ledgerOrders(ORDERS, 'payroll').map((o) => o.id), ['pay']);
  assert.deepEqual(ledgerOrders(ORDERS, 'lists'), []);
  assert.deepEqual(['machinery', 'materials', 'pettyCash', 'payroll', 'lists'].map(ledgerAddType), ['machinery', 'material', 'other_expense', 'payroll', null]);
});

test('ledger filters: dates and the detail values; totals', () => {
  const rows = ledgerOrders(ORDERS, 'machinery');
  assert.deepEqual(filterLedger(rows, { from: '2026-10-02' }).map((o) => o.id), ['m3', 'm2']);
  assert.deepEqual(filterLedger(rows, { to: '2026-10-05' }).map((o) => o.id), ['m2', 'm1']);
  assert.deepEqual(filterLedger(rows, { machineType: 'شفل', driver: '' }).map((o) => o.id), ['m3', 'm1']);
  assert.deepEqual(filterLedger(rows, { machineType: 'شفل', driver: 'b' }).map((o) => o.id), ['m3']);
  assert.equal(ledgerTotal(rows), 35);
  assert.equal(ledgerTotal([{ amount: '4' }, { amount: 'x' }, { amount: null }]), 4);
});

test('finance totals cover every expense order exactly once', () => {
  const totals = financeTotals(ORDERS);
  assert.deepEqual(totals, { machinery: 35, materials: 7, pettyCash: 5, payroll: 100, total: 147 });
  assert.equal(totals.total, sumExpenses(ORDERS).total);
});

test('after a save the date and slow-changing fields stay; the amount follows them', () => {
  const saved = {
    ...createOrderDraft('machinery'),
    date: '2026-10-01',
    machineType: 'شفل',
    driver: 'علي',
    machineHours: '8',
    machineRate: '50000',
    fuelLiters: '20',
    fuelPrice: '1000',
    note: 'x',
  };
  const next = draftAfterSave(saved, createOrderDraft('machinery'));
  assert.deepEqual(
    { date: next.date, type: next.machineType, driver: next.driver, hours: next.machineHours, rate: next.machineRate, liters: next.fuelLiters, note: next.note, amount: next.amount },
    { date: '2026-10-01', type: 'شفل', driver: 'علي', hours: '', rate: '50000', liters: '', note: '', amount: '' }
  );
  const pay = draftAfterSave({ ...createOrderDraft('payroll'), employee: 'علي', salary: '900', payStatus: DEDUCTED_STATUS }, createOrderDraft('payroll'));
  assert.deepEqual([pay.employee, pay.salary, pay.payStatus], ['', '', DEDUCTED_STATUS]);
  const other = draftAfterSave({ ...createOrderDraft('other_expense'), expenseType: 'اطعام', amount: '5' }, createOrderDraft('other_expense'));
  assert.deepEqual([other.expenseType, other.amount], ['اطعام', '']);
});

/* ── the one-time migration ── */

const LEGACY = {
  machinery: [
    { id: '1760000000000', date: '2026-10-01', machineName: 'D8', machineType: 'بلدوزر', machineSize: 'كبير', badge: 'B1', machineHours: 8, machineRate: 50000, machineTotal: 400000, operator: 'سائق احمد', driverHours: 8, driverRate: 5000, driverTotal: 40000, fuelLiters: 0, fuelPrice: 0, fuelTotal: 0, totalPrice: 440000 },
    { id: '1760000000001', date: '2026-10-02', machineName: 'شفل 2', machineType: 'شفل', machineSize: '', badge: '', machineHours: 4, machineRate: 30000, operator: 'سائق عمر', driverHours: 0, driverRate: 0, fuelLiters: 50, fuelPrice: 750, totalPrice: 157500 },
  ],
  materials: [{ id: '1760000000002', date: '2026-10-03', receipt: '77', details: 'رمل S1', materialType: 'رمل', quantity: '150 م3', totalPrice: 1800000 }],
  pettyCash: [
    { id: '1760000000003', date: '2026-10-04', expenseType: 'اطعام', notes: 'غداء', totalPrice: 25000 },
    { id: '1760000000004', date: '2026-10-04', expenseType: 'نثريات', notes: '', totalPrice: '12500' },
  ],
  payroll: [
    { id: '1760000000005', date: '2026-10-05', employee: 'مهندس علي', salary: 1000000, advancePayment: 300000, status: DEDUCTED_STATUS, totalPrice: 700000 },
    { id: '1760000000006', date: '2026-10-05', employee: 'سائق عمر', salary: 800000, advancePayment: 100000, status: 'غير مستقطع', totalPrice: 800000 },
  ],
};
const NOW = '2026-10-26T10:00:00.000Z';
const CTX = { actorName: 'Accountant', now: NOW };

test('migration mapping: machinery', () => {
  const o = legacyRecordToOrder('machinery', LEGACY.machinery[0], { sourceId: '1760000000000', ...CTX });
  assert.deepEqual(
    { id: o.id, type: o.type, family: o.family, tier: o.tier, status: o.status, date: o.date, amount: o.amount, category: o.category, who: o.who, taskId: o.taskId, quantity: o.quantity, evidence: o.evidence },
    { id: 'fin-machinery-1760000000000', type: 'machinery', family: 'expense', tier: 'quick', status: 'approved', date: '2026-10-01', amount: 440000, category: ORDER_TYPES.machinery.label, who: { kind: 'none' }, taskId: null, quantity: null, evidence: [] }
  );
  assert.deepEqual(o.details, { machineType: 'بلدوزر', machineSize: 'كبير', driver: 'سائق احمد', machineHours: 8, machineRate: 50000, driverHours: 8, driverRate: 5000, machineName: 'D8', badge: 'B1' });
  assert.deepEqual(
    { source: o.source, sourceLedger: o.sourceLedger, sourceId: o.sourceId, migratedAt: o.migratedAt, recordedBy: o.recordedBy, approvedBy: o.approvedBy },
    { source: MIGRATION_SOURCE, sourceLedger: 'machinery', sourceId: '1760000000000', migratedAt: NOW, recordedBy: 'Accountant', approvedBy: 'Accountant' }
  );
  // the old id was Date.now(): it says when the record was entered
  assert.equal(o.recordedAt, new Date(1760000000000).toISOString());
});

test('migration mapping: materials, petty cash, payroll', () => {
  const mat = legacyRecordToOrder('materials', LEGACY.materials[0], { sourceId: 'x', ...CTX });
  assert.deepEqual([mat.type, mat.amount, mat.details], ['material', 1800000, { material: 'رمل', quantityText: '150 م3', receipt: '77', note: 'رمل S1' }]);

  const petty = legacyRecordToOrder('pettyCash', LEGACY.pettyCash[1], { sourceId: 'y', ...CTX });
  assert.deepEqual([petty.type, petty.amount, petty.details], ['other_expense', 12500, { expenseType: 'نثريات' }]);

  const pay = legacyRecordToOrder('payroll', LEGACY.payroll[0], { sourceId: 'z', ...CTX });
  assert.deepEqual([pay.type, pay.amount, pay.details], ['payroll', 700000, { employee: 'مهندس علي', salary: 1000000, advance: 300000, payStatus: DEDUCTED_STATUS }]);

  // the original author wins over the migrating user; a non-timestamp id keeps the run time
  const authored = legacyRecordToOrder('pettyCash', { id: 'abc', date: '2026-10-01', totalPrice: 5, recordedBy: 'Site Eng' }, { sourceId: 'abc', ...CTX });
  assert.deepEqual([authored.recordedBy, authored.approvedBy, authored.recordedAt], ['Site Eng', 'Site Eng', NOW]);
});

test('dry run: counts and totals per ledger, before anything moves', () => {
  const plan = planFinanceMigration(LEGACY, [], CTX);
  assert.deepEqual(
    plan.ledgers.map((l) => [l.ledger, l.count, l.total, l.done, l.toAdd, l.addTotal]),
    [
      ['machinery', 2, 597500, 0, 2, 597500],
      ['materials', 1, 1800000, 0, 1, 1800000],
      ['pettyCash', 2, 37500, 0, 2, 37500],
      ['payroll', 2, 1500000, 0, 2, 1500000],
    ]
  );
  assert.deepEqual([plan.count, plan.total, plan.toAdd, plan.addTotal, plan.orders.length], [7, 3935000, 7, 3935000, 7]);
});

test('totals before vs after: every ledger keeps its total as expense orders', () => {
  const plan = planFinanceMigration(LEGACY, [], CTX);
  const after = financeTotals(plan.orders);
  plan.ledgers.forEach((l) => assert.equal(after[l.ledger], l.total, l.ledger));
  assert.equal(after.total, plan.total);
  assert.equal(sumExpenses(plan.orders).total, plan.total); // what EVM AC sees
  assert.deepEqual(
    migrationCheck(LEGACY, plan.orders).map((r) => [r.count, r.total, r.orders, r.ordersTotal]),
    plan.ledgers.map((l) => [l.count, l.total, l.count, l.total])
  );
});

test('idempotent: running it twice adds nothing', () => {
  const first = planFinanceMigration(LEGACY, [], CTX);
  const orders = [order('other', 'fuel', '2026-10-01', 1), ...first.orders];
  const flag = migrationFlag(first, { actorName: 'Accountant', now: NOW });
  const second = planFinanceMigration(LEGACY, orders, { migration: flag, ...CTX });
  assert.deepEqual([second.toAdd, second.orders.length, second.count], [0, 0, 7]);
  assert.deepEqual(second.ledgers.map((l) => l.done), [2, 1, 2, 2]);

  // another device already moved them (its orders synced, its flag not yet)
  assert.equal(planFinanceMigration(LEGACY, first.orders, CTX).toAdd, 0);
  // a moved order deleted since is not brought back by the flag
  assert.equal(planFinanceMigration(LEGACY, first.orders.slice(1), { migration: flag, ...CTX }).toAdd, 0);
  // the same records give the same order ids on every device
  assert.deepEqual(planFinanceMigration(LEGACY, [], { now: 'other' }).orders.map((o) => o.id), first.orders.map((o) => o.id));
});

test('records added to the old ledger after the move are picked up on their own', () => {
  const first = planFinanceMigration(LEGACY, [], CTX);
  const flag = migrationFlag(first, { actorName: 'Accountant', now: NOW });
  const later = { ...LEGACY, pettyCash: [...LEGACY.pettyCash, { id: '1760000009999', date: '2026-10-20', expenseType: 'صيانة', totalPrice: 9000 }] };
  const plan = planFinanceMigration(later, first.orders, { migration: flag, ...CTX });
  assert.deepEqual([plan.toAdd, plan.addTotal, plan.orders[0].id], [1, 9000, 'fin-pettyCash-1760000009999']);
  const next = migrationFlag(plan, { previous: flag, actorName: 'PM', now: 'T2' });
  assert.deepEqual([next.migratedAt, next.migratedBy, next.lastRunAt, next.count], [NOW, 'Accountant', 'T2', 8]);
  assert.ok(next.sourceKeys.includes('pettyCash:1760000009999'));
});

test('records without an id or with a repeated id still move exactly once', () => {
  const data = { pettyCash: [{ date: 'a', totalPrice: 1 }, { id: '5', date: 'b', totalPrice: 2 }, { id: '5', date: 'c', totalPrice: 3 }, null, 'junk'] };
  const plan = planFinanceMigration(data, [], CTX);
  assert.deepEqual(plan.orders.map((o) => [o.id, o.sourceId, o.amount]), [
    ['fin-pettyCash-i0', 'i0', 1],
    ['fin-pettyCash-5', '5', 2],
    ['fin-pettyCash-5~2', '5~2', 3],
  ]);
  assert.equal(planFinanceMigration(data, plan.orders, CTX).toAdd, 0);
  assert.equal(migratedOrderId('materials', 'a/b c#'), 'fin-materials-a_b_c_');
});

test('sync rules: finance roles may write the moved orders and the flag, others may not', () => {
  const plan = planFinanceMigration(LEGACY, [], CTX);
  const flag = migrationFlag(plan, CTX);
  const write = (role, collection, key, after) => checkChange({ id: 'u1', role }, { collection, key, before: null, after }).ok;
  ['admin', 'pm', 'site', 'accountant'].forEach((role) => {
    plan.orders.forEach((o) => assert.equal(write(role, 'pm-orders', `orders/${o.id}`, o), true, `${role} ${o.id}`));
    assert.equal(write(role, 'project-manager-finance-data', '$doc', { migration: flag }), true, role);
  });
  ['office', 'viewer'].forEach((role) => {
    assert.equal(write(role, 'pm-orders', `orders/${plan.orders[0].id}`, plan.orders[0]), false, role);
    assert.equal(write(role, 'project-manager-finance-data', '$doc', { migration: flag }), false, role);
  });
});

test('dropdown lists', () => {
  assert.deepEqual(addListItem(['a'], ' b '), ['a', 'b']);
  assert.deepEqual(addListItem(['a'], 'a'), ['a']);
  assert.deepEqual(addListItem(['a'], '  '), ['a']);
  assert.deepEqual(removeListItem(['a', 'b'], 'a'), ['b']);
});

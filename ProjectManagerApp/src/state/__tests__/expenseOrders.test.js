// Structured expense orders: the computed amounts (OrderEngine) and how the
// Record form's rules (orderForm) validate and store their details.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEDUCTED_STATUS,
  ORDER_TYPES,
  createOrderDraft,
  expenseBreakdown,
  expenseDetails,
  hasComputedAmount,
} from '../../utils/OrderEngine.js';
import { buildOrderFromDraft, missingRequiredFields } from '../orderForm.js';

test('machinery amount = machine hours × rate + driver hours × rate + fuel liters × price', () => {
  const b = expenseBreakdown('machinery', { machineHours: '8', machineRate: '50000', driverHours: '8', driverRate: '5000', fuelLiters: '100', fuelPrice: '' });
  assert.equal(b.amount, 440000);
  assert.deepEqual(b.parts.map((p) => [p.qty, p.rate, p.total]), [[8, 50000, 400000], [8, 5000, 40000], [100, 0, 0]]);
  assert.equal(expenseBreakdown('machinery', { machineHours: 2.5, machineRate: 0.1, fuelLiters: 3, fuelPrice: 0.1 }).amount, 0.55); // no float dust
  assert.equal(expenseBreakdown('machinery', {}).amount, 0);
});

test('material amount = quantity × unit price; the unit is shown, not computed', () => {
  const b = expenseBreakdown('material', { materialQty: '150', unitPrice: '12000', materialUnit: ' م3 ' });
  assert.deepEqual([b.amount, b.parts[0].unit], [1800000, 'م3']);
  assert.equal(expenseBreakdown('material', { materialQty: '150' }).amount, 0);
});

test('payroll net = salary − advance only for the deducted status', () => {
  assert.equal(expenseBreakdown('payroll', { salary: '1000', advance: '300', payStatus: DEDUCTED_STATUS }).amount, 700);
  assert.equal(expenseBreakdown('payroll', { salary: '1000', advance: '300', payStatus: 'غير مستقطع' }).amount, 1000);
  assert.equal(expenseBreakdown('payroll', { salary: '1000', advance: '300', payStatus: '' }).amount, 1000);
  assert.equal(expenseBreakdown('payroll', { salary: 1000, advance: 300, payStatus: DEDUCTED_STATUS }).deducted, true);
  assert.equal(DEDUCTED_STATUS, 'مستقطع'); // a stored data value: never translated
});

test('fuel and other expenses keep a typed amount', () => {
  assert.deepEqual(['machinery', 'material', 'payroll', 'fuel', 'other_expense', 'quick_work'].map(hasComputedAmount), [true, true, true, false, false, false]);
  assert.equal(expenseBreakdown('other_expense', { amount: 5 }), null);
});

test('expense drafts start with their detail keys empty', () => {
  const d = createOrderDraft('machinery');
  ['machineType', 'machineSize', 'driver', 'machineHours', 'machineRate', 'driverHours', 'driverRate', 'fuelLiters', 'fuelPrice'].forEach((k) => assert.equal(d[k], '', k));
  assert.equal(createOrderDraft('payroll').payStatus, '');
  assert.equal(createOrderDraft('quick_work').machineType, undefined);
});

test('details: numbers stored as numbers, text trimmed, empty fields left out', () => {
  const draft = { ...createOrderDraft('material'), material: ' رمل ', materialQty: '150', materialUnit: '', unitPrice: '0', receipt: ' 77 ', note: 'n', quantity: '9' };
  assert.deepEqual(expenseDetails(draft, ORDER_TYPES.material), { material: 'رمل', materialQty: 150, unitPrice: 0, receipt: '77' });
  assert.deepEqual(expenseDetails({ note: 'x' }, ORDER_TYPES.quick_work), {});
});

test('required expense details are checked like every other field', () => {
  const empty = createOrderDraft('machinery');
  assert.deepEqual(missingRequiredFields(empty, ORDER_TYPES.machinery).map((f) => f.key), ['machineType', 'driver', 'machineHours', 'machineRate', 'amount']);
  const ok = { ...empty, machineType: 'شفل', driver: 'علي', machineHours: '8', machineRate: '1000', amount: 8000 };
  assert.deepEqual(missingRequiredFields(ok, ORDER_TYPES.machinery), []);
  const pay = { ...createOrderDraft('payroll'), employee: 'علي', salary: '500' };
  assert.deepEqual(missingRequiredFields(pay, ORDER_TYPES.payroll).map((f) => f.key), ['amount']); // the form keeps amount in step
  const other = { ...createOrderDraft('other_expense'), amount: '5' };
  assert.deepEqual(missingRequiredFields(other, ORDER_TYPES.other_expense).map((f) => f.key), ['expenseType']);
});

test('a machinery order keeps amount and category (EVM, reports) and its details', () => {
  const draft = {
    ...createOrderDraft('machinery'),
    date: '2026-10-25',
    machineType: 'شفل',
    machineSize: 'كبير',
    driver: 'سائق عمر',
    machineHours: '8',
    machineRate: '50000',
    fuelLiters: '20',
    fuelPrice: '750',
    amount: 415000,
    note: ' ',
  };
  const order = buildOrderFromDraft(draft, ORDER_TYPES.machinery, { tasks: [], userName: 'Eng', id: 'o1', now: 'T' });
  assert.deepEqual(
    { family: order.family, status: order.status, amount: order.amount, category: order.category, quantity: order.quantity },
    { family: 'expense', status: 'approved', amount: 415000, category: ORDER_TYPES.machinery.label, quantity: null }
  );
  assert.deepEqual(order.details, { machineType: 'شفل', machineSize: 'كبير', driver: 'سائق عمر', machineHours: 8, machineRate: 50000, fuelLiters: 20, fuelPrice: 750 });
  assert.equal(expenseBreakdown(order.type, order.details).amount, order.amount); // the stored details add up to the amount
});

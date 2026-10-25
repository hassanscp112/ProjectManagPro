import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEDUCTED_STATUS,
  addListItem,
  addRecord,
  buildRecord,
  deleteRecord,
  filterLedger,
  financeTotals,
  ledgerTotal,
  missingFields,
  removeListItem,
} from '../financeModel.js';

test('machinery record totals machine + driver + fuel', () => {
  const r = buildRecord.machinery({ date: '2026-10-01', machineName: ' D8 ', machineType: 'بلدوزر', machineHours: '8', machineRate: '50000', operator: 'علي', driverHours: '8', driverRate: '5000', fuelLiters: '100', fuelPrice: '' });
  assert.deepEqual([r.machineName, r.machineTotal, r.driverTotal, r.fuelTotal, r.totalPrice], ['D8', 400000, 40000, 0, 440000]);
});

test('payroll net deducts the advance only for the deducted status', () => {
  assert.equal(buildRecord.payroll({ salary: '1000', advancePayment: '300', status: DEDUCTED_STATUS }).totalPrice, 700);
  assert.equal(buildRecord.payroll({ salary: '1000', advancePayment: '300', status: 'غير مستقطع' }).totalPrice, 1000);
  assert.equal(buildRecord.materials({ quantity: ' 5 م3 ', totalPrice: '12.5' }).totalPrice, 12.5);
  assert.equal(buildRecord.pettyCash({ totalPrice: 'x' }).totalPrice, 0);
});

test('required fields', () => {
  assert.deepEqual(missingFields('pettyCash', { date: '2026-10-01', totalPrice: '' }), ['totalPrice']);
  assert.deepEqual(missingFields('payroll', { date: 'x', employee: ' ', salary: 1 }), ['employee']);
});

test('filters, totals, add/delete records', () => {
  const rows = [
    { id: '1', date: '2026-10-01', machineType: 'شفل', operator: 'a', totalPrice: 10 },
    { id: '2', date: '2026-10-05', machineType: 'حفارة', operator: 'b', totalPrice: 20 },
    { id: '3', date: '2026-10-09', machineType: 'شفل', operator: 'b', totalPrice: '5' },
  ];
  assert.deepEqual(filterLedger(rows, { from: '2026-10-02' }).map((r) => r.id), ['2', '3']);
  assert.deepEqual(filterLedger(rows, { machineType: 'شفل', operator: '' }).map((r) => r.id), ['1', '3']);
  assert.equal(ledgerTotal(rows), 35);
  const data = { machinery: rows, materials: [{ totalPrice: 1 }], pettyCash: [], payroll: [{ totalPrice: 4 }] };
  assert.deepEqual(financeTotals(data), { machinery: 35, materials: 1, pettyCash: 0, payroll: 4, total: 40 });
  const added = addRecord(data, 'pettyCash', { totalPrice: 2 }, 'n');
  assert.deepEqual(added.pettyCash, [{ id: 'n', totalPrice: 2 }]);
  assert.deepEqual(deleteRecord(added, 'machinery', '2').machinery.map((r) => r.id), ['1', '3']);
});

test('dropdown lists', () => {
  assert.deepEqual(addListItem(['a'], ' b '), ['a', 'b']);
  assert.deepEqual(addListItem(['a'], 'a'), ['a']);
  assert.deepEqual(addListItem(['a'], '  '), ['a']);
  assert.deepEqual(removeListItem(['a', 'b'], 'a'), ['b']);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, attentionItems, indexTone, niceCeil, sectionProgress, taskStatus, todayIndex } from '../homeModel.js';

const today = '2026-10-25';

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-10-25', 7), '2026-11-01');
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
});

test('taskStatus follows the dashboard rules', () => {
  assert.equal(taskStatus({ progress: 1, endDate: '2020-01-01' }, today), 'completed');
  assert.equal(taskStatus({ progress: 0.2, startDate: '2026-01-01', endDate: '2026-10-24' }, today), 'overdue');
  assert.equal(taskStatus({ progress: 0.2, startDate: '2026-10-01', endDate: '2026-10-25' }, today), 'active');
  assert.equal(taskStatus({ progress: 0, startDate: '2026-11-01', endDate: '2026-12-01' }, today), 'upcoming');
});

test('attentionItems: overdue, then active, then starting within 7 days; critical first', () => {
  const tasks = [
    { id: 'g', isGroup: true, progress: 0, startDate: '2026-01-01', endDate: '2026-01-02' },
    { id: 'late-a', progress: 0, startDate: '2026-01-01', endDate: '2026-03-01' },
    { id: 'late-crit', progress: 0, startDate: '2026-01-01', endDate: '2026-06-01', isCritical: true },
    { id: 'active', progress: 0.5, startDate: '2026-10-01', endDate: '2026-11-30' },
    { id: 'soon', progress: 0, startDate: '2026-10-30', endDate: '2026-12-30' },
    { id: 'later', progress: 0, startDate: '2026-12-01', endDate: '2027-01-30' },
    { id: 'done', progress: 1, startDate: '2025-01-01', endDate: '2025-02-01' },
  ];
  const { counts, items } = attentionItems(tasks, today);
  assert.deepEqual(counts, { overdue: 2, active: 1, upcoming: 2, completed: 1 });
  assert.deepEqual(items.map((x) => x.task.id), ['late-crit', 'late-a', 'active', 'soon']);
  assert.deepEqual(items.map((x) => x.kind), ['overdue', 'overdue', 'active', 'upcoming']);
});

test('indexTone thresholds', () => {
  assert.equal(indexTone(1.02), 'success');
  assert.equal(indexTone(0.95), 'warning');
  assert.equal(indexTone(0.9999), 'success'); // displays as 1.00
  assert.equal(indexTone(0.21), 'danger');
  assert.equal(indexTone(undefined), 'danger');
});

test('sectionProgress sorts by WBS and computes EV / BAC', () => {
  const rows = sectionProgress([
    { wbs: '3', bac: 2373, ev: 0 },
    { wbs: '1', bac: 12.7, ev: 12.7 },
    { wbs: '2', bac: 1508.8, ev: 810 },
  ]);
  assert.deepEqual(rows.map((r) => r.wbs), ['1', '2', '3']);
  assert.deepEqual(rows.map((r) => Math.round(r.pct * 10) / 10), [100, 53.7, 0]);
});

test('niceCeil and todayIndex', () => {
  assert.equal(niceCeil(3894900090), 5000000000);
  assert.equal(niceCeil(150), 200);
  assert.equal(niceCeil(0), 1);
  const pts = [{ date: '2026-10-01' }, { date: '2026-10-18' }, { date: '2026-10-26' }];
  assert.equal(todayIndex(pts, today), 1);
  assert.equal(todayIndex(pts, '2026-09-01'), -1);
});

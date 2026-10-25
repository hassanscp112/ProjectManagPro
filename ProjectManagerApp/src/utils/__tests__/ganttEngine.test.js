// Unit tests for src/utils/GanttEngine.js (node:test, no external deps).
//
// GanttEngine.calculate() derives "planned progress" from `new Date()` (today),
// so today-dependent values are only asserted for schedules that lie entirely
// in the past (plannedProgress === 1 ⇒ PV === BAC) or entirely in the future
// (plannedProgress === 0 ⇒ PV === 0), which keeps the numbers deterministic.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment, makeTask } from './helpers.js';

installNodeTestEnvironment();

// Dynamic import: GanttEngine.js imports './OrderEngine' and './CriticalPath'
// without a '.js' extension, which only resolves after the hook above is
// registered (see helpers.js).
const { GanttEngine, addDays, daysBetween, buildSCurve } = await import('../GanttEngine.js');

const byId = (result) => new Map(result.tasks.map((t) => [t.id, t]));

describe('addDays / daysBetween exports', () => {
  it('addDays adds calendar days across month and year boundaries', () => {
    assert.equal(addDays('2026-01-31', 1), '2026-02-01');
    assert.equal(addDays('2026-02-28', 1), '2026-03-01'); // 2026 is not a leap year
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-01-01', -1), '2025-12-31');
    assert.equal(addDays('2026-01-01', 0), '2026-01-01');
  });

  it('addDays rejects malformed dates', () => {
    assert.equal(addDays('2026-13-01', 1), null); // month 13 does not exist
    assert.equal(addDays('2026-02-30', 1), null); // day 30 of February
    assert.equal(addDays('', 1), null);
    assert.equal(addDays(null, 1), null);
  });

  it('daysBetween counts whole days and is zero for reversed/invalid input', () => {
    assert.equal(daysBetween('2026-01-01', '2026-01-11'), 10);
    assert.equal(daysBetween('2026-01-11', '2026-01-01'), 0);
    assert.equal(daysBetween('2026-01-01', '2026-01-01'), 0);
    assert.equal(daysBetween('garbage', '2026-01-01'), 0);
  });
});

describe('GanttEngine.calculate schedule resolution', () => {
  const projectStart = '2030-01-01';

  it('resolves FS/SS/FF/SF constraints with lag against the predecessor', () => {
    const tasks = [
      makeTask({ id: 'A', wbs: '1.1', duration: 10, manualStart: projectStart }),
      makeTask({ id: 'B', wbs: '1.2', duration: 5, dependsOn: 'A', depType: 'FS', lag: 2 }),
      makeTask({ id: 'C', wbs: '1.3', duration: 4, dependsOn: 'A', depType: 'SS', lag: 3 }),
      makeTask({ id: 'D', wbs: '1.4', duration: 4, dependsOn: 'A', depType: 'FF', lag: 1 }),
      makeTask({ id: 'E', wbs: '1.5', duration: 4, dependsOn: 'A', depType: 'SF', lag: 6 }),
    ];
    const t = byId(GanttEngine.calculate(tasks, projectStart));

    // A: 2030-01-01 + 10d
    assert.equal(t.get('A').startDate, '2030-01-01');
    assert.equal(t.get('A').endDate, '2030-01-11');

    // FS + 2: start = predecessor end + lag
    assert.equal(t.get('B').startDate, '2030-01-13');
    assert.equal(t.get('B').endDate, '2030-01-18');

    // SS + 3: start = predecessor start + lag
    assert.equal(t.get('C').startDate, '2030-01-04');
    assert.equal(t.get('C').endDate, '2030-01-08');

    // FF + 1: end = predecessor end + lag, start = end - duration
    assert.equal(t.get('D').endDate, '2030-01-12');
    assert.equal(t.get('D').startDate, '2030-01-08');

    // SF + 6: end = predecessor START + lag, start = end - duration
    assert.equal(t.get('E').endDate, '2030-01-07');
    assert.equal(t.get('E').startDate, '2030-01-03');
  });

  it('anchors dependency-free tasks at the project start and honours manualStart', () => {
    const tasks = [
      makeTask({ id: 'free', wbs: '1.1', duration: 3 }),
      makeTask({ id: 'manual', wbs: '1.2', duration: 3, manualStart: '2030-03-15' }),
    ];
    const t = byId(GanttEngine.calculate(tasks, '2030-01-01'));
    assert.equal(t.get('free').startDate, '2030-01-01');
    assert.equal(t.get('manual').startDate, '2030-03-15');
    assert.equal(t.get('manual').endDate, '2030-03-18');
  });

  it('falls back to today when the project start date is invalid', () => {
    // The fallback uses formatDate(new Date()) → toISOString() → UTC date.
    const expectedUtcToday = new Date().toISOString().split('T')[0];
    const t = byId(GanttEngine.calculate([makeTask({ id: 'a', wbs: '1.1' })], 'not-a-date'));
    assert.equal(t.get('a').startDate, expectedUtcToday);
  });

  it('rolls groups up: cost, actual cost, progress and date envelope', () => {
    const tasks = [
      makeTask({ id: 'G', wbs: '1', name: 'مجموعة', isGroup: true }),
      makeTask({ id: 'L1', wbs: '1.1', quantity: 10, unitPrice: 100, duration: 5, manualStart: '2030-01-01', actualQuantity: 5 }),
      makeTask({ id: 'L2', wbs: '1.2', quantity: 4, unitPrice: 250, duration: 10, dependsOn: 'L1', depType: 'FS', lag: 0 }),
    ];
    const result = GanttEngine.calculate(tasks, '2030-01-01');
    const g = byId(result).get('G');

    assert.equal(g.totalCost, 1000 + 1000); // 10*100 + 4*250
    assert.equal(g.actualCost, 500); // only L1 has actuals: 5*100
    assert.equal(g.progress, 0.25); // 500 / 2000
    assert.equal(g.startDate, '2030-01-01'); // min of descendants
    assert.equal(g.endDate, '2030-01-16'); // L1 ends 01-06, L2 runs 01-06..01-16
    assert.equal(g.duration, 15);
    assert.equal(result.projectTotalCost, 2000);
    assert.equal(result.scheduleStartDate, '2030-01-01');
    assert.equal(result.scheduleEndDate, '2030-01-16');
    assert.equal(result.projectDuration, 15);
  });

  it('computes leaf cost weight and weighted progress', () => {
    const tasks = [
      makeTask({ id: 'w1', wbs: '1.1', quantity: 10, unitPrice: 100, actualQuantity: 5 }),
      makeTask({ id: 'w2', wbs: '1.2', quantity: 8, unitPrice: 125, actualQuantity: 4 }),
    ];
    const result = GanttEngine.calculate(tasks, '2030-01-01');
    const t = byId(result);

    assert.equal(t.get('w1').weight, 0.5);
    assert.equal(t.get('w2').weight, 0.5);
    assert.equal(t.get('w1').weightedProgress, 0.25);
    assert.equal(result.projectTotalProgress, 50); // (500+500)/2000 * 100
  });

  it('flags leaves from the CPM backward pass (isCritical / totalFloat)', () => {
    const tasks = [
      makeTask({ id: 'c1', wbs: '1.1', duration: 5, manualStart: '2030-01-01' }),
      makeTask({ id: 'c2', wbs: '1.2', duration: 4, dependsOn: 'c1', depType: 'FS', lag: 0 }),
      makeTask({ id: 'c3', wbs: '1.3', duration: 3, dependsOn: 'c2', depType: 'FS', lag: 0 }),
    ];
    const t = byId(GanttEngine.calculate(tasks, '2030-01-01'));
    for (const id of ['c1', 'c2', 'c3']) {
      assert.equal(t.get(id).isCritical, true, `${id} should be critical`);
      assert.equal(t.get(id).totalFloat, 0, `${id} should have zero float`);
    }
  });
});

describe('GanttEngine.calculate progress and order-driven actuals', () => {
  it('clamps progress to 1 and warns when actual exceeds planned quantity', () => {
    const result = GanttEngine.calculate(
      [makeTask({ id: 'over', wbs: '1.1', quantity: 5, actualQuantity: 10 })],
      '2030-01-01',
    );
    const task = byId(result).get('over');
    assert.equal(task.progress, 1); // clamped, not 2
    assert.ok(result.warnings.some((w) => w.message.includes('أكبر من الكمية المخططة')));
    assert.ok(result.warnings.some((w) => w.taskId === 'over'));
  });

  it('derives actualQty from APPROVED VALUE orders, ignoring the manual field', () => {
    const tasks = [
      makeTask({ id: 't1', wbs: '1.1', quantity: 100, unitPrice: 50, actualQuantity: 3 }),
      makeTask({ id: 't2', wbs: '1.2', quantity: 40, unitPrice: 10, actualQuantity: 7 }),
      makeTask({ id: 't3', wbs: '1.3', quantity: 40, unitPrice: 10 }),
    ];
    const orders = [
      { family: 'value', status: 'approved', tier: 'formal', taskId: 't1', quantity: 30 },
      { family: 'value', status: 'approved', tier: 'quick', taskId: 't1', quantity: 20 },
      { family: 'value', status: 'recorded', tier: 'formal', taskId: 't1', quantity: 40 }, // not approved yet
      { family: 'expense', status: 'approved', taskId: 't1', amount: 500 }, // wrong family
      { family: 'value', status: 'approved', tier: 'quick', quantity: 9 }, // no taskId
    ];
    const t = byId(GanttEngine.calculate(tasks, '2030-01-01', undefined, orders));

    assert.equal(t.get('t1').actualQty, 50); // 30 formal + 20 quick, manual 3 ignored
    assert.equal(t.get('t1').progress, 0.5);
    assert.equal(t.get('t1').actualCost, 2500);
    assert.deepEqual(t.get('t1').orderSource, {
      manual: false,
      formalQty: 30,
      quickQty: 20,
      orderCount: 2,
    });
  });

  it('falls back to the legacy manual actualQuantity when a task has no orders', () => {
    const tasks = [
      makeTask({ id: 'legacy', wbs: '1.1', quantity: 40, unitPrice: 10, actualQuantity: 7 }),
      makeTask({ id: 'clean', wbs: '1.2', quantity: 40, unitPrice: 10 }),
    ];
    const t = byId(GanttEngine.calculate(tasks, '2030-01-01', undefined, []));

    assert.equal(t.get('legacy').actualQty, 7);
    assert.deepEqual(t.get('legacy').orderSource, { manual: true });
    assert.equal(t.get('clean').actualQty, 0);
    assert.equal(t.get('clean').orderSource, null);
  });

  it('exposes exec/scope variance against the signed baseline quantities', () => {
    const tasks = [makeTask({ id: 'v1', wbs: '1.1', quantity: 12, actualQuantity: 10 })];
    const meta = { baseline: { tasks: { v1: { quantity: 15 } } } };
    const t = byId(GanttEngine.calculate(tasks, '2030-01-01', meta));
    assert.equal(t.get('v1').baselineQty, 15);
    assert.equal(t.get('v1').scopeVariance, -3); // 12 - 15
    assert.equal(t.get('v1').execVariance, -2); // 10 - 12
  });
});

describe('GanttEngine.calculate warnings', () => {
  it('warns about duplicate WBS, missing predecessors and self-links', () => {
    const tasks = [
      makeTask({ id: 'd1', wbs: '1.1' }),
      makeTask({ id: 'd2', wbs: '1.1' }),
      makeTask({ id: 'ghost', wbs: '1.2', dependsOn: 'missing' }),
      makeTask({ id: 'self', wbs: '1.3', dependsOn: 'self', depType: 'FS' }),
    ];
    const result = GanttEngine.calculate(tasks, '2030-01-01');
    const messages = result.warnings.map((w) => w.message);

    assert.ok(messages.some((m) => m.includes('WBS مكرر') && m.includes('1.1')));
    assert.ok(messages.some((m) => m.includes('الفقرة السابقة غير موجودة (missing)')));
    assert.ok(messages.some((m) => m.includes('لا يمكن ربط الفقرة بنفسها')));
  });

  it('coerces an invalid dependency type to FS with a warning', () => {
    const tasks = [
      makeTask({ id: 'a', wbs: '1.1' }),
      makeTask({ id: 'b', wbs: '1.2', dependsOn: 'a', depType: 'XX' }),
    ];
    const result = GanttEngine.calculate(tasks, '2030-01-01');
    const t = byId(result).get('b');

    assert.equal(t.depType, 'FS');
    assert.equal(t.startDate, '2030-01-06'); // FS resolution after A ends
    assert.ok(result.warnings.some((w) => w.message.includes('تم اعتماد FS')));
  });

  it('detects dependency cycles without throwing and still produces dates', () => {
    const tasks = [
      makeTask({ id: 'x', wbs: '1.1', duration: 5, dependsOn: 'y', depType: 'FS' }),
      makeTask({ id: 'y', wbs: '1.2', duration: 5, dependsOn: 'x', depType: 'FS' }),
    ];
    let result;
    assert.doesNotThrow(() => {
      result = GanttEngine.calculate(tasks, '2030-01-01');
    });
    assert.ok(result.warnings.some((w) => w.message.includes('دورة')));
    // Cycle detection cuts the recursion, then resolution CONTINUES with the
    // partially resolved dates: y follows x's baseline end (01-06), and x then
    // follows y's resolved end (01-11). Deterministic but "poisoned" dates.
    const t = byId(result);
    assert.equal(t.get('y').startDate, '2030-01-06');
    assert.equal(t.get('x').startDate, '2030-01-11');
  });
});

describe('GanttEngine EVM roll-up', () => {
  it('computes BAC/PV/EV/AC/SPI/CPI/EAC/VAC for a fully past schedule', () => {
    // Windows entirely in the past ⇒ plannedProgress 1 ⇒ PV === BAC (deterministic).
    const tasks = [
      // over-executed: progress clamps to 1 (EV 1000) but AC 1500
      makeTask({ id: 'p1', wbs: '1.1', quantity: 10, unitPrice: 100, actualQuantity: 15, duration: 5, manualStart: '2020-01-01' }),
      // half executed: EV 500, AC 500
      makeTask({ id: 'p2', wbs: '1.2', quantity: 4, unitPrice: 250, actualQuantity: 2, duration: 5, manualStart: '2020-02-01' }),
    ];
    const { evm } = GanttEngine.calculate(tasks, '2020-01-01');

    assert.equal(evm.bac, 2000);
    assert.equal(evm.pv, 2000);
    assert.equal(evm.ev, 1500);
    assert.equal(evm.ac, 2000);
    assert.equal(evm.spi, 0.75);
    assert.equal(evm.cpi, 0.75);
    assert.ok(Math.abs(evm.eac - 2000 / 0.75) < 1e-9); // BAC / CPI
    assert.ok(Math.abs(evm.vac - (2000 - 2000 / 0.75)) < 1e-9); // BAC - EAC
  });

  it('returns zero PV/SPI for a schedule entirely in the future', () => {
    const tasks = [
      makeTask({ id: 'f1', wbs: '1.1', quantity: 10, unitPrice: 100, actualQuantity: 5, manualStart: '2999-01-01', duration: 5 }),
      makeTask({ id: 'f2', wbs: '1.2', quantity: 4, unitPrice: 250, actualQuantity: 1, manualStart: '2999-02-01', duration: 5 }),
    ];
    const result = GanttEngine.calculate(tasks, '2999-01-01');

    const t = byId(result);
    assert.equal(t.get('f1').plannedProgress, 0);
    assert.equal(t.get('f1').plannedCost, 0);
    assert.equal(result.projectPlannedProgress, 0);
    assert.equal(result.evm.pv, 0);
    assert.equal(result.evm.spi, 0); // guard: pv === 0
    assert.equal(result.evm.ev, 750);
    assert.equal(result.evm.ac, 750);
    assert.equal(result.evm.cpi, 1);
    assert.equal(result.evm.eac, 2000); // cpi === 1
    assert.equal(result.evm.vac, 0);
  });
});

describe('GanttEngine s-curve', () => {
  it('builds a monotonic curve that starts at 0 PV and terminates at BAC on the schedule end', () => {
    const tasks = [
      makeTask({ id: 'L1', wbs: '1.1', quantity: 10, unitPrice: 100, duration: 5, manualStart: '2030-01-01' }),
      makeTask({ id: 'L2', wbs: '1.2', quantity: 4, unitPrice: 250, duration: 10, dependsOn: 'L1', depType: 'FS', lag: 0 }),
    ];
    const result = GanttEngine.calculate(tasks, '2030-01-01');
    const { sCurve, evm } = result;

    assert.ok(sCurve.length >= 2);
    for (const point of sCurve) {
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(point.date));
      assert.equal(typeof point.pv, 'number');
      assert.equal(typeof point.ev, 'number');
      assert.equal(typeof point.ac, 'number');
      assert.equal(typeof point.isFuture, 'boolean');
    }
    assert.ok(sCurve[0].date <= sCurve[sCurve.length - 1].date);
    assert.equal(sCurve[0].pv, 0); // nothing planned before the schedule starts
    assert.equal(sCurve[sCurve.length - 1].date, result.scheduleEndDate);
    assert.equal(sCurve[sCurve.length - 1].pv, evm.bac); // full budget planned by the end

    for (let i = 1; i < sCurve.length; i += 1) {
      assert.ok(sCurve[i].pv >= sCurve[i - 1].pv - 1e-9, 'PV must be non-decreasing');
      assert.ok(sCurve[i].ev >= sCurve[i - 1].ev - 1e-9, 'EV must be non-decreasing');
      assert.ok(sCurve[i].ac >= sCurve[i - 1].ac - 1e-9, 'AC must be non-decreasing');
    }
  });

  it('returns an empty curve without leaves or schedule window', () => {
    assert.deepEqual(buildSCurve([], '2030-01-01', '2030-01-10'), []);
    const leaf = { startDate: '2030-01-01', endDate: '2030-01-05', totalCost: 100, progress: 0, actualCost: 0 };
    assert.deepEqual(buildSCurve([leaf], null, '2030-01-10'), []);
    assert.deepEqual(buildSCurve([leaf], '2030-01-10', '2030-01-01'), []); // end before start
  });
});

describe('GanttEngine per-WBS EVM and expenses', () => {
  it('rolls EVM up per top-level WBS group and drops unpriced groups', () => {
    const tasks = [
      makeTask({ id: 'G1', wbs: '1', name: 'أعمال', isGroup: true }),
      makeTask({ id: 'a', wbs: '1.1', quantity: 10, unitPrice: 100, actualQuantity: 5, manualStart: '2020-01-01', duration: 5 }),
      makeTask({ id: 'G2', wbs: '2', name: 'مجاناً', isGroup: true }),
      makeTask({ id: 'b', wbs: '2.1', quantity: 5, unitPrice: 0, manualStart: '2020-03-01', duration: 5 }),
    ];
    const result = GanttEngine.calculate(tasks, '2020-01-01');

    assert.equal(result.perWbsEvm.length, 1); // group 2 has BAC === 0 → filtered
    const row = result.perWbsEvm[0];
    assert.equal(row.wbs, '1');
    assert.equal(row.name, 'أعمال');
    assert.equal(row.taskCount, 1);
    assert.equal(row.bac, 1000);
    assert.equal(row.pv, 1000); // past schedule
    assert.equal(row.ev, 500);
    assert.equal(row.ac, 500);
    assert.equal(row.spi, 0.5);
    assert.equal(row.cpi, 1);
  });

  it('passes the expense-order summary through from the order ledger', () => {
    const orders = [
      { family: 'expense', status: 'approved', date: '2030-01-05', amount: 250, category: 'وقود' },
      { family: 'expense', status: 'approved', date: '2030-01-06', amount: 100, type: 'material' },
      { family: 'value', status: 'approved', date: '2030-01-06', taskId: 't', quantity: 5 },
    ];
    const result = GanttEngine.calculate([makeTask({ id: 't', wbs: '1.1' })], '2030-01-01', undefined, orders);

    assert.equal(result.expenses.total, 350);
    assert.equal(result.expenses.byCategory['وقود'], 250);
    assert.equal(result.expenses.byCategory['شراء مواد'], 100); // ORDER_TYPES.material label fallback
  });
});

// Differential tests: the upgraded GanttEngine / CriticalPath must compute
// legacy data (one predecessor per task, no calendar) EXACTLY as the engine
// did before the planning upgrade (frozen copies in fixtures/). Every field
// the old engine produced is compared with deepStrictEqual (so -0 vs 0,
// warning order and cycle texts count), over hundreds of seeded random
// networks plus the real canal seed and the seeded building templates.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment } from './helpers.js';

installNodeTestEnvironment();

const { GanttEngine } = await import('../GanttEngine.js');
const { computeCriticalPath } = await import('../CriticalPath.js');
const { GanttEngine: LegacyEngine } = await import('./fixtures/legacyGanttEngine.js');
const { computeCriticalPath: legacyCriticalPath } = await import('./fixtures/legacyCriticalPath.js');
const { INITIAL_TASKS } = await import('../../state/projectModel.js');
const { LEGACY_SEED_TEMPLATES, generateProject } = await import('../TemplateEngine.js');

// Small deterministic PRNG (mulberry32).
const rng = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = (r, list) => list[Math.floor(r() * list.length)];
const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const dateFrom = (base, days) => {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** A random task tree with every kind of link (and mistake) the old engine handled. */
const randomNetwork = (seed) => {
  const r = rng(seed);
  const tasks = [];
  const sections = int(r, 1, 4);
  let n = 0;
  for (let s = 1; s <= sections; s++) {
    tasks.push({ id: `g${s}`, wbs: String(s), name: `S${s}`, isGroup: true, duration: int(r, 0, 5), quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0, manualStart: r() < 0.3 ? dateFrom('2030-01-01', int(r, -20, 40)) : null });
    const subs = int(r, 0, 2);
    const parents = [String(s)];
    for (let k = 1; k <= subs; k++) {
      tasks.push({ id: `g${s}.${k}`, wbs: `${s}.${k}`, name: `SS${s}.${k}`, isGroup: true, duration: 1, quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0 });
      parents.push(`${s}.${k}`);
    }
    const leaves = int(r, 1, 8);
    const counters = new Map();
    for (let k = 0; k < leaves; k++) {
      const parent = pick(r, parents);
      const c = (counters.get(parent) || (parent.includes('.') ? 0 : subs)) + 1;
      counters.set(parent, c);
      n += 1;
      const qty = r() < 0.1 ? 0 : int(r, 1, 500);
      tasks.push({
        id: `t${n}`,
        wbs: r() < 0.03 && tasks.length > 2 ? tasks[tasks.length - 1].wbs : `${parent}.${c}`,
        name: `T${n}`,
        isGroup: false,
        duration: r() < 0.05 ? 0 : r() < 0.05 ? String(int(r, 1, 9)) : int(r, 1, 30),
        quantity: qty,
        actualQuantity: r() < 0.3 ? int(r, 0, 600) : 0,
        unitPrice: int(r, 0, 50000),
        unit: 'م3',
        dependsOn: null,
        depType: '',
        lag: 0,
        manualStart: r() < 0.4 ? dateFrom('2030-01-01', int(r, -30, 90)) : r() < 0.05 ? 'not-a-date' : null,
      });
    }
  }
  // Links: mostly backwards, some forwards (cycles), missing, self, groups.
  tasks.forEach((t) => {
    if (r() < 0.35) return;
    const roll = r();
    let target;
    if (roll < 0.05) target = 'missing-id';
    else if (roll < 0.08) target = t.id;
    else if (roll < 0.2) target = pick(r, tasks).id; // anywhere: forward links make cycles
    else {
      const idx = tasks.indexOf(t);
      target = idx > 0 ? tasks[int(r, 0, idx - 1)].id : null;
    }
    if (!target) return;
    t.dependsOn = target;
    t.depType = r() < 0.06 ? pick(r, ['', 'XX', 'fs']) : pick(r, ['FS', 'SS', 'FF', 'SF']);
    t.lag = r() < 0.05 ? String(int(r, -5, 5)) : int(r, -10, 10);
  });
  return tasks;
};

const randomOrders = (tasks, seed) => {
  const r = rng(seed * 7 + 1);
  const leaves = tasks.filter((t) => !t.isGroup);
  const orders = [];
  leaves.forEach((t) => {
    if (r() < 0.6) return;
    orders.push({ id: `o-${t.id}`, type: 'quick_work', family: 'value', tier: 'quick', status: 'approved', taskId: t.id, quantity: int(r, 1, 300), date: '2030-02-01' });
  });
  orders.push({ id: 'exp', type: 'fuel', family: 'expense', tier: 'quick', status: 'approved', amount: 12345, date: '2030-02-01' });
  return orders;
};

/** Compare every key the legacy engine produced. */
const assertSameResult = (actual, expected, label) => {
  assert.equal(actual.tasks.length, expected.tasks.length, `${label}: task count`);
  expected.tasks.forEach((legacyTask, i) => {
    const task = actual.tasks[i];
    Object.keys(legacyTask).forEach((key) => {
      assert.deepStrictEqual(task[key], legacyTask[key], `${label}: task ${legacyTask.id} field ${key}`);
    });
  });
  Object.keys(expected)
    .filter((key) => key !== 'tasks')
    .forEach((key) => {
      assert.deepStrictEqual(actual[key], expected[key], `${label}: result.${key}`);
    });
};

const bothEngines = (tasks, start, meta, orders) => {
  // Each engine gets its own deep copy (the engines must not see each other's mutations).
  const copy = () => JSON.parse(JSON.stringify(tasks));
  return [GanttEngine.calculate(copy(), start, meta, orders), LegacyEngine.calculate(copy(), start, meta, orders)];
};

describe('engine parity with the pre-upgrade engine', () => {
  it('500 random networks compute identically (dates, float, warnings, costs, EVM, S-curve)', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const tasks = randomNetwork(seed);
      const orders = seed % 3 === 0 ? randomOrders(tasks, seed) : [];
      const meta = seed % 5 === 0 ? { status: 'signed', baseline: { tasks: {} }, variations: [] } : undefined;
      const start = seed % 11 === 0 ? 'bad-date' : '2030-01-01';
      if (start === 'bad-date') continue; // the fallback start is "today" — compared below with a fixed start only
      const [actual, expected] = bothEngines(tasks, start, meta, orders);
      assertSameResult(actual, expected, `seed ${seed}`);
    }
  });

  it('networks without any cycle also match (reverse topological backward pass)', () => {
    for (let seed = 1000; seed < 1100; seed++) {
      const tasks = randomNetwork(seed).map((t, i, all) => {
        // keep only backward links → acyclic
        const idx = all.findIndex((x) => x.id === t.dependsOn);
        return idx >= 0 && idx < i ? t : { ...t, dependsOn: null, depType: '', lag: 0 };
      });
      const [actual, expected] = bothEngines(tasks, '2030-01-01', undefined, []);
      assertSameResult(actual, expected, `acyclic seed ${seed}`);
    }
  });

  it('the canal seed (INITIAL_TASKS) computes identically', () => {
    const [actual, expected] = bothEngines(INITIAL_TASKS, '2025-08-02', { status: 'draft', baseline: null, variations: [] }, []);
    assertSameResult(actual, expected, 'INITIAL_TASKS');
  });

  it('seeded building templates at 1, 2 and 5 floors compute identically', () => {
    localStorage.clear();
    LEGACY_SEED_TEMPLATES.map((factory) => factory()).forEach((template) => {
      [1, 2, 5].forEach((floors) => {
        const values = Object.fromEntries((template.variables || []).map((v) => [v.key, v.key === 'floors' ? floors : v.default]));
        const { tasks } = generateProject(template, values, { startDate: '2030-03-01' });
        const [actual, expected] = bothEngines(tasks, '2030-03-01', undefined, []);
        assertSameResult(actual, expected, `${template.name} × ${floors}`);
      });
    });
  });

  it('computeCriticalPath called on its own (no timing) matches the old pass', () => {
    for (let seed = 2000; seed < 2100; seed++) {
      const computed = LegacyEngine.calculate(randomNetwork(seed), '2030-01-01').tasks;
      const a = computeCriticalPath(computed);
      const b = legacyCriticalPath(computed);
      assert.deepStrictEqual([...a.criticalIds].sort(), [...b.criticalIds].sort(), `seed ${seed} critical`);
      assert.deepStrictEqual([...a.floatById.entries()], [...b.floatById.entries()], `seed ${seed} float`);
    }
  });
});

describe('engine robustness', () => {
  it('a 5000-task FS chain resolves without a stack overflow', () => {
    const tasks = Array.from({ length: 5000 }, (_, i) => ({
      id: `c${i}`,
      wbs: `1.${i + 1}`,
      name: `C${i}`,
      isGroup: false,
      duration: 1,
      quantity: 1,
      actualQuantity: 0,
      unitPrice: 1,
      unit: '',
      dependsOn: i > 0 ? `c${i - 1}` : null,
      depType: i > 0 ? 'FS' : '',
      lag: 0,
    }));
    const result = GanttEngine.calculate(tasks, '2030-01-01');
    assert.equal(result.tasks[4999].startDate, '2043-09-09'); // 4999 days after the start
    assert.equal(result.tasks[4999].isCritical, true);
  });

  it('1500 tasks compute quickly', () => {
    const tasks = randomNetwork(42);
    const big = [];
    for (let copy = 0; copy < 60 && big.length < 1500; copy++) {
      tasks.forEach((t) => big.push({ ...t, id: `${copy}-${t.id}`, wbs: `${copy + 1}${t.wbs.slice(t.wbs.indexOf('.') === -1 ? t.wbs.length : t.wbs.indexOf('.'))}`, dependsOn: t.dependsOn ? `${copy}-${t.dependsOn}` : null }));
    }
    GanttEngine.calculate(big, '2030-01-01'); // warm-up
    const t0 = performance.now();
    GanttEngine.calculate(big, '2030-01-01');
    const ms = performance.now() - t0;
    assert.ok(ms < 250, `calculate took ${ms.toFixed(1)} ms for ${big.length} tasks`);
  });
});

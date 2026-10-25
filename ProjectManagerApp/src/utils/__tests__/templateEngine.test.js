// Unit tests for src/utils/TemplateEngine.js (node:test).
//
// generateProject() is exercised through the `rateLibrary` option so it stays
// pure (no localStorage fallback is ever hit).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment } from './helpers.js';

installNodeTestEnvironment();

// Dynamic import: TemplateEngine.js imports './RateLibrary' without a '.js'
// extension, which only resolves after the hook above is registered.
const { evaluateFormula, generateProject, makeTemplateFromTasks, PARTS } = await import('../TemplateEngine.js');

const byWbs = (tasks) => new Map(tasks.map((t) => [t.wbs, t]));

describe('evaluateFormula', () => {
  it('evaluates arithmetic over variables', () => {
    assert.equal(evaluateFormula('floors*area*0.34', { floors: 5, area: 100 }), 170);
    assert.equal(evaluateFormula('1000/400+6', {}), 8.5);
    assert.equal(evaluateFormula('area*2.55*2*0.95', { area: 100 }), 484.5);
  });

  it('rounds to two decimals and returns 0 for null/empty/error input', () => {
    assert.equal(evaluateFormula('10/3', {}), 3.33);
    assert.equal(evaluateFormula(null, {}), 0);
    assert.equal(evaluateFormula('', {}), 0);
    assert.equal(evaluateFormula('   ', {}), 0);
    assert.equal(evaluateFormula('1/0', {}), 0); // Infinity is not finite
  });

  it('allows whitelisted Math helpers', () => {
    assert.equal(evaluateFormula('Math.ceil(area/3)', { area: 100 }), 34);
    assert.equal(evaluateFormula('Math.floor(12.9)', {}), 12);
    assert.equal(evaluateFormula('Math.sqrt(144)', {}), 12);
    assert.equal(evaluateFormula('Math.min(3, 9)', {}), 3);
  });

  it('rejects identifiers outside the whitelist (sandbox)', () => {
    assert.equal(evaluateFormula('process.exit(1)', {}), 0);
    assert.equal(evaluateFormula('import(x)', {}), 0);
    assert.equal(evaluateFormula('alert(1)', {}), 0);
    assert.equal(evaluateFormula('bogus*2', { floors: 2 }), 0); // unknown variable
    assert.equal(evaluateFormula('2#3', {}), 0); // illegal character
  });

  it('returns 0 for non-positive results (quantities cannot be negative)', () => {
    assert.equal(evaluateFormula('1-5', {}), 0);
    assert.equal(evaluateFormula('0*5', { floors: 1 }), 0);
  });
});

describe('PARTS catalog', () => {
  it('is a non-empty list of unique parts with productivity and rate names', () => {
    assert.ok(Array.isArray(PARTS));
    assert.ok(PARTS.length > 0);
    const ids = new Set(PARTS.map((p) => p.id));
    assert.equal(ids.size, PARTS.length);
    for (const part of PARTS) {
      assert.equal(typeof part.name, 'string');
      assert.equal(typeof part.rateName, 'string');
      assert.ok(Number(part.productivity) > 0);
    }
    assert.ok(PARTS.some((p) => p.id === 'col-beams'));
    assert.ok(PARTS.some((p) => p.id === 'solid-slab'));
    assert.ok(PARTS.some((p) => p.id === 'waterproofing'));
  });
});

describe('generateProject', () => {
  const rateLibrary = [
    { id: 'r1', name: 'خرسانة الهياكل C30', unit: 'م3', unitPrice: 210000, category: 'خرسانة' },
    { id: 'r2', name: 'عزل مائي', unit: 'م2', unitPrice: 12000, category: 'عزل' },
  ];

  // Minimal inline template: a per-floor structure section + a fixed roof item.
  const template = {
    variables: [
      { key: 'floors', label: 'عدد الطوابق', default: 3 },
      { key: 'area', label: 'المساحة', default: 100 },
    ],
    elements: [
      /* 0 */ { partId: 'col-beams', qtyFormula: 'area*0.06', group: 'الهيكل', repeatsVar: 'floors', depOn: null, depType: '', lag: 0 },
      /* 1 */ { partId: 'solid-slab', qtyFormula: 'area*0.34', group: 'الهيكل', repeatsVar: 'floors', depOn: 0, depType: 'FS', lag: 0 },
      /* 2 */ { partId: 'waterproofing', qtyFormula: 'area', group: 'العزل', repeatsVar: null, depOn: '1@last', depType: 'FS', lag: 3 },
    ],
  };

  const generate = (values, options = {}) =>
    generateProject(template, values, { startDate: '2030-01-01', rateLibrary, ...options });

  it('builds the WBS hierarchy: repeating sections, per-copy leaves, fixed tail', () => {
    const { tasks, stats } = generate({ floors: 2, area: 100 });
    const w = byWbs(tasks);

    assert.equal(stats.taskCount, 8);
    assert.equal(stats.groupCount, 3);
    assert.equal(stats.leafCount, 5);

    assert.equal(w.get('1').name, 'الهيكل - الطابق 1');
    assert.equal(w.get('1').isGroup, true);
    assert.equal(w.get('2').name, 'الهيكل - الطابق 2');
    assert.equal(w.get('3').name, 'العزل'); // non-repeating section: no suffix
    assert.equal(w.get('1.1').name, 'جوائز وأعمدة - الطابق 1');
    assert.equal(w.get('1.2').name, 'سقف سوليد - الطابق 1');
    assert.equal(w.get('2.2').name, 'سقف سوليد - الطابق 2');
    assert.equal(w.get('3.1').name, 'عزل مائي'); // fixed element: no suffix
    assert.equal(w.get('3.1').isGroup, false);
  });

  it('uses variable defaults when no values are passed', () => {
    const { tasks } = generate(); // floors defaults to 3
    assert.equal(byWbs(tasks).get('3').name, 'الهيكل - الطابق 3'); // 3 floor copies + roof section
    assert.equal(tasks.filter((t) => t.isGroup).length, 4);
  });

  it('computes quantities, units, prices and stats totals from the rate library', () => {
    const { tasks, stats } = generate({ floors: 2, area: 100 });
    const w = byWbs(tasks);

    const col1 = w.get('1.1');
    assert.equal(col1.quantity, 6); // 100 * 0.06
    assert.equal(col1.unit, 'م3');
    assert.equal(col1.unitPrice, 210000); // خرسانة الهياكل C30

    const slab1 = w.get('1.2');
    assert.equal(slab1.quantity, 34); // 100 * 0.34
    assert.equal(slab1.unitPrice, 210000);

    const roof = w.get('3.1');
    assert.equal(roof.quantity, 100);
    assert.equal(roof.unit, 'م2');
    assert.equal(roof.unitPrice, 12000); // عزل مائي

    assert.equal(stats.pricedCount, 5);
    assert.deepEqual(stats.unpriced, []);
    assert.equal(stats.totalCost, 2 * (6 + 34) * 210000 + 100 * 12000);
  });

  it('clamps productivity durations to [1, 365] days', () => {
    const bigTemplate = {
      variables: [{ key: 'area', label: 'مساحة', default: 100 }],
      elements: [
        { name: 'ضخم', qtyFormula: 'area*area', productivity: 10, group: 'عام', repeatsVar: null, depOn: null, depType: '', lag: 0 }, // 10000/10 = 1000 → 365
        { name: 'صفري', qtyFormula: '0', productivity: 5, group: 'عام', repeatsVar: null, depOn: null, depType: '', lag: 0 }, // qty 0 → 1
        { name: 'كسري', qtyFormula: '10.5', productivity: 3, group: 'عام', repeatsVar: null, depOn: null, depType: '', lag: 0 }, // ceil(3.5) = 4
      ],
    };
    const { tasks } = generateProject(bigTemplate, {}, { startDate: '2030-01-01', rateLibrary: [] });
    const w = byWbs(tasks);

    assert.equal(w.get('1.1').duration, 365);
    assert.equal(w.get('1.2').duration, 1);
    assert.equal(w.get('1.3').duration, 4);
    // The catalog productivity applies when the element has none:
    // (col-beams productivity 30, qty 6 → ceil(0.2) = 1; slab 30, qty 34 → ceil(1.13) = 2)
    const { tasks: t2 } = generate({ floors: 1, area: 100 });
    assert.equal(byWbs(t2).get('1.1').duration, 1);
    assert.equal(byWbs(t2).get('1.2').duration, 2);
  });

  it('snapshots prices copy-on-generate: later library edits never touch generated tasks', () => {
    const first = generate({ floors: 1, area: 100 });
    const priceBefore = byWbs(first.tasks).get('1.1').unitPrice;

    rateLibrary[0].unitPrice = 1; // simulate a library price edit after generation
    assert.equal(byWbs(first.tasks).get('1.1').unitPrice, priceBefore); // unchanged

    // Regenerating DOES pick up the new price (snapshot happens at generate time).
    const second = generate({ floors: 1, area: 100 });
    assert.equal(byWbs(second.tasks).get('1.1').unitPrice, 1);
    rateLibrary[0].unitPrice = 210000; // restore for other tests
  });

  it('wires dependencies to existing ids: same-floor FS, roof @last, floor self-chain', () => {
    const { tasks } = generate({ floors: 2, area: 100 });
    const w = byWbs(tasks);
    const ids = new Set(tasks.map((t) => t.id));

    const col1 = w.get('1.1');
    const slab1 = w.get('1.2');
    const col2 = w.get('2.1');
    const slab2 = w.get('2.2');
    const roof = w.get('3.1');

    // Repeating element with depOn → same-copy target (floor 2 slab after floor 2 columns).
    assert.equal(slab1.dependsOn, col1.id);
    assert.equal(slab1.depType, 'FS');
    assert.equal(slab1.lag, 0);
    assert.equal(slab2.dependsOn, col2.id);

    // Repeating element WITHOUT depOn → chains to its own previous copy, FS + 7.
    assert.equal(col2.dependsOn, col1.id);
    assert.equal(col2.depType, 'FS');
    assert.equal(col2.lag, 7);

    // Non-repeating roof item follows the LAST floor slab ('1@last'), FS + 3.
    assert.equal(roof.dependsOn, slab2.id);
    assert.equal(roof.depType, 'FS');
    assert.equal(roof.lag, 3);

    for (const task of tasks) {
      assert.ok(
        task.dependsOn === null || ids.has(task.dependsOn),
        `${task.wbs} dependsOn must point at a generated task`,
      );
    }
  });

  it('anchors dependency-free leaves at the start date, leaves dependencies unanchored', () => {
    // floors: 1 → a single copy, so the roof section becomes WBS 2.
    const { tasks } = generate({ floors: 1, area: 100 });
    const w = byWbs(tasks);

    assert.equal(w.get('1.1').manualStart, '2030-01-01'); // no dependsOn → anchored
    assert.equal(w.get('1.2').manualStart, null); // driven by its link
    assert.equal(w.get('2.1').manualStart, null); // roof item, linked to '@last' slab
  });

  it('leaves unpriced elements at unitPrice 0 and lists them in stats.unpriced', () => {
    const unpricedTemplate = {
      variables: [],
      elements: [
        { name: 'بند بدون سعر', qtyFormula: '10', group: 'عام', repeatsVar: null, depOn: null, depType: '', lag: 0 },
        { name: 'سعر ثابت', qtyFormula: '4', group: 'عام', fixedUnitPrice: 250, repeatsVar: null, depOn: 0, depType: 'FS', lag: 0 },
      ],
    };
    const { tasks, stats } = generateProject(unpricedTemplate, {}, { startDate: '2030-01-01', rateLibrary: [] });
    const w = byWbs(tasks);

    assert.equal(w.get('1.1').unitPrice, 0); // no part, no rateName, no fixed price
    assert.equal(w.get('1.2').unitPrice, 250); // fixedUnitPrice wins without a library
    assert.equal(stats.pricedCount, 1);
    assert.deepEqual(stats.unpriced, ['بند بدون سعر']);
    assert.equal(stats.totalCost, 4 * 250);
    assert.equal(w.get('1.2').dependsOn, w.get('1.1').id); // index-based depOn resolves
  });

  it('supports a wbsOffset for merging into an existing project', () => {
    const { tasks } = generate({ floors: 1, area: 100 }, { wbsOffset: 5 });
    assert.equal(byWbs(tasks).get('5').name, 'الهيكل'); // single copy → no floor suffix
    assert.ok(byWbs(tasks).has('5.1'));
    assert.ok(byWbs(tasks).has('6.1')); // roof section follows at 6
  });
});

describe('makeTemplateFromTasks', () => {
  it('round-trips a nested task tree: names, quantities, prices, durations, WBS', () => {
    const projectTasks = [
      { id: 'g1', wbs: '1', name: 'أعمال ترابية', isGroup: true, duration: 1 },
      { id: 'g1a', wbs: '1.1', name: 'حفر', isGroup: true, duration: 1 },
      { id: 't1', wbs: '1.1.1', name: 'حفر عام', isGroup: false, quantity: 50, unit: 'م3', unitPrice: 1000, duration: 10 },
      { id: 't2', wbs: '1.1.2', name: 'دفن ترابي', isGroup: false, quantity: 20, unit: 'م3', unitPrice: 500, duration: 5 },
    ];
    const template = makeTemplateFromTasks(projectTasks, 'اختبار');

    assert.equal(template.name, 'اختبار');
    assert.equal(template.source, 'project');
    assert.deepEqual(template.variables, []);
    // Sub-group + two leaves become elements (the top group is the section).
    assert.equal(template.elements.filter((e) => e.isGroup).length, 1);
    assert.equal(template.elements.length, 3);

    const { tasks, stats } = generateProject(template, {}, { rateLibrary: [], startDate: '2030-01-01' });
    const w = byWbs(tasks);

    assert.equal(w.get('1').name, 'أعمال ترابية');
    assert.equal(w.get('1').isGroup, true);
    assert.equal(w.get('1.1').name, 'حفر');
    assert.equal(w.get('1.1').isGroup, true);

    const t1 = w.get('1.1.1');
    assert.equal(t1.name, 'حفر عام');
    assert.equal(t1.quantity, 50);
    assert.equal(t1.unitPrice, 1000); // snapshotted via fixedUnitPrice
    assert.equal(t1.unit, 'م3');
    assert.equal(t1.duration, 10); // productivity derived as 50/10 → ceil(50/5)

    const t2 = w.get('1.1.2');
    assert.equal(t2.quantity, 20);
    assert.equal(t2.unitPrice, 500);
    assert.equal(t2.duration, 5); // productivity 20/5

    assert.equal(stats.leafCount, 2);
    assert.equal(stats.groupCount, 2);
    assert.equal(stats.totalCost, 50 * 1000 + 20 * 500);
  });

  it('handles empty / non-array task input', () => {
    const template = makeTemplateFromTasks([], 'فارغ');
    assert.deepEqual(template.elements, []);
    const { tasks, stats } = generateProject(template, {}, { rateLibrary: [], startDate: '2030-01-01' });
    assert.equal(tasks.length, 0);
    assert.equal(stats.taskCount, 0);
  });
});

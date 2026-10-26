// Unit tests for BOQ import, matching and pouring a BOQ into a building
// template (node:test).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment } from './helpers.js';

installNodeTestEnvironment();

const { parseTable, parseNumber, normalizeUnit, detectHeader, guessColumns, boqLines, readBoq, tableToText, pickBoqSheet } = await import('../planning/BoqImport.js');
const { normalizeText, stem, contentWords, matchLine, matchBoq, confidenceOf, withAlias } = await import('../planning/Matcher.js');
const { applyBoq } = await import('../planning/boqPlan.js');
const { planProject } = await import('../planning/autoPlan.js');
const { buildingTemplateSeeds } = await import('../planning/buildingTemplates.js');
const { seedWorkTypes } = await import('../planning/workTypeSeeds.js');
const { workTypeMap } = await import('../planning/WorkTypes.js');
const { readLinks } = await import('../planning/links.js');
const { DEFAULT_RATES } = await import('../RateLibrary.js');
const { GanttEngine } = await import('../GanttEngine.js');

const workTypes = seedWorkTypes();

// What Excel puts on the clipboard: tab-separated, a quoted multi-line cell,
// Arabic-Indic digits and thousands separators.
const PASTE = [
  'جدول الكميات\t\t\t\t\t',
  'ت\tوصف الفقرة\tالوحدة\tالكمية\tسعر الوحدة\tالمبلغ',
  '\tأولاً / الأعمال الترابية\t\t\t\t',
  '1\tتجهيز المعدات وتنفيذ أعمال الحفريات لأسس البناية\tم٣\t٦٤٠\t5,000\t3,200,000',
  '2\t"أعمال الدفن والحدل بالتربة النظيفة\nعلى طبقات"\tm3\t576\t6000\t3456000',
  '\tثانياً / الهيكل الخرساني\t\t\t\t',
  '3\tخرسانة مسلحة للأعمدة\tم3\t90\t460,000\t41,400,000',
  '4\tخرسانة مسلحة للسقوف والجسور الساقطة\tم3\t600\t430000\t258000000',
  '5\tبناء الجدران الخارجية بالبلوك سمك 20 سم\tمتر مربع\t1200\t14000\t',
  '6\tبناء القواطع الداخلية بالبلوك سمك 15 سم\tم2\t2400\t12000\t',
  '7\tتجهيز ونصب مصعد كهربائي\tعدد\t1\t45000000\t45000000',
  '8\tأعمال متفرقة غير محددة\tمقطوعية\t1\t2000000\t2000000',
].join('\r\n');

describe('BoqImport', () => {
  it('parses Excel clipboard text with quoted multi-line cells', () => {
    const rows = parseTable(PASTE);
    assert.equal(rows.length, 12);
    assert.equal(rows[4][1], 'أعمال الدفن والحدل بالتربة النظيفة على طبقات');
    assert.deepEqual(parseTable('a\t"say ""hi"""\n\n'), [['a', 'say "hi"']]);
  });

  it('reads numbers in Arabic-Indic digits and with separators', () => {
    assert.equal(parseNumber('٦٤٠'), 640);
    assert.equal(parseNumber('5,000'), 5000);
    assert.equal(parseNumber('١٢٫٥'), 12.5);
    assert.equal(parseNumber('41٬400٬000'), 41400000);
    assert.equal(parseNumber(''), null);
    assert.equal(parseNumber('م3'), null);
    assert.equal(parseNumber('150 متر مكعب'), 150);
  });

  it('normalises units', () => {
    assert.equal(normalizeUnit('م٣'), 'م3');
    assert.equal(normalizeUnit('M3'), 'م3');
    assert.equal(normalizeUnit('متر مربع'), 'م2');
    assert.equal(normalizeUnit('م.ط'), 'م.ط');
    assert.equal(normalizeUnit('L.S'), 'مقطوعية');
    assert.equal(normalizeUnit('nos'), 'عدد');
    assert.equal(normalizeUnit('كيس'), 'كيس');
  });

  it('finds the header row and the columns by their names', () => {
    const rows = parseTable(PASTE);
    const header = detectHeader(rows);
    assert.equal(header, 1);
    assert.deepEqual(guessColumns(rows, header), { no: 0, description: 1, unit: 2, qty: 3, rate: 4, amount: 5 });
  });

  it('guesses the columns from the contents when there is no header', () => {
    const rows = parseTable('1\tحفريات أسس\tم3\t100\t5000\n2\tلبخ داخلي للجدران\tم2\t300\t10000');
    assert.equal(detectHeader(rows), -1);
    const cols = guessColumns(rows, -1);
    assert.deepEqual([cols.no, cols.description, cols.unit, cols.qty, cols.rate], [0, 1, 2, 3, 4]);
  });

  it('an .xlsx sheet (cell values) reads like a paste; the BOQ sheet is picked', () => {
    const data = [
      ['ت', 'الوصف', 'الوحدة', 'الكمية', 'السعر'],
      [1, 'خرسانة مسلحة للأعمدة', 'م3', 90, 460000],
      [2, 'نص فيه	تاب و"اقتباس"', 'م2', 10.5, null],
      [null, null, null, null, null],
    ];
    const text = tableToText(data);
    assert.deepEqual(parseTable(text), [['ت', 'الوصف', 'الوحدة', 'الكمية', 'السعر'], ['1', 'خرسانة مسلحة للأعمدة', 'م3', '90', '460000'], ['2', 'نص فيه تاب و"اقتباس"', 'م2', '10.5', '']]);
    assert.equal(readBoq(text).lines.filter((l) => l.kind === 'item').length, 2);
    assert.equal(tableToText([[new Date(Date.UTC(2030, 0, 5)), true]]), '2030-01-05	true');
    assert.equal(pickBoqSheet([{ sheet: 'cover', data: [['عنوان']] }, { sheet: 'BOQ', data }]), 1);
  });

  it('turns rows into section headings and items with WBS, price and amount', () => {
    const { lines } = readBoq(PASTE);
    assert.deepEqual(lines.filter((l) => l.kind === 'section').map((l) => l.wbs), ['1', '2']);
    const items = lines.filter((l) => l.kind === 'item');
    assert.equal(items.length, 8);
    assert.deepEqual(items.slice(0, 3).map((l) => l.wbs), ['1.1', '1.2', '2.1']);
    assert.deepEqual([items[0].unit, items[0].qty, items[0].rate, items[0].amount], ['م3', 640, 5000, 3200000]);
    assert.equal(items[4].amount, 1200 * 14000); // missing amount = qty × rate
    assert.equal(boqLines([['1.2.3', 'x', 'م2', '5']], { no: 0, description: 1, unit: 2, qty: 3, rate: -1, amount: -1 })[0].wbs, '1.2.3');
  });
});

describe('Matcher', () => {
  it('normalises Arabic text and stems lightly', () => {
    assert.equal(normalizeText('الخَرسانةُ المسلّحة – إِسمنت'), 'الخرسانه المسلحه اسمنت');
    assert.equal(stem('بالسيراميك'), 'سيراميك');
    assert.equal(stem('لجسور'), 'جسور');
    assert.equal(stem('خرساني'), 'خرسان');
    assert.deepEqual(contentWords('تجهيز المواد وتنفيذ أعمال الحفريات بموجب المخططات'), ['حفري']);
  });

  it('matches typical Iraqi BOQ lines to the right work type', () => {
    const cases = [
      ['تجهيز المعدات وتنفيذ أعمال الحفريات لأسس البناية', 'م3', 'excavation'],
      ['خرسانة مسلحة لجسور الربط', 'م3', 'tie-beams'],
      ['خرسانة مسلحة للدرج', 'م3', 'stairs'],
      ['بناء القواطع الداخلية بالبلوك سمك 15 سم', 'م2', 'block-internal'],
      ['لبخ الواجهات الخارجية بالسمنت', 'م2', 'plaster-external'],
      ['تبليط الأرضيات بالسيراميك', 'م2', 'tiles'],
      ['تغليف جدران الحمامات والمطابخ بالسيراميك', 'م2', 'wall-tiles'],
      ['عزل السطح ضد الرطوبة بلفائف بيتومينية', 'م2', 'waterproofing'],
      ['تجهيز ونصب المغاسل والمرافق الصحية', 'عدد', 'sanitary'],
    ];
    cases.forEach(([description, unit, want]) => {
      assert.equal(matchLine({ description, unit }, workTypes).best?.workTypeId, want, description);
    });
  });

  it('the unit counts: the same words in another unit lose', () => {
    const asArea = matchLine({ description: 'خرسانة مسلحة للأعمدة', unit: 'م3' }, workTypes).best.score;
    const asCount = matchLine({ description: 'خرسانة مسلحة للأعمدة', unit: 'عدد' }, workTypes).best?.score ?? 0;
    assert.ok(asArea > asCount);
  });

  it('nothing sensible → no match; a remembered alias → exact match', () => {
    const odd = { description: 'أعمال متفرقة غير محددة', unit: 'مقطوعية' };
    assert.equal(matchLine(odd, workTypes).best, null);
    const remembered = workTypes.map((w) => (w.id === 'testing' ? withAlias(w, odd.description) : w));
    const m = matchLine(odd, remembered);
    assert.equal(m.best.workTypeId, 'testing');
    assert.equal(m.best.score, 1);
    assert.equal(confidenceOf(1), 'high');
    assert.equal(withAlias(remembered.find((w) => w.id === 'testing'), odd.description).aliases.length, 1); // not twice
  });

  it('matchBoq covers every item line', () => {
    const { lines } = readBoq(PASTE);
    const matches = matchBoq(lines, workTypes);
    assert.equal(matches.size, 8);
  });
});

describe('a BOQ poured into a building template', () => {
  const apartments = () => buildingTemplateSeeds().find((t) => t.type === 'apartments');
  const options = { startDate: '2030-01-05', workTypes, rates: DEFAULT_RATES };

  const planWithBoq = (values = { floors: 3 }) => {
    const { lines } = readBoq(PASTE);
    const matches = matchBoq(lines, workTypes);
    const assignments = new Map([...matches].map(([row, m]) => [row, m.best ? m.best.workTypeId : null]));
    return { plan: planProject(apartments(), values, { ...options, boq: { lines, assignments } }), lines };
  };

  it('spreads each line over the levels by the template proportions, at the BOQ price', () => {
    const { plan } = planWithBoq();
    const cols = plan.items.filter((it) => it.workTypeId === 'rc-columns');
    assert.equal(cols.length, 3); // one per level
    assert.equal(Math.round(cols.reduce((s, it) => s + it.qty, 0)), 90);
    assert.ok(cols[0].qty > cols[2].qty); // lower floors carry more
    assert.ok(cols.every((it) => it.unitPrice === 460000 && it.name === 'خرسانة مسلحة للأعمدة'));
    const lift = plan.items.find((it) => it.workTypeId === 'lift');
    assert.equal(lift.section, 'other'); // the 3-floor template has no lift element
  });

  it('template items without a BOQ line are left out; unmatched lines go to Other BOQ items', () => {
    const { plan } = planWithBoq();
    assert.ok(plan.items.filter((it) => it.workTypeId === 'paint').every((it) => it.leftOut));
    assert.ok(!plan.tasks.some((t) => t.workTypeId === 'paint'));
    assert.ok(plan.stats.boq.leftOut.includes('paint'));
    const other = plan.items.filter((it) => it.section === 'other');
    assert.deepEqual(other.map((it) => it.name).sort(), ['أعمال متفرقة غير محددة', 'تجهيز ونصب مصعد كهربائي'].sort());
    assert.equal(plan.stats.boq.lines, 8);
    assert.equal(plan.stats.boq.unassigned, 1);
    assert.equal(plan.stats.boq.unplaced, 1);
    const otherGroup = plan.tasks.find((t) => t.isGroup && t.name === 'فقرات أخرى من جدول الكميات');
    assert.ok(otherGroup);
    // The contract value is the BOQ's (all priced lines).
    const boqTotal = 3200000 + 3456000 + 41400000 + 258000000 + 1200 * 14000 + 2400 * 12000 + 45000000 + 2000000;
    assert.ok(Math.abs(plan.stats.totalCost - boqTotal) < 50, `${plan.stats.totalCost} vs ${boqTotal}`);
  });

  it('keeps the template logic: columns of a level after the slab below', () => {
    const { plan } = planWithBoq();
    const cols1 = plan.tasks.find((t) => t.templateKey === 'cols' && t.floor === 1);
    const slab0 = plan.tasks.find((t) => t.templateKey === 'slab' && t.floor === 0);
    assert.deepEqual(readLinks(cols1).map((l) => l.id), [slab0.id]);
    assert.ok(cols1.boqNo === '3');
  });

  it('several lines of one work type become variants linked like the template item', () => {
    const items = [
      { key: 'wall@G', elementKey: 'wall', levelIndex: 0, workTypeId: 'block-external', qty: 10, rules: [] },
      { key: 'wall@1', elementKey: 'wall', levelIndex: 1, workTypeId: 'block-external', qty: 30, rules: [] },
    ];
    const lines = [
      { kind: 'item', row: 5, description: 'بلوك 20', unit: 'م2', qty: 100, rate: 14000 },
      { kind: 'item', row: 6, description: 'طابوق 24', unit: 'م2', qty: 40, rate: 22000 },
    ];
    const assignments = new Map([[5, 'block-external'], [6, 'block-external']]);
    const { items: out, info } = applyBoq(items, lines, assignments, workTypeMap(workTypes));
    assert.deepEqual(out.map((it) => [it.key, it.qty]), [['wall@G#5', 25], ['wall@G#6', 10], ['wall@1#5', 75], ['wall@1#6', 30]]);
    assert.equal(info.placed, 2);
  });

  it('items waiting for left-out work inherit its predecessors (no gaps, no loops)', () => {
    const { plan } = planWithBoq();
    // The BOQ has no slab on grade, tie beams or footings: the ground-floor
    // columns wait for what those waited for — the backfill and the excavation.
    const backfill = plan.tasks.find((t) => t.templateKey === 'backfill');
    const exc = plan.tasks.find((t) => t.templateKey === 'exc');
    const colsG = plan.tasks.find((t) => t.templateKey === 'cols' && t.floor === 0);
    assert.deepEqual(readLinks(colsG).map((l) => l.id).sort(), [backfill.id, exc.id].sort());
    const result = GanttEngine.calculate(plan.tasks, '2030-01-05');
    assert.deepEqual(result.warnings.filter((w) => w.code === 'dependencyCycle'), []);
  });

  it('a line takes the place of a template work type of the same family', () => {
    const { lines } = readBoq(['ت', 'الوصف', 'الوحدة', 'الكمية'].join('\t') + '\n' + ['1', 'تبليط الأرضيات بالسيراميك', 'م2', '900'].join('\t'));
    const assignments = new Map([[lines[0].row, 'tiles']]); // the template's standard finish is porcelain
    const plan = planProject(apartments(), { floors: 3, finish: 2 }, { ...options, boq: { lines, assignments } });
    const floors = plan.items.filter((it) => !it.leftOut && it.elementKey === 'floor2');
    assert.equal(floors.length, 3);
    assert.ok(floors.every((it) => it.workTypeId === 'tiles'));
    assert.equal(plan.stats.boq.unplaced, 0);
  });
});

describe('dropping an item keeps the chain', () => {
  it('items after a dropped item wait for its predecessors instead', () => {
    const apartments = buildingTemplateSeeds().find((t) => t.type === 'apartments');
    const opts = { startDate: '2030-01-05', workTypes, rates: DEFAULT_RATES };
    const plan = planProject(apartments, { floors: 2, finish: 2 }, { ...opts, dropped: new Set(['screed@G']) });
    const floorG = plan.tasks.find((t) => t.templateKey === 'floor2' && t.floor === 0);
    const plasterG = plan.tasks.find((t) => t.templateKey === 'plasterIn' && t.floor === 0);
    assert.ok(readLinks(floorG).some((l) => l.id === plasterG.id));
    assert.equal(floorG.manualStart, null); // not floating at the project start
  });
});


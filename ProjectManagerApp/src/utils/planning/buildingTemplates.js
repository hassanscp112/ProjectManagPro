// ─────────────────────────────────────────────────────────────
// buildingTemplates — the seeded building templates (schema 2).
//
// A template is DATA (stored in pm-templates once seeded): building
// variables, how the levels are made, the WBS sections, and elements. An
// element is one work type with a quantity formula, an optional `when`
// condition, a scope (once, or one copy per level) and explicit links to
// other elements by key:
//   { to: key | [keys], floor?: 'same'|'prev'|'next'|'first'|'last'|'all'|{offset},
//     if?: 'first'|'notFirst'|'last'|'notLast', type, lag, lagUnit?: 'cd' }
// There is no implicit floor chaining: physical logic is explicit here
// (columns of a level after the slab below has cured), and crews sequence
// the floors through resource leveling.
//
// Formula variables: the template variables, plus
//   building  footprint perimeter totalArea aboveArea roofArea
//             buildingHeight levelsCount
//   per level levelArea levelHeight levelPerimeter levelIndex levelsAbove
//             levelUse isBasement isGround isTop isFirst isLast
//   use codes RESIDENTIAL COMMERCIAL OFFICE PARKING EDUCATION MEDICAL
//             WORSHIP STORAGE
// The ratios below are typical Iraqi building take-off ratios (per m² of
// floor) — starting points the user corrects, like the seeded prices.
// ─────────────────────────────────────────────────────────────

export const LEVEL_USES = { residential: 1, commercial: 2, office: 3, parking: 4, education: 5, medical: 6, worship: 7, storage: 8 };

/** "(levelUse == RESIDENTIAL ? 1.3 : levelUse == OFFICE ? 0.6 : … : fallback)" */
const byUse = (values, fallback) =>
  `(${Object.entries(values)
    .map(([use, v]) => `levelUse == ${use.toUpperCase()} ? ${v} : `)
    .join('')}${fallback})`;

const SECTIONS = [
  { key: 'prelim', name: 'الأعمال التحضيرية', nameEn: 'Preliminaries' },
  { key: 'sub', name: 'الأعمال تحت الأرض والأساسات', nameEn: 'Substructure & foundations' },
  { key: 'level' }, // one WBS group per level here
  { key: 'roof', name: 'أعمال السطح', nameEn: 'Roof works' },
  { key: 'external', name: 'الواجهات والأعمال الخارجية', nameEn: 'Facades & external works' },
  { key: 'systems', name: 'الأنظمة والتسليم', nameEn: 'Systems & handover' },
];

/* ─────────────── variables ─────────────── */

const v = (key, label, labelEn, def, extra = {}) => ({ key, label, labelEn, type: 'number', default: def, ...extra });
const FINISH = v('finish', 'مستوى التشطيب', 'Finish level', 2, {
  type: 'choice',
  options: [
    { value: 1, label: 'اقتصادي', labelEn: 'Economy' },
    { value: 2, label: 'متوسط', labelEn: 'Standard' },
    { value: 3, label: 'فاخر', labelEn: 'Luxury' },
  ],
});
const SLAB = v('slab', 'نوع السقف', 'Slab system', 1, {
  type: 'choice',
  options: [
    { value: 1, label: 'سوليد', labelEn: 'Solid slab' },
    { value: 2, label: 'هوردي (بلوك مجوف)', labelEn: 'Hordi (hollow block)' },
    { value: 3, label: 'فلات سلاب', labelEn: 'Flat slab' },
  ],
});
const HVAC = (def) =>
  v('hvac', 'التكييف', 'Air conditioning', def, {
    type: 'choice',
    options: [
      { value: 0, label: 'بدون', labelEn: 'None' },
      { value: 1, label: 'مكيفات سبلت', labelEn: 'Split units' },
      { value: 2, label: 'تكييف مركزي', labelEn: 'Central system' },
    ],
  });
const BASEMENT = v('basement', 'سرداب', 'Basement', 0, { type: 'bool' });
const LENGTH = v('length', 'طول المبنى (م) — 0 = تلقائي', 'Building length (m) — 0 = automatic', 0, { unit: 'م' });
const WIDTH = v('width', 'عرض المبنى (م) — 0 = تلقائي', 'Building width (m) — 0 = automatic', 0, { unit: 'م' });

const sizeVars = ({ floors, area, height, maxFloors = 40 }) => [
  v('floors', 'عدد الطوابق فوق الأرض', 'Floors above ground', floors, { type: 'int', min: 1, max: maxFloors }),
  v('areaPerFloor', 'مساحة الطابق (م2)', 'Area per floor (m²)', area, { min: 20, unit: 'م2' }),
  v('floorHeight', 'ارتفاع الطابق (م)', 'Floor height (m)', height, { min: 2.4, unit: 'م' }),
  LENGTH,
  WIDTH,
];

/* ─────────────── elements shared by framed (RC) buildings ─────────────── */

const E = (key, workType, section, qty, extra = {}) => ({ key, workType, section, scope: section === 'level' ? 'level' : 'once', qty, links: [], ...extra });
const L = (to, extra = {}) => ({ to, type: 'FS', lag: 0, ...extra });

/**
 * The element list of a reinforced-concrete framed building, tuned by cfg:
 *   intWall/elec/windows  per-use ratios (m² wall, points, m² window per m² floor)
 *   floors                floor finish work type per finish level [economy, standard, luxury]
 *   doors / ac / kitchen  per-level formulas ('' = none)
 *   bathFixtures, bathWallTiles, bathPoints  per bathroom (or toilet block)
 *   facade                'cladding' | 'stone' | 'curtain' for the luxury / modern facade
 *   lift, fireAlarm, sprinklers, medgas, central  systems (formulas / flags)
 */
const framedBuilding = (cfg) => {
  const INT = byUse(cfg.intWall, 0.5);
  const ELEC = byUse(cfg.elec, 0.3);
  const WIN = byUse(cfg.windows, 0.1);
  const EXT = cfg.extWallFactor ?? 0.8;
  const walls = `(levelArea*${INT}*2 + (isBasement ? 0 : levelPerimeter*levelHeight*${EXT}) + levelArea)`;
  const notParking = 'levelUse != PARKING';
  const tileable = `${notParking} && levelUse != MEDICAL`;
  const floorKeys = ['floor1', 'floor2', 'floor3', 'floorMed', 'floorPark'];
  const [f1, f2, f3] = cfg.floors || ['terrazzo', 'porcelain', 'marble'];

  const els = [
    // ── preliminaries ──
    E('mob', 'mobilization', 'prelim', '1'),
    E('siteprep', 'site-prep', 'prelim', 'footprint*1.5', { links: [L('mob', { type: 'SS', lag: 3 })] }),
    // ── substructure ──
    E('exc', 'excavation', 'sub', 'footprint*(basement ? 3.8 : 1.6)', { links: [L('siteprep')] }),
    E('blind', 'blinding', 'sub', 'footprint*(basement ? 0.1 : 0.05)', { links: [L('exc')] }),
    E('footings', 'footings', 'sub', `footprint*(${cfg.footingRatio ?? 0.07} + 0.012*floors)`, { when: 'basement == 0', links: [L('blind')] }),
    E('raft', 'raft', 'sub', 'footprint*(0.5 + 0.03*floors)', { when: 'basement', links: [L('blind')] }),
    E('tiebeams', 'tie-beams', 'sub', 'footprint*0.03', { when: 'basement == 0', links: [L('footings', { lag: 7, lagUnit: 'cd' })] }),
    E('bwalls', 'basement-walls', 'sub', 'perimeter*3.2*0.25', { when: 'basement', links: [L('raft', { lag: 7, lagUnit: 'cd' })] }),
    E('dpc', 'dpc', 'sub', 'basement ? perimeter*3.5 : footprint*0.5', { links: [L('tiebeams'), L('bwalls', { lag: 7, lagUnit: 'cd' })] }),
    E('backfill', 'backfill', 'sub', 'basement ? perimeter*3.5 : footprint*0.9', { links: [L('dpc')] }),
    E('gslab', 'ground-slab', 'sub', 'footprint*0.12', { when: 'basement == 0', links: [L('backfill')] }),

    // ── per level: structure ──
    E('cols', 'rc-columns', 'level', 'levelArea*(0.03 + 0.003*levelsAbove)', {
      links: [
        L('slab', { floor: 'prev', lag: 7, lagUnit: 'cd', if: 'notFirst' }),
        L('gslab', { if: 'first' }),
        L('tiebeams', { if: 'first' }),
        L('raft', { if: 'first', lag: 7, lagUnit: 'cd' }),
      ],
    }),
    E('slab', 'rc-slab', 'level', 'levelArea*(slab == 2 ? 0.2 : slab == 3 ? 0.27 : 0.3)', { links: [L('cols', { lag: 2 })] }),
    E('hordi', 'hordi-blocks', 'level', 'levelArea*0.7', { when: 'slab == 2', links: [L('slab', { type: 'SS' })] }),
    E('stairs', 'stairs', 'level', `ceil(levelArea/${cfg.stairArea ?? 500})*2.5`, { links: [L('slab', { type: 'SS', lag: 2 })] }),
    // ── per level: masonry and rough-ins (after the slab above is cast) ──
    E('extwall', cfg.extWallType || 'block-external', 'level', `levelPerimeter*levelHeight*${EXT}`, {
      when: '!isBasement',
      links: [L('slab', { floor: 'next', lag: 7, lagUnit: 'cd', if: 'notLast' }), L('slab', { lag: 21, lagUnit: 'cd' })],
    }),
    E('intwall', 'block-internal', 'level', `levelArea*${INT}`, {
      links: [L('extwall', { type: 'SS', lag: 3 }), L('slab', { floor: 'next', lag: 7, lagUnit: 'cd', if: 'notLast' }), L('slab', { lag: 21, lagUnit: 'cd' })],
    }),
    E('elecr', 'elec-rough', 'level', `ceil(levelArea*${ELEC})`, { links: [L('intwall', { type: 'SS', lag: 5 })] }),
    E('plumbr', 'plumb-rough', 'level', `isBasement ? 2 : bathroomsPerFloor*${cfg.bathPoints ?? 6} + (levelUse == RESIDENTIAL ? unitsPerFloor*3 : 0)`, {
      links: [L('intwall', { type: 'SS', lag: 5 })],
    }),
    E('duct', 'ducting', 'level', 'levelArea', { when: 'hvac == 2 && !isBasement', links: [L('intwall', { type: 'SS', lag: 10 })] }),
    // ── per level: finishes ──
    E('plasterIn', 'plaster-internal', 'level', walls, { when: notParking, links: [L('intwall'), L('elecr'), L('plumbr')] }),
    E('screed', 'screed', 'level', 'levelArea*0.85', { when: notParking, links: [L('plasterIn')] }),
    E('walltiles', 'wall-tiles', 'level', `bathroomsPerFloor*${cfg.bathWallTiles ?? 22} + (levelUse == RESIDENTIAL ? unitsPerFloor*8 : 0)`, {
      when: '!isBasement',
      links: [L('plasterIn')],
    }),
    E('floor1', f1, 'level', 'levelArea*0.85', { when: `finish == 1 && ${tileable}`, links: [L('screed'), L('walltiles', { type: 'SS', lag: 2 })] }),
    E('floor2', f2, 'level', 'levelArea*0.85', { when: `finish == 2 && ${tileable}`, links: [L('screed'), L('walltiles', { type: 'SS', lag: 2 })] }),
    E('floor3', f3, 'level', 'levelArea*0.85', { when: `finish == 3 && ${tileable}`, links: [L('screed'), L('walltiles', { type: 'SS', lag: 2 })] }),
    E('floorMed', 'vinyl', 'level', 'levelArea*0.85', { when: 'levelUse == MEDICAL', links: [L('screed'), L('paint', { type: 'SS', lag: 5 })] }),
    E('floorPark', 'industrial-floor', 'level', 'levelArea*0.9', { when: 'levelUse == PARKING', links: [L('intwall'), L('elecr')] }),
    E('ceiling', 'gypsum', 'level', `levelArea*(hvac == 2 ? 0.9 : finish == 3 ? 0.8 : 0.3)`, {
      when: '(finish >= 2 || hvac == 2) && !isBasement',
      links: [L('plasterIn'), L('duct')],
    }),
    E('windows', 'windows', 'level', `levelArea*${WIN}`, { when: '!isBasement', links: [L('plasterIn', { type: 'SS', lag: 5 })] }),
    E('paint', 'paint', 'level', `${walls}*0.85`, {
      when: notParking,
      links: [L(['floor1', 'floor2', 'floor3']), L('ceiling'), L('walltiles')],
    }),
    E('doors', 'doors', 'level', cfg.doors || 'roomsPerFloor + bathroomsPerFloor + 2', { links: [L('paint', { type: 'SS', lag: 5 })] }),
    E('elecf', 'elec-final', 'level', `ceil(levelArea*${ELEC})`, { links: [L('paint', { type: 'SS', lag: 3 }), L('floorPark')] }),
    E('sanitary', 'sanitary', 'level', `bathroomsPerFloor*${cfg.bathFixtures ?? 3} + (levelUse == RESIDENTIAL ? unitsPerFloor : 0)`, {
      when: '!isBasement',
      links: [L('walltiles'), L(floorKeys)],
    }),
  ];
  if (cfg.kitchen) els.push(E('kitchen', 'kitchen', 'level', cfg.kitchen, { links: [L(['floor1', 'floor2', 'floor3'])] }));
  if (cfg.ac) els.push(E('ac', 'split-ac', 'level', cfg.ac, { when: 'hvac == 1 && !isBasement', links: [L('paint', { type: 'SS', lag: 5 })] }));

  // ── roof ──
  els.push(
    E('parapet', 'parapet', 'roof', 'perimeter*1.1', { links: [L('slab', { floor: 'last', lag: 14, lagUnit: 'cd' })] }),
    E('wproof', 'waterproofing', 'roof', 'roofArea*1.1', { links: [L('slab', { floor: 'last', lag: 21, lagUnit: 'cd' }), L('parapet')] }),
    E('thermal', 'thermal', 'roof', 'roofArea', { links: [L('wproof')] }),
    E('rscreed', 'screed', 'roof', 'roofArea', { name: 'فرشة تسوية للسطح', nameEn: 'Roof screed', links: [L('thermal')] }),
    E('rtiles', 'roof-tiles', 'roof', 'roofArea', { links: [L('rscreed')] }),
    E('tanks', 'water-tanks', 'roof', 'ceil(totalArea/150)', { links: [L('rtiles')] })
  );

  // ── facades and external works ──
  els.push(
    E('plasterEx', 'plaster-external', 'external', `perimeter*buildingHeight*${EXT}`, { links: [L('extwall', { floor: 'last' })] }),
    E('paintEx', 'paint-external', 'external', `perimeter*buildingHeight*${EXT}`, { when: 'finish < 3', links: [L('plasterEx')] })
  );
  if (cfg.facade === 'curtain') {
    els.push(E('curtain', 'curtain-wall', 'external', 'perimeter*buildingHeight*(finish == 1 ? 0.2 : 0.4)', { links: [L('slab', { floor: 'last', lag: 14, lagUnit: 'cd' })] }));
    els.push(E('cladding', 'facade', 'external', 'perimeter*buildingHeight*0.3', { when: 'finish >= 2', links: [L('plasterEx')] }));
  } else {
    els.push(E('cladding', cfg.facade === 'stone' ? 'stone' : 'facade', 'external', 'perimeter*buildingHeight*0.5', { when: 'finish == 3', links: [L('plasterEx')] }));
  }
  els.push(
    E('fence', 'fence', 'external', `sqrt(footprint*${cfg.plotFactor ?? 2.5})*4`, { links: [L('backfill')] }),
    E('sewer', 'sewer', 'external', '30 + perimeter*0.5', { links: [L('backfill')] }),
    E('septic', 'septic', 'external', '1', { links: [L('sewer', { type: 'SS', lag: 2 })] }),
    E('paving', 'interlock', 'external', `footprint*${cfg.paving ?? 0.6}`, { links: [L('fence'), L('plasterEx')] }),
    E('landscape', 'landscaping', 'external', `footprint*${cfg.landscape ?? 0.4}`, { links: [L('paving', { type: 'SS', lag: 5 })] })
  );

  // ── systems and handover ──
  els.push(E('panel', 'panel', 'systems', 'levelsCount + 1', { links: [L('elecr', { floor: 'last' })] }));
  if (cfg.lift) els.push(E('lift', 'lift', 'systems', cfg.lift.qty, { when: cfg.lift.when, links: [L('slab', { floor: 'last', lag: 28, lagUnit: 'cd' })] }));
  if (cfg.fireAlarm) els.push(E('firealarm', 'fire-alarm', 'systems', 'ceil(totalArea/40)', { links: [L('elecr', { floor: 'last' })] }));
  if (cfg.sprinklers) els.push(E('sprinklers', 'fire-fighting', 'systems', 'aboveArea', { links: [L('slab', { floor: 'last', lag: 14, lagUnit: 'cd' })] }));
  if (cfg.medgas) els.push(E('medgas', 'medgas', 'systems', 'roomsPerFloor*floors*2', { links: [L('plasterIn', { floor: 'last' })] }));
  const present = new Set(els.map((e) => e.key));
  const optional = (keys) => keys.filter(([key]) => present.has(key)).map(([key, extra]) => L(key, extra));
  els.push(
    E('testing', 'testing', 'systems', '1', {
      links: [
        L('elecf', { floor: 'last' }),
        L('sanitary', { floor: 'last' }),
        L('duct', { floor: 'last' }),
        ...optional([['lift'], ['firealarm'], ['sprinklers'], ['medgas'], ['ac', { floor: 'last' }]]),
      ],
    }),
    E('handover', 'handover', 'systems', '1', { links: [L('testing'), L('paving'), L('landscape'), L('doors', { floor: 'last' }), L('rtiles'), L('tanks')] })
  );
  return els;
};

/* ─────────────── the templates ─────────────── */

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tpl_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const template = (type, name, nameEn, icon, variables, levels, elements) => ({
  id: uid(),
  schema: 2,
  kind: 'building',
  type,
  name,
  nameEn,
  icon,
  version: 1,
  createdAt: new Date().toISOString(),
  source: 'seed',
  variables,
  levels: { count: 'floors', basement: 'basement', area: 'areaPerFloor', height: 'floorHeight', ...levels },
  sections: SECTIONS.map((s) => ({ ...s })),
  elements,
});

const RES = { residential: 1.3, office: 0.6, commercial: 0.3, education: 0.9, medical: 1.2, parking: 0.1, worship: 0.2, storage: 0.1 };
const ELEC = { residential: 0.3, office: 0.4, commercial: 0.25, education: 0.25, medical: 0.5, parking: 0.05, worship: 0.2, storage: 0.05 };
const WINDOWS = { residential: 0.12, office: 0.15, commercial: 0.08, education: 0.18, medical: 0.12, parking: 0, worship: 0.1, storage: 0.03 };

const house = () =>
  template(
    'house',
    'بيت',
    'House',
    '🏠',
    [
      ...sizeVars({ floors: 2, area: 200, height: 3.2, maxFloors: 4 }),
      BASEMENT,
      v('roomsPerFloor', 'عدد الغرف في الطابق', 'Rooms per floor', 4, { type: 'int', min: 0 }),
      v('bathroomsPerFloor', 'عدد الحمامات في الطابق', 'Bathrooms per floor', 2, { type: 'int', min: 0 }),
      v('unitsPerFloor', 'عدد الوحدات السكنية في الطابق', 'Dwelling units per floor', 1, { type: 'int', min: 0 }),
      SLAB,
      FINISH,
      HVAC(1),
    ],
    { use: 'residential' },
    framedBuilding({
      intWall: RES,
      elec: ELEC,
      windows: WINDOWS,
      doors: 'roomsPerFloor + bathroomsPerFloor + 1',
      kitchen: 'isGround ? 5 : 0',
      ac: 'roomsPerFloor + 1',
      plotFactor: 2,
    })
  );

const villa = () =>
  template(
    'villa',
    'فيلا',
    'Villa',
    '🏡',
    [
      ...sizeVars({ floors: 2, area: 300, height: 3.4, maxFloors: 4 }),
      BASEMENT,
      v('roomsPerFloor', 'عدد الغرف في الطابق', 'Rooms per floor', 5, { type: 'int', min: 0 }),
      v('bathroomsPerFloor', 'عدد الحمامات في الطابق', 'Bathrooms per floor', 3, { type: 'int', min: 0 }),
      v('unitsPerFloor', 'عدد الوحدات السكنية في الطابق', 'Dwelling units per floor', 1, { type: 'int', min: 0 }),
      SLAB,
      { ...FINISH, default: 3 },
      HVAC(1),
    ],
    { use: 'residential' },
    framedBuilding({
      intWall: RES,
      elec: { ...ELEC, residential: 0.35 },
      windows: { ...WINDOWS, residential: 0.15 },
      doors: 'roomsPerFloor + bathroomsPerFloor + 2',
      kitchen: 'isGround ? 6 : 0',
      ac: 'roomsPerFloor + 2',
      facade: 'stone',
      plotFactor: 3,
      paving: 1,
      landscape: 1.2,
    })
  );

const apartments = () =>
  template(
    'apartments',
    'بناية سكنية (شقق)',
    'Apartment building',
    '🏢',
    [
      ...sizeVars({ floors: 5, area: 400, height: 3.1 }),
      BASEMENT,
      v('unitsPerFloor', 'عدد الشقق في الطابق', 'Apartments per floor', 4, { type: 'int', min: 1 }),
      v('roomsPerFloor', 'عدد الغرف في الطابق', 'Rooms per floor', 12, { type: 'int', min: 0 }),
      v('bathroomsPerFloor', 'عدد الحمامات في الطابق', 'Bathrooms per floor', 6, { type: 'int', min: 0 }),
      SLAB,
      FINISH,
      HVAC(1),
    ],
    { use: 'residential' },
    framedBuilding({
      intWall: RES,
      elec: ELEC,
      windows: WINDOWS,
      doors: 'unitsPerFloor + roomsPerFloor + bathroomsPerFloor',
      kitchen: 'unitsPerFloor*4',
      ac: 'roomsPerFloor + unitsPerFloor',
      lift: { qty: 'ceil(totalArea/3000)', when: 'floors >= 4' },
      fireAlarm: false,
      plotFactor: 1.6,
    })
  );

const school = () =>
  template(
    'school',
    'مدرسة',
    'School',
    '🏫',
    [
      ...sizeVars({ floors: 2, area: 900, height: 3.6, maxFloors: 4 }),
      BASEMENT,
      v('roomsPerFloor', 'عدد الصفوف في الطابق', 'Classrooms per floor', 10, { type: 'int', min: 1 }),
      v('bathroomsPerFloor', 'مجاميع صحية في الطابق', 'Toilet blocks per floor', 2, { type: 'int', min: 0 }),
      v('unitsPerFloor', 'وحدات سكنية (عادة 0)', 'Dwelling units (usually 0)', 0, { type: 'int', min: 0 }),
      SLAB,
      { ...FINISH, default: 1 },
      HVAC(1),
    ],
    { use: 'education' },
    framedBuilding({
      intWall: RES,
      elec: ELEC,
      windows: WINDOWS,
      doors: 'roomsPerFloor + bathroomsPerFloor*4 + 3',
      ac: 'roomsPerFloor*2 + 2',
      bathFixtures: 8,
      bathWallTiles: 45,
      bathPoints: 12,
      stairArea: 450,
      fireAlarm: true,
      plotFactor: 4,
      paving: 1.5,
      landscape: 0.6,
    })
  );

const mall = () =>
  template(
    'mall',
    'مول تجاري',
    'Shopping mall',
    '🏬',
    [
      ...sizeVars({ floors: 3, area: 3000, height: 4.8, maxFloors: 10 }),
      BASEMENT,
      v('roomsPerFloor', 'عدد المحلات في الطابق', 'Shops per floor', 30, { type: 'int', min: 1 }),
      v('bathroomsPerFloor', 'مجاميع صحية في الطابق', 'Toilet blocks per floor', 4, { type: 'int', min: 0 }),
      v('unitsPerFloor', 'وحدات سكنية (عادة 0)', 'Dwelling units (usually 0)', 0, { type: 'int', min: 0 }),
      { ...SLAB, default: 3 },
      FINISH,
      HVAC(2),
    ],
    { use: 'commercial' },
    framedBuilding({
      intWall: RES,
      elec: ELEC,
      windows: WINDOWS,
      doors: 'roomsPerFloor + bathroomsPerFloor*4 + 6',
      ac: 'roomsPerFloor',
      bathFixtures: 8,
      bathWallTiles: 45,
      bathPoints: 12,
      stairArea: 900,
      extWallFactor: 0.6,
      facade: 'curtain',
      lift: { qty: 'ceil(totalArea/2500)', when: 'floors >= 2' },
      fireAlarm: true,
      sprinklers: true,
      plotFactor: 2.2,
      paving: 1.2,
      landscape: 0.3,
    })
  );

const healthCenter = () =>
  template(
    'health',
    'مركز صحي / مستشفى',
    'Health center / hospital',
    '🏥',
    [
      ...sizeVars({ floors: 3, area: 1500, height: 4, maxFloors: 15 }),
      BASEMENT,
      v('roomsPerFloor', 'غرف المرضى والعيادات في الطابق', 'Wards & clinics per floor', 24, { type: 'int', min: 1 }),
      v('bathroomsPerFloor', 'عدد الحمامات في الطابق', 'Bathrooms per floor', 10, { type: 'int', min: 0 }),
      v('unitsPerFloor', 'وحدات سكنية (عادة 0)', 'Dwelling units (usually 0)', 0, { type: 'int', min: 0 }),
      SLAB,
      FINISH,
      HVAC(2),
    ],
    { use: 'medical' },
    framedBuilding({
      intWall: RES,
      elec: ELEC,
      windows: WINDOWS,
      doors: 'roomsPerFloor + bathroomsPerFloor + 6',
      ac: 'roomsPerFloor + 4',
      bathWallTiles: 26,
      bathPoints: 7,
      stairArea: 700,
      lift: { qty: 'ceil(totalArea/2000) + 1', when: 'floors >= 2' },
      fireAlarm: true,
      sprinklers: true,
      medgas: true,
      plotFactor: 2.5,
      paving: 1,
    })
  );

const mosque = () =>
  template(
    'mosque',
    'جامع',
    'Mosque',
    '🕌',
    [
      ...sizeVars({ floors: 1, area: 600, height: 7, maxFloors: 2 }),
      BASEMENT,
      v('roomsPerFloor', 'غرف ملحقة (إمام، مكتبة…)', 'Annex rooms', 3, { type: 'int', min: 0 }),
      v('bathroomsPerFloor', 'مجاميع الوضوء', 'Ablution blocks', 2, { type: 'int', min: 0 }),
      v('unitsPerFloor', 'وحدات سكنية (عادة 0)', 'Dwelling units (usually 0)', 0, { type: 'int', min: 0 }),
      v('domeDiameter', 'قطر القبة (م)', 'Dome diameter (m)', 12, { min: 0, unit: 'م' }),
      v('minaretHeight', 'ارتفاع المنارة (م)', 'Minaret height (m)', 30, { min: 0, unit: 'م' }),
      SLAB,
      { ...FINISH, default: 3 },
      HVAC(1),
    ],
    { use: 'worship' },
    [
      ...framedBuilding({
        intWall: RES,
        elec: ELEC,
        windows: WINDOWS,
        floors: ['terrazzo', 'porcelain', 'marble'],
        doors: 'roomsPerFloor + bathroomsPerFloor*2 + 4',
        ac: 'ceil(levelArea/40)',
        bathFixtures: 10,
        bathWallTiles: 50,
        bathPoints: 12,
        facade: 'stone',
        fireAlarm: false,
        plotFactor: 3,
        paving: 1.2,
        landscape: 0.6,
      }),
      E('dome', 'dome', 'roof', 'PI*domeDiameter*domeDiameter/2*0.15', { when: 'domeDiameter > 0', links: [L('slab', { floor: 'last', lag: 14, lagUnit: 'cd' })] }),
      E('minaret', 'minaret', 'external', 'minaretHeight*1.2', { when: 'minaretHeight > 0', links: [L('cols', { floor: 'first', type: 'SS', lag: 14, lagUnit: 'cd' })] }),
      E('decor', 'decor', 'external', 'areaPerFloor*0.3', { links: [L('dome', { lag: 14, lagUnit: 'cd' }), L('plasterEx')] }),
      E('carpet', 'carpet', 'systems', 'areaPerFloor*0.9', { links: [L('paint', { floor: 'last' }), L(['floor1', 'floor2', 'floor3'], { floor: 'last' })] }),
    ]
  );

const office = () =>
  template(
    'office',
    'بناية مكاتب / متعددة الاستخدام',
    'Office / mixed-use building',
    '🏛️',
    [
      ...sizeVars({ floors: 6, area: 800, height: 3.5 }),
      BASEMENT,
      v('roomsPerFloor', 'عدد المكاتب في الطابق', 'Offices per floor', 12, { type: 'int', min: 0 }),
      v('bathroomsPerFloor', 'عدد الحمامات في الطابق', 'Bathrooms per floor', 4, { type: 'int', min: 0 }),
      v('unitsPerFloor', 'شقق في الطوابق السكنية', 'Apartments on residential floors', 0, { type: 'int', min: 0 }),
      { ...SLAB, default: 3 },
      FINISH,
      HVAC(2),
    ],
    { use: 'office', groundUse: 'commercial' },
    framedBuilding({
      intWall: RES,
      elec: ELEC,
      windows: WINDOWS,
      doors: 'roomsPerFloor + bathroomsPerFloor + 3',
      kitchen: 'unitsPerFloor*4',
      ac: 'roomsPerFloor + 2',
      extWallFactor: 0.6,
      facade: 'curtain',
      lift: { qty: 'ceil(totalArea/2500)', when: 'floors >= 3' },
      fireAlarm: true,
      sprinklers: true,
      plotFactor: 1.8,
    })
  );

const warehouse = () =>
  template(
    'warehouse',
    'مخزن / هنكر حديدي',
    'Warehouse / steel hangar',
    '🏭',
    [
      v('floors', 'عدد الطوابق', 'Floors', 1, { type: 'int', min: 1, max: 1 }),
      v('areaPerFloor', 'مساحة المخزن (م2)', 'Floor area (m²)', 2000, { min: 50, unit: 'م2' }),
      v('floorHeight', 'ارتفاع الجدار الجانبي (م)', 'Eave height (m)', 8, { min: 3, unit: 'م' }),
      { ...LENGTH, default: 50 },
      { ...WIDTH, default: 40 },
      v('shutterDoors', 'عدد الأبواب المنزلقة', 'Roller shutter doors', 4, { type: 'int', min: 0 }),
      v('bathroomsPerFloor', 'عدد الحمامات', 'Bathrooms', 2, { type: 'int', min: 0 }),
      v('sprinklers', 'منظومة إطفاء رشاشات', 'Sprinkler system', 1, { type: 'bool' }),
    ],
    { use: 'storage', basement: null, anchor: 'steel' },
    [
      E('mob', 'mobilization', 'prelim', '1'),
      E('siteprep', 'site-prep', 'prelim', 'footprint*1.3', { links: [L('mob', { type: 'SS', lag: 3 })] }),
      E('exc', 'excavation', 'sub', 'footprint*0.5', { links: [L('siteprep')] }),
      E('blind', 'blinding', 'sub', 'footprint*0.02', { links: [L('exc')] }),
      E('footings', 'footings', 'sub', 'footprint*0.035', { links: [L('blind')] }),
      E('tiebeams', 'tie-beams', 'sub', 'perimeter*0.3*0.5', { links: [L('footings', { lag: 7, lagUnit: 'cd' })] }),
      E('backfill', 'backfill', 'sub', 'footprint*0.3', { links: [L('tiebeams')] }),
      E('subbase', 'base-course', 'sub', 'footprint*0.25', { links: [L('backfill')] }),
      E('steel', 'steel-structure', 'level', 'levelArea*0.035', { links: [L('footings', { lag: 14, lagUnit: 'cd' })] }),
      E('roof', 'sandwich-roof', 'level', 'levelArea*1.1', { links: [L('steel', { type: 'SS', lag: 5 })] }),
      E('walls', 'sandwich-wall', 'level', 'levelPerimeter*levelHeight*0.85', { links: [L('roof', { type: 'SS', lag: 3 })] }),
      E('floor', 'industrial-floor', 'level', 'levelArea', { links: [L('roof'), L('subbase')] }),
      E('shutters', 'shutters', 'level', 'shutterDoors*16', { links: [L('walls')] }),
      E('elecr', 'elec-rough', 'level', 'ceil(levelArea/50)', { links: [L('walls', { type: 'SS', lag: 3 })] }),
      E('lights', 'lighting-high', 'level', 'ceil(levelArea/60)', { links: [L('elecr'), L('floor')] }),
      E('plumbr', 'plumb-rough', 'level', 'bathroomsPerFloor*6', { links: [L('walls')] }),
      E('sanitary', 'sanitary', 'level', 'bathroomsPerFloor*3', { links: [L('plumbr'), L('floor')] }),
      E('doors', 'doors-steel', 'level', '2 + bathroomsPerFloor', { links: [L('walls')] }),
      E('fence', 'fence', 'external', 'sqrt(footprint*2)*4', { links: [L('backfill')] }),
      E('sewer', 'sewer', 'external', '30 + perimeter*0.3', { links: [L('backfill')] }),
      E('septic', 'septic', 'external', '1', { links: [L('sewer', { type: 'SS', lag: 2 })] }),
      E('paving', 'interlock', 'external', 'footprint*0.8', { links: [L('fence'), L('walls')] }),
      E('panel', 'panel', 'systems', '2', { links: [L('elecr')] }),
      E('sprinklers', 'fire-fighting', 'systems', 'totalArea', { when: 'sprinklers', links: [L('roof')] }),
      E('firealarm', 'fire-alarm', 'systems', 'ceil(totalArea/100)', { links: [L('elecr')] }),
      E('testing', 'testing', 'systems', '1', { links: [L('lights'), L('sprinklers'), L('firealarm'), L('sanitary')] }),
      E('handover', 'handover', 'systems', '1', { links: [L('testing'), L('paving'), L('shutters'), L('doors')] }),
    ]
  );

/** Fresh copies of the nine seeded building templates. */
export const buildingTemplateSeeds = () => [house(), villa(), apartments(), school(), mall(), healthCenter(), mosque(), office(), warehouse()];

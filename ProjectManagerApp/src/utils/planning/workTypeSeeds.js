// ─────────────────────────────────────────────────────────────
// workTypeSeeds — the starting work-type library (building works).
//
// Typical Iraqi 2026 site norms, marked checked: false so the user reviews
// them: productivity = quantity one standard crew completes per working day
// (formwork + rebar + concrete for structural items); crew = people (and
// equipment) in that crew; rateId = the rate-library item that prices it
// (direct cost). fixedDays = a fixed duration whatever the quantity
// (mobilization, testing, handover). Ids are stable: templates, plans and
// learned productivity refer to them. The ids of the old TemplateEngine
// PARTS are kept so older templates map onto this library.
// ─────────────────────────────────────────────────────────────

const CREW = {
  general: 6,
  earthworks: 3,
  concrete: 10,
  masonry: 4,
  plaster: 4,
  tiling: 3,
  painting: 3,
  carpentry: 2,
  aluminium: 3,
  electrical: 3,
  plumbing: 2,
  hvac: 3,
  insulation: 3,
  ceilings: 3,
  steel: 6,
  facade: 4,
  external: 5,
  systems: 3,
};

// [id, name, nameEn, unit, trade, productivity, rateId, keywords, extra]
const ROWS = [
  // ── general ──
  ['mobilization', 'تحضيرات الموقع والتعبئة', 'Mobilization & site setup', 'مقطوعية', 'general', 1, 'rb-mobilization', ['تحضيرات', 'تعبئة', 'mobilization', 'site setup'], { fixedDays: 10 }],
  ['testing', 'الفحص والتشغيل التجريبي', 'Testing & commissioning', 'مقطوعية', 'general', 1, 'rb-testing', ['فحص', 'تشغيل تجريبي', 'testing', 'commissioning'], { fixedDays: 14 }],
  ['handover', 'التنظيف والتسليم', 'Cleaning & handover', 'مقطوعية', 'general', 1, 'rb-handover', ['تنظيف', 'تسليم', 'handover', 'cleaning'], { fixedDays: 7 }],
  // ── earthworks ──
  ['site-prep', 'تجهيز وتسوية الموقع', 'Site clearance & levelling', 'م2', 'earthworks', 800, 'r-site-prep', ['تسوية', 'تجهيز موقع', 'clearance', 'levelling'], { equipment: { loader: 1 } }],
  ['excavation', 'حفريات الأسس', 'Foundation excavation', 'م3', 'earthworks', 250, 'r-excav-found', ['حفر', 'حفريات', 'excavation', 'حفريات أسس'], { equipment: { excavator: 1 } }],
  ['base-course', 'طبقة أساس (سب بيس)', 'Sub-base layer', 'م3', 'earthworks', 120, 'r-base-course', ['سب بيس', 'طبقة أساس', 'sub-base', 'subbase'], { equipment: { loader: 1, roller: 1 } }],
  ['backfill', 'دفن وحدل', 'Backfill & compaction', 'م3', 'earthworks', 150, 'r-backfill', ['دفن', 'حدل', 'ردم', 'backfill', 'compaction'], { equipment: { loader: 1, roller: 1 } }],
  // ── concrete (structure crew: formwork + rebar + pour) ──
  ['blinding', 'خرسانة نظافة', 'Blinding concrete', 'م3', 'concrete', 25, 'r-conc-plain', ['نظافة', 'خرسانة عادية', 'blinding', 'lean concrete']],
  ['footings', 'قواعد خرسانية مسلحة', 'RC footings', 'م3', 'concrete', 8, 'rb-rc-footings', ['قواعد', 'أسس', 'footing', 'foundation']],
  ['raft', 'حصيرة خرسانية مسلحة', 'RC raft foundation', 'م3', 'concrete', 30, 'rb-rc-raft', ['حصيرة', 'لبشة', 'raft', 'mat foundation']],
  ['tie-beams', 'جسور ربط مسلحة', 'RC tie beams', 'م3', 'concrete', 6, 'rb-rc-tiebeams', ['جسور ربط', 'ميدات', 'رقاب', 'tie beam', 'grade beam']],
  ['basement-walls', 'جدران سرداب خرسانية مسلحة', 'RC basement walls', 'م3', 'concrete', 5, 'rb-rc-walls', ['جدران سرداب', 'جدار ساند', 'retaining wall', 'basement wall']],
  ['rc-columns', 'أعمدة خرسانية مسلحة', 'RC columns', 'م3', 'concrete', 3, 'rb-rc-columns', ['أعمدة', 'اعمدة', 'columns']],
  ['rc-slab', 'سقف وجسور خرسانية مسلحة', 'RC slab & beams', 'م3', 'concrete', 10, 'rb-rc-slab', ['سقف', 'بلاطة', 'جسور', 'slab', 'beams']],
  ['hordi-blocks', 'بلوك هوردي للسقوف', 'Hollow slab blocks (hordi)', 'م2', 'concrete', 120, 'rb-hordi-blocks', ['هوردي', 'hordi', 'hollow block']],
  ['stairs', 'درج خرساني مسلح', 'RC stairs', 'م3', 'concrete', 1.5, 'rb-rc-stairs', ['درج', 'سلم', 'سلالم', 'stairs', 'staircase']],
  ['ground-slab', 'أرضية خرسانية على التربة', 'Slab on grade', 'م3', 'concrete', 15, 'rb-ground-slab', ['أرضية خرسانية', 'تبليط أرضي', 'slab on grade', 'ground slab']],
  ['dome', 'قبة خرسانية مسلحة', 'RC dome', 'م3', 'concrete', 1.5, 'rb-dome', ['قبة', 'dome']],
  ['minaret', 'منارة خرسانية مسلحة', 'RC minaret', 'م3', 'concrete', 1.2, 'rb-minaret', ['منارة', 'مئذنة', 'minaret']],
  ['industrial-floor', 'أرضية صناعية مقواة', 'Industrial floor slab', 'م2', 'concrete', 120, 'rb-industrial-floor', ['أرضية صناعية', 'industrial floor', 'hardener']],
  // older template parts (kept for templates made before the work-type library)
  ['col-beams', 'جوائز وأعمدة', 'Columns & beams', 'م3', 'concrete', 30, 'r-conc-c30', ['جوائز', 'أعمدة'], { legacy: true }],
  ['flat-slab', 'سقف فلات', 'Flat slab', 'م3', 'concrete', 35, 'r-conc-c25', ['سقف فلات', 'flat slab'], { legacy: true }],
  ['solid-slab', 'سقف سوليد', 'Solid slab', 'م3', 'concrete', 30, 'r-conc-c30', ['سقف سوليد', 'solid slab'], { legacy: true }],
  ['balcony', 'بلكونات', 'Balconies', 'م3', 'concrete', 20, 'r-conc-c25', ['بلكون', 'balcony'], { legacy: true }],
  // ── masonry ──
  ['block-external', 'جدران خارجية بلوك 20 سم', 'External walls, block 20 cm', 'م2', 'masonry', 25, 'r-block20', ['بلوك 20', 'جدران خارجية', 'external wall', 'block 20']],
  ['block-internal', 'قواطع داخلية بلوك 15 سم', 'Internal walls, block 15 cm', 'م2', 'masonry', 30, 'r-block15', ['بلوك 15', 'قواطع', 'partition', 'block 15']],
  ['brick-external', 'جدران طابوق وجه خارجي', 'Face brick walls', 'م2', 'masonry', 18, 'r-brick-face', ['طابوق', 'brick']],
  ['parapet', 'ستارة سطح بلوك', 'Roof parapet walls', 'م2', 'masonry', 25, 'r-block15', ['ستارة', 'دروة', 'parapet']],
  ['fence', 'سياج خارجي', 'Boundary wall', 'م.ط', 'masonry', 8, 'rb-fence', ['سياج', 'سور', 'fence', 'boundary wall']],
  // ── plaster ──
  ['plaster-internal', 'لبخ وبياض داخلي', 'Internal plaster', 'م2', 'plaster', 40, 'r-plaster-in', ['لبخ داخلي', 'لبخ', 'بياض', 'جص', 'internal plaster']],
  ['plaster-external', 'لبخ خارجي', 'External plaster', 'م2', 'plaster', 25, 'r-plaster-out', ['لبخ خارجي', 'لبخ', 'لبخ واجهات', 'سمنت', 'external plaster', 'render']],
  ['screed', 'فرشة تسوية', 'Screed', 'م2', 'plaster', 80, 'rb-screed', ['فرشة', 'تسوية', 'سكريد', 'screed']],
  // ── tiling ──
  ['tiles', 'تبليط أرضيات سيراميك', 'Ceramic floor tiles', 'م2', 'tiling', 20, 'r-tiles', ['سيراميك', 'بلاط', 'ceramic', 'floor tiles']],
  ['porcelain', 'تبليط أرضيات بورسلين', 'Porcelain floor tiles', 'م2', 'tiling', 18, 'rb-porcelain', ['بورسلين', 'porcelain']],
  ['marble', 'تغليف أرضيات بالمرمر', 'Marble flooring', 'م2', 'tiling', 12, 'rb-marble', ['مرمر', 'رخام', 'marble', 'granite']],
  ['terrazzo', 'كاشي موزائيك', 'Terrazzo tiles', 'م2', 'tiling', 25, 'rb-terrazzo', ['موزائيك', 'كاشي', 'terrazzo']],
  ['wall-tiles', 'تغليف جدران سيراميك', 'Ceramic wall tiles', 'م2', 'tiling', 15, 'r-ceramic', ['تغليف جدران', 'سيراميك جدران', 'wall tiles']],
  ['roof-tiles', 'تبليط السطح (شتايكر)', 'Roof tiles', 'م2', 'tiling', 30, 'rb-roof-tiles', ['شتايكر', 'تبليط سطح', 'roof tiles']],
  ['vinyl', 'أرضيات فينيل طبية', 'Medical vinyl flooring', 'م2', 'tiling', 40, 'rb-vinyl', ['فينيل', 'vinyl']],
  ['carpet', 'سجاد المصلى', 'Prayer hall carpet', 'م2', 'tiling', 150, 'rb-carpet', ['سجاد', 'موكيت', 'carpet']],
  // ── painting ──
  ['paint', 'صبغ داخلي بلاستيك', 'Internal emulsion paint', 'م2', 'painting', 80, 'r-paint-plastic', ['صبغ', 'صبغة', 'أصباغ', 'دهان', 'بلاستيك', 'paint', 'emulsion']],
  ['paint-external', 'صبغ واجهات خارجية', 'External paint', 'م2', 'painting', 60, 'rb-paint-ext', ['صبغ خارجي', 'external paint']],
  // ── carpentry ──
  ['doors', 'أبواب خشبية', 'Wooden doors', 'عدد', 'carpentry', 6, 'r-door-wood', ['باب خشب', 'أبواب', 'door']],
  ['doors-steel', 'أبواب حديدية', 'Steel doors', 'عدد', 'carpentry', 4, 'rb-door-steel', ['باب حديد', 'steel door']],
  ['kitchen', 'كاونترات مطابخ', 'Kitchen cabinets', 'م.ط', 'carpentry', 4, 'rb-kitchen', ['مطبخ', 'كاونتر', 'kitchen']],
  // ── aluminium / glazing ──
  ['windows', 'شبابيك ألمنيوم', 'Aluminium windows', 'م2', 'aluminium', 12, 'r-win-alu', ['شباك', 'شبابيك', 'ألمنيوم', 'window']],
  ['curtain-wall', 'واجهة زجاجية (كيرتن وول)', 'Curtain wall glazing', 'م2', 'aluminium', 10, 'rb-curtain', ['كيرتن', 'زجاج', 'curtain wall', 'glazing']],
  // ── electrical ──
  ['elec-rough', 'تمديدات كهربائية (أنابيب وعلب)', 'Electrical rough-in', 'نقطة', 'electrical', 25, 'rb-elec-rough', ['تمديدات كهربائية', 'أنابيب كهرباء', 'conduit', 'rough-in']],
  ['elec-final', 'أسلاك وتجهيزات كهربائية', 'Electrical wiring & fittings', 'نقطة', 'electrical', 30, 'rb-elec-final', ['أسلاك', 'تجهيزات كهربائية', 'wiring', 'fittings']],
  ['panel', 'لوحات توزيع كهربائية', 'Distribution boards', 'عدد', 'electrical', 1, 'r-panel', ['لوحة', 'بورد', 'distribution board', 'panel']],
  ['lighting-high', 'إنارة صناعية', 'High-bay lighting', 'عدد', 'electrical', 10, 'r-light', ['إنارة', 'lighting']],
  ['electrical', 'أعمال كهربائية', 'Electrical works', 'نقطة', 'electrical', 40, 'r-elec-point', ['كهرباء', 'electrical'], { legacy: true }],
  // ── plumbing ──
  ['plumb-rough', 'تمديدات مياه وصرف (نقطة)', 'Plumbing rough-in', 'نقطة', 'plumbing', 8, 'rb-plumb-rough', ['تمديدات صحية', 'مياه', 'صرف', 'plumbing']],
  ['sanitary', 'تجهيزات صحية', 'Sanitary fixtures', 'قطعة', 'plumbing', 6, 'r-sanitary', ['مغسلة', 'مغاسل', 'مرحاض', 'مرافق صحية', 'مرافق', 'كرسي', 'حمام', 'sanitary', 'fixtures']],
  ['water-tanks', 'خزانات ماء علوية مع التأسيس', 'Roof water tanks', 'عدد', 'plumbing', 2, 'rb-water-tank', ['خزان ماء', 'water tank']],
  ['plumbing', 'أعمال صحية', 'Plumbing works', 'قطعة', 'plumbing', 2, 'r-sanitary', ['صحية'], { legacy: true }],
  // ── HVAC ──
  ['split-ac', 'مكيفات سبلت (توريد ونصب)', 'Split AC units', 'عدد', 'hvac', 4, 'rb-split', ['مكيف', 'سبلت', 'split', 'air conditioner']],
  ['ducting', 'تكييف مركزي ومجاري هواء', 'Central HVAC & ducting', 'م2', 'hvac', 60, 'rb-hvac', ['تكييف مركزي', 'مجاري هواء', 'duct', 'hvac']],
  // ── insulation ──
  ['waterproofing', 'عزل مائي للسطح', 'Roof waterproofing', 'م2', 'insulation', 120, 'r-waterproof', ['عزل مائي', 'عزل سطح', 'لفائف', 'ممبرين', 'رطوبة السطح', 'waterproof', 'membrane']],
  ['thermal', 'عزل حراري', 'Thermal insulation', 'م2', 'insulation', 150, 'r-thermal', ['عزل حراري', 'بوليسترين', 'thermal insulation']],
  ['dpc', 'عزل رطوبة بيتوميني للأسس', 'Foundation damp-proofing', 'م2', 'insulation', 150, 'rb-dpc', ['قير', 'عزل رطوبة الأسس', 'أسس', 'أساسات', 'damp proof', 'bitumen']],
  // ── ceilings ──
  ['gypsum', 'سقوف ثانوية جبسن بورد', 'Gypsum board ceilings', 'م2', 'ceilings', 30, 'r-gypsum', ['جبس', 'سقف ثانوي', 'gypsum', 'false ceiling']],
  // ── steel ──
  ['steel-structure', 'هيكل حديدي (تجهيز ونصب)', 'Structural steel', 'طن', 'steel', 3, 'rb-steel-structure', ['هيكل حديدي', 'steel structure'], { equipment: { crane: 1 } }],
  ['sandwich-roof', 'سقف ساندويج بانل', 'Sandwich panel roofing', 'م2', 'steel', 80, 'r-canopy', ['ساندويج', 'sandwich panel', 'roofing']],
  ['sandwich-wall', 'تغليف جدران ساندويج بانل', 'Sandwich panel walls', 'م2', 'steel', 70, 'r-canopy', ['ساندويج جدران', 'wall cladding']],
  ['shutters', 'أبواب حديدية منزلقة (شتر)', 'Roller shutter doors', 'م2', 'steel', 10, 'rb-shutter', ['شتر', 'roller shutter']],
  ['canopy', 'مظلة سقف', 'Roof canopy', 'م2', 'steel', 30, 'r-canopy', ['مظلة', 'canopy'], { legacy: true }],
  // ── facade ──
  ['facade', 'تغليف واجهات ألكوبوند', 'ACP facade cladding', 'م2', 'facade', 15, 'r-cladding', ['كلادينغ', 'ألكوبوند', 'cladding', 'acp']],
  ['stone', 'تغليف واجهات بالحجر', 'Stone facade', 'م2', 'facade', 10, 'rb-stone', ['حجر', 'stone']],
  ['decor', 'زخارف وكتابات إسلامية', 'Islamic decoration & calligraphy', 'م2', 'facade', 4, 'rb-decor', ['زخارف', 'كتابات', 'decoration']],
  // ── external works ──
  ['interlock', 'تبليط ساحات مقرنص', 'Interlock paving', 'م2', 'external', 60, 'r-interlock', ['مقرنص', 'انترلوك', 'interlock', 'paving']],
  ['landscaping', 'تشجير وحدائق', 'Landscaping', 'م2', 'external', 100, 'rb-landscape', ['تشجير', 'حديقة', 'landscaping']],
  ['sewer', 'خطوط صرف خارجية', 'External sewer lines', 'م.ط', 'external', 20, 'r-sewer', ['مجاري', 'صرف خارجي', 'sewer']],
  ['septic', 'خزان تعفين وربط المجاري', 'Septic tank & connection', 'مقطوعية', 'external', 1, 'rb-septic', ['خزان تعفين', 'septic'], { fixedDays: 10 }],
  // ── specialist systems ──
  ['lift', 'مصعد كهربائي (توريد ونصب)', 'Passenger lift', 'عدد', 'systems', 0.04, 'rb-lift', ['مصعد', 'lift', 'elevator']],
  ['fire-alarm', 'منظومة إنذار حريق', 'Fire alarm system', 'نقطة', 'systems', 20, 'rb-fire-alarm', ['إنذار حريق', 'fire alarm']],
  ['fire-fighting', 'منظومة إطفاء رشاشات', 'Sprinkler system', 'م2', 'systems', 150, 'rb-fire-fighting', ['إطفاء', 'رشاشات', 'sprinkler']],
  ['medgas', 'منظومة غازات طبية', 'Medical gas outlets', 'عدد', 'systems', 4, 'rb-medgas', ['غازات طبية', 'medical gas']],
];

// Interchangeable work types: a BOQ line of one may take the place of
// another of the same family in a template (ceramic tiles where the
// template has porcelain…).
const FAMILY = {
  tiles: 'floor-finish',
  porcelain: 'floor-finish',
  marble: 'floor-finish',
  terrazzo: 'floor-finish',
  vinyl: 'floor-finish',
  'block-external': 'external-wall',
  'brick-external': 'external-wall',
  doors: 'doors',
  'doors-steel': 'doors',
  facade: 'cladding',
  stone: 'cladding',
};

/** The seeded work types (fresh objects each call). */
export const seedWorkTypes = () =>
  ROWS.map(([id, name, nameEn, unit, trade, productivity, rateId, keywords, extra = {}]) => ({
    id,
    name,
    nameEn,
    unit,
    trade,
    productivity,
    crew: { labour: CREW[trade] || 3, equipment: { ...(extra.equipment || {}) } },
    rateId,
    keywords: [...keywords],
    aliases: [],
    fixedDays: extra.fixedDays || null,
    family: FAMILY[id] || null,
    legacy: Boolean(extra.legacy),
    checked: false,
    source: 'seed',
    learned: null,
    history: [],
  }));

/* ─────────────── rates the work types use (added to the rate library) ─────────────── */

// [id, name, unit, unitPrice (IQD, direct cost), category]
export const BUILDING_RATES = [
  ['rb-mobilization', 'تحضيرات وتجهيز الموقع', 'مقطوعية', 15000000, 'أعمال عامة'],
  ['rb-testing', 'الفحص والتشغيل التجريبي', 'مقطوعية', 5000000, 'أعمال عامة'],
  ['rb-handover', 'التنظيف والتسليم النهائي', 'مقطوعية', 3000000, 'أعمال عامة'],
  ['rb-rc-footings', 'خرسانة مسلحة للقواعد (مع الحديد والقالب)', 'م3', 400000, 'خرسانة'],
  ['rb-rc-raft', 'خرسانة مسلحة للحصيرة (مع الحديد)', 'م3', 380000, 'خرسانة'],
  ['rb-rc-tiebeams', 'خرسانة مسلحة لجسور الربط', 'م3', 420000, 'خرسانة'],
  ['rb-rc-walls', 'خرسانة مسلحة لجدران السرداب', 'م3', 450000, 'خرسانة'],
  ['rb-rc-columns', 'خرسانة مسلحة للأعمدة', 'م3', 460000, 'خرسانة'],
  ['rb-rc-slab', 'خرسانة مسلحة للسقوف والجسور', 'م3', 430000, 'خرسانة'],
  ['rb-hordi-blocks', 'بلوك هوردي للسقوف', 'م2', 9000, 'خرسانة'],
  ['rb-rc-stairs', 'خرسانة مسلحة للدرج', 'م3', 480000, 'خرسانة'],
  ['rb-ground-slab', 'أرضية خرسانية على التربة', 'م3', 200000, 'خرسانة'],
  ['rb-dome', 'قبة خرسانية مسلحة', 'م3', 650000, 'خرسانة'],
  ['rb-minaret', 'منارة خرسانية مسلحة', 'م3', 600000, 'خرسانة'],
  ['rb-industrial-floor', 'أرضية صناعية مقواة', 'م2', 35000, 'خرسانة'],
  ['rb-fence', 'سياج خارجي (بلوك ومشبك)', 'م.ط', 180000, 'أعمال خارجية'],
  ['rb-screed', 'فرشة تسوية (سكريد)', 'م2', 7000, 'تشطيبات'],
  ['rb-porcelain', 'بلاط بورسلين', 'م2', 30000, 'تشطيبات'],
  ['rb-marble', 'مرمر للأرضيات', 'م2', 55000, 'تشطيبات'],
  ['rb-terrazzo', 'كاشي موزائيك', 'م2', 15000, 'تشطيبات'],
  ['rb-roof-tiles', 'تبليط سطح (شتايكر)', 'م2', 12000, 'تشطيبات'],
  ['rb-vinyl', 'أرضيات فينيل طبية', 'م2', 35000, 'تشطيبات'],
  ['rb-carpet', 'سجاد مصلى', 'م2', 35000, 'تشطيبات'],
  ['rb-paint-ext', 'صبغ واجهات خارجية', 'م2', 9000, 'تشطيبات'],
  ['rb-door-steel', 'باب حديدي', 'عدد', 350000, 'أبواب ونوافذ'],
  ['rb-kitchen', 'كاونتر مطبخ', 'م.ط', 350000, 'تشطيبات'],
  ['rb-curtain', 'واجهة زجاجية (كيرتن وول)', 'م2', 160000, 'أبواب ونوافذ'],
  ['rb-elec-rough', 'تمديدات كهربائية (نقطة)', 'نقطة', 8000, 'كهرباء'],
  ['rb-elec-final', 'أسلاك وتجهيزات كهربائية (نقطة)', 'نقطة', 12000, 'كهرباء'],
  ['rb-plumb-rough', 'تمديدات مياه وصرف (نقطة)', 'نقطة', 45000, 'صحية'],
  ['rb-water-tank', 'خزان ماء علوي مع التأسيس', 'عدد', 450000, 'صحية'],
  ['rb-split', 'مكيف سبلت (توريد ونصب)', 'عدد', 1100000, 'تكييف'],
  ['rb-hvac', 'تكييف مركزي ومجاري هواء (لكل م2 مخدوم)', 'م2', 70000, 'تكييف'],
  ['rb-dpc', 'عزل رطوبة بيتوميني للأسس', 'م2', 8000, 'عزل'],
  ['rb-steel-structure', 'هيكل حديدي (تجهيز ونصب)', 'طن', 2200000, 'هياكل حديدية'],
  ['rb-shutter', 'باب حديدي منزلق (شتر)', 'م2', 120000, 'هياكل حديدية'],
  ['rb-stone', 'تغليف واجهات بالحجر', 'م2', 60000, 'تشطيبات'],
  ['rb-decor', 'زخارف وكتابات إسلامية', 'م2', 120000, 'تشطيبات'],
  ['rb-landscape', 'تشجير وحدائق', 'م2', 8000, 'أعمال خارجية'],
  ['rb-septic', 'خزان تعفين وربط المجاري', 'مقطوعية', 6000000, 'أعمال خارجية'],
  ['rb-lift', 'مصعد كهربائي (توريد ونصب)', 'عدد', 45000000, 'أنظمة خاصة'],
  ['rb-fire-alarm', 'منظومة إنذار حريق (نقطة)', 'نقطة', 60000, 'أنظمة خاصة'],
  ['rb-fire-fighting', 'منظومة إطفاء رشاشات (لكل م2)', 'م2', 25000, 'أنظمة خاصة'],
  ['rb-medgas', 'منفذ غازات طبية', 'عدد', 900000, 'أنظمة خاصة'],
].map(([id, name, unit, unitPrice, category]) => ({ id, name, unit, unitPrice, category, checked: false }));

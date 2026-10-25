/* ═══════════════════════════════════════════════════════════════════
   RateLibrary — مكتبة أسعار البنود الإنشائية (IQD)
   Single source of truth for unit prices. Prices are COPY-ON-GENERATE:
   TemplateEngine snapshots them when a project is generated; editing
   the library afterwards never touches existing projects.
   Storage: localStorage key 'pm-rate-library' → { items: [...] }
   ═══════════════════════════════════════════════════════════════════ */

export const STORAGE_KEY = 'pm-rate-library';

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `rate_${Date.now()}_${Math.random().toString(36).slice(2)}`;

/* Default catalog: ~40 realistic Iraqi market items (mid-range IQD,
   editable by the user). id values are stable so PARTS.rateName /
   template lookups survive re-seeding. */
export const DEFAULT_RATES = [
  // ── خرسانة ──
  { id: 'r-conc-c25', name: 'خرسانة جاهزة C25', unit: 'م3', unitPrice: 190000, category: 'خرسانة' },
  { id: 'r-conc-c20', name: 'خرسانة جاهزة C20', unit: 'م3', unitPrice: 170000, category: 'خرسانة' },
  { id: 'r-conc-c30', name: 'خرسانة الهياكل C30', unit: 'م3', unitPrice: 210000, category: 'خرسانة' },
  { id: 'r-conc-plain', name: 'خرسانة عادية (نظافة)', unit: 'م3', unitPrice: 130000, category: 'خرسانة' },
  { id: 'r-conc-channel', name: 'قنوات خرسانية', unit: 'م3', unitPrice: 165000, category: 'خرسانة' },
  // ── حديد ──
  { id: 'r-rebar', name: 'حديد تسليح', unit: 'طن', unitPrice: 1250000, category: 'حديد' },
  { id: 'r-mesh', name: 'شبك حديد سلك ملمي', unit: 'م2', unitPrice: 9000, category: 'حديد' },
  // ── بناء ──
  { id: 'r-block20', name: 'بلوك 20 سم', unit: 'م2', unitPrice: 14000, category: 'بناء' },
  { id: 'r-block15', name: 'بلوك 15 سم', unit: 'م2', unitPrice: 12000, category: 'بناء' },
  { id: 'r-block10', name: 'بلوك 10 سم', unit: 'م2', unitPrice: 10000, category: 'بناء' },
  { id: 'r-brick-face', name: 'مباني طابوق وجه خارجي', unit: 'م2', unitPrice: 16000, category: 'بناء' },
  { id: 'r-mortar', name: 'ملاط بناء إسمنتي', unit: 'م3', unitPrice: 75000, category: 'بناء' },
  { id: 'r-formwork', name: 'قوالب خشبية (نجارة)', unit: 'م2', unitPrice: 12000, category: 'بناء' },
  // ── تشطيبات ──
  { id: 'r-plaster-in', name: 'تجليد داخلي (بلاستر)', unit: 'م2', unitPrice: 10000, category: 'تشطيبات' },
  { id: 'r-plaster-out', name: 'تجليد خارجي', unit: 'م2', unitPrice: 11000, category: 'تشطيبات' },
  { id: 'r-paint-plastic', name: 'صبغة بلاستيكية', unit: 'م2', unitPrice: 6000, category: 'تشطيبات' },
  { id: 'r-paint-oil', name: 'صبغة زيتية', unit: 'م2', unitPrice: 9000, category: 'تشطيبات' },
  { id: 'r-tiles', name: 'بلاط أرضي', unit: 'م2', unitPrice: 20000, category: 'تشطيبات' },
  { id: 'r-ceramic', name: 'سيراميك جدران', unit: 'م2', unitPrice: 18000, category: 'تشطيبات' },
  { id: 'r-interlock', name: 'انترلوك خارجي', unit: 'م2', unitPrice: 22000, category: 'تشطيبات' },
  { id: 'r-gypsum', name: 'سقف جبس', unit: 'م2', unitPrice: 18000, category: 'تشطيبات' },
  { id: 'r-hordi', name: 'سقف هوردى', unit: 'م2', unitPrice: 28000, category: 'تشطيبات' },
  // ── أعمال ترابية ──
  { id: 'r-excavation', name: 'أعمال حفر عام', unit: 'م3', unitPrice: 4000, category: 'أعمال ترابية' },
  { id: 'r-excav-found', name: 'حفر أساسات', unit: 'م3', unitPrice: 5000, category: 'أعمال ترابية' },
  { id: 'r-backfill', name: 'دفن ترابي', unit: 'م3', unitPrice: 6000, category: 'أعمال ترابية' },
  { id: 'r-base-course', name: 'طبقة أساس حجري', unit: 'م3', unitPrice: 30000, category: 'أعمال ترابية' },
  { id: 'r-site-prep', name: 'تجهيز موقع', unit: 'م2', unitPrice: 6000, category: 'أعمال ترابية' },
  // ── عزل ──
  { id: 'r-waterproof', name: 'عزل مائي', unit: 'م2', unitPrice: 12000, category: 'عزل' },
  { id: 'r-thermal', name: 'عزل حراري', unit: 'م2', unitPrice: 9000, category: 'عزل' },
  { id: 'r-bitumen', name: 'عزل أسطح بيتوميني (لفائف)', unit: 'م2', unitPrice: 14000, category: 'عزل' },
  // ── كهرباء ──
  { id: 'r-elec-point', name: 'أعمال كهربائية (نقطة)', unit: 'نقطة', unitPrice: 15000, category: 'كهرباء' },
  { id: 'r-cables', name: 'أسلاك وكابلات كهربائية', unit: 'متر', unitPrice: 6000, category: 'كهرباء' },
  { id: 'r-panel', name: 'لوحة توزيع رئيسية', unit: 'عدد', unitPrice: 450000, category: 'كهرباء' },
  { id: 'r-light', name: 'إنارة داخلية', unit: 'عدد', unitPrice: 85000, category: 'كهرباء' },
  // ── صحية ──
  { id: 'r-sanitary', name: 'أعمال صحية (تجهيزات)', unit: 'قطعة', unitPrice: 250000, category: 'صحية' },
  { id: 'r-pvc', name: 'أنابيب PVC', unit: 'متر', unitPrice: 12000, category: 'صحية' },
  { id: 'r-sewer', name: 'خطوط صرف صحي', unit: 'متر', unitPrice: 18000, category: 'صحية' },
  // ── أبواب ونوافذ ──
  { id: 'r-door-wood', name: 'باب خشبي', unit: 'عدد', unitPrice: 250000, category: 'أبواب ونوافذ' },
  { id: 'r-win-alu', name: 'شباك ألمنيوم', unit: 'م2', unitPrice: 75000, category: 'أبواب ونوافذ' },
  { id: 'r-cladding', name: 'واجهات كلادينغ', unit: 'م2', unitPrice: 45000, category: 'أبواب ونوافذ' },
  { id: 'r-canopy', name: 'مظلة معدنية (ساندويج بانل)', unit: 'م2', unitPrice: 35000, category: 'أبواب ونوافذ' },
];

export const RATE_CATEGORIES = [
  'خرسانة',
  'حديد',
  'بناء',
  'تشطيبات',
  'أعمال ترابية',
  'عزل',
  'كهرباء',
  'صحية',
  'أبواب ونوافذ',
];

const readStore = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/* Lazily seeds the default catalog when the key is missing (or unreadable)
   and returns the seeded items. Safe to call repeatedly. */
export const seedDefaults = () => {
  const store = readStore();
  if (store && Array.isArray(store.items)) return store.items;
  const items = DEFAULT_RATES.map((r) => ({ ...r }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items }));
  } catch {
    /* storage unavailable — in-memory defaults still returned */
  }
  return items;
};

export const loadRateLibrary = () => {
  const store = readStore();
  if (store && Array.isArray(store.items) && store.items.length > 0) return store.items;
  return seedDefaults();
};

export const saveRateLibrary = (items) => {
  const normalized = Array.isArray(items) ? items : [];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: normalized }));
  } catch {
    /* ignore write failures */
  }
  return normalized;
};

export const addRate = (partial) => {
  const items = loadRateLibrary();
  const item = {
    id: uid(),
    name: '',
    unit: '',
    unitPrice: 0,
    category: '',
    ...partial,
  };
  saveRateLibrary([...items, item]);
  return item;
};

export const updateRate = (id, patch) => {
  const next = loadRateLibrary().map((r) =>
    r.id === id ? { ...r, ...patch, id: r.id } : r
  );
  saveRateLibrary(next);
  return next.find((r) => r.id === id) || null;
};

export const deleteRate = (id) => {
  const next = loadRateLibrary().filter((r) => r.id !== id);
  saveRateLibrary(next);
  return next;
};

/* Exact-name lookup used by the template generator for price snapshotting. */
export const findRateByName = (items, name) =>
  (Array.isArray(items) ? items : []).find((r) => r && r.name === name) || null;

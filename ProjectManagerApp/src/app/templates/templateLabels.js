// Display labels for stored template data. Seeded templates and the rate
// categories are stored in Arabic; these map them to dictionary keys at
// display time only (stored values never change). Custom names show as-is.

const SEED_TEMPLATE_NAME_KEYS = {
  'مدرسة': 'templates.nameSchool',
  'بناية سكنية (شقق)': 'templates.nameApartment',
  'مول تجاري': 'templates.nameMall',
  'بيت': 'templates.nameHouse',
  'فيلا': 'templates.nameVilla',
};

const CATEGORY_KEYS = {
  'خرسانة': 'templates.catConcrete',
  'حديد': 'templates.catSteel',
  'بناء': 'templates.catMasonry',
  'تشطيبات': 'templates.catFinishes',
  'أعمال ترابية': 'templates.catEarthworks',
  'عزل': 'templates.catInsulation',
  'كهرباء': 'templates.catElectrical',
  'صحية': 'templates.catPlumbing',
  'أبواب ونوافذ': 'templates.catDoorsWindows',
  'أخرى': 'templates.catOther',
  'أعمال عامة': 'templates.catGeneral',
  'هياكل حديدية': 'templates.catSteelStructure',
  'تكييف': 'templates.catHvac',
  'أنظمة خاصة': 'templates.catSystems',
  'أعمال خارجية': 'templates.catExternal',
};

// Building templates (schema 2) carry their own English name (nameEn).
export const templateName = (tpl, t, lang) => {
  if (!tpl) return '';
  if (tpl.nameEn && lang === 'en') return tpl.nameEn;
  if (tpl.nameEn) return tpl.name || '';
  return tpl.source === 'seed' && SEED_TEMPLATE_NAME_KEYS[tpl.name] ? t(SEED_TEMPLATE_NAME_KEYS[tpl.name]) : tpl.name || '';
};

/** A template variable's label in the UI language. */
export const variableLabel = (variable, lang) => (lang === 'en' && variable.labelEn ? variable.labelEn : variable.label || variable.key);

export const categoryLabel = (category, t) => (CATEGORY_KEYS[category] ? t(CATEGORY_KEYS[category]) : category);

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
};

export const templateName = (tpl, t) =>
  tpl && tpl.source === 'seed' && SEED_TEMPLATE_NAME_KEYS[tpl.name] ? t(SEED_TEMPLATE_NAME_KEYS[tpl.name]) : tpl?.name || '';

export const categoryLabel = (category, t) => (CATEGORY_KEYS[category] ? t(CATEGORY_KEYS[category]) : category);

// ar dictionary — module: templates
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  // ── Header + tabs ──
  'templates.pageTitle': 'التخطيط الآلي — النماذج ومكتبة الأسعار',
  'templates.pageSub': 'حوّل نموذجاً معيارياً (مدرسة، بناية، مول…) إلى شجرة مهام كاملة بالكميات والأسعار والمدد والعلاقات.',
  'templates.tabTemplates': 'النماذج',
  'templates.tabRates': 'مكتبة الأسعار',
  'templates.tabEditor': 'إنشاء نموذج',

  // ── Seeded template display names (storage keeps the Arabic name) ──
  'templates.nameSchool': 'مدرسة',
  'templates.nameApartment': 'بناية سكنية (شقق)',
  'templates.nameMall': 'مول تجاري',
  'templates.nameHouse': 'بيت',
  'templates.nameVilla': 'فيلا',

  // ── Closed set of rate/part categories (display mapping only) ──
  'templates.catConcrete': 'خرسانة',
  'templates.catSteel': 'حديد',
  'templates.catMasonry': 'بناء',
  'templates.catFinishes': 'تشطيبات',
  'templates.catEarthworks': 'أعمال ترابية',
  'templates.catInsulation': 'عزل',
  'templates.catElectrical': 'كهرباء',
  'templates.catPlumbing': 'صحية',
  'templates.catDoorsWindows': 'أبواب ونوافذ',
  'templates.catOther': 'أخرى',

  // ── Template cards ──
  'templates.cardMeta': '{vars} متغير · {elements} بند',
  'templates.deleteTemplateTitle': 'حذف النموذج',
  'templates.confirmDeleteTemplate': 'حذف هذا النموذج نهائياً؟',
  'templates.emptyTemplates': 'لا توجد نماذج — أنشئ نموذجاً من تبويب «إنشاء نموذج».',

  // ── Detail panel: variables form ──
  'templates.startDate': 'تاريخ البداية',

  // ── Warning strip for unpriced items ──
  'templates.warningUnpricedLabel': 'بنود بلا سعر في المكتبة ({count}):',
  'templates.warningMore': 'وغيرها…',
  'templates.warningFix': '— أضفها في تبويب «مكتبة الأسعار» ليتم تسعيرها.',

  // ── Totals ──
  'templates.totalItems': 'عدد الفقرات',
  'templates.totalGroups': 'المجموعات',
  'templates.totalPriced': 'البنود المسعرة',
  'templates.totalCost': 'الكلفة الكلية',

  // ── Preview table ──
  'templates.colItem': 'البند',
  'templates.colUnitPrice': 'سعر الوحدة',
  'templates.colCost': 'الكلفة',
  'templates.colDuration': 'المدة (يوم)',
  'templates.generate': '⚡ توليد المشروع ({count} فقرة)',

  // ── Rate library tab ──
  'templates.searchRates': 'بحث بالاسم أو التصنيف…',
  'templates.rateNamePlaceholder': 'اسم البند',
  'templates.rateUnitPlaceholder': 'الوحدة (م2، م3، طن…)',
  'templates.unitPriceIqd': 'سعر الوحدة (د.ع)',
  'templates.colCategory': 'التصنيف',
  'templates.noRatesMatch': 'لا توجد بنود مطابقة للبحث.',
  'templates.copyNote': 'الأسعار تُنسخ عند التوليد — تعديلها لاحقاً لا يؤثر على المشاريع المُنشأة.',

  // ── Save current project as template ──
  'templates.saveProjectAsTemplate': 'حفظ المشروع الحالي كنموذج',
  'templates.fromProjectNamePlaceholder': 'اسم النموذج (مثال: مشروعي القياسي)',
  'templates.fromProjectHint': 'يُستخرج نموذج بكميات ثابتة من شجرة مهام المشروع الحالي (المجموعات والفقرات بدون متغيرات).',

  // ── Template editor ──
  'templates.editorTitle': 'محرر النماذج',
  'templates.templateNamePlaceholder': 'اسم النموذج (مثال: مستوصف)',
  'templates.iconPlaceholder': 'أيقونة',
  'templates.variablesTitle': 'المتغيرات',
  'templates.varKeyPlaceholder': 'المفتاح (لاتيني)',
  'templates.varLabelPlaceholder': 'التسمية',
  'templates.varDefaultPlaceholder': 'الافتراضي',
  'templates.addVariable': '+ متغير',
  'templates.elementsTitle': 'البنود',
  'templates.addElement': '+ بند',
  'templates.itemSelectTitle': 'البند',
  'templates.groupPlaceholder': 'القسم (مثال: الأساسات)',
  'templates.formulaPlaceholder': 'معادلة الكمية (مثال: floors*area*0.34)',
  'templates.repeatsTitle': 'التكرار لكل',
  'templates.noRepeat': 'بدون تكرار',
  'templates.repeatsPerVar': 'يتكرر حسب {name}',
  'templates.dependsOnTitle': 'يعتمد على',
  'templates.noDependency': 'بدون اعتماد',
  'templates.linkTypeTitle': 'نوع العلاقة',
  'templates.lagTitle': 'المدة الفاصلة (Lag)',
  'templates.saveTemplateBtn': '💾 حفظ النموذج',

  // ── Creation-time defaults (blank editor rows) ──
  'templates.defaultAreaVarLabel': 'المساحة (م2)',
  'templates.defaultNewVarLabel': 'متغير جديد',
  'templates.defaultGroup': 'الأعمال الرئيسية',

  // ── Notices (stored as keys, translated at render) ──
  'templates.noticeNameRequired': 'أدخل اسم النموذج أولاً.',
  'templates.noticeNeedElement': 'أضف بنداً واحداً على الأقل للنموذج.',
  'templates.noticeSaved': 'تم حفظ النموذج بنجاح — تجده الآن في تبويب «النماذج».',
  'templates.noticeNoTasks': 'لا توجد مهام في المشروع الحالي لحفظها كنموذج.',
  'templates.noticeProjectSaved': 'تم حفظ المشروع الحالي كنموذج (كميات ثابتة بدون متغيرات).',
};

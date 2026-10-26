// ar dictionary — module: activity
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  // ── header ──
  'activity.title': 'النشاط والسجل',
  'activity.subtitle':
    'كل أمر عمل ومصروف وأمر تغيير وحدث في التطبيق، مسجّل بتاريخه ومنسوب لصاحبه — الوجه المرئي لسجل الأحداث.',

  // ── tabs ──
  'activity.tabFeed': 'السجل الزمني',
  'activity.tabTask': 'سجل فقرة',
  'activity.tabHeatmap': 'خريطة النشاط',

  // ── feed filter chips ──
  'activity.chipAll': 'كل',
  'activity.chipValue': 'أوامر العمل',
  'activity.chipExpense': 'المصاريف',
  'activity.chipVariation': 'أوامر التغيير',
  'activity.chipEvent': 'أحداث',

  // ── feed filters ──
  'activity.fromDate': 'من',
  'activity.toDate': 'إلى',
  'activity.actorLabel': 'المسجّل',
  'activity.actorPlaceholder': 'تصفية حسب المسجّل…',
  'activity.entryCount': '{n} مدخل',
  'activity.feedEmpty': 'لا توجد مدخلات مطابقة للفلاتر المحددة.',
  'activity.loadMore': 'عرض المزيد ({n} متبقي)',

  // ── tab 2: per-task history ──
  'activity.taskSearchPlaceholder': 'ابحث عن فقرة (الرمز أو الاسم)…',
  'activity.executedFromLog': 'المنفذة (من السجل)',
  'activity.executedValue': 'القيمة المنفذة',
  'activity.contractValue': 'القيمة التعاقدية',
  'activity.recordings': 'التسجيلات',
  'activity.ofWhichApproved': 'منها {n} معتمد',
  'activity.taskEmptyStory': 'لا توجد تسجيلات أو أحداث مرتبطة بهذه الفقرة بعد.',

  // ── tab 3: heatmap ──
  'activity.scope': 'النطاق',
  'activity.scopeWholeProject': 'المشروع كامل',
  'activity.legendLess': 'أقل',
  'activity.legendMore': 'أعلى',
  'activity.recordedDays': 'أيام مسجلة (آخر 90 يوماً)',
  'activity.emptyDays': 'أيام فارغة (آخر 90 يوماً)',
  'activity.emptyDayNote': 'يوم بدون تسجيل — قد يكون هناك عمل غير مسجل',
  'activity.approvedValue': 'القيمة المعتمدة',
  'activity.orderCountUnit': 'أمر',
  'activity.dayAriaLabel': '{date}: {value} — {count} أمر',
  'activity.dayDetailsTitle': 'تفاصيل يوم',
  'activity.emptyDayWarning':
    'يوم بدون تسجيل — قد يكون هناك عمل غير مسجل. اضغط يوماً آخر في الخريطة لاستعراضه.',

  // sparse weekday gutter labels (rows run Saturday → Friday)
  'activity.weekdaySat': 'سبت',
  'activity.weekdayMon': 'اثنين',
  'activity.weekdayWed': 'أربعاء',
  'activity.weekdayFri': 'جمعة',

  // ── order types + feed fallback titles (ActivityLog.js) ──
  'activity.typeQuickWork': 'عمل سريع',
  'activity.typeCompletion': 'أمر إنجاز',
  'activity.typeConcreteTest': 'فحص كونكريت',
  'activity.typeSoilTest': 'فحص تربة',
  'activity.typeMaterial': 'استلام مواد',
  'activity.typePayroll': 'رواتب',
  'activity.typeMachinery': 'أجور معدات',
  'activity.typeFuel': 'وقود',
  'activity.typeOtherExpense': 'مصروف آخر',
  'activity.defaultOrderTitle': 'أمر عمل',
  'activity.variationUnitPrice': 'أمر تغيير — سعر الوحدة',
  'activity.variationContractQty': 'أمر تغيير — الكمية التعاقدية',
  'activity.defaultEventTitle': 'حدث',
  // ── rebuilt Activity (Phase 5) ──
  'activity.pickTask': 'اختر فقرة لعرض سجلها كاملاً.',

  // ── أنواع أحداث التطبيق (kind في pm-activity، تظهر تحت الحدث) ──
  'activity.kind.certificate': 'ذرعة',
  'activity.kind.lifecycle': 'حالة المشروع',
  'activity.kind.project': 'المشروع',
  'activity.kind.template': 'قالب',
  'activity.kind.other': 'حدث',

  // ── السجل الزمني من الخادم (تغييرات الجميع) ──
  'activity.sourceServer': 'تغييرات الجميع، من سجل الخادم.',
  'activity.sourceOffline': 'بلا اتصال: تظهر تسجيلات هذا الجهاز. تظهر تغييرات الجميع عند عودة الاتصال.',
  'activity.sourceFail': 'تعذّرت قراءة الخادم: تظهر تسجيلات هذا الجهاز.',
  'activity.waitingTitle': 'بانتظار المزامنة ({n})',
  'activity.typeLabel': 'النوع',
  'activity.type.all': 'الكل',
  'activity.type.value': 'أوامر العمل',
  'activity.type.expense': 'المصاريف',
  'activity.type.variation': 'أوامر التغيير',
  'activity.type.plan': 'بنود الخطة',
  'activity.type.diary': 'يومية الموقع',
  'activity.type.delays': 'التأخيرات',
  'activity.type.certificates': 'الذرعات',
  'activity.type.photos': 'الصور والملفات',
  'activity.type.events': 'الأحداث',
  'activity.type.shared': 'الأشخاص والقوالب والأسعار',
  'activity.personLabel': 'الشخص',
  'activity.everyone': 'الجميع',
  'activity.loadOlder': 'تحميل تغييرات أقدم',
  'activity.loading': 'جارٍ التحميل…',
  'activity.retry': 'إعادة المحاولة',

  // ── تبويب: ماذا فعل شخص ──
  'activity.tabPerson': 'حسب الشخص',
  'activity.periodLabel': 'الفترة',
  'activity.period.today': 'اليوم',
  'activity.period.week': 'آخر 7 أيام',
  'activity.period.month': 'آخر 30 يوماً',
  'activity.period.custom': 'تواريخ…',
  'activity.pickPerson': 'اختر شخصاً لترى ما قام به.',
  'activity.personEmpty': 'لا شيء من {name} في هذه الفترة.',
  'activity.statChanges': 'التغييرات',
  'activity.statDays': 'أيام النشاط',
  'activity.statWaiting': 'بانتظار المزامنة',
  'activity.statRefused': 'لم يُعتمَد',
  'activity.statOrders': 'الأوامر',
  'activity.statVariations': 'أوامر التغيير',
  'activity.statEvents': 'الأحداث',
  'activity.byType': 'حسب النوع',
  'activity.personLocalHint': 'بلا خادم، الأشخاص هم الأسماء المسجّلة على هذا الجهاز.',
};

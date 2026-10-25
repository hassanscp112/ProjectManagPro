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

  // ── feed entry figures ──
  'activity.amount': 'المبلغ',
  'activity.value': 'القيمة',

  // ── who attribution (registries lookup) ──
  'activity.whoContractor': 'المقاول: {name}',
  'activity.whoContractorOnly': 'مقاول',
  'activity.whoTeam': 'الفريق: {name}',
  'activity.whoTeamOnly': 'فريق',
  'activity.whoWorkers': 'العمال: {names}',
  'activity.whoWorkersMore': 'العمال: {names} +{extra}',
  'activity.whoWorkersOnly': 'عمال',
  'activity.listSeparator': '، ',

  // ── tab 2: per-task history ──
  'activity.taskSearchPlaceholder': 'ابحث عن فقرة (الرمز أو الاسم)…',
  'activity.taskClearSelection': 'إلغاء الاختيار',
  'activity.taskNoMatch': 'لا توجد فقرة مطابقة للبحث.',
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
  'activity.ordersRecorded': 'أوامر مسجلة',
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
};

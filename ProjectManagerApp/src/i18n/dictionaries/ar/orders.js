// ar dictionary — module: orders
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  // ── Order type labels (OrderEngine display metadata) ──
  'orders.typeQuickWork': 'أمر عمل سريع',
  'orders.typeCompletion': 'أمر استلام / إنجاز',
  'orders.typeConcreteTest': 'أمر فحص خرسانة',
  'orders.typeSoilTest': 'أمر فحص تربة',
  'orders.typeMaterial': 'شراء مواد',
  'orders.typePayroll': 'رواتب',
  'orders.typeMachinery': 'آليات ومعدات',
  'orders.typeFuel': 'وقود',
  'orders.typeOtherExpense': 'مصروف آخر',

  // ── Field labels (shared across types) ──
  'orders.fWorkDate': 'تاريخ العمل',
  'orders.fTestDate': 'تاريخ الفحص',
  'orders.fContractor': 'المقاول المنفذ',
  'orders.fTask': 'الفقرة',
  'orders.fTaskOptional': 'الفقرة (اختياري)',
  'orders.fElement': 'العنصر',
  'orders.fSampleRef': 'رقم النموذج',
  'orders.fResult': 'النتيجة',
  'orders.fDepth': 'العمق',
  'orders.fAmount': 'المبلغ',
  'orders.fRecipient': 'المستفيد',
  'orders.fDescription': 'البيان',
  'orders.fNote': 'ملاحظة',

  // ── Field placeholders ──
  'orders.phUnit': 'م3',
  'orders.phLocationCompletion': 'مثال: منظم 12 — 0+250',
  'orders.phLocationConcrete': 'مثال: منظم 3 — 0+950',
  'orders.phLocationSoil': 'مثال: 0+250 يمين القناة',
  'orders.phHandoverNote': 'ملاحظات الاستلام',
  'orders.phSampleRef': 'مثال: C25-041',
  'orders.phResult': 'مثال: 28.5 MPa',
  'orders.phDepth': 'مثال: 2.5 م',
  'orders.phDensity': 'كثافة الحقل …',
  'orders.phMaterial': 'نوع المواد ومكان الشراء',
  'orders.phPayroll': 'عن الفترة / عدد الأيام …',
  'orders.phMachinery': 'الآلية وعدد الساعات',
  'orders.phFuel': 'الآلية وعدد اللترات',
  'orders.phOther': 'وصف المصروف',

  // ── Families / groups ──
  'orders.familyValue': 'قيمة / إنجاز',
  'orders.familyExpense': 'مصروف',

  // ── Who widget (recipient / contractor) ──
  'orders.unknownContractor': 'مقاول غير معروف',
  'orders.unknownTeam': 'فريق غير معروف',
  'orders.workerCount': '{n} عامل',
  'orders.listSep': '، ',

  // ── Element select ──
  'orders.noElement': '— بدون عنصر —',
  'orders.elementFallback': 'عنصر',

  // ── KPI strip ──
  'orders.kpiTodayOrders': 'أوامر العمل اليوم',
  'orders.kpiTodayQty': 'كميات اليوم',
  'orders.kpiTodayExpenses': 'مصاريف اليوم',
  'orders.kpiWeekOrders': 'أوامر الأسبوع',
  'orders.kpiWeekExpenses': 'مصاريف الأسبوع',

  // ── New-order card ──
  'orders.newOrder': '⚡ أمر جديد',
  'orders.fillRequired': 'الرجاء تعبئة: {fields}',
  'orders.currencySuffix': 'د.ع',

  // ── Orders log ──
  'orders.logTitle': 'سجل الأوامر',
  'orders.logCount': '{count} أمر',
  'orders.filteredTag': 'مصفّى',
  'orders.clearFilters': 'مسح التصفية',
  'orders.fromDate': 'من تاريخ',
  'orders.toDate': 'إلى تاريخ',
  'orders.allTypes': 'كل الأنواع',
  'orders.contractor': 'المقاول',
  'orders.allParties': 'كل الجهات',
  'orders.task': 'الفقرة',
  'orders.allTasks': 'كل الفقرات',
  'orders.party': 'الجهة',
  'orders.qtyOrAmount': 'الكمية / المبلغ',
  'orders.noMatching': 'لا توجد أوامر مطابقة بعد.',
  'orders.approveOrder': 'اعتماد الأمر',
  'orders.deleteOrder': 'حذف الأمر',

  // ── Modals ──
  'orders.deleteConfirmTitle': 'تأكيد حذف الأمر',
  'orders.deleteConfirmText':
    'سيتم حذف {type} بتاريخ {date}{taskRef}. هذا الإجراء لا يمكن التراجع عنه.',
  'orders.approveText':
    'ادخل اسم المعتمد لاعتماد {type} بتاريخ {date}. بعد الاعتماد تُحتسب الكمية ضمن المنفذ.',
  'orders.approverPlaceholder': 'اسم المعتمد / التوقيع',

  // Photo evidence
  'orders.photosButton': 'صور الأمر ({n})',
  'orders.photosTitle': 'صور {type} · {date}',
  'orders.photosLoadFailed': 'تعذّر تحميل الصور من هذا الجهاز.',
  'orders.deleteConfirmPhotos': 'ستُحذف صوره أيضاً ({n}).',
};

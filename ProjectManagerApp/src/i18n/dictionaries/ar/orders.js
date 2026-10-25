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
  'orders.groupValue': 'في العمل',
  'orders.groupExpense': 'في المصاريف',

  // ── Who widget (recipient / contractor) ──
  'orders.whoKindContractor': 'مقاول',
  'orders.whoKindTeam': 'فريق',
  'orders.whoKindWorkers': 'عمال',
  'orders.whoKindNone': 'بدون',
  'orders.noContractor': '— بدون مقاول —',
  'orders.chooseContractor': '— اختر المقاول —',
  'orders.chooseTeam': '— اختر الفريق —',
  'orders.noRecipient': 'بدون مستفيد محدد',
  'orders.noWorkers': 'لا يوجد عمال في السجلات — أضفهم من شاشة سجلات الموارد.',
  'orders.unknownContractor': 'مقاول غير معروف',
  'orders.unknownTeam': 'فريق غير معروف',
  'orders.workerCount': '{n} عامل',
  'orders.listSep': '، ',

  // ── Element select ──
  'orders.noElements': '— لا توجد عناصر لهذه الفقرة —',
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
  'orders.newOrderSub': 'كل عمل في الموقع يُسجَّل من هنا — اختر النوع، املأ الحقول، احفظ.',
  'orders.saveOrder': 'حفظ الأمر',
  'orders.quickTierHint': 'أمر سريع — يُعتمد فور الحفظ.',
  'orders.formalTierHint': 'أمر نظامي — يُسجَّل بحالة «مسجّل» ويحتاج اعتماداً صريحاً.',
  'orders.pickTypeHint':
    'اختر نوع الأمر من الأعلى للبدء — الأوامر السريعة تُعتمد فوراً، والنظامية تحتاج اعتماداً.',
  'orders.fillRequired': 'الرجاء تعبئة: {fields}',
  'orders.currencySuffix': 'د.ع',

  // ── Flash messages ──
  'orders.flashSaved': '✓ تم تسجيل {type} بنجاح',
  'orders.flashSavedApproved': '✓ تم تسجيل {type} واعتماده بنجاح',
  'orders.flashApproved': '✓ تم اعتماد الأمر',
  'orders.flashDeleted': 'تم حذف الأمر',

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
  'orders.theOrder': 'الأمر',

  // ── Modals ──
  'orders.deleteConfirmTitle': 'تأكيد حذف الأمر',
  'orders.deleteConfirmText':
    'سيتم حذف {type} بتاريخ {date}{taskRef}. هذا الإجراء لا يمكن التراجع عنه.',
  'orders.approveText':
    'ادخل اسم المعتمد لاعتماد {type} بتاريخ {date}. بعد الاعتماد تُحتسب الكمية ضمن المنفذ.',
  'orders.approverPlaceholder': 'اسم المعتمد / التوقيع',

  // ── OrderTypePicker ──
  'orders.tierFormal': 'نظامي',
  'orders.formalChipHint': 'أمر نظامي — يبدأ بحالة «مسجّل» ويتطلب اعتماداً',
  'orders.quickChipHint': 'أمر سريع — يُعتمد فور الحفظ',

  // ── TaskPicker ──
  'orders.taskPickerOptional': 'فقرة (اختياري) — ابحث…',
  'orders.taskPickerSearch': 'ابحث عن فقرة…',
  'orders.removeTask': 'إزالة الفقرة',
  'orders.noMatchingTasks': 'لا توجد فقرات مطابقة',
  'orders.unnamedTask': 'فقرة بدون اسم',
  'orders.moreTasks': '… و{n} فقرة أخرى — حسّن البحث',
};

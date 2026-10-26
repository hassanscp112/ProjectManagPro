// ar dictionary — module: taskDetails
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  /* ---------- generic ---------- */
  'taskDetails.untitledItem': 'فقرة بدون اسم',
  'taskDetails.dayOne': '{n} يوم',
  'taskDetails.daysMany': '{n} يوم',

  /* ---------- header badges & counters ---------- */
  'taskDetails.groupBadge': 'مجموعة',
  'taskDetails.workItemBadge': 'بند تنفيذي',
  'taskDetails.signedContract': 'تعاقد معتمد',
  'taskDetails.elementOne': '{n} عنصر',
  'taskDetails.elementsMany': '{n} عنصر',
  'taskDetails.boqOne': '{n} بند كميات',
  'taskDetails.boqMany': '{n} بند كميات',
  'taskDetails.orderOne': '{n} أمر',
  'taskDetails.ordersMany': '{n} أمر',

  /* ---------- mode toggle ---------- */
  'taskDetails.viewModeAria': 'وضع العرض',
  'taskDetails.view': 'عرض',
  'taskDetails.editTitleSigned': 'المشروع موقّع — الكميات والأسعار التعاقدية تبقى مقفلة حتى داخل التعديل',

  /* ---------- element status (values stay codes) ---------- */
  'taskDetails.status.not_started': 'لم يبدأ',
  'taskDetails.status.in_progress': 'قيد التنفيذ',
  'taskDetails.status.completed': 'مكتمل',
  'taskDetails.status.on_hold': 'متوقف',

  /* ---------- read: quantities ---------- */
  'taskDetails.secQuantities': 'ماذا وماكم',
  'taskDetails.secQuantitiesSub': '(الكميات حسب النوع)',
  'taskDetails.overallProgress': 'إنجاز الفقرة الإجمالي',
  'taskDetails.rollupFromChildren': 'التجميع تلقائي من {n} بند فرعي (موزون بالقيمة)',
  'taskDetails.executedOfTotal': 'المنفذ {executed} من {total} {unit}',
  'taskDetails.qtyTypeFallback': 'نوع كمية',
  'taskDetails.linkedBoqTitle': 'مرتبط ببند كميات (BOQ) — الكميات تُدار من العناصر',
  'taskDetails.statContract': 'تعاقدي',
  'taskDetails.statExecuted': 'منفذ',
  'taskDetails.statRemaining': 'متبقي',
  'taskDetails.wasteChip': 'هدر {n}%',
  'taskDetails.wasteChipTitle': 'نسبة الهدر المضافة على مجموع العناصر',
  'taskDetails.elementSumLabel': 'مجموع العناصر: {n}',
  'taskDetails.reconDelta': '(فرق {n})',
  'taskDetails.reconMatch': '(مطابق)',
  'taskDetails.calcQuantityNote': 'كمية حسابية من العناصر — غير مرتبطة ببند BOQ',

  /* ---------- read: elements map ---------- */
  'taskDetails.secWorkStatus': 'أين وصل العمل',
  'taskDetails.locationStation': 'الموقع / المحطة',
  'taskDetails.hideCompleted': 'إخفاء المكتملة',
  'taskDetails.showCompleted': 'إظهار المكتملة',

  /* ---------- read: orders feed ---------- */
  'taskDetails.secOrders': 'من يعمل وما الجديد',
  'taskDetails.rollupTitle': 'المقاولون على هذه الفقرة:',
  'taskDetails.unknownContractor': 'مقاول غير معروف',
  'taskDetails.executedQtyLabel': 'كمية منفذة',
  'taskDetails.expensesLabel': 'مصاريف',

  /* ---------- read: money ---------- */
  'taskDetails.secMoney': 'المال',
  'taskDetails.moneyContract': 'قيمة الفقرة التعاقدية',
  'taskDetails.moneyExecuted': 'القيمة المنفذة',
  'taskDetails.moneyDeviation': 'الانحراف المالي',
  'taskDetails.moneyExpenses': 'المصاريف المرتبطة',
  'taskDetails.moneyExecSubGroup': 'Σ من البنود الفرعية',
  'taskDetails.moneyExecSubLeaf': 'الكمية المنفذة × سعر الوحدة',
  'taskDetails.moneyDevMatch': 'مطابق للقيمة التعاقدية',
  'taskDetails.moneyDevOver': 'تجاوز القيمة التعاقدية',
  'taskDetails.moneyDevUnder': 'دون القيمة التعاقدية',
  'taskDetails.moneyExpensesSub': 'من أوامر العمل على هذه الفقرة وبنودها',

  /* ---------- read: evidence ---------- */
  'taskDetails.secEvidence': 'الأدلة',
  'taskDetails.evidenceTests': 'فحصات (خرسانة / تربة)',
  'taskDetails.evidenceCompletions': 'أوامر استلام / إنجاز',

  /* ---------- sub-items (read + edit) ---------- */
  'taskDetails.secChildren': 'البنود الفرعية',
  'taskDetails.childrenEmptyRead': 'لا توجد بنود فرعية لهذه الفقرة بعد.',
  'taskDetails.childrenEmptyEdit': 'لا توجد بنود فرعية بعد. أضفها من هنا أو مباشرةً من الجدول — ستظهر هنا تلقائياً.',
  'taskDetails.colCode': 'الرمز',
  'taskDetails.colExecutedQty': 'المنفذة',
  'taskDetails.colUnitPrice': 'سعر الوحدة',
  'taskDetails.managedFromElements': 'تُدار من مجموع عناصر الفقرة',
  'taskDetails.approvedContractQty': 'كمية تعاقدية معتمدة',
  'taskDetails.typeGroup': 'مجموعة',
  'taskDetails.typeManual': 'يدوي',
  'taskDetails.openChildDetails': 'فتح تفاصيل هذا البند',
  'taskDetails.deleteChild': 'حذف البند',
  'taskDetails.childNamePlaceholder': 'اسم البند',

  /* ---------- edit: help banner + summary cards ---------- */
  'taskDetails.helpTitle': 'كيف يعمل هذا؟',
  'taskDetails.helpPre': 'أضف العناصر (مثل المنظمات) وأدخل كمياتها حسب النوع (C25، C20، C7 ...). سيُحسب المجموع تلقائياً لكل نوع، ومن خلال تفعيل',
  'taskDetails.helpKey': 'بند الكميات',
  'taskDetails.helpPost': 'يُنشأ بند فرعي في الجدول (BOQ) ترتبط كميته بهذا المجموع مباشرةً.',

  /* ---------- edit: quantity types manager ---------- */
  'taskDetails.secQtyTypes': 'أنواع الكميات والمجاميع',
  'taskDetails.colQtyType': 'نوع الكمية',
  'taskDetails.colWaste': 'هدر %',
  'taskDetails.colTotalWithWaste': 'المجموع (مع الهدر)',
  'taskDetails.colBoq': 'بند الكميات (BOQ)',
  'taskDetails.namePlaceholder': 'مثال: C25',
  'taskDetails.unitPlaceholder': 'م3',
  'taskDetails.wasteTitle': 'نسبة الهدر/الفاقد (مثال: 5 تعني +5% على المجموع)',
  'taskDetails.rawLabel': 'الخام: {n}',
  'taskDetails.boqLinkedFallback': 'مرتبط',
  'taskDetails.unlinkTitle': 'فصل البند (يبقى موجوداً ويحتفظ بآخر قيمة)',
  'taskDetails.newBoqTitle': 'إنشاء بند كميات جديد ومربوط بالمجموع',
  'taskDetails.linkExistingTitle': 'ربط المجموع ببند كميات موجود مسبقاً (القيمة التعاقدية تبقى كما هي للمطابقة)',
  'taskDetails.recordOnly': 'سجل فقط',
  'taskDetails.deleteType': 'حذف النوع',
  'taskDetails.confirmDeleteType': 'حذف نوع الكمية "{name}"؟ سيتم حذف قيمه من جميع العناصر.',

  /* ---------- edit: elements table ---------- */
  'taskDetails.secElements': 'العناصر',
  'taskDetails.elementsNeedType': 'أضف نوع كمية واحداً على الأقل قبل إدخال العناصر.',
  'taskDetails.elementNamePlaceholder': 'مثال: HR-1',
  'taskDetails.deleteElement': 'حذف العنصر',

  // read: evidence photos
  'taskDetails.evidencePhotos': 'الصور',
  'taskDetails.evidenceLatestPhotos': 'أحدث الصور',
};

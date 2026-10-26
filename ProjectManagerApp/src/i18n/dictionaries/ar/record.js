// ar dictionary — module: record (the rebuilt Record area, src/app/record/).
// Order types, field labels and log wording are reused from orders.*.
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  // Sub-pages
  'record.tabNew': 'أمر جديد',
  'record.tabLog': 'سجل الأوامر',
  'record.tabPending': 'بانتظار الاعتماد',

  // Type picker
  'record.whatToRecord': 'ماذا تريد أن تسجّل؟',
  'record.groupValueHint': 'في العمل — يُحسب في الإنجاز',
  'record.groupExpenseHint': 'في المصاريف — يُحسب في الكلفة الفعلية',
  'record.tierQuick': 'سريع · يُعتمد فوراً',
  'record.tierFormal': 'رسمي · يحتاج اعتماد',
  'record.repeatLast': 'كرّر آخر أمر',

  // Form
  'record.required': 'مطلوب',
  'record.save': 'حفظ',
  'record.saveNext': 'حفظ وتسجيل التالي',
  'record.enterHint': 'Enter للحفظ · يبقى النوع نفسه مفتوحاً للتسجيل التالي',
  'record.qtyStatus': 'منجز {done} من {total} {unit} · المتبقي {left}',
  'record.unitHint': 'اكتب الوحدة إن لم تكن محددة للفقرة',

  // Results
  'record.savedApproved': '{type} — سُجّل واعتُمد',
  'record.savedRecorded': '{type} — سُجّل، بانتظار الاعتماد',
  'record.approved': 'تم اعتماد الأمر',
  'record.deleted': 'تم حذف الأمر',
  'record.doneTitle': 'تم التسجيل',
  'record.doneApproved': 'معتمد — ظهر في الجدول والتقرير اليومي',
  'record.doneRecorded': 'محفوظ كمسجّل — بانتظار الاعتماد',
  'record.againSameType': 'تسجيل أمر آخر من نفس النوع',
  'record.otherType': 'نوع آخر',
  'record.backHome': 'العودة للرئيسية',

  // Side panel / lists
  'record.today': 'سُجّل اليوم',
  'record.todayEmpty': 'لم يُسجَّل شيء اليوم بعد.',
  'record.pendingEmptyTitle': 'لا شيء بانتظار الاعتماد',
  'record.pendingEmptyBody': 'الأوامر الرسمية (الاستلام وفحوص الخرسانة والتربة) تبقى هنا حتى يعتمدها أحد.',
  'record.logEmptyBody': 'غيّر التصفية أو سجّل أمراً جديداً.',
  'record.showAll': 'عرض الكل',
  'record.filters': 'تصفية',
  'record.approverLabel': 'اسم المعتمِد',

  // Photos
  'record.saving': 'جارٍ الحفظ…',
  'record.photosPreparing': 'جارٍ تجهيز الصور…',
  'record.photosNotSaved': 'حُفظ الأمر بدون صوره',
  'record.photosNotSavedBody': 'تعذّر حفظ الصور على هذا الجهاز (المساحة ممتلئة أو التخزين محظور).',
  'record.donePhotos': 'الصور المرفقة: {n}',

  // Warnings before saving ("Save anyway?")
  'record.warnTitle': 'الحفظ على أي حال؟',
  'record.warnIntro': 'راجِع ما يلي قبل الحفظ:',
  'record.saveAnyway': 'احفظ على أي حال',
  'record.warnBack': 'رجوع',
  'record.warnDuplicate': 'يوجد أمر مسجَّل مطابق لهذا: النوع والبند والتاريخ والكمية والجهة نفسها.',
  'record.warnOverLeft': 'الكمية {qty} {unit} أكبر من المتبقي في عقد هذا البند ({left} {unit}).',
  'record.warnOverLeftPending': 'الكمية {qty} {unit} أكبر من المتبقي في عقد هذا البند ({left} {unit}، بعد {pending} {unit} بانتظار الاعتماد).',
  'record.warnAmountOutlier': 'المبلغ {amount} أكبر من {factor} أضعاف المعتاد لهذا النوع (الوسيط {median}).',
  'record.warnFutureDate': 'التاريخ في المستقبل (اليوم {today}).',
  'record.warnBeforeStart': 'التاريخ قبل بداية المشروع ({start}).',

  // Who may approve
  'record.cannotApproveOwn': 'أنت من سجّله',
  'record.cannotApproveRole': 'دورك لا يسمح بالاعتماد',
  'record.cannotApproveCertified': 'ضمن ذرعة مُصدَرة',
  'record.notApproved': 'لم يُعتمد',
  'record.cannotApproveOwnBody': 'الأمر الذي سجّلته يعتمده شخص آخر.',
  'record.cannotApproveRoleBody': 'دورك في هذا المشروع لا يشمل اعتماد الأوامر.',

  // Locked by an issued payment certificate
  'record.inCertificate': 'ضمن الذرعة رقم {number}',
  'record.inCertificateMain': 'ضمن ذرعة العقد الرئيسي رقم {number}',
  'record.inCertificateShort': 'ذرعة {number}',
  'record.certificateSub': 'الذرعة رقم {number} · {party}',
  'record.certificateMain': 'ذرعة العقد الرئيسي رقم {number}',
  'record.lockedTitle': 'هذا الأمر ضمن ذرعة مُصدَرة',
  'record.lockedDelete': 'لا يمكن حذفه: الذرعة المُصدَرة تبقى كما صدرت تماماً.',
  'record.lockedApprove': 'لا يمكن اعتماده مرة أخرى: الذرعة المُصدَرة تبقى كما صدرت تماماً.',
  'record.lockedIn': 'شملته:',
};

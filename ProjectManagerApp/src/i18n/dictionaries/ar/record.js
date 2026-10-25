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
};

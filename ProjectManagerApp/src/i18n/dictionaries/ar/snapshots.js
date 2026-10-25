// ar dictionary — module: snapshots
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  // ── header ──
  'snapshots.title': 'النسخ ونقاط الاستعادة',
  'snapshots.subtitle':
    'لقطات كاملة لحالة المشروع (الفقرات والخط الأساس وأوامر التغيير) — لاستعادة سريعة ولعرض «كيف كان المشروع» في لحظة معينة. سجل النشاط يوثّق ما حدث، وهذه النسخ تحفظ الشكل الكامل للبيانات وقت أخذها.',

  // ── summary strip ──
  'snapshots.statAutoCount': 'عدد النسخ اليومية',
  'snapshots.statNamedCount': 'النسخ المسماة',
  'snapshots.statSize': 'الحجم',
  'snapshots.sizeUnit': 'كيلوبايت',

  // ── section 1: automatic daily checkpoints ──
  'snapshots.autoTitle': 'النسخ اليومية التلقائية',
  'snapshots.autoHint': 'تُحفظ آخر 14 يوماً فقط',
  'snapshots.autoEmpty':
    'لا توجد نسخ يومية بعد. تُنشأ نسخة تلقائياً عند أول تعديل يقع في المشروع خلال اليوم — احتياطٌ سريع لحالة نهاية كل يوم عمل دون أي تدخل منك.',
  'snapshots.colDate': 'التاريخ',
  'snapshots.colCreatedTime': 'وقت الإنشاء',
  'snapshots.colTasksCount': 'عدد الفقرات',
  'snapshots.colVariations': 'أوامر التغيير',
  'snapshots.createdBy': 'أنشأها: {name}',
  'snapshots.leafTasksHint': '{n} فقرة فعّالة (غير المجموعات)',

  // ── section 2: named snapshots ──
  'snapshots.namedTitle': 'النسخ المسماة',
  'snapshots.namedHint': 'نقاط استعادة يحتفظ بها المستخدم — لا تُحذف تلقائياً',
  'snapshots.namePlaceholder': 'اسم النسخة (مثال: تقرير أيلول، قبل التسليم)…',
  'snapshots.createNow': '+ إنشاء نسخة الآن',
  'snapshots.createTitle': 'حفظ نسخة من حالة المشروع الحالية بالاسم المُدخل',
  'snapshots.namedEmpty':
    'لا توجد نسخ مسماة بعد. أنشئ نسخة قبل المحاولات الكبيرة أو عند كل تقرير مهم — مثلاً «قبل التسليم» أو «تقرير أيلول» — لتعود إليها وقت الحاجة.',
  'snapshots.colName': 'الاسم',
  'snapshots.colTasks': 'الفقرات',

  // ── actions ──
  'snapshots.restore': 'استعادة',
  'snapshots.rename': 'إعادة تسمية',

  // ── confirm dialogs ──
  'snapshots.deleteConfirm': 'حذف النسخة المسماة «{name}» نهائياً؟ لا يمكن التراجع عن الحذف.',
  'snapshots.restoreConfirm':
    'سيتم استبدال بيانات المشروع الحالية (الفقرات والخط الأساس وأوامر التغيير) بمحتوى النسخة «{label}».\nهذا الإجراء لا يمكن التراجع عنه مباشرة — يمكنك فقط استعادة نسخة أخرى بعدها.\nهل تريد المتابعة؟',

  // ── scope note card ──
  'snapshots.scopeNoteTitle': 'ماذا تغطي هذه النسخ؟',
  'snapshots.scopeNote':
    'تلتقط النسخ فقرات المشروع كاملة مع الخط الأساس وأوامر التغيير وحالة المشروع. أوامر العمل والتخطيط والحسابات وغيرها تحتفظ بتخزينها الخاص ولا تتأثر بالاستعادة. النسخة الاحتياطية الكاملة (كامل ملف البيانات) تبقى متاحة من شريط أدوات الجدول.',
};

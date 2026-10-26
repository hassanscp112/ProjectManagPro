// ar dictionary — module: finance
export default {
  // Screen header / summary cards / tabs
  'finance.totalCosts': 'إجمالي التكاليف (المشروع)',
  'finance.cardMachinery': 'الآليات (شامل الوقود)',
  'finance.cardMaterials': 'المواد الإنشائية',
  'finance.cardPettyCash': 'المصاريف اليومية',
  'finance.cardPayroll': 'الرواتب',

  // Shared ledger UI
  'finance.dateFrom': 'من تاريخ',
  'finance.dateTo': 'إلى تاريخ',
  'finance.all': 'الكل',
  'finance.thAction': 'إجراء',
  'finance.periodTotal': 'الإجمالي للفترة:',

  // Machinery ledger
  'finance.addMachineryRecord': 'إضافة سجل آلية شامل',
  'finance.machineType': 'نوع الآلية',
  'finance.driverName': 'اسم السائق',
  'finance.thMachine': 'الآلية',
  'finance.thDriver': 'السائق',
  'finance.thFuelCost': 'تكلفة الوقود',
  'finance.thTotalPrice': 'السعر الكلي',

  // Materials ledger
  'finance.addMaterialRecord': 'إضافة سجل مواد',
  'finance.receiptNo': 'رقم الوصل',
  'finance.materialType': 'نوع المادة',
  'finance.thMaterial': 'المادة',
  'finance.thDetails': 'التفاصيل',
  'finance.saveRecord': 'حفظ السجل',

  // Petty cash ledger
  'finance.addPettyExpense': 'إضافة مصروف يومي',
  'finance.expenseType': 'نوع المصروف',
  'finance.thAmount': 'المبلغ',

  // Payroll ledger
  'finance.paySalary': 'تسديد راتب',
  'finance.filterEmployee': 'اسم الموظف',
  'finance.savePayment': 'حفظ الدفعة',
  'finance.thBaseSalary': 'الراتب الأساسي',
  'finance.thAdvanceStatus': 'السلفة (الحالة)',
  'finance.thNetPaid': 'المبلغ المدفوع (الصافي)',

  // Settings tab
  'finance.settingsDesc': 'يمكنك تعديل أسماء الموظفين والآليات وأنواع المصاريف التي تظهر في القوائم المنسدلة في كافة شاشات الإدخال.',
  'finance.cfgMachines': 'أنواع الآليات',
  'finance.cfgEmployees': 'أسماء الموظفين والعمال',
  'finance.cfgMaterials': 'أنواع المواد الإنشائية',
  'finance.cfgExpenseTypes': 'أنواع المصاريف اليومية',
  'finance.cfgMachineSizes': 'أحجام الآليات',
  'finance.cfgStatuses': 'حالات السلفة',
  'finance.addNewPlaceholder': 'إضافة جديد...',
  // ── rebuilt Finance (Phase 6) ──
  'finance.tabMachineryShort': 'الآليات',
  'finance.tabMaterialsShort': 'المواد',
  'finance.tabPettyCashShort': 'النثريات',
  'finance.tabPayrollShort': 'الرواتب',
  'finance.tabLists': 'القوائم',
  'finance.addRecord': 'إضافة سجل',
  'finance.noRecords': 'لا سجلات مطابقة.',
  'finance.count': '{n} سجل',
  'finance.costLine': '{h} ساعة × {rate} = {total}',
  'finance.liters': '{n} لتر',
  'finance.removeItem': 'حذف {item}',
  // ── Ledgers as views over expense orders (WS7) ──
  'finance.addAsOrder': 'يُحفظ كأمر مصروف — ويظهر في سجل الأوامر أيضاً',
  'finance.unitPriceLine': '× {price} للوحدة',
  // The old ledger and its one-time move into expense orders
  'finance.legacyTitle': 'سجل المالية القديم غير ظاهر في هذه الجداول بعد',
  'finance.legacyBody':
    'المصاريف تُسجَّل الآن كأوامر مصروف، وهذه الجداول تعرض تلك الأوامر. ما زال في السجل القديم {n} سجل ({total}). انقلها مرة واحدة: تُنزَّل نسخة احتياطية أولاً، ويبقى السجل القديم محفوظاً للقراءة فقط.',
  'finance.legacyNoRight': 'يستطيع نقلها من لديه صلاحية تعديل المالية.',
  'finance.migrateButton': 'مراجعة النقل ({n} سجل)',
  'finance.migrateMoreButton': 'نقل {n} أخرى',
  'finance.migrateTitle': 'نقل السجل القديم إلى أوامر مصروف',
  'finance.migrateIntro': 'تجربة بلا تنفيذ — لم يتغير شيء بعد. كل سجل قديم يصبح أمر مصروف معتمداً بتاريخه ومبلغه الأصليين.',
  'finance.migrateLedger': 'السجل',
  'finance.migrateBecomes': '← {type}',
  'finance.migrateOldRecords': 'السجلات القديمة',
  'finance.migrateOldTotal': 'المجموع القديم',
  'finance.migrateAlready': 'نُقلت سابقاً',
  'finance.migrateToAdd': 'للنقل',
  'finance.migrateAddTotal': 'المبلغ المنقول',
  'finance.migrateAll': 'كل السجلات',
  'finance.migrateStepBackup': 'أولاً تُنزَّل نسخة احتياطية كاملة (before-finance-migration).',
  'finance.migrateStepOrders': 'ثم يصبح كل سجل أمر مصروف معتمداً: نفس التاريخ ونفس المبلغ، مسجَّلاً باسم من أدخله أصلاً أو باسمك.',
  'finance.migrateStepKept': 'السجل القديم لا يُحذف أبداً: يبقى كما هو للقراءة فقط. وإعادة النقل لا تضيف أي سجل مرتين.',
  'finance.migrateConfirm': 'تنزيل النسخة الاحتياطية ونقل {n}',
  'finance.migrating': 'جارٍ النقل…',
  'finance.migrateBackupFailed': 'تعذّر عمل النسخة الاحتياطية، لذلك لم يُنقل شيء.',
  'finance.migrateDone': 'نُقل {n} سجل إلى أوامر المصروف',
  'finance.migratedOn': 'نُقل السجل القديم إلى أوامر مصروف بتاريخ {date} بواسطة {name} ({n} سجل). وهو محفوظ للقراءة فقط.',
  'finance.someone': 'مستخدم',
  'finance.migrateNewSince': 'أُضيف {n} سجل إلى السجل القديم بعد ذلك.',
  'finance.migrateCheck': 'مقارنة السجل القديم بأوامره',
  'finance.migrateOrders': 'الأوامر',
  'finance.migrateOrdersTotal': 'مجموع الأوامر',
};

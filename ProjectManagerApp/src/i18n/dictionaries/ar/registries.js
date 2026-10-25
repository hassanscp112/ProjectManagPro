// ar dictionary — module: registries
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  'registries.title': 'سجل الجهات المنفّذة',
  'registries.subtitle':
    'سجل موحّد يخدم أوامر العمل والتخطيط اليومي وحسابات الأجور: المقاولون (شركات)، ' +
    'العمال (أفراد بأجر يومي)، وفرق العمل (تجميعات من العمال بعريف واحد).',

  // Tabs + summary strip
  'registries.tabContractors': 'المقاولون',
  'registries.tabTeams': 'فرق العمل',
  'registries.tabWorkers': 'العمال',
  'registries.currentIdentity': 'المستخدم الحالي',
  'registries.identityUnset': 'غير محدد',
  'registries.identityRoleHint': 'حدّد من يستخدم التطبيق لختم التقارير والحسابات باسمه',
  'registries.change': 'تغيير',
  'registries.identityPick': 'تحديد المستخدم',

  // Section actions
  'registries.addContractor': '+ إضافة مقاول',
  'registries.addTeam': '+ إضافة فريق',
  'registries.addWorker': '+ إضافة عامل',
  'registries.newTeam': 'فريق جديد',

  // Empty states
  'registries.contractorsEmpty':
    'أضف المقاولين الذين يعملون على الموقع — كل أمر عمل سيُنسب لاحقاً إلى أحدهم.',
  'registries.teamsEmpty':
    'أنشئ فرق العمل من العمال المسجلين وحدّد لكل فريق عريفاً — ' +
    'تُنسب أوامر العمل والتخطيط اليومي إلى هذه الفرق.',
  'registries.workersEmpty':
    'أضف عمال الموقع مع مهنتهم وأجر يومهم — تُستخدم هذه البيانات لتشكيل الفرق وحساب الأجور اليومية.',

  // Table headers / labels
  'registries.colContractorName': 'اسم المقاول',
  'registries.colPhone': 'الهاتف',
  'registries.colTrade': 'المهنة',
  'registries.colDailyRate': 'أجر اليوم ({unit})',
  'registries.colForeman': 'العريف',
  'registries.colMembers': 'الأعضاء',
  'registries.colDefaultSize': 'الحجم الافتراضي',
  'registries.currencyUnit': 'د.ع',

  // Placeholders / hints / titles
  'registries.contractorNamePh': 'اسم المقاول / الشركة',
  'registries.contractorNotesPh': 'نطاق العمل، رقم العقد…',
  'registries.teamNamePh': 'اسم الفريق (مثال: فريق التبططين)',
  'registries.teamNotesPh': 'موقع العمل المعتاد، المعدات المرافقة…',
  'registries.workerNamePh': 'اسم العامل',
  'registries.tradePh': 'المهنة',
  'registries.dailyRateTitle': 'أجر اليوم بالدينار العراقي',
  'registries.noForeman': '— بدون عريف —',
  'registries.unnamed': 'بدون اسم',
  'registries.noWorkersHint':
    'لا يوجد عمال مسجلون بعد — أضف عمالاً من تبويب «العمال» ثم شكّل الفريق من بينهم.',
  'registries.foremanChipTitle': 'عريف الفريق',
  'registries.memberChipTitle': 'عضو في الفريق',
  'registries.sizeTitle':
    'الحجم المعتاد للفريق — يتبع عدد الأعضاء تلقائياً حتى تعدّله يدوياً (امسحه للعودة إلى التلقائي)',
  'registries.sizeResetTitle': 'العودة إلى الحجم التلقائي (عدد الأعضاء)',
  'registries.sizeAuto': 'تلقائي',
  'registries.sizeReset': '↻ تلقائي',
  'registries.deleteContractorTitle': 'حذف المقاول',
  'registries.deleteTeamTitle': 'حذف الفريق',
  'registries.deleteWorkerTitle': 'حذف العامل',

  // Confirm dialogs ({name} / {count} interpolated)
  'registries.confirmDeleteContractor': 'حذف المقاول "{name}"؟',
  'registries.confirmDeleteTeam': 'حذف الفريق "{name}"؟',
  'registries.confirmDeleteWorker': 'حذف العامل "{name}"؟',
  'registries.confirmDeleteWorkerTeams': ' سيُزال تلقائياً من {count} من الفرق.',

  // Trade suggestions (workers datalist)
  'registries.tradeGeneral': 'عامل',
  'registries.tradeHelper': 'مساعد عامل',
  'registries.tradeSteelFixer': 'حداد',
  'registries.tradeFormworkFixer': 'حداد قوالب',
  'registries.tradeCarpenter': 'نجار',
  'registries.tradeElectrician': 'كهربائي',
  'registries.tradeWelder': 'لحّام',
  'registries.tradeMechanic': 'ميكانيكي',
  'registries.tradeDriver': 'سائق',
  'registries.tradeSurveyor': 'مساح',
  'registries.tradeLabTechnician': 'مختبر',
  'registries.tradeInspector': 'مراقب فني',

  // Identity picker modal
  'registries.idpTitle': 'من يستخدم التطبيق؟',
  'registries.idpText': 'يُستخدم الاسم والدور لختم التقارير اليومية وأوامر العمل والحسابات باسمك.',
  'registries.idpNamePh': 'الاسم (مثال: م. أحمد كريم)',
  'registries.idpRolePh': 'الدور (مثال: مهندس موقع)',
  'registries.roleSiteEngineer': 'مهندس موقع',
  'registries.roleSiteManager': 'مدير موقع',
  'registries.roleEngineer': 'مهندس',
  'registries.roleSurveyor': 'مساح',
  'registries.roleInspector': 'مراقب فني',
  'registries.roleAccountant': 'محاسب',
  'registries.roleStorekeeper': 'مسؤول مستودع',

  // resolveWho display strings (utils/Registries.js)
  'registries.whoContractor': 'مقاول: {name}',
  'registries.whoTeam': 'فريق: {name}',
  'registries.whoWorkers': 'عمال: {names}',
  'registries.whoWorkersMore': 'عمال: {names} +{count}',
};

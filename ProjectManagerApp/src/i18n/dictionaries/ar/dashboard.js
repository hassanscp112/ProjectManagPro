// ar dictionary — module: dashboard
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  'dashboard.welcome': 'مرحباً بك في نظام إدارة المشاريع.',
  'dashboard.welcomeSubtitle':
    'اختر وحدة وظيفية أساسية لإدارة المهام، الأصول، والتدفقات المالية داخل النظام.',

  // Task-status summary cards
  'dashboard.cardOverdue': 'مهام متأخرة (عالية الأولوية)',
  'dashboard.cardActive': 'قيد التنفيذ (متوسطة الأولوية)',
  'dashboard.cardUpcoming': 'مهام قادمة',
  'dashboard.cardCompleted': 'مهام مكتملة',

  // Earned Value Management
  'dashboard.evmTitle': 'تحليل قيمة العمل المكتسبة (EVM — Earned Value Management)',
  'dashboard.evmBac': 'الميزانية الإجمالية (BAC)',
  'dashboard.evmPv': 'القيمة المخططة (PV)',
  'dashboard.evmEv': 'القيمة المكتسبة (EV)',
  'dashboard.evmAc': 'التكلفة الفعلية (AC)',
  'dashboard.evmSpi': 'مؤشر الأداء الزمني (SPI)',
  'dashboard.evmCpi': 'مؤشر أداء التكلفة (CPI)',
  'dashboard.evmEac': 'التكلفة المتوقعة عند الإكمال (EAC)',
  'dashboard.evmVac': 'الانحراف عند الإكمال (VAC)',
  'dashboard.aheadOfSchedule': 'متقدم على الجدول',
  'dashboard.behindSchedule': 'متأخر عن الجدول',
  'dashboard.underBudget': 'تحت الميزانية',
  'dashboard.overBudget': 'فوق الميزانية',
  'dashboard.budgetOverrun': 'تجاوز الميزانية',

  // S-curve
  'dashboard.scurveTitle': 'منحنى القيمة (S-Curve)',
  'dashboard.scurveSubtitle':
    'القيمة المخططة (PV) مقابل المكتسبة (EV) مقابل التكلفة الفعلية (AC) عبر زمن المشروع.',
  'dashboard.scurveEmpty': 'لا توجد بيانات كافية لرسم منحنى القيمة. أضف فقرات بمواعيد وأسعار أولاً.',
  'dashboard.seriesPv': 'المخططة (PV)',
  'dashboard.seriesEv': 'المكتسبة (EV)',
  'dashboard.seriesAc': 'الفعلية (AC)',
  'dashboard.todayMarker': 'اليوم',
  // Compact axis units (leading space on purpose in Arabic)
  'dashboard.unitBillion': ' مليار',
  'dashboard.unitMillion': ' مليون',
  'dashboard.unitThousand': ' ألف',

  // Per-WBS EVM table
  'dashboard.wbsTitle': 'تحليل EVM حسب الفقرة الرئيسية (WBS)',
  'dashboard.wbsSubtitle':
    'مؤشر الأداء الزمني (SPI) وأداء التكلفة (CPI) لكل مجموعة رئيسية، مع الميزانية (BAC) والتكلفة الفعلية (AC).',
  'dashboard.colCode': 'الرمز',
  'dashboard.colItemCount': 'عدد البنود',
  'dashboard.colBac': 'BAC ({unit})',
  'dashboard.colPv': 'PV ({unit})',
  'dashboard.colEv': 'EV ({unit})',
  'dashboard.colAc': 'AC ({unit})',
  'dashboard.currencyUnit': 'د.ع',

  // Required-tasks (action items) table
  'dashboard.actionTitle': 'المهام المطلوبة (حسب الأولوية)',
  'dashboard.colTaskName': 'اسم المهمة',
  'dashboard.colStartDate': 'تاريخ البدء',
  'dashboard.colEndDate': 'تاريخ الانتهاء',
  'dashboard.colProgress': 'نسبة الإنجاز',
  'dashboard.colPriority': 'الأولوية / الحالة',
  'dashboard.noActionItems': 'لا توجد مهام مطلوبة حالياً.',
  'dashboard.priorityCritical': 'متأخرة (عالية)',
  'dashboard.priorityMedium': 'قيد التنفيذ (متوسطة)',
  'dashboard.priorityLow': 'تبدأ قريباً (عادية)',
};

// ar dictionary — module: dashboard
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {

  // Earned Value Management
  'dashboard.evmTitle': 'تحليل قيمة العمل المكتسبة (EVM — Earned Value Management)',
  'dashboard.evmBac': 'الميزانية الإجمالية (BAC)',
  'dashboard.evmPv': 'القيمة المخططة (PV)',
  'dashboard.evmEv': 'القيمة المكتسبة (EV)',
  'dashboard.evmAc': 'التكلفة الفعلية (AC)',
  'dashboard.evmEac': 'التكلفة المتوقعة عند الإكمال (EAC)',
  'dashboard.evmVac': 'الانحراف عند الإكمال (VAC)',
  'dashboard.aheadOfSchedule': 'متقدم على الجدول',
  'dashboard.behindSchedule': 'متأخر عن الجدول',
  'dashboard.underBudget': 'تحت الميزانية',
  'dashboard.overBudget': 'فوق الميزانية',

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
  'dashboard.wbsSubtitle':
    'مؤشر الأداء الزمني (SPI) وأداء التكلفة (CPI) لكل مجموعة رئيسية، مع الميزانية (BAC) والتكلفة الفعلية (AC).',

};

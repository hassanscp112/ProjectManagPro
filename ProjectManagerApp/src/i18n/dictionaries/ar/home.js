// ar dictionary — module: home (the rebuilt Home screen, src/app/home/).
// EVM labels, chart series and units are reused from dashboard.*.
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  // Headline numbers
  'home.progressActual': 'الإنجاز الفعلي',
  'home.plannedOf': 'المخطط {value}',
  'home.spi': 'أداء الجدول (SPI)',
  'home.cpi': 'أداء الكلفة (CPI)',
  'home.ev': 'القيمة المكتسبة (EV)',
  'home.ofBac': 'من قيمة العقد {bac}',
  'home.deviation': 'انحراف {value} نقطة عن المخطط',
  'home.actualCost': 'الكلفة الفعلية {ac}',
  'home.watch': 'يحتاج متابعة',

  // Needs attention
  'home.attention': 'يحتاج انتباهك',
  'home.countOverdue': '{n} متأخرة',
  'home.countActive': '{n} جارية',
  'home.countUpcoming': '{n} تبدأ قريباً',
  'home.countDone': '{n} مكتملة',
  'home.statusCounts': 'حالة الفقرات',
  'home.dueWas': 'كان موعدها {date}',
  'home.dueOn': 'تنتهي {date}',
  'home.startsOn': 'تبدأ {date}',
  'home.critical': 'حرجة',
  'home.pctDone': '{pct} منجز',
  'home.allClear': 'لا شيء متأخر أو قريب',
  'home.allClearBody': 'كل الفقرات ضمن موعدها.',
  'home.openSchedule': 'عرض الجدول الزمني',
  'home.moreInSchedule': 'و {n} أخرى في الجدول الزمني',

  // Sections + orders
  'home.sections': 'التقدم حسب الأقسام',
  'home.sectionFigures': '{ev} من {bac}',
  'home.recent': 'آخر ما سُجّل',
  'home.recentEmpty': 'لم تُسجَّل أوامر بعد.',
  'home.allOrders': 'سجل الأوامر',

  // S-curve
  'home.evmFigures': 'أرقام القيمة المكتسبة',
  'home.sCurveAria': 'منحنى S: المخطط {pv} والمكتسب {ev} والفعلي {ac} حتى اليوم',
};

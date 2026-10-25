// ar dictionary — module: gantt
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  // Data-grid column headers
  'gantt.colId': 'المعرّف',
  'gantt.colItem': 'الفقرة',
  'gantt.colDays': 'الأيام',
  'gantt.colAmount': 'مبلغ الفقرة',
  'gantt.colProgress': 'الإنجاز',
  'gantt.colStart': 'تاريخ البدء',
  'gantt.colEnd': 'تاريخ الانتهاء',
  'gantt.colPredecessor': 'السابقة',
  'gantt.colRelation': 'العلاقة',
  'gantt.colLag': 'الفجوة',
  // Dependencies
  'gantt.noDependency': 'بدون سابقة',
  'gantt.notFound': 'غير موجود: {id}',
  'gantt.depFS': 'FS انتهاء → بدء',
  'gantt.depSS': 'SS بدء → بدء',
  'gantt.depFF': 'FF انتهاء → انتهاء',
  'gantt.depSF': 'SF بدء → انتهاء',
  // Locked cells (signed contract / managed values)
  'gantt.lockedFromDetails': 'تُدار من تفاصيل الفقرة (العناصر)',
  'gantt.lockedContractQty': 'كمية تعاقدية معتمدة — تُعدّل عبر أمر تغيير',
  'gantt.lockedContractPrice': 'سعر تعاقدي معتمد — يُعدّل عبر أمر تغيير',
  'gantt.lockedContractUnit': 'وحدة تعاقدية معتمدة',
  'gantt.autoFromWorkOrders': 'محسوبة تلقائياً من أوامر العمل',
  // Timeline & tooltips
  'gantt.todayOutOfRange': 'تاريخ اليوم (خارج نطاق المشروع)',
  'gantt.todayPlanned': 'تاريخ اليوم (نسبة الانجاز المخطط)',
  'gantt.actualProgress': 'الانجاز الفعلي: {value}%',
  'gantt.plannedProgress': 'الانجاز المخطط: {value}%',
  'gantt.days': '{n} يوم',
  'gantt.onCriticalPath': 'على المسار الحرج',
  // Row actions & editing
  'gantt.viewItemFiles': 'عرض ملفات الفقرة',
  'gantt.itemDetailsElements': 'تفاصيل الفقرة والعناصر',
  'gantt.addMainGroup': 'إضافة مجموعة رئيسية جديدة',
  'gantt.addSub': 'فرعية',
};

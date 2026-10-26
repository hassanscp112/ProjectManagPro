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
  'gantt.onCriticalPath': 'على المسار الحرج',
  // Row actions & editing
  'gantt.addMainGroup': 'إضافة مجموعة رئيسية جديدة',
  // Several predecessors in one cell
  'gantt.colPredecessors': 'الفقرات السابقة',
  'gantt.linksHelp': 'أرقام الفقرات، مثل 2.1FS+3; 2.4SS — نوع العلاقة FS/SS/FF/SF (FS إن لم يُكتب)، والتأخير بأيام العمل، وأضف d لأيام التقويم',
  'gantt.linksInvalid': 'غير موجودة: {items}',
};

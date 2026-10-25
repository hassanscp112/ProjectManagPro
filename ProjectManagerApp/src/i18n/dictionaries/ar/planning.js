// ar dictionary — module: planning
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  // Shell
  'planning.title': 'التخطيط المتدرج',
  'planning.subtitle':
    'الخطة الرئيسية تحدد ما يجب إنجازه هذا الشهر — خطط الأسابيع والأيام متجددة ومؤقتة، وتثبت أرقامها كلما اقترب الأفق.',
  'planning.viewMonth': 'شهري',
  'planning.viewWeek': 'أسبوعي',
  'planning.viewDay': 'يومي',

  // Period navigation
  'planning.prevMonth': 'الشهر السابق',
  'planning.prevWeek': 'الأسبوع السابق',
  'planning.prevDay': 'اليوم السابق',
  'planning.nextMonth': 'الشهر التالي',
  'planning.nextWeek': 'الأسبوع التالي',
  'planning.nextDay': 'اليوم التالي',
  'planning.weekLabel': 'الأسبوع {week} / {year}',
  'planning.goToToday': 'الانتقال السريع إلى تاريخ اليوم',

  // whoLabel affixes (PlanningStore)
  'planning.countUnspecified': 'لم يُحدد العدد',
  'planning.oneWorker': 'عامل واحد',
  'planning.twoWorkers': 'عاملان',
  'planning.workersCount': '{count} عامل',
  'planning.teamPrefix': 'فريق:',
  'planning.teamUnspecified': 'فريق غير محدد',
  'planning.contractorPrefix': 'مقاول:',
  'planning.contractorUnspecified': 'مقاول غير محدد',
  'planning.workersUnspecified': 'لم يُحدد عمال',
  'planning.unnamed': 'بدون اسم',
  'planning.workerFallback': 'عامل',
  'planning.listSeparator': '، ',

  // WhoPicker
  'planning.whoModeCount': 'عدد',
  'planning.whoModeTeam': 'فريق',
  'planning.whoModeWorkers': 'عمال',
  'planning.workersCountInput': 'عدد العمال',
  'planning.selectTeam': 'اختر الفريق',
  'planning.selectTeamOption': '— اختر الفريق —',
  'planning.defaultTeamName': 'فريق',
  'planning.noWorkersInRegistry': 'لا يوجد عمال في السجل — أضفهم من الموارد البشرية.',

  // Monthly view
  'planning.monthHint':
    'حدد الكمية المستهدفة لكل بند في الشهر — الخطة الشهرية تقديرية عمداً، وتثبت أرقامها تدريجياً في الأسابيع والأيام.',
  'planning.kpiMonthTargets': 'أهداف الشهر',
  'planning.kpiTargetSum': 'مجموع المستهدف',
  'planning.kpiActualExecuted': 'المنفذ فعلياً',
  'planning.kpiAchievementRate': 'نسبة التحقيق',
  'planning.emptyNoTasks':
    'لا توجد بنود في المشروع — أضف البنود من الجدول أولاً ثم عد لتحديد الأهداف الشهرية.',
  'planning.unnamedSection': 'قسم بدون اسم',
  'planning.addTarget': '+ إضافة هدف',
  'planning.emptySectionTargets':
    'لا توجد أهداف لهذا القسم في {month} — أضف هدفاً وحدد البند والكمية المستهدفة.',
  'planning.task': 'البند',
  'planning.targetQty': 'الكمية المستهدفة',
  'planning.executedThisMonth': 'المنفذ فعلياً هذا الشهر',
  'planning.achievement': 'التحقيق',
  'planning.note': 'ملاحظة',
  'planning.deletedTask': 'بند محذوف',
  'planning.taskFallback': 'بند',
  'planning.targetQtyTitle': 'الكمية المستهدفة لهذا الشهر',
  'planning.actualTitle': 'Σ أوامر التنفيذ المعتمدة داخل الشهر',
  'planning.noteOptional': 'ملاحظة (اختياري)',
  'planning.deleteTarget': 'حذف الهدف',
  'planning.otherTasks': 'بنود أخرى',

  // Weekly view
  'planning.weekHint':
    'وزّع الطواقم والفرق على البنود لهذا الأسبوع — الأرقام هنا تقديرية، ونسخ الأسبوع الماضي نقطة انطلاق سريعة.',
  'planning.copyLastWeek': '⧉ نسخ من الأسبوع الماضي',
  'planning.addAssignment': '+ إضافة تكليف',
  'planning.weekEmpty': 'لا توجد تكليفات لهذا الأسبوع بعد.',
  'planning.weekEmptySub':
    'ابدأ بنسخ تكليفات الأسبوع الماضي ثم عدّلها، أو أضف تكليفاً جديداً وحدد البند والطاقم.',
  'planning.crew': 'الطاقم',
  'planning.deleteAssignment': 'حذف التكليف',
  'planning.alertNoLastWeek': 'لا توجد تكليفات في الأسبوع الماضي لنسخها.',
  'planning.confirmReplaceWeek':
    'هذا الأسبوع يحتوي تكليفات بالفعل. هل تريد استبدالها بتكليفات الأسبوع الماضي؟',

  // Daily view
  'planning.dayHint':
    'خطة اليوم بأرقام ثابتة — البند والطاقم والملاحظة، وتُقاس بنسبة إنجاز المخطط اليومي (PPC) عند نهاية اليوم.',
  'planning.sameAsYesterday': '⧉ نفس الأمس',
  'planning.kpiPpc': 'نسبة إنجاز المخطط اليومي (PPC)',
  'planning.kpiDoneAssignments': 'تكليفات منجزة',
  'planning.kpiApprovedToday': 'أوامر تنفيذ معتمدة اليوم',
  'planning.dayEmpty': 'ابدأ بنسخ خطة الأمس ثم عدّلها.',
  'planning.dayEmptySubYesterday': 'اضغط «نفس الأمس» لنسخ تكليفات الأمس إلى اليوم، أو أضف تكليفاً جديداً.',
  'planning.dayEmptySubNoYesterday': 'لا توجد خطة لأمس — أضف تكليفاً جديداً وحدد البند والطاقم.',
  'planning.dayOrdersLabel': 'أوامر التنفيذ في هذا اليوم:',
  'planning.noDayOrders': 'لا توجد أوامر تنفيذ بعد',
  'planning.approvedSum': 'المعتمد: {sum} {unit}',
  'planning.doneBadge': 'منجز ✓',
  'planning.pendingBadge': 'بانتظار التنفيذ',
  'planning.alertNoYesterday': 'لا توجد خطة لأمس يمكن نسخها إلى اليوم.',
  'planning.confirmReplaceDay': 'خطة اليوم غير فارغة. هل تريد استبدالها بخطة الأمس؟',
};

// ar dictionary — module: history (who changed what, versions and restore).
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  'history.title': 'سجل التغييرات',
  'history.placeholder': 'سجل التغييرات قيد البناء.',

  // ما حدث (صفوف السجل من src/sync/history.js)
  'history.op.insert': 'إضافة',
  'history.op.update': 'تعديل',
  'history.op.delete': 'حذف',
  'history.op.restore': 'استعادة نسخة سابقة',
  'history.op.import': 'رفع من جهاز',
  'history.outcome.applied': 'محفوظ',
  'history.outcome.rejected': 'لم يُعتمَد',
  'history.outcome.pending': 'بانتظار المزامنة',
  'history.outcome.failed': 'رفضه الخادم',
  'history.note.conflictLost': 'فازت نسخة أخرى (أحدث أو معتمدة)؛ هذه محفوظة هنا.',
  'history.note.conflictWon': 'فازت على نسخة أخرى.',
  'history.note.denied': 'الدور لا يسمح بهذا التغيير.',
  'history.byOn': '{name} · {time}',
  'history.unknownPerson': 'شخص ما',
  'history.device': 'الجهاز {id}',
  'history.restore': 'استعادة هذه النسخة',
  'history.restoreTitle': 'استعادة هذه النسخة؟',
  'history.restoreBody': 'تصبح النسخة الحالية، وتُسجَّل تغييراً جديداً باسمك. لا يُحذَف شيء من السجل.',
  'history.restored': 'تمت استعادة النسخة',
  'history.notShared': 'السجل محفوظ على الخادم: هذا المشروع على هذا الجهاز فقط.',
  'history.offline': 'بلا اتصال: تظهر فقط التغييرات المنتظرة على هذا الجهاز.',
  'history.err.notFound': 'تعذّر العثور على هذه النسخة.',
  'history.err.files': 'لا يمكن استعادة الملفات من هنا.',
  'history.err.role': 'دورك لا يسمح باستعادة هذا.',
  'history.err.notShared': 'هذا المشروع غير مشترك على الخادم.',
};

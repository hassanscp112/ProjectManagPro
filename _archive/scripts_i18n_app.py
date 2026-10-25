# -*- coding: utf-8 -*-
"""One-shot i18n transform for App.jsx: mechanical string -> t() swaps.
JS-context strings are handled by targeted edits afterwards."""
import re, sys

PATH = r"E:\Vs Code\Project Management Package\ProjectManagerApp\src\App.jsx"
src = open(PATH, encoding="utf-8").read()

# (arabic_string, key)
MAP = [
    ("لوحة القيادة", "app.nav.dashboard"),
    ("جدول تقدم العمل", "app.nav.gantt"),
    ("أوامر العمل", "app.nav.orders"),
    ("التخطيط", "app.nav.planning"),
    ("الملفات", "app.nav.files"),
    ("حاسبة الكميات", "app.nav.calc"),
    ("التقارير اليومية", "app.nav.reports"),
    ("التقرير الشهري", "app.nav.monthly"),
    ("سجل النشاط", "app.nav.activity"),
    ("النسخ الزمنية", "app.nav.snapshots"),
    ("الحسابات والتكاليف", "app.nav.finance"),
    ("الجهات والعمال", "app.nav.registries"),
    ("نماذج المشاريع", "app.nav.templates"),
    ("الكلفة الكلية", "app.kpi.totalCost"),
    ("نسبة الانجاز", "app.kpi.progress"),
    ("الانجاز المخطط", "app.kpi.planned"),
    ("نسبة الانحراف", "app.kpi.deviation"),
    ("مدة المشروع", "app.kpi.duration"),
    ("الفقرات الفعالة", "app.kpi.activeItems"),
    ("التنبيهات", "app.kpi.warnings"),
    ("🔒 توقيع واعتماد المشروع", "app.toolbar.signOff"),
    ("▶ بدء التنفيذ", "app.toolbar.startExecution"),
    ("✓ إكمال المشروع", "app.toolbar.complete"),
    ("↻ إعادة الاعتماد", "app.toolbar.reBaseline"),
    ("📝 أوامر التغيير", "app.toolbar.voButton"),
    ("أسابيع", "app.toolbar.weeks"),
    ("أشهر", "app.toolbar.months"),
    ("↩ تراجع", "app.toolbar.undo"),
    ("⬇ نسخة احتياطية", "app.toolbar.backup"),
    ("⬆ استعادة", "app.toolbar.restore"),
    ("وضع التعديل", "app.toolbar.editMode"),
    ("إنهاء التعديل", "app.toolbar.endEdit"),
    ("إعادة أخذ الخط الأساس", "app.toolbar.reBaselineTitle"),
    ("تراجع عن التغيير الأخير", "app.toolbar.undoTitle"),
    ("تنزيل نسخة احتياطية من كافة بيانات المشروع (المهام، الخط الأساس، الحسابات، التقارير)", "app.toolbar.backupTitle"),
    ("استعادة بيانات المشروع من ملف نسخة احتياطية", "app.toolbar.restoreTitle"),
    ("تأكيد الحذف", "app.modal.deleteTitle"),
    ("هل أنت متأكد من حذف", "app.modal.deleteConfirm"),
    ("هذه الفقرة", "app.modal.deleteThis"),
    ("حذف الفقرة", "app.modal.deleteAction"),
    ("توقيع واعتماد المشروع", "app.modal.signOffTitle"),
    ("اسم المعتمد / التوقيع", "app.modal.signOffName"),
    ("اعتماد وتوقيع", "app.modal.signOffAction"),
    ("استعادة البيانات", "app.modal.restoreTitle"),
    ("استعادة الآن", "app.modal.restoreAction"),
    ("أوامر التغيير (Variation Orders)", "app.vo.title"),
    ("— اختر البند —", "app.vo.pickTask"),
    ("الكمية التعاقدية", "app.vo.contractQty"),
    ("سعر الوحدة", "app.vo.unitPriceField"),
    ("القيمة الجديدة", "app.vo.newValue"),
    ("سبب التغيير", "app.vo.changeReason"),
    ("المعتمد", "app.vo.approver"),
    ("تسجيل أمر التغيير", "app.vo.record"),
    ("لا توجد أوامر تغيير بعد.", "app.vo.empty"),
    ("أهمية: منخفضة", "app.vo.urgencyLow"),
    ("أهمية: متوسطة", "app.vo.urgencyMedium"),
    ("أهمية: عالية", "app.vo.urgencyHigh"),
    ("تصنيف: تلقائي", "app.vo.classAuto"),
    ("الأثر المالي التقديري (د.ع)", "app.vo.costImpact"),
    ("يُحسب تلقائياً من فرق الكمية × السعر إن تُرك فارغاً", "app.vo.costImpactTitle"),
    ("أثر زمني (أيام)", "app.vo.scheduleImpact"),
    ("بند العقد (FIDIC…)", "app.vo.clauseRef"),
    ("الأثر المالي:", "app.vo.impactCost"),
    ("الأثر الزمني:", "app.vo.impactSchedule"),
    ("إلغاء", "common.cancel"),
]

# 1) JSX children: >text<  ->  >{t('key')}<
for s, k in MAP:
    src = src.replace(f">{s}<", f">{{t('{k}')}}<")

# 2) Attributes: title="text" / placeholder="text" -> ={t('key')}
for s, k in MAP:
    for attr in ("title", "placeholder", "aria-label"):
        src = src.replace(f'{attr}="{s}"', f"{attr}={{t('{k}')}}")

# 3) Specific mixed-content blocks
# delete-modal linked/deps phrases inside JSX conditionals
src = src.replace(
    "سيتم حذف {deletePreview.count} فقرات مرتبطة بها.",
    "{t('app.modal.deleteLinkedPrefix')} {deletePreview.count} {t('app.modal.deleteLinkedSuffix')}",
)
src = src.replace(
    "وسيتم إلغاء {deletePreview.dependencyCount} علاقات تعتمد عليها.",
    "{t('app.modal.deleteDepsPrefix')} {deletePreview.dependencyCount} {t('app.modal.deleteDepsSuffix')}",
)
# VO list: field label ternary
src = src.replace(
    "v.field === 'unitPrice' ? 'سعر الوحدة' : 'الكمية'",
    "v.field === 'unitPrice' ? t('app.vo.unitPriceField') : t('app.vo.qtyField')",
)
# VO reason prefix
src = src.replace("السبب: {v.reason}", "{t('app.vo.reasonPrefix')} {v.reason}")
# urgency badge (high only)
src = src.replace('<span className="vo-urgency high">عالية</span>', '<span className="vo-urgency high">{t(\'app.vo.urgencyHigh\')}</span>')

open(PATH, "w", encoding="utf-8", newline="").write(src)
print("done; remaining Arabic-bearing lines (excluding INITIAL_TASKS/log strings):")
for i, line in enumerate(src.splitlines(), 1):
    if re.search(r"[\u0600-\u06FF]", line):
        if i < 60:  # INITIAL_TASKS region
            continue
        print(f"{i}: {line.strip()[:110]}")

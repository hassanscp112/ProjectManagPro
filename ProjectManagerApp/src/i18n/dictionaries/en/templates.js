// en dictionary — module: templates
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  // ── Header + tabs ──
  'templates.pageTitle': 'Automated Planning — Templates & Rate Library',
  'templates.pageSub': 'Turn a standard structure template (school, apartment building, mall…) into a complete task tree with quantities, prices, durations and links.',
  'templates.tabTemplates': 'Templates',
  'templates.tabRates': 'Rate Library',
  'templates.tabEditor': 'Template Builder',

  // ── Seeded template display names (storage keeps the Arabic name) ──
  'templates.nameSchool': 'School',
  'templates.nameApartment': 'Apartment Building',
  'templates.nameMall': 'Shopping Mall',
  'templates.nameHouse': 'House',
  'templates.nameVilla': 'Villa',

  // ── Closed set of rate/part categories (display mapping only) ──
  'templates.catConcrete': 'Concrete',
  'templates.catSteel': 'Steel',
  'templates.catMasonry': 'Masonry',
  'templates.catFinishes': 'Finishes',
  'templates.catEarthworks': 'Earthworks',
  'templates.catInsulation': 'Insulation',
  'templates.catElectrical': 'Electrical',
  'templates.catPlumbing': 'Plumbing',
  'templates.catDoorsWindows': 'Doors & Windows',
  'templates.catOther': 'Other',

  // ── Template cards ──
  'templates.cardMeta': '{vars} variables · {elements} items',
  'templates.deleteTemplateTitle': 'Delete template',
  'templates.confirmDeleteTemplate': 'Permanently delete this template?',
  'templates.emptyTemplates': 'No templates yet — create one in the "Template Builder" tab.',

  // ── Detail panel: variables form ──
  'templates.startDate': 'Start Date',

  // ── Warning strip for unpriced items ──
  'templates.warningUnpricedLabel': 'Items with no rate in the library ({count}):',
  'templates.warningMore': 'and more…',
  'templates.warningFix': '— add them in the "Rate Library" tab so they get priced.',

  // ── Totals ──
  'templates.totalItems': 'Line Items',
  'templates.totalGroups': 'Groups',
  'templates.totalPriced': 'Priced Items',
  'templates.totalCost': 'Total Cost',

  // ── Preview table ──
  'templates.colItem': 'Item',
  'templates.colUnitPrice': 'Unit Price',
  'templates.colCost': 'Cost',
  'templates.colDuration': 'Duration (days)',
  'templates.generate': '⚡ Generate Project ({count} items)',

  // ── Rate library tab ──
  'templates.searchRates': 'Search by name or category…',
  'templates.rateNamePlaceholder': 'Item name',
  'templates.rateUnitPlaceholder': 'Unit (m², m³, ton…)',
  'templates.unitPriceIqd': 'Unit Price (IQD)',
  'templates.colCategory': 'Category',
  'templates.noRatesMatch': 'No items match your search.',
  'templates.copyNote': 'Prices are copied when a project is generated — editing them later does not affect existing projects.',

  // ── Save current project as template ──
  'templates.saveProjectAsTemplate': 'Save Current Project as Template',
  'templates.fromProjectNamePlaceholder': 'Template name (e.g. My Standard Project)',
  'templates.fromProjectHint': "Extracts a fixed-quantity template from the current project's task tree (groups and line items, no variables).",

  // ── Template editor ──
  'templates.editorTitle': 'Template Editor',
  'templates.templateNamePlaceholder': 'Template name (e.g. Clinic)',
  'templates.iconPlaceholder': 'Icon',
  'templates.variablesTitle': 'Variables',
  'templates.varKeyPlaceholder': 'Key (Latin)',
  'templates.varLabelPlaceholder': 'Label',
  'templates.varDefaultPlaceholder': 'Default',
  'templates.addVariable': '+ Variable',
  'templates.elementsTitle': 'Line Items',
  'templates.addElement': '+ Item',
  'templates.itemSelectTitle': 'Item',
  'templates.groupPlaceholder': 'Section (e.g. Foundations)',
  'templates.formulaPlaceholder': 'Quantity formula (e.g. floors*area*0.34)',
  'templates.repeatsTitle': 'Repeats per',
  'templates.noRepeat': 'No repeat',
  'templates.repeatsPerVar': 'Repeats per {name}',
  'templates.dependsOnTitle': 'Depends on',
  'templates.noDependency': 'No dependency',
  'templates.linkTypeTitle': 'Dependency Type',
  'templates.lagTitle': 'Lag (days)',
  'templates.saveTemplateBtn': '💾 Save Template',

  // ── Creation-time defaults (blank editor rows) ──
  'templates.defaultAreaVarLabel': 'Area (m²)',
  'templates.defaultNewVarLabel': 'New variable',
  'templates.defaultGroup': 'Main Works',

  // ── Notices (stored as keys, translated at render) ──
  'templates.noticeNameRequired': 'Enter a template name first.',
  'templates.noticeNeedElement': 'Add at least one item to the template.',
  'templates.noticeSaved': 'Template saved — you will find it in the "Templates" tab.',
  'templates.noticeNoTasks': 'The current project has no tasks to save as a template.',
  'templates.noticeProjectSaved': 'Current project saved as a template (fixed quantities, no variables).',
};

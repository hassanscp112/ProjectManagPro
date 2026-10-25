import { useMemo, useState } from 'react';
import './TemplatesScreen.css';
import { useI18n } from '../../i18n/useI18n.js';
import { compactCurrency } from '../../i18n/index.js';
import { loadRateLibrary, addRate, updateRate, deleteRate, RATE_CATEGORIES } from '../../utils/RateLibrary';
import {
  PARTS,
  listTemplates,
  saveTemplate,
  deleteTemplate,
  generateProject,
  makeTemplateFromTasks,
  toISODate,
} from '../../utils/TemplateEngine';

const DEP_TYPES = ['FS', 'SS', 'FF', 'SF'];

const fmtNum = (n) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);

const partName = (partId) => {
  const part = PARTS.find((p) => p.id === partId);
  return part ? part.name : '—';
};

/* Seeded templates keep their Arabic names in storage (utils untouched):
   display-time mapping gives them English labels when lang === 'en'.
   Seeds are identified by source === 'seed' + exact stored name; custom
   templates (no mapping) always display their stored name as-is. */
const SEED_TEMPLATE_NAME_KEYS = {
  'مدرسة': 'templates.nameSchool',
  'بناية سكنية (شقق)': 'templates.nameApartment',
  'مول تجاري': 'templates.nameMall',
  'بيت': 'templates.nameHouse',
  'فيلا': 'templates.nameVilla',
};

/* Rate/part categories are a closed set (RATE_CATEGORIES + 'أخرى'
   fallback) — mapped for display only; stored values stay untouched. */
const CATEGORY_KEYS = {
  'خرسانة': 'templates.catConcrete',
  'حديد': 'templates.catSteel',
  'بناء': 'templates.catMasonry',
  'تشطيبات': 'templates.catFinishes',
  'أعمال ترابية': 'templates.catEarthworks',
  'عزل': 'templates.catInsulation',
  'كهرباء': 'templates.catElectrical',
  'صحية': 'templates.catPlumbing',
  'أبواب ونوافذ': 'templates.catDoorsWindows',
  'أخرى': 'templates.catOther',
};

const blankEditor = (t) => ({
  name: '',
  icon: '🏗️',
  variables: [{ key: 'area', label: t('templates.defaultAreaVarLabel'), default: 100 }],
  elements: [],
});

const blankElement = (t) => ({
  partId: PARTS[0].id,
  qtyFormula: '',
  group: t('templates.defaultGroup'),
  repeatsVar: null,
  depOn: null,
  depType: 'FS',
  lag: 0,
});

function TemplatesScreen({ onGenerate, tasks }) {
  const { t, lang, isRTL, dir } = useI18n();
  const [tab, setTab] = useState('templates');
  const [rates, setRates] = useState(loadRateLibrary);
  const [templates, setTemplates] = useState(listTemplates);
  const [selectedId, setSelectedId] = useState(null);
  const [values, setValues] = useState({});
  const [startDate, setStartDate] = useState(() => toISODate(new Date()));
  const [rateSearch, setRateSearch] = useState('');
  const [rateDraft, setRateDraft] = useState(null);
  const [editor, setEditor] = useState(() => blankEditor(t));
  const [fromProjectName, setFromProjectName] = useState('');
  const [notice, setNotice] = useState('');

  const refreshTemplates = () => setTemplates(listTemplates());

  /* Display names: seed templates get a language label, everything else
     (custom templates, rates, parts) shows its stored name verbatim. */
  const templateDisplayName = (tpl) =>
    tpl && tpl.source === 'seed' && SEED_TEMPLATE_NAME_KEYS[tpl.name]
      ? t(SEED_TEMPLATE_NAME_KEYS[tpl.name])
      : tpl.name;

  const displayCategory = (category) =>
    CATEGORY_KEYS[category] ? t(CATEGORY_KEYS[category]) : category;

  const selectedTemplate = useMemo(
    () => templates.find((tpl) => tpl.id === selectedId) || null,
    [templates, selectedId]
  );

  const preview = useMemo(() => {
    if (!selectedTemplate) return null;
    try {
      return generateProject(selectedTemplate, values, { startDate, rateLibrary: rates });
    } catch {
      return null;
    }
  }, [selectedTemplate, values, startDate, rates]);

  const previewLeaves = useMemo(
    () => (preview ? preview.tasks.filter((task) => !task.isGroup) : []),
    [preview]
  );

  const filteredRates = useMemo(() => {
    const q = rateSearch.trim();
    if (!q) return rates;
    return rates.filter(
      (r) =>
        (r.name || '').includes(q) ||
        (r.category || '').includes(q) ||
        (r.unit || '').includes(q)
    );
  }, [rates, rateSearch]);

  const groupOptions = useMemo(() => {
    const set = new Set(editor.elements.map((el) => el.group).filter(Boolean));
    return [...set];
  }, [editor.elements]);

  /* ── Tab 1: templates ── */
  const handleSelectTemplate = (tpl) => {
    setSelectedId(tpl.id === selectedId ? null : tpl.id);
    const next = {};
    (tpl.variables || []).forEach((v) => {
      next[v.key] = v.default;
    });
    setValues(next);
  };

  const handleVariableChange = (key, raw) => {
    setValues((prev) => ({ ...prev, [key]: raw }));
  };

  const handleDeleteTemplate = (id) => {
    if (!window.confirm(t('templates.confirmDeleteTemplate'))) return;
    deleteTemplate(id);
    if (selectedId === id) setSelectedId(null);
    refreshTemplates();
  };

  const handleGenerate = () => {
    if (!preview || !selectedTemplate || !onGenerate) return;
    onGenerate(preview.tasks, {
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      values: { ...values },
      startDate,
      stats: preview.stats,
    });
  };

  /* ── Tab 2: rate library ── */
  const handleNewRate = () => {
    setRateDraft({ id: null, name: '', unit: 'م2', unitPrice: '', category: RATE_CATEGORIES[0] });
  };

  const handleEditRate = (rate) => {
    setRateDraft({ ...rate, unitPrice: String(rate.unitPrice ?? '') });
  };

  const handleSaveRate = () => {
    if (!rateDraft || !(rateDraft.name || '').trim()) return;
    const payload = {
      name: rateDraft.name.trim(),
      unit: (rateDraft.unit || '').trim(),
      unitPrice: Math.max(0, Number(rateDraft.unitPrice) || 0),
      category: rateDraft.category || 'أخرى',
    };
    if (rateDraft.id) updateRate(rateDraft.id, payload);
    else addRate(payload);
    setRates(loadRateLibrary());
    setRateDraft(null);
  };

  const handleDeleteRate = (id) => {
    deleteRate(id);
    setRates(loadRateLibrary());
  };

  /* ── Tab 3: editor ── */
  const updateEditor = (patch) => setEditor((prev) => ({ ...prev, ...patch }));

  const handleVariableField = (index, field, raw) => {
    setEditor((prev) => ({
      ...prev,
      variables: prev.variables.map((v, i) => (i === index ? { ...v, [field]: raw } : v)),
    }));
  };

  const handleAddVariable = () => {
    setEditor((prev) => ({
      ...prev,
      variables: [...prev.variables, { key: `var${prev.variables.length + 1}`, label: t('templates.defaultNewVarLabel'), default: 1 }],
    }));
  };

  const handleRemoveVariable = (index) => {
    setEditor((prev) => ({ ...prev, variables: prev.variables.filter((_, i) => i !== index) }));
  };

  const handleElementField = (index, field, raw) => {
    setEditor((prev) => ({
      ...prev,
      elements: prev.elements.map((el, i) => (i === index ? { ...el, [field]: raw } : el)),
    }));
  };

  const handleAddElement = () => {
    setEditor((prev) => ({ ...prev, elements: [...prev.elements, blankElement(t)] }));
  };

  const handleRemoveElement = (index) => {
    setEditor((prev) => ({ ...prev, elements: prev.elements.filter((_, i) => i !== index) }));
  };

  const handleSaveEditorTemplate = () => {
    if (!(editor.name || '').trim()) {
      setNotice('templates.noticeNameRequired');
      return;
    }
    if (editor.elements.length === 0) {
      setNotice('templates.noticeNeedElement');
      return;
    }
    const varKeys = new Set(editor.variables.map((v) => (v.key || '').trim()).filter(Boolean));
    const elements = editor.elements.map((el) => {
      const repeatsVar = el.repeatsVar && varKeys.has(el.repeatsVar) ? el.repeatsVar : null;
      const depIndex = el.depOn === null || el.depOn === '' || el.depOn === undefined ? null : Number(el.depOn);
      const depOn = depIndex !== null && Number.isInteger(depIndex) && depIndex >= 0 && depIndex < editor.elements.length
        ? depIndex
        : null;
      return { ...el, repeatsVar, depOn };
    });
    saveTemplate({
      name: editor.name.trim(),
      icon: editor.icon || '🏗️',
      variables: editor.variables.filter((v) => (v.key || '').trim()),
      elements,
      version: 1,
      source: 'custom',
    });
    refreshTemplates();
    setEditor(blankEditor(t));
    setNotice('templates.noticeSaved');
  };

  const handleSaveProjectAsTemplate = () => {
    const projectTasks = Array.isArray(tasks) ? tasks : [];
    if (projectTasks.length === 0) {
      setNotice('templates.noticeNoTasks');
      return;
    }
    saveTemplate(makeTemplateFromTasks(projectTasks, fromProjectName));
    setFromProjectName('');
    refreshTemplates();
    setNotice('templates.noticeProjectSaved');
  };

  const unpriced = preview ? preview.stats.unpriced : [];

  return (
    <div className="templates-screen" dir={dir}>
      <div className="tpl-header">
        <h2 className="tpl-page-title">{t('templates.pageTitle')}</h2>
        <p className="tpl-page-sub">{t('templates.pageSub')}</p>
      </div>

      <div className="tpl-tabs">
        <button
          type="button"
          className={`tpl-tab ${tab === 'templates' ? 'active' : ''}`}
          onClick={() => setTab('templates')}
        >
          {t('templates.tabTemplates')}
        </button>
        <button
          type="button"
          className={`tpl-tab ${tab === 'rates' ? 'active' : ''}`}
          onClick={() => setTab('rates')}
        >
          {t('templates.tabRates')}
        </button>
        <button
          type="button"
          className={`tpl-tab ${tab === 'editor' ? 'active' : ''}`}
          onClick={() => setTab('editor')}
        >
          {t('templates.tabEditor')}
        </button>
      </div>

      {notice && <div className="tpl-notice">{t(notice)}</div>}

      {/* ═══════════ TAB 1: templates ═══════════ */}
      {tab === 'templates' && (
        <div className="tpl-body">
          <div className="tpl-grid">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className={`tpl-card ${tpl.id === selectedId ? 'selected' : ''}`}
                onClick={() => handleSelectTemplate(tpl)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleSelectTemplate(tpl);
                }}
              >
                <span className="tpl-card-icon">{tpl.icon || '🏗️'}</span>
                <div className="tpl-card-info">
                  <span className="tpl-card-name">{templateDisplayName(tpl)}</span>
                  <span className="tpl-card-meta">
                    {t('templates.cardMeta', {
                      vars: (tpl.variables || []).length,
                      elements: (tpl.elements || []).length,
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  className="tpl-card-delete"
                  title={t('templates.deleteTemplateTitle')}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTemplate(tpl.id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            {templates.length === 0 && (
              <div className="tpl-empty">{t('templates.emptyTemplates')}</div>
            )}
          </div>

          {selectedTemplate && preview && (
            <div className="tpl-detail">
              <div className="tpl-detail-head">
                <span className="tpl-detail-icon">{selectedTemplate.icon || '🏗️'}</span>
                <h3 className="tpl-detail-title">{templateDisplayName(selectedTemplate)}</h3>
                <button
                  type="button"
                  className="apple-btn secondary tpl-close-btn"
                  onClick={() => setSelectedId(null)}
                >
                  {t('common.close')}
                </button>
              </div>

              <div className="tpl-vars-form">
                {(selectedTemplate.variables || []).map((v) => (
                  <label key={v.key} className="tpl-var-field">
                    <span className="tpl-var-label">{v.label || v.key}</span>
                    <input
                      type="number"
                      className="tpl-input"
                      value={values[v.key] ?? ''}
                      onChange={(e) => handleVariableChange(v.key, e.target.value)}
                    />
                  </label>
                ))}
                <label className="tpl-var-field">
                  <span className="tpl-var-label">{t('templates.startDate')}</span>
                  <input
                    type="date"
                    className="tpl-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>
              </div>

              {unpriced.length > 0 && (
                <div className="tpl-warning">
                  <strong>{t('templates.warningUnpricedLabel', { count: unpriced.length })}</strong>{' '}
                  {unpriced.slice(0, 6).join(isRTL ? '، ' : ', ')}
                  {unpriced.length > 6 ? ` ${t('templates.warningMore')}` : ''}{' '}
                  {t('templates.warningFix')}
                </div>
              )}

              <div className="tpl-totals">
                <div className="tpl-total-card">
                  <span className="tpl-total-label">{t('templates.totalItems')}</span>
                  <span className="tpl-total-value">{fmtNum(preview.stats.leafCount)}</span>
                </div>
                <div className="tpl-total-card">
                  <span className="tpl-total-label">{t('templates.totalGroups')}</span>
                  <span className="tpl-total-value">{fmtNum(preview.stats.groupCount)}</span>
                </div>
                <div className="tpl-total-card">
                  <span className="tpl-total-label">{t('templates.totalPriced')}</span>
                  <span className="tpl-total-value">
                    {fmtNum(preview.stats.pricedCount)} / {fmtNum(preview.stats.leafCount)}
                  </span>
                </div>
                <div className="tpl-total-card accent">
                  <span className="tpl-total-label">{t('templates.totalCost')}</span>
                  <span className="tpl-total-value">{compactCurrency(preview.stats.totalCost, lang)}</span>
                </div>
              </div>

              <div className="tpl-preview-wrap">
                <table className="tpl-preview-table">
                  <thead>
                    <tr>
                      <th>{t('templates.colItem')}</th>
                      <th>{t('common.quantity')}</th>
                      <th>{t('common.unit')}</th>
                      <th>{t('templates.colUnitPrice')}</th>
                      <th>{t('templates.colCost')}</th>
                      <th>{t('templates.colDuration')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewLeaves.map((row) => (
                      <tr key={row.id} className={row.unitPrice === 0 ? 'unpriced' : ''}>
                        <td
                          className="tpl-name-cell"
                          style={{ paddingInlineStart: `${Math.min(4, (row.wbs.split('.').length - 2)) * 14 + 8}px` }}
                        >
                          <span className="tpl-wbs">{row.wbs}</span> {row.name}
                        </td>
                        <td className="num">{fmtNum(row.quantity)}</td>
                        <td>{row.unit}</td>
                        <td className="num">{fmtNum(row.unitPrice)}</td>
                        <td className="num">{compactCurrency(row.quantity * row.unitPrice, lang)}</td>
                        <td className="num">{fmtNum(row.duration)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="tpl-actions">
                <button type="button" className="apple-btn primary" onClick={handleGenerate}>
                  {t('templates.generate', { count: fmtNum(preview.stats.taskCount) })}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB 2: rate library ═══════════ */}
      {tab === 'rates' && (
        <div className="tpl-body">
          <div className="tpl-toolbar">
            <input
              type="text"
              className="tpl-input tpl-search"
              placeholder={t('templates.searchRates')}
              value={rateSearch}
              onChange={(e) => setRateSearch(e.target.value)}
            />
            <button type="button" className="apple-btn primary" onClick={handleNewRate}>
              + {t('common.add')}
            </button>
          </div>

          {rateDraft && (
            <div className="tpl-rate-draft">
              <input
                type="text"
                className="tpl-input"
                placeholder={t('templates.rateNamePlaceholder')}
                value={rateDraft.name}
                onChange={(e) => setRateDraft({ ...rateDraft, name: e.target.value })}
              />
              <input
                type="text"
                className="tpl-input"
                placeholder={t('templates.rateUnitPlaceholder')}
                value={rateDraft.unit}
                onChange={(e) => setRateDraft({ ...rateDraft, unit: e.target.value })}
              />
              <input
                type="number"
                className="tpl-input"
                placeholder={t('templates.unitPriceIqd')}
                value={rateDraft.unitPrice}
                onChange={(e) => setRateDraft({ ...rateDraft, unitPrice: e.target.value })}
              />
              <select
                className="tpl-input"
                value={rateDraft.category}
                onChange={(e) => setRateDraft({ ...rateDraft, category: e.target.value })}
              >
                {RATE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{displayCategory(c)}</option>
                ))}
              </select>
              <div className="tpl-rate-draft-actions">
                <button type="button" className="apple-btn primary" onClick={handleSaveRate}>
                  {t('common.save')}
                </button>
                <button type="button" className="apple-btn secondary" onClick={() => setRateDraft(null)}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          <div className="tpl-preview-wrap">
            <table className="tpl-preview-table">
              <thead>
                <tr>
                  <th>{t('templates.colItem')}</th>
                  <th>{t('common.unit')}</th>
                  <th>{t('templates.unitPriceIqd')}</th>
                  <th>{t('templates.colCategory')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRates.map((r) => (
                  <tr key={r.id}>
                    <td className="tpl-name-cell">{r.name}</td>
                    <td>{r.unit}</td>
                    <td className="num">{fmtNum(r.unitPrice)}</td>
                    <td>
                      <span className="tpl-cat-chip">{displayCategory(r.category)}</span>
                    </td>
                    <td>
                      <div className="tpl-row-actions">
                        <button type="button" className="tpl-mini-btn" onClick={() => handleEditRate(r)}>
                          {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          className="tpl-mini-btn danger"
                          onClick={() => handleDeleteRate(r.id)}
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="tpl-table-empty">{t('templates.noRatesMatch')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="tpl-note">{t('templates.copyNote')}</p>
        </div>
      )}

      {/* ═══════════ TAB 3: template editor ═══════════ */}
      {tab === 'editor' && (
        <div className="tpl-body">
          <div className="tpl-editor-card">
            <h4 className="tpl-section-title">{t('templates.saveProjectAsTemplate')}</h4>
            <div className="tpl-from-project">
              <input
                type="text"
                className="tpl-input"
                placeholder={t('templates.fromProjectNamePlaceholder')}
                value={fromProjectName}
                onChange={(e) => setFromProjectName(e.target.value)}
              />
              <button type="button" className="apple-btn secondary" onClick={handleSaveProjectAsTemplate}>
                📋 {t('templates.saveProjectAsTemplate')}
              </button>
            </div>
            <p className="tpl-hint">
              {t('templates.fromProjectHint')}
            </p>
          </div>

          <div className="tpl-editor-card">
            <h4 className="tpl-section-title">{t('templates.editorTitle')}</h4>
            <div className="tpl-editor-head">
              <input
                type="text"
                className="tpl-input tpl-name-input"
                placeholder={t('templates.templateNamePlaceholder')}
                value={editor.name}
                onChange={(e) => updateEditor({ name: e.target.value })}
              />
              <input
                type="text"
                className="tpl-input tpl-icon-input"
                placeholder={t('templates.iconPlaceholder')}
                value={editor.icon}
                onChange={(e) => updateEditor({ icon: e.target.value })}
              />
            </div>

            <h5 className="tpl-sub-title">{t('templates.variablesTitle')}</h5>
            <div className="tpl-vars-editor">
              {editor.variables.map((v, i) => (
                <div key={`${v.key}-${i}`} className="tpl-var-row">
                  <input
                    type="text"
                    className="tpl-input"
                    placeholder={t('templates.varKeyPlaceholder')}
                    value={v.key}
                    onChange={(e) => handleVariableField(i, 'key', e.target.value)}
                  />
                  <input
                    type="text"
                    className="tpl-input"
                    placeholder={t('templates.varLabelPlaceholder')}
                    value={v.label}
                    onChange={(e) => handleVariableField(i, 'label', e.target.value)}
                  />
                  <input
                    type="number"
                    className="tpl-input"
                    placeholder={t('templates.varDefaultPlaceholder')}
                    value={v.default}
                    onChange={(e) => handleVariableField(i, 'default', e.target.value)}
                  />
                  <button type="button" className="tpl-mini-btn danger" onClick={() => handleRemoveVariable(i)}>
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="apple-btn secondary tpl-add-btn" onClick={handleAddVariable}>
                {t('templates.addVariable')}
              </button>
            </div>

            <h5 className="tpl-sub-title">{t('templates.elementsTitle')}</h5>
            <div className="tpl-elements-editor">
              {editor.elements.map((el, i) => (
                <div key={i} className="tpl-el-row">
                  <div className="tpl-el-main">
                    <select
                      className="tpl-input"
                      value={el.partId}
                      onChange={(e) => handleElementField(i, 'partId', e.target.value)}
                      title={t('templates.itemSelectTitle')}
                    >
                      {PARTS.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="tpl-input"
                      list="tpl-group-options"
                      placeholder={t('templates.groupPlaceholder')}
                      value={el.group}
                      onChange={(e) => handleElementField(i, 'group', e.target.value)}
                    />
                    <input
                      type="text"
                      className="tpl-input tpl-formula-input"
                      placeholder={t('templates.formulaPlaceholder')}
                      value={el.qtyFormula}
                      onChange={(e) => handleElementField(i, 'qtyFormula', e.target.value)}
                    />
                  </div>
                  <div className="tpl-el-deps">
                    <select
                      className="tpl-input"
                      value={el.repeatsVar || ''}
                      onChange={(e) => handleElementField(i, 'repeatsVar', e.target.value || null)}
                      title={t('templates.repeatsTitle')}
                    >
                      <option value="">{t('templates.noRepeat')}</option>
                      {editor.variables.map((v) => (
                        <option key={v.key} value={v.key}>{t('templates.repeatsPerVar', { name: v.label || v.key })}</option>
                      ))}
                    </select>
                    <select
                      className="tpl-input"
                      value={el.depOn === null || el.depOn === undefined ? '' : String(el.depOn)}
                      onChange={(e) => handleElementField(i, 'depOn', e.target.value === '' ? null : Number(e.target.value))}
                      title={t('templates.dependsOnTitle')}
                    >
                      <option value="">{t('templates.noDependency')}</option>
                      {editor.elements.map((other, j) => (
                        <option key={j} value={j}>
                          {j} — {partName(other.partId)}
                        </option>
                      ))}
                    </select>
                    <select
                      className="tpl-input"
                      value={el.depType}
                      onChange={(e) => handleElementField(i, 'depType', e.target.value)}
                      title={t('templates.linkTypeTitle')}
                    >
                      {DEP_TYPES.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="tpl-input tpl-lag-input"
                      placeholder="Lag"
                      value={el.lag}
                      onChange={(e) => handleElementField(i, 'lag', e.target.value)}
                      title={t('templates.lagTitle')}
                    />
                    <button type="button" className="tpl-mini-btn danger" onClick={() => handleRemoveElement(i)}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" className="apple-btn secondary tpl-add-btn" onClick={handleAddElement}>
                {t('templates.addElement')}
              </button>
              <datalist id="tpl-group-options">
                {groupOptions.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>

            <div className="tpl-actions">
              <button type="button" className="apple-btn primary" onClick={handleSaveEditorTemplate}>
                {t('templates.saveTemplateBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplatesScreen;

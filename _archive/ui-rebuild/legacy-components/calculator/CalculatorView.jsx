import { useState } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import TemplateEditor from './TemplateEditor';
import CalculatorGrid from './CalculatorGrid';
import './Calculator.css';

// Lazy initializer: read persisted templates once, at first render, instead of
// inside an effect (avoids a cascading render flagged by react-hooks).
const loadTemplatesFromStorage = () => {
  try {
    const saved = localStorage.getItem('pm-calculator-templates');
    if (saved) {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.error('Failed to parse templates', e);
  }
  return [];
};

const CalculatorView = () => {
  const { t } = useI18n();
  const [templates, setTemplates] = useState(loadTemplatesFromStorage);
  const [activeTemplateId, setActiveTemplateId] = useState(
    () => loadTemplatesFromStorage()[0]?.id ?? null
  );
  const [isEditing, setIsEditing] = useState(false);

  const saveTemplatesToStorage = (newTemplates) => {
    setTemplates(newTemplates);
    localStorage.setItem('pm-calculator-templates', JSON.stringify(newTemplates));
  };

  const activeTemplate = templates.find(t => t.id === activeTemplateId);

  const handleSaveTemplate = (updatedTemplate) => {
    let newTemplates;
    if (templates.some(t => t.id === updatedTemplate.id)) {
      newTemplates = templates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t);
    } else {
      newTemplates = [...templates, updatedTemplate];
    }
    saveTemplatesToStorage(newTemplates);
    setActiveTemplateId(updatedTemplate.id);
    setIsEditing(false);
  };

  const handleUpdateActiveTemplate = (updatedTemplate) => {
    const newTemplates = templates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t);
    saveTemplatesToStorage(newTemplates);
  };

  const handleDeleteTemplate = (id) => {
    if (window.confirm(t('calculator.confirmDelete'))) {
      const newTemplates = templates.filter(t => t.id !== id);
      saveTemplatesToStorage(newTemplates);
      if (activeTemplateId === id) {
        setActiveTemplateId(newTemplates.length > 0 ? newTemplates[0].id : null);
      }
    }
  };

  return (
    <div className="calc-container">
      {/* Sidebar for Templates */}
      <div className="calc-sidebar">
        <div className="calc-sidebar-header">
          <span className="calc-sidebar-title">{t('calculator.title')}</span>
          <button className="calc-add-tpl-btn" onClick={() => { setActiveTemplateId(null); setIsEditing(true); }} title={t('calculator.addTemplateTitle')}>+</button>
        </div>
        <div className="calc-tpl-list">
          {templates.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('calculator.noTemplates')}</div>
          )}
          {templates.map(tpl => (
            <div
              key={tpl.id}
              className={`calc-tpl-item ${activeTemplateId === tpl.id ? 'active' : ''}`}
              onClick={() => { setActiveTemplateId(tpl.id); setIsEditing(false); }}
            >
              <span>{tpl.name}</span>
              <div className="calc-tpl-item-actions">
                <button
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--apple-blue-action)' }}
                  onClick={(e) => { e.stopPropagation(); setActiveTemplateId(tpl.id); setIsEditing(true); }}
                  title={t('calculator.editTemplate')}
                >✎</button>
                <button
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ff3b30' }}
                  onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }}
                  title={t('calculator.deleteTemplate')}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Area */}
      <div className="calc-main">
        {isEditing ? (
          <TemplateEditor
            initialTemplate={activeTemplateId ? activeTemplate : null}
            onSave={handleSaveTemplate}
            onCancel={() => setIsEditing(false)}
          />
        ) : activeTemplate ? (
          <>
            <div className="calc-main-header">
              <span className="calc-main-title">{activeTemplate.name}</span>
            </div>
            <CalculatorGrid template={activeTemplate} onUpdateTemplate={handleUpdateActiveTemplate} />
          </>
        ) : (
          <div className="calc-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ width: 64, height: 64, opacity: 0.5, marginBottom: 16 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
            <p style={{ marginBottom: '20px' }}>{t('calculator.emptyPrompt')}</p>
            <button
              className="calc-btn primary"
              style={{ fontSize: '1.1rem', padding: '12px 24px' }}
              onClick={() => { setActiveTemplateId(null); setIsEditing(true); }}
            >
              {t('calculator.createNew')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalculatorView;

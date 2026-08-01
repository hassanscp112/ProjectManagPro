import { useRef, useEffect, useState } from 'react';
import jspreadsheet from 'jspreadsheet-ce';
import 'jspreadsheet-ce/dist/jspreadsheet.css';
import { colIndexToLetter } from '../../utils/CalculatorEngine';

const TemplateEditor = ({ onSave, onCancel, initialTemplate }) => {
  const [name, setName] = useState(initialTemplate?.name || '');
  const jssRef = useRef(null);
  const jssInstance = useRef(null);
  const [selectedColIndex, setSelectedColIndex] = useState(null);
  
  // We store column types/sources locally
  const [colSources, setColSources] = useState(() => {
    const sources = {};
    if (initialTemplate?.columns) {
      initialTemplate.columns.forEach((col, idx) => {
        sources[idx] = col.source;
      });
    }
    return sources;
  });

  useEffect(() => {
    const currentJssRef = jssRef.current;
    if (!currentJssRef) return;
    if (jssInstance.current) return;

    // Construct initial data
    const data = [];
    // Row 0: Headers
    const headers = Array(20).fill('');
    // Row 1: Test Values / Formulas
    const values = Array(20).fill('');
    
    if (initialTemplate?.columns) {
      initialTemplate.columns.forEach((col, idx) => {
        if (idx < 20) {
          headers[idx] = col.name;
          values[idx] = col.source === 'formula' ? col.formula : (col.testValue || '');
        }
      });
    }
    
    data.push(headers);
    data.push(values);
    
    // Fill the rest with empty rows
    for (let i = 0; i < 8; i++) {
      data.push(Array(20).fill(''));
    }

    const options = {
      worksheets: [{
        data: data,
        minDimensions: [15, 10], // 15 columns, 10 rows
        defaultColWidth: 100,
      }],
      tabs: false,
      contextMenu: () => false, // disable context menu to keep it simple for now
      onselection: (instance, col1) => {
        // When user selects a cell, update the selected column index
        setSelectedColIndex(parseInt(col1));
      },
      onchange: (instance, cell, col, row, value) => {
        // If user typed a formula in row 1, auto-set source to 'formula'
        const r = parseInt(row);
        const c = parseInt(col);
        if (r === 1 && typeof value === 'string' && value.startsWith('=')) {
          setColSources(prev => ({ ...prev, [c]: 'formula' }));
        }
      }
    };

    // Clear DOM in case of React Strict Mode double-invocation
    if (jssRef.current) {
      jssRef.current.innerHTML = '';
    }

    jssInstance.current = jspreadsheet(jssRef.current, options);
    const sheet = jssInstance.current[0]; // v5 returns array of worksheets

    // Style the first row to look like headers
    for(let i=0; i<15; i++) {
      sheet.setStyle(colIndexToLetter(i) + '1', 'background-color', '#f8f9fa');
      sheet.setStyle(colIndexToLetter(i) + '1', 'font-weight', 'bold');
      sheet.setStyle(colIndexToLetter(i) + '1', 'text-align', 'center');
    }

    return () => {
      if (jssInstance.current) {
        try {
          // Safe destroy for v5
          jssInstance.current[0].destroy();
        } catch (e) {
          console.error('jss destroy error:', e);
        }
        
        if (currentJssRef) {
          currentJssRef.innerHTML = '';
        }
        jssInstance.current = null;
      }
    };
  }, [initialTemplate]);

  const handleUpdateSource = (sourceType) => {
    if (selectedColIndex === null) return;
    setColSources(prev => ({ ...prev, [selectedColIndex]: sourceType }));
  };

  const handleSave = () => {
    if (!name.trim()) return alert('الرجاء إدخال اسم النموذج');
    
    // We need to extract headers from Row 0, and values/formulas from Row 1
    const sheet = jssInstance.current[0];
    const rawData = sheet.getData(false); // get evaluated data
    
    const validColumns = [];
    
    for (let c = 0; c < rawData[0].length; c++) {
      const headerName = rawData[0][c];
      
      // To get raw formulas, we can't use getData, we have to look at the cells directly
      // jspreadsheet stores raw data in options.data
      const rawOptionsData = sheet.options.data;
      const rawVal = rawOptionsData[1][c];
      
      if (headerName && headerName.trim()) {
        const source = colSources[c] || 'input';
        validColumns.push({
          id: initialTemplate?.columns?.[c]?.id || 'col_' + Date.now() + '_' + c,
          name: headerName.trim(),
          source: source,
          formula: source === 'formula' ? rawVal : '',
          testValue: source !== 'formula' ? rawVal : ''
        });
      }
    }

    if (validColumns.length === 0) return alert('الرجاء تعبئة اسم عمود واحد على الأقل في الصف الأول');

    onSave({
      id: initialTemplate?.id || 'tpl_' + Date.now(),
      name,
      columns: validColumns,
      rows: initialTemplate?.rows || []
    });
  };

  return (
    <div className="calc-editor" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0', background: 'var(--bg-app)' }}>
      
      {/* Top Bar */}
      <div style={{ padding: '16px 24px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>اسم النموذج</span>
          <input 
            style={{ fontSize: '1.2rem', fontWeight: 'bold', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)' }}
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="مثال: أعمال الدفن الترابية" 
          />
        </div>
        <div className="calc-main-actions">
          <button className="calc-btn primary" onClick={handleSave}>حفظ النموذج</button>
          <button className="calc-btn secondary" onClick={onCancel}>إلغاء</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Spreadsheet Area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }} dir="ltr">
          <div style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.95rem' }} dir="rtl">
            <p style={{ fontWeight: '500', color: 'var(--text-primary)' }}>1. استخدم الصف الأول (Row 1) لإدخال أسماء الأعمدة.</p>
            <p>2. استخدم الصف الثاني (Row 2) لإدخال أرقام تجريبية أو معادلات إكسل مثل <code style={{color:'var(--apple-blue-action)'}}>=A2*B2</code>.</p>
          </div>

          <div style={{ background: '#fff', borderRadius: '4px', overflow: 'auto', boxShadow: 'var(--shadow-level-1)', maxWidth: '100%' }}>
            {/* The JSpreadsheet container MUST be LTR so its internal canvas logic doesn't break */}
            <div ref={jssRef}></div>
          </div>
        </div>

        {/* Sidebar Configuration Panel */}
        <div style={{ width: '300px', borderRight: '1px solid var(--border-soft)', background: 'var(--bg-surface)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }} dir="rtl">
          <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>إعدادات العمود</h3>
          
          {selectedColIndex !== null ? (
            <>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '12px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)' }}>
                <strong style={{ fontSize: '1.2rem', color: 'var(--apple-blue-action)' }}>العمود {colIndexToLetter(selectedColIndex)}</strong>
              </div>

              <div className="calc-form-group">
                <label>مصدر البيانات</label>
                <select 
                  className="calc-input"
                  value={colSources[selectedColIndex] || 'input'}
                  onChange={e => handleUpdateSource(e.target.value)}
                >
                  <option value="input">مدخلات يدوية (User Input)</option>
                  <option value="design">بيانات تصميمية (Design Data)</option>
                  <option value="formula">معادلة حسابية (Formula)</option>
                </select>
              </div>

              {colSources[selectedColIndex] === 'formula' && (
                <div style={{ padding: '12px', background: 'rgba(0, 113, 227, 0.1)', color: 'var(--apple-blue-action)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                  <strong>هذا العمود عبارة عن معادلة.</strong><br/>
                  سوف يقرأ النظام المعادلة التي أدخلتها في الصف الثاني من هذا العمود ويقوم بتطبيقها تلقائياً على كل صفوف المشروع.
                </div>
              )}

              {colSources[selectedColIndex] === 'design' && (
                <div className="calc-form-group">
                  <div style={{ padding: '12px', background: 'rgba(255, 149, 0, 0.1)', color: '#ff9500', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    <strong>بيانات تصميمية</strong><br/>
                    هذا العمود مخصص للبيانات المسحوبة من جداول الكميات أو المخططات. سيظهر كعمود جاهز للاستيراد.
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)' }}>
              انقر على أي خلية في الجدول لتعديل خصائصها
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;

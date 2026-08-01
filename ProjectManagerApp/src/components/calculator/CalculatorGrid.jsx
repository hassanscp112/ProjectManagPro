import { useMemo } from 'react';
import { calculateRow } from '../../utils/CalculatorEngine';

const CalculatorGrid = ({ template, onUpdateTemplate }) => {
  // NOTE: hooks must run before any early return, so guard for a null
  // template inside the memo rather than returning early above it.
  const totals = useMemo(() => {
    if (!template) return {};
    const sums = {};
    template.columns.forEach(col => {
      if (col.source === 'formula' || col.source === 'input' || col.source === 'design') {
        sums[col.id] = template.rows.reduce((acc, row) => {
          const val = parseFloat(row.values[col.id]) || 0;
          return acc + val;
        }, 0);
      }
    });
    return sums;
  }, [template]);

  if (!template) return null;

  const handleAddRow = () => {
    const newRow = {
      id: 'row_' + Date.now(),
      name: `عنصر ${template.rows.length + 1}`,
      values: {}
    };
    onUpdateTemplate({ ...template, rows: [...template.rows, newRow] });
  };

  const handleRemoveRow = (rowId) => {
    onUpdateTemplate({ 
      ...template, 
      rows: template.rows.filter(r => r.id !== rowId) 
    });
  };

  const handleUpdateCell = (rowId, colId, value) => {
    const newRows = template.rows.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, values: { ...row.values, [colId]: value } };
        return calculateRow(updatedRow, template.columns);
      }
      return row;
    });
    onUpdateTemplate({ ...template, rows: newRows });
  };

  const handleUpdateRowName = (rowId, name) => {
    const newRows = template.rows.map(row => row.id === rowId ? { ...row, name } : row);
    onUpdateTemplate({ ...template, rows: newRows });
  };

  return (
    <div className="calc-grid-container">
      <table className="calc-grid">
        <thead>
          <tr>
            <th style={{ width: '40px' }}></th>
            <th>الاسم (المرجع)</th>
            {template.columns.map(col => (
              <th key={col.id}>{col.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {template.rows.map((row) => (
            <tr key={row.id}>
              <td style={{ textAlign: 'center' }}>
                <button className="calc-delete-row-btn" onClick={() => handleRemoveRow(row.id)}>✕</button>
              </td>
              <td>
                <input 
                  className="calc-grid-input" 
                  value={row.name || ''} 
                  onChange={e => handleUpdateRowName(row.id, e.target.value)} 
                  placeholder="اسم العنصر"
                />
              </td>
              {template.columns.map(col => (
                <td key={col.id}>
                  {col.source === 'formula' ? (
                    <input 
                      className="calc-grid-input num center" 
                      value={parseFloat(row.values[col.id] || 0).toFixed(2)} 
                      readOnly 
                      title={col.formula}
                      style={{ color: 'var(--apple-blue-action)' }}
                    />
                  ) : col.source === 'design' ? (
                    <input 
                      className="calc-grid-input num center" 
                      type="number"
                      value={row.values[col.id] !== undefined ? row.values[col.id] : ''} 
                      onChange={e => handleUpdateCell(row.id, col.id, e.target.value)} 
                      placeholder="استيراد..."
                      style={{ background: 'rgba(255, 149, 0, 0.05)' }}
                    />
                  ) : (
                    <input 
                      className="calc-grid-input num center" 
                      type="number"
                      value={row.values[col.id] !== undefined ? row.values[col.id] : ''} 
                      onChange={e => handleUpdateCell(row.id, col.id, e.target.value)} 
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
          
          <tr className="total-row">
            <td></td>
            <td>المجموع الكلي</td>
            {template.columns.map(col => (
              <td key={`total_${col.id}`} className="num center">
                {col.source === 'formula' || col.source === 'input' || col.source === 'design' ? parseFloat(totals[col.id] || 0).toFixed(2) : ''}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <button className="calc-btn secondary" onClick={handleAddRow} style={{ marginTop: '16px' }}>
        + إضافة صف
      </button>
    </div>
  );
};

export default CalculatorGrid;

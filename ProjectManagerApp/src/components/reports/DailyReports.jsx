import { useState, useEffect, useMemo } from 'react';
import './DailyReports.css';

const REPORTS_STORAGE_KEY = 'project-manager-daily-reports';

const DailyReports = ({ tasks }) => {
  const [reports, setReports] = useState(() => {
    try {
      const saved = localStorage.getItem(REPORTS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState('entry'); // 'entry' or 'report'

  // Form State
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [engineer, setEngineer] = useState('');
  const [taskId, setTaskId] = useState('');
  const [details, setDetails] = useState('');
  const [quantity, setQuantity] = useState('');

  // Filter State
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterEngineer, setFilterEngineer] = useState('all');
  const [filterTask, setFilterTask] = useState('all');

  useEffect(() => {
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
  }, [reports]);

  // Derived unique engineers from past reports for dropdowns
  const uniqueEngineers = useMemo(() => {
    const engs = new Set(reports.map(r => r.engineer).filter(Boolean));
    return Array.from(engs).sort();
  }, [reports]);

  // Only leaf tasks (subtasks) should get progress logged
  const subTasks = useMemo(() => {
    return tasks.filter(t => !t.isGroup);
  }, [tasks]);

  const handleSaveReport = (e) => {
    e.preventDefault();
    if (!date || !engineer || !taskId) return alert('الرجاء تعبئة التاريخ، واسم المهندس، والفقرة');

    const taskObj = tasks.find(t => t.id === taskId);
    const newReport = {
      id: 'rep_' + Date.now(),
      date,
      engineer,
      taskId,
      taskName: taskObj ? taskObj.name : 'فقرة غير معروفة',
      taskWbs: taskObj ? taskObj.wbs : '',
      details,
      quantity: quantity ? parseFloat(quantity) : 0,
      timestamp: Date.now()
    };

    setReports([newReport, ...reports]);
    // Reset fields except date and engineer for faster subsequent entries
    setTaskId('');
    setDetails('');
    setQuantity('');
    alert('تم حفظ التقرير بنجاح!');
  };

  const handleDelete = (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا السجل؟')) {
      setReports(reports.filter(r => r.id !== id));
    }
  };

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      // Date filter
      if (filterFrom && r.date < filterFrom) return false;
      if (filterTo && r.date > filterTo) return false;
      
      // Engineer filter
      if (filterEngineer !== 'all' && r.engineer !== filterEngineer) return false;
      
      // Task filter
      if (filterTask !== 'all' && r.taskId !== filterTask) return false;
      
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort newest first
  }, [reports, filterFrom, filterTo, filterEngineer, filterTask]);

  const totalFilteredQuantity = useMemo(() => {
    return filteredReports.reduce((sum, r) => sum + (r.quantity || 0), 0);
  }, [filteredReports]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="reports-container" dir="rtl">
      
      {/* Tab Navigation (Hidden during print) */}
      <div className="reports-header no-print">
        <h2 style={{margin: 0}}>التقارير اليومية والماليات</h2>
        <div className="reports-tabs">
          <button 
            className={`reports-tab ${activeTab === 'entry' ? 'active' : ''}`}
            onClick={() => setActiveTab('entry')}
          >
            إدخال تقرير جديد
          </button>
          <button 
            className={`reports-tab ${activeTab === 'report' ? 'active' : ''}`}
            onClick={() => setActiveTab('report')}
          >
            شاشة الفرز والطباعة
          </button>
        </div>
      </div>

      {activeTab === 'entry' && (
        <div className="reports-entry-view no-print">
          <form className="reports-form" onSubmit={handleSaveReport}>
            <h3>إضافة سجل يومي</h3>
            
            <div className="form-grid">
              <div className="form-group">
                <label>التاريخ</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>

              <div className="form-group">
                <label>اسم المهندس</label>
                <input 
                  type="text" 
                  value={engineer} 
                  onChange={e => setEngineer(e.target.value)} 
                  list="engineers-list" 
                  placeholder="أدخل أو اختر اسم المهندس"
                  required 
                />
                <datalist id="engineers-list">
                  {uniqueEngineers.map(eng => <option key={eng} value={eng} />)}
                </datalist>
              </div>
            </div>

            <div className="form-group">
              <label>اسم الفقرة (Task)</label>
              <select value={taskId} onChange={e => setTaskId(e.target.value)} required>
                <option value="">-- اختر الفقرة من جدول تقدم العمل --</option>
                {subTasks.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.wbs} - {t.name.substring(0, 80)}{t.name.length > 80 ? '...' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>الكمية المنفذة (ان وجدت)</label>
                <input type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="مثال: 150" />
              </div>
            </div>

            <div className="form-group">
              <label>التفاصيل والملاحظات</label>
              <textarea 
                value={details} 
                onChange={e => setDetails(e.target.value)} 
                rows={4}
                placeholder="اكتب تفاصيل العمل الذي تم إنجازه..."
              ></textarea>
            </div>

            <div className="form-actions">
              <button type="submit" className="apple-btn primary">حفظ السجل</button>
            </div>
          </form>

          {/* Mini Recent Log */}
          <div className="recent-logs">
            <h3>آخر السجلات المضافة</h3>
            <div className="reports-table-wrapper">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>المهندس</th>
                    <th>الفقرة</th>
                    <th>الكمية</th>
                    <th>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.slice(0, 5).map(r => (
                    <tr key={r.id}>
                      <td>{r.date}</td>
                      <td>{r.engineer}</td>
                      <td title={r.taskName}>{r.taskWbs} - {r.taskName.substring(0,30)}</td>
                      <td>{r.quantity}</td>
                      <td>
                        <button type="button" onClick={() => handleDelete(r.id)} className="apple-btn destructive" style={{padding: '4px 8px', fontSize: '0.75rem'}}>حذف</button>
                      </td>
                    </tr>
                  ))}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{textAlign: 'center', padding: '24px', color: 'var(--text-muted)'}}>لا توجد سجلات بعد</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'report' && (
        <div className="reports-print-view">
          
          <div className="reports-filters no-print">
            <div className="filter-group">
              <label>من تاريخ</label>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
            </div>
            <div className="filter-group">
              <label>إلى تاريخ</label>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
            </div>
            <div className="filter-group">
              <label>اسم المهندس</label>
              <select value={filterEngineer} onChange={e => setFilterEngineer(e.target.value)}>
                <option value="all">الكل</option>
                {uniqueEngineers.map(eng => <option key={eng} value={eng}>{eng}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>الفقرة</label>
              <select value={filterTask} onChange={e => setFilterTask(e.target.value)}>
                <option value="all">الكل</option>
                {subTasks.map(t => <option key={t.id} value={t.id}>{t.wbs} - {t.name.substring(0, 50)}</option>)}
              </select>
            </div>
            <div className="filter-actions">
              <button onClick={handlePrint} className="apple-btn primary">🖨️ طباعة التقرير</button>
            </div>
          </div>

          <div className="print-canvas">
            <div className="print-header">
              <h2>التقرير اليومي لمشروع استصلاح الأراضي</h2>
              <div className="print-meta">
                {filterFrom && <span><strong>من:</strong> {filterFrom}</span>}
                {filterTo && <span><strong>إلى:</strong> {filterTo}</span>}
                {filterEngineer !== 'all' && <span><strong>المهندس:</strong> {filterEngineer}</span>}
                {filterTask !== 'all' && <span><strong>الفقرة:</strong> مقيدة</span>}
              </div>
            </div>

            <table className="reports-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>اسم المهندس</th>
                  <th>الفقرة</th>
                  <th>التفاصيل</th>
                  <th>الكمية</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map(r => (
                  <tr key={r.id}>
                    <td width="10%">{r.date}</td>
                    <td width="15%">{r.engineer}</td>
                    <td width="30%"><strong>{r.taskWbs}</strong> - {r.taskName}</td>
                    <td width="35%">{r.details}</td>
                    <td width="10%">{r.quantity}</td>
                  </tr>
                ))}
                {filteredReports.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{textAlign: 'center', padding: '40px', color: '#888'}}>لا توجد بيانات مطابقة للفرز</td>
                  </tr>
                )}
              </tbody>
              {filteredReports.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan="4" style={{textAlign: 'left', fontWeight: 'bold'}}>إجمالي الكمية المنفذة:</td>
                    <td style={{fontWeight: 'bold', color: 'var(--apple-blue-action)'}}>{totalFilteredQuantity}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

        </div>
      )}

    </div>
  );
};

export default DailyReports;

import { useMemo } from 'react';
import './Dashboard.css';

const Dashboard = ({ tasks, summary }) => {
  const today = new Date().toISOString().split('T')[0];
  const evm = summary?.evm;
  const fmtCur = (n) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
  const fmtIdx = (n) => (Number(n) || 0).toFixed(2);

  const processedData = useMemo(() => {
    const data = {
      overdue: [],
      active: [],
      upcoming: [],
      completed: []
    };

    if (!tasks || tasks.length === 0) return data;

    tasks.forEach(task => {
      // Skip group/summary tasks
      if (task.isGroup) return;

      if (task.progress >= 1) {
        data.completed.push(task);
        return;
      }

      if (task.endDate < today) {
        data.overdue.push(task);
      } else if (task.startDate <= today && task.endDate >= today) {
        data.active.push(task);
      } else if (task.startDate > today) {
        data.upcoming.push(task);
      }
    });

    return data;
  }, [tasks, today]);

  // For the Action Items table, we want Overdue first, then Active, then Upcoming (next 7 days only)
  const actionItems = useMemo(() => {
    const todayDate = new Date(today);
    const nextWeekDate = new Date(todayDate);
    nextWeekDate.setDate(todayDate.getDate() + 7);
    const nextWeekStr = nextWeekDate.toISOString().split('T')[0];

    const upcomingNext7Days = processedData.upcoming.filter(t => t.startDate <= nextWeekStr);

    const formatTask = (task, priorityType) => ({
      ...task,
      priorityType,
      // Priority sorting weight: Critical = 1, Medium = 2, Low = 3
      weight: priorityType === 'critical' ? 1 : priorityType === 'medium' ? 2 : 3
    });

    const items = [
      ...processedData.overdue.map(t => formatTask(t, 'critical')),
      ...processedData.active.map(t => formatTask(t, 'medium')),
      ...upcomingNext7Days.map(t => formatTask(t, 'low'))
    ];

    // Sort by weight, then by end date
    items.sort((a, b) => {
      if (a.weight !== b.weight) return a.weight - b.weight;
      return a.endDate.localeCompare(b.endDate);
    });

    return items;
  }, [processedData, today]);

  return (
    <div className="dashboard-container" dir="rtl">
      <div className="dashboard-header">
        <h2>مرحباً بك في نظام إدارة المشاريع.</h2>
        <p>اختر وحدة وظيفية أساسية لإدارة المهام، الأصول، والتدفقات المالية داخل النظام.</p>
      </div>

      <div className="dashboard-summary">
        <div className="summary-card overdue">
          <span className="card-title">مهام متأخرة (عالية الأولوية)</span>
          <span className="card-value">{processedData.overdue.length}</span>
        </div>
        <div className="summary-card active">
          <span className="card-title">قيد التنفيذ (متوسطة الأولوية)</span>
          <span className="card-value">{processedData.active.length}</span>
        </div>
        <div className="summary-card upcoming">
          <span className="card-title">مهام قادمة</span>
          <span className="card-value">{processedData.upcoming.length}</span>
        </div>
        <div className="summary-card completed">
          <span className="card-title">مهام مكتملة</span>
          <span className="card-value">{processedData.completed.length}</span>
        </div>
      </div>

      {evm && evm.bac > 0 && (
        <div className="dashboard-evm">
          <h3>تحليل قيمة العمل المكتسبة (EVM — Earned Value Management)</h3>
          <div className="evm-grid">
            <div className="evm-tile">
              <span className="evm-label">الميزانية الإجمالية (BAC)</span>
              <span className="evm-value">{fmtCur(evm.bac)}</span>
            </div>
            <div className="evm-tile">
              <span className="evm-label">القيمة المخططة (PV)</span>
              <span className="evm-value">{fmtCur(evm.pv)}</span>
            </div>
            <div className="evm-tile">
              <span className="evm-label">القيمة المكتسبة (EV)</span>
              <span className="evm-value">{fmtCur(evm.ev)}</span>
            </div>
            <div className="evm-tile">
              <span className="evm-label">التكلفة الفعلية (AC)</span>
              <span className="evm-value">{fmtCur(evm.ac)}</span>
            </div>
            <div className={`evm-tile evm-index ${evm.spi >= 1 ? 'good' : 'bad'}`}>
              <span className="evm-label">مؤشر الأداء الزمني (SPI)</span>
              <span className="evm-value">{fmtIdx(evm.spi)}</span>
              <span className="evm-hint">{evm.spi >= 1 ? 'متقدم على الجدول' : 'متأخر عن الجدول'}</span>
            </div>
            <div className={`evm-tile evm-index ${evm.cpi >= 1 ? 'good' : 'bad'}`}>
              <span className="evm-label">مؤشر أداء التكلفة (CPI)</span>
              <span className="evm-value">{fmtIdx(evm.cpi)}</span>
              <span className="evm-hint">{evm.cpi >= 1 ? 'تحت الميزانية' : 'فوق الميزانية'}</span>
            </div>
            <div className="evm-tile">
              <span className="evm-label">التكلفة المتوقعة عند الإكمال (EAC)</span>
              <span className="evm-value">{fmtCur(evm.eac)}</span>
            </div>
            <div className={`evm-tile ${evm.vac >= 0 ? 'good' : 'bad'}`}>
              <span className="evm-label">الانحراف عند الإكمال (VAC)</span>
              <span className="evm-value">{fmtCur(evm.vac)}</span>
              <span className="evm-hint">{evm.vac >= 0 ? 'تحت الميزانية' : 'تجاوز الميزانية'}</span>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-action-items">
        <h3>المهام المطلوبة (حسب الأولوية)</h3>
        <div className="action-table-wrapper">
          <table className="action-table">
            <thead>
              <tr>
                <th>WBS</th>
                <th>اسم المهمة</th>
                <th>تاريخ البدء</th>
                <th>تاريخ الانتهاء</th>
                <th>نسبة الإنجاز</th>
                <th>الأولوية / الحالة</th>
              </tr>
            </thead>
            <tbody>
              {actionItems.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>لا توجد مهام مطلوبة حالياً.</td>
                </tr>
              ) : (
                actionItems.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{item.wbs}</td>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td>{item.startDate}</td>
                    <td style={{ color: item.priorityType === 'critical' ? '#ef4444' : 'inherit' }}>{item.endDate}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="dash-progress-text">{Math.round(item.progress * 100)}%</span>
                        <div className="dash-progress-wrapper">
                          <div className="dash-progress-fill" style={{ width: `${Math.round(item.progress * 100)}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {item.priorityType === 'critical' && <span className="priority-badge critical">متأخرة (عالية)</span>}
                      {item.priorityType === 'medium' && <span className="priority-badge medium">قيد التنفيذ (متوسطة)</span>}
                      {item.priorityType === 'low' && <span className="priority-badge low">تبدأ قريباً (عادية)</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

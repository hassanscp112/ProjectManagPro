import { useMemo } from 'react';
import './Dashboard.css';
import SCurveChart from './SCurveChart';
import { useI18n } from '../../i18n/useI18n.js';
import { formatNumber } from '../../i18n/index.js';

// Color tone for an SPI/CPI index: ≥1 good (on/under), 0.9–1 warn, <0.9 bad.
const evmTone = (idx) => {
  const v = Number(idx) || 0;
  if (v >= 1) return 'good';
  if (v >= 0.9) return 'warn';
  return 'bad';
};

const Dashboard = ({ tasks, summary }) => {
  const { t, dir } = useI18n();
  const today = new Date().toISOString().split('T')[0];
  const evm = summary?.evm;
  const sCurve = summary?.sCurve;
  const perWbsEvm = summary?.perWbsEvm;
  const fmtCur = (n) => formatNumber(Math.round(Number(n) || 0));
  const fmtIdx = (n) => (Number(n) || 0).toFixed(2);

  // Per-WBS rows, sorted by WBS numeric order.
  const wbsRows = useMemo(() => {
    if (!perWbsEvm || !perWbsEvm.length) return [];
    return [...perWbsEvm].sort((a, b) => {
      const an = parseInt(a.wbs, 10) || 0;
      const bn = parseInt(b.wbs, 10) || 0;
      return an - bn;
    });
  }, [perWbsEvm]);

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
    <div className="dashboard-container" dir={dir}>
      <div className="dashboard-header">
        <h2>{t('dashboard.welcome')}</h2>
        <p>{t('dashboard.welcomeSubtitle')}</p>
      </div>

      <div className="dashboard-summary">
        <div className="summary-card overdue">
          <span className="card-title">{t('dashboard.cardOverdue')}</span>
          <span className="card-value">{processedData.overdue.length}</span>
        </div>
        <div className="summary-card active">
          <span className="card-title">{t('dashboard.cardActive')}</span>
          <span className="card-value">{processedData.active.length}</span>
        </div>
        <div className="summary-card upcoming">
          <span className="card-title">{t('dashboard.cardUpcoming')}</span>
          <span className="card-value">{processedData.upcoming.length}</span>
        </div>
        <div className="summary-card completed">
          <span className="card-title">{t('dashboard.cardCompleted')}</span>
          <span className="card-value">{processedData.completed.length}</span>
        </div>
      </div>

      {evm && evm.bac > 0 && (
        <div className="dashboard-evm">
          <h3>{t('dashboard.evmTitle')}</h3>
          <div className="evm-grid">
            <div className="evm-tile">
              <span className="evm-label">{t('dashboard.evmBac')}</span>
              <span className="evm-value">{fmtCur(evm.bac)}</span>
            </div>
            <div className="evm-tile">
              <span className="evm-label">{t('dashboard.evmPv')}</span>
              <span className="evm-value">{fmtCur(evm.pv)}</span>
            </div>
            <div className="evm-tile">
              <span className="evm-label">{t('dashboard.evmEv')}</span>
              <span className="evm-value">{fmtCur(evm.ev)}</span>
            </div>
            <div className="evm-tile">
              <span className="evm-label">{t('dashboard.evmAc')}</span>
              <span className="evm-value">{fmtCur(evm.ac)}</span>
            </div>
            <div className={`evm-tile evm-index ${evm.spi >= 1 ? 'good' : 'bad'}`}>
              <span className="evm-label">{t('dashboard.evmSpi')}</span>
              <span className="evm-value">{fmtIdx(evm.spi)}</span>
              <span className="evm-hint">
                {evm.spi >= 1 ? t('dashboard.aheadOfSchedule') : t('dashboard.behindSchedule')}
              </span>
            </div>
            <div className={`evm-tile evm-index ${evm.cpi >= 1 ? 'good' : 'bad'}`}>
              <span className="evm-label">{t('dashboard.evmCpi')}</span>
              <span className="evm-value">{fmtIdx(evm.cpi)}</span>
              <span className="evm-hint">
                {evm.cpi >= 1 ? t('dashboard.underBudget') : t('dashboard.overBudget')}
              </span>
            </div>
            <div className="evm-tile">
              <span className="evm-label">{t('dashboard.evmEac')}</span>
              <span className="evm-value">{fmtCur(evm.eac)}</span>
            </div>
            <div className={`evm-tile ${evm.vac >= 0 ? 'good' : 'bad'}`}>
              <span className="evm-label">{t('dashboard.evmVac')}</span>
              <span className="evm-value">{fmtCur(evm.vac)}</span>
              <span className="evm-hint">
                {evm.vac >= 0 ? t('dashboard.underBudget') : t('dashboard.budgetOverrun')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* S-curve: cumulative PV vs EV vs AC over time */}
      {sCurve && sCurve.length > 1 && (
        <div className="scurve-section">
          <h3>{t('dashboard.scurveTitle')}</h3>
          <p className="scurve-subtitle">{t('dashboard.scurveSubtitle')}</p>
          <SCurveChart points={sCurve} />
        </div>
      )}

      {/* Per-WBS EVM roll-up */}
      {wbsRows.length > 0 && (
        <div className="wbs-evm-section">
          <h3>{t('dashboard.wbsTitle')}</h3>
          <p className="wbs-evm-subtitle">{t('dashboard.wbsSubtitle')}</p>
          <div className="wbs-evm-table-wrap">
            <table className="wbs-evm-table">
              <thead>
                <tr>
                  <th>{t('dashboard.colCode')}</th>
                  <th>{t('common.name')}</th>
                  <th>{t('dashboard.colItemCount')}</th>
                  <th>{t('dashboard.colBac', { unit: t('dashboard.currencyUnit') })}</th>
                  <th>{t('dashboard.colPv', { unit: t('dashboard.currencyUnit') })}</th>
                  <th>{t('dashboard.colEv', { unit: t('dashboard.currencyUnit') })}</th>
                  <th>{t('dashboard.colAc', { unit: t('dashboard.currencyUnit') })}</th>
                  <th>SPI</th>
                  <th>CPI</th>
                </tr>
              </thead>
              <tbody>
                {wbsRows.map((row) => (
                  <tr key={row.wbs}>
                    <td className="wbs-code">{row.wbs}</td>
                    <td className="name-cell">{row.name}</td>
                    <td className="num">{row.taskCount}</td>
                    <td className="num">{fmtCur(row.bac)}</td>
                    <td className="num">{fmtCur(row.pv)}</td>
                    <td className="num">{fmtCur(row.ev)}</td>
                    <td className="num">{fmtCur(row.ac)}</td>
                    <td className="num">
                      <span className={`wbs-evm-pill ${evmTone(row.spi)}`}>{fmtIdx(row.spi)}</span>
                    </td>
                    <td className="num">
                      <span className={`wbs-evm-pill ${evmTone(row.cpi)}`}>{fmtIdx(row.cpi)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="dashboard-action-items">
        <h3>{t('dashboard.actionTitle')}</h3>
        <div className="action-table-wrapper">
          <table className="action-table">
            <thead>
              <tr>
                <th>WBS</th>
                <th>{t('dashboard.colTaskName')}</th>
                <th>{t('dashboard.colStartDate')}</th>
                <th>{t('dashboard.colEndDate')}</th>
                <th>{t('dashboard.colProgress')}</th>
                <th>{t('dashboard.colPriority')}</th>
              </tr>
            </thead>
            <tbody>
              {actionItems.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t('dashboard.noActionItems')}</td>
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
                      {item.priorityType === 'critical' && <span className="priority-badge critical">{t('dashboard.priorityCritical')}</span>}
                      {item.priorityType === 'medium' && <span className="priority-badge medium">{t('dashboard.priorityMedium')}</span>}
                      {item.priorityType === 'low' && <span className="priority-badge low">{t('dashboard.priorityLow')}</span>}
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

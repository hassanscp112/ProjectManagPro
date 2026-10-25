// ═══════════════════════════════════════════════════════════
// DailyNotes — persistence for the daily report's site notes
// (what orders can't capture: weather, manpower, visitors, issues).
// Plain JS, localStorage only.
//
// Storage key: 'project-manager-daily-reports' (same key and shape as
// the legacy DailyReports screen, so existing notes carry over):
//   [{ id, date, engineer, taskId, taskName, taskWbs, details,
//      quantity?, timestamp }]
// `quantity` exists only on legacy notes; new notes don't record
// quantities (executed quantities come from orders).
// ═══════════════════════════════════════════════════════════

import { projectKey } from './Projects.js';

export const DAILY_NOTES_STORAGE_KEY = 'project-manager-daily-reports';

export const loadDailyNotes = () => {
  try {
    const saved = localStorage.getItem(projectKey(DAILY_NOTES_STORAGE_KEY));
    const list = saved ? JSON.parse(saved) : [];
    return Array.isArray(list) ? list.filter((n) => n && typeof n === 'object' && n.id && n.date) : [];
  } catch {
    return [];
  }
};

export const saveDailyNotes = (notes) => {
  try {
    localStorage.setItem(projectKey(DAILY_NOTES_STORAGE_KEY), JSON.stringify(notes));
  } catch {
    // storage full / unavailable — notes stay in memory for this session
  }
};

export const createDailyNote = ({ date, engineer, task, details }) => ({
  id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  date,
  engineer: engineer.trim(),
  taskId: task?.id || '',
  taskName: task?.name || '',
  taskWbs: task?.wbs || '',
  details: details.trim(),
  timestamp: Date.now(),
});

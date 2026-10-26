// ═══════════════════════════════════════════════════════════
// Finance — the old site cost ledger (read-only) and the finance
// dropdown lists. Plain JS, localStorage only.
//
// Expenses are entered as expense orders (OrderEngine, 'pm-orders');
// the Finance screen's ledgers are views over them (state/financeModel.js).
//
// 'project-manager-finance-data' — the old ledger, kept and never deleted:
//   { machinery: [], materials: [], pettyCash: [], payroll: [],
//     migration?: { migratedAt, migratedBy, lastRunAt, count, sourceKeys } }
//   Nothing writes the ledger records any more; `migration` is set once
//   they have been moved into expense orders.
// 'project-manager-finance-config':
//   { machines, machineSizes, employees, materials, expenseTypes, statuses }
//   — the values expense orders pick from; user data, kept as entered
//   (Arabic defaults below).
// ═══════════════════════════════════════════════════════════

import { projectKey } from './Projects.js';
import { notifyStoreChange } from './storeEvents.js';

export const FINANCE_DATA_KEY = 'project-manager-finance-data';
export const FINANCE_CONFIG_KEY = 'project-manager-finance-config';

export const LEDGERS = ['machinery', 'materials', 'pettyCash', 'payroll'];

export const DEFAULT_FINANCE_CONFIG = {
  machines: ['بلدوزر', 'شفل', 'حفارة', 'لوري قلاب', 'حادلة', 'كريدر'],
  machineSizes: ['كبير', 'وسط', 'صغير'],
  employees: ['سائق احمد', 'سائق عمر', 'سائق عباس', 'مهندس علي', 'مهندس حسين'],
  materials: ['رمل', 'حصو', 'سمنت', 'حديد', 'كاز/وقود', 'طابوق'],
  expenseTypes: ['اطعام', 'بنزين', 'مواصلات', 'نثريات', 'صيانة'],
  statuses: ['مستقطع', 'غير مستقطع'],
};

const emptyData = () => ({ machinery: [], materials: [], pettyCash: [], payroll: [] });

const readStored = () => JSON.parse(localStorage.getItem(projectKey(FINANCE_DATA_KEY)) || 'null');

/** The old ledger's records (read-only). */
export const loadFinanceData = () => {
  try {
    const saved = readStored();
    const data = emptyData();
    if (saved && typeof saved === 'object') {
      LEDGERS.forEach((l) => {
        if (Array.isArray(saved[l])) data[l] = saved[l];
      });
    }
    return data;
  } catch {
    return emptyData();
  }
};

/** The migrated flag ({ migratedAt, migratedBy, … }), or null before the move. */
export const loadFinanceMigration = () => {
  try {
    const saved = readStored();
    return saved && typeof saved.migration === 'object' && saved.migration ? saved.migration : null;
  } catch {
    return null;
  }
};

/**
 * Set the migrated flag. Only `migration` changes: the ledger records stay
 * exactly as stored. A stored value that cannot be read is left alone (the
 * flag is not worth risking the old ledger). Returns true when written.
 */
export const saveFinanceMigration = (migration) => {
  let saved;
  try {
    saved = readStored();
  } catch {
    return false;
  }
  if (saved !== null && (typeof saved !== 'object' || Array.isArray(saved))) return false;
  try {
    localStorage.setItem(projectKey(FINANCE_DATA_KEY), JSON.stringify({ ...(saved || {}), migration }));
    notifyStoreChange(FINANCE_DATA_KEY);
    return true;
  } catch {
    return false; // storage full / unavailable
  }
};

/** Stored lists over the defaults (a missing list falls back to its default). */
export const loadFinanceConfig = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(projectKey(FINANCE_CONFIG_KEY)) || 'null');
    const config = { ...DEFAULT_FINANCE_CONFIG };
    if (saved && typeof saved === 'object') {
      Object.keys(config).forEach((k) => {
        if (Array.isArray(saved[k])) config[k] = saved[k];
      });
    }
    return config;
  } catch {
    return { ...DEFAULT_FINANCE_CONFIG };
  }
};

export const saveFinanceConfig = (config) => {
  try {
    localStorage.setItem(projectKey(FINANCE_CONFIG_KEY), JSON.stringify(config));
  } catch {
    // storage full / unavailable — keep working in memory
  }
};

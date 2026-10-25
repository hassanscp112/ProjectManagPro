// ═══════════════════════════════════════════════════════════
// Finance — persistence for the site cost ledgers and their
// editable dropdown lists. Plain JS, localStorage only.
//
// 'project-manager-finance-data':
//   { machinery: [], materials: [], pettyCash: [], payroll: [] }
//   (record shapes: see src/state/financeModel.js)
// 'project-manager-finance-config':
//   { machines, machineSizes, employees, materials, expenseTypes, statuses }
//   — user data, kept as entered (Arabic defaults below).
// ═══════════════════════════════════════════════════════════

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

export const loadFinanceData = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(FINANCE_DATA_KEY) || 'null');
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

export const saveFinanceData = (data) => {
  try {
    localStorage.setItem(FINANCE_DATA_KEY, JSON.stringify(data));
  } catch {
    // storage full / unavailable — keep working in memory
  }
};

/** Stored lists over the defaults (a missing list falls back to its default). */
export const loadFinanceConfig = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(FINANCE_CONFIG_KEY) || 'null');
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
    localStorage.setItem(FINANCE_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // storage full / unavailable — keep working in memory
  }
};

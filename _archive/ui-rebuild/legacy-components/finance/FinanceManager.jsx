import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { formatCurrency } from '../../i18n/index.js';
import './FinanceManager.css';

const FINANCE_STORAGE_KEY = 'project-manager-finance-data';
const FINANCE_CONFIG_KEY = 'project-manager-finance-config';

// NOTE: these lists are persisted user data (editable via the Settings tab and
// stored in localStorage) and saved records reference their values — they stay
// Arabic/as-entered regardless of the UI language.
const DEFAULT_CONFIG = {
  machines: ['بلدوزر', 'شفل', 'حفارة', 'لوري قلاب', 'حادلة', 'كريدر'],
  machineSizes: ['كبير', 'وسط', 'صغير'],
  employees: ['سائق احمد', 'سائق عمر', 'سائق عباس', 'مهندس علي', 'مهندس حسين'],
  materials: ['رمل', 'حصو', 'سمنت', 'حديد', 'كاز/وقود', 'طابوق'],
  expenseTypes: ['اطعام', 'بنزين', 'مواصلات', 'نثريات', 'صيانة'],
  statuses: ['مستقطع', 'غير مستقطع']
};

const FinanceManager = () => {
  const { t, lang, dir } = useI18n();

  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(FINANCE_STORAGE_KEY);
      return saved ? JSON.parse(saved) : { machinery: [], materials: [], pettyCash: [], payroll: [] };
    } catch {
      return { machinery: [], materials: [], pettyCash: [], payroll: [] };
    }
  });

  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(FINANCE_CONFIG_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const [activeTab, setActiveTab] = useState('machinery'); // machinery, materials, pettyCash, payroll, settings

  useEffect(() => {
    localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem(FINANCE_CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  const addRecord = (category, record) => {
    setData(prev => ({ ...prev, [category]: [{ id: Date.now().toString(), ...record }, ...prev[category]] }));
  };

  const deleteRecord = (category, id) => {
    if (window.confirm(t('finance.confirmDelete'))) {
      setData(prev => ({ ...prev, [category]: prev[category].filter(r => r.id !== id) }));
    }
  };

  const updateConfig = (key, list) => {
    setConfig(prev => ({ ...prev, [key]: list }));
  };

  const money = (val) => formatCurrency(val, lang);

  const calculateTotal = (records) => records.reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0);

  return (
    <div className="finance-container" dir={dir}>
      <div className="finance-header no-print">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h2 style={{margin: 0}}>{t('finance.title')}</h2>
          <button className="apple-btn secondary" onClick={() => setActiveTab('settings')}>⚙️ {t('finance.settings')}</button>
        </div>

        {/* Global Summary Cards */}
        <div className="finance-summary-cards">
          <div className="finance-card total">
            <span className="card-label">{t('finance.totalCosts')}</span>
            <span className="card-value">{money(calculateTotal(data.machinery) + calculateTotal(data.materials) + calculateTotal(data.pettyCash) + calculateTotal(data.payroll))}</span>
          </div>
          <div className="finance-card">
            <span className="card-label">{t('finance.cardMachinery')}</span>
            <span className="card-value">{money(calculateTotal(data.machinery))}</span>
          </div>
          <div className="finance-card">
            <span className="card-label">{t('finance.cardMaterials')}</span>
            <span className="card-value">{money(calculateTotal(data.materials))}</span>
          </div>
          <div className="finance-card">
            <span className="card-label">{t('finance.cardPettyCash')}</span>
            <span className="card-value">{money(calculateTotal(data.pettyCash))}</span>
          </div>
          <div className="finance-card">
            <span className="card-label">{t('finance.cardPayroll')}</span>
            <span className="card-value">{money(calculateTotal(data.payroll))}</span>
          </div>
        </div>

        <div className="finance-tabs">
          <button className={`finance-tab ${activeTab === 'machinery' ? 'active' : ''}`} onClick={() => setActiveTab('machinery')}>{t('finance.tabMachinery')}</button>
          <button className={`finance-tab ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}>{t('finance.tabMaterials')}</button>
          <button className={`finance-tab ${activeTab === 'pettyCash' ? 'active' : ''}`} onClick={() => setActiveTab('pettyCash')}>{t('finance.tabPettyCash')}</button>
          <button className={`finance-tab ${activeTab === 'payroll' ? 'active' : ''}`} onClick={() => setActiveTab('payroll')}>{t('finance.tabPayroll')}</button>
        </div>
      </div>

      <div className="finance-content">
        {activeTab === 'machinery' && <MachineryLedger records={data.machinery} config={config} onAdd={(r) => addRecord('machinery', r)} onDelete={(id) => deleteRecord('machinery', id)} />}
        {activeTab === 'materials' && <MaterialsLedger records={data.materials} config={config} onAdd={(r) => addRecord('materials', r)} onDelete={(id) => deleteRecord('materials', id)} />}
        {activeTab === 'pettyCash' && <PettyCashLedger records={data.pettyCash} config={config} onAdd={(r) => addRecord('pettyCash', r)} onDelete={(id) => deleteRecord('pettyCash', id)} />}
        {activeTab === 'payroll' && <PayrollLedger records={data.payroll} config={config} onAdd={(r) => addRecord('payroll', r)} onDelete={(id) => deleteRecord('payroll', id)} />}
        {activeTab === 'settings' && <SettingsTab config={config} updateConfig={updateConfig} />}
      </div>
    </div>
  );
};

// -------------------------------------------------------------------------
// Sub-Ledger Components
// -------------------------------------------------------------------------

const MachineryLedger = ({ records, config, onAdd, onDelete }) => {
  const { t, lang } = useI18n();
  const money = (val) => formatCurrency(val, lang);

  // Machine Details
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [machineName, setMachineName] = useState('');
  const [machineType, setMachineType] = useState(config.machines[0] || '');
  const [machineSize, setMachineSize] = useState(config.machineSizes[0] || '');
  const [badge, setBadge] = useState('');
  // Machine Cost
  const [machineHours, setMachineHours] = useState('');
  const [machineRate, setMachineRate] = useState('');
  // Driver Cost
  const [operator, setOperator] = useState('');
  const [driverHours, setDriverHours] = useState('');
  const [driverRate, setDriverRate] = useState('');
  // Fuel Cost
  const [fuelLiters, setFuelLiters] = useState('');
  const [fuelPrice, setFuelPrice] = useState('');

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterMachineType, setFilterMachineType] = useState('');
  const [filterOperator, setFilterOperator] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const mh = parseFloat(machineHours) || 0; const mr = parseFloat(machineRate) || 0;
    const dh = parseFloat(driverHours) || 0; const dr = parseFloat(driverRate) || 0;
    const fl = parseFloat(fuelLiters) || 0; const fp = parseFloat(fuelPrice) || 0;

    const machineTotal = mh * mr;
    const driverTotal = dh * dr;
    const fuelTotal = fl * fp;
    const grandTotal = machineTotal + driverTotal + fuelTotal;

    onAdd({
      date, machineName, machineType, machineSize, badge,
      machineHours: mh, machineRate: mr, machineTotal,
      operator, driverHours: dh, driverRate: dr, driverTotal,
      fuelLiters: fl, fuelPrice: fp, fuelTotal,
      totalPrice: grandTotal
    });

    // Reset specific fields but keep date, machine info for rapid entry
    setMachineHours(''); setDriverHours(''); setFuelLiters('');
  };

  const filtered = records.filter(r =>
    (!filterFrom || r.date >= filterFrom) &&
    (!filterTo || r.date <= filterTo) &&
    (!filterMachineType || r.machineType === filterMachineType) &&
    (!filterOperator || r.operator === filterOperator)
  );
  const totalCost = filtered.reduce((sum, r) => sum + (r.totalPrice || 0), 0);

  return (
    <div className="ledger-view">
      <div className="ledger-sidebar no-print" style={{width: '450px'}}>
        <h3>{t('finance.addMachineryRecord')}</h3>
        <form onSubmit={handleSubmit} className="ledger-form">

          <div className="form-section">
            <h4>{t('finance.machineInfo')}</h4>
            <div className="split-row">
              <div><label>{t('common.date')}</label><input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
              <div><label>{t('finance.badge')}</label><input type="text" value={badge} onChange={e => setBadge(e.target.value)} /></div>
            </div>
            <label>{t('finance.machineName')}</label><input type="text" value={machineName} onChange={e => setMachineName(e.target.value)} required list="machines-list"/>
            <div className="split-row">
              <div>
                <label>{t('finance.machineType')}</label>
                <select value={machineType} onChange={e => setMachineType(e.target.value)}>{config.machines.map(m => <option key={m}>{m}</option>)}</select>
              </div>
              <div>
                <label>{t('finance.machineSize')}</label>
                <select value={machineSize} onChange={e => setMachineSize(e.target.value)}>{config.machineSizes.map(s => <option key={s}>{s}</option>)}</select>
              </div>
            </div>
            <div className="split-row">
              <div><label>{t('finance.machineHours')}</label><input type="number" step="any" value={machineHours} onChange={e => setMachineHours(e.target.value)} required /></div>
              <div><label>{t('finance.machineRate')}</label><input type="number" step="any" value={machineRate} onChange={e => setMachineRate(e.target.value)} required /></div>
            </div>
          </div>

          <div className="form-section">
            <h4>{t('finance.driverInfo')}</h4>
            <label>{t('finance.driverName')}</label>
            <input type="text" value={operator} onChange={e => setOperator(e.target.value)} list="employees-list" required/>
            <div className="split-row">
              <div><label>{t('finance.driverHours')}</label><input type="number" step="any" value={driverHours} onChange={e => setDriverHours(e.target.value)} /></div>
              <div><label>{t('finance.driverRate')}</label><input type="number" step="any" value={driverRate} onChange={e => setDriverRate(e.target.value)} /></div>
            </div>
          </div>

          <div className="form-section">
            <h4>{t('finance.fuelInfo')}</h4>
            <div className="split-row">
              <div><label>{t('finance.fuelLiters')}</label><input type="number" step="any" value={fuelLiters} onChange={e => setFuelLiters(e.target.value)} /></div>
              <div><label>{t('finance.fuelPricePerLiter')}</label><input type="number" step="any" value={fuelPrice} onChange={e => setFuelPrice(e.target.value)} /></div>
            </div>
          </div>

          <button type="submit" className="apple-btn primary">{t('finance.saveFullRecord')}</button>
        </form>
      </div>

      <div className="ledger-main">
        <div className="ledger-filters no-print">
          <div className="filter-group"><label>{t('finance.machineType')}</label>
            <select value={filterMachineType} onChange={e => setFilterMachineType(e.target.value)}>
              <option value="">{t('finance.all')}</option>
              {config.machines.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="filter-group"><label>{t('finance.driverName')}</label>
            <select value={filterOperator} onChange={e => setFilterOperator(e.target.value)}>
              <option value="">{t('finance.all')}</option>
              {config.employees.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="filter-group"><label>{t('finance.dateFrom')}</label><input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} /></div>
          <div className="filter-group"><label>{t('finance.dateTo')}</label><input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} /></div>
          <div className="filter-group" style={{alignItems: 'flex-end'}}><button className="apple-btn secondary" onClick={() => window.print()}>🖨️ {t('common.print')}</button></div>
        </div>
        <div className="ledger-table-wrapper" style={{overflowX: 'auto'}}>
          <table className="ledger-table" style={{minWidth: '1200px'}}>
            <thead>
              <tr>
                <th>{t('common.date')}</th><th>{t('finance.thMachine')}</th><th>{t('finance.thDriver')}</th>
                <th>{t('finance.thMachineEarnings')}</th><th>{t('finance.thDriverEarnings')}</th>
                <th>{t('finance.thFuelCost')}</th><th>{t('finance.thTotalPrice')}</th><th className="no-print">{t('finance.thAction')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td><strong>{r.machineName}</strong> ({r.machineType})<br/><small>{r.machineHours}h @ {money(r.machineRate)}</small></td>
                  <td><strong>{r.operator}</strong><br/><small>{r.driverHours}h @ {money(r.driverRate)}</small></td>
                  <td>{money(r.machineTotal)}</td>
                  <td>{money(r.driverTotal)}</td>
                  <td>{money(r.fuelTotal)} <br/><small>({r.fuelLiters}L)</small></td>
                  <td className="cost-cell">{money(r.totalPrice)}</td>
                  <td className="no-print"><button onClick={() => onDelete(r.id)} className="apple-btn destructive" style={{padding:'4px 8px', fontSize:'0.75rem'}}>{t('common.delete')}</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan="6">{t('finance.periodTotal')}</td><td className="cost-cell total">{money(totalCost)}</td><td className="no-print"></td></tr></tfoot>
          </table>
        </div>
      </div>

      {/* DataLists for Autocomplete */}
      <datalist id="machines-list">{config.machines.map(m => <option key={m} value={m} />)}</datalist>
      <datalist id="employees-list">{config.employees.map(e => <option key={e} value={e} />)}</datalist>
    </div>
  );
};

const MaterialsLedger = ({ records, config, onAdd, onDelete }) => {
  const { t, lang } = useI18n();
  const money = (val) => formatCurrency(val, lang);

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [receipt, setReceipt] = useState('');
  const [details, setDetails] = useState('');
  const [materialType, setMaterialType] = useState(config.materials[0] || '');
  const [quantity, setQuantity] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({ date, receipt, details, materialType, quantity, totalPrice: parseFloat(totalPrice) || 0 });
    setReceipt(''); setDetails(''); setQuantity(''); setTotalPrice('');
  };

  const filtered = records.filter(r =>
    (!filterFrom || r.date >= filterFrom) &&
    (!filterTo || r.date <= filterTo) &&
    (!filterMaterial || r.materialType === filterMaterial)
  );
  const totalCost = filtered.reduce((sum, r) => sum + (r.totalPrice || 0), 0);

  return (
    <div className="ledger-view">
      <div className="ledger-sidebar no-print">
        <h3>{t('finance.addMaterialRecord')}</h3>
        <form onSubmit={handleSubmit} className="ledger-form">
          <label>{t('common.date')}</label><input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <label>{t('finance.receiptNo')}</label><input type="text" value={receipt} onChange={e => setReceipt(e.target.value)} />
          <label>{t('finance.materialType')}</label>
          <select value={materialType} onChange={e => setMaterialType(e.target.value)}>
            {config.materials.map(m => <option key={m}>{m}</option>)}
          </select>
          <label>{t('finance.detailsExample')}</label><input type="text" value={details} onChange={e => setDetails(e.target.value)} required />
          <div className="split-row">
            <div><label>{t('finance.quantityWithUnit')}</label><input type="text" value={quantity} onChange={e => setQuantity(e.target.value)} required placeholder={t('finance.qtyPlaceholder')}/></div>
            <div><label>{t('common.price')}</label><input type="number" step="any" value={totalPrice} onChange={e => setTotalPrice(e.target.value)} required /></div>
          </div>
          <button type="submit" className="apple-btn primary">{t('finance.saveRecord')}</button>
        </form>
      </div>
      <div className="ledger-main">
        <div className="ledger-filters no-print">
          <div className="filter-group"><label>{t('finance.materialType')}</label>
            <select value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)}>
              <option value="">{t('finance.all')}</option>
              {config.materials.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="filter-group"><label>{t('finance.dateFrom')}</label><input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} /></div>
          <div className="filter-group"><label>{t('finance.dateTo')}</label><input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} /></div>
          <div className="filter-group" style={{alignItems: 'flex-end'}}><button className="apple-btn secondary" onClick={() => window.print()}>🖨️ {t('common.print')}</button></div>
        </div>
        <div className="ledger-table-wrapper">
          <table className="ledger-table">
            <thead><tr><th>{t('common.date')}</th><th>{t('finance.receiptNo')}</th><th>{t('finance.thMaterial')}</th><th>{t('finance.thDetails')}</th><th>{t('common.quantity')}</th><th>{t('common.price')}</th><th className="no-print">{t('finance.thAction')}</th></tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td><td>{r.receipt}</td><td>{r.materialType}</td><td>{r.details}</td><td>{r.quantity}</td>
                  <td className="cost-cell">{money(r.totalPrice)}</td>
                  <td className="no-print"><button onClick={() => onDelete(r.id)} className="apple-btn destructive" style={{padding:'4px 8px', fontSize:'0.75rem'}}>{t('common.delete')}</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan="5">{t('finance.periodTotal')}</td><td className="cost-cell total">{money(totalCost)}</td><td className="no-print"></td></tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

const PettyCashLedger = ({ records, config, onAdd, onDelete }) => {
  const { t, lang } = useI18n();
  const money = (val) => formatCurrency(val, lang);

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expenseType, setExpenseType] = useState(config.expenseTypes[0] || '');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterExpense, setFilterExpense] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({ date, expenseType, notes, totalPrice: parseFloat(price) || 0 });
    setPrice(''); setNotes('');
  };

  const filtered = records.filter(r =>
    (!filterFrom || r.date >= filterFrom) &&
    (!filterTo || r.date <= filterTo) &&
    (!filterExpense || r.expenseType === filterExpense)
  );
  const totalCost = filtered.reduce((sum, r) => sum + (r.totalPrice || 0), 0);

  return (
    <div className="ledger-view">
      <div className="ledger-sidebar no-print">
        <h3>{t('finance.addPettyExpense')}</h3>
        <form onSubmit={handleSubmit} className="ledger-form">
          <label>{t('common.date')}</label><input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <label>{t('finance.expenseType')}</label>
          <select value={expenseType} onChange={e => setExpenseType(e.target.value)}>
             {config.expenseTypes.map(e => <option key={e}>{e}</option>)}
          </select>
          <label>{t('finance.amountIqd')}</label><input type="number" step="any" value={price} onChange={e => setPrice(e.target.value)} required />
          <label>{t('common.notes')}</label><input type="text" value={notes} onChange={e => setNotes(e.target.value)} />
          <button type="submit" className="apple-btn primary">{t('finance.saveExpense')}</button>
        </form>
      </div>
      <div className="ledger-main">
        <div className="ledger-filters no-print">
          <div className="filter-group"><label>{t('finance.expenseType')}</label>
            <select value={filterExpense} onChange={e => setFilterExpense(e.target.value)}>
              <option value="">{t('finance.all')}</option>
              {config.expenseTypes.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="filter-group"><label>{t('finance.dateFrom')}</label><input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} /></div>
          <div className="filter-group"><label>{t('finance.dateTo')}</label><input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} /></div>
          <div className="filter-group" style={{alignItems: 'flex-end'}}><button className="apple-btn secondary" onClick={() => window.print()}>🖨️ {t('common.print')}</button></div>
        </div>
        <div className="ledger-table-wrapper">
          <table className="ledger-table">
            <thead><tr><th>{t('common.date')}</th><th>{t('common.type')}</th><th>{t('common.notes')}</th><th>{t('finance.thAmount')}</th><th className="no-print">{t('finance.thAction')}</th></tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td><td>{r.expenseType}</td><td>{r.notes}</td>
                  <td className="cost-cell">{money(r.totalPrice)}</td>
                  <td className="no-print"><button onClick={() => onDelete(r.id)} className="apple-btn destructive" style={{padding:'4px 8px', fontSize:'0.75rem'}}>{t('common.delete')}</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan="3">{t('finance.periodTotal')}</td><td className="cost-cell total">{money(totalCost)}</td><td className="no-print"></td></tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

const PayrollLedger = ({ records, config, onAdd, onDelete }) => {
  const { t, lang } = useI18n();
  const money = (val) => formatCurrency(val, lang);

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [employee, setEmployee] = useState('');
  const [salary, setSalary] = useState('');
  const [advancePayment, setAdvancePayment] = useState('');
  const [status, setStatus] = useState(config.statuses[0] || '');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const sal = parseFloat(salary) || 0;
    const adv = parseFloat(advancePayment) || 0;
    // 'مستقطع' is a stored data value from the (user-editable) statuses list —
    // it must stay literal so existing saved records keep computing correctly.
    const net = status === 'مستقطع' ? sal - adv : sal;

    onAdd({ date, employee, salary: sal, advancePayment: adv, status, totalPrice: net });
    setEmployee(''); setSalary(''); setAdvancePayment('');
  };

  const filtered = records.filter(r =>
    (!filterFrom || r.date >= filterFrom) &&
    (!filterTo || r.date <= filterTo) &&
    (!filterEmployee || r.employee === filterEmployee)
  );
  const totalCost = filtered.reduce((sum, r) => sum + (r.totalPrice || 0), 0);

  return (
    <div className="ledger-view">
      <div className="ledger-sidebar no-print">
        <h3>{t('finance.paySalary')}</h3>
        <form onSubmit={handleSubmit} className="ledger-form">
          <label>{t('common.date')}</label><input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <label>{t('finance.employeeName')}</label>
          <input type="text" value={employee} onChange={e => setEmployee(e.target.value)} required list="employees-list-payroll"/>
          <datalist id="employees-list-payroll">{config.employees.map(e => <option key={e} value={e} />)}</datalist>
          <label>{t('finance.baseSalaryIqd')}</label><input type="number" step="any" value={salary} onChange={e => setSalary(e.target.value)} required />
          <div className="split-row">
            <div><label>{t('finance.advanceAmount')}</label><input type="number" step="any" value={advancePayment} onChange={e => setAdvancePayment(e.target.value)} /></div>
            <div>
              <label>{t('common.status')}</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>{config.statuses.map(s => <option key={s}>{s}</option>)}</select>
            </div>
          </div>
          <button type="submit" className="apple-btn primary">{t('finance.savePayment')}</button>
        </form>
      </div>
      <div className="ledger-main">
        <div className="ledger-filters no-print">
          <div className="filter-group"><label>{t('finance.filterEmployee')}</label>
            <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
              <option value="">{t('finance.all')}</option>
              {config.employees.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="filter-group"><label>{t('finance.dateFrom')}</label><input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} /></div>
          <div className="filter-group"><label>{t('finance.dateTo')}</label><input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} /></div>
          <div className="filter-group" style={{alignItems: 'flex-end'}}><button className="apple-btn secondary" onClick={() => window.print()}>🖨️ {t('common.print')}</button></div>
        </div>
        <div className="ledger-table-wrapper">
          <table className="ledger-table">
            <thead><tr><th>{t('common.date')}</th><th>{t('finance.filterEmployee')}</th><th>{t('finance.thBaseSalary')}</th><th>{t('finance.thAdvanceStatus')}</th><th>{t('finance.thNetPaid')}</th><th className="no-print">{t('finance.thAction')}</th></tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td><td>{r.employee}</td>
                  <td>{money(r.salary)}</td>
                  <td>{money(r.advancePayment)} ({r.status})</td>
                  <td className="cost-cell">{money(r.totalPrice)}</td>
                  <td className="no-print"><button onClick={() => onDelete(r.id)} className="apple-btn destructive" style={{padding:'4px 8px', fontSize:'0.75rem'}}>{t('common.delete')}</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan="4">{t('finance.periodTotal')}</td><td className="cost-cell total">{money(totalCost)}</td><td className="no-print"></td></tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------------------
// Settings (Database) Tab
// -------------------------------------------------------------------------

const SettingsTab = ({ config, updateConfig }) => {
  const { t } = useI18n();
  return (
    <div className="ledger-main" style={{padding: '40px', maxWidth: '900px', margin: '0 auto'}}>
      <h3 style={{borderBottom: '2px solid var(--border-soft)', paddingBottom: '16px'}}>{t('finance.settingsTitle')}</h3>
      <p style={{color: 'var(--text-secondary)', marginBottom: '32px'}}>{t('finance.settingsDesc')}</p>

      <div className="form-grid">
        <ConfigListEditor title={t('finance.cfgMachines')} items={config.machines} onSave={(list) => updateConfig('machines', list)} />
        <ConfigListEditor title={t('finance.cfgEmployees')} items={config.employees} onSave={(list) => updateConfig('employees', list)} />
        <ConfigListEditor title={t('finance.cfgMaterials')} items={config.materials} onSave={(list) => updateConfig('materials', list)} />
        <ConfigListEditor title={t('finance.cfgExpenseTypes')} items={config.expenseTypes} onSave={(list) => updateConfig('expenseTypes', list)} />
        <ConfigListEditor title={t('finance.cfgMachineSizes')} items={config.machineSizes} onSave={(list) => updateConfig('machineSizes', list)} />
        <ConfigListEditor title={t('finance.cfgStatuses')} items={config.statuses} onSave={(list) => updateConfig('statuses', list)} />
      </div>
    </div>
  );
};

const ConfigListEditor = ({ title, items, onSave }) => {
  const { t } = useI18n();
  const [val, setVal] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if(val && !items.includes(val)) {
      onSave([...items, val]);
      setVal('');
    }
  };

  const handleRemove = (item) => {
    onSave(items.filter(i => i !== item));
  };

  return (
    <div className="config-editor">
      <h4>{title}</h4>
      <ul className="config-list">
        {items.map(item => (
          <li key={item}>
            {item}
            <button onClick={() => handleRemove(item)} className="config-del-btn">✕</button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd} className="config-add-form">
        <input type="text" value={val} onChange={e => setVal(e.target.value)} placeholder={t('finance.addNewPlaceholder')} />
        <button type="submit" className="apple-btn secondary">+</button>
      </form>
    </div>
  );
};

export default FinanceManager;

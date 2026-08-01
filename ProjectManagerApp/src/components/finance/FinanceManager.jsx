import { useState, useEffect } from 'react';
import './FinanceManager.css';

const FINANCE_STORAGE_KEY = 'project-manager-finance-data';
const FINANCE_CONFIG_KEY = 'project-manager-finance-config';

const DEFAULT_CONFIG = {
  machines: ['بلدوزر', 'شفل', 'حفارة', 'لوري قلاب', 'حادلة', 'كريدر'],
  machineSizes: ['كبير', 'وسط', 'صغير'],
  employees: ['سائق احمد', 'سائق عمر', 'سائق عباس', 'مهندس علي', 'مهندس حسين'],
  materials: ['رمل', 'حصو', 'سمنت', 'حديد', 'كاز/وقود', 'طابوق'],
  expenseTypes: ['اطعام', 'بنزين', 'مواصلات', 'نثريات', 'صيانة'],
  statuses: ['مستقطع', 'غير مستقطع']
};

const FinanceManager = () => {
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
    if (window.confirm('هل أنت متأكد من حذف هذا السجل؟')) {
      setData(prev => ({ ...prev, [category]: prev[category].filter(r => r.id !== id) }));
    }
  };

  const updateConfig = (key, list) => {
    setConfig(prev => ({ ...prev, [key]: list }));
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-US').format(val || 0);

  const calculateTotal = (records) => records.reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0);

  return (
    <div className="finance-container" dir="rtl">
      <div className="finance-header no-print">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h2 style={{margin: 0}}>نظام الحسابات والتكاليف</h2>
          <button className="apple-btn secondary" onClick={() => setActiveTab('settings')}>⚙️ إعدادات النظام</button>
        </div>
        
        {/* Global Summary Cards */}
        <div className="finance-summary-cards">
          <div className="finance-card total">
            <span className="card-label">إجمالي التكاليف (المشروع)</span>
            <span className="card-value">{formatCurrency(calculateTotal(data.machinery) + calculateTotal(data.materials) + calculateTotal(data.pettyCash) + calculateTotal(data.payroll))} د.ع</span>
          </div>
          <div className="finance-card">
            <span className="card-label">الآليات (شامل الوقود)</span>
            <span className="card-value">{formatCurrency(calculateTotal(data.machinery))}</span>
          </div>
          <div className="finance-card">
            <span className="card-label">المواد الإنشائية</span>
            <span className="card-value">{formatCurrency(calculateTotal(data.materials))}</span>
          </div>
          <div className="finance-card">
            <span className="card-label">المصاريف اليومية</span>
            <span className="card-value">{formatCurrency(calculateTotal(data.pettyCash))}</span>
          </div>
          <div className="finance-card">
            <span className="card-label">الرواتب</span>
            <span className="card-value">{formatCurrency(calculateTotal(data.payroll))}</span>
          </div>
        </div>

        <div className="finance-tabs">
          <button className={`finance-tab ${activeTab === 'machinery' ? 'active' : ''}`} onClick={() => setActiveTab('machinery')}>تكاليف الآليات</button>
          <button className={`finance-tab ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}>التكاليف الإنشائية</button>
          <button className={`finance-tab ${activeTab === 'pettyCash' ? 'active' : ''}`} onClick={() => setActiveTab('pettyCash')}>التكاليف اليومية (نثريات)</button>
          <button className={`finance-tab ${activeTab === 'payroll' ? 'active' : ''}`} onClick={() => setActiveTab('payroll')}>تكاليف الرواتب</button>
        </div>
      </div>

      <div className="finance-content">
        {activeTab === 'machinery' && <MachineryLedger records={data.machinery} config={config} onAdd={(r) => addRecord('machinery', r)} onDelete={(id) => deleteRecord('machinery', id)} formatCurrency={formatCurrency} />}
        {activeTab === 'materials' && <MaterialsLedger records={data.materials} config={config} onAdd={(r) => addRecord('materials', r)} onDelete={(id) => deleteRecord('materials', id)} formatCurrency={formatCurrency} />}
        {activeTab === 'pettyCash' && <PettyCashLedger records={data.pettyCash} config={config} onAdd={(r) => addRecord('pettyCash', r)} onDelete={(id) => deleteRecord('pettyCash', id)} formatCurrency={formatCurrency} />}
        {activeTab === 'payroll' && <PayrollLedger records={data.payroll} config={config} onAdd={(r) => addRecord('payroll', r)} onDelete={(id) => deleteRecord('payroll', id)} formatCurrency={formatCurrency} />}
        {activeTab === 'settings' && <SettingsTab config={config} updateConfig={updateConfig} />}
      </div>
    </div>
  );
};

// -------------------------------------------------------------------------
// Sub-Ledger Components
// -------------------------------------------------------------------------

const MachineryLedger = ({ records, config, onAdd, onDelete, formatCurrency }) => {
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
        <h3>إضافة سجل آلية شامل</h3>
        <form onSubmit={handleSubmit} className="ledger-form">
          
          <div className="form-section">
            <h4>معلومات الآلية</h4>
            <div className="split-row">
              <div><label>التاريخ</label><input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
              <div><label>بادج (Badge)</label><input type="text" value={badge} onChange={e => setBadge(e.target.value)} /></div>
            </div>
            <label>اسم/رقم الآلية (مثال: D56EX/البصرة)</label><input type="text" value={machineName} onChange={e => setMachineName(e.target.value)} required list="machines-list"/>
            <div className="split-row">
              <div>
                <label>نوع الآلية</label>
                <select value={machineType} onChange={e => setMachineType(e.target.value)}>{config.machines.map(m => <option key={m}>{m}</option>)}</select>
              </div>
              <div>
                <label>حجم الآلية</label>
                <select value={machineSize} onChange={e => setMachineSize(e.target.value)}>{config.machineSizes.map(s => <option key={s}>{s}</option>)}</select>
              </div>
            </div>
            <div className="split-row">
              <div><label>ساعات اشتغال الآلية</label><input type="number" step="any" value={machineHours} onChange={e => setMachineHours(e.target.value)} required /></div>
              <div><label>أجرة الساعة (للآلية)</label><input type="number" step="any" value={machineRate} onChange={e => setMachineRate(e.target.value)} required /></div>
            </div>
          </div>

          <div className="form-section">
            <h4>معلومات السائق</h4>
            <label>اسم السائق</label>
            <input type="text" value={operator} onChange={e => setOperator(e.target.value)} list="employees-list" required/>
            <div className="split-row">
              <div><label>ساعات اشتغال السائق</label><input type="number" step="any" value={driverHours} onChange={e => setDriverHours(e.target.value)} /></div>
              <div><label>أجرة الساعة (للسائق)</label><input type="number" step="any" value={driverRate} onChange={e => setDriverRate(e.target.value)} /></div>
            </div>
          </div>

          <div className="form-section">
            <h4>صرفيات الوقود</h4>
            <div className="split-row">
              <div><label>عدد اللترات</label><input type="number" step="any" value={fuelLiters} onChange={e => setFuelLiters(e.target.value)} /></div>
              <div><label>سعر اللتر</label><input type="number" step="any" value={fuelPrice} onChange={e => setFuelPrice(e.target.value)} /></div>
            </div>
          </div>

          <button type="submit" className="apple-btn primary">حفظ السجل الشامل</button>
        </form>
      </div>

      <div className="ledger-main">
        <div className="ledger-filters no-print">
          <div className="filter-group"><label>نوع الآلية</label>
            <select value={filterMachineType} onChange={e => setFilterMachineType(e.target.value)}>
              <option value="">الكل</option>
              {config.machines.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="filter-group"><label>اسم السائق</label>
            <select value={filterOperator} onChange={e => setFilterOperator(e.target.value)}>
              <option value="">الكل</option>
              {config.employees.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="filter-group"><label>من تاريخ</label><input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} /></div>
          <div className="filter-group"><label>إلى تاريخ</label><input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} /></div>
          <div className="filter-group" style={{alignItems: 'flex-end'}}><button className="apple-btn secondary" onClick={() => window.print()}>🖨️ طباعة</button></div>
        </div>
        <div className="ledger-table-wrapper" style={{overflowX: 'auto'}}>
          <table className="ledger-table" style={{minWidth: '1200px'}}>
            <thead>
              <tr>
                <th>التاريخ</th><th>الآلية</th><th>السائق</th>
                <th>وارد الآلية</th><th>وارد السائق</th>
                <th>تكلفة الوقود</th><th>السعر الكلي</th><th className="no-print">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td><strong>{r.machineName}</strong> ({r.machineType})<br/><small>{r.machineHours}h @ {formatCurrency(r.machineRate)}</small></td>
                  <td><strong>{r.operator}</strong><br/><small>{r.driverHours}h @ {formatCurrency(r.driverRate)}</small></td>
                  <td>{formatCurrency(r.machineTotal)}</td>
                  <td>{formatCurrency(r.driverTotal)}</td>
                  <td>{formatCurrency(r.fuelTotal)} <br/><small>({r.fuelLiters}L)</small></td>
                  <td className="cost-cell">{formatCurrency(r.totalPrice)}</td>
                  <td className="no-print"><button onClick={() => onDelete(r.id)} className="apple-btn destructive" style={{padding:'4px 8px', fontSize:'0.75rem'}}>حذف</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan="6">الإجمالي للفترة:</td><td className="cost-cell total">{formatCurrency(totalCost)} د.ع</td><td className="no-print"></td></tr></tfoot>
          </table>
        </div>
      </div>
      
      {/* DataLists for Autocomplete */}
      <datalist id="machines-list">{config.machines.map(m => <option key={m} value={m} />)}</datalist>
      <datalist id="employees-list">{config.employees.map(e => <option key={e} value={e} />)}</datalist>
    </div>
  );
};

const MaterialsLedger = ({ records, config, onAdd, onDelete, formatCurrency }) => {
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
        <h3>إضافة سجل مواد</h3>
        <form onSubmit={handleSubmit} className="ledger-form">
          <label>التاريخ</label><input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <label>رقم الوصل</label><input type="text" value={receipt} onChange={e => setReceipt(e.target.value)} />
          <label>نوع المادة</label>
          <select value={materialType} onChange={e => setMaterialType(e.target.value)}>
            {config.materials.map(m => <option key={m}>{m}</option>)}
          </select>
          <label>التفاصيل (مثال: رمل S1)</label><input type="text" value={details} onChange={e => setDetails(e.target.value)} required />
          <div className="split-row">
            <div><label>الكمية (مع الوحدة)</label><input type="text" value={quantity} onChange={e => setQuantity(e.target.value)} required placeholder="150 م3"/></div>
            <div><label>السعر</label><input type="number" step="any" value={totalPrice} onChange={e => setTotalPrice(e.target.value)} required /></div>
          </div>
          <button type="submit" className="apple-btn primary">حفظ السجل</button>
        </form>
      </div>
      <div className="ledger-main">
        <div className="ledger-filters no-print">
          <div className="filter-group"><label>نوع المادة</label>
            <select value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)}>
              <option value="">الكل</option>
              {config.materials.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="filter-group"><label>من تاريخ</label><input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} /></div>
          <div className="filter-group"><label>إلى تاريخ</label><input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} /></div>
          <div className="filter-group" style={{alignItems: 'flex-end'}}><button className="apple-btn secondary" onClick={() => window.print()}>🖨️ طباعة</button></div>
        </div>
        <div className="ledger-table-wrapper">
          <table className="ledger-table">
            <thead><tr><th>التاريخ</th><th>رقم الوصل</th><th>المادة</th><th>التفاصيل</th><th>الكمية</th><th>السعر</th><th className="no-print">إجراء</th></tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td><td>{r.receipt}</td><td>{r.materialType}</td><td>{r.details}</td><td>{r.quantity}</td>
                  <td className="cost-cell">{formatCurrency(r.totalPrice)}</td>
                  <td className="no-print"><button onClick={() => onDelete(r.id)} className="apple-btn destructive" style={{padding:'4px 8px', fontSize:'0.75rem'}}>حذف</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan="5">الإجمالي للفترة:</td><td className="cost-cell total">{formatCurrency(totalCost)} د.ع</td><td className="no-print"></td></tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

const PettyCashLedger = ({ records, config, onAdd, onDelete, formatCurrency }) => {
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
        <h3>إضافة مصروف يومي</h3>
        <form onSubmit={handleSubmit} className="ledger-form">
          <label>التاريخ</label><input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <label>نوع المصروف</label>
          <select value={expenseType} onChange={e => setExpenseType(e.target.value)}>
             {config.expenseTypes.map(e => <option key={e}>{e}</option>)}
          </select>
          <label>المبلغ (د.ع)</label><input type="number" step="any" value={price} onChange={e => setPrice(e.target.value)} required />
          <label>ملاحظات</label><input type="text" value={notes} onChange={e => setNotes(e.target.value)} />
          <button type="submit" className="apple-btn primary">حفظ المصروف</button>
        </form>
      </div>
      <div className="ledger-main">
        <div className="ledger-filters no-print">
          <div className="filter-group"><label>نوع المصروف</label>
            <select value={filterExpense} onChange={e => setFilterExpense(e.target.value)}>
              <option value="">الكل</option>
              {config.expenseTypes.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="filter-group"><label>من تاريخ</label><input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} /></div>
          <div className="filter-group"><label>إلى تاريخ</label><input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} /></div>
          <div className="filter-group" style={{alignItems: 'flex-end'}}><button className="apple-btn secondary" onClick={() => window.print()}>🖨️ طباعة</button></div>
        </div>
        <div className="ledger-table-wrapper">
          <table className="ledger-table">
            <thead><tr><th>التاريخ</th><th>النوع</th><th>الملاحظات</th><th>المبلغ</th><th className="no-print">إجراء</th></tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td><td>{r.expenseType}</td><td>{r.notes}</td>
                  <td className="cost-cell">{formatCurrency(r.totalPrice)}</td>
                  <td className="no-print"><button onClick={() => onDelete(r.id)} className="apple-btn destructive" style={{padding:'4px 8px', fontSize:'0.75rem'}}>حذف</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan="3">الإجمالي للفترة:</td><td className="cost-cell total">{formatCurrency(totalCost)} د.ع</td><td className="no-print"></td></tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

const PayrollLedger = ({ records, config, onAdd, onDelete, formatCurrency }) => {
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
        <h3>تسديد راتب</h3>
        <form onSubmit={handleSubmit} className="ledger-form">
          <label>التاريخ</label><input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <label>اسم الموظف / السائق</label>
          <input type="text" value={employee} onChange={e => setEmployee(e.target.value)} required list="employees-list-payroll"/>
          <datalist id="employees-list-payroll">{config.employees.map(e => <option key={e} value={e} />)}</datalist>
          <label>الراتب الأساسي (د.ع)</label><input type="number" step="any" value={salary} onChange={e => setSalary(e.target.value)} required />
          <div className="split-row">
            <div><label>مبلغ السلفة</label><input type="number" step="any" value={advancePayment} onChange={e => setAdvancePayment(e.target.value)} /></div>
            <div>
              <label>الحالة</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>{config.statuses.map(s => <option key={s}>{s}</option>)}</select>
            </div>
          </div>
          <button type="submit" className="apple-btn primary">حفظ الدفعة</button>
        </form>
      </div>
      <div className="ledger-main">
        <div className="ledger-filters no-print">
          <div className="filter-group"><label>اسم الموظف</label>
            <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
              <option value="">الكل</option>
              {config.employees.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="filter-group"><label>من تاريخ</label><input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} /></div>
          <div className="filter-group"><label>إلى تاريخ</label><input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} /></div>
          <div className="filter-group" style={{alignItems: 'flex-end'}}><button className="apple-btn secondary" onClick={() => window.print()}>🖨️ طباعة</button></div>
        </div>
        <div className="ledger-table-wrapper">
          <table className="ledger-table">
            <thead><tr><th>التاريخ</th><th>اسم الموظف</th><th>الراتب الأساسي</th><th>السلفة (الحالة)</th><th>المبلغ المدفوع (الصافي)</th><th className="no-print">إجراء</th></tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td><td>{r.employee}</td>
                  <td>{formatCurrency(r.salary)}</td>
                  <td>{formatCurrency(r.advancePayment)} ({r.status})</td>
                  <td className="cost-cell">{formatCurrency(r.totalPrice)}</td>
                  <td className="no-print"><button onClick={() => onDelete(r.id)} className="apple-btn destructive" style={{padding:'4px 8px', fontSize:'0.75rem'}}>حذف</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan="4">الإجمالي للفترة:</td><td className="cost-cell total">{formatCurrency(totalCost)} د.ع</td><td className="no-print"></td></tr></tfoot>
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
  return (
    <div className="ledger-main" style={{padding: '40px', maxWidth: '900px', margin: '0 auto'}}>
      <h3 style={{borderBottom: '2px solid var(--border-soft)', paddingBottom: '16px'}}>قاعدة البيانات والقوائم المنسدلة</h3>
      <p style={{color: 'var(--text-secondary)', marginBottom: '32px'}}>يمكنك تعديل أسماء الموظفين والآليات وأنواع المصاريف التي تظهر في القوائم المنسدلة في كافة شاشات الإدخال.</p>
      
      <div className="form-grid">
        <ConfigListEditor title="أنواع الآليات" items={config.machines} onSave={(list) => updateConfig('machines', list)} />
        <ConfigListEditor title="أسماء الموظفين والعمال" items={config.employees} onSave={(list) => updateConfig('employees', list)} />
        <ConfigListEditor title="أنواع المواد الإنشائية" items={config.materials} onSave={(list) => updateConfig('materials', list)} />
        <ConfigListEditor title="أنواع المصاريف اليومية" items={config.expenseTypes} onSave={(list) => updateConfig('expenseTypes', list)} />
        <ConfigListEditor title="أحجام الآليات" items={config.machineSizes} onSave={(list) => updateConfig('machineSizes', list)} />
        <ConfigListEditor title="حالات السلفة" items={config.statuses} onSave={(list) => updateConfig('statuses', list)} />
      </div>
    </div>
  );
};

const ConfigListEditor = ({ title, items, onSave }) => {
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
        <input type="text" value={val} onChange={e => setVal(e.target.value)} placeholder="إضافة جديد..." />
        <button type="submit" className="apple-btn secondary">+</button>
      </form>
    </div>
  );
};

export default FinanceManager;

// Dev-only page that renders every shared component with real project
// figures, for reviewing the design in both languages and themes.
// Open http://localhost:5173/#/dev/ui — never shipped to production.
// Section headings are developer-facing English on purpose.

import {
  BookOpen,
  CalendarRange,
  ClipboardList,
  Ellipsis,
  FileText,
  FolderOpen,
  House,
  Inbox,
  Pencil,
  SlidersHorizontal,
  Trash2,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import {
  AppShell,
  BottomNav,
  Button,
  Card,
  CommandPalette,
  ConfirmDialog,
  DateChips,
  Dialog,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  Input,
  ListRow,
  Menu,
  NumberInput,
  ProgressBar,
  SearchButton,
  Segmented,
  Select,
  Sidebar,
  StatCard,
  StatusBadge,
  Tab,
  TabList,
  TabPanel,
  Table,
  Tabs,
  Textarea,
  TaskPicker,
  TopBar,
  WhoPicker,
  useHotkey,
  useToast,
} from '../ui/index.js';
import { formatDateStr } from '../utils/OrderEngine.js';
import s from './UiReview.module.css';

const TASKS = [
  { id: '1', wbs: '1', name: 'اولا / الحفريات', isGroup: true },
  { id: '1.1.1', wbs: '1.1.1', name: 'حفر القنوات الفرعية', unit: 'م3', quantity: 9413.4, actual: 9413 },
  { id: '2', wbs: '2', name: 'ثانيا/الاملاءات الترابية', isGroup: true },
  { id: '2.1.1', wbs: '2.1.1', name: 'دفن القناة الرئيسية MC7', unit: 'م3', quantity: 16000, actual: 0 },
  { id: '2.1.2', wbs: '2.1.2', name: 'دفن القنوات الفرعية', unit: 'م3', quantity: 142535.6, actual: 135000 },
  { id: '2.1.3', wbs: '2.1.3', name: 'دفن القنوات المغذية', unit: 'م3', quantity: 95590.6, actual: 0 },
  { id: '3.1.1', wbs: '3.1.1', name: 'تبطين القناة الرئيسية MC7 بسمك 10 سم', unit: 'م2', quantity: 3400, actual: 0 },
  { id: '3.1.2', wbs: '3.1.2', name: 'تبطين القنوات الفرعية بسمك 8 سم', unit: 'م2', quantity: 76087.4, actual: 0 },
  { id: '3.1.3', wbs: '3.1.3', name: 'تبطين القنوات المغذية بسمك 6 سم', unit: 'م2', quantity: 59514, actual: 0 },
];
const ORDERS = [{ taskId: '2.1.2', recordedAt: '2026-10-25T09:40:00Z' }];
const REGISTRIES = {
  contractors: [
    { id: 'c1', name: '[مقاول 1]' },
    { id: 'c2', name: '[مقاول 2]' },
  ],
  teams: [{ id: 't1', name: '[فريق التبطين]', memberWorkerIds: ['w1', 'w2'], defaultSize: 0 }],
  workers: [
    { id: 'w1', name: '[عامل 1]', trade: 'بناء' },
    { id: 'w2', name: '[عامل 2]', trade: 'حداد' },
    { id: 'w3', name: '[عامل 3]', trade: '' },
  ],
};

const fmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 1 });

const readTheme = () => document.documentElement.getAttribute('data-theme') || 'system';
const applyTheme = (theme) => {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
};

export default function UiReview() {
  const { t, lang, setLang } = useI18n();
  const toast = useToast();
  const [theme, setTheme] = useState(readTheme);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [date, setDate] = useState(formatDateStr(new Date()));
  const [zoom, setZoom] = useState('month');
  const [taskId, setTaskId] = useState('2.1.2');
  const [qty, setQty] = useState('');
  const [orderWho, setOrderWho] = useState({ kind: 'contractor', contractorId: 'c1' });
  const [planWho, setPlanWho] = useState({ kind: 'count', count: 4 });

  useHotkey('k', () => setPaletteOpen(true));

  const changeTheme = (next) => {
    applyTheme(next);
    setTheme(next);
  };

  const nav = [
    { key: 'home', label: t('ui.navHome'), icon: House, href: '#/dev/ui' },
    { key: 'record', label: t('ui.navRecord'), icon: ClipboardList, href: '#/dev/ui', badge: 2 },
    { key: 'schedule', label: t('ui.navSchedule'), icon: CalendarRange, href: '#/dev/ui' },
    { key: 'reports', label: t('ui.navReports'), icon: FileText, href: '#/dev/ui' },
    { key: 'finance', label: t('ui.navFinance'), icon: Wallet, href: '#/dev/ui' },
    { key: 'library', label: t('ui.navLibrary'), icon: BookOpen, href: '#/dev/ui' },
    { key: 'people', label: t('ui.navPeople'), icon: Users, href: '#/dev/ui' },
  ];
  const selectedTask = TASKS.find((x) => x.id === taskId);

  return (
    <AppShell
      sidebar={
        <Sidebar
          project={{ initial: 'و', name: 'استصلاح أراضي واسط', subtitle: 'عقد 5 / 2023 · أيسر MC7' }}
          primaryAction={{ label: t('ui.recordOrder'), href: '#/dev/ui' }}
          items={nav}
          footerItems={[{ key: 'settings', label: t('ui.navSettings'), icon: SlidersHorizontal, href: '#/dev/ui' }]}
          activeKey="home"
          user={{ initial: 'م', name: '[اسم المستخدم]', role: 'مهندس موقع' }}
        />
      }
      bottomNav={
        <BottomNav
          activeKey="home"
          primary={{ label: t('ui.recordOrder'), href: '#/dev/ui' }}
          items={[
            nav[0],
            { ...nav[2], label: t('ui.navScheduleShort') },
            nav[3],
            { key: 'more', label: t('ui.more'), icon: Ellipsis, href: '#/dev/ui' },
          ]}
        />
      }
    >
      <div className={s.controls}>
        <div className={s.controlGroup}>
          <span>{t('ui.language')}</span>
          <Segmented
            label={t('ui.language')}
            value={lang}
            onChange={setLang}
            options={[
              { value: 'ar', label: 'العربية' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
        <div className={s.controlGroup}>
          <span>{t('ui.theme')}</span>
          <Segmented
            label={t('ui.theme')}
            value={theme}
            onChange={changeTheme}
            options={[
              { value: 'light', label: t('ui.themeLight') },
              { value: 'dark', label: t('ui.themeDark') },
              { value: 'system', label: t('ui.themeSystem') },
            ]}
          />
        </div>
        <span className={s.devTag}>DEV · /#/dev/ui</span>
      </div>

      <TopBar
        title="UI review"
        subtitle="Every shared component, with real project figures"
        actions={
          <>
            <SearchButton onClick={() => setPaletteOpen(true)} />
            <StatusBadge tone="success" icon="dot" size="md">
              {t('common.statusExecuting')}
            </StatusBadge>
            <Menu
              trigger={<IconButton icon={Ellipsis} label={t('ui.more')} variant="secondary" />}
              items={[
                { label: t('common.edit'), icon: Pencil, onSelect: () => {} },
                'separator',
                { label: t('common.delete'), icon: Trash2, tone: 'danger', onSelect: () => setConfirmOpen(true) },
              ]}
            />
          </>
        }
      />

      <section className={s.grid4} aria-label="Stat cards">
        <StatCard label={t('common.progress')} value="21.1%" footer="Planned 99.0%">
          <ProgressBar value={21.1} marker={99} />
        </StatCard>
        <StatCard label="SPI" value="0.21" tone="danger">
          <StatusBadge tone="danger">Behind</StatusBadge>
        </StatCard>
        <StatCard label="EV" value="822.7" unit="M IQD" footer="of 3.89 B (BAC)" />
        <StatCard label="CPI" value="1.00" tone="success">
          <StatusBadge tone="success">On budget</StatusBadge>
        </StatCard>
      </section>

      <div className={s.grid2}>
        <Card title="Buttons" subtitle="primary · secondary · outline · ghost · danger">
          <div className={s.row}>
            <Button variant="primary" icon={Zap}>
              {t('ui.recordOrder')}
            </Button>
            <Button>{t('common.save')}</Button>
            <Button variant="outline">{t('common.approve')}</Button>
            <Button variant="ghost">{t('ui.cancel')}</Button>
            <Button variant="danger" icon={Trash2}>
              {t('common.delete')}
            </Button>
          </div>
          <div className={s.row}>
            <Button size="sm">Small</Button>
            <Button size="lg" variant="primary">
              Large
            </Button>
            <Button disabled>Disabled</Button>
            <IconButton icon={Pencil} label={t('common.edit')} variant="secondary" />
            <IconButton icon={FolderOpen} label="Files" />
          </div>
        </Card>

        <Card title="Status and progress">
          <div className={s.row}>
            <StatusBadge tone="success">{t('common.approved')}</StatusBadge>
            <StatusBadge tone="warning">{t('common.pending')}</StatusBadge>
            <StatusBadge tone="danger">Late</StatusBadge>
            <StatusBadge tone="accent">Selected</StatusBadge>
            <StatusBadge>{t('common.statusDraft')}</StatusBadge>
            <StatusBadge tone="danger" icon="dot">
              Critical
            </StatusBadge>
          </div>
          <ProgressBar value={100} label="Excavation" />
          <ProgressBar value={53.7} label="Earth fill" />
          <ProgressBar value={0} label="Lining" />
          <ProgressBar value={94.7} tone="warning" size="lg" />
        </Card>
      </div>

      <Card title="Form controls" subtitle={t('orders.typeQuickWork')}>
        <div className={s.formGrid}>
          <Field label={t('ui.date')}>
            <DateChips value={date} onChange={setDate} />
          </Field>
          <Field
            label={t('orders.fTask')}
            hint={
              selectedTask && !selectedTask.isGroup
                ? `${fmt(selectedTask.actual)} / ${fmt(selectedTask.quantity)} ${selectedTask.unit}`
                : undefined
            }
          >
            <TaskPicker tasks={TASKS} orders={ORDERS} value={taskId} onChange={setTaskId} optional />
          </Field>
          <Field label={t('common.quantity')} error={qty !== '' && Number(qty) < 0 ? 'Must be 0 or more' : undefined}>
            <NumberInput unit={selectedTask?.unit || 'م3'} size="lg" placeholder="0" value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          <Field label={t('common.location')} optional hint={t('orders.phLocationCompletion')}>
            <Input placeholder="0+250" />
          </Field>
          <Field label={t('common.unit')}>
            <Select defaultValue="m3">
              <option value="m3">م3</option>
              <option value="m2">م2</option>
            </Select>
          </Field>
          <Field label={t('orders.fNote')} optional>
            <Textarea rows={2} />
          </Field>
        </div>
        <div className={s.formGrid}>
          <Field label="WhoPicker · orders">
            <WhoPicker value={orderWho} onChange={setOrderWho} registries={REGISTRIES} />
          </Field>
          <Field label="WhoPicker · planning">
            <WhoPicker value={planWho} onChange={setPlanWho} registries={REGISTRIES} kinds={['count', 'team', 'workers']} />
          </Field>
          <Field label="Segmented">
            <Segmented
              label="Zoom"
              value={zoom}
              onChange={setZoom}
              options={[
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
                { value: 'quarter', label: 'Quarter' },
              ]}
            />
          </Field>
        </div>
        <span className={s.mono}>{JSON.stringify({ date, taskId, orderWho, planWho })}</span>
      </Card>

      <Card title="Tabs, table, list">
        <Tabs defaultValue="table">
          <TabList label="Demo tabs">
            <Tab value="table">Table</Tab>
            <Tab value="list">List</Tab>
            <Tab value="empty" count={2}>
              {t('common.pending')}
            </Tab>
          </TabList>
          <TabPanel value="table">
            <Table label="BOQ" minWidth={560}>
              <thead>
                <tr>
                  <th>WBS</th>
                  <th>{t('common.name')}</th>
                  <th className="ui-num">{t('common.contractQty')}</th>
                  <th className="ui-num">{t('common.executed')}</th>
                </tr>
              </thead>
              <tbody>
                {TASKS.filter((x) => !x.isGroup).map((x) => (
                  <tr key={x.id}>
                    <td className="ui-ltr">{x.wbs}</td>
                    <td>{x.name}</td>
                    <td className="ui-num">
                      {fmt(x.quantity)} {x.unit}
                    </td>
                    <td className="ui-num">{fmt(x.actual)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TabPanel>
          <TabPanel value="list">
            <div className={s.stack}>
              <ListRow
                href="#/dev/ui"
                leading={<span className={s.dotDanger} />}
                title="2.1.3 دفن القنوات المغذية"
                subtitle="Critical · late · 0%"
              />
              <ListRow
                onClick={() => setDrawerOpen(true)}
                leading={<span className={s.dotWarning} />}
                title="2.1.2 دفن القنوات الفرعية"
                subtitle="94.7% · 7,535.6 م3 left"
                trailing={<StatusBadge tone="warning">{t('common.pending')}</StatusBadge>}
              />
              <ListRow
                leading={<span className={s.dotAccent} />}
                title={t('orders.typeQuickWork')}
                subtitle="[مقاول 1] · 09:40"
                trailing={<Button size="sm" variant="outline">{t('common.approve')}</Button>}
              />
            </div>
          </TabPanel>
          <TabPanel value="empty">
            <EmptyState
              icon={Inbox}
              title="Nothing waiting for approval"
              body="Formal orders (completion, concrete and soil tests) appear here until someone approves them."
              action={<Button variant="primary">{t('ui.recordOrder')}</Button>}
            />
          </TabPanel>
        </Tabs>
      </Card>

      <Card title="Overlays">
        <div className={s.row}>
          <Button onClick={() => setDialogOpen(true)}>Dialog</Button>
          <Button onClick={() => setConfirmOpen(true)}>Confirm (danger)</Button>
          <Button onClick={() => setDrawerOpen(true)}>Drawer / bottom sheet</Button>
          <Button onClick={() => toast({ title: 'Order saved', description: 'Quick work · 1,200 م3' })}>Toast</Button>
          <Button onClick={() => toast({ title: 'Could not save', tone: 'danger' })}>Error toast</Button>
          <Button onClick={() => setPaletteOpen(true)}>{t('ui.search')} (Ctrl K)</Button>
        </div>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Sign off the contract"
        description="Freezes contract quantities and prices. Later changes need a variation order."
        footer={
          <>
            <Button onClick={() => setDialogOpen(false)}>{t('ui.cancel')}</Button>
            <Button variant="primary" onClick={() => setDialogOpen(false)}>
              {t('ui.confirm')}
            </Button>
          </>
        }
      >
        <Field label={t('common.notes')} optional>
          <Textarea rows={3} />
        </Field>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this order?"
        message="Quick work · 2.1.2 دفن القنوات الفرعية · 1,200 م3. This can't be undone."
        confirmLabel={t('common.delete')}
        tone="danger"
        onConfirm={() => toast({ title: 'Order deleted' })}
      />

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="2.1.2 دفن القنوات الفرعية"
        description="WBS 2.1.2 · after 2.1.1 (FS +16)"
        footer={
          <Button variant="primary" block>
            {t('ui.recordOrder')}
          </Button>
        }
      >
        <div className={s.stack}>
          <ProgressBar value={94.7} size="lg" />
          <span>
            135,000 / 142,535.6 م3 · 6,000 د.ع · 855.2 M
          </span>
        </div>
      </Drawer>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        groups={[
          {
            heading: t('ui.allTasks'),
            items: TASKS.filter((x) => !x.isGroup).map((x) => ({
              id: x.id,
              label: `${x.wbs} ${x.name}`,
              hint: `${fmt(x.quantity)} ${x.unit}`,
              icon: CalendarRange,
              onSelect: () => setTaskId(x.id),
            })),
          },
          {
            heading: t('ui.navHome'),
            items: nav.map((n) => ({ id: `nav-${n.key}`, label: n.label, icon: n.icon, onSelect: () => {} })),
          },
        ]}
      />
    </AppShell>
  );
}

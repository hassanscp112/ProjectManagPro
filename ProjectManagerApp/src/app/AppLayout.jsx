import { CalendarRange } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import '../App.css';
import { useI18n } from '../i18n/useI18n.js';
import { useProject } from '../state/projectContext.js';
import { AppShell, BottomNav, CommandPalette, Sidebar, useHotkey } from '../ui/index.js';
import DeleteTaskDialog from './DeleteTaskDialog.jsx';
import { LegacyIdentityDialog } from './legacy/LegacyDialogs.jsx';
import { AREAS, AREA_TABS, MORE_AREA, SETTINGS_AREA, areaKeyForPath, hrefFor } from './navigation.js';
import { ShellContext } from './shellContext.js';

const initialsOf = (name) => {
  const clean = (name || '').trim();
  if (!clean) return '؟';
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
};

/**
 * The app frame for every route: sidebar (desktop) / bottom bar (phone),
 * Ctrl K search, and the app-wide dialogs. Pages render in <Outlet />.
 */
export default function AppLayout() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { identity, openIdentity, pendingApprovals, refreshStores, tasks } = useProject();
  const [searchOpen, setSearchOpen] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const activeKey = areaKeyForPath(pathname);
  const shell = useMemo(() => ({ openSearch: () => setSearchOpen(true), setImmersive }), []);

  // Same contract as the old tab switch: re-read the module stores on navigation.
  useEffect(() => {
    refreshStores();
  }, [pathname, refreshStores]);

  useHotkey('k', () => setSearchOpen(true));

  const navItems = AREAS.map((a) => ({
    key: a.key,
    label: t(a.labelKey),
    icon: a.icon,
    href: hrefFor(a.path),
    badge: a.key === 'record' ? pendingApprovals : 0,
  }));

  const searchGroups = useMemo(() => {
    const pages = [];
    [...AREAS, SETTINGS_AREA].forEach((a) => {
      const tabs = AREA_TABS[a.key];
      if (tabs) tabs.forEach((tab) => pages.push({ id: tab.to, label: `${t(a.labelKey)} · ${t(tab.labelKey)}`, icon: a.icon, path: tab.to }));
      else pages.push({ id: a.path, label: t(a.labelKey), icon: a.icon, path: a.path });
    });
    return [
      { heading: t('ui.goTo'), items: pages.map((p) => ({ ...p, onSelect: () => navigate(p.path) })) },
      {
        heading: t('ui.allTasks'),
        items: tasks.map((task) => ({
          id: `task-${task.id}`,
          label: `${task.wbs || ''} ${task.name || ''}`.trim(),
          hint: task.unit || undefined,
          icon: CalendarRange,
          onSelect: () => navigate(`/schedule/task/${encodeURIComponent(task.id)}`),
        })),
      },
    ];
  }, [t, tasks, navigate]);

  const hasUser = Boolean(identity?.name);

  return (
    <ShellContext.Provider value={shell}>
      <AppShell
        sidebar={
          <Sidebar
            project={{ initial: 'و', name: t('ui.projectName'), subtitle: t('ui.projectContract') }}
            primaryAction={{ label: t('ui.recordOrder'), href: hrefFor('/record') }}
            items={navItems}
            footerItems={[{ key: 'settings', label: t('ui.navSettings'), icon: SETTINGS_AREA.icon, href: hrefFor('/settings') }]}
            activeKey={activeKey}
            user={{
              initial: initialsOf(identity?.name),
              name: hasUser ? identity.name : t('ui.userUnset'),
              role: identity?.role || '',
              title: hasUser ? t('app.identity.changeUser') : t('app.identity.setUser'),
              onClick: openIdentity,
            }}
          />
        }
        bottomNav={
          !immersive && (
          <BottomNav
            activeKey={activeKey}
            primary={{ label: t('ui.recordOrder'), href: hrefFor('/record') }}
            items={[
              navItems[0],
              { ...navItems[2], label: t('ui.navScheduleShort') },
              navItems[3],
              { key: MORE_AREA.key, label: t(MORE_AREA.labelKey), icon: MORE_AREA.icon, href: hrefFor(MORE_AREA.path) },
            ]}
          />
          )
        }
      >
        <Outlet />
      </AppShell>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} groups={searchGroups} />
      <DeleteTaskDialog />
      <LegacyIdentityDialog />
    </ShellContext.Provider>
  );
}

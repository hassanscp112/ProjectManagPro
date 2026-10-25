import { Outlet, useLocation } from 'react-router';
import { useI18n } from '../../i18n/useI18n.js';
import { AppShell, BottomNav, Sidebar } from '../../ui/index.js';
import { PORTFOLIO_AREAS, areaKeyForPath, hrefFor } from '../navigation.js';
import { ShellContext } from '../shellContext.js';

// No search palette or immersive mode up here (no tasks to search).
const SHELL = { openSearch: null, setImmersive: () => {} };

/**
 * The frame of the projects level (above every project): the project list,
 * templates and rates. No project is open in this frame, so nothing here
 * reads the project store.
 */
export default function PortfolioLayout() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const activeKey = areaKeyForPath(pathname);
  const items = PORTFOLIO_AREAS.map((a) => ({ key: a.key, label: t(a.labelKey), icon: a.icon, href: hrefFor(a.path) }));
  const newProject = { label: t('projects.newProject'), href: hrefFor('/projects/new') };

  return (
    <ShellContext.Provider value={SHELL}>
      <AppShell
        sidebar={
          <Sidebar
            project={{ initial: t('projects.appInitial'), name: t('projects.appName'), subtitle: t('projects.appTagline') }}
            primaryAction={newProject}
            items={items}
            activeKey={activeKey}
          />
        }
        bottomNav={<BottomNav activeKey={activeKey} primary={newProject} items={items} />}
      >
        <Outlet />
      </AppShell>
    </ShellContext.Provider>
  );
}

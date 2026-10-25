import { Languages } from 'lucide-react';
import { NavLink } from 'react-router';
import { useI18n } from '../i18n/useI18n.js';
import { STATUS_KEYS } from '../state/projectModel.js';
import { useProject } from '../state/projectContext.js';
import { Button, Menu, SearchButton, StatusBadge, TopBar, cx } from '../ui/index.js';
import { AREAS, AREA_TABS, MORE_AREA, SETTINGS_AREA } from './navigation.js';
import { useShell } from './shellContext.js';
import s from './Page.module.css';

const STATUS_TONE = { draft: 'neutral', signed: 'accent', executing: 'success', completed: 'success' };

/** Search, project status and language — on every page header. */
function GlobalActions() {
  const { t, lang, setLang, languages } = useI18n();
  const { projectMeta } = useProject();
  const { openSearch } = useShell();
  const status = projectMeta?.status || 'draft';
  const current = languages.find((l) => l.code === lang) || languages[0];
  return (
    <>
      <SearchButton onClick={openSearch} />
      <StatusBadge tone={STATUS_TONE[status] || 'neutral'} icon="dot" size="md">
        {STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status}
      </StatusBadge>
      <Menu
        trigger={
          <Button size="sm" icon={Languages} className={s.langButton} title={t('ui.language')}>
            {current.label}
          </Button>
        }
        items={languages.map((l) => ({ label: l.label, onSelect: () => setLang(l.code) }))}
      />
    </>
  );
}

/** Sub-pages of an area as router tabs; counts[to] shows a small pill. */
function AreaTabs({ tabs, counts = {} }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t('ui.sectionNav')} className={s.tabs}>
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className={s.tab}>
          {t(tab.labelKey)}
          {counts[tab.to] ? <span className={s.count}>{counts[tab.to]}</span> : null}
        </NavLink>
      ))}
    </nav>
  );
}

const ALL_AREAS = [...AREAS, SETTINGS_AREA, MORE_AREA];

/**
 * Standard page frame: area title + project subtitle + global actions,
 * the area's sub-page tabs (if any), then the page content.
 * `fill` lets the content take the remaining window height (Gantt).
 * `tabCounts` puts a count on sub-page tabs ({ '/record/pending': 2 }).
 * `bare` drops header and tabs (full-screen phone flows draw their own).
 */
export function Page({ area, fill = false, tabCounts, bare = false, children }) {
  const { t } = useI18n();
  const def = ALL_AREAS.find((a) => a.key === area);
  const tabs = AREA_TABS[area];
  return (
    <div className={cx(s.page, fill && s.fill)}>
      {!bare && (
        <TopBar
          title={def ? t(def.labelKey) : ''}
          subtitle={`${t('ui.projectName')} · ${t('ui.projectContract')}`}
          actions={<GlobalActions />}
        />
      )}
      {tabs && !bare && <AreaTabs tabs={tabs} counts={tabCounts} />}
      <div className={s.content}>{children}</div>
    </div>
  );
}

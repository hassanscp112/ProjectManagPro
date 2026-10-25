import { Plus, Search } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { cx } from '../cx.js';
import s from './Shell.module.css';

/**
 * Page frame: sidebar (≥768px) + main column, bottom bar on phones.
 * Pass the rendered <Sidebar> and <BottomNav> in.
 */
export function AppShell({ sidebar, bottomNav, children, className }) {
  const { dir, t } = useI18n();
  // Not an in-page #anchor: the hash holds the route, so focus the main column directly.
  const skip = (e) => {
    e.preventDefault();
    document.getElementById('ui-main')?.focus();
  };
  return (
    <div dir={dir} className={cx('ui-root', s.shell, !bottomNav && s.noBottomNav, className)}>
      <a href="#ui-main" className="ui-skip-link" onClick={skip}>
        {t('ui.skipToContent')}
      </a>
      {sidebar}
      <main id="ui-main" tabIndex={-1} className={s.main}>
        {children}
      </main>
      {bottomNav}
    </div>
  );
}

/** Current user at the foot of the sidebar; a button when user.onClick is set. */
function SidebarUser({ user }) {
  const Tag = user.onClick ? 'button' : 'div';
  const extra = user.onClick ? { type: 'button', onClick: user.onClick, title: user.title } : {};
  return (
    <Tag {...extra} className={s.user}>
      <span className={s.avatar} aria-hidden="true">
        {user.initial}
      </span>
      <span className={s.userText}>
        <span className={s.userName}>{user.name}</span>
        {user.role && <span className={s.userRole}>{user.role}</span>}
      </span>
    </Tag>
  );
}

/**
 * Desktop navigation. items / footerItems: [{ key, label, icon, href, badge }].
 * Links are plain hrefs (hash routes work without router wiring).
 */
export function Sidebar({ project, primaryAction, items, footerItems = [], activeKey, user }) {
  const { t } = useI18n();
  const renderItem = (item) => {
    const Icon = item.icon;
    return (
      <li key={item.key}>
        <a href={item.href} aria-current={item.key === activeKey ? 'page' : undefined} className={s.navItem}>
          {Icon && <Icon size={18} aria-hidden="true" />}
          <span>{item.label}</span>
          {item.badge ? <span className={s.badge}>{item.badge}</span> : null}
        </a>
      </li>
    );
  };
  return (
    <nav aria-label={t('ui.mainNav')} className={s.sidebar}>
      {project && (
        <div className={s.project}>
          <span className={s.logo} aria-hidden="true">
            {project.initial}
          </span>
          <span className={s.projectText}>
            <span className={s.projectName}>{project.name}</span>
            {project.subtitle && <span className={s.projectSub}>{project.subtitle}</span>}
          </span>
        </div>
      )}
      {primaryAction && (
        <a href={primaryAction.href} className={s.primary}>
          <Plus size={18} aria-hidden="true" />
          {primaryAction.label}
        </a>
      )}
      <ul className={s.navList}>{items.map(renderItem)}</ul>
      <div className={s.spacer} />
      {footerItems.length > 0 && <ul className={s.navList}>{footerItems.map(renderItem)}</ul>}
      {user && <SidebarUser user={user} />}
    </nav>
  );
}

/**
 * Phone bottom bar: two items, the big + (primary action), two items.
 * items: exactly 4 [{ key, label, icon, href }].
 */
export function BottomNav({ items, primary, activeKey }) {
  const { t } = useI18n();
  const tab = (item) => {
    const Icon = item.icon;
    return (
      <a key={item.key} href={item.href} aria-current={item.key === activeKey ? 'page' : undefined} className={s.tab}>
        {Icon && <Icon size={22} aria-hidden="true" />}
        {item.label}
      </a>
    );
  };
  return (
    <nav aria-label={t('ui.bottomNav')} className={s.bottomNav}>
      {items.slice(0, 2).map(tab)}
      <a href={primary.href} aria-label={primary.label} className={s.fab}>
        <Plus size={26} strokeWidth={2.2} aria-hidden="true" />
      </a>
      {items.slice(2, 4).map(tab)}
    </nav>
  );
}

/** Page heading row: title, subtitle, and actions on the reading end. */
export function TopBar({ title, subtitle, actions }) {
  return (
    <header className={s.topBar}>
      <div className={s.heading}>
        <h1 className={s.title}>{title}</h1>
        {subtitle && <span className={s.subtitle}>{subtitle}</span>}
      </div>
      {actions && <div className={s.topActions}>{actions}</div>}
    </header>
  );
}

/** Looks like a search field; opens the command palette. */
export function SearchButton({ onClick }) {
  const { t } = useI18n();
  return (
    <button type="button" onClick={onClick} className={s.searchButton} aria-label={t('ui.search')}>
      <Search size={16} aria-hidden="true" />
      <span className={s.searchLabel}>{t('ui.searchPlaceholder')}</span>
      <span className={s.kbd}>{t('ui.commandShortcut')}</span>
    </button>
  );
}

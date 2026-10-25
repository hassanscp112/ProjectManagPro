import { ChevronRight, UserRound } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';
import { Card, ListRow } from '../../ui/index.js';
import { AREAS, AREA_TABS, PORTFOLIO_AREAS, SETTINGS_AREA, hrefFor } from '../navigation.js';
import { Page } from '../Page.jsx';
import s from './MorePage.module.css';

/** Phone "More" tab: every area and sub-page, plus who is using the app and the way back to all projects. */
export default function MorePage() {
  const { t } = useI18n();
  const { identity, openIdentity } = useProject();
  // "Forward" chevron: points right in LTR, flipped to point left in RTL.
  const chevron = <ChevronRight size={18} aria-hidden="true" className="ui-flip-rtl" />;

  const rows = [];
  [...AREAS, SETTINGS_AREA, ...PORTFOLIO_AREAS].forEach((area) => {
    const Icon = area.icon;
    const tabs = AREA_TABS[area.key];
    const leading = (
      <span className={s.icon}>
        <Icon size={20} aria-hidden="true" />
      </span>
    );
    if (tabs) {
      tabs.forEach((tab) =>
        rows.push(
          <ListRow key={tab.to} flush href={hrefFor(tab.to)} leading={leading} title={t(tab.labelKey)} subtitle={t(area.labelKey)} trailing={chevron} />
        )
      );
    } else {
      rows.push(<ListRow key={area.key} flush href={hrefFor(area.path)} leading={leading} title={t(area.labelKey)} trailing={chevron} />);
    }
  });

  return (
    <Page area="more">
      <Card padding="sm">
        <ListRow
          flush
          onClick={openIdentity}
          leading={
            <span className={s.icon}>
              <UserRound size={20} aria-hidden="true" />
            </span>
          }
          title={identity?.name || t('ui.userUnset')}
          subtitle={identity?.role || t('app.identity.setUser')}
          trailing={chevron}
        />
      </Card>
      <Card padding="sm">{rows}</Card>
    </Page>
  );
}

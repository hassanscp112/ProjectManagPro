import { Page } from '../Page.jsx';
import { useCan } from '../useCan.js';
import WorkTypesPanel from './WorkTypesPanel.jsx';

/**
 * /work-types — the work-type library shared by every project: unit, trade,
 * productivity per crew-day, crew, the rate that prices it, matching
 * keywords (WorkTypesPanel). Editing needs plan.edit.
 */
export default function WorkTypesPage() {
  const canEdit = useCan()('plan.edit');
  return (
    <Page area="work-types">
      <WorkTypesPanel canEdit={canEdit} />
    </Page>
  );
}

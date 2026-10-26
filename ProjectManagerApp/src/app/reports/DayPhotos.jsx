import { useI18n } from '../../i18n/useI18n.js';
import { OrderPhotoStrip } from '../record/OrderPhotos.jsx';
import { SheetSection } from './ReportSheet.jsx';
import p from './DayPhotos.module.css';
import s from './Reports.module.css';

/**
 * The photos of one day's orders (reportsModel.dayReport().photoIds) in
 * the daily report: thumbnails that open the viewer on screen, small
 * thumbnails on paper. Nothing when the day has none. `dayLabel` titles the viewer.
 */
export function DayPhotos({ ids = [], dayLabel }) {
  const { t } = useI18n();
  if (ids.length === 0) return null;
  return (
    <SheetSection title={t('reports.dayPhotos')} aside={<span className={s.tag}>{t('reports.dayPhotosCount', { n: ids.length })}</span>}>
      <div className={p.photos}>
        <OrderPhotoStrip ids={ids} title={dayLabel ? `${t('reports.dayPhotos')} · ${dayLabel}` : t('reports.dayPhotos')} />
      </div>
    </SheetSection>
  );
}

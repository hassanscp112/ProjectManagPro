import { Camera } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { Button, PhotoStrip } from '../../ui/index.js';
import { useOrderPhotos } from '../useOrderPhotos.js';
import s from './Record.module.css';

// The viewer and its IndexedDB read load only when someone opens it.
const OrderPhotosDialog = lazy(() => import('./OrderPhotosDialog.jsx'));

/** Camera button with the order's photo count; opens its photos. Nothing when it has none. */
export function OrderPhotosButton({ order }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const n = Array.isArray(order.evidence) ? order.evidence.length : 0;
  if (n === 0) return null;
  const label = t('orders.photosButton', { n });
  return (
    <>
      <Button size="sm" variant="ghost" icon={Camera} aria-label={label} title={label} onClick={() => setOpen(true)} className={s.photosButton}>
        {n}
      </Button>
      {open && (
        <Suspense fallback={null}>
          <OrderPhotosDialog order={order} open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}

/** Thumbnails of stored order photos (e.g. an item's latest), each opening the viewer. */
export function OrderPhotoStrip({ ids = [], title }) {
  const { photos, loading } = useOrderPhotos(ids);
  if (!loading && photos.length === 0) return null;
  return (
    <div className={s.photoStrip}>
      <PhotoStrip photos={photos} loading={loading} placeholders={ids.length} title={title} size="sm" />
    </div>
  );
}

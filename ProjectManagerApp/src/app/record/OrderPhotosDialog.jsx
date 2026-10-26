import { useState } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { PhotoViewer } from '../../ui/index.js';
import { useOrderPhotos } from '../useOrderPhotos.js';
import { formatDay, typeLabel } from './orderMeta.js';

/** One order's photos in the viewer (loaded lazily by OrderPhotosButton). */
export default function OrderPhotosDialog({ order, open, onOpenChange }) {
  const { t } = useI18n();
  const { photos, loading, error } = useOrderPhotos(order.evidence);
  const [index, setIndex] = useState(0);
  return (
    <PhotoViewer
      photos={photos}
      index={index}
      onIndexChange={setIndex}
      open={open}
      onOpenChange={onOpenChange}
      loading={loading}
      emptyText={error ? t('orders.photosLoadFailed') : undefined}
      title={t('orders.photosTitle', { type: typeLabel(order.type), date: formatDay(order.date) })}
    />
  );
}

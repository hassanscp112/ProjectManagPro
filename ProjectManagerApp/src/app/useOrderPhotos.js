import { useEffect, useState } from 'react';
import { getFilesByIds } from '../utils/FileDB.js';

/**
 * The stored photos for these FileDB ids (an order's `evidence`, an item's
 * latest photos), in the same order; ids no longer stored are skipped.
 * → { photos: [{ id, url, name, type, size, createdAt, orderId }], loading, error }.
 * Object URLs are made here and revoked when the ids change or the
 * component unmounts, so a photo is only valid while it is shown.
 */
export function useOrderPhotos(ids = []) {
  const key = (Array.isArray(ids) ? ids : []).filter(Boolean).join('\n');
  const [state, setState] = useState({ key: '', photos: [], error: false });

  useEffect(() => {
    if (!key) return undefined;
    let live = true;
    let urls = [];
    getFilesByIds(key.split('\n'))
      .then((records) => {
        if (!live) return;
        const photos = records
          .filter((r) => r.blob)
          .map((r) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            size: r.size,
            createdAt: r.createdAt,
            orderId: r.orderId || null,
            url: URL.createObjectURL(r.blob),
          }));
        urls = photos.map((p) => p.url);
        setState({ key, photos, error: false });
      })
      .catch(() => {
        if (live) setState({ key, photos: [], error: true });
      });
    return () => {
      live = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [key]);

  const ready = state.key === key;
  return {
    photos: key && ready ? state.photos : [],
    loading: Boolean(key) && !ready,
    error: Boolean(key) && ready && state.error,
  };
}

import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { Button, IconButton } from './Button.jsx';
import { Dialog } from './Dialog.jsx';
import { cx } from './cx.js';
import s from './PhotoStrip.module.css';

/**
 * One photo at a time, full size, with previous / next, "2 / 5" and a
 * download link. The arrow keys move too (mirrored in RTL). Controlled:
 * `index` + `onIndexChange`, `open` + `onOpenChange`.
 * `photos`: [{ id, url, name }] (object URLs owned by the caller).
 * `loading` holds the space; `emptyText` replaces "No photos".
 */
export function PhotoViewer({ photos = [], index = 0, onIndexChange, open, onOpenChange, title, loading = false, emptyText }) {
  const { t, dir } = useI18n();
  const count = photos.length;
  const i = count ? Math.min(Math.max(0, index), count - 1) : 0;
  const photo = photos[i];
  const go = (step) => {
    if (count > 1) onIndexChange?.((i + step + count) % count);
  };

  // Arrow keys anywhere in the open dialog (focus may sit on its close button).
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      goRef.current((e.key === 'ArrowRight') === (dir !== 'rtl') ? 1 : -1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, dir]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title || t('ui.photos')}
      size="lg"
      footer={
        photo && (
          <Button as="a" href={photo.url} download={photo.name || 'photo.jpg'} icon={Download}>
            {t('ui.downloadPhoto')}
          </Button>
        )
      }
    >
      <div className={s.viewer}>
        {photo ? (
          <img key={photo.id} src={photo.url} alt={t('ui.photoOf', { n: i + 1, count })} className={s.full} />
        ) : loading ? (
          <div className={s.loading} aria-busy="true" aria-label={t('ui.photosLoading')} />
        ) : (
          <p className={s.empty}>{emptyText || t('ui.noPhotos')}</p>
        )}
        {count > 1 && (
          <div className={s.nav}>
            <IconButton icon={ChevronLeft} variant="secondary" label={t('ui.prevPhoto')} className="ui-flip-rtl" onClick={() => go(-1)} />
            <span className={s.counter} aria-live="polite">
              {t('ui.photoCounter', { n: i + 1, count })}
            </span>
            <IconButton
              icon={ChevronRight}
              variant="secondary"
              label={t('ui.nextPhoto')}
              className="ui-flip-rtl"
              onClick={() => go(1)}
              data-autofocus
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}

/**
 * A row of photo thumbnails; tapping one opens the viewer on it.
 * `photos`: [{ id, url, name }]. While `loading`, `placeholders` grey
 * tiles hold the space. `size`: 'sm' (64px) or 'md' (88px).
 */
export function PhotoStrip({ photos = [], loading = false, placeholders = 0, title, size = 'md', className }) {
  const { t } = useI18n();
  const [viewing, setViewing] = useState(null);
  const count = photos.length;

  if (loading && count === 0) {
    if (!placeholders) return null;
    return (
      <ul className={cx(s.strip, s[size], className)} aria-busy="true" aria-label={t('ui.photosLoading')}>
        {Array.from({ length: placeholders }, (_, i) => (
          <li key={i} className={cx(s.tile, s.placeholder)} />
        ))}
      </ul>
    );
  }
  if (count === 0) return null;

  return (
    <>
      <ul className={cx(s.strip, s[size], className)} aria-label={title || t('ui.photos')}>
        {photos.map((p, i) => (
          <li key={p.id}>
            <button type="button" className={s.tile} onClick={() => setViewing(i)} aria-label={t('ui.openPhoto', { n: i + 1, count })}>
              <img src={p.url} alt="" className={s.img} loading="lazy" decoding="async" />
            </button>
          </li>
        ))}
      </ul>
      <PhotoViewer
        photos={photos}
        index={viewing ?? 0}
        onIndexChange={setViewing}
        open={viewing !== null}
        onOpenChange={(open) => !open && setViewing(null)}
        title={title}
      />
    </>
  );
}

import { Camera, ImagePlus, Images, LoaderCircle, X } from 'lucide-react';
import { useCallback, useId, useRef, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { compressImage } from '../utils/ImageCompress.js';
import { Button } from './Button.jsx';
import { cx } from './cx.js';
import { usePhone } from './useMediaQuery.js';
import s from './PhotoPicker.module.css';

const MAX_PHOTOS = 6;

let seq = 0;
const nextId = () => `photo-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const isImage = (file) => /^image\//.test(file?.type || '') || /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(file?.name || '');

/**
 * <img> for a Blob. The object URL is created when the element mounts and
 * revoked when it unmounts or the blob changes (React 19 ref cleanup).
 */
export function BlobImage({ blob, alt = '', className }) {
  const attach = useCallback(
    (img) => {
      if (!img || !blob) return undefined;
      const url = URL.createObjectURL(blob);
      img.src = url;
      return () => URL.revokeObjectURL(url);
    },
    [blob]
  );
  return <img ref={attach} alt={alt} className={className} decoding="async" />;
}

/**
 * Photos for a form, compressed before they are kept (utils/ImageCompress).
 * Controlled: `photos` is a list of { id, file } — `busy: true` and no file
 * while compressing — and `onChange(update)` receives an updater
 * (list → list), so a state setter can be passed straight in.
 * Phones get "Take photo" (rear camera) and "Gallery"; desktops "Add photos".
 */
export function PhotoPicker({ photos = [], onChange, max = MAX_PHOTOS, label, optional = true, disabled = false, className }) {
  const { t } = useI18n();
  const phone = usePhone();
  const labelId = useId();
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [note, setNote] = useState('');
  const room = Math.max(0, max - photos.length);
  const full = room === 0;

  const add = (input) => {
    const picked = [...(input.files || [])].filter(isImage);
    input.value = ''; // picking the same photo again still fires change
    const accepted = picked.slice(0, room);
    setNote(picked.length > accepted.length ? t('ui.photosLimit', { max }) : '');
    if (accepted.length === 0) return;
    const items = accepted.map(() => ({ id: nextId(), file: null, busy: true }));
    onChange((list) => [...list, ...items]);
    accepted.forEach((file, i) => {
      const { id } = items[i];
      compressImage(file)
        .catch(() => file)
        .then((out) => onChange((list) => list.map((p) => (p.id === id ? { id, file: out } : p))));
    });
  };

  const remove = (id) => {
    setNote('');
    onChange((list) => list.filter((p) => p.id !== id));
  };

  const fileInput = (ref, extra) => (
    <input ref={ref} type="file" accept="image/*" hidden tabIndex={-1} onChange={(e) => add(e.target)} {...extra} />
  );

  return (
    <div role="group" aria-labelledby={labelId} className={cx(s.picker, className)}>
      <div className={s.head}>
        <span id={labelId} className={s.label}>
          {label || t('ui.photos')}
          {optional && <span className={s.optional}>{t('ui.optional')}</span>}
        </span>
        <span className={s.count}>{t('ui.photosCount', { n: photos.length, max })}</span>
      </div>

      {photos.length > 0 && (
        <ul className={s.grid}>
          {photos.map((p, i) => (
            <li key={p.id} className={s.thumb} aria-busy={p.busy || undefined}>
              {p.busy ? (
                <span className={s.busy}>
                  <LoaderCircle size={22} aria-hidden="true" className={s.spin} />
                  <span className="ui-visually-hidden">{t('ui.photoPreparing')}</span>
                </span>
              ) : (
                <BlobImage blob={p.file} alt={t('ui.photoN', { n: i + 1 })} className={s.img} />
              )}
              <button
                type="button"
                className={s.remove}
                aria-label={t('ui.removePhoto', { n: i + 1 })}
                title={t('ui.removePhoto', { n: i + 1 })}
                onClick={() => remove(p.id)}
                disabled={disabled}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={s.actions}>
        {phone ? (
          <>
            {fileInput(cameraRef, { capture: 'environment' })}
            {fileInput(galleryRef, { multiple: true })}
            <Button icon={Camera} size="lg" disabled={disabled || full} onClick={() => cameraRef.current?.click()} className={s.action}>
              {t('ui.takePhoto')}
            </Button>
            <Button icon={Images} size="lg" disabled={disabled || full} onClick={() => galleryRef.current?.click()} className={s.action}>
              {t('ui.gallery')}
            </Button>
          </>
        ) : (
          <>
            {fileInput(galleryRef, { multiple: true })}
            <Button icon={ImagePlus} disabled={disabled || full} onClick={() => galleryRef.current?.click()}>
              {t('ui.addPhotos')}
            </Button>
          </>
        )}
      </div>
      {(note || full) && (
        <p className={s.note} role="status">
          {note || t('ui.photosFull', { max })}
        </p>
      )}
    </div>
  );
}

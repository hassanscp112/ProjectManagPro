// ─────────────────────────────────────────────────────────────
// ImageCompress — shrink a site photo before it is stored.
//
// Phone cameras take 3–12 MB photos; an order needs evidence, not a
// print. compressImage turns a picked image into a JPEG whose longest side
// is at most 1600 px (quality 0.8), honouring the EXIF rotation. Anything
// that fails — an old browser, an undecodable format — keeps the original
// file, and so does a "compressed" copy that came out larger.
// fitWithin is pure and tested in __tests__/imageCompress.test.js.
// ─────────────────────────────────────────────────────────────

export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_QUALITY = 0.8;

/**
 * Scale (w, h) down so the longest side is at most maxSide, keeping the
 * aspect ratio; never scales up. Whole pixels, at least 1 each.
 */
export const fitWithin = (w, h, maxSide) => {
  const width = Number(w) || 0;
  const height = Number(h) || 0;
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (!(maxSide > 0) || longest <= maxSide) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxSide / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

/** 'IMG_0412.HEIC' → 'IMG_0412.jpg' (the name of the compressed copy). */
export const jpegName = (name) => {
  const base = String(name || '').replace(/\.[^./\\]+$/, '').trim();
  return `${base || 'photo'}.jpg`;
};

const canvasToJpeg = (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

/**
 * A JPEG copy of an image File, at most maxSide px on its longest side.
 * Always resolves: falls back to the original file on any failure or
 * when the copy is not smaller.
 */
export const compressImage = async (file, { maxSide = PHOTO_MAX_SIDE, quality = PHOTO_QUALITY } = {}) => {
  if (!file || typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  let bitmap = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
    if (!width || !height) return file;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#fff'; // transparent PNG areas become white, not black
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvasToJpeg(canvas, quality);
    if (!blob || !(blob.size < file.size)) return file;
    return new File([blob], jpegName(file.name), { type: 'image/jpeg', lastModified: file.lastModified || Date.now() });
  } catch {
    return file;
  } finally {
    bitmap?.close?.();
  }
};

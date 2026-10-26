import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compressImage, fitWithin, jpegName } from '../ImageCompress.js';

test('fitWithin scales the longest side down to maxSide and keeps the ratio', () => {
  assert.deepEqual(fitWithin(4000, 3000, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(fitWithin(3000, 4000, 1600), { width: 1200, height: 1600 });
  assert.deepEqual(fitWithin(4032, 3024, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(fitWithin(5000, 5000, 1600), { width: 1600, height: 1600 });
  assert.deepEqual(fitWithin(1601, 3, 1600), { width: 1600, height: 3 });
  assert.deepEqual(fitWithin(20000, 1, 1600), { width: 1600, height: 1 });
});

test('fitWithin never scales up and rejects empty sizes', () => {
  assert.deepEqual(fitWithin(800, 600, 1600), { width: 800, height: 600 });
  assert.deepEqual(fitWithin(1600, 900, 1600), { width: 1600, height: 900 });
  assert.deepEqual(fitWithin(0, 600, 1600), { width: 0, height: 0 });
  assert.deepEqual(fitWithin(-5, 600, 1600), { width: 0, height: 0 });
  assert.deepEqual(fitWithin('x', 600, 1600), { width: 0, height: 0 });
  assert.deepEqual(fitWithin(800, 600, 0), { width: 800, height: 600 });
});

test('jpegName swaps the extension', () => {
  assert.equal(jpegName('IMG_0412.HEIC'), 'IMG_0412.jpg');
  assert.equal(jpegName('site.photo.png'), 'site.photo.jpg');
  assert.equal(jpegName('noext'), 'noext.jpg');
  assert.equal(jpegName(''), 'photo.jpg');
});

test('compressImage keeps the original when the browser cannot decode', async () => {
  const file = { name: 'a.jpg', size: 10, type: 'image/jpeg' };
  assert.equal(await compressImage(file), file); // no createImageBitmap / document under node
  assert.equal(await compressImage(null), null);
});

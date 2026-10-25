import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Golden rule: every UI string exists in BOTH languages. This fails the
// moment a key is added to one dictionary folder and not the other.

const dictRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dictionaries');

const loadKeys = async (lang) => {
  const byFile = {};
  for (const file of readdirSync(path.join(dictRoot, lang)).filter((f) => f.endsWith('.js'))) {
    const mod = await import(pathToFileURL(path.join(dictRoot, lang, file)).href);
    byFile[file] = Object.keys(mod.default || {});
  }
  return byFile;
};

test('ar and en have the same dictionary files', async () => {
  const ar = await loadKeys('ar');
  const en = await loadKeys('en');
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ar).sort());
});

test('every dictionary file has the same keys in ar and en', async () => {
  const ar = await loadKeys('ar');
  const en = await loadKeys('en');
  for (const file of Object.keys(ar)) {
    const arKeys = new Set(ar[file]);
    const enKeys = new Set(en[file] || []);
    const missingInEn = [...arKeys].filter((k) => !enKeys.has(k));
    const missingInAr = [...enKeys].filter((k) => !arKeys.has(k));
    assert.deepEqual({ file, missingInEn, missingInAr }, { file, missingInEn: [], missingInAr: [] });
  }
});

test('no translation is empty', async () => {
  for (const lang of ['ar', 'en']) {
    for (const file of readdirSync(path.join(dictRoot, lang)).filter((f) => f.endsWith('.js'))) {
      const mod = await import(pathToFileURL(path.join(dictRoot, lang, file)).href);
      const empty = Object.entries(mod.default || {})
        .filter(([, v]) => typeof v !== 'string' || v.trim() === '')
        .map(([k]) => k);
      assert.deepEqual({ lang, file, empty }, { lang, file, empty: [] });
    }
  }
});

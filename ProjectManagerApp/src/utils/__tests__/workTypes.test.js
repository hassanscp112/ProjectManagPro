// Unit tests for the work-type library, its seeds and the rate library
// upgrade (node:test).

import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment } from './helpers.js';

installNodeTestEnvironment();

const { loadWorkTypes, saveWorkTypes, upsertWorkType, deleteWorkType, durationFor, workTypeName, cleanWorkType, WORK_TYPES_KEY } = await import('../planning/WorkTypes.js');
const { seedWorkTypes, BUILDING_RATES } = await import('../planning/workTypeSeeds.js');
const { TRADES } = await import('../planning/trades.js');
const { loadRateLibrary, saveRateLibrary, DEFAULT_RATES, STORAGE_KEY: RATES_KEY } = await import('../RateLibrary.js');
const { PARTS } = await import('../TemplateEngine.js');

beforeEach(() => localStorage.clear());

describe('work-type seeds', () => {
  it('have unique ids, both names, a known trade, productivity and a rate that exists', () => {
    const seeds = seedWorkTypes();
    const rateIds = new Set(DEFAULT_RATES.map((r) => r.id));
    assert.equal(new Set(seeds.map((w) => w.id)).size, seeds.length);
    assert.ok(seeds.length >= 70);
    seeds.forEach((w) => {
      assert.ok(w.name && w.nameEn, w.id);
      assert.ok(TRADES.includes(w.trade), `${w.id} trade ${w.trade}`);
      assert.ok(w.productivity > 0, w.id);
      assert.ok(rateIds.has(w.rateId), `${w.id} rate ${w.rateId}`);
      assert.equal(w.checked, false);
    });
  });

  it('cover every old TemplateEngine part id', () => {
    const ids = new Set(seedWorkTypes().map((w) => w.id));
    PARTS.forEach((p) => assert.ok(ids.has(p.id), p.id));
  });

  it('new rate names do not clash with the old ones (name lookups stay exact)', () => {
    const names = DEFAULT_RATES.map((r) => r.name);
    assert.equal(new Set(names).size, names.length);
    assert.equal(new Set(BUILDING_RATES.map((r) => r.id)).size, BUILDING_RATES.length);
  });
});

describe('WorkTypes store', () => {
  it('seeds on first use and keeps edits', () => {
    const items = loadWorkTypes();
    assert.equal(items.length, seedWorkTypes().length);
    const saved = upsertWorkType({ ...items[0], productivity: '12.5', checked: true });
    assert.equal(saved.productivity, 12.5);
    assert.equal(loadWorkTypes()[0].checked, true);
  });

  it('a deleted seed is not seeded again on an upgrade', () => {
    loadWorkTypes();
    deleteWorkType('marble');
    // Simulate an older store version: the next load tops up missing seeds.
    const doc = JSON.parse(localStorage.getItem(WORK_TYPES_KEY));
    localStorage.setItem(WORK_TYPES_KEY, JSON.stringify({ ...doc, seedVersion: 0, items: doc.items.filter((w) => w.id !== 'paint') }));
    const ids = loadWorkTypes().map((w) => w.id);
    assert.ok(ids.includes('paint')); // missing seed restored
    assert.ok(!ids.includes('marble')); // removed seed stays removed
  });

  it('an upgrade gives seeded types the new fields but keeps the user values', () => {
    const old = seedWorkTypes().map((w) => {
      const copy = { ...w, keywords: ['قديم'] };
      delete copy.family;
      return copy;
    });
    old.find((w) => w.id === 'tiles').productivity = 33;
    localStorage.setItem(WORK_TYPES_KEY, JSON.stringify({ items: old, seedVersion: 1, removedSeeds: [] }));
    const tiles = loadWorkTypes().find((w) => w.id === 'tiles');
    assert.equal(tiles.family, 'floor-finish');
    assert.equal(tiles.productivity, 33);
    assert.ok(tiles.keywords.includes('قديم') && tiles.keywords.includes('سيراميك'));
  });

  it('saveWorkTypes replaces the list; user work types get an id and defaults', () => {
    const custom = upsertWorkType({ name: 'تغليف خشبي', trade: 'nope', productivity: -1 });
    assert.ok(custom.id);
    assert.equal(custom.trade, 'general');
    assert.equal(custom.productivity, 0);
    assert.equal(custom.source, 'user');
    saveWorkTypes([custom]);
    assert.deepEqual(loadWorkTypes().map((w) => w.id), [custom.id]);
    assert.equal(cleanWorkType({ crew: { labour: '4', equipment: { crane: '1', pump: 0 } } }).crew.equipment.crane, 1);
  });

  it('durationFor: fixed days, ceil(qty / (productivity × crews)), 1–365, null when unknown', () => {
    assert.equal(durationFor(100, { productivity: 30 }), 4);
    assert.equal(durationFor(100, { productivity: 30, crews: 2 }), 2);
    assert.equal(durationFor(5, { productivity: 30 }), 1);
    assert.equal(durationFor(1e7, { productivity: 1 }), 365);
    assert.equal(durationFor(1, { fixedDays: 14 }), 14);
    assert.equal(durationFor(10, { productivity: 0 }), null);
  });

  it('workTypeName follows the language', () => {
    const w = { name: 'صبغ', nameEn: 'Paint' };
    assert.equal(workTypeName(w, 'en'), 'Paint');
    assert.equal(workTypeName(w, 'ar'), 'صبغ');
    assert.equal(workTypeName({ name: 'صبغ' }, 'en'), 'صبغ');
  });
});

describe('rate library upgrade (seed version 2)', () => {
  it('a version-1 library gets the building rates once; deleted ones stay deleted', () => {
    localStorage.setItem(RATES_KEY, JSON.stringify({ items: [{ id: 'r-tiles', name: 'بلاط أرضي', unit: 'م2', unitPrice: 25000 }] }));
    const items = loadRateLibrary();
    assert.equal(items.find((r) => r.id === 'r-tiles').unitPrice, 25000); // user price kept
    assert.ok(items.some((r) => r.id === 'rb-rc-slab'));
    saveRateLibrary(items.filter((r) => r.id !== 'rb-rc-slab'));
    assert.ok(!loadRateLibrary().some((r) => r.id === 'rb-rc-slab'));
  });

  it('a fresh library has every default rate', () => {
    assert.equal(loadRateLibrary().length, DEFAULT_RATES.length);
  });
});

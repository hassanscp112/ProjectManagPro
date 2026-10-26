// Unit tests for src/utils/planning/generator.js (node:test): levels,
// per-level expansion, conditions and link rules.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment } from './helpers.js';

installNodeTestEnvironment();

const { templateValues, buildLevels, expandTemplate, resolveLinks } = await import('../planning/generator.js');

const tiny = (elements, levels = {}) => ({
  schema: 2,
  variables: [
    { key: 'floors', type: 'int', default: 3, min: 1 },
    { key: 'area', default: 100 },
    { key: 'h', default: 3 },
    { key: 'basement', type: 'bool', default: 0 },
  ],
  levels: { count: 'floors', basement: 'basement', area: 'area', height: 'h', use: 'residential', ...levels },
  sections: [{ key: 'sub' }, { key: 'level' }, { key: 'roof' }],
  elements,
});
const E = (key, section, qty, extra = {}) => ({ key, workType: 'w', section, scope: section === 'level' ? 'level' : 'once', qty, links: [], ...extra });
const linksOf = (items, key) => items.find((i) => i.key === key).links.map((l) => `${l.to}:${l.type}${l.lag ? l.lag : ''}${l.lagUnit === 'cd' ? 'cd' : ''}`);

describe('templateValues / buildLevels', () => {
  it('fills defaults, clamps, rounds ints and turns bools into 0/1', () => {
    const t = tiny([]);
    assert.deepEqual(templateValues(t, { floors: '2.6', area: '', basement: 2 }), { floors: 3, area: 100, h: 3, basement: 1 });
    assert.equal(templateValues(t, { floors: -4 }).floors, 1);
    assert.equal(templateValues(t, { basement: 'yes' }).basement, 0); // not a number → the default
  });

  it('builds basement + ground + upper levels with per-level overrides', () => {
    const t = tiny([], { groundUse: 'commercial' });
    const vars = templateValues(t, { floors: 3, basement: 1 });
    const levels = buildLevels(t, vars, [null, { area: 80, use: 'office' }, { height: 4.5 }]);
    assert.deepEqual(levels.map((l) => l.key), ['B', 'G', '1', '2']);
    assert.deepEqual(levels.map((l) => l.use), ['parking', 'office', 'residential', 'residential']);
    assert.deepEqual(levels.map((l) => l.area), [100, 80, 100, 100]);
    assert.equal(levels[2].height, 4.5);
    assert.equal(levels[1].useCode, 3);
  });
});

describe('expandTemplate', () => {
  it('one item per level for level elements, conditions and zero quantities skip items', () => {
    const t = tiny([
      E('exc', 'sub', 'footprint*2'),
      E('raft', 'sub', 'footprint', { when: 'basement' }),
      E('slab', 'level', 'levelArea*0.3'),
      E('kitchen', 'level', 'isGround ? 5 : 0'),
      E('roof', 'roof', 'roofArea'),
    ]);
    const { items, levels, issues } = expandTemplate(t, { floors: 2 });
    assert.equal(levels.length, 2);
    assert.deepEqual(items.map((i) => i.key), ['exc', 'slab@G', 'slab@1', 'kitchen@G', 'roof']);
    assert.equal(items.find((i) => i.key === 'slab@1').qty, 30);
    assert.equal(items.find((i) => i.key === 'exc').qty, 200);
    assert.deepEqual(issues, []);
  });

  it('per-level variables: levelsAbove, perimeter scaled by area, use constants', () => {
    const t = tiny([E('cols', 'level', 'levelsAbove'), E('shops', 'level', 'levelUse == COMMERCIAL ? 1 : 0'), E('per', 'level', 'levelPerimeter')], { groundUse: 'commercial' });
    const { items } = expandTemplate(t, { floors: 3 }, { levelOverrides: [{ area: 400 }] });
    assert.deepEqual(items.filter((i) => i.elementKey === 'cols').map((i) => i.qty), [2, 1]); // top level: 0 → no item
    assert.deepEqual(items.filter((i) => i.elementKey === 'shops').map((i) => i.key), ['shops@G']);
    const per = items.filter((i) => i.elementKey === 'per').map((i) => i.qty);
    assert.equal(per[0], Math.round(per[1] * 2 * 100) / 100); // 4× the area → 2× the perimeter
  });

  it('reports formula problems once per element', () => {
    const { issues } = expandTemplate(tiny([E('x', 'level', 'nope*2'), E('y', 'sub', '2 +')]), { floors: 3 });
    assert.deepEqual(issues, [
      { code: 'formula', elementKey: 'x', error: 'unknown', names: ['nope'] },
      { code: 'formula', elementKey: 'y', error: 'syntax' },
    ]);
  });
});

describe('resolveLinks', () => {
  const L = (to, extra = {}) => ({ to, type: 'FS', lag: 0, ...extra });
  const run = (elements, values = { floors: 3 }) => {
    const t = tiny(elements);
    const { items, levels } = expandTemplate(t, values);
    return resolveLinks(items, t, levels.length);
  };

  it('same / prev / next / first / last / all / offset selectors and if-filters', () => {
    const { items, issues } = run([
      E('base', 'sub', '1'),
      E('cols', 'level', '1', { links: [L('slab', { floor: 'prev', lag: 7, lagUnit: 'cd', if: 'notFirst' }), L('base', { if: 'first' })] }),
      E('slab', 'level', '1', { links: [L('cols', { lag: 2 })] }),
      E('wall', 'level', '1', { links: [L('slab', { floor: 'next', if: 'notLast' }), L('slab', { lag: 21 })] }),
      E('roof', 'roof', '1', { links: [L('slab')] }),
      E('lift', 'roof', '1', { links: [L('cols', { floor: 'first', type: 'SS' })] }),
      E('test', 'roof', '1', { links: [L('wall', { floor: 'all' })] }),
      E('skip', 'level', '1', { links: [L('slab', { floor: { offset: 2 } })] }),
    ]);
    assert.deepEqual(issues, []);
    assert.deepEqual(linksOf(items, 'cols@G'), ['base:FS']);
    assert.deepEqual(linksOf(items, 'cols@1'), ['slab@G:FS7cd']);
    assert.deepEqual(linksOf(items, 'slab@1'), ['cols@1:FS2']);
    assert.deepEqual(linksOf(items, 'wall@G'), ['slab@1:FS', 'slab@G:FS21']);
    assert.deepEqual(linksOf(items, 'wall@2'), ['slab@2:FS21']);
    assert.deepEqual(linksOf(items, 'roof'), ['slab@2:FS']); // once → last level by default
    assert.deepEqual(linksOf(items, 'lift'), ['cols@G:SS']);
    assert.deepEqual(linksOf(items, 'test'), ['wall@G:FS', 'wall@1:FS', 'wall@2:FS']);
    assert.deepEqual(linksOf(items, 'skip@G'), ['slab@2:FS']);
  });

  it('links to elements that produced no item are skipped; names unknown to the template are reported', () => {
    const { items, issues } = run([
      E('raft', 'sub', '1', { when: 'basement' }),
      E('cols', 'level', '1', { links: [L('raft'), L('ghost')] }),
      E('slab', 'level', '1'),
    ]);
    assert.deepEqual(issues, [{ code: 'unknownLink', elementKey: 'cols', to: 'ghost' }]);
    // No rule resolved on a level → it waits for the level's anchor (slab).
    assert.deepEqual(linksOf(items, 'cols@G'), ['slab@G:FS']);
  });

  it('a link to a list of keys takes whichever exist', () => {
    const { items } = run([
      E('f1', 'level', '1', { when: 'levelIndex == 0' }),
      E('f2', 'level', '1', { when: 'levelIndex > 0' }),
      E('paint', 'level', '1', { links: [L(['f1', 'f2'])] }),
    ]);
    assert.deepEqual(linksOf(items, 'paint@G'), ['f1@G:FS']);
    assert.deepEqual(linksOf(items, 'paint@1'), ['f2@1:FS']);
  });
});

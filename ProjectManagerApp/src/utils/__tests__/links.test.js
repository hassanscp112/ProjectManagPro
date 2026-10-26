// Unit tests for src/utils/planning/links.js (node:test).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment } from './helpers.js';

installNodeTestEnvironment();

const { readLinks, writeLinks, removeLinksTo, hasLinkTo, formatLinks, parseLinks } = await import('../planning/links.js');

const legacy = (extra = {}) => ({ id: 'T', wbs: '1.2', dependsOn: 'A', depType: 'SS', lag: 3, ...extra });

describe('readLinks', () => {
  it('reads a legacy task as one link', () => {
    assert.deepEqual(readLinks(legacy()), [{ id: 'A', type: 'SS', lag: 3 }]);
    assert.deepEqual(readLinks({ id: 'T', dependsOn: null, depType: '', lag: 0 }), []);
  });

  it('slot 0 always comes from dependsOn; predecessors[1..] are the extra links', () => {
    const task = legacy({ predecessors: [{ id: 'A', type: 'SS', lag: 3 }, { id: 'B', type: 'FS', lag: 0 }] });
    assert.deepEqual(readLinks(task), [{ id: 'A', type: 'SS', lag: 3 }, { id: 'B', type: 'FS', lag: 0 }]);
  });

  it('follows a legacy writer that changed or cleared dependsOn', () => {
    const changed = legacy({ dependsOn: 'C', predecessors: [{ id: 'A', type: 'SS', lag: 3 }, { id: 'B', type: 'FS', lag: 0 }] });
    assert.deepEqual(readLinks(changed).map((l) => l.id), ['C', 'B']);
    const cleared = legacy({ dependsOn: null, predecessors: [{ id: 'A', type: 'SS', lag: 3 }, { id: 'B', type: 'FS', lag: 0 }] });
    assert.deepEqual(readLinks(cleared).map((l) => l.id), ['B']);
  });

  it('drops entries without an id and keeps a calendar-day lag on the mirror', () => {
    const task = legacy({ predecessors: [{ id: 'A', type: 'SS', lag: 3, lagUnit: 'cd' }, { id: '' }, null, { id: 'B', type: 'FF', lag: 1, lagUnit: 'cd' }] });
    assert.deepEqual(readLinks(task), [{ id: 'A', type: 'SS', lag: 3, lagUnit: 'cd' }, { id: 'B', type: 'FF', lag: 1, lagUnit: 'cd' }]);
  });
});

describe('writeLinks', () => {
  it('mirrors slot 0 into the legacy fields and stores the list only when needed', () => {
    assert.deepEqual(writeLinks({ id: 'T', predecessors: [{ id: 'X' }] }, []), { id: 'T', dependsOn: null, depType: '', lag: 0 });
    assert.deepEqual(writeLinks({ id: 'T' }, [{ id: 'A', type: 'FF', lag: '2' }]), { id: 'T', dependsOn: 'A', depType: 'FF', lag: 2 });
    const two = writeLinks({ id: 'T' }, [{ id: 'A', type: 'SS', lag: 1 }, { id: 'B', type: 'bad', lag: 'x' }]);
    assert.equal(two.dependsOn, 'A');
    assert.deepEqual(two.predecessors, [{ id: 'A', type: 'SS', lag: 1 }, { id: 'B', type: 'FS', lag: 0 }]);
    const cd = writeLinks({ id: 'T' }, [{ id: 'A', type: 'FS', lag: 7, lagUnit: 'cd' }]);
    assert.deepEqual(cd.predecessors, [{ id: 'A', type: 'FS', lag: 7, lagUnit: 'cd' }]);
  });

  it('round-trips through readLinks', () => {
    const links = [{ id: 'A', type: 'SS', lag: 1 }, { id: 'B', type: 'FS', lag: -2 }, { id: 'C', type: 'FF', lag: 0 }];
    assert.deepEqual(readLinks(writeLinks({ id: 'T' }, links)), links);
  });
});

describe('removeLinksTo / hasLinkTo', () => {
  it('a legacy task gives exactly the old cleared object', () => {
    const task = legacy({ name: 'x' });
    assert.deepStrictEqual(removeLinksTo(task, new Set(['A'])), { ...task, dependsOn: null, depType: '', lag: 0 });
  });

  it('returns the same object when nothing links to the ids', () => {
    const task = legacy();
    assert.equal(removeLinksTo(task, new Set(['Z'])), task);
    assert.equal(hasLinkTo(task, new Set(['Z'])), false);
  });

  it('removes extra and leveling links, promoting the next link to slot 0', () => {
    const task = writeLinks({ id: 'T' }, [{ id: 'A', type: 'FS', lag: 0 }, { id: 'B', type: 'SS', lag: 2 }, { id: 'C', type: 'FS', lag: 0 }]);
    task.levelLinks = [{ id: 'C', type: 'FS', lag: 0 }, { id: 'D', type: 'FS', lag: 0 }];
    assert.equal(hasLinkTo(task, new Set(['D'])), true);
    const next = removeLinksTo(task, new Set(['A', 'C']));
    assert.deepEqual(readLinks(next), [{ id: 'B', type: 'SS', lag: 2 }]);
    assert.equal(next.dependsOn, 'B');
    assert.equal(next.predecessors, undefined);
    assert.deepEqual(next.levelLinks, [{ id: 'D', type: 'FS', lag: 0 }]);
  });
});

describe('formatLinks / parseLinks', () => {
  const wbs = { A: '2.1', B: '2.4', C: '3.2' };
  const ids = Object.fromEntries(Object.entries(wbs).map(([k, v]) => [v, k]));
  const wbsOf = (id) => wbs[id];
  const idOf = (w) => ids[w] || null;

  it('writes the short form and reads it back', () => {
    const links = [{ id: 'A', type: 'FS', lag: 3 }, { id: 'B', type: 'SS', lag: 0 }, { id: 'C', type: 'FF', lag: -2, lagUnit: 'cd' }, { id: 'A', type: 'FS', lag: 0 }];
    const text = formatLinks(links, wbsOf);
    assert.equal(text, '2.1FS+3; 2.4SS; 3.2FF-2d; 2.1');
    const { links: back, errors } = parseLinks(text, idOf);
    assert.deepEqual(errors, []);
    assert.deepEqual(back, links.slice(0, 3)); // the repeated 2.1 is dropped
  });

  it('accepts spaces, lower case and Arabic commas; reports what it cannot resolve', () => {
    const { links, errors } = parseLinks(' 2.1 ss + 2 ، 9.9 ; 3.2', idOf);
    assert.deepEqual(links, [{ id: 'A', type: 'SS', lag: 2 }, { id: 'C', type: 'FS', lag: 0 }]);
    assert.deepEqual(errors, ['9.9']);
  });
});

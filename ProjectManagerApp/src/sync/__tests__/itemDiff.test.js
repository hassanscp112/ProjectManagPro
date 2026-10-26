// itemDiff: stores ⇄ items, positions, what changed, applying server versions.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ABSENT,
  DOC_ITEM,
  applyItems,
  assignPositions,
  diffItems,
  explodeStore,
  hashOf,
  materialize,
  parseItemKey,
  stableStringify,
} from '../itemDiff.js';
import { storeFor } from '../../utils/storeRegistry.js';

const TASKS = storeFor('project-manager-gantt-tasks');
const ORDERS = storeFor('pm-orders');
const FINANCE = storeFor('project-manager-finance-data');
const CONFIG = storeFor('project-manager-finance-config');

const baseFrom = (entry, value) => {
  const base = {};
  [...explodeStore(entry, value)].forEach(([key, item], i) => {
    base[key] = { h: hashOf(item.data), rev: 1, pos: i, data: item.data, deleted: false };
  });
  return base;
};

describe('itemDiff — stable JSON', () => {
  it('ignores key order and drops undefined like JSON', () => {
    assert.equal(stableStringify({ b: 1, a: { d: [1, undefined], c: 2 }, x: undefined }), '{"a":{"c":2,"d":[1,null]},"b":1}');
    assert.equal(hashOf({ a: 1, b: 2 }), hashOf({ b: 2, a: 1 }));
    assert.notEqual(hashOf({ a: 1 }), hashOf({ a: 2 }));
  });
});

describe('itemDiff — explode', () => {
  it('splits a list store into one item per record', () => {
    const items = explodeStore(TASKS, [{ id: 't1' }, { id: 't2' }]);
    assert.deepEqual([...items.keys()], ['t1', 't2']);
    assert.equal(items.get('t2').index, 1);
  });

  it('names records of a list inside an object, and keeps the rest as $doc', () => {
    const items = explodeStore(ORDERS, { orders: [{ id: 'o1' }], lastWhoByType: { dig: { kind: 'none' } } });
    assert.deepEqual([...items.keys()], ['orders/o1', DOC_ITEM]);
    assert.deepEqual(items.get(DOC_ITEM).data, { orders: [], lastWhoByType: { dig: { kind: 'none' } } });
  });

  it('several lists in one store', () => {
    const items = explodeStore(FINANCE, { machinery: [{ id: 'm1' }], materials: [{ id: 'x1' }], pettyCash: [], payroll: [] });
    assert.deepEqual([...items.keys()].sort(), ['$doc', 'machinery/m1', 'materials/x1']);
  });

  it('a store without lists is one document', () => {
    const items = explodeStore(CONFIG, { months: {} });
    assert.deepEqual([...items.keys()], [DOC_ITEM]);
  });

  it('a list with missing or duplicate ids stays in the document', () => {
    const items = explodeStore(ORDERS, { orders: [{ id: 'o1' }, { id: 'o1' }] });
    assert.deepEqual([...items.keys()], [DOC_ITEM]);
    assert.equal(explodeStore(TASKS, [{ name: 'no id' }]).has(DOC_ITEM), true);
  });

  it('reads item keys back', () => {
    assert.deepEqual(parseItemKey(ORDERS, 'orders/o1'), { path: 'orders', id: 'o1', idField: 'id' });
    assert.deepEqual(parseItemKey(TASKS, 't1'), { path: '', id: 't1', idField: 'id' });
    assert.deepEqual(parseItemKey(ORDERS, DOC_ITEM), { doc: true });
    assert.equal(parseItemKey(ORDERS, 'nope'), null);
  });
});

describe('itemDiff — positions', () => {
  it('counts from 0 for a new list and goes between neighbours later', () => {
    assert.deepEqual([...assignPositions(['a', 'b', 'c'], () => undefined).values()], [0, 1, 2]);
    const known = { a: 0, c: 1 };
    assert.deepEqual([...assignPositions(['a', 'b', 'c'], (k) => known[k]).entries()], [['b', 0.5]]);
    assert.deepEqual([...assignPositions(['n', 'a'], (k) => known[k]).entries()], [['n', -1]]);
    assert.deepEqual([...assignPositions(['a', 'c', 'z'], (k) => known[k]).entries()], [['z', 2]]);
  });
});

describe('itemDiff — diff', () => {
  it('finds inserts, updates and deletes', () => {
    const base = baseFrom(TASKS, [{ id: 't1', q: 1 }, { id: 't2', q: 1 }]);
    const { changes } = diffItems(base, explodeStore(TASKS, [{ id: 't1', q: 2 }, { id: 't3', q: 1 }]));
    assert.deepEqual(
      changes.map((c) => [c.key, c.op]),
      [
        ['t1', 'update'],
        ['t3', 'insert'],
        ['t2', 'delete'],
      ]
    );
    const update = changes[0];
    assert.equal(update.before.q, 1);
    assert.equal(update.baseRev, 1);
    assert.equal(changes[1].pos, 1, 'after t1 (0), before nothing known');
  });

  it('nothing changes when only key order differs', () => {
    const base = baseFrom(TASKS, [{ id: 't1', a: 1, b: 2 }]);
    assert.deepEqual(diffItems(base, explodeStore(TASKS, [{ b: 2, a: 1, id: 't1' }])).changes, []);
  });

  it('re-creating a deleted record is an update of it', () => {
    const base = { t1: { h: 'x', rev: 3, pos: 0, data: { id: 't1' }, deleted: true } };
    const [change] = diffItems(base, explodeStore(TASKS, [{ id: 't1', v: 2 }])).changes;
    assert.equal(change.op, 'update');
    assert.equal(change.baseRev, 3);
  });

  it('flags a write of a version a remote change replaced as stale', () => {
    const v1 = { id: 'n1', d: 'v1' };
    const base = { n1: { h: hashOf({ id: 'n1', d: 'v2' }), rev: 2, pos: 0, data: { id: 'n1', d: 'v2' }, deleted: false, sup: hashOf(v1) }, n2: { h: 'y', rev: 1, pos: 1, data: { id: 'n2' }, deleted: false, sup: ABSENT } };
    const result = diffItems(base, explodeStore(TASKS, [v1]));
    assert.deepEqual(result.changes, []);
    assert.deepEqual(result.stale.sort(), ['n1', 'n2']);
    const live = diffItems(base, explodeStore(TASKS, [v1]), { staleCheck: false });
    assert.deepEqual(live.changes.map((c) => c.op).sort(), ['delete', 'update']);
  });

  it('local-only records are never changes', () => {
    const base = { c1: { lo: true, h: hashOf({ id: 'c1' }) } };
    const result = diffItems(base, explodeStore(TASKS, [{ id: 'c1', name: 'edited' }]));
    assert.deepEqual(result.changes, []);
    assert.deepEqual(result.localOnly, ['c1']);
  });
});

describe('itemDiff — keyed lists (records by key, e.g. diary days)', () => {
  const DIARY = { key: 'pm-site-diary', scope: 'project', lists: [{ path: 'days', keyed: true }] };
  const value = { days: { '2026-10-25': { weather: 'sunny' }, '2026-10-26': { weather: 'dust' } }, settings: { shift: 8 } };

  it('makes one item per key and leaves an empty object in the document', () => {
    const items = explodeStore(DIARY, value);
    assert.deepEqual([...items.keys()].sort(), ['$doc', 'days/2026-10-25', 'days/2026-10-26']);
    assert.deepEqual(items.get(DOC_ITEM).data, { days: {}, settings: { shift: 8 } });
  });

  it('two days changed on two devices are two separate changes', () => {
    const base = baseFrom(DIARY, value);
    const edited = { ...value, days: { ...value.days, '2026-10-26': { weather: 'rain' }, '2026-10-27': { weather: 'clear' } } };
    const { changes } = diffItems(base, explodeStore(DIARY, edited));
    assert.deepEqual(changes.map((c) => [c.key, c.op]).sort(), [
      ['days/2026-10-26', 'update'],
      ['days/2026-10-27', 'insert'],
    ]);
  });

  it('round-trips and applies by key', () => {
    const items = new Map([...explodeStore(DIARY, value)].map(([k, it]) => [k, { data: it.data }]));
    assert.deepEqual(materialize(DIARY, items), value);
    const next = applyItems(DIARY, value, [
      { key: 'days/2026-10-25', deleted: true },
      { key: 'days/2026-10-28', data: { weather: 'wind' } },
      { key: DOC_ITEM, data: { days: {}, settings: { shift: 10 } } },
    ]);
    assert.deepEqual(next, { days: { '2026-10-26': { weather: 'dust' }, '2026-10-28': { weather: 'wind' } }, settings: { shift: 10 } });
  });
});

describe('itemDiff — materialize and apply', () => {
  it('round-trips a store through its items', () => {
    const value = { orders: [{ id: 'o2' }, { id: 'o1' }], lastWhoByType: { a: 1 } };
    const items = new Map([...explodeStore(ORDERS, value)].map(([k, it]) => [k, { data: it.data, pos: it.index }]));
    assert.deepEqual(materialize(ORDERS, items), value);
    assert.deepEqual(materialize(TASKS, { t2: { data: { id: 't2' }, pos: 1 }, t1: { data: { id: 't1' }, pos: 0 }, t3: { data: { id: 't3' }, pos: 2, deleted: true } }), [{ id: 't1' }, { id: 't2' }]);
    assert.equal(materialize(TASKS, {}).length, 0);
  });

  it('replaces, removes and places records by position', () => {
    const pos = { t1: 0, t2: 1, t4: 3 };
    const value = [{ id: 't1' }, { id: 't2', v: 1 }, { id: 't4' }];
    const next = applyItems(
      TASKS,
      value,
      [
        { key: 't2', data: { id: 't2', v: 2 }, pos: 1 },
        { key: 't3', data: { id: 't3' }, pos: 2 },
        { key: 't1', deleted: true },
      ],
      (k) => pos[k]
    );
    assert.deepEqual(next, [{ id: 't2', v: 2 }, { id: 't3' }, { id: 't4' }]);
    assert.deepEqual(value[1], { id: 't2', v: 1 }, 'the input is not changed');
  });

  it('a new $doc keeps the lists already in the store', () => {
    const value = { orders: [{ id: 'o1' }], lastWhoByType: { a: 1 } };
    const next = applyItems(ORDERS, value, [{ key: DOC_ITEM, data: { orders: [], lastWhoByType: { b: 2 } } }]);
    assert.deepEqual(next, { orders: [{ id: 'o1' }], lastWhoByType: { b: 2 } });
  });

  it('a store without lists takes the new document', () => {
    assert.deepEqual(applyItems(CONFIG, { units: [] }, [{ key: DOC_ITEM, data: { units: ['m3'] } }]), { units: ['m3'] });
  });
});

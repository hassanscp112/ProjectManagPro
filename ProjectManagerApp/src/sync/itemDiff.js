// ─────────────────────────────────────────────────────────────
// itemDiff — a store's value ⇄ items (one per record), and what changed.
// Pure: no storage, no browser.
//
// A store (utils/storeRegistry entry) is split into items:
//   - each record of each list in `lists` → item '<path>/<id>', or just
//     '<id>' when the stored value is the list itself (path '');
//   - everything outside the lists → item '$doc' (the lists inside it are
//     left as empty arrays, so the shape survives a round trip).
// A store without lists is one '$doc' item. A list whose records lack
// unique ids stays inside '$doc'. A list marked `keyed: true` in the
// registry is an object of records by key (days by date …): each key is an
// item '<path>/<key>' and '$doc' keeps an empty object there.
//
// List order travels as `pos`: a new record gets a number between its
// neighbours' positions; existing records keep theirs (reordering an
// existing record is not synced).
//
// The device keeps a base per item — the server's version as this device
// last knew it: { h, rev, pos, data, deleted, by, pending?, sup?, lo? }
//   h        hash of data
//   rev      server rev (or this device's provisional rev while pending)
//   by       who first recorded it (server), for the approval rule
//   pending  a local change is queued (outbox)
//   sup      hash of the version a remote change replaced (ABSENT for a
//            remote insert) — a screen still holding that version may write
//            it back; such a write is not a real change (see diffItems)
//   lo       local only: kept on this device, never pushed
// ─────────────────────────────────────────────────────────────

export const DOC_ITEM = '$doc';
export const ABSENT = '∅';

/* ── stable JSON + hash ───────────────────────────────────────────────────── */

/** JSON with object keys sorted (undefined dropped, like JSON.stringify). */
export const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') {
    const json = JSON.stringify(value);
    return json === undefined ? 'null' : json;
  }
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`;
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined && typeof value[k] !== 'function')
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
};

// cyrb53 — a fast 53-bit string hash (equality checks, not security).
const cyrb53 = (str) => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

/** Hash of a value (same for equal values whatever the key order). */
export const hashOf = (value) => `${cyrb53(stableStringify(value))}`;

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

/* ── paths inside a stored value ──────────────────────────────────────────── */

export const getPath = (obj, path) => {
  if (!path) return obj;
  return path.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), obj);
};

/** A copy of `obj` with `value` at `path` (objects along the path are copied). */
export const setPath = (obj, path, value) => {
  if (!path) return value;
  const [head, ...rest] = path.split('.');
  const base = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  return { ...base, [head]: rest.length ? setPath(base[head], rest.join('.'), value) : value };
};

/* ── item keys ────────────────────────────────────────────────────────────── */

export const itemKey = (path, id) => (path ? `${path}/${id}` : String(id));

/** Which list (or the doc) an item key belongs to: { doc } | { path, id } | null. */
export const parseItemKey = (entry, key) => {
  if (key === DOC_ITEM) return { doc: true };
  const lists = entry?.lists || [];
  const named = lists.find((l) => l.path && key.startsWith(`${l.path}/`));
  if (named) return { path: named.path, id: key.slice(named.path.length + 1), idField: named.idField };
  const root = lists.find((l) => l.path === '');
  if (root) return { path: '', id: key, idField: root.idField };
  return null;
};

/** The list part of a key ('' for a root list, '$doc' for the doc). */
export const partOfKey = (entry, key) => {
  const parsed = parseItemKey(entry, key);
  if (!parsed) return null;
  return parsed.doc ? DOC_ITEM : parsed.path;
};

/* ── value → items ────────────────────────────────────────────────────────── */

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const splittable = (arr, idField) => {
  const seen = new Set();
  for (const record of arr) {
    if (!record || typeof record !== 'object') return false;
    const id = record[idField];
    if ((typeof id !== 'string' && typeof id !== 'number') || id === '') return false;
    if (seen.has(String(id))) return false;
    seen.add(String(id));
  }
  return true;
};

/**
 * Split a store value into items: Map key → { data, path, index }.
 * `path` is the list ('' root, null for the doc), `index` the place in it.
 */
export const explodeStore = (entry, value) => {
  const items = new Map();
  if (value === undefined || value === null) return items;
  const lists = entry?.lists || [];
  const addList = (list, arr) =>
    arr.forEach((record, index) => {
      items.set(itemKey(list.path, record[list.idField]), { data: record, path: list.path, index });
    });

  const root = lists.find((l) => l.path === '');
  if (root) {
    if (Array.isArray(value) && splittable(value, root.idField)) addList(root, value);
    else items.set(DOC_ITEM, { data: value, path: null, index: 0 });
    return items;
  }
  if (lists.length === 0 || typeof value !== 'object' || Array.isArray(value)) {
    items.set(DOC_ITEM, { data: value, path: null, index: 0 });
    return items;
  }
  let rest = value;
  lists.forEach((list) => {
    const node = getPath(value, list.path);
    if (list.keyed) {
      if (!isPlainObject(node)) return;
      Object.entries(node).forEach(([key, record]) => {
        items.set(itemKey(list.path, key), { data: record, path: list.path, index: null });
      });
      rest = setPath(rest, list.path, {});
      return;
    }
    if (!Array.isArray(node) || !splittable(node, list.idField)) return;
    addList(list, node);
    rest = setPath(rest, list.path, []);
  });
  items.set(DOC_ITEM, { data: rest, path: null, index: 0 });
  return items;
};

/* ── positions ────────────────────────────────────────────────────────────── */

/**
 * Positions for the keys (in list order) that have none yet: between the
 * nearest known neighbours, after the last known one, or counting from 0.
 */
export const assignPositions = (orderedKeys, posOf) => {
  const out = new Map();
  const n = orderedKeys.length;
  const nextKnown = new Array(n);
  let next;
  for (let i = n - 1; i >= 0; i -= 1) {
    nextKnown[i] = next;
    const p = posOf(orderedKeys[i]);
    if (p !== undefined && p !== null) next = p;
  }
  let prev;
  for (let i = 0; i < n; i += 1) {
    let p = posOf(orderedKeys[i]);
    if (p === undefined || p === null) {
      const after = nextKnown[i];
      if (prev !== undefined && after !== undefined && after > prev) p = (prev + after) / 2;
      else if (prev !== undefined) p = prev + 1;
      else if (after !== undefined) p = after - 1;
      else p = 0;
      out.set(orderedKeys[i], p);
    }
    prev = p;
  }
  return out;
};

const keysByList = (current) => {
  const lists = new Map();
  current.forEach((item, key) => {
    if (item.path === null || item.path === undefined || item.index === null) return; // doc / keyed: no order
    if (!lists.has(item.path)) lists.set(item.path, []);
    lists.get(item.path).push([item.index, key]);
  });
  return [...lists.values()].map((pairs) => pairs.sort((a, b) => a[0] - b[0]).map((p) => p[1]));
};

/* ── what changed ─────────────────────────────────────────────────────────── */

/**
 * Compare a store's current items with the base.
 * Returns { changes, stale, localOnly }:
 *   changes   [{ key, op: 'insert' | 'update' | 'delete', before, after, pos, baseRev, hash }]
 *   stale     keys whose local version is one a remote change replaced (or
 *             a remote insert that vanished) — a screen wrote old data back
 *   localOnly keys of local-only items whose data changed or vanished
 * With `staleCheck` off (stores every screen re-reads live) nothing is stale.
 */
export const diffItems = (base, current, { staleCheck = true } = {}) => {
  const changes = [];
  const stale = [];
  const localOnly = [];
  const known = (key) => base[key] && !base[key].lo;
  const positions = new Map();
  keysByList(current).forEach((keys) => {
    assignPositions(keys, (key) => (known(key) ? base[key].pos : undefined)).forEach((pos, key) => positions.set(key, pos));
  });

  current.forEach((item, key) => {
    const b = base[key];
    const hash = hashOf(item.data);
    if (b?.lo) {
      if (b.h !== hash) localOnly.push(key);
      return;
    }
    if (!b) {
      changes.push({ key, op: 'insert', before: null, after: item.data, pos: positions.get(key) ?? null, baseRev: 0, hash });
      return;
    }
    if (b.deleted) {
      if (staleCheck && b.sup === hash) {
        stale.push(key);
        return;
      }
      changes.push({ key, op: 'update', before: null, after: item.data, pos: b.pos ?? positions.get(key) ?? null, baseRev: b.rev, hash });
      return;
    }
    if (b.h === hash) return;
    if (staleCheck && b.sup === hash) {
      stale.push(key);
      return;
    }
    changes.push({ key, op: 'update', before: b.data, after: item.data, pos: b.pos ?? null, baseRev: b.rev, hash });
  });

  Object.entries(base).forEach(([key, b]) => {
    if (current.has(key) || b.deleted) return;
    if (b.lo) {
      localOnly.push(key);
      return;
    }
    if (staleCheck && b.sup === ABSENT) {
      stale.push(key);
      return;
    }
    changes.push({ key, op: 'delete', before: b.data, after: null, pos: b.pos ?? null, baseRev: b.rev, hash: null });
  });
  return { changes, stale, localOnly };
};

/* ── items → value ────────────────────────────────────────────────────────── */

const byPos = (a, b) => (a.pos ?? 0) - (b.pos ?? 0) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/** Build a store value from items (Map or object of key → { data, pos, deleted }). */
export const materialize = (entry, items) => {
  const all = items instanceof Map ? [...items.entries()] : Object.entries(items || {});
  const live = all.filter(([, it]) => it && !it.deleted && !it.lo).map(([key, it]) => ({ key, ...it }));
  const doc = live.find((it) => it.key === DOC_ITEM);
  const lists = entry?.lists || [];
  const root = lists.find((l) => l.path === '');
  if (root) {
    if (doc && !live.some((it) => it.key !== DOC_ITEM)) return clone(doc.data);
    return live.filter((it) => it.key !== DOC_ITEM).sort(byPos).map((it) => clone(it.data));
  }
  if (lists.length === 0) return doc ? clone(doc.data) : null;
  let value = doc ? clone(doc.data) : {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  lists.forEach((list) => {
    const records = live.filter((it) => it.key !== DOC_ITEM && parseItemKey(entry, it.key)?.path === list.path).sort(byPos);
    if (list.keyed) {
      if (records.length > 0 || isPlainObject(getPath(value, list.path))) {
        value = setPath(value, list.path, Object.fromEntries(records.map((it) => [parseItemKey(entry, it.key).id, clone(it.data)])));
      }
      return;
    }
    if (records.length > 0 || Array.isArray(getPath(value, list.path))) {
      value = setPath(value, list.path, records.map((it) => clone(it.data)));
    }
  });
  if (!doc && live.length === 0) return null;
  return value;
};

/**
 * Put item versions into a store value, keeping everything else as it is.
 * updates: [{ key, data, deleted, pos }]; posOf(key) gives the position of
 * records already in the value (from the base). A new record is placed
 * before the first record with a higher position.
 */
export const applyItems = (entry, value, updates, posOf = () => undefined) => {
  const lists = entry?.lists || [];
  const root = lists.find((l) => l.path === '');
  const docUpdate = updates.filter((u) => u.key === DOC_ITEM).pop();

  if (lists.length === 0 || (root && docUpdate)) {
    if (!docUpdate) return value;
    return docUpdate.deleted ? null : clone(docUpdate.data);
  }

  const placeIn = (arr, list, recordUpdates) => {
    const next = Array.isArray(arr) ? [...arr] : [];
    recordUpdates.forEach((u) => {
      const id = parseItemKey(entry, u.key).id;
      const at = next.findIndex((r) => r && String(r[list.idField]) === id);
      if (u.deleted) {
        if (at >= 0) next.splice(at, 1);
        return;
      }
      if (at >= 0) {
        next[at] = clone(u.data);
        return;
      }
      const pos = u.pos ?? Number.POSITIVE_INFINITY;
      const before = next.findIndex((r) => {
        const p = r ? posOf(itemKey(list.path, r[list.idField])) : undefined;
        return p !== undefined && p !== null && p > pos;
      });
      if (before >= 0) next.splice(before, 0, clone(u.data));
      else next.push(clone(u.data));
    });
    return next;
  };

  if (root) {
    const recordUpdates = updates.filter((u) => u.key !== DOC_ITEM);
    return placeIn(Array.isArray(value) ? value : [], root, recordUpdates);
  }

  let obj = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  if (docUpdate && !docUpdate.deleted) {
    let doc = clone(docUpdate.data) || {};
    lists.forEach((list) => {
      const kept = getPath(obj, list.path);
      if (list.keyed ? isPlainObject(kept) : Array.isArray(kept)) doc = setPath(doc, list.path, kept);
    });
    obj = doc;
  }
  lists.forEach((list) => {
    const recordUpdates = updates.filter((u) => u.key !== DOC_ITEM && parseItemKey(entry, u.key)?.path === list.path);
    if (recordUpdates.length === 0) return;
    if (list.keyed) {
      const map = { ...(isPlainObject(getPath(obj, list.path)) ? getPath(obj, list.path) : {}) };
      recordUpdates.forEach((u) => {
        const key = parseItemKey(entry, u.key).id;
        if (u.deleted) delete map[key];
        else map[key] = clone(u.data);
      });
      obj = setPath(obj, list.path, map);
      return;
    }
    obj = setPath(obj, list.path, placeIn(getPath(obj, list.path), list, recordUpdates));
  });
  return obj;
};

// The sync engine end to end in node: two (or three) devices, each with its
// own localStorage and sync database, against the in-memory fake server.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, orgScopeKey, projectScopeKey, selectBatch, sortResults, toPushPayload } from '../engine.js';
import { createMemoryDb } from '../localDb.js';
import { createFakeServer, memoryStorage } from './fakeServer.js';

const ORG = 'org-1';
const P = 'srv-1';
const LOCAL = { id: 'p1', serverId: P, name: 'Canal' };
const TASKS = 'project-manager-gantt-tasks';
const ORDERS = 'pm-orders';
const NOTES = 'project-manager-daily-reports';
const FINANCE = 'project-manager-finance-data';
const PEOPLE = 'pm-registries';
const keyOf = (base) => `pm-p:p1:${base}`;

const roles = () => ({
  admin: { org: 'admin', projects: { [P]: 'admin' } },
  pm: { org: 'pm', projects: { [P]: 'pm' } },
  office: { org: 'office', projects: { [P]: 'office' } },
  site: { org: 'site', projects: { [P]: 'site' } },
  viewer: { org: 'viewer', projects: { [P]: 'viewer' } },
});

const device = (server, user, role = server.roleOf?.(user)) => {
  const storage = memoryStorage();
  const db = createMemoryDb();
  const events = [];
  const notified = [];
  let clock = 0;
  const engine = createEngine({
    db,
    transport: server.transportFor(user),
    storage,
    notify: (key) => notified.push(key),
    emit: (e) => events.push(e),
    now: () => `2026-10-26T08:00:${String((clock += 1)).padStart(2, '0')}.000Z`,
    deviceId: () => `dev-${user}`,
  });
  const project = { key: projectScopeKey(P), kind: 'project', orgId: ORG, projectId: P, local: LOCAL, actor: { id: user, role } };
  const org = { key: orgScopeKey(ORG), kind: 'org', orgId: ORG, projectId: null, local: null, actor: { id: user, role } };
  const scopes = new Map([
    [project.key, project],
    [org.key, org],
  ]);
  const d = {
    user,
    storage,
    db,
    engine,
    events,
    notified,
    project,
    org,
    scopes,
    read: (base) => JSON.parse(storage.getItem(keyOf(base))),
    write: (base, value) => storage.setItem(keyOf(base), JSON.stringify(value)),
    readOrg: (base) => JSON.parse(storage.getItem(base)),
    writeOrg: (base, value) => storage.setItem(base, JSON.stringify(value)),
    diff: async () => (await engine.diffScope(project)) + (await engine.diffScope(org)),
    push: () => engine.push(user, scopes),
    pull: async () => (await engine.pullScope(project)) + (await engine.pullScope(org)),
    sync: async () => {
      await d.diff();
      await d.push();
      await d.pull();
    },
    outbox: () => db.outboxAll(),
  };
  return d;
};

const setup = () => {
  const r = roles();
  const server = createFakeServer(r);
  server.roleOf = (user) => r[user]?.projects?.[P];
  return server;
};

const task = (id, extra = {}) => ({ id, wbs: '1', name: `Task ${id}`, quantity: 10, ...extra });
const order = (id, extra = {}) => ({ id, type: 'excavation', family: 'value', tier: 'formal', status: 'recorded', quantity: 5, ...extra });

describe('sync engine — diff and outbox', () => {
  it('queues each changed record with the actor, the device and the time', async () => {
    const server = setup();
    const a = device(server, 'office');
    a.write(TASKS, [task('t1'), task('t2')]);
    assert.equal(await a.diff(), 2);
    const [first] = await a.outbox();
    assert.equal(first.collection, TASKS);
    assert.equal(first.key, 't1');
    assert.equal(first.op, 'insert');
    assert.equal(first.actorId, 'office');
    assert.equal(first.deviceId, 'dev-office');
    assert.match(first.clientAt, /^2026-10-26T08:00/);
    assert.equal(await a.diff(), 0, 'nothing new when nothing changed');

    a.write(TASKS, [task('t1', { quantity: 12 }), task('t2')]);
    assert.equal(await a.diff(), 1, 'only the edited record');
    const edit = (await a.outbox()).at(-1);
    assert.equal(edit.op, 'update');
    assert.equal(edit.before.quantity, 10);
    assert.equal(edit.data.quantity, 12);
    assert.equal(edit.baseRev, 1, 'based on the provisional version of this device');
  });

  it('pushes the queue and empties it; a chain of offline edits travels together', async () => {
    const server = setup();
    const a = device(server, 'office');
    a.write(TASKS, [task('t1')]);
    await a.diff();
    a.write(TASKS, [task('t1', { quantity: 11 })]);
    await a.diff();
    a.write(TASKS, [task('t1', { quantity: 12 })]);
    await a.diff();
    const counts = await a.push();
    assert.equal(counts.applied, 3);
    assert.deepEqual(await a.outbox(), []);
    assert.equal(server.item(ORG, P, TASKS, 't1').rev, 3);
    assert.equal(server.item(ORG, P, TASKS, 't1').data.quantity, 12);
    assert.equal(server.changes.filter((c) => c.item_id === 't1').length, 3, 'every version is in the history');
  });

  it('a record deleted locally is deleted on the server (and kept there)', async () => {
    const server = setup();
    const a = device(server, 'office');
    a.write(TASKS, [task('t1'), task('t2')]);
    await a.sync();
    a.write(TASKS, [task('t2')]);
    await a.sync();
    const row = server.item(ORG, P, TASKS, 't1');
    assert.equal(row.deleted, true);
    assert.equal(row.data.name, 'Task t1', 'the last data stays for a restore');
  });
});

describe('sync engine — pull', () => {
  it('writes what another device changed into the local store and announces it', async () => {
    const server = setup();
    const a = device(server, 'office');
    const b = device(server, 'pm');
    a.write(TASKS, [task('t1'), task('t2')]);
    await a.sync();
    await b.pull();
    assert.deepEqual(b.read(TASKS).map((t) => t.id), ['t1', 't2']);
    assert.ok(b.notified.includes(TASKS));
    assert.ok(b.events.some((e) => e.type === 'applied' && e.collection === TASKS && e.localProjectId === 'p1'));

    a.write(TASKS, [task('t1', { name: 'Dig' }), task('t2')]);
    await a.sync();
    await b.sync();
    assert.equal(b.read(TASKS)[0].name, 'Dig');
    assert.deepEqual(await b.outbox(), [], 'a pulled version is not sent back');
  });

  it('keeps list order: a new record lands between its neighbours', async () => {
    const server = setup();
    const a = device(server, 'office');
    const b = device(server, 'pm');
    a.write(TASKS, [task('t1'), task('t3')]);
    await a.sync();
    await b.sync();
    a.write(TASKS, [task('t1'), task('t2'), task('t3')]);
    await a.sync();
    await b.sync();
    assert.deepEqual(b.read(TASKS).map((t) => t.id), ['t1', 't2', 't3']);

    // orders are newest first
    a.write(ORDERS, { orders: [order('o1')], lastWhoByType: {} });
    await a.sync();
    await b.sync();
    a.write(ORDERS, { orders: [order('o2'), order('o1')], lastWhoByType: {} });
    await a.sync();
    await b.sync();
    assert.deepEqual(b.read(ORDERS).orders.map((o) => o.id), ['o2', 'o1']);
  });

  it('rebuilds a whole store on a device that never had it', async () => {
    const server = setup();
    const a = device(server, 'admin');
    a.write(FINANCE, { machinery: [{ id: 'm1', hours: 3 }], materials: [], pettyCash: [], payroll: [], extra: 'x' });
    await a.sync();
    const b = device(server, 'pm');
    await b.pull();
    assert.deepEqual(b.read(FINANCE), { machinery: [{ id: 'm1', hours: 3 }], materials: [], pettyCash: [], payroll: [], extra: 'x' });
  });
});

describe('sync engine — conflicts', () => {
  it('a stale edit loses (tie on rev); the device gets the winner, the server keeps both', async () => {
    const server = setup();
    const a = device(server, 'office');
    const b = device(server, 'pm');
    a.write(TASKS, [task('t1')]);
    await a.sync();
    await b.sync();
    // both edit offline
    a.write(TASKS, [task('t1', { name: 'A' })]);
    b.write(TASKS, [task('t1', { name: 'B' })]);
    await a.sync();
    await b.sync();
    assert.equal(server.item(ORG, P, TASKS, 't1').data.name, 'A');
    assert.equal(b.read(TASKS)[0].name, 'A', 'the losing device shows the winning version');
    const lost = server.changes.find((c) => c.outcome === 'rejected');
    assert.equal(lost.after.name, 'B', 'the losing version is kept');
    assert.equal(lost.note, 'conflict-lost:tie');
    assert.ok(b.events.some((e) => e.type === 'overruled'));
  });

  it('the device that made more versions wins', async () => {
    const server = setup();
    const a = device(server, 'office');
    const b = device(server, 'pm');
    a.write(TASKS, [task('t1')]);
    await a.sync();
    await b.sync();
    a.write(TASKS, [task('t1', { name: 'A' })]);
    await a.diff();
    b.write(TASKS, [task('t1', { name: 'B1' })]);
    await b.diff();
    b.write(TASKS, [task('t1', { name: 'B2' })]);
    await b.diff();
    await a.sync();
    await b.sync();
    assert.equal(server.item(ORG, P, TASKS, 't1').data.name, 'B2');
    await a.sync();
    assert.equal(a.read(TASKS)[0].name, 'B2');
  });

  it('approved beats recorded, whatever the revs', async () => {
    const server = setup();
    const site = device(server, 'site');
    const pm = device(server, 'pm');
    site.write(ORDERS, { orders: [order('o1')], lastWhoByType: {} });
    await site.sync();
    await pm.sync();
    // the PM approves offline while the site engineer keeps editing
    pm.write(ORDERS, { orders: [order('o1', { status: 'approved', approvedBy: 'PM' })], lastWhoByType: {} });
    await pm.diff();
    site.write(ORDERS, { orders: [order('o1', { quantity: 6 })], lastWhoByType: {} });
    await site.diff();
    site.write(ORDERS, { orders: [order('o1', { quantity: 7 })], lastWhoByType: {} });
    await site.diff();
    await site.sync();
    await pm.sync();
    assert.equal(server.item(ORG, P, ORDERS, 'orders/o1').data.status, 'approved');
    await site.sync();
    assert.equal(site.read(ORDERS).orders[0].status, 'approved');
  });
});

describe('sync engine — permissions on this device', () => {
  it("undoes a change the role may not make, without sending it", async () => {
    const server = setup();
    const office = device(server, 'office');
    office.write(TASKS, [task('t1')]);
    await office.sync();
    const viewer = device(server, 'viewer');
    await viewer.pull();
    viewer.write(TASKS, [task('t1', { name: 'Hacked' })]);
    await viewer.diff();
    assert.deepEqual(await viewer.outbox(), []);
    assert.equal(viewer.read(TASKS)[0].name, 'Task t1', 'the local store is put back');
    const denied = viewer.events.find((e) => e.type === 'denied');
    assert.equal(denied.reasons[0].reason, 'role');
  });

  it('nobody approves their own formal order', async () => {
    const server = setup();
    const office = device(server, 'office');
    office.write(ORDERS, { orders: [order('o1')], lastWhoByType: {} });
    await office.sync();
    office.write(ORDERS, { orders: [order('o1', { status: 'approved' })], lastWhoByType: {} });
    await office.diff();
    assert.deepEqual(await office.outbox(), []);
    assert.equal(office.read(ORDERS).orders[0].status, 'recorded');
    assert.equal(office.events.find((e) => e.type === 'denied').reasons[0].reason, 'ownRecord');

    const site = device(server, 'site');
    await site.pull();
    site.write(ORDERS, { orders: [order('o1', { status: 'approved' })], lastWhoByType: {} });
    await site.diff();
    assert.equal(site.events.find((e) => e.type === 'denied').reasons[0].reason, 'notApprover');

    const pm = device(server, 'pm');
    await pm.pull();
    pm.write(ORDERS, { orders: [order('o1', { status: 'approved' })], lastWhoByType: {} });
    await pm.sync();
    assert.equal(server.item(ORG, P, ORDERS, 'orders/o1').data.status, 'approved', 'someone else may');
  });

  it('a change the server refuses is undone too', async () => {
    const server = setup();
    const office = device(server, 'office');
    office.write(TASKS, [task('t1')]);
    await office.sync();
    server.setRole('office', P, 'site'); // demoted on the server; this device does not know yet
    office.write(TASKS, [task('t1', { name: 'Late edit' })]);
    await office.sync();
    assert.equal(office.read(TASKS)[0].name, 'Task t1');
    assert.equal(server.changes.at(-1).outcome, 'rejected', 'the refused version stays on record');
  });

  it("keeps data this device had before it was linked when the role may not share it", async () => {
    const server = setup();
    const site = device(server, 'site');
    site.writeOrg(PEOPLE, { contractors: [{ id: 'c1', name: 'Local contractor' }], teams: [], workers: [] });
    await site.sync();
    assert.equal(site.readOrg(PEOPLE).contractors[0].name, 'Local contractor', 'not removed');
    assert.equal(server.item(ORG, null, PEOPLE, 'contractors/c1'), null, 'not sent');
    assert.equal(site.events.filter((e) => e.type === 'denied').length, 0);
  });
});

describe('sync engine — safety', () => {
  it('a screen writing back an older version is not an edit (until the next navigation)', async () => {
    const server = setup();
    const a = device(server, 'admin');
    const b = device(server, 'pm');
    a.write(NOTES, [{ id: 'n1', details: 'v1' }]);
    await a.sync();
    await b.sync();
    a.write(NOTES, [{ id: 'n1', details: 'v2' }, { id: 'n2', details: 'new' }]);
    await a.sync();
    await b.pull();
    assert.equal(b.read(NOTES)[0].details, 'v2');
    // b's open screen still holds v1 and saves it
    b.write(NOTES, [{ id: 'n1', details: 'v1' }]);
    await b.sync();
    assert.equal(server.item(ORG, P, NOTES, 'n1').data.details, 'v2', 'the old version was not pushed');
    assert.equal(server.item(ORG, P, NOTES, 'n2').deleted, false, 'nor the missing new record deleted');
    assert.deepEqual(b.read(NOTES).map((n) => n.details), ['v2', 'new'], 'the store is put back');

    await b.engine.clearStaleMarks(); // the person navigated: screens re-read
    b.write(NOTES, [{ id: 'n1', details: 'v1' }, { id: 'n2', details: 'new' }]);
    await b.sync();
    assert.equal(server.item(ORG, P, NOTES, 'n1').data.details, 'v1', 'now it is a real edit');
  });

  it('a store emptied at once is put back instead of deleting everything', async () => {
    const server = setup();
    const a = device(server, 'office');
    a.write(TASKS, [1, 2, 3, 4, 5, 6].map((n) => task(`t${n}`)));
    await a.sync();
    a.write(TASKS, []);
    await a.sync();
    assert.equal(a.read(TASKS).length, 6);
    assert.equal([...server.items.values()].filter((r) => r.deleted).length, 0);
    assert.ok(a.events.some((e) => e.type === 'ignored' && e.reason === 'emptied'));
  });

  it('a store removed from storage is rebuilt from the base', async () => {
    const server = setup();
    const a = device(server, 'office');
    a.write(TASKS, [task('t1')]);
    await a.sync();
    a.storage.removeItem(keyOf(TASKS));
    await a.sync();
    assert.deepEqual(a.read(TASKS).map((t) => t.id), ['t1']);
    assert.equal(server.item(ORG, P, TASKS, 't1').deleted, false);
  });

  it('changes wait offline and go out later', async () => {
    const server = setup();
    const a = device(server, 'office');
    server.setOffline(true);
    a.write(TASKS, [task('t1')]);
    await a.diff();
    await assert.rejects(a.push());
    assert.equal((await a.outbox()).length, 1);
    server.setOffline(false);
    await a.push();
    assert.equal((await a.outbox()).length, 0);
    assert.ok(server.item(ORG, P, TASKS, 't1'));
  });

  it("another person's queued changes wait for them", async () => {
    const server = setup();
    const a = device(server, 'office');
    a.write(TASKS, [task('t1')]);
    await a.diff();
    await a.engine.push('someone-else', a.scopes);
    assert.equal((await a.outbox()).length, 1);
  });
});

describe('sync engine — import and restore', () => {
  it("imports a device's history as it is (approved formal orders included)", async () => {
    const server = setup();
    const admin = device(server, 'admin');
    admin.project.importing = true;
    admin.write(ORDERS, { orders: [order('old', { status: 'approved' })], lastWhoByType: {} });
    await admin.sync();
    const row = server.item(ORG, P, ORDERS, 'orders/old');
    assert.equal(row.data.status, 'approved');
    assert.equal(row.recorded_by, null, 'recorder unknown');
    assert.equal(server.changes.at(-1).op, 'import');
  });

  it('restoring a version writes it locally and queues it as a restore', async () => {
    const server = setup();
    const a = device(server, 'office');
    a.write(TASKS, [task('t1', { quantity: 10 })]);
    await a.sync();
    a.write(TASKS, [task('t1', { quantity: 99 })]);
    await a.sync();
    const result = await a.engine.applyLocalVersion(a.project, TASKS, 't1', { data: task('t1', { quantity: 10 }) }, { restoredFrom: 1 });
    assert.equal(result.ok, true);
    assert.equal(a.read(TASKS)[0].quantity, 10);
    const [queued] = await a.outbox();
    assert.equal(queued.op, 'restore');
    assert.equal(queued.restoredFrom, 1);
    await a.push();
    assert.equal(server.item(ORG, P, TASKS, 't1').data.quantity, 10);
    assert.equal(server.changes.at(-1).op, 'restore');
  });

  it('a restore the role may not make is refused', async () => {
    const server = setup();
    const office = device(server, 'office');
    office.write(TASKS, [task('t1')]);
    await office.sync();
    const site = device(server, 'site');
    await site.pull();
    const result = await site.engine.applyLocalVersion(site.project, TASKS, 't1', { data: task('t1', { name: 'x' }) });
    assert.deepEqual(result, { ok: false, reason: 'role' });
  });
});

describe('sync engine — push helpers', () => {
  it('keeps every version of a record in the same batch', () => {
    const entries = Array.from({ length: 200 }, (_, i) => ({ seq: i + 1, scopeKey: 's', collection: 'c', key: i === 199 ? 'k0' : `k${i}` }));
    const batch = selectBatch(entries);
    assert.equal(batch.length, 151);
    assert.equal(batch.at(-1).seq, 200);
  });

  it('sorts results into done, retry and the last result per record', () => {
    const batch = [
      { seq: 1, scopeKey: 's', collection: 'c', key: 'a' },
      { seq: 2, scopeKey: 's', collection: 'c', key: 'a' },
      { seq: 3, scopeKey: 's', collection: 'c', key: 'b', attempts: 4 },
    ];
    const { done, retry, finals, counts } = sortResults(batch, [
      { k: 1, status: 'applied', item: { rev: 1 } },
      { k: 2, status: 'rejected', item: { rev: 3 } },
      { k: 3, status: 'error', message: 'boom' },
    ]);
    assert.deepEqual(done, [1, 2]);
    assert.equal(retry[0].failed, true, 'gives up after five attempts');
    assert.equal(finals.get('s|c|a').result.status, 'rejected');
    assert.deepEqual(counts, { applied: 1, same: 0, rejected: 1, denied: 0, error: 1 });
  });

  it('sends deletions without data', () => {
    const payload = toPushPayload({ seq: 7, orgId: 'o', projectId: 'p', collection: 'c', key: 'k', op: 'delete', data: { a: 1 }, deleted: true, baseRev: 2, rev: 3 });
    assert.equal(payload.data, null);
    assert.equal(payload.k, 7);
    assert.equal(payload.base_rev, 2);
  });
});

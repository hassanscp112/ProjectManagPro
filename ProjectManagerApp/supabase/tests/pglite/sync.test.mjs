// The app's sync code against the real schema: src/sync/transport.js and
// src/sync/engine.js (unchanged) talk to the migrations running in PGlite
// through a supabase-js stand-in (pgliteClient.mjs). Two devices, real
// row-level security, real conflict rules. Run: npm run test:db.

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine, orgScopeKey, projectScopeKey } from '../../../src/sync/engine.js';
import { pullFiles, pushFiles } from '../../../src/sync/files.js';
import { createMemoryDb } from '../../../src/sync/localDb.js';
import { createSupabaseTransport } from '../../../src/sync/transport.js';
import { addUser, createPgliteClient, createTestDatabase } from './pgliteClient.mjs';

const USERS = {
  admin: { id: 'c0000000-0000-0000-0000-000000000001', email: 'admin@test.local', name: 'Amal Admin' },
  pm: { id: 'c0000000-0000-0000-0000-000000000002', email: 'pm@test.local', name: 'Pat PM' },
  site: { id: 'c0000000-0000-0000-0000-000000000003', email: 'site@test.local', name: 'Sara Site' },
  acct: { id: 'c0000000-0000-0000-0000-000000000004', email: 'acct@test.local', name: 'Ali Accounts' },
};
const LOCAL = { id: 'p1', name: 'Canal' };
const TASKS = 'project-manager-gantt-tasks';
const ORDERS = 'pm-orders';
const keyOf = (base) => `pm-p:p1:${base}`;
const here = path.dirname(fileURLToPath(import.meta.url));

const memoryStorage = () => {
  const data = {};
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => (data[k] = String(v)), removeItem: (k) => delete data[k] };
};

let db;
let org;
let project;
const transports = {};

const device = (who) => {
  const transport = transports[who];
  const storage = memoryStorage();
  const local = createMemoryDb();
  const events = [];
  const engine = createEngine({ db: local, transport, storage, emit: (e) => events.push(e), deviceId: () => `dev-${who}` });
  const access = { role: null, orgRole: null };
  const scopes = () => {
    const p = { key: projectScopeKey(project), kind: 'project', orgId: org, projectId: project, local: { ...LOCAL, serverId: project }, actor: { id: USERS[who].id, role: access.role } };
    const o = { key: orgScopeKey(org), kind: 'org', orgId: org, projectId: null, local: null, actor: { id: USERS[who].id, role: access.orgRole } };
    return new Map([
      [p.key, p],
      [o.key, o],
    ]);
  };
  const d = {
    storage,
    local,
    events,
    engine,
    transport,
    refresh: async () => {
      const a = await transport.myAccess();
      access.role = a.projects.find((p) => p.id === project)?.role || null;
      access.orgRole = a.orgs[0]?.role || null;
      return a;
    },
    write: (base, value) => storage.setItem(keyOf(base), JSON.stringify(value)),
    read: (base) => JSON.parse(storage.getItem(keyOf(base))),
    sync: async () => {
      await d.refresh();
      const all = scopes();
      for (const s of all.values()) await engine.diffScope(s);
      await engine.push(USERS[who].id, all);
      for (const s of all.values()) await engine.pullScope(s);
    },
    scope: () => scopes().get(projectScopeKey(project)),
  };
  return d;
};

const order = (id, extra = {}) => ({ id, type: 'excavation', family: 'value', tier: 'formal', status: 'recorded', quantity: 5, ...extra });

before(async () => {
  db = await createTestDatabase();
  for (const user of Object.values(USERS)) await addUser(db, user);
  for (const [who, user] of Object.entries(USERS)) transports[who] = createSupabaseTransport(createPgliteClient(db, user.id));
  const admin = transports.admin;
  assert.equal((await admin.serverInfo()).has_org, false);
  org = await admin.bootstrapOrg('Test company');
  const created = await admin.createProject({ orgId: org, name: 'Canal', contract: 'C5', location: '', startDate: '2026-01-01', localId: 'p1' });
  project = created.id;
  assert.equal(created.role, 'admin');
  assert.equal((await admin.inviteMember({ orgId: org, serverId: project, email: USERS.pm.email, role: 'pm' })).status, 'added');
  await admin.inviteMember({ orgId: org, serverId: project, email: USERS.site.email, role: 'site' });
  await admin.inviteMember({ orgId: org, serverId: project, email: USERS.acct.email, role: 'accountant' });
});

describe('client ⇄ real schema (PGlite)', () => {
  it('my_access gives the organization and the role per project', async () => {
    const access = await transports.site.myAccess();
    assert.equal(access.user.name, 'Sara Site');
    assert.equal(access.orgs[0].role, 'site');
    assert.equal(access.projects[0].id, project);
    assert.equal(access.projects[0].role, 'site');
    assert.equal(access.projects[0].start_date, '2026-01-01');
  });

  it('lists members with their profile', async () => {
    const members = await transports.admin.listMembers(project);
    const pm = members.find((m) => m.role === 'pm');
    assert.equal(pm.profile.email, USERS.pm.email);
    assert.equal(members.length, 4);
  });

  it('a record pushed by one device reaches the other', async () => {
    const a = device('admin');
    const b = device('pm');
    a.write(TASKS, [{ id: 't1', wbs: '1', name: 'Dig', quantity: 10 }, { id: 't2', wbs: '2', name: 'Line', quantity: 4 }]);
    await a.sync();
    await b.sync();
    assert.deepEqual(b.read(TASKS).map((t) => t.name), ['Dig', 'Line']);
    a.write(TASKS, [{ id: 't1', wbs: '1', name: 'Dig deeper', quantity: 10 }, { id: 't2', wbs: '2', name: 'Line', quantity: 4 }]);
    await a.sync();
    await b.sync();
    assert.equal(b.read(TASKS)[0].name, 'Dig deeper');
    assert.deepEqual(await b.local.outboxAll(), []);
    const history = await transports.pm.changes({ orgId: org, projectId: project, collection: TASKS, itemIds: ['t1'] });
    assert.equal(history.length, 2);
    assert.equal(history[0].actor_name, 'Amal Admin');
    assert.equal(history[0].device_id, 'dev-admin');
    assert.equal(history[0].before.name, 'Dig');
  });

  it('the losing version of a conflict comes back and stays in the history', async () => {
    const a = device('admin');
    const b = device('pm');
    await a.sync();
    await b.sync();
    a.write(TASKS, [{ id: 't1', wbs: '1', name: 'From A', quantity: 10 }, { id: 't2', wbs: '2', name: 'Line', quantity: 4 }]);
    b.write(TASKS, [{ id: 't1', wbs: '1', name: 'From B', quantity: 10 }, { id: 't2', wbs: '2', name: 'Line', quantity: 4 }]);
    await a.sync();
    await b.sync();
    assert.equal(b.read(TASKS)[0].name, 'From A');
    const history = await transports.admin.changes({ orgId: org, projectId: project, collection: TASKS, itemIds: ['t1'], limit: 1 });
    assert.equal(history[0].outcome, 'rejected');
    assert.equal(history[0].after.name, 'From B');
    assert.ok(b.events.some((e) => e.type === 'overruled'));
  });

  it('a site engineer records work but cannot touch the plan, even bypassing the app check', async () => {
    const site = device('site');
    await site.sync();
    site.write(ORDERS, { orders: [order('o1')], lastWhoByType: {} });
    await site.sync();
    // straight to the server, as a modified app would
    const [result] = await transports.site.push([{ k: 1, org_id: org, project_id: project, collection: TASKS, item_id: 't1', op: 'update', data: { id: 't1', name: 'Hacked' }, base_rev: 99, rev: 100 }]);
    assert.equal(result.status, 'denied');
    assert.equal(result.item.data.name, 'From A', 'the device gets the real version back');
  });

  it('approval: never the recorder, approved beats a later recorded edit', async () => {
    const site = device('site');
    const pm = device('pm');
    await site.sync();
    await pm.sync();
    // the site engineer cannot approve (no right) — the app undoes it
    site.write(ORDERS, { orders: [order('o1', { status: 'approved' })], lastWhoByType: {} });
    await site.sync();
    assert.equal(site.read(ORDERS).orders[0].status, 'recorded');
    // the PM approves offline while the site engineer edits twice
    pm.write(ORDERS, { orders: [order('o1', { status: 'approved', approvedBy: 'Pat PM' })], lastWhoByType: {} });
    await pm.engine.diffScope(pm.scope());
    site.write(ORDERS, { orders: [order('o1', { quantity: 6 })], lastWhoByType: {} });
    await site.sync();
    site.write(ORDERS, { orders: [order('o1', { quantity: 7 })], lastWhoByType: {} });
    await site.sync();
    await pm.sync();
    await site.sync();
    assert.equal(site.read(ORDERS).orders[0].status, 'approved');
    assert.equal(pm.read(ORDERS).orders[0].status, 'approved');
  });

  it('an accountant cannot approve or edit site work', async () => {
    const acct = device('acct');
    await acct.sync();
    const [result] = await transports.acct.push([{ k: 1, org_id: org, project_id: project, collection: ORDERS, item_id: 'orders/o1', op: 'update', data: order('o1', { quantity: 1 }), base_rev: 1, rev: 2 }]);
    assert.equal(result.status, 'denied');
  });

  it('restoring a version is a new change naming the old one', async () => {
    const a = device('admin');
    await a.sync();
    const [first] = (await transports.admin.changes({ orgId: org, projectId: project, collection: TASKS, itemIds: ['t1'] })).slice(-1);
    const change = await transports.admin.change(first.id);
    assert.equal(change.after.name, 'Dig');
    const result = await a.engine.applyLocalVersion(a.scope(), TASKS, 't1', { data: change.after }, { restoredFrom: change.id });
    assert.equal(result.ok, true);
    await a.sync();
    const [latest] = await transports.admin.changes({ orgId: org, projectId: project, collection: TASKS, itemIds: ['t1'], limit: 1 });
    assert.equal(latest.op, 'restore');
    assert.equal(latest.restored_from, change.id);
    assert.equal(a.read(TASKS)[0].name, 'Dig');
  });

  it('files go up to storage and come down on another device', async () => {
    const site = device('site');
    const pm = device('pm');
    await site.sync();
    await pm.sync();
    const blob = new Blob(['photo-bytes'], { type: 'image/jpeg' });
    const files = [{ id: 'f1', folderId: 'order_photos', projectId: 'p1', orderId: 'o1', name: 'f1.jpg', size: blob.size, type: 'image/jpeg', blob, createdAt: '2026-10-26T08:00:00Z' }];
    await pushFiles({ engine: site.engine, transport: site.transport, db: site.local, scope: site.scope(), files });
    await site.sync();
    await pm.sync();
    const got = [];
    const result = await pullFiles({ engine: pm.engine, transport: pm.transport, db: pm.local, scope: pm.scope(), files: [], putFile: async (r) => got.push(r), removeFile: async () => {} });
    assert.equal(result.downloaded, 1);
    assert.equal(got[0].orderId, 'o1');
    assert.equal(await got[0].blob.text(), 'photo-bytes');
  });

  it('shared lists (people) sync at organization level for roles that may edit them', async () => {
    const pm = device('pm');
    const site = device('site');
    pm.storage.setItem('pm-registries', JSON.stringify({ contractors: [{ id: 'c1', name: 'Al-Rafidain' }], teams: [], workers: [] }));
    await pm.sync();
    await site.sync();
    assert.equal(JSON.parse(site.storage.getItem('pm-registries')).contractors[0].name, 'Al-Rafidain');
  });

  it('after-restore.sql re-stamps the pull cursor without touching the history', async () => {
    const before = (await db.query('select count(*)::int as n from public.changes')).rows[0].n;
    await db.exec(readFileSync(path.join(here, '..', '..', 'server', 'after-restore.sql'), 'utf8'));
    assert.equal((await db.query('select count(*)::int as n from public.changes')).rows[0].n, before, 'no history rows added');
    assert.equal((await db.query('select count(distinct txid)::int as n from public.items')).rows[0].n, 1);
    const all = await transports.pm.pull({ orgId: org, projectId: project }, { txid: '0', seq: 0 }, 1000);
    const last = all[all.length - 1];
    const a = device('admin');
    await a.sync();
    a.write(TASKS, [...a.read(TASKS), { id: 't-after', wbs: '9', name: 'After restore' }]);
    await a.sync();
    const next = await transports.pm.pull({ orgId: org, projectId: project }, last, 1000);
    assert.ok(next.some((r) => r.item_id === 't-after'), 'a write after the restore comes after the restored rows');
  });

  it('pull pages with the (txid, seq) cursor without repeats', async () => {
    const rows = await transports.pm.pull({ orgId: org, projectId: project }, { txid: '0', seq: 0 }, 2);
    assert.equal(rows.length, 2);
    const next = await transports.pm.pull({ orgId: org, projectId: project }, rows[1], 1000);
    assert.ok(next.every((r) => !rows.some((x) => x.item_id === r.item_id && x.seq === r.seq)));
  });
});

// Files: FileDB records ⇄ Storage objects + 'files' records, two devices.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, projectScopeKey } from '../engine.js';
import { fileMeta, pullFiles, pushFiles, storagePath } from '../files.js';
import { createMemoryDb } from '../localDb.js';
import { createFakeServer, memoryStorage } from './fakeServer.js';

const ORG = 'org-1';
const P = 'srv-1';
const LOCAL = { id: 'p1', serverId: P };

const device = (server, user, role) => {
  const db = createMemoryDb();
  const transport = server.transportFor(user);
  const engine = createEngine({ db, transport, storage: memoryStorage(), deviceId: () => `dev-${user}` });
  const scope = { key: projectScopeKey(P), kind: 'project', orgId: ORG, projectId: P, local: LOCAL, actor: { id: user, role } };
  const fileDb = new Map();
  const files = () => [...fileDb.values()];
  return {
    fileDb,
    scope,
    push: async () => {
      const r = await pushFiles({ engine, transport, db, scope, files: files() });
      await engine.push(user, new Map([[scope.key, scope]]));
      return r;
    },
    pull: async () => {
      await engine.pullScope(scope);
      return pullFiles({ engine, transport, db, scope, files: files(), putFile: async (rec) => fileDb.set(rec.id, rec), removeFile: async (id) => fileDb.delete(id) });
    },
  };
};

const photo = (id, extra = {}) => ({ id, folderId: 'order_photos', projectId: 'p1', name: `${id}.jpg`, size: 3, type: 'image/jpeg', blob: { size: 3, type: 'image/jpeg', bytes: id }, createdAt: '2026-10-26T08:00:00Z', ...extra });

describe('file sync', () => {
  it('keeps the details that travel with a file (not the bytes)', () => {
    const meta = fileMeta(photo('f1', { orderId: 'o1' }));
    assert.deepEqual(meta, { id: 'f1', folderId: 'order_photos', name: 'f1.jpg', size: 3, type: 'image/jpeg', createdAt: '2026-10-26T08:00:00Z', orderId: 'o1' });
    assert.equal(storagePath('srv-1', 'f1'), 'srv-1/f1');
  });

  it('uploads new photos and another device downloads them with the same id', async () => {
    const server = createFakeServer({ site: { projects: { [P]: 'site' } }, pm: { projects: { [P]: 'pm' } } });
    const site = device(server, 'site', 'site');
    site.fileDb.set('f1', photo('f1', { orderId: 'o1' }));
    assert.deepEqual(await site.push(), { uploaded: 1, removed: 0 });
    assert.ok(server.blobs.has('srv-1/f1'));
    assert.equal(server.item(ORG, P, 'files', 'f1').data.orderId, 'o1');
    assert.deepEqual(await site.push(), { uploaded: 0, removed: 0 }, 'nothing twice');

    const pm = device(server, 'pm', 'pm');
    const result = await pm.pull();
    assert.equal(result.downloaded, 1);
    const copy = pm.fileDb.get('f1');
    assert.equal(copy.projectId, 'p1');
    assert.equal(copy.orderId, 'o1');
    assert.equal(copy.blob.bytes, 'f1');
  });

  it('a file deleted on one device is removed from the others (its bytes stay on the server)', async () => {
    const server = createFakeServer({ site: { projects: { [P]: 'site' } }, pm: { projects: { [P]: 'pm' } } });
    const site = device(server, 'site', 'site');
    const pm = device(server, 'pm', 'pm');
    site.fileDb.set('f1', photo('f1'));
    await site.push();
    await pm.pull();
    pm.fileDb.delete('f1');
    assert.deepEqual(await pm.push(), { uploaded: 0, removed: 1 });
    assert.equal(server.item(ORG, P, 'files', 'f1').deleted, true);
    assert.ok(server.blobs.has('srv-1/f1'));
    const result = await site.pull();
    assert.equal(result.removed, 1);
    assert.equal(site.fileDb.has('f1'), false);
  });

  it('roles without files.edit keep their files on the device', async () => {
    const server = createFakeServer({ acct: { projects: { [P]: 'accountant' } } });
    const acct = device(server, 'acct', 'accountant');
    acct.fileDb.set('f9', photo('f9'));
    assert.deepEqual(await acct.push(), { uploaded: 0, removed: 0 });
    assert.equal(server.blobs.size, 0);
    assert.ok(acct.fileDb.has('f9'));
  });

  it("only the scope's project files", async () => {
    const server = createFakeServer({ site: { projects: { [P]: 'site' } } });
    const site = device(server, 'site', 'site');
    site.fileDb.set('other', photo('other', { projectId: 'p2' }));
    assert.deepEqual(await site.push(), { uploaded: 0, removed: 0 });
  });
});

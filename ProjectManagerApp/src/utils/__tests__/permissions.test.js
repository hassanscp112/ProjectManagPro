// permissions: the role matrix and the "never approve your own" rule.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, DEFAULT_ROLE, ROLES, actionsFor, can, canApproveRecord } from '../permissions.js';

describe('permissions', () => {
  it('lets every role read and only admins manage members', () => {
    ROLES.forEach((role) => assert.ok(can(role, 'read'), role));
    assert.deepEqual(ROLES.filter((r) => can(r, 'members.manage')), ['admin']);
  });

  it('follows the roadmap matrix', () => {
    assert.ok(can('office', 'plan.edit'));
    assert.ok(!can('office', 'plan.signOff'));
    assert.ok(can('site', 'record.work'));
    assert.ok(!can('site', 'orders.approve'));
    assert.ok(!can('site', 'plan.edit'));
    assert.ok(can('accountant', 'finance.edit'));
    assert.ok(!can('accountant', 'plan.edit'));
    assert.ok(can('accountant', 'certificates.prepare'));
    assert.ok(!can('accountant', 'certificates.issue'));
    assert.deepEqual(actionsFor('viewer'), ['read']);
  });

  it('refuses unknown roles and actions', () => {
    assert.ok(!can('guest', 'read'));
    assert.ok(!can('admin', 'nope'));
    assert.ok(!can(undefined, 'read'));
  });

  it('keeps every action list within the known roles', () => {
    Object.entries(ACTIONS).forEach(([action, roles]) => roles.forEach((r) => assert.ok(ROLES.includes(r), `${action}:${r}`)));
    assert.ok(ROLES.includes(DEFAULT_ROLE));
  });

  it('never lets a signed-in user approve their own record', () => {
    const pm = { id: 'u1', name: 'Ali', role: 'pm' };
    assert.ok(!canApproveRecord(pm, { recordedById: 'u1' }));
    assert.ok(canApproveRecord(pm, { recordedById: 'u2' }));
    assert.ok(!canApproveRecord(pm, { recordedBy: 'Ali' }));
    assert.ok(!canApproveRecord({ id: 'u3', name: 'Sara', role: 'site' }, { recordedById: 'u1' }));
  });

  it('keeps the single local user able to approve before accounts exist', () => {
    assert.ok(canApproveRecord({ id: null, name: 'Ali', role: 'admin' }, { recordedBy: 'Ali' }));
  });
});

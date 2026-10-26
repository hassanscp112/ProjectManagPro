// The conflict rule and the per-collection permission rules on the device.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickWinner, statusRank } from '../conflict.js';
import { canWriteVersion, checkChange, scopeOf, writeAction } from '../rules.js';

describe('conflict rule', () => {
  it('approved beats recorded whatever the revs', () => {
    assert.deepEqual(pickWinner({ data: { status: 'recorded' }, rev: 9 }, { data: { status: 'approved' }, rev: 2 }), { winner: 'incoming', reason: 'status' });
    assert.deepEqual(pickWinner({ data: { status: 'approved' }, rev: 2 }, { data: { status: 'recorded' }, rev: 9 }), { winner: 'current', reason: 'status' });
    assert.equal(statusRank({ status: 'issued' }), 2);
  });

  it('otherwise the higher rev wins and a tie keeps the server version', () => {
    assert.deepEqual(pickWinner({ data: { n: 1 }, rev: 2 }, { data: { n: 2 }, rev: 3 }), { winner: 'incoming', reason: 'rev' });
    assert.deepEqual(pickWinner({ data: { n: 1 }, rev: 3 }, { data: { n: 2 }, rev: 2 }), { winner: 'current', reason: 'rev' });
    assert.deepEqual(pickWinner({ data: { n: 1 }, rev: 2 }, { data: { n: 2 }, rev: 2 }), { winner: 'current', reason: 'tie' });
  });

  it('a deletion is judged by rev only', () => {
    assert.equal(pickWinner({ data: { status: 'approved' }, rev: 2 }, { data: null, deleted: true, rev: 3 }).winner, 'incoming');
    assert.equal(pickWinner({ data: { status: 'recorded' }, deleted: true, rev: 3 }, { data: { status: 'approved' }, rev: 2 }).winner, 'current');
  });
});

describe('collection rules', () => {
  it('maps each store and list to its action', () => {
    assert.equal(writeAction('project-manager-gantt-tasks', 't1', {}), 'plan.edit');
    assert.equal(writeAction('project-manager-project-meta', '$doc', {}), 'plan.signOff');
    assert.equal(writeAction('pm-orders', 'orders/o1', { family: 'value' }), 'record.work');
    assert.equal(writeAction('pm-orders', 'orders/o1', { family: 'expense' }), 'finance.edit');
    assert.equal(writeAction('pm-certificates', 'certificates/c1', { status: 'issued' }), 'certificates.issue');
    assert.equal(writeAction('pm-snapshots', '$doc', {}), null, 'unsynced stores have no rule');
    assert.equal(scopeOf('pm-registries'), 'org');
    assert.equal(scopeOf('pm-orders'), 'project');
  });

  it('follows the role matrix', () => {
    assert.ok(canWriteVersion('office', 'project-manager-gantt-tasks', 't1', {}));
    assert.ok(!canWriteVersion('site', 'project-manager-gantt-tasks', 't1', {}));
    assert.ok(canWriteVersion('accountant', 'pm-orders', 'orders/e1', { family: 'expense' }));
    assert.ok(!canWriteVersion('accountant', 'pm-orders', 'orders/v1', { family: 'value' }));
    assert.ok(canWriteVersion('accountant', 'pm-activity', 'e1', {}), 'everyone but viewers logs activity');
    assert.ok(!canWriteVersion('viewer', 'pm-activity', 'e1', {}));
    assert.ok(canWriteVersion('site', 'files', 'f1', {}));
    assert.ok(!canWriteVersion('accountant', 'files', 'f1', {}));
  });

  it('needs the right for the version before and after', () => {
    const actor = { id: 'u1', role: 'accountant' };
    const before = { id: 'o1', family: 'value' };
    const after = { id: 'o1', family: 'expense' };
    assert.deepEqual(checkChange(actor, { collection: 'pm-orders', key: 'orders/o1', before, after }), { ok: false, reason: 'role' });
  });

  it('approving a formal order needs an approver who did not record it', () => {
    const recorded = { id: 'o1', family: 'value', tier: 'formal', status: 'recorded' };
    const approved = { ...recorded, status: 'approved' };
    const args = (actor, extra = {}) => checkChange(actor, { collection: 'pm-orders', key: 'orders/o1', before: recorded, after: approved, recordedBy: 'u-site', ...extra });
    assert.deepEqual(args({ id: 'u-site', role: 'site' }), { ok: false, reason: 'notApprover' });
    assert.deepEqual(args({ id: 'u-pm', role: 'pm' }, { recordedBy: 'u-pm' }), { ok: false, reason: 'ownRecord' });
    assert.deepEqual(args({ id: 'u-pm', role: 'pm' }), { ok: true });
    assert.deepEqual(checkChange({ id: 'u', role: 'pm' }, { collection: 'pm-orders', key: 'orders/o1', before: null, after: approved }), { ok: false, reason: 'approveUnrecorded' });
    assert.deepEqual(checkChange({ id: 'u', role: 'pm' }, { collection: 'pm-orders', key: 'orders/o1', before: null, after: approved, importing: true }), { ok: true });
    const quick = { id: 'q1', family: 'value', tier: 'quick', status: 'approved' };
    assert.deepEqual(checkChange({ id: 'u', role: 'site' }, { collection: 'pm-orders', key: 'orders/q1', before: null, after: quick }), { ok: true }, 'quick orders are born approved');
  });

  it('an approved formal order is changed or deleted only by approvers', () => {
    const approved = { id: 'o1', family: 'value', tier: 'formal', status: 'approved', quantity: 1 };
    const site = { id: 'u-site', role: 'site' };
    assert.deepEqual(checkChange(site, { collection: 'pm-orders', key: 'orders/o1', before: approved, after: { ...approved, quantity: 2 } }), { ok: false, reason: 'notApprover' });
    assert.deepEqual(checkChange(site, { collection: 'pm-orders', key: 'orders/o1', before: approved, after: null }), { ok: false, reason: 'notApprover' });
  });
});

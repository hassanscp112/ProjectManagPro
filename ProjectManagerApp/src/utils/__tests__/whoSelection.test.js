import { test } from 'node:test';
import assert from 'node:assert/strict';
import { switchWhoKind, teamSizeOf, toggleWhoWorker } from '../WhoSelection.js';

const teams = [
  { id: 't1', memberWorkerIds: ['w1', 'w2'], defaultSize: 0 },
  { id: 't2', memberWorkerIds: ['w3'], defaultSize: 6 },
];

test('teamSizeOf prefers the manual default size, else member count', () => {
  assert.equal(teamSizeOf(teams[0]), 2);
  assert.equal(teamSizeOf(teams[1]), 6);
  assert.equal(teamSizeOf(undefined), 0);
});

test('switching to count derives the head count from workers or team', () => {
  assert.deepEqual(switchWhoKind({ kind: 'workers', workerIds: ['a', 'b', 'c'] }, 'count', teams), { kind: 'count', count: 3 });
  assert.deepEqual(switchWhoKind({ kind: 'team', teamId: 't2' }, 'count', teams), { kind: 'count', count: 6 });
  assert.deepEqual(switchWhoKind({ kind: 'none' }, 'count', teams), { kind: 'count', count: 0 });
});

test('workers matching a team roster preselect that team', () => {
  assert.deepEqual(switchWhoKind({ kind: 'workers', workerIds: ['w2', 'w1'] }, 'team', teams), { kind: 'team', teamId: 't1' });
  assert.deepEqual(switchWhoKind({ kind: 'workers', workerIds: ['w1'] }, 'team', teams), { kind: 'team' });
});

test('switching team → workers prefills the roster', () => {
  assert.deepEqual(switchWhoKind({ kind: 'team', teamId: 't1' }, 'workers', teams), { kind: 'workers', workerIds: ['w1', 'w2'] });
  assert.deepEqual(switchWhoKind({ kind: 'contractor', contractorId: 'c1' }, 'workers', teams), { kind: 'workers', workerIds: [] });
});

test('same kind is a no-op; contractor and none start empty', () => {
  const who = { kind: 'contractor', contractorId: 'c1' };
  assert.equal(switchWhoKind(who, 'contractor', teams), who);
  assert.deepEqual(switchWhoKind(who, 'none', teams), { kind: 'none' });
  assert.deepEqual(switchWhoKind(null, 'contractor', teams), { kind: 'contractor' });
});

test('toggleWhoWorker adds and removes, starting fresh from other kinds', () => {
  assert.deepEqual(toggleWhoWorker({ kind: 'workers', workerIds: ['a'] }, 'b'), { kind: 'workers', workerIds: ['a', 'b'] });
  assert.deepEqual(toggleWhoWorker({ kind: 'workers', workerIds: ['a', 'b'] }, 'a'), { kind: 'workers', workerIds: ['b'] });
  assert.deepEqual(toggleWhoWorker({ kind: 'team', teamId: 't1' }, 'x'), { kind: 'workers', workerIds: ['x'] });
});

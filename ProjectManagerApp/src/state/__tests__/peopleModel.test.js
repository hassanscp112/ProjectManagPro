import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAutoSized, sizePatch, syncAutoTeams, teamsUsingWorker, toggleMemberPatch } from '../peopleModel.js';

const auto = { id: 't1', memberWorkerIds: ['w1', 'w2'], defaultSize: 2, foremanWorkerId: null };
const manual = { id: 't2', memberWorkerIds: ['w1'], defaultSize: 10, foremanWorkerId: 'w3' };

test('automatic sizes follow members; manual sizes stay', () => {
  assert.equal(isAutoSized(auto), true);
  assert.deepEqual(toggleMemberPatch(auto, 'w3'), { memberWorkerIds: ['w1', 'w2', 'w3'], defaultSize: 3 });
  assert.deepEqual(toggleMemberPatch(auto, 'w1'), { memberWorkerIds: ['w2'], defaultSize: 1 });
  assert.deepEqual(toggleMemberPatch(manual, 'w2'), { memberWorkerIds: ['w1', 'w2'] });
});

test('size input: empty returns to automatic, numbers set it, junk is ignored', () => {
  assert.deepEqual(sizePatch(manual, ''), { defaultSize: 1 });
  assert.deepEqual(sizePatch(auto, '7'), { defaultSize: 7 });
  assert.deepEqual(sizePatch(auto, '-1'), { defaultSize: 2 });
});

test('after deleting a worker, automatic teams resize; usage count', () => {
  const after = [{ ...auto, memberWorkerIds: ['w2'] }, { ...manual, memberWorkerIds: [] }];
  assert.deepEqual(syncAutoTeams([auto, manual], after).map((t) => t.defaultSize), [1, 10]);
  assert.equal(teamsUsingWorker([auto, manual], 'w1'), 2);
  assert.equal(teamsUsingWorker([auto, manual], 'w3'), 1);
  assert.equal(teamsUsingWorker([auto, manual], 'w9'), 0);
});

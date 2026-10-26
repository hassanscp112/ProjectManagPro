// Unit tests for src/utils/SiteDiary.js and src/utils/Delays.js (node:test)
// with the in-memory localStorage shim. projectKey() falls back to the
// base key in node (no open project), the legacy behavior.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment } from './helpers.js';

installNodeTestEnvironment();

const { SITE_DIARY_STORAGE_KEY, getDiaryDay, isDiaryDayEmpty, loadSiteDiary, normalizeDiaryDay, putDiaryDay, removeDiaryDay, saveSiteDiary } =
  await import('../SiteDiary.js');
const { DELAYS_STORAGE_KEY, loadDelays, normalizeDelay, removeDelay, saveDelays, upsertDelay } = await import('../Delays.js');
const { storeFor } = await import('../storeRegistry.js');

const ali = { id: null, name: 'Ali', role: 'admin' };
const sara = { id: 'u2', name: 'Sara', role: 'site' };

beforeEach(() => localStorage.clear());

describe('SiteDiary', () => {
  it('is the registered owner of pm-site-diary', () => {
    assert.equal(storeFor(SITE_DIARY_STORAGE_KEY)?.owner, 'SiteDiary');
    assert.equal(storeFor(SITE_DIARY_STORAGE_KEY)?.scope, 'project');
  });

  it('normalizes a day: known weather, numbers, rows with content', () => {
    const d = normalizeDiaryDay({
      weather: 'snow',
      maxTemp: '46.5',
      hours: 30,
      manpower: [{ trade: ' Mason ', count: '3.4' }, { trade: '', count: 0 }, null],
      equipment: [{ type: 'Loader', count: -1 }],
      visitors: [{ name: '', org: '', purpose: '' }],
      issues: '  ',
    });
    assert.equal(d.weather, '');
    assert.equal(d.maxTemp, 46.5);
    assert.equal(d.hours, 24);
    assert.deepEqual(d.manpower.map(({ trade, count }) => ({ trade, count })), [{ trade: 'Mason', count: 3 }]);
    assert.deepEqual(d.equipment.map(({ type, count }) => ({ type, count })), [{ type: 'Loader', count: 0 }]);
    assert.deepEqual(d.visitors, []);
    assert.equal(d.issues, '');
    assert.equal(isDiaryDayEmpty({ issues: ' ' }), true);
    assert.equal(isDiaryDayEmpty({ maxTemp: 0 }), false);
  });

  it('stamps who recorded a day and who changed it last; an empty day is removed', () => {
    let diary = loadSiteDiary();
    assert.deepEqual(diary, { days: {} });
    diary = putDiaryDay(diary, '2026-10-26', { weather: 'dusty' }, ali, '2026-10-26T08:00:00Z');
    diary = putDiaryDay(diary, '2026-10-26', { ...getDiaryDay(diary, '2026-10-26'), hours: 9 }, sara, '2026-10-26T15:00:00Z');
    const day = getDiaryDay(diary, '2026-10-26');
    assert.equal(day.recordedBy, 'Ali');
    assert.equal(day.recordedAt, '2026-10-26T08:00:00Z');
    assert.equal(day.updatedBy, 'Sara');
    assert.equal(day.updatedById, 'u2');
    assert.equal(day.hours, 9);

    saveSiteDiary(diary);
    assert.deepEqual(loadSiteDiary(), diary);

    assert.equal(getDiaryDay(putDiaryDay(diary, '2026-10-26', { weather: '' }, ali), '2026-10-26'), null);
    assert.equal(getDiaryDay(removeDiaryDay(diary, '2026-10-26'), '2026-10-26'), null);
    assert.deepEqual(putDiaryDay(diary, 'not-a-day', { weather: 'rain' }, ali).days, diary.days);
  });

  it('survives corrupt storage', () => {
    localStorage.setItem(SITE_DIARY_STORAGE_KEY, '{broken');
    assert.deepEqual(loadSiteDiary(), { days: {} });
    localStorage.setItem(SITE_DIARY_STORAGE_KEY, JSON.stringify({ days: { bad: { weather: 'rain' }, '2026-10-01': 5 } }));
    assert.deepEqual(loadSiteDiary(), { days: {} });
  });
});

describe('Delays', () => {
  it('is the registered owner of pm-delays', () => {
    assert.equal(storeFor(DELAYS_STORAGE_KEY)?.owner, 'Delays');
    assert.deepEqual(storeFor(DELAYS_STORAGE_KEY)?.lists, [{ path: 'events', idField: 'id' }]);
  });

  it('normalizes an event', () => {
    const e = normalizeDelay({ title: ' Rain ', cause: 'aliens', start: '2026-10-05', end: '2026-10-01', taskIds: ['a', 'a', '', 3], daysClaimed: '4', status: 'maybe', extra: 1 });
    assert.ok(e.id);
    assert.equal(e.title, 'Rain');
    assert.equal(e.cause, 'other');
    assert.equal(e.end, '2026-10-05');
    assert.deepEqual(e.taskIds, ['a']);
    assert.equal(e.excusable, true);
    assert.equal(e.daysClaimed, 4);
    assert.equal(e.status, 'draft');
    assert.equal(e.daysGranted, 0);
    assert.equal(e.extra, 1);
    assert.equal(normalizeDelay({ excusable: false }).excusable, false);
  });

  it('records recordedBy from the actor, keeps it on edits, saves and removes', () => {
    let state = loadDelays();
    state = upsertDelay(state, { title: 'Late drawings', cause: 'design', start: '2026-10-01' }, sara, '2026-10-02T10:00:00Z');
    const [created] = state.events;
    assert.equal(created.recordedBy, 'Sara');
    assert.equal(created.recordedById, 'u2');
    assert.equal(created.createdAt, '2026-10-02T10:00:00Z');

    state = upsertDelay(state, { ...created, status: 'submitted', recordedBy: 'someone else' }, ali, '2026-10-03T10:00:00Z');
    assert.equal(state.events.length, 1);
    assert.equal(state.events[0].status, 'submitted');
    assert.equal(state.events[0].recordedBy, 'Sara');
    assert.equal(state.events[0].updatedBy, 'Ali');
    assert.equal(state.events[0].updatedAt, '2026-10-03T10:00:00Z');

    saveDelays(state);
    assert.deepEqual(loadDelays(), state);
    assert.deepEqual(removeDelay(state, created.id), { events: [] });
  });
});

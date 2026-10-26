import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventKindKey, feedActors, feedSummary, filterFeed } from '../reportsModel.js';

// Local feed entries as utils/ActivityLog buildUnifiedFeed makes them.
const feed = [
  { id: 'o1', kind: 'order', family: 'value', date: '2026-10-26', actor: 'Ali' },
  { id: 'o2', kind: 'order', family: 'expense', date: '2026-10-25', actor: 'Ali ' },
  { id: 'v1', kind: 'variation', family: '', date: '2026-10-20', actor: 'Sara' },
  { id: 'e1', kind: 'event', family: '', date: '2026-10-19', actor: 'Ali Hassan' },
  { id: 'e2', kind: 'event', family: '', date: '2026-10-01', actor: '' },
];
const ids = (list) => list.map((e) => e.id);

test('filterFeed: one person by exact name (the search still matches parts)', () => {
  assert.deepEqual(ids(filterFeed(feed, { person: 'Ali' })), ['o1', 'o2']);
  assert.deepEqual(ids(filterFeed(feed, { actor: 'ali' })), ['o1', 'o2', 'e1']);
  assert.deepEqual(ids(filterFeed(feed, { person: 'Ali', from: '2026-10-26', to: '2026-10-26' })), ['o1']);
  assert.deepEqual(ids(filterFeed(feed, { person: 'Sara', chip: 'variation' })), ['v1']);
});

test('feedActors: the names in the feed, once each, sorted', () => {
  assert.deepEqual(feedActors(feed), ['Ali', 'Ali Hassan', 'Sara']);
  assert.deepEqual(feedActors([null, {}]), []);
});

test('feedSummary: totals by kind and active days', () => {
  assert.deepEqual(feedSummary(feed), { total: 5, days: 5, orders: 2, value: 1, expense: 1, variations: 1, events: 2 });
  assert.deepEqual(feedSummary([]), { total: 0, days: 0, orders: 0, value: 0, expense: 0, variations: 0, events: 0 });
});

test('eventKindKey: app event kinds in words, unknown ones as a plain event', () => {
  assert.equal(eventKindKey('certificate'), 'activity.kind.certificate');
  assert.equal(eventKindKey('lifecycle'), 'activity.kind.lifecycle');
  assert.equal(eventKindKey('project'), 'activity.kind.project');
  assert.equal(eventKindKey('template'), 'activity.kind.template');
  assert.equal(eventKindKey('something-new'), 'activity.kind.other');
  assert.equal(eventKindKey(''), '');
});

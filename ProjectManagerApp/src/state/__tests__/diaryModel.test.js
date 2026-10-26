import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  copyDiaryDay,
  dayDiff,
  delayDays,
  delayErrors,
  delaysInMonth,
  delayTotals,
  diaryDaysInRange,
  diaryDraft,
  diaryTotals,
  equipmentSuggestions,
  filterDelays,
  manpowerFromPlan,
  noticeCheck,
  noticeWarns,
  previousDiaryDay,
  sortDelays,
  tradeSuggestions,
  unionDays,
} from '../diaryModel.js';

const noIds = (rows) => rows.map(({ id, ...rest }) => (assert.ok(id), rest));

const registries = {
  workers: [
    { id: 'w1', name: 'Ali', trade: 'Mason' },
    { id: 'w2', name: 'Hassan', trade: 'mason' },
    { id: 'w3', name: 'Omar', trade: 'Steel fixer' },
    { id: 'w4', name: 'Zaid', trade: '' },
  ],
  teams: [
    { id: 't1', name: 'Ali crew', memberWorkerIds: ['w1', 'w3'], defaultSize: 5 },
    { id: 't2', name: 'Empty crew', memberWorkerIds: [], defaultSize: 0 },
  ],
  contractors: [{ id: 'k1', name: 'Al-Rafidain Co.' }],
};

test('prefill: manpower by trade from the day plan crews', () => {
  const rows = manpowerFromPlan(
    [
      { id: 'a1', taskId: 'x', who: { kind: 'team', teamId: 't1' } }, // w1 mason, w3 steel fixer, +3 general
      { id: 'a2', taskId: 'y', who: { kind: 'workers', workerIds: ['w1', 'w2', 'w4'] } }, // w1 already counted
      { id: 'a3', taskId: 'z', who: { kind: 'count', count: 4 } },
      { id: 'a4', taskId: 'z', who: { kind: 'team', teamId: 't1' } }, // same team twice: once
      { id: 'a5', taskId: 'z', who: { kind: 'contractor', contractorId: 'k1' } },
      { id: 'a6', taskId: 'z', who: { kind: 'team', teamId: 'gone' } },
      { id: 'a7', taskId: 'z', who: { kind: 'count', count: 0 } },
    ],
    registries
  );
  assert.deepEqual(noIds(rows), [
    { trade: 'Mason', count: 2 }, // Mason + mason merge (case-insensitive)
    { trade: 'Steel fixer', count: 1 },
    { trade: '', count: 8 }, // 3 above the team's members + Zaid (no trade) + 4 head count
    { trade: 'Al-Rafidain Co.', count: 0 },
  ]);
  assert.deepEqual(manpowerFromPlan([], registries), []);
  assert.deepEqual(manpowerFromPlan(null, null), []);
});

test('prefill: the editor opens with the saved day, else the plan', () => {
  const plan = [{ id: 'a', taskId: 'x', who: { kind: 'count', count: 6 } }];
  const fresh = diaryDraft(null, plan, registries);
  assert.equal(fresh.prefilled, true);
  assert.deepEqual(noIds(fresh.draft.manpower), [{ trade: '', count: 6 }]);
  assert.equal(fresh.draft.weather, '');

  const saved = { weather: 'dusty', manpower: [{ id: 'm', trade: 'Driver', count: 2 }] };
  const opened = diaryDraft(saved, plan, registries);
  assert.equal(opened.prefilled, false);
  assert.deepEqual(opened.draft.manpower, [{ id: 'm', trade: 'Driver', count: 2 }]);

  const none = diaryDraft({ weather: '' }, [], registries);
  assert.equal(none.prefilled, false);
  assert.deepEqual(none.draft.manpower, []);
});

test('same as yesterday: copies the stable parts of the last recorded day', () => {
  const diary = {
    days: {
      '2026-10-20': { weather: 'rain', hours: 6, manpower: [], equipment: [], visitors: [], issues: 'x' },
      '2026-10-23': {
        weather: 'heat',
        maxTemp: 47,
        hours: 8,
        manpower: [{ id: 'm1', trade: 'Mason', count: 3 }],
        equipment: [{ id: 'e1', type: 'Excavator', count: 1 }],
        visitors: [{ id: 'v1', name: 'Engineer', org: 'Ministry', purpose: 'Inspection' }],
        issues: 'Water cut',
      },
      '2026-10-24': { weather: '', manpower: [], equipment: [], visitors: [], issues: '' }, // empty: skipped
      '2026-10-26': { weather: 'sunny' },
    },
  };
  assert.equal(previousDiaryDay(diary, '2026-10-25'), '2026-10-23');
  assert.equal(previousDiaryDay(diary, '2026-10-20'), '');
  assert.equal(previousDiaryDay({ days: {} }, '2026-10-20'), '');

  const copy = copyDiaryDay(diary.days['2026-10-23']);
  assert.equal(copy.weather, 'heat');
  assert.equal(copy.maxTemp, 47);
  assert.equal(copy.hours, 8);
  assert.deepEqual(noIds(copy.manpower), [{ trade: 'Mason', count: 3 }]);
  assert.notEqual(copy.manpower[0].id, 'm1');
  assert.deepEqual(noIds(copy.equipment), [{ type: 'Excavator', count: 1 }]);
  assert.deepEqual(copy.visitors, []);
  assert.equal(copy.issues, '');
});

test('diary totals, days in a range, trade suggestions', () => {
  const entry = {
    manpower: [
      { trade: 'Mason', count: 3 },
      { trade: '', count: 5 },
    ],
    equipment: [{ type: 'Loader', count: 2 }],
    visitors: [{ name: 'A' }],
  };
  assert.deepEqual(diaryTotals(entry), { workers: 8, equipment: 2, visitors: 1 });
  const diary = { days: { '2026-10-01': entry, '2026-10-05': { issues: '' }, '2026-10-09': { weather: 'rain' } } };
  assert.deepEqual(diaryDaysInRange(diary, '2026-10-01', '2026-10-09').sort(), ['2026-10-01', '2026-10-09']);
  assert.deepEqual(tradeSuggestions(diary, registries), ['Mason', 'Steel fixer']); // 'mason' is the same trade
  assert.deepEqual(equipmentSuggestions(diary), ['Loader']);
});

/* ── delays ── */

const TODAY = '2026-10-26';

test('delay days: inclusive, an open event runs to today', () => {
  assert.equal(dayDiff('2026-10-01', '2026-10-31'), 30);
  assert.equal(delayDays({ start: '2026-10-01', end: '2026-10-01' }, TODAY), 1);
  assert.equal(delayDays({ start: '2026-10-01', end: '2026-10-10' }, TODAY), 10);
  assert.equal(delayDays({ start: '2026-10-20', end: '' }, TODAY), 7);
  assert.equal(delayDays({ start: '2026-11-01', end: '' }, TODAY), 0); // not started yet
  assert.equal(delayDays({ start: '' }, TODAY), 0);
});

test('overlapping delays are not double counted', () => {
  const spans = [
    { start: '2026-10-01', end: '2026-10-10' },
    { start: '2026-10-05', end: '2026-10-12' }, // overlaps the first
    { start: '2026-10-03', end: '2026-10-04' }, // inside the first
    { start: '2026-10-20', end: '2026-10-21' }, // separate
    null,
  ];
  assert.equal(unionDays(spans), 12 + 2);
  assert.equal(unionDays([]), 0);
  // touching spans: no gap, no overlap
  assert.equal(unionDays([{ start: '2026-10-01', end: '2026-10-02' }, { start: '2026-10-03', end: '2026-10-03' }]), 3);

  const events = [
    { id: 'a', start: '2026-10-01', end: '2026-10-10', excusable: true, status: 'granted', daysClaimed: 10, daysGranted: 7 },
    { id: 'b', start: '2026-10-05', end: '2026-10-12', excusable: false, status: 'submitted', daysClaimed: 8 },
    { id: 'c', start: '2026-10-08', end: '2026-10-09', excusable: true, status: 'rejected', daysClaimed: 2, daysGranted: 2 },
    { id: 'd', start: '2026-10-25', end: '', excusable: true, status: 'draft', daysClaimed: 5 },
  ];
  const totals = delayTotals(events, TODAY);
  assert.equal(totals.count, 4);
  assert.equal(totals.days, 12 + 2); // 1–12 Oct + 25–26 Oct
  assert.equal(totals.excusableDays, 10 + 2); // a (c inside it) + d
  assert.equal(totals.claimed, 10 + 8 + 2); // drafts are not claims yet
  assert.equal(totals.granted, 7); // only a granted claim counts
  assert.equal(totals.pending, 8);
  assert.equal(totals.ongoing, 1);
});

test('the 28-day notice warning (FIDIC 20.1)', () => {
  assert.deepEqual(noticeCheck({ start: '2026-09-01', noticeDate: '2026-09-29' }, TODAY), { state: 'ok', deadline: '2026-09-29', daysAfter: 28 });
  const late = noticeCheck({ start: '2026-09-01', noticeDate: '2026-09-30' }, TODAY);
  assert.equal(late.state, 'late');
  assert.equal(late.daysAfter, 29);
  assert.equal(noticeWarns(late), true);
  assert.equal(noticeCheck({ start: '2026-09-10', noticeDate: '2026-09-05' }, TODAY).state, 'ok'); // notice ahead of the event

  const open = noticeCheck({ start: '2026-10-20', noticeDate: '' }, TODAY);
  assert.deepEqual(open, { state: 'open', deadline: '2026-11-17', daysLeft: 22 });
  assert.equal(noticeWarns(open), false);

  const overdue = noticeCheck({ start: '2026-09-20', noticeDate: '' }, TODAY);
  assert.deepEqual(overdue, { state: 'overdue', deadline: '2026-10-18', daysLate: 8 });
  assert.equal(noticeWarns(overdue), true);
  assert.equal(noticeCheck({ start: '' }, TODAY).state, 'none');

  const totals = delayTotals(
    [
      { start: '2026-09-01', noticeDate: '2026-09-30' },
      { start: '2026-09-20' },
      { start: '2026-10-20' },
    ],
    TODAY
  );
  assert.equal(totals.noticeWarnings, 2);
});

test('delays in a month: clipped to the month, overlaps once', () => {
  const events = [
    { id: 'a', start: '2026-09-25', end: '2026-10-03', excusable: true, status: 'granted', daysClaimed: 9, daysGranted: 9 },
    { id: 'b', start: '2026-10-02', end: '2026-10-05', excusable: false, status: 'submitted', daysClaimed: 4 },
    { id: 'c', start: '2026-11-02', end: '2026-11-05', status: 'draft' },
    { id: 'd', start: '2026-10-30', end: '', excusable: true, status: 'draft' }, // starts after today: nothing yet
  ];
  const oct = delaysInMonth(events, '2026-10', TODAY);
  assert.deepEqual(
    oct.rows.map((r) => [r.event.id, r.span.start, r.span.end, r.days]),
    [
      ['a', '2026-10-01', '2026-10-03', 3],
      ['b', '2026-10-02', '2026-10-05', 4],
    ]
  );
  assert.equal(oct.days, 5); // 1–5 Oct
  assert.equal(oct.excusableDays, 3);
  assert.equal(oct.claimed, 13);
  assert.equal(oct.granted, 9);
  assert.equal(delaysInMonth(events, '2026-09', TODAY).days, 6);
  assert.deepEqual(delaysInMonth([], '2026-10', TODAY).rows, []);
});

test('register order, filters and editor checks', () => {
  const events = [
    { id: 'a', start: '2026-10-01', status: 'draft', cause: 'weather' },
    { id: 'b', start: '2026-10-09', status: 'granted', cause: 'client' },
    { id: 'c', start: '2026-10-05', status: 'draft', cause: 'client' },
  ];
  assert.deepEqual(sortDelays(events).map((e) => e.id), ['b', 'c', 'a']);
  assert.deepEqual(filterDelays(events, { status: 'draft' }).map((e) => e.id), ['a', 'c']);
  assert.deepEqual(filterDelays(events, { cause: 'client', status: 'draft' }).map((e) => e.id), ['c']);
  assert.equal(filterDelays(events).length, 3);

  assert.deepEqual(delayErrors({ title: ' ', start: '' }), { title: 'required', start: 'required' });
  assert.deepEqual(delayErrors({ title: 'Rain', start: '2026-10-05', end: '2026-10-01' }), { end: 'beforeStart' });
  assert.deepEqual(delayErrors({ title: 'Rain', start: '2026-10-05', end: '' }), {});
});

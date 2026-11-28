import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DARES,
  DARE_LINES,
  HER_DARE_AFTERGLOW,
  HER_DARE_BONUS,
  HER_HINTS,
  herDareChance,
  pickDareOrigin,
  dareStreakMultiplier,
  dareClock,
  dareEvent,
  dareProgressRatio,
  dareRemainingMs,
  pickDare,
  startDare,
} from '../src/domain/dares.ts';

test('a dare fills from the taps it asked for, and only those', () => {
  let dare = startDare('cheek', 0);
  // Taps elsewhere are not progress: the whole point is that the chat asked for *her face*.
  dare = dareEvent(dare, 100, { type: 'tap', zone: 'legs' });
  assert.equal(dare.progress, 0);
  for (let i = 0; i < 5; i += 1) dare = dareEvent(dare, 200 + i * 100, { type: 'tap', zone: 'head' });
  assert.equal(dare.status, 'done');
  assert.equal(dareProgressRatio(dare), 1);
});

test('the eye-contact dare is a level, not a counter', () => {
  let dare = startDare('eye_contact', 0);
  dare = dareEvent(dare, 800, { type: 'hover', zone: 'head', hoverMs: 900 });
  assert.ok(Math.abs(dareProgressRatio(dare) - 0.36) < 1e-9);
  // The cursor leaves her face: the bar falls back down instead of banking what it had.
  dare = dareEvent(dare, 900, { type: 'hover', zone: null, hoverMs: 0 });
  assert.equal(dare.progress, 0);
  dare = dareEvent(dare, 1000, { type: 'hover', zone: 'head', hoverMs: 2600 });
  assert.equal(dare.status, 'done');
});

test('"do not touch her" fails on the first tap, and serves itself on the clock', () => {
  const failed = dareEvent(startDare('cold_hands', 0), 500, { type: 'tap', zone: 'chest' });
  assert.equal(failed.status, 'expired');

  let dare = startDare('cold_hands', 0);
  dare = dareClock(dare, 4000);
  assert.equal(dare.status, 'active');
  assert.ok(Math.abs(dareProgressRatio(dare) - 0.5) < 1e-9);
  dare = dareClock(dare, 8000);
  assert.equal(dare.status, 'done');
});

test('a dare expires on its own window, and the bar stops where it was', () => {
  let dare = startDare('restless', 1000);
  for (let i = 0; i < 4; i += 1) dare = dareEvent(dare, 1100 + i * 50, { type: 'tap', zone: 'chest' });
  assert.equal(dareRemainingMs(dare, 2000), DARES.restless.windowMs - 1000);
  dare = dareClock(dare, 1000 + DARES.restless.windowMs + 1);
  assert.equal(dare.status, 'expired');
  assert.equal(dare.progress, 4);
  // Finished dares ignore further input: the UI keeps showing the last bar it drew.
  assert.equal(dareEvent(dare, 9999, { type: 'tap', zone: 'chest' }).progress, 4);
});

test('the last tap inside the window still counts', () => {
  let dare = startDare('feet', 0);
  const at = DARES.feet.windowMs - 1;
  dare = dareEvent(dare, at, { type: 'tap', zone: 'feet' });
  dare = dareEvent(dare, at, { type: 'tap', zone: 'feet' });
  dare = dareEvent(dare, at, { type: 'tap', zone: 'feet' });
  assert.equal(dare.status, 'done');
});

test('the chat never asks the same dare twice in a row', () => {
  for (let i = 0; i < 50; i += 1) {
    const prev = 'cheek' as const;
    assert.notEqual(pickDare(prev, 80, () => i / 50, 5), prev);
  }
});

test('a shy chat does not ask for the loud dares', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 60; i += 1) seen.add(pickDare(null, 20, () => i / 60, 1));
  assert.ok(!seen.has('restless'), 'a shy stream got the 12-taps dare');
  assert.ok(seen.has('cheek') || seen.has('cold_hands'));
});

test('every dare in the table has copy for both endings', () => {
  for (const kind of Object.keys(DARES)) {
    assert.ok(DARES[kind as keyof typeof DARES].ask.length > 10, `${kind} has no ask`);
    assert.ok(DARES[kind as keyof typeof DARES].reward > 0);
  }
  assert.ok(DARE_LINES.done.length > 1 && DARE_LINES.expired.length > 1);
});

test('a streak pays more, and a miss resets it', () => {
  assert.equal(dareStreakMultiplier(0), 1);
  assert.equal(dareStreakMultiplier(1), 1.25);
  assert.equal(dareStreakMultiplier(2), 1.5);
  // Capped: the chat is generous, not infinite.
  assert.equal(dareStreakMultiplier(4), 2);
  assert.equal(dareStreakMultiplier(9), 2);
  assert.equal(dareStreakMultiplier(-3), 1);
  assert.equal(dareStreakMultiplier(Number.NaN), 1);
});

test('she only takes the wheel once the chat has taught the verb', () => {
  // First dare of a session is always the chat's, no matter how bold the room is.
  for (const r of [0, 0.5, 0.99]) {
    assert.equal(pickDareOrigin({ seq: 1, streak: 3, boldness: 90, lastOrigin: null, random: () => r }), 'chat');
  }
  // And a cold, unproven room never gets a dare from her at all.
  assert.equal(herDareChance(0, 40), 0);
  assert.equal(pickDareOrigin({ seq: 9, streak: 0, boldness: 40, lastOrigin: null, random: () => 0 }), 'chat');
});

test('heat and streak raise her odds, and the ramp stops short of certainty', () => {
  assert.ok(herDareChance(0, 60) > 0);
  assert.ok(herDareChance(0, 85) > herDareChance(0, 60));
  assert.ok(herDareChance(1, 40) > 0, 'a streak alone is enough');
  assert.ok(herDareChance(3, 90) > herDareChance(1, 60));
  assert.ok(herDareChance(20, 100) <= 0.7, 'never a sure thing');
  // The same roll decides differently at different heats: that is the only reason to have a ramp.
  const ctx = { seq: 4, streak: 2, lastOrigin: 'chat' as const, random: () => 0.42 };
  assert.equal(pickDareOrigin({ ...ctx, boldness: 90 }), 'her');
  assert.equal(pickDareOrigin({ ...ctx, boldness: 20, streak: 0 }), 'chat');
});

test('never two in a row, and the bonus is hers alone', () => {
  assert.equal(pickDareOrigin({ seq: 5, streak: 5, boldness: 100, lastOrigin: 'her', random: () => 0 }), 'chat');
  assert.ok(HER_DARE_BONUS > 1);
  // A her-dare pays the streak multiplier *and* her bonus, and the two caps do not fight.
  const paid = (reward: number, streak: number) => Math.round(reward * dareStreakMultiplier(streak) * HER_DARE_BONUS);
  assert.equal(paid(50, 0), 75);
  assert.equal(paid(50, 2), Math.round(50 * 1.5 * 1.5));
  assert.ok(paid(70, 4) === Math.round(70 * 2 * HER_DARE_BONUS), 'streak still caps at double');
});

test('every dare has an instruction in her own voice, and it is not the chat’s', () => {
  const kinds = Object.keys(DARES) as (keyof typeof DARES)[];
  for (const kind of kinds) {
    const mine = HER_HINTS[kind];
    assert.ok(mine && mine.length > 8, `${kind} has no her-voice hint`);
    assert.notEqual(mine, DARES[kind].hint, `${kind} just repeats the chat's hint`);
    assert.ok(!/^тапни/i.test(mine), `${kind} is still an order from the audience`);
  }
  assert.equal(Object.keys(HER_HINTS).length, kinds.length, 'no hint for a dare that does not exist');
  assert.ok(HER_DARE_AFTERGLOW.length >= 3);
});

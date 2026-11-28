import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DARES,
  DARE_LINES,
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

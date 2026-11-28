import assert from 'node:assert/strict';
import test from 'node:test';

import {
  baseBlush,
  blushAlpha,
  BLUSH_RATE,
  decayHeat,
  HEAT,
  stepBlush,
} from '../src/heroine/blush.ts';

test('boldness warms her, hype helps, and the ceiling is a flush rather than a mask', () => {
  assert.equal(baseBlush({ boldness: 0, hype: 0 }), 0);
  const shy = baseBlush({ boldness: 20, hype: 0 });
  const bold = baseBlush({ boldness: 70, hype: 0 });
  assert.ok(bold > shy && shy > 0, `${shy} → ${bold}`);
  assert.ok(baseBlush({ boldness: 100, hype: 100 }) <= 0.55, 'the baseline never paints her');
  // Hype alone must do something: a cold streamer with a frenzied chat is still flustered.
  assert.ok(baseBlush({ boldness: 0, hype: 100 }) > 0.1);
  assert.ok(blushAlpha(1) <= 0.38);
  assert.equal(blushAlpha(0), 0);
});

test('it warms faster than it cools, and both take real seconds', () => {
  const state = { level: 0 };
  // One frame of 0.1 s cannot take her from cold to a spike: that is a fade, not a moment.
  stepBlush(state, 0.1, 0, 1);
  assert.ok(state.level > 0 && state.level < 0.35, `warmed ${state.level.toFixed(2)} in 0.1 s`);
  for (let i = 0; i < 20; i += 1) stepBlush(state, 0.05, 0, 1);
  assert.ok(state.level > 0.9, `after a second of spike: ${state.level.toFixed(2)}`);
  const peak = state.level;
  // She cools to her baseline, not to white — the baseline is what makes the spike readable.
  let frames = 0;
  while (state.level > 0.36 && frames < 400) {
    stepBlush(state, 0.05, 0.35, 0);
    frames += 1;
  }
  assert.ok(frames * 0.05 > 1.2, `cooled from ${peak.toFixed(2)} in ${(frames * 0.05).toFixed(1)} s`);
  assert.ok(Math.abs(state.level - 0.35) < 0.01, `settled at ${state.level.toFixed(2)}`);
  assert.ok(BLUSH_RATE.warm > BLUSH_RATE.cool * 3);
});

test('the level never leaves 0..1, whatever the caller passes', () => {
  const state = { level: 0 };
  for (let i = 0; i < 100; i += 1) stepBlush(state, 0.05, 5, 5);
  assert.ok(state.level <= 1);
  for (let i = 0; i < 100; i += 1) stepBlush(state, 0.05, -5, -5);
  assert.ok(state.level >= 0);
  // A tab coming back after a minute must not teleport the ramp.
  const jump = { level: 0 };
  stepBlush(jump, 60, 0, 1);
  assert.ok(jump.level <= 0.25, `a 60 s frame moved the ramp to ${jump.level.toFixed(2)}`);
});

test('transient heat fades by about two thirds a second', () => {
  assert.ok(Math.abs(decayHeat(1, 1) - HEAT.decayPerSecond) < 1e-9);
  // A frame is never longer than a second as far as this curve is concerned: a tab that comes back
  // after a minute must not erase or keep heat that the player never saw.
  let heat = 1;
  for (let i = 0; i < 3; i += 1) heat = decayHeat(heat, 1);
  assert.ok(heat < 0.08, `three seconds: ${heat.toFixed(3)}`);
  assert.ok(decayHeat(0.5, 0) === 0.5);
  assert.ok(HEAT.donation > HEAT.tap * 4, 'a donation is not a tap');
});

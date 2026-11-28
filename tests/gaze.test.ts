import assert from 'node:assert/strict';
import test from 'node:test';

import { HEAT_HOLD, holdAtCamera } from '../src/heroine/gaze.ts';

test('a warm heroine stops following the mouse and looks at you', () => {
  // Cold: the pointer wins, she is just tracking it.
  const cold = holdAtCamera({ x: -0.8, y: 0.4 }, 0);
  assert.deepEqual(cold, { x: -0.8, y: 0.4 });
  // Warm: her gaze is pulled toward the lens, but not all the way — the pointer still has weight.
  const warm = holdAtCamera({ x: -0.8, y: 0.4 }, (HEAT_HOLD.from + HEAT_HOLD.full) / 2);
  assert.ok(warm.x > -0.8 && warm.x < HEAT_HOLD.targetX, `x ${warm.x}`);
  // Hot: she is holding eye contact whatever the cursor does.
  const hot = holdAtCamera({ x: -0.8, y: 0.4 }, 1);
  assert.ok(Math.abs(hot.x - HEAT_HOLD.targetX) < 1e-9);
  assert.ok(Math.abs(hot.y - HEAT_HOLD.targetY) < 1e-9);
});

test('the hold has no corner in it', () => {
  // Smoothstep, sampled fine across the band: the move must scale with the sample size. A linear
  // ramp would pass any single-step threshold; what this catches is a *jump*, which does not shrink
  // when the samples get closer together.
  const step = 0.001;
  let worst = 0;
  let prev = holdAtCamera({ x: 1, y: 0 }, HEAT_HOLD.from);
  for (let h = HEAT_HOLD.from; h <= HEAT_HOLD.full; h += step) {
    const now = holdAtCamera({ x: 1, y: 0 }, h);
    worst = Math.max(worst, Math.abs(now.x - prev.x));
    prev = now;
  }
  assert.ok(worst < 0.004, `a ${worst.toFixed(4)} jump in 0.001 of heat — that is a corner`);
});

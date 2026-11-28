import assert from 'node:assert/strict';
import test from 'node:test';

import { CAMERA, cameraDrift, cameraPose, punchAdd, punchDecay } from '../src/heroine/camera.ts';

test('the camera drifts, but never further than the budget', () => {
  let maxX = 0;
  let maxY = 0;
  for (let t = 0; t < 600; t += 0.05) {
    const d = cameraDrift(t);
    maxX = Math.max(maxX, Math.abs(d.x));
    maxY = Math.max(maxY, Math.abs(d.y));
  }
  // Zero at t=0, and the sum of the two legs never exceeds the stated budget.
  assert.deepEqual(cameraDrift(0), { x: 0, y: 0 });
  assert.ok(maxX <= CAMERA.driftX + 1e-9, `x drift ${maxX.toFixed(2)}`);
  assert.ok(maxY <= CAMERA.driftY + 1e-9, `y drift ${maxY.toFixed(2)}`);
  // ...and it actually moves: a drift under half a pixel is a still frame with extra code.
  assert.ok(maxX > CAMERA.driftX * 0.6, `x drift ${maxX.toFixed(2)} is too small to see`);
});

test('the drift does not repeat inside a stream', () => {
  // Two incommensurate legs beat into a visible figure-eight; the third breaks it. Sampled at the
  // start and 20 minutes in, the frame must not be in the same place.
  const a = cameraDrift(1.0);
  const b = cameraDrift(1.0 + 1200);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 0.5, 'the frame came back to the same spot');
});

test('a punch pushes in and comes back', () => {
  let punch = punchAdd(0, CAMERA.tapPunch);
  assert.ok(Math.abs(punch - CAMERA.tapPunch) < 1e-12);
  let at = 0;
  while (punch > CAMERA.tapPunch * 0.02 && at < 10) {
    punch = punchDecay(punch, 1 / 60);
    at += 1 / 60;
  }
  // Under a second: an event, not a change of framing.
  assert.ok(at < 1.6, `the punch took ${at.toFixed(2)} s to come back`);
  assert.ok(at > 0.3, `the punch vanished in ${at.toFixed(2)} s`);
});

test('hammering the tap cannot fly the camera', () => {
  let punch = 0;
  for (let i = 0; i < 200; i += 1) punch = punchAdd(punch, CAMERA.donationPunch);
  assert.equal(punch, CAMERA.maxPunch);
  const pose = cameraPose(12, punch);
  assert.ok(Math.abs(pose.zoom) <= CAMERA.maxPunch + 1e-9);
});

test('a stalled frame cannot teleport it', () => {
  const punch = CAMERA.maxPunch;
  // A tab that was asleep for a second wakes up with one huge dt: it must not overshoot.
  const after = punchDecay(punch, 30);
  assert.ok(after >= 0 && after <= punch);
});

test('reduced motion is a still frame, not a small one', () => {
  assert.deepEqual(cameraPose(123.4, CAMERA.maxPunch, true), { x: 0, y: 0, zoom: 0 });
  const moving = cameraPose(3.7, 0, false);
  assert.ok(Math.abs(moving.zoom) > 0, 'the breathing push is missing');
});

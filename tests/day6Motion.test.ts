import assert from 'node:assert/strict';
import test from 'node:test';
import { Day6Motion, DAY6_GESTURE_DURATION_MS, DAY6_GESTURE_COOLDOWN_MS } from '../src/heroine/day6Motion.ts';

test('a tap streak starts a single non-restarting gesture, with a hold and cooldown', () => {
  const motion = new Day6Motion();
  for (let i=0;i<7;i++) assert.equal(motion.tap(1),false);
  assert.equal(motion.tap(1),true);
  motion.update(1000);
  assert.equal(motion.intensity,1);
  for (let i=0;i<30;i++) assert.equal(motion.tap(3),false);
  assert.equal(motion.gestureStage,1); assert.equal(motion.progress,1000/DAY6_GESTURE_DURATION_MS);
  assert.equal(motion.update(1600),true); assert.equal(motion.isActive,false);
  for (let i=0;i<10;i++) assert.equal(motion.tap(2),false);
  motion.update(DAY6_GESTURE_COOLDOWN_MS);
  for (let i=0;i<7;i++) assert.equal(motion.tap(2),false);
  assert.equal(motion.tap(2),true);
  motion.reset(); assert.equal(motion.intensity,0);
});

test('old taps expire rather than triggering an unexpected gesture', () => {
  const motion = new Day6Motion();
  for (let i=0;i<7;i++) motion.tap(0);
  motion.update(3001);
  assert.equal(motion.tap(0),false);
});

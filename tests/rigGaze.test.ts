/**
 * She looks where you point — measured, not promised.
 *
 * The live gaze is the only channel into the skeleton that is not authored, so it carries the two
 * risks a live channel always carries: it can be invisible, and it can accumulate. Both are
 * assertions here:
 *
 * 1. **Visible.** A written rotation without `updateWorldTransform()` moves the bone by 0 px — the
 *    runtime draws cached world matrices. The test reads the same vertex buffer the renderer reads.
 * 2. **Bounded and non-cumulative.** OpenBone timelines are absolute, so the offset belongs to the
 *    frame it was written in; a full deflection held for two seconds has to stay at 4.5°, not walk
 *    the head around the plate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OpenBoneInstance } from '@openbone/runtime';
import { aimFromPointer, applyGaze, gazeDegrees, GazeSpring, GAZE_LIMITS } from '../src/heroine/gaze.ts';

const RIGS = join(import.meta.dirname, '..', 'public', 'rigs');

function open(art: string) {
  const doc = JSON.parse(readFileSync(join(RIGS, `${art}.obone`), 'utf8'));
  const instance = new OpenBoneInstance(doc);
  const slot = instance.skeleton.slots.find((s) => s.data.id === 'slot_body')!;
  const vertices = () =>
    Float32Array.from(instance.skeleton.attachmentWorldVertices(slot, instance.skeleton.getAttachment(slot)!));
  // `bones[].y` in the document is PARENT-RELATIVE (the neck sits at -263 from the chest), so
  // asking the document where the neck is gives you a number that no vertex is ever above.
  // The runtime has the world position; use that.
  instance.skeleton.updateWorldTransform();
  const neckY = instance.skeleton.findBone('bone_neck')!.worldY;
  return { doc, instance, vertices, neckY };
}

test('the spring arrives and then stops: a glance, not a servo and not a wobble', () => {
  const spring = new GazeSpring();
  spring.aim(1, 0);
  let peak = 0;
  let t = 0;
  const dt = 1 / 60;
  while (t < 1.6) {
    const p = spring.step(dt);
    peak = Math.max(peak, Math.abs(p.x));
    t += dt;
  }
  const settled = spring.position.x;
  assert.ok(Math.abs(settled - 1) < 0.02, `it never got there: ${settled.toFixed(3)}`);
  // A little overshoot is what makes it read as a head rather than a turret; ringing is what makes
  // it read as a bug. Both bounds are measured.
  assert.ok(peak > 1.0, `no overshoot at all (peak ${peak.toFixed(3)})`);
  assert.ok(peak < 1.2, `it rings: peak ${peak.toFixed(3)}`);
  assert.ok(Number.isFinite(settled), 'the spring went to NaN');
});

test('letting go brings her back to the front', () => {
  const spring = new GazeSpring();
  spring.aim(-1, 0.8);
  for (let i = 0; i < 60; i++) spring.step(1 / 60);
  spring.rest();
  for (let i = 0; i < 120; i++) spring.step(1 / 60);
  assert.ok(Math.abs(spring.position.x) < 0.02, `x is ${spring.position.x.toFixed(3)}`);
  assert.ok(Math.abs(spring.position.y) < 0.02, `y is ${spring.position.y.toFixed(3)}`);
});

test('the pointer map is sensitive near her face and saturates at the edge', () => {
  assert.equal(aimFromPointer(0, 0).x, 0);
  // Monotone, and the centre third of the screen is not dead: a quarter of the way out already
  // turns her noticeably.
  let previous = -Infinity;
  for (let p = -1; p <= 1.0001; p += 0.1) {
    const x = aimFromPointer(p, 0).x;
    assert.ok(x >= previous - 1e-9, `not monotone at ${p.toFixed(1)}`);
    previous = x;
  }
  assert.ok(aimFromPointer(0.25, 0).x > 0.55, 'the middle of the screen is dead');
  assert.ok(Math.abs(aimFromPointer(-4, 0).x) <= 1, 'out-of-range input was trusted');
  assert.ok(Math.abs(aimFromPointer(0, 3).y) <= 1, 'vertical input was trusted');
});

test('a written rotation is visible, and only her head and the hair move', () => {
  const { instance, vertices, neckY } = open('t1_s0');
  const setup = Float32Array.from(vertices());
  instance.play('idle', true);
  instance.advance(1 / 60);
  const before = Float32Array.from(vertices());
  const degrees = gazeDegrees({ x: 1, y: 1 });
  assert.equal(applyGaze(instance.skeleton, degrees), true);
  const after = vertices();

  let head = 0;
  let chair = 0;
  for (let i = 0; i < after.length; i += 2) {
    const d = Math.hypot(after[i]! - before[i]!, after[i + 1]! - before[i + 1]!);
    const y = setup[i + 1]!;
    if (y > 1400) chair = Math.max(chair, d);
    else if (y < neckY) head = Math.max(head, d);
  }
  // Head + neck + spine come to ~4.3° at the crown: ~23 px on the plate, ~11 px on a phone. Visible,
  // and nowhere near a neck break.
  assert.ok(head > 14 && head < 30, `a full look moves the head ${head.toFixed(1)} px`);
  // The chair is bound to `root` and the gaze never touches it.
  assert.ok(chair < 0.5, `the chair moved ${chair.toFixed(2)} px with the look`);
});

test('gaze on every frame does not accumulate: a held look stays 4.3°', () => {
  const { instance, vertices, neckY } = open('t1_s0');
  instance.play('idle', true);
  // Same animation, one instance looking, one not: the difference is the gaze, and it has to stay
  // put frame after frame instead of walking away.
  const plain = open('t1_s0');
  plain.instance.play('idle', true);
  let worst = 0;
  for (let frame = 0; frame < 180; frame++) {
    instance.advance(1 / 60);
    plain.instance.advance(1 / 60);
    applyGaze(instance.skeleton, gazeDegrees({ x: 1, y: 0 }));
    const a = vertices();
    const b = plain.vertices();
    let head = 0;
    for (let i = 0; i < a.length; i += 2) {
      if (a[i + 1]! < neckY) head = Math.max(head, Math.hypot(a[i]! - b[i]!, a[i + 1]! - b[i + 1]!));
    }
    worst = Math.max(worst, head);
  }
  assert.ok(worst < 30, `three seconds of a held look drifted to ${worst.toFixed(1)} px`);
  // The live channel must stay quieter than the authored ones, or a moving mouse out-shouts her
  // own acting: `turn` is 3.35° head + 0.95° neck, the deepest idle glance 2.0°.
  const crown = GAZE_LIMITS.head + GAZE_LIMITS.neck + GAZE_LIMITS.spine;
  assert.ok(crown <= 4.6, `the live look is ${crown.toFixed(1)}° at the crown — louder than "turn"`);
  assert.ok(crown >= 3.0, `the live look is ${crown.toFixed(1)}° at the crown — too small to see`);
});

test('no bone, no crash: the gaze is a no-op on a rig without a head', () => {
  const empty = {
    findBone: () => undefined,
    updateWorldTransform: () => assert.fail('it should not touch the world matrices'),
  };
  assert.equal(applyGaze(empty, gazeDegrees({ x: 1, y: 1 })), false);
});

// Does the live gaze eat the tap? Same run twice: cursor parked (spring settled) and cursor moving.
import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
import { applyGaze, gazeDegrees, GazeSpring, aimFromPointer } from '../src/heroine/gaze.ts';
import { readRigDoc } from '../scripts/rig_doc.mjs';

const doc = readRigDoc('public/rigs/t1_s0.obonb');

function run(moving) {
  const inst = new OpenBoneInstance(doc);
  const slot = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
  const att = inst.skeleton.getAttachment(slot);
  const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(slot, att));
  const spring = new GazeSpring();
  inst.play('idle', true);
  // warm up 1 s so the idle loop is mid-stride and the spring is at rest at the parked point
  spring.aim(aimFromPointer(0.55, -0.1).x, aimFromPointer(0.55, -0.1).y);
  for (let f = 0; f < 60; f++) {
    inst.advance(1 / 60);
    const g = spring.step(1 / 60);
    if (!spring.settled) applyGaze(inst.skeleton, gazeDegrees(g));
  }
  let base = V();
  let headBase = inst.skeleton.findBone('bone_head').rotation;
  inst.animationState.setAnimation(0, 'tap', false, 0.06);
  let peak = 0;
  let at = 0;
  const trace = [];
  for (let f = 1; f <= 18; f++) {
    inst.advance(1 / 60);
    if (moving) spring.aim(aimFromPointer(0.55 + 0.02 * Math.sin(f / 3), -0.1).x, 0);
    const g = spring.step(1 / 60);
    if (!spring.settled) applyGaze(inst.skeleton, gazeDegrees(g));
    const v = V();
    let all = 0;
    for (let i = 0; i < v.length; i += 2) {
      const d = Math.hypot(v[i] - base[i], v[i + 1] - base[i + 1]);
      if (d > all) all = d;
    }
    trace.push(`${all.toFixed(1)}`);
    if (all > peak) { peak = all; at = f; }
  }
  const headNow = inst.skeleton.findBone('bone_head').rotation;
  return { peak, at: at / 60, trace: trace.join(' '), headDelta: (headNow - headBase).toFixed(2) };
}

for (const moving of [false, true]) {
  const r = run(moving);
  console.log(`${moving ? 'cursor moving' : 'cursor parked'}: peak ${r.peak.toFixed(1)} px at ${r.at.toFixed(2)} s  head now ${r.headDelta}°`);
  console.log('   ', r.trace);
}

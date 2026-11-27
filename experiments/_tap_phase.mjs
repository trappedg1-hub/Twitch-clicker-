// The tap's keys are absolute: how much of the nod the player sees depends on where the idle loop
// happens to be when the click lands. Measure the worst phase, not the average one.
import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
import { readRigDoc } from '../scripts/rig_doc.mjs';

const raw = readRigDoc('public/rigs/t1_s0.obonb');
const SCALE = Number(process.argv[2] ?? 1);

function scaledDoc() {
  const doc = JSON.parse(JSON.stringify(raw));
  const tap = doc.animations.find((a) => a.name === 'tap');
  const map = { bone_head: 1, bone_neck: 1 };
  for (const tl of tap.timelines) {
    const bone = tl.id;
    if (tl.property === 'rotation' && map[bone]) {
      for (const k of tl.keys) k.value = k.value * SCALE;
    }
  }
  return doc;
}

function peak(phase) {
  const doc = scaledDoc();
  const inst = new OpenBoneInstance(doc);
  const slot = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
  const att = inst.skeleton.getAttachment(slot);
  const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(slot, att));
  inst.play('idle', true);
  for (let f = 0; f < Math.round(phase * 60); f++) inst.advance(1 / 60);
  const base = V();
  inst.play('tap', false);
  let best = 0;
  for (let f = 0; f < Math.round(0.35 * 60); f++) {
    inst.advance(1 / 60);
    const v = V();
    for (let i = 0; i < v.length; i += 2) {
      const d = Math.hypot(v[i] - base[i], v[i + 1] - base[i + 1]);
      if (d > best) best = d;
    }
  }
  return best;
}

const peaks = [];
for (let phase = 0; phase < 2.0; phase += 0.1) peaks.push(peak(phase));
const sorted = [...peaks].sort((a, b) => a - b);
const med = sorted[Math.floor(sorted.length / 2)];
console.log(
  `scale ${SCALE}: min ${sorted[0].toFixed(1)}  median ${med.toFixed(1)}  max ${sorted.at(-1).toFixed(1)} px` +
    `  (phases: ${peaks.map((p) => p.toFixed(0)).join(' ')})`
);

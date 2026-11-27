// The runtime cross-fades every `play` by defaultMix = 0.2 s. A 0.5 s nod with a 0.2 s fade-in
// spends 40 % of its life arriving — measure what the player actually sees for a few mix times.
import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
import { readRigDoc } from '../scripts/rig_doc.mjs';

const raw = readRigDoc('public/rigs/t1_s0.obonb');
const MIX = Number(process.argv[2] ?? 0.2);
const ART = process.argv[3] ?? 't1_s0';
const docRaw = ART === 't1_s0' ? raw : readRigDoc(`public/rigs/${ART}.obonb`);

function peak(phase) {
  const inst = new OpenBoneInstance(JSON.parse(JSON.stringify(docRaw)));
  const slot = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
  const att = inst.skeleton.getAttachment(slot);
  const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(slot, att));
  inst.play('idle', true);
  for (let f = 0; f < Math.round(phase * 60); f++) inst.advance(1 / 60);
  const base = V();
  inst.animationState.setAnimation(0, 'tap', false, MIX);
  let best = 0;
  let at = 0;
  for (let f = 1; f <= 30; f++) {
    inst.advance(1 / 60);
    const v = V();
    for (let i = 0; i < v.length; i += 2) {
      const d = Math.hypot(v[i] - base[i], v[i + 1] - base[i + 1]);
      if (d > best) { best = d; at = f / 60; }
    }
  }
  return { best, at };
}

const peaks = [];
let when = 0;
for (let p = 0; p < 20; p += 0.5) {
  const r = peak(p);
  peaks.push(r.best);
  when = r.at;
}
const sorted = [...peaks].sort((a, b) => a - b);
console.log(
  `${ART} mix ${MIX}: min ${sorted[0].toFixed(1)}  median ${sorted[10].toFixed(1)}  max ${sorted.at(-1).toFixed(1)} px` +
    `  (peak lands at ${when.toFixed(2)} s)`
);

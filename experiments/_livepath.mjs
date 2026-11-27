// Mimic LiveHeroine.update(): idle loop + live gaze every frame + a tap at t = 1.0 s.
import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
import { applyGaze, gazeDegrees, GazeSpring, aimFromPointer } from '../src/heroine/gaze.ts';
import { readRigDoc } from '../scripts/rig_doc.mjs';

const doc = readRigDoc('public/rigs/t1_s0.obonb');
const inst = new OpenBoneInstance(doc);
const slot = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
const att = inst.skeleton.getAttachment(slot);
const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(slot, att));
const mesh = doc.skeleton.skins[0].attachments.slot_body.miya_body;
const face = new Set(mesh.weights.map((w, i) => (w.length === 1 && w[0].bone === 'bone_head' && w[0].weight > 0.95 ? i : -1)).filter((i) => i >= 0));

const spring = new GazeSpring();
inst.play('idle', true);
const dt = 1 / 60;
let base = V();
const rows = [];
for (let f = 0; f < 150; f++) {
  const t = f * dt;
  // pointer parked on her face: the worst case for "the gaze eats the tap"
  if (f % 60 === 0) spring.aim(aimFromPointer(0.55, -0.1).x, 0);
  inst.advance(dt);
  const g = spring.step(dt);
  if (!spring.settled) applyGaze(inst.skeleton, gazeDegrees(g));
  if (f === 60) { inst.play('tap', false); base = V(); }
  if (f >= 60 && f <= 96 && f % 3 === 0) {
    const v = V();
    let faceMotion = 0, all = 0;
    for (let i = 0; i < v.length; i += 2) {
      const d = Math.hypot(v[i] - base[i], v[i + 1] - base[i + 1]);
      if (d > all) all = d;
      if (face.has(i / 2) && d > faceMotion) faceMotion = d;
    }
    rows.push(`t=${(t - 1).toFixed(2)}s face ${faceMotion.toFixed(1)} px  silhouette ${all.toFixed(1)} px`);
  }
}
console.log(rows.join('\n'));

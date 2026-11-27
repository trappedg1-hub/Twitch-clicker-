// How far a tap actually moves her, in the two numbers that matter: the face vertices the life
// test measures, and the whole silhouette a player sees.
import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';

const doc = JSON.parse(readFileSync('public/rigs/t1_s0.obone', 'utf8'));
const inst = new OpenBoneInstance(doc);
const slot = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
const att = inst.skeleton.getAttachment(slot);
const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(slot, att));
const mesh = doc.skeleton.skins[0].attachments.slot_body.miya_body;
const setup = V();
const headV = mesh.weights.map((w, i) => (w.length === 1 && w[0].bone === 'bone_head' && w[0].weight > 0.95 ? i : -1)).filter((i) => i >= 0);
const face = new Set(headV.slice());
for (const anim of ['tap', 'idle', 'breath']) {
  inst.play(anim, true);
  let all = 0, pure = 0;
  for (let f = 0; f < Math.round(inst.skeleton.slots ? 60 : 60); f++) {
    inst.advance(1 / 60);
    const v = V();
    for (let i = 0; i < v.length; i += 2) {
      const d = Math.hypot(v[i] - setup[i], v[i + 1] - setup[i + 1]);
      if (d > all) all = d;
      if (face.has(i / 2) && d > pure) pure = d;
    }
  }
  console.log(anim.padEnd(8), 'silhouette', all.toFixed(1), 'px   face', pure.toFixed(1), 'px');
}

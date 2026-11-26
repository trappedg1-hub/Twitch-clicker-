import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
const doc = JSON.parse(readFileSync('public/rigs/t1_s0.obone', 'utf8'));
const inst = new OpenBoneInstance(doc);
const body = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
const att = inst.skeleton.getAttachment(body);
const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(body, att));
const mesh = doc.skeleton.skins[0].attachments.slot_body.miya_body;
const setup = V();
const headV = mesh.weights.map((w, i) => (w.length === 1 && w[0].bone === 'bone_head' && w[0].weight > 0.95 ? i : -1)).filter((i) => i >= 0);
const chestV = mesh.weights.map((w, i) => (w.length === 1 && w[0].bone === 'bone_chest' && w[0].weight > 0.95 ? i : -1)).filter((i) => i >= 0);
console.log('pure head verts', headV.length, 'pure chest verts', chestV.length);
for (const anim of doc.animations) {
  inst.play(anim.name, false);
  let h = 0, c = 0;
  for (let f = 0; f < Math.round(anim.duration * 60); f += 2) {
    inst.advance(1/30);
    const v = V();
    for (const i of headV) h = Math.max(h, Math.hypot(v[i*2]-setup[i*2], v[i*2+1]-setup[i*2+1]));
    for (const i of chestV) c = Math.max(c, Math.hypot(v[i*2]-setup[i*2], v[i*2+1]-setup[i*2+1]));
  }
  console.log(anim.name.padEnd(10), 'head max', h.toFixed(1), 'chest max', c.toFixed(1));
}

import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
import { readRigDoc } from '../scripts/rig_doc.mjs';
const doc = readRigDoc('public/rigs/t1_s0.obonb');
const inst = new OpenBoneInstance(doc);
const body = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
const att = inst.skeleton.getAttachment(body);
const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(body, att));
const idx = Uint16Array.from(inst.drawList().find((d) => d.image && d.image.id.startsWith('img_miya')).indices);
const mesh = doc.skeleton.skins[0].attachments.slot_body.miya_body;
const area = (v,a,b,c) => (v[b*2]-v[a*2])*(v[c*2+1]-v[a*2+1]) - (v[b*2+1]-v[a*2+1])*(v[c*2]-v[a*2]);
const anim = process.argv[2] ?? 'sway';
inst.play(anim, false);
const rest = V();
const n = idx.length/3;
const restA = new Float64Array(n);
for (let t=0;t<n;t++) restA[t]=area(rest, idx[t*3], idx[t*3+1], idx[t*3+2]);
let best = { r: 1 };
for (let f=0; f<Math.round(doc.animations.find(a=>a.name===anim).duration*60); f++) {
  inst.advance(1/60); const v = V();
  for (let t=0;t<n;t++) {
    if (!restA[t]) continue;
    const r = area(v, idx[t*3], idx[t*3+1], idx[t*3+2])/restA[t];
    if (r > best.r) best = { r, f, t, vs: [idx[t*3], idx[t*3+1], idx[t*3+2]] };
  }
}
console.log('worst ratio', best.r.toFixed(2), 'frame', best.f, 'tri', best.t);
for (const vi of best.vs) console.log(' v', vi, 'rest', rest[vi*2].toFixed(0), rest[vi*2+1].toFixed(0), JSON.stringify(mesh.weights[vi].map(w=>[w.bone,w.weight])));

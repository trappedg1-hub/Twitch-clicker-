import { readRigDoc } from './rig_doc.mjs';
import { OpenBoneInstance } from '@openbone/runtime';
const [file, anim] = process.argv.slice(2);
const d = readRigDoc(file);
const i = new OpenBoneInstance(d);
const body = i.skeleton.slots.find(s => s.data.id === 'slot_body');
const att = i.skeleton.getAttachment(body);
const V = () => Float32Array.from(i.skeleton.attachmentWorldVertices(body, att));
const s0 = V();
const mesh = d.skeleton.skins[0].attachments.slot_body.miya_body;
const idx = Uint16Array.from(i.drawList().find(x => x.image && x.image.id === mesh.image).indices);
const n = idx.length / 3;
const rest = new Float64Array(n * 3);
for (let t = 0; t < n; t++) for (let e = 0; e < 3; e++) {
  const a = idx[t*3+e], b = idx[t*3+(e+1)%3];
  rest[t*3+e] = Math.hypot(s0[a*2]-s0[b*2], s0[a*2+1]-s0[b*2+1]);
}
const W = (k) => mesh.weights[k].map(x=>`${x.bone.replace('bone_','')}:${x.weight.toFixed(2)}`).join(' ');
i.play(anim, false);
let worst = { g: 0 };
const dur = d.animations.find(a => a.name === anim).duration;
for (let f = 0; f < Math.round(dur*60); f++) {
  i.advance(1/60); const v = V();
  for (let t = 0; t < n; t++) for (let e = 0; e < 3; e++) {
    const a = idx[t*3+e], b = idx[t*3+(e+1)%3];
    const g = Math.hypot(v[a*2]-v[b*2], v[a*2+1]-v[b*2+1]) - rest[t*3+e];
    if (g > worst.g) worst = { g, x: Math.round((v[a*2]+v[b*2])/2), y: Math.round((v[a*2+1]+v[b*2+1])/2), wa: W(a), wb: W(b) };
  }
}
console.log(`${anim}: worst ${worst.g.toFixed(1)} px @ ${worst.x},${worst.y}\n  A[${worst.wa}]\n  B[${worst.wb}]`);

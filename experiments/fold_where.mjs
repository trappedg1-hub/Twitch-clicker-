import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
import { readRigDoc } from '../scripts/rig_doc.mjs';
const doc = readRigDoc('public/rigs/t1_s0.obonb');
const inst = new OpenBoneInstance(doc);
const body = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
const att = inst.skeleton.getAttachment(body);
const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(body, att));
const idx = Uint16Array.from(inst.drawList().find((d) => d.image && d.image.id.startsWith('img_miya')).indices);
const area = (v,a,b,c) => (v[b*2]-v[a*2])*(v[c*2+1]-v[a*2+1]) - (v[b*2+1]-v[a*2+1])*(v[c*2]-v[a*2]);
for (const anim of ['turn','shake']) {
  inst.play(anim, false);
  const rest = V();
  const n = idx.length/3;
  const restA = new Float64Array(n);
  for (let t=0;t<n;t++) restA[t]=area(rest, idx[t*3], idx[t*3+1], idx[t*3+2]);
  const bad = new Map();
  for (let f=0; f<Math.round(doc.animations.find(a=>a.name===anim).duration*60); f++) {
    inst.advance(1/60); const v = V();
    for (let t=0;t<n;t++) {
      if (!restA[t]) continue;
      if (area(v, idx[t*3], idx[t*3+1], idx[t*3+2])/restA[t] < 0.05) {
        const cx = rest[(idx[t*3]+idx[t*3+1]+idx[t*3+2])*0+idx[t*3]*2];
        const cy = rest[idx[t*3]*2+1];
        const key = `${Math.round(cx/40)*40},${Math.round(cy/40)*40}`;
        bad.set(key, (bad.get(key) ?? 0) + 1);
      }
    }
  }
  const top = [...bad.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  console.log(anim, top.map(([k,v])=>`${k}×${v}`).join(' '));
}

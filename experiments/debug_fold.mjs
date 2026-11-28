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
inst.play('turn', false);
const rest = V();
const n = idx.length/3;
const restA = new Float64Array(n);
for (let t=0;t<n;t++) restA[t]=area(rest, idx[t*3], idx[t*3+1], idx[t*3+2]);
let found = 0;
for (let f=0; f<144 && found<4; f++) {
  inst.advance(1/60); const v = V();
  for (let t=0;t<n && found<4;t++) {
    if (!restA[t]) continue;
    const r = area(v, idx[t*3], idx[t*3+1], idx[t*3+2])/restA[t];
    if (r < 0.02) {
      found++;
      const vs = [idx[t*3], idx[t*3+1], idx[t*3+2]];
      console.log('frame', f, 'tri', t, 'ratio', r.toFixed(2));
      for (const vi of vs) {
        console.log('  v', vi, rest[vi*2].toFixed(0), rest[vi*2+1].toFixed(0), JSON.stringify(mesh.weights[vi].map(w=>[w.bone,w.weight])));
      }
    }
  }
}

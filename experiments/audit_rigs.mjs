// One table for every art: folds, smear, face rigidity, motion budget, still props.
import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
import { readRigDoc } from '../scripts/rig_doc.mjs';
const ARTS = Object.keys(JSON.parse(readFileSync('public/rigs/index.json', 'utf8')));
const area = (v,a,b,c) => (v[b*2]-v[a*2])*(v[c*2+1]-v[a*2+1]) - (v[b*2+1]-v[a*2+1])*(v[c*2]-v[a*2]);
const d = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
console.log('art      | folds | maxA | minA | face% | crown(tap) | idle-body | floor');
for (const art of ARTS) {
  const doc = readRigDoc(`public/rigs/${art}.obonb`);
  const inst = new OpenBoneInstance(doc);
  const body = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
  const att = inst.skeleton.getAttachment(body);
  const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(body, att));
  const setup = V();
  const idx = Uint16Array.from(inst.drawList().find((x) => x.image && x.image.id.startsWith('img_miya')).indices);
  const n = idx.length / 3;
  const restA = new Float64Array(n);
  for (let t = 0; t < n; t++) restA[t] = area(setup, idx[t*3], idx[t*3+1], idx[t*3+2]);
  // face feature points from the eye line
  const man = JSON.parse(readFileSync('public/art/face_kit/manifest.json', 'utf8'))[`heroine_${art}`];
  const eyes = man.eyes.map((b) => [(b[0]+b[2])/2, (b[1]+b[3])/2]);
  const mid = [(eyes[0][0]+eyes[1][0])/2, (eyes[0][1]+eyes[1][1])/2];
  const span = d(eyes[0], eyes[1]);
  const grid = att.grid ?? { cols: 56, rows: 84 };
  const at = (v, p) => { const c = Math.round(p[0]/doc.width*grid.cols), r = Math.round(p[1]/doc.height*grid.rows);
    const i = (r*(grid.cols+1)+c)*2; return [v[i], v[i+1]]; };
  const F = { eyeL: eyes[0], eyeR: eyes[1], chin: [mid[0], mid[1] + 1.2*span], crown: [mid[0], mid[1] - 1.55*span] };
  const baseFace = d(at(setup, F.eyeL), at(setup, F.chin));
  let folds = 0, maxA = 1, minA = 1, face = 0, crown = 0, idleBody = 0, floor = 0;
  for (const anim of doc.animations) {
    inst.play(anim.name, false);
    const dur = anim.duration;
    for (let f = 0; f < Math.round(dur*60); f += 2) {
      inst.advance(1/30);
      const v = V();
      for (let t = 0; t < n; t++) {
        if (!restA[t]) continue;
        const r = area(v, idx[t*3], idx[t*3+1], idx[t*3+2]) / restA[t];
        if (r < 0) folds++;
        if (r > maxA) maxA = r;
        if (r < minA) minA = r;
      }
      face = Math.max(face, Math.abs(d(at(v, F.eyeL), at(v, F.chin)) / baseFace - 1) * 100);
      if (anim.name === 'tap') crown = Math.max(crown, d(at(v, F.crown), at(setup, F.crown)));
      if (anim.name === 'idle' || anim.name === 'breath') {
        for (let i = 0; i < v.length; i += 2) {
          const dd = Math.hypot(v[i]-setup[i], v[i+1]-setup[i+1]);
          if (setup[i+1] > 1400) floor = Math.max(floor, dd);
          else idleBody = Math.max(idleBody, dd);
        }
      }
    }
  }
  console.log([art.padEnd(8), String(folds).padStart(5), maxA.toFixed(2).padStart(5), minA.toFixed(2).padStart(5),
    face.toFixed(2).padStart(6), crown.toFixed(1).padStart(10), idleBody.toFixed(1).padStart(9), floor.toFixed(2).padStart(6)].join(' | '));
}

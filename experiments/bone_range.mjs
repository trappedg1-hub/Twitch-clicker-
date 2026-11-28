import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
import { readRigDoc } from '../scripts/rig_doc.mjs';
const doc = readRigDoc('public/rigs/t1_s0.obonb');
for (const anim of ['idle','sway','turn','shake','tap']) {
  const inst = new OpenBoneInstance(doc);
  inst.play(anim, false);
  const bone = inst.skeleton.bones.find((b) => b.data.id === 'bone_hair_back');
  let lo = 1e9, hi = -1e9, loS = 1e9, hiS = -1e9;
  const dur = doc.animations.find((a) => a.name === anim).duration;
  for (let f = 0; f < Math.round(dur * 60); f++) {
    inst.advance(1/60);
    const r = bone.world.rotation * 180 / Math.PI;
    lo = Math.min(lo, r); hi = Math.max(hi, r);
    const s = bone.world.scaleX;
    loS = Math.min(loS, s); hiS = Math.max(hiS, s);
  }
  console.log(anim.padEnd(6), 'hair_back rot deg', lo.toFixed(2), '..', hi.toFixed(2), ' scale', loS.toFixed(3), '..', hiS.toFixed(3));
}

import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
import { readRigDoc } from '../scripts/rig_doc.mjs';
const doc = readRigDoc('public/rigs/t1_s0.obonb');
const inst = new OpenBoneInstance(doc);
const slot = inst.skeleton.slots.find((s)=>s.data.id==='slot_body');
const att = inst.skeleton.getAttachment(slot);
const V = ()=>Float32Array.from(inst.skeleton.attachmentWorldVertices(slot, att));
const mesh = doc.skeleton.skins[0].attachments.slot_body.miya_body;
const setupPose = V();
const groups = {};
for (const [name,bone] of [['head','bone_head'],['hair','bone_hair_back'],['chest','bone_chest'],['eyes','bone_eye_l']]) {
  groups[name] = mesh.weights.map((w,i)=>(w.some(x=>x.bone===bone&&x.weight>0.5)?i:-1)).filter(i=>i>=0);
}
console.log('verts', groups.head.length, groups.hair.length, groups.chest.length, groups.eyes.length);
inst.play('tap', false);
const rows=[];
for (let f=1; f<=30; f++) {
  inst.advance(1/60);
  const v=V();
  let peak={d:0,i:0}; let head=0, hair=0, chest=0;
  for (let i=0;i<v.length;i+=2){
    const d=Math.hypot(v[i]-setupPose[i], v[i+1]-setupPose[i+1]);
    if(d>peak.d) peak={d,i:i/2};
    if(groups.head.includes(i/2)) head=Math.max(head,d);
    if(groups.hair.includes(i/2)) hair=Math.max(hair,d);
    if(groups.chest.includes(i/2)) chest=Math.max(chest,d);
  }
  rows.push(`t=${(f/60).toFixed(2)} peak ${peak.d.toFixed(1)} @${peak.i}  head ${head.toFixed(1)}  hair ${hair.toFixed(1)}  chest ${chest.toFixed(1)}`);
}
console.log(rows.filter((_,i)=>i%2===0).join('\n'));

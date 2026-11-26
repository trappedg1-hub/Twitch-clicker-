import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
const art = 't1_s0';
const doc = JSON.parse(readFileSync(`public/rigs/${art}.obone`, 'utf8'));
const inst = new OpenBoneInstance(doc);
function mesh() {
  const body = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
  const d = inst.drawList().find((x) => x.image && x.image.id.startsWith('img_miya'));
  return { v: Float32Array.from(d.vertices), idx: d.indices, uvs: Float32Array.from(d.uvs) };
}
function area(v, a, b, c) {
  return (v[b*2]-v[a*2])*(v[c*2+1]-v[a*2+1]) - (v[b*2+1]-v[a*2+1])*(v[c*2]-v[a*2]);
}
for (const anim of ['idle','breath','tap','shake','sway','turn']) {
  inst.play(anim, false);
  const base = mesh();
  const restA = new Float64Array(base.idx.length/3);
  for (let t=0;t<restA.length;t++) restA[t]=area(base.v, base.idx[t*3], base.idx[t*3+1], base.idx[t*3+2]);
  let flips=0, worstStretch=0, worstSqueeze=1e9, frames=0;
  const dur = doc.animations.find(a=>a.name===anim).duration;
  for (let f=0; f<Math.round(dur*60); f++) {
    inst.advance(1/60); const m = mesh(); frames++;
    for (let t=0;t<restA.length;t++) {
      if (!restA[t]) continue;
      const a = area(m.v, m.idx[t*3], m.idx[t*3+1], m.idx[t*3+2]);
      const r = a/restA[t];
      if (r < 0) flips++;
      if (r > worstStretch) worstStretch = r;
      if (r < worstSqueeze) worstSqueeze = r;
    }
  }
  console.log(`${anim.padEnd(7)} folds=${flips} maxStretch=${worstStretch.toFixed(3)} minRatio=${worstSqueeze.toFixed(3)}`);
}

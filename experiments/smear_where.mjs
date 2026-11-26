import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
const art = process.argv[2] ?? 't1_s0';
const doc = JSON.parse(readFileSync(`public/rigs/${art}.obone`, 'utf8'));
const inst = new OpenBoneInstance(doc);
const body = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
const att = inst.skeleton.getAttachment(body);
const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(body, att));
const area = (v,a,b,c) => (v[b*2]-v[a*2])*(v[c*2+1]-v[a*2+1]) - (v[b*2+1]-v[a*2+1])*(v[c*2]-v[a*2]);
for (const anim of ['tap','shake','turn','sway']) {
  inst.play(anim, false);
  const rest = V();
  const idx = Uint16Array.from(inst.drawList().find((d) => d.image && d.image.id.startsWith('img_miya')).indices);
  const n = idx.length/3;
  const restA = new Float64Array(n);
  for (let t=0;t<n;t++) restA[t]=area(rest, idx[t*3], idx[t*3+1], idx[t*3+2]);
  const worst = new Map();
  const dur = doc.animations.find(a=>a.name===anim).duration;
  for (let f=0; f<Math.round(dur*60); f++) {
    inst.advance(1/60); const v = V();
    for (let t=0;t<n;t++) {
      if (!restA[t]) continue;
      const r = area(v, idx[t*3], idx[t*3+1], idx[t*3+2]) / restA[t];
      const cx = (v[idx[t*3]*2]+v[idx[t*3+1]*2]+v[idx[t*3+2]*2])/3;
      const cy = (v[idx[t*3]*2+1]+v[idx[t*3+1]*2+1]+v[idx[t*3+2]*2+1])/3;
      const key = `${Math.round(cx/40)*40},${Math.round(cy/40)*40}`;
      const cur = worst.get(key) ?? {min:1,max:1};
      cur.min = Math.min(cur.min, r); cur.max = Math.max(cur.max, r);
      worst.set(key, cur);
    }
  }
  const list = [...worst.entries()].sort((a,b)=> Math.max(b[1].max, 1/b[1].min) - Math.max(a[1].max, 1/a[1].min)).slice(0,6);
  console.log(anim, list.map(([k,v])=>`${k} ${v.min.toFixed(2)}..${v.max.toFixed(2)}`).join(' | '));
}

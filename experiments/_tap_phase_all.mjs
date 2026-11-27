// Worst-beat tap amplitude for every art: the number a phone player always sees.
import { readFileSync, readdirSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';

const dir = 'public/rigs';
const arts = readdirSync(dir).filter((f) => f.endsWith('.obone')).map((f) => f.replace('.obone', ''));

function peakFor(doc, phase) {
  const inst = new OpenBoneInstance(doc);
  const slot = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
  const att = inst.skeleton.getAttachment(slot);
  const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(slot, att));
  inst.play('idle', true);
  for (let f = 0; f < Math.round(phase * 60); f++) inst.advance(1 / 60);
  const base = V();
  inst.animationState.setAnimation(0, 'tap', false, 0.08);
  let best = 0;
  for (let f = 0; f < 30; f++) {
    inst.advance(1 / 60);
    const v = V();
    for (let i = 0; i < v.length; i += 2) {
      const d = Math.hypot(v[i] - base[i], v[i + 1] - base[i + 1]);
      if (d > best) best = d;
    }
  }
  return best;
}

const rows = [];
for (const art of arts) {
  const doc = JSON.parse(readFileSync(`${dir}/${art}.obone`, 'utf8'));
  const peaks = [];
  const loop = doc.animations.find((a) => a.name === 'idle').duration;
  for (let p = 0; p < loop; p += 0.5) peaks.push(peakFor(doc, p));
  const sorted = [...peaks].sort((a, b) => a - b);
  rows.push({ art, min: sorted[0], med: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1) });
}
rows.sort((a, b) => a.min - b.min);
for (const r of rows) console.log(r.art.padEnd(10), 'min', r.min.toFixed(1), ' med', r.med.toFixed(1), ' max', r.max.toFixed(1));
console.log('worst art', rows[0].art, rows[0].min.toFixed(1), 'px');

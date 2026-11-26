import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';

const doc = JSON.parse(readFileSync('public/rigs/t1_s0.obone', 'utf8'));
const inst = new OpenBoneInstance(doc);
const sk = inst.skeleton;
const slotById = (id) => sk.slots.find((s) => s.data.id === id);
const body = slotById('slot_body');
const att = () => sk.getAttachment(body);
const setup = Float32Array.from(sk.attachmentWorldVertices(body, att()));
console.log('verts', setup.length / 2);

const disp = () => {
  const v = sk.attachmentWorldVertices(body, att());
  let max = 0, sum = 0, maxLow = 0, maxFace = 0;
  for (let i = 0; i < v.length; i += 2) {
    const d = Math.hypot(v[i] - setup[i], v[i + 1] - setup[i + 1]);
    max = Math.max(max, d);
    sum += d * d;
    const y = setup[i + 1];
    if (y > 1400) maxLow = Math.max(maxLow, d);
    if (y > 250 && y < 470) maxFace = Math.max(maxFace, d);
  }
  return { max, rms: Math.sqrt(sum / (v.length / 2)), maxLow, maxFace };
};

inst.play('idle', true);
const rows = [];
for (let f = 0; f < 240; f++) {
  inst.advance(1 / 60);
  if (f % 10 === 0) rows.push([f, disp()]);
}
const fmt = (r) => `t=${(r[0] / 60).toFixed(2)}s max ${r[1].max.toFixed(2)} rms ${r[1].rms.toFixed(2)} low ${r[1].maxLow.toFixed(2)} face ${r[1].maxFace.toFixed(2)}`;
console.log(rows.map(fmt).join('\n'));

// blink: what does the timeline touch, and where does the eye patch land?
const blink = doc.animations.find((a) => a.name === 'blink');
console.log('\nblink timelines:', blink.timelines.map((t) => `${t.target}:${t.id}.${t.property} keys=${t.keys.length} first=${JSON.stringify(t.keys[0])}`).join('\n  '));

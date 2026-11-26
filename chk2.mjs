import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';

const doc = JSON.parse(readFileSync('public/rigs/t1_s0.obone', 'utf8'));
const idle = doc.animations.find((a) => a.name === 'idle');
console.log('idle timelines:');
for (const t of idle.timelines) {
  const vals = t.keys.map((k) => (typeof k.value === 'number' ? +k.value.toFixed(2) : k.value));
  console.log(`  ${t.target}:${t.id}.${t.property}`, JSON.stringify(vals));
}

const measure = (fps, jitter) => {
  const inst = new OpenBoneInstance(JSON.parse(JSON.stringify(doc)));
  const sk = inst.skeleton;
  const body = sk.slots.find((s) => s.data.id === 'slot_body');
  const att = () => sk.getAttachment(body);
  const setup = Float32Array.from(sk.attachmentWorldVertices(body, att()));
  inst.play('idle', true);
  let max = 0;
  const dt = 1 / fps;
  for (let f = 0; f < fps * 4; f++) {
    inst.advance(jitter ? dt * (0.4 + Math.random() * 1.6) : dt);
    const v = sk.attachmentWorldVertices(body, att());
    for (let i = 0; i < v.length; i += 2) {
      max = Math.max(max, Math.hypot(v[i] - setup[i], v[i + 1] - setup[i + 1]));
    }
  }
  return max;
};
console.log('\nmax idle displacement by frame rate:');
for (const [fps, jitter] of [[60, false], [120, false], [144, false], [30, false], [60, true], [120, true]]) {
  console.log(`  ${fps}Hz${jitter ? ' jitter' : ''}: ${measure(fps, jitter).toFixed(2)} px`);
}

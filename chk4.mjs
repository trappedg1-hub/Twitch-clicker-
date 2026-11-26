import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
const doc = JSON.parse(readFileSync('public/rigs/t1_s0.obone', 'utf8'));
const inst = new OpenBoneInstance(doc);
inst.play('idle', true);
for (let f = 0; f < 240; f++) {
  inst.advance(1 / 60);
  const items = inst.drawList();
  const eye = items.find((i) => String(JSON.stringify(i)).includes('eyes_closed'));
  if (eye) {
    const shallow = Object.fromEntries(
      Object.entries(eye).map(([k, v]) => [k, Array.isArray(v) ? `[${v.length}]` : typeof v === 'object' && v ? JSON.stringify(v) : v]),
    );
    console.log('item:', shallow);
    console.log('vertices', Array.from(eye.vertices ?? []).map((v) => Math.round(v)));
    console.log('uvs', Array.from(eye.uvs ?? []).map((v) => +v.toFixed(3)));
    break;
  }
}

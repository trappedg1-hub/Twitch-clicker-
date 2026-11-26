import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
const doc = JSON.parse(readFileSync('public/rigs/t1_s0.obone', 'utf8'));
const inst = new OpenBoneInstance(doc);
inst.play('idle', true);
for (let f = 0; f < 240; f++) {
  inst.advance(1 / 60);
  const items = inst.drawList();
  for (const it of items) {
    const name = it.attachment?.name ?? it.attachment ?? '';
    if (String(name).includes('eyes') || String(it.name ?? '').includes('eyes')) {
      console.log('item keys', Object.keys(it));
      console.log('attachment', name, 'type', it.attachment?.type ?? it.type);
      console.log('vertices', Array.from(it.vertices ?? []).map((v) => Math.round(v)));
      console.log('uvs', Array.from(it.uvs ?? []).map((v) => +v.toFixed(3)));
      console.log('image', it.image?.id ?? it.image, 'indices', it.indices ? Array.from(it.indices) : null);
      process.exit(0);
    }
  }
}
console.log('no eyes batch found; batches:', inst.drawList().map((i) => Object.keys(i).join(',')));

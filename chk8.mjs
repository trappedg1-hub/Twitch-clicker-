import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
const doc = JSON.parse(readFileSync('public/rigs/t1_s0.obone', 'utf8'));
const inst = new OpenBoneInstance(doc);
inst.play('idle', true);
for (let f = 0; f < 100; f++) {
  inst.advance(1 / 60);
  const items = inst.drawList();
  if (items.length > 1) {
    for (const it of items) {
      console.log('slot', it.slot?.id ?? it.slot, '| attachment', typeof it.attachment === 'object' ? it.attachment.name + '/' + it.attachment.type : it.attachment,
        '| image', typeof it.image === 'object' ? it.image?.id : it.image);
      console.log('   verts', Array.from(it.vertices).map((v) => Math.round(v)));
      console.log('   uvs  ', Array.from(it.uvs).map((v) => +v.toFixed(3)));
    }
    break;
  }
}

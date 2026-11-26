import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
const doc = JSON.parse(readFileSync('public/rigs/t1_s0.obone', 'utf8'));
const inst = new OpenBoneInstance(doc);
const sk = inst.skeleton;
const slot = sk.slots.find((s) => s.data.id === 'slot_eyes');
inst.play('idle', true);
let last = null;
for (let f = 0; f < 240; f++) {
  inst.advance(1 / 60);
  const cur = slot.attachmentName;
  if (cur !== last) {
    console.log(`t=${(f / 60).toFixed(2)}s attachmentName=${JSON.stringify(cur)} batches=${inst.drawList().length}`);
    for (const it of inst.drawList()) {
      const an = it.attachment?.name;
      if (an && String(an).includes('eyes')) {
        console.log('   eyes batch verts', Array.from(it.vertices).map((v) => Math.round(v)), 'uvs', Array.from(it.uvs).map((v) => +v.toFixed(3)));
      }
    }
    last = cur;
  }
}

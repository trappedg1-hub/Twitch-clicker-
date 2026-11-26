import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
const doc = JSON.parse(readFileSync('public/rigs/t1_s0.obone', 'utf8'));
const idle = doc.animations.find((a) => a.name === 'idle');
const tl = idle.timelines.find((t) => t.property === 'attachment');
console.log('attachment timeline', JSON.stringify(tl));
const inst = new OpenBoneInstance(doc);
const sk = inst.skeleton;
const slot = sk.slots.find((s) => s.data.id === 'slot_eyes');
inst.play('idle', true);
let last = null;
for (let f = 0; f < 240; f++) {
  inst.advance(1 / 60);
  const cur = sk.getAttachment(slot)?.name ?? null;
  const n = inst.drawList().length;
  if (cur !== last) {
    console.log(`t=${(f / 60).toFixed(2)}s attachment=${cur} batches=${n} slotAttachment=${JSON.stringify(slot.attachment)}`);
    last = cur;
  }
}

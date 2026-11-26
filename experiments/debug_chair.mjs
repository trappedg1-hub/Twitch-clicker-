import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
const doc = JSON.parse(readFileSync('public/rigs/t1_s0.obone', 'utf8'));
const mesh = doc.skeleton.skins[0].attachments.slot_body.miya_body;
const inst = new OpenBoneInstance(doc);
const body = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
const att = inst.skeleton.getAttachment(body);
const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(body, att));
const rest = V();
const idx = Uint16Array.from(inst.drawList().find((d) => d.image && d.image.id.startsWith('img_miya')).indices);
inst.play('idle', false);
let worst = { d: 0 };
for (let f = 0; f < 240; f++) {
  inst.advance(1/60);
  const v = V();
  for (let i = 0; i < v.length; i += 2) {
    const x = rest[i], y = rest[i+1];
    if (x < 740 || x > 850 || y < 320 || y > 740) continue;
    const d = Math.hypot(v[i]-x, v[i+1]-y);
    if (d > worst.d) worst = { d, i: i/2, x, y };
  }
}
console.log('worst', worst);
const w = mesh.weights[worst.i];
console.log('weights', JSON.stringify(w));
console.log('grid', mesh.grid, 'verts', mesh.vertices.length/2);

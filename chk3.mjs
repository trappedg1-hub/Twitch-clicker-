import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';

const raw = JSON.parse(readFileSync('public/rigs/t1_s0.obone', 'utf8'));

// 1) which constraint produces the 24 px?
for (const off of ['none', 'phys_hair', 'phys_chest', 'phys_bust', 'all']) {
  const doc = JSON.parse(JSON.stringify(raw));
  const inst = new OpenBoneInstance(doc);
  const sk = inst.skeleton;
  if (off !== 'none') {
    for (const [id, rec] of sk.constraintValues) {
      if (off === 'all' || id === off) rec.mix = 0;
    }
  }
  const body = sk.slots.find((s) => s.data.id === 'slot_body');
  const att = () => sk.getAttachment(body);
  const setup = Float32Array.from(sk.attachmentWorldVertices(body, att()));
  inst.play('idle', true);
  let max = 0, where = null;
  for (let f = 0; f < 240; f++) {
    inst.advance(1 / 60);
    const v = sk.attachmentWorldVertices(body, att());
    for (let i = 0; i < v.length; i += 2) {
      const d = Math.hypot(v[i] - setup[i], v[i + 1] - setup[i + 1]);
      if (d > max) { max = d; where = [Math.round(setup[i]), Math.round(setup[i + 1])]; }
    }
  }
  console.log(`${off.padEnd(12)} max ${max.toFixed(2)} px at plate (${where})`);
}

// 2) how is the eye patch textured?
const doc = JSON.parse(JSON.stringify(raw));
const inst = new OpenBoneInstance(doc);
const sk = inst.skeleton;
inst.play('idle', true);
for (let f = 0; f < 240; f++) {
  inst.advance(1 / 60);
  const items = inst.drawList();
  const eye = items.find((i) => i.attachment === 'eyes_closed' || (i.slot && i.slot.id === 'slot_eyes'));
  if (eye) {
    console.log('\neyes item keys', Object.keys(eye));
    console.log('vertices', Array.from(eye.vertices ?? eye.worldVertices ?? []).map((v) => Math.round(v)));
    console.log('uvs', eye.uvs ? Array.from(eye.uvs).map((v) => +v.toFixed(3)) : eye.uvs);
    console.log('image', eye.image ?? eye.texture);
    break;
  }
}

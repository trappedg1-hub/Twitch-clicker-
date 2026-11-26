import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
const doc = JSON.parse(readFileSync('public/rigs/t1_s0.obone', 'utf8'));
const inst = new OpenBoneInstance(doc);
inst.play('idle', true);
for (let f = 0; f < 100; f++) {
  inst.advance(1 / 60);
  const items = inst.drawList();
  if (items.length > 1) {
    const [body, eyes] = items;
    console.log('body first 4 verts', Array.from(body.vertices.slice(0, 8)).map(Math.round));
    console.log('body first 4 uvs  ', Array.from(body.uvs.slice(0, 8)).map((v) => +v.toFixed(4)));
    console.log('body last 4 verts ', Array.from(body.vertices.slice(-8)).map(Math.round));
    console.log('body last 4 uvs   ', Array.from(body.uvs.slice(-8)).map((v) => +v.toFixed(4)));
    console.log('eyes att', eyes.attachment?.name, eyes.attachment?.type);
    console.log('eyes verts', Array.from(eyes.vertices).map(Math.round));
    console.log('eyes uvs  ', Array.from(eyes.uvs).map((v) => +v.toFixed(3)));
    console.log('eyes indices', Array.from(eyes.indices ?? []));
    break;
  }
}

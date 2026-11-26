import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';

const doc = JSON.parse(readFileSync('public/rigs/t1_s0.obone', 'utf8'));
console.log('scripts root:', JSON.stringify(doc.scripts), '| sm:', JSON.stringify(doc.stateMachines[0].scripts));

const inst = new OpenBoneInstance(doc);
const sk = inst.skeleton;
const body = sk.slots.find((s) => s.data.id === 'slot_body');
const a = () => sk.getAttachment(body);
const setup = Float32Array.from(sk.attachmentWorldVertices(body, a()));
inst.play('idle', true);
let max = 0, maxLow = 0, maxFace = 0;
for (let f = 0; f < 240; f++) {
  inst.advance(1 / 60);
  const v = sk.attachmentWorldVertices(body, a());
  for (let i = 0; i < v.length; i += 2) {
    const d = Math.hypot(v[i] - setup[i], v[i + 1] - setup[i + 1]);
    max = Math.max(max, d);
    if (setup[i + 1] > 1400) maxLow = Math.max(maxLow, d);
    if (setup[i + 1] > 250 && setup[i + 1] < 470) maxFace = Math.max(maxFace, d);
  }
}
console.log(`idle: max ${max.toFixed(2)} px (было 24.5), лицо ${maxFace.toFixed(2)}, низ кадра ${maxLow.toFixed(2)}`);

// blink patch: where does the quad land, and is the image upright?
const inst2 = new OpenBoneInstance(JSON.parse(readFileSync('public/rigs/t1_s0.obone', 'utf8')));
inst2.play('idle', true);
for (let f = 0; f < 100; f++) {
  inst2.advance(1 / 60);
  const items = inst2.drawList();
  if (items.length > 1) {
    const eye = items.find((it) => it.image?.id?.includes('eyes_closed'));
    if (!eye) { console.log('no eyes batch'); break; }
    const v = Array.from(eye.vertices).map((n) => Math.round(n));
    const uv = Array.from(eye.uvs).map((n) => +n.toFixed(2));
    const box = [Math.min(...v.filter((_, i) => i % 2 === 0)), Math.min(...v.filter((_, i) => i % 2 === 1)), Math.max(...v.filter((_, i) => i % 2 === 0)), Math.max(...v.filter((_, i) => i % 2 === 1))];
    console.log('eyes quad x0,y0,x1,y1 =', box, '| manifest patch 534.5±112.5, 306.5±57.5');
    console.log('corner uvs', JSON.stringify(uv));
    // where is the uv (0,0) corner? it must be the TOP-left (smallest y)
    const i00 = uv.findIndex((n, i) => i % 2 === 0 && n === 0 && uv[i + 1] === 0);
    console.log(`uv(0,0) sits at (${v[i00]}, ${v[i00 + 1]}) — top edge is y=${box[1]} → ` + (v[i00 + 1] === box[1] ? 'UPRIGHT ✓' : 'MIRRORED ✗'));
    break;
  }
}

// The chair is not hers: measure how far chair pixels travel while she animates.
import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
const art = process.argv[2] ?? 't1_s0';
const doc = JSON.parse(readFileSync(`public/rigs/${art}.obone`, 'utf8'));
const inst = new OpenBoneInstance(doc);
const body = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
const att = inst.skeleton.getAttachment(body);
const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(body, att));
const RECTS = {
  'backrest L': [220, 320, 330, 740],
  'backrest R': [740, 320, 850, 740],
  'armrest L': [70, 570, 190, 690],
  'armrest R': [880, 570, 1000, 690],
  'seat L': [150, 1100, 250, 1170],
};
const rest = V();
for (const anim of ['idle', 'breath', 'tap', 'shake', 'sway', 'turn']) {
  inst.play(anim, false);
  const dur = doc.animations.find((a) => a.name === anim).duration;
  const worst = Object.fromEntries(Object.keys(RECTS).map((k) => [k, 0]));
  for (let f = 0; f < Math.round(dur * 60); f += 2) {
    inst.advance(1/30);
    const v = V();
    for (let i = 0; i < v.length; i += 2) {
      const x = rest[i], y = rest[i + 1];
      const d = Math.hypot(v[i] - x, v[i + 1] - y);
      for (const [k, r] of Object.entries(RECTS)) {
        if (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3] && d > worst[k]) worst[k] = d;
      }
    }
  }
  console.log(anim.padEnd(7), Object.entries(worst).map(([k, v]) => `${k} ${v.toFixed(1)}`).join('  '));
}

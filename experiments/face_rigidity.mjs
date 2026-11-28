// Is her face rigid while she reacts? A face is bone: the distance between two features must not
// change. Measure feature distances on the real mesh through the real runtime.
import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
import { readRigDoc } from '../scripts/rig_doc.mjs';
const art = process.argv[2] ?? 't1_s0';
const doc = readRigDoc(`public/rigs/${art}.obonb`);
const inst = new OpenBoneInstance(doc);
const body = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
const att = inst.skeleton.getAttachment(body);
const verts = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(body, att));
const grid = att.grid ?? { cols: 34, rows: 50 };
const W = doc.width, H = doc.height;
const vAt = (v, x, y) => {
  const col = Math.round((x / W) * grid.cols), row = Math.round((y / H) * grid.rows);
  const i = (row * (grid.cols + 1) + col) * 2;
  return [v[i], v[i + 1]];
};
// Feature points measured off the plate (1024x1526).
const P = { eyeL: [452, 268], eyeR: [600, 268], mouthL: [500, 366], mouthR: [596, 366], chin: [548, 436], browL: [455, 228] };
const pairs = [['eyeL','eyeR'],['eyeL','mouthL'],['eyeR','mouthR'],['eyeL','browL'],['mouthL','chin'],['eyeL','chin']];
const d = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
const rest = verts();
const base = Object.fromEntries(pairs.map(([a,b]) => [`${a}-${b}`, d(vAt(rest, ...P[a]), vAt(rest, ...P[b]))]));
for (const anim of ['idle','breath','tap','shake','sway','turn']) {
  inst.play(anim, false);
  const dur = doc.animations.find((a) => a.name === anim).duration;
  let worst = 0, worstPair = '';
  for (let f = 0; f < Math.round(dur * 60); f++) {
    inst.advance(1/60);
    const v = verts();
    for (const [a, b] of pairs) {
      const k = `${a}-${b}`;
      const rel = Math.abs(d(vAt(v, ...P[a]), vAt(v, ...P[b])) / base[k] - 1);
      if (rel > worst) { worst = rel; worstPair = k; }
    }
  }
  console.log(`${anim.padEnd(7)} face stretch ${(worst*100).toFixed(2)}%  (${worstPair})`);
}

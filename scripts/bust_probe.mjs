// Two breasts, two springs — measured, not described.
//
// The point of splitting `bust` into `bust_left` / `bust_right` is not that there are two bones: it
// is that the two sides do not agree on when the body stopped. That is a claim about a spring, and a
// spring is measurable: this prints, frame by frame, how far each side travels relative to the
// chest, and the gap between the two peaks.
//
//   node scripts/bust_probe.mjs t1_s0
//
// Shipped numbers (t1_s0, `tap`): left peaks at 4.56 px 0.08 s, right at 3.69 px 0.20 s — a 117 ms
// phase gap. Relative to the chest the pair travels 5.55 px on a tap and 2.70 px on a donation, with
// zero folded triangles while it does.
import { readRigDoc } from './rig_doc.mjs';
import { OpenBoneInstance } from '@openbone/runtime';
const art = process.argv[2] ?? 't1_s0';
const doc = readRigDoc(`public/rigs/${art}.obonb`);
const inst = new OpenBoneInstance(doc);
const bones = inst.skeleton.bones;
const pick = (n) => bones.find((b) => (b.data?.name ?? '') === n);
const L = pick('bust_left'), R = pick('bust_right');
if (!L || !R) { console.log('no bust pair on', art); process.exit(0); }
const body = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
const att = inst.skeleton.getAttachment(body);
const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(body, att));
const skin = doc.skeleton.skins[0].attachments.slot_body.miya_body;
const idxOf = (side) => skin.weights.map((w, i) => (w.some((e) => e.bone === `bone_bust_${side}` && e.weight > 0.12) ? i : -1)).filter((i) => i >= 0);
const iL = idxOf('left'), iR = idxOf('right');
const setup = V();
const c = (v, idx) => { let x = 0, y = 0; for (const i of idx) { x += v[i*2]; y += v[i*2+1]; } return [x/idx.length, y/idx.length]; };
const c0L = c(setup, iL), c0R = c(setup, iR);
console.log(`${art}: ${iL.length} verts left, ${iR.length} verts right`);
inst.play('tap', false);
const rows = [];
for (let f = 0; f < 36; f++) {
  inst.advance(1/60);
  const v = V();
  const dL = Math.hypot(c(v,iL)[0]-c0L[0], c(v,iL)[1]-c0L[1]);
  const dR = Math.hypot(c(v,iR)[0]-c0R[0], c(v,iR)[1]-c0R[1]);
  rows.push([f, dL, dR]);
}
for (const [f, dL, dR] of rows) if (f % 3 === 0) console.log(`t=${(f/60).toFixed(2)}s  left ${dL.toFixed(2)} px   right ${dR.toFixed(2)} px   diff ${Math.abs(dL-dR).toFixed(2)}`);
const peakL = Math.max(...rows.map(r => r[1])), peakR = Math.max(...rows.map(r => r[2]));
const fL = (rows.find(r => r[1] === peakL) ?? [0])[0], fR = (rows.find(r => r[2] === peakR) ?? [0])[0];
console.log(`peak left ${peakL.toFixed(2)} px @ ${(fL/60).toFixed(2)}s | peak right ${peakR.toFixed(2)} px @ ${(fR/60).toFixed(2)}s | phase gap ${(Math.abs(fL-fR)/60*1000).toFixed(0)} ms`);

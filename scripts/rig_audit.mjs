// The ghost hunt: folds, streaks, and anything that moves that is not her.
//
// Three defects make a 2D mesh read as "ghosting" on screen, and each has an exact definition, so
// this script measures all three over every animation of every published rig instead of eyeballing
// a preview:
//
//   fold  — a triangle whose signed area flips sign. The texture is drawn back over itself: the
//           same hair edge, twice, on one frame. `mesh_smear` deliberately skips these (it measures
//           stretch), which is why a fold could live in a rig that reported a clean smear table.
//   px    — an edge that grew by more than the rest of the mesh. A sliver can hit a 6x area ratio
//           while nobody sees it, but a 20 px edge is visible, so both are reported and read
//           together.
//   prop  — a vertex pinned to `root` that moved at all. `root` is the chair, the desk, the room
//           and the floor behind her; if one of those moves, the whole picture swims. This is a
//           hard zero, not a budget.
//
//   node scripts/rig_audit.mjs                # every published rig
//   node scripts/rig_audit.mjs t3_s4 t6_s3    # just these
import { existsSync, readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
import { readRigDoc } from '../scripts/rig_doc.mjs';

const DIR = process.env.RIG_DIR ?? 'public/rigs';
const index = JSON.parse(readFileSync('public/rigs/index.json', 'utf8'));
const arts = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(index);

const area = (v, a, b, c) =>
  (v[b * 2] - v[a * 2]) * (v[c * 2 + 1] - v[a * 2 + 1]) - (v[b * 2 + 1] - v[a * 2 + 1]) * (v[c * 2] - v[a * 2]);

const rows = [];
for (const art of arts) {
  // `.obonb` is what ships; `.obone` is what the builder writes, so a candidate build can be
  // audited before it is published — which is the whole point of auditing a candidate.
  const candidates = [
    `${DIR}/${art}.obonb`,
    `${DIR}/${art}.obone`,
    `${DIR}/miya_${art}.obone`,
    ...(art === 't1_s0' ? [`${DIR}/miya_day1.obone`] : []),
  ];
  const path = candidates.find((p) => existsSync(p));
  if (!path) throw new Error(`${art}: no rig in ${DIR}`);
  const doc = readRigDoc(path);
  const inst = new OpenBoneInstance(doc);
  const body = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
  const att = inst.skeleton.getAttachment(body);
  const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(body, att));
  const setup = V();
  const idx = Uint16Array.from(inst.drawList().find((d) => d.image && d.image.id.startsWith('img_miya')).indices);
  const n = idx.length / 3;

  const skin = doc.skeleton.skins[0].attachments.slot_body.miya_body;
  const pinned = []; // vertices that must never move: pure `root`
  for (let i = 0; i < skin.weights.length; i += 1) {
    const w = skin.weights[i];
    const total = w.reduce((s, e) => s + e.weight, 0);
    const root = w.find((e) => e.bone === 'bone_root')?.weight ?? 0;
    if (total > 0 && root / total > 0.999) pinned.push(i);
  }

  const restA = new Float64Array(n);
  const foldable = [];
  for (let t = 0; t < n; t += 1) {
    restA[t] = area(setup, idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);
    if (Math.abs(restA[t]) > 8) foldable.push(t);
  }
  const edgeRest = (v, a, b) => Math.hypot(v[a * 2] - v[b * 2], v[a * 2 + 1] - v[b * 2 + 1]);
  const restEdges = new Float64Array(n * 3);
  for (let t = 0; t < n; t += 1) {
    for (let e = 0; e < 3; e += 1) restEdges[t * 3 + e] = edgeRest(setup, idx[t * 3 + e], idx[t * 3 + ((e + 1) % 3)]);
  }

  let folds = 0;
  let foldAnim = '';
  let foldAt = [0, 0];
  let worstPx = 0;
  let worstPxAnim = '';
  let worstPxAt = [0, 0];
  let propPx = 0;
  let propAnim = '';
  const folded = new Set();
  for (const anim of doc.animations) {
    inst.play(anim.name, false);
    const frames = Math.max(2, Math.round(anim.duration * 60));
    for (let f = 0; f < frames; f += 1) {
      inst.advance(1 / 60);
      const v = V();
      for (const t of foldable) {
        const a = area(v, idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);
        if (a * restA[t] < 0) {
          folds += 1;
          folded.add(t);
          if (!foldAnim) {
            foldAnim = anim.name;
            foldAt = [
              Math.round((v[idx[t * 3] * 2] + v[idx[t * 3 + 1] * 2] + v[idx[t * 3 + 2] * 2]) / 3),
              Math.round((v[idx[t * 3] * 2 + 1] + v[idx[t * 3 + 1] * 2 + 1] + v[idx[t * 3 + 2] * 2 + 1]) / 3),
            ];
          }
        }
        for (let e = 0; e < 3; e += 1) {
          const grown = edgeRest(v, idx[t * 3 + e], idx[t * 3 + ((e + 1) % 3)]) - restEdges[t * 3 + e];
          if (grown > worstPx) {
            worstPx = grown;
            worstPxAnim = anim.name;
            worstPxAt = [
              Math.round((v[idx[t * 3] * 2] + v[idx[t * 3 + 1] * 2] + v[idx[t * 3 + 2] * 2]) / 3),
              Math.round((v[idx[t * 3] * 2 + 1] + v[idx[t * 3 + 1] * 2 + 1] + v[idx[t * 3 + 2] * 2 + 1]) / 3),
            ];
          }
        }
      }
      for (const p of pinned) {
        const d = Math.hypot(v[p * 2] - setup[p * 2], v[p * 2 + 1] - setup[p * 2 + 1]);
        if (d > propPx) {
          propPx = d;
          propAnim = anim.name;
        }
      }
    }
  }
  rows.push({ art, folds, tris: folded.size, foldAnim, foldAt, worstPx, worstPxAnim, worstPxAt, propPx, propAnim, trisAll: n });
  process.stderr.write(`${art} folded=${folded.size} px=${worstPx.toFixed(1)} prop=${propPx.toFixed(2)}\n`);
}

rows.sort((a, b) => b.tris - a.tris || b.worstPx - a.worstPx);
const pad = (s, w) => String(s).padEnd(w);
console.log(`\n${pad('art', 18)}${pad('folded tris', 13)}${pad('fold frames', 13)}${pad('worst px', 10)}${pad('anim', 12)}${pad('where', 14)}${pad('prop px', 9)}`);
for (const r of rows) {
  console.log(
    pad(r.art, 18) +
      pad(`${r.tris}/${r.trisAll}`, 13) +
      pad(r.folds, 13) +
      pad(r.worstPx.toFixed(1), 10) +
      pad(r.worstPxAnim, 12) +
      pad(r.foldAt.join(','), 14) +
      pad(r.propPx.toFixed(2), 9),
  );
}
const bad = rows.filter((r) => r.tris > 0 || r.propPx > 0.01);
console.log(
  `\n${rows.length} rigs | folded: ${rows.filter((r) => r.tris > 0).length} | prop moved: ${rows.filter((r) => r.propPx > 0.01).length} | worst px ${Math.max(...rows.map((r) => r.worstPx)).toFixed(1)}`,
);
if (bad.length) console.log(`needs work: ${bad.map((r) => r.art).join(' ')}`);

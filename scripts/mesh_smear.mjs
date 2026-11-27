// How far does the skin stretch, in the worst place, in the worst frame?
//
// The rig's remaining visible defect is a band at the hair edge that touches the backrest: a part
// that moves meets a part that never does, and the seam falls inside the mesh. This script measures
// the seam instead of describing it — per triangle, per frame, over every animation in the document.
//
//   node scripts/mesh_smear.mjs                 # all published rigs
//   node scripts/mesh_smear.mjs t1_s0 t4_s3     # just these
//   RIG_DIR=/tmp/sub1 node scripts/mesh_smear.mjs t1_s0    # measure a candidate build
//
// Report columns:
//   worst   — the largest (area / rest area) in any frame, and its 1/x twin for squeezing
//   px      — how far the worst edge of that triangle grew, in plate pixels. An area ratio can
//             spike on a sliver nobody can see; a 20 px edge is something a player can see, so the
//             two numbers are read together and never one without the other
//   where   — centroid of that triangle, in plate pixels
//   band    — how many triangles exceed 1.5x at their own worst frame
//   anim    — which animation owns the worst triangle
import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
import { readRigDoc } from '../scripts/rig_doc.mjs';

const DIR = process.env.RIG_DIR ?? 'public/rigs';
const index = JSON.parse(readFileSync('public/rigs/index.json', 'utf8'));
const arts = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(index);

const area = (v, a, b, c) =>
  (v[b * 2] - v[a * 2]) * (v[c * 2 + 1] - v[a * 2 + 1]) - (v[b * 2 + 1] - v[a * 2 + 1]) * (v[c * 2] - v[a * 2]);

const rows = [];
for (const art of arts) {
  const doc = readRigDoc(`${DIR}/${art}.obonb`);
  const inst = new OpenBoneInstance(doc);
  const body = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
  const att = inst.skeleton.getAttachment(body);
  const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(body, att));
  const setup = V();
  const idx = Uint16Array.from(inst.drawList().find((d) => d.image && d.image.id.startsWith('img_miya')).indices);
  const n = idx.length / 3;
  const restA = new Float64Array(n);
  for (let t = 0; t < n; t += 1) restA[t] = area(setup, idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);

  let worst = 1;
  let worstPx = 0;
  let worstPxAnim = '';
  let worstAnim = '';
  let where = [0, 0];
  const edgeRest = (v, a, b) => Math.hypot(v[a * 2] - v[b * 2], v[a * 2 + 1] - v[b * 2 + 1]);
  const restEdges = new Float64Array(n * 3);
  for (let t = 0; t < n; t += 1) {
    for (let e = 0; e < 3; e += 1) {
      restEdges[t * 3 + e] = edgeRest(setup, idx[t * 3 + e], idx[t * 3 + ((e + 1) % 3)]);
    }
  }
  const over = new Float64Array(n);
  for (const anim of doc.animations) {
    inst.play(anim.name, false);
    const frames = Math.max(1, Math.round(anim.duration * 60));
    for (let f = 0; f < frames; f += 1) {
      inst.advance(1 / 60);
      const v = V();
      for (let t = 0; t < n; t += 1) {
        if (!restA[t]) continue;
        const r = area(v, idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]) / restA[t];
        if (r <= 0) continue;
        const s = Math.max(r, 1 / r);
        if (s > over[t]) over[t] = s;
        // Edge growth is tracked on its own, never read off the worst-ratio triangle: a sliver can
        // hit 6x by shearing with its edges untouched, and that is not a smear anybody can see.
        for (let e = 0; e < 3; e += 1) {
          const grown = edgeRest(v, idx[t * 3 + e], idx[t * 3 + ((e + 1) % 3)]) - restEdges[t * 3 + e];
          if (grown > worstPx) {
            worstPx = grown;
            worstPxAnim = anim.name;
          }
        }
        if (s > worst) {
          worst = s;
          worstAnim = anim.name;
          where = [
            (v[idx[t * 3] * 2] + v[idx[t * 3 + 1] * 2] + v[idx[t * 3 + 2] * 2]) / 3,
            (v[idx[t * 3] * 2 + 1] + v[idx[t * 3 + 1] * 2 + 1] + v[idx[t * 3 + 2] * 2 + 1]) / 3,
          ];
        }
      }
    }
  }
  let band = 0;
  for (let t = 0; t < n; t += 1) if (over[t] > 1.5) band += 1;
  rows.push({
    art,
    worst,
    px: worstPx,
    anim: worstAnim,
    pxAnim: worstPxAnim,
    where: `${Math.round(where[0])},${Math.round(where[1])}`,
    band,
    tris: n,
    verts: doc.skeleton.skins[0].attachments.slot_body.miya_body.vertices.length / 2,
  });
}

// Sorted by the number a player can actually see. The area ratio is kept beside it, because the
// two disagree exactly where it matters: a sliver can hit 6x with a 0 px edge change.
rows.sort((a, b) => b.px - a.px);
console.log('art            px  worst  anim        where        band/tris  verts');
for (const r of rows) {
  console.log(
    `${r.art.padEnd(13)} ${r.px.toFixed(1).padStart(4)}  ${r.worst.toFixed(2).padStart(5)}  ${r.pxAnim.padEnd(10)} ${r.where.padEnd(12)} ${`${r.band}/${r.tris}`.padEnd(10)} ${r.verts}`,
  );
}
const mean = rows.reduce((s, r) => s + r.px, 0) / (rows.length || 1);
const bandTotal = rows.reduce((s, r) => s + r.band, 0);
const vertTotal = rows.reduce((s, r) => s + r.verts, 0);
const worstPx = Math.max(...rows.map((r) => r.px));
const worstRatio = Math.max(...rows.map((r) => r.worst));
console.log(
  `\n${rows.length} rigs | worst smear +${worstPx.toFixed(1)} px (${rows[0]?.art}) | worst area ratio ${worstRatio.toFixed(2)} (slivers) | band ${bandTotal} tris | ${vertTotal} verts`,
);

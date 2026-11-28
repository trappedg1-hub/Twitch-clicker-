import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenBoneInstance } from '@openbone/runtime';
import { readPublishedRig } from '../scripts/rig_doc.mjs';

/**
 * How far the skin may stretch, measured in pixels — the only unit a player can see.
 *
 * The rig deforms one texture, so a part that moves always meets a part that does not: the head
 * against the room, the hair against the backrest. That seam is a real limitation, and it is not
 * going away without layered art. What must not happen is the seam *growing*: a weight change that
 * hands a vertex to the wrong bone, or a part boundary that lands on the wrong side of the grid,
 * turns a 6 px seam into a 40 px smear in a single commit and nothing else in the suite notices.
 *
 * The area ratio is reported too, and deliberately not asserted on: it spikes on slivers — t1_s0
 * hits 5.94x with a 0.0 px edge change — so it says nothing about what the screen shows. The edge
 * growth is the honest number (`npm run qa:smear` prints both for all 36 rigs).
 */

// Today's worst is 28.0 px (t2_s3, `turn`), and that is the honest state of a one-texture rig: the
// head moves, the room behind it cannot, and the band between them has to stretch. The limit is a
// runaway alarm, not a target — `npm run qa:smear` prints every plate, so a change that moves these
// numbers is read off the table and this line moves with it, deliberately.
const SMEAR_LIMIT_PX = 32;

// One plate per look — day 1 casual, day 3 the reveal, day 4 the flash plate that shares an art,
// day 5 the hq start, day 6 the mouthless set. The full sweep lives in `npm run qa:smear`.
const ARTS = ['t1_s0', 't2_s3', 't3_s4', 't4_flash', 't5_start_hq2', 't6_s2', 'transparent_s1'];

const area = (v: ArrayLike<number>, a: number, b: number, c: number) =>
  (v[b * 2]! - v[a * 2]!) * (v[c * 2 + 1]! - v[a * 2 + 1]!) - (v[b * 2 + 1]! - v[a * 2 + 1]!) * (v[c * 2]! - v[a * 2]!);
const dist = (v: ArrayLike<number>, a: number, b: number) =>
  Math.hypot(v[a * 2]! - v[b * 2]!, v[a * 2 + 1]! - v[b * 2 + 1]!);

test('no plate smears more than 32 px, and no triangle ever folds', () => {
  const report: string[] = [];
  for (const art of ARTS) {
    const doc = readPublishedRig(art);
    const inst = new OpenBoneInstance(doc);
    const body = inst.skeleton.slots.find((s) => s.data.id === 'slot_body')!;
    const att = inst.skeleton.getAttachment(body)!;
    const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(body, att));
    const setup = V();
    const idx = Uint16Array.from(inst.drawList().find((d) => d.image?.id.startsWith('img_miya'))!.indices!);
    const n = idx.length / 3;
    const restA = new Float64Array(n);
    const restEdge = new Float64Array(n * 3);
    for (let t = 0; t < n; t += 1) {
      restA[t] = area(setup, idx[t * 3]!, idx[t * 3 + 1]!, idx[t * 3 + 2]!);
      for (let e = 0; e < 3; e += 1) {
        restEdge[t * 3 + e] = dist(setup, idx[t * 3 + e]!, idx[t * 3 + ((e + 1) % 3)]!);
      }
    }

    let folds = 0;
    let smear = 0;
    let where = '';
    for (const anim of doc.animations) {
      inst.play(anim.name, false);
      const frames = Math.max(1, Math.round(anim.duration * 60));
      for (let f = 0; f < frames; f += 1) {
        inst.advance(1 / 60);
        const v = V();
        for (let t = 0; t < n; t += 1) {
          if (!restA[t]) continue;
          if (area(v, idx[t * 3]!, idx[t * 3 + 1]!, idx[t * 3 + 2]!) < 0) folds += 1;
          for (let e = 0; e < 3; e += 1) {
            const grown = dist(v, idx[t * 3 + e]!, idx[t * 3 + ((e + 1) % 3)]!) - restEdge[t * 3 + e]!;
            if (grown > smear) {
              smear = grown;
              where = `${anim.name} @${Math.round(v[idx[t * 3]! * 2 + 1]!)}`;
            }
          }
        }
      }
    }
    report.push(`${art}: ${smear.toFixed(1)} px (${where})`);
    assert.equal(folds, 0, `${art}: ${folds} folded triangle-frames`);
    assert.ok(smear < SMEAR_LIMIT_PX, `${art}: ${smear.toFixed(1)} px smear — the seam has grown`);
  }
  console.log(`    ${report.join(' | ')}`);
});

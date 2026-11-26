import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { OpenBoneInstance } from '@openbone/runtime';

/**
 * Is she a character, or a rubber sheet?
 *
 * The second complaint from the player was precise: *«желе, плюс гостинг при тапе… героиня не
 * живая, а просто деформируется»*. Both halves of that have a geometric definition, and this file
 * is those definitions. A rig can pass every schema test and still be a wobbling doll:
 *
 * 1. **Jelly** is a smooth weight field. If every vertex is driven a little by everything, the
 *    picture never articulates — it sags, and a 2° nod travels 70 px because the head, the neck,
 *    the chest and the hair all take a share and pile up. The test below pins the *parts*: the
 *    head moves as one rigid body, the chest barely moves at all, and the ratio between them is
 *    what makes a nod read as a nod.
 * 2. **Ghosting** is a folded or smeared triangle. A skin weight that jumps between neighbouring
 *    vertices drags the texture over itself: the same hair edge drawn at two places on the same
 *    frame. That is measurable exactly — the determinant of the deformation flips sign — and the
 *    first build of this rig folded 547 triangles in a single head turn.
 * 3. **The chair is not hers.** It sat 8 px from her head in the weight field, so every reaction
 *    rocked the backrest. It now sits outside her body envelope and does not move at all.
 * 4. **Alive** is not amplitude, it is *uneven*: a loop that blinks on a metronome reads as a
 *    machine, however smooth it is.
 */

const RIGS = join(import.meta.dirname, '..', 'public', 'rigs');
const MANIFEST = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'public', 'art', 'face_kit', 'manifest.json'), 'utf8'),
) as Record<string, { eyes: number[][] }>;
const ARTS = Object.keys(
  JSON.parse(readFileSync(join(RIGS, 'index.json'), 'utf8')) as Record<string, unknown>,
);

const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);
const triangleArea = (v: Float32Array, a: number, b: number, c: number): number =>
  (v[b * 2]! - v[a * 2]!) * (v[c * 2 + 1]! - v[a * 2 + 1]!) -
  (v[b * 2 + 1]! - v[a * 2 + 1]!) * (v[c * 2]! - v[a * 2]!);

interface Open {
  doc: any;
  instance: any;
  vertices: () => Float32Array;
  indices: Uint16Array;
  grid: { cols: number; rows: number };
  weights: { bone: string; weight: number }[][];
}

function open(art: string): Open {
  const doc = JSON.parse(readFileSync(join(RIGS, `${art}.obone`), 'utf8'));
  const instance = new OpenBoneInstance(doc);
  const body = instance.skeleton.slots.find((s: any) => s.data.id === 'slot_body')!;
  const attachment = instance.skeleton.getAttachment(body)!;
  const vertices = () =>
    Float32Array.from(instance.skeleton.attachmentWorldVertices(body, attachment) as Float32Array);
  const item = instance.drawList().find((i: any) => i.image && String(i.image.id).startsWith('img_'));
  const mesh = doc.skeleton.skins[0].attachments.slot_body.miya_body;
  return {
    doc,
    instance,
    vertices,
    indices: Uint16Array.from(item!.indices as Uint16Array),
    grid: mesh.grid,
    weights: mesh.weights,
  };
}

/** The grid vertex nearest a plate position — the mesh is a regular grid, so this is exact. */
function sample(rig: Open, v: Float32Array, point: [number, number]): number[] {
  const col = Math.round((point[0] / rig.doc.width) * rig.grid.cols);
  const row = Math.round((point[1] / rig.doc.height) * rig.grid.rows);
  const i = (row * (rig.grid.cols + 1) + col) * 2;
  return [v[i]!, v[i + 1]!];
}

function facePoints(art: string): Record<'eye' | 'chin' | 'crown', [number, number]> {
  const eyes = MANIFEST[`heroine_${art}`]!.eyes.map(
    (box) => [(box[0]! + box[2]!) / 2, (box[1]! + box[3]!) / 2] as [number, number],
  );
  const mid: [number, number] = [(eyes[0]![0] + eyes[1]![0]) / 2, (eyes[0]![1] + eyes[1]![1]) / 2];
  const span = dist(eyes[0]!, eyes[1]!);
  return {
    eye: eyes[0]!,
    chin: [mid[0], mid[1] + 1.2 * span],
    crown: [mid[0], mid[1] - 1.5 * span],
  };
}

test('her face is a face: no skin weight stretches it', () => {
  for (const art of ARTS) {
    const points = facePoints(art);
    for (const anim of ['idle', 'tap', 'shake', 'turn', 'sway', 'talk']) {
      const rig = open(art);
      // Arts with a prop at the lips ship no mouth and therefore no `talk`.
      if (!rig.doc.animations.some((a: any) => a.name === anim)) continue;
      const setup = rig.vertices();
      const base = dist(sample(rig, setup, points.eye), sample(rig, setup, points.chin));
      rig.instance.play(anim, true);
      let worst = 0;
      const frames = Math.round(
        rig.doc.animations.find((a: any) => a.name === anim).duration * 60,
      );
      for (let f = 0; f < frames; f += 2) {
        rig.instance.advance(2 / 60);
        const v = rig.vertices();
        const now = dist(sample(rig, v, points.eye), sample(rig, v, points.chin));
        worst = Math.max(worst, Math.abs(now / base - 1));
      }
      // 0.25 % of a 170 px face is 0.4 px: below a pixel at any zoom the game uses.
      assert.ok(worst <= 0.0025, `${art}/${anim}: the face stretches ${(worst * 100).toFixed(2)} %`);
    }
  }
});

test('no triangle ever folds: a fold is the texture drawn twice — the ghost', () => {
  for (const art of ARTS) {
    const rig = open(art);
    const setup = rig.vertices();
    const n = rig.indices.length / 3;
    const rest = new Float64Array(n);
    for (let t = 0; t < n; t++) {
      rest[t] = triangleArea(setup, rig.indices[t * 3]!, rig.indices[t * 3 + 1]!, rig.indices[t * 3 + 2]!);
    }
    for (const anim of rig.doc.animations) {
      rig.instance.play(anim.name, false);
      let folds = 0;
      let worstSquash = 1;
      let worstStretch = 1;
      for (let f = 0; f < Math.round(anim.duration * 60); f += 2) {
        rig.instance.advance(2 / 60);
        const v = rig.vertices();
        for (let t = 0; t < n; t++) {
          if (!rest[t]) continue;
          const ratio =
            triangleArea(v, rig.indices[t * 3]!, rig.indices[t * 3 + 1]!, rig.indices[t * 3 + 2]!) /
            rest[t]!;
          if (ratio <= 0) folds++;
          worstSquash = Math.min(worstSquash, ratio);
          worstStretch = Math.max(worstStretch, ratio);
        }
      }
      assert.equal(folds, 0, `${art}/${anim.name}: ${folds} folded triangles`);
      // A triangle squashed to a fifth of its area is a smear: 19 px of texture drawn over 4 px.
      assert.ok(worstSquash > 0.1, `${art}/${anim.name}: texture squashed x${(1 / worstSquash).toFixed(1)}`);
      assert.ok(worstStretch < 2.5, `${art}/${anim.name}: texture stretched x${worstStretch.toFixed(2)}`);
    }
  }
});

test('the chair she sits on never moves', () => {
  // Visible chair pixels on the day-1 plate, measured off the art: both backrest wings, both
  // armrests, and the seat under her thigh. The plate is the same chair on every day.
  const RECTS: [string, number, number, number, number][] = [
    ['backrest L', 220, 320, 330, 740],
    ['backrest R', 740, 320, 850, 740],
    ['armrest L', 70, 570, 190, 690],
    ['armrest R', 880, 570, 1000, 690],
    ['seat L', 150, 1100, 250, 1170],
    ['seat R', 780, 1100, 880, 1170],
  ];
  const rig = open('t1_s0');
  const setup = rig.vertices();
  for (const anim of rig.doc.animations) {
    rig.instance.play(anim.name, false);
    let worst = 0;
    let where = '';
    for (let f = 0; f < Math.round(anim.duration * 60); f += 2) {
      rig.instance.advance(2 / 60);
      const v = rig.vertices();
      for (let i = 0; i < v.length; i += 2) {
        const x = setup[i]!;
        const y = setup[i + 1]!;
        for (const [name, x0, y0, x1, y1] of RECTS) {
          if (x < x0 || x > x1 || y < y0 || y > y1) continue;
          const d = Math.hypot(v[i]! - x, v[i + 1]! - y);
          if (d > worst) {
            worst = d;
            where = name;
          }
        }
      }
    }
    assert.ok(worst <= 0.5, `${anim.name}: the ${where} moves ${worst.toFixed(1)} px with her`);
  }
});

test('articulation, not amplitude: the head acts, the torso sits', () => {
  const rig = open('t1_s0');
  const setup = rig.vertices();
  const pure = (bone: string) =>
    rig.weights
      .map((set, i) => (set.length === 1 && set[0]!.bone === bone && set[0]!.weight > 0.95 ? i : -1))
      .filter((i) => i >= 0);
  const headVerts = pure('bone_head');
  const chestVerts = pure('bone_chest');
  assert.ok(headVerts.length > 50, 'the head has almost no vertices of its own');
  assert.ok(chestVerts.length > 20, 'the chest has almost no vertices of its own');

  const travel = (anim: string) => {
    rig.instance.play(anim, false);
    let head = 0;
    let chest = 0;
    for (let f = 0; f < Math.round(rig.doc.animations.find((a: any) => a.name === anim).duration * 60); f += 2) {
      rig.instance.advance(2 / 60);
      const v = rig.vertices();
      for (const i of headVerts) head = Math.max(head, Math.hypot(v[i * 2]! - setup[i * 2]!, v[i * 2 + 1]! - setup[i * 2 + 1]!));
      for (const i of chestVerts) chest = Math.max(chest, Math.hypot(v[i * 2]! - setup[i * 2]!, v[i * 2 + 1]! - setup[i * 2 + 1]!));
    }
    return { head, chest };
  };

  const tap = travel('tap');
  // A nod has to be visible on a phone (~2 px of screen) and the hoodie must stay put while it
  // happens — that is what separates an articulated head from a deforming picture.
  assert.ok(tap.head >= 2.5 && tap.head <= 13, `tap moves the head ${tap.head.toFixed(1)} px`);
  assert.ok(tap.chest <= 3, `tap drags the chest ${tap.chest.toFixed(1)} px`);
  assert.ok(tap.head > tap.chest * 1.8, 'the tap is a body warp rather than a nod');

  const shake = travel('shake');
  assert.ok(shake.head >= 8 && shake.head <= 40, `shake moves the head ${shake.head.toFixed(1)} px`);
  assert.ok(shake.chest <= 8, `shake drags the chest ${shake.chest.toFixed(1)} px`);

  const idle = travel('idle');
  assert.ok(idle.head >= 4 && idle.head <= 24, `idle moves the head ${idle.head.toFixed(1)} px`);
  assert.ok(idle.chest <= 8, `idle drags the chest ${idle.chest.toFixed(1)} px`);
});

test('she blinks like a person: often enough, never on the beat', () => {
  for (const art of ARTS) {
    const doc = JSON.parse(readFileSync(join(RIGS, `${art}.obone`), 'utf8'));
    const idle = doc.animations.find((a: any) => a.name === 'idle');
    const eyes = idle.timelines.find((t: any) => t.target === 'slot' && t.id === 'slot_eyes');
    assert.ok(eyes, `${art}: idle has no eyelid track — she never blinks`);
    const closes = eyes.keys
      .filter((k: any) => k.value === 'eyes_closed')
      .map((k: any) => k.time as number);
    assert.ok(closes.length >= 4, `${art}: only ${closes.length} blinks in an 8 s loop`);

    const gaps = closes.slice(1).map((t: number, i: number) => t - closes[i]!);
    // At least one blink has to come early or late against the others, or the loop is a metronome.
    const spread = Math.max(...gaps) - Math.min(...gaps);
    assert.ok(spread > 0.3, `${art}: every blink is ${gaps[0]!.toFixed(2)} s after the last`);
    // A double blink: two lids inside a quarter of a second, which a metronome never does.
    const double = closes.some((t: number, i: number) => i > 0 && t - closes[i - 1]! < 0.25);
    assert.ok(double, `${art}: no double blink anywhere in the loop`);
  }
});

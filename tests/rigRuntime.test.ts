import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { OpenBoneInstance } from '@openbone/runtime';

/**
 * What the rig actually does once a runtime is driving it.
 *
 * `rig.test.ts` checks the documents; this file drives them through the real `@openbone/runtime`
 * and measures the result — the same code the browser runs, minus the pixels. Three things went
 * wrong on a phone that only this kind of check catches:
 *
 * 1. **Jelly.** Breathing used to scale the chest bone by 3 %. Everything above the chest scales
 *    with it, so her head travelled 24 px twice per loop. The document was valid, the previews
 *    looked fine at a glance, and the screen showed a wobbling doll.
 * 2. **Blinking off the eyes.** Face patches were authored as `region` attachments, which place
 *    their corners in bone-local y-UP space. On these y-down documents the closed-eye picture was
 *    pasted upside down over her eyebrows.
 * 3. **Mouth that stayed shut.** The talk pass was written as two timelines for the same slot; the
 *    runtime keys a slot once per track, so the second one silently won and she only spoke in the
 *    second half of every loop.
 *
 * Each of those is one assertion here.
 */

const RIGS = join(import.meta.dirname, '..', 'public', 'rigs');
const MANIFEST = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'public', 'art', 'face_kit', 'manifest.json'), 'utf8'),
) as Record<string, { patches?: Record<string, { cx: number; cy: number; w: number; h: number }> }>;

const ARTS = Object.keys(
  JSON.parse(readFileSync(join(RIGS, 'index.json'), 'utf8')) as Record<string, unknown>,
);

function open(art: string) {
  const doc = JSON.parse(readFileSync(join(RIGS, `${art}.obone`), 'utf8'));
  const instance = new OpenBoneInstance(doc);
  const body = instance.skeleton.slots.find((s) => s.data.id === 'slot_body')!;
  const vertices = () =>
    instance.skeleton.attachmentWorldVertices(body, instance.skeleton.getAttachment(body)!);
  return { doc, instance, vertices };
}

test('idle is a breath, not a wobble', () => {
  for (const art of ARTS) {
    const { instance, vertices } = open(art);
    const setup = Float32Array.from(vertices());
    instance.play('idle', true);
    let body = 0;
    let floor = 0;
    for (let frame = 0; frame < 240; frame++) {
      instance.advance(1 / 60);
      const v = vertices();
      for (let i = 0; i < v.length; i += 2) {
        const dx = v[i]! - setup[i]!;
        const dy = v[i + 1]! - setup[i + 1]!;
        const d = Math.hypot(dx, dy);
        if (setup[i + 1]! > 1400) floor = Math.max(floor, d);
        else body = Math.max(body, d);
      }
    }
    // A calm breath plus the hair and bust springs: single digits. Anything near 20 px is the doll
    // wobble that shipped once.
    assert.ok(body <= 6, `${art}: idle moves her body ${body.toFixed(1)} px (limit 6)`);
    assert.ok(floor <= 0.6, `${art}: idle moves the desk/floor ${floor.toFixed(2)} px (limit 0.6)`);
  }
});

test('face patches are meshes with an upright picture, centred on the real eyes and mouth', () => {
  for (const art of ARTS) {
    const { doc } = open(art);
    const skin = doc.skeleton.skins[0].attachments as Record<string, Record<string, { type: string }>>;
    for (const [slot, attachments] of Object.entries(skin)) {
      if (slot === 'slot_body') continue;
      for (const [name, attachment] of Object.entries(attachments)) {
        assert.equal(
          attachment.type,
          'mesh',
          `${art}/${slot}/${name}: a region would be pasted y-flipped — author a mesh`,
        );
      }
    }

    const manifest = MANIFEST[`heroine_${art}`];
    assert.ok(manifest?.patches, `${art}: no face-kit manifest entry`);

    const check = (imagePart: string, patchKey: string, at: number, anim: string) => {
      const run = open(art);
      run.instance.play(anim, true);
      let found: { box: number[]; uv: number[]; verts: number[] } | null = null;
      for (let frame = 0; frame < 240 && !found; frame++) {
        run.instance.advance(1 / 60);
        if ((frame + 1) / 60 < at) continue;
        const item = run.instance
          .drawList()
          .find((i) => String(i.image?.id ?? '').includes(imagePart));
        if (item) {
          const verts = Array.from(item.vertices as Float32Array);
          const xs = verts.filter((_, i) => i % 2 === 0);
          const ys = verts.filter((_, i) => i % 2 === 1);
          found = {
            verts,
            box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
            uv: Array.from(item.uvs as Float32Array),
          };
        }
      }
      assert.ok(found, `${art}: ${anim} never showed ${patchKey}`);
      const spec = manifest.patches![patchKey]!;
      const cx = (found!.box[0]! + found!.box[2]!) / 2;
      const cy = (found!.box[1]! + found!.box[3]!) / 2;
      assert.ok(
        Math.abs(cx - spec.cx) <= 5 && Math.abs(cy - spec.cy) <= 5,
        `${art}/${patchKey}: drawn at (${cx.toFixed(0)}, ${cy.toFixed(0)}), the artwork says (${spec.cx}, ${spec.cy})`,
      );
      assert.ok(
        Math.abs(found!.box[2]! - found!.box[0]! - spec.w) <= 2 &&
          Math.abs(found!.box[3]! - found!.box[1]! - spec.h) <= 2,
        `${art}/${patchKey}: quad is not the patch size`,
      );
      // uv (0,0) must land on the TOP edge (smallest y), or the picture is upside down.
      const flat = found!.uv;
      const topLeft = flat.findIndex((u, i) => i % 2 === 0 && u === 0 && flat[i + 1] === 0);
      assert.ok(topLeft >= 0, `${art}/${patchKey}: no uv (0,0) corner`);
      assert.equal(
        found!.verts[topLeft + 1],
        found!.box[1],
        `${art}/${patchKey}: the picture is pasted upside down`,
      );
    };

    check('eyes_closed', 'eyes_closed', 1.1, 'idle');
    if (manifest.patches!.mouth_open) check('mouth_open', 'mouth_open', 0.15, 'idle_talk');
  }
});

test('she talks from the first beat, not from the second half of the loop', () => {
  for (const art of ARTS) {
    const { doc, instance } = open(art);
    const hasMouth = doc.skeleton.slots.some((s: { id: string }) => s.id === 'slot_mouth');
    if (!hasMouth) continue;
    const talkTimelines = doc.animations
      .find((animation: { name: string }) => animation.name === 'idle_talk')
      .timelines.filter((t: { target: string; id: string }) => t.target === 'slot' && t.id === 'slot_mouth');
    // One timeline, two passes: two timelines for one slot are deduplicated by the runtime.
    assert.equal(talkTimelines.length, 1, `${art}: idle_talk has ${talkTimelines.length} mouth timelines`);

    instance.play('idle_talk', true);
    let opened = false;
    for (let frame = 0; frame < 30; frame++) {
      instance.advance(1 / 60);
      if (instance.drawList().some((i) => String(i.image?.id ?? '').includes('mouth_open'))) {
        opened = true;
        break;
      }
    }
    assert.ok(opened, `${art}: the mouth never opens in the first half second of idle_talk`);
  }
});

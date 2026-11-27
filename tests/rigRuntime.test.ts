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
    const { doc, instance, vertices } = open(art);
    const setup = Float32Array.from(vertices());
    // Her head and the hair hanging off it are excluded here on purpose. That mass is one rigid
    // body that looks around, and its travel is the whole point of `rigLife.test.ts` ("the head
    // acts, the torso sits"). Capping it with the torso is exactly what forced the old soft rig
    // to smear a 6-degree wobble through the whole picture before it read at all. What this test
    // still owns is everything below the neck: shoulders, bust, hips, thighs on the chair.
    //
    // "Head" is decided by anatomy, not by a weight threshold: everything above the neck joint,
    // plus whatever is mostly bone_hair_back — the strand mass that falls past the jaw. A
    // threshold on the head share would shift with the mesh, and the hair edge (85 % head, 15 %
    // root) would keep leaking into "body" as an 18 px wobble that is not there.
    const bones = doc.skeleton.bones as { name: string; y: number }[];
    const neckY = bones.find((b) => b.name === 'neck')?.y ?? 0;
    const mesh = doc.skeleton.skins[0].attachments.slot_body.miya_body as {
      weights: { bone: string; weight: number }[][];
    };
    const HEADS = new Set(['bone_head', 'bone_hair_back']);
    const headOnly = new Set(
      mesh.weights
        .map((w, i) => {
          const share = w.reduce((sum, part) => sum + (HEADS.has(part.bone) ? part.weight : 0), 0);
          const y = setup[i * 2 + 1]!;
          return y < neckY || share > 0.5 ? i : -1;
        })
        .filter((i) => i >= 0),
    );
    let head = 0;
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
        else if (headOnly.has(i / 2)) head = Math.max(head, d);
        else body = Math.max(body, d);
      }
    }
    // A calm breath plus the hair and bust springs: single digits. Anything near 20 px is the doll
    // wobble that shipped once. Idle now ALSO drifts her head (a rigid head that looks around) and
    // that is the one part allowed to travel: see `rigLife.test.ts`, which checks articulation —
    // the head moves, the torso does not — instead of capping everything at one number.
    assert.ok(body <= 16, `${art}: idle moves her body ${body.toFixed(1)} px (limit 16)`);
    // The head is allowed to travel — but not without limit: a 20 s idle whose deepest glance
    // throws her crown 40 px is a headbang, not a look around.
    assert.ok(head <= 30, `${art}: idle throws her head ${head.toFixed(1)} px (limit 30)`);
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

    // Measured on `blink`, which moves no bones: the patch has to sit on her eyes in the rest
    // pose. (Idle turns her head now, so a patch measured there is a patch measured mid-nod.)
    check('eyes_closed', 'eyes_closed', 0.06, 'blink');
    // The mouth is measured on `talk`, not on `idle_talk`: `idle_talk` is the twenty-second sitting
    // loop now, and at 0.15 s her head is already a hundredth of a degree into a glance — enough
    // that the patch is no longer axis-aligned and "the top-left corner is the top edge" fails by
    // 0.06 px. `talk` moves no bones at all, so there the check means what it says.
    if (manifest.patches!.mouth_open) check('mouth_open', 'mouth_open', 0.15, 'talk');
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

test('a tap is a nod, a donation is a beat — and neither keeps wobbling', () => {
  for (const art of ARTS) {
    const { doc } = open(art);
    const names = doc.animations.map((animation: { name: string }) => animation.name);
    assert.ok(names.includes('tap'), `${art}: no tap animation`);
    assert.ok(names.includes('shake'), `${art}: no shake animation`);

    const amplitude = (anim: string, retriggerMs = 0) => {
      const run = open(art);
      const setup = Float32Array.from(run.vertices());
      run.instance.play('idle', true);
      let max = 0;
      const step = Math.max(1, Math.round(retriggerMs / (1000 / 60)));
      for (let frame = 0; frame < 220; frame++) {
        if (frame === 20) run.instance.play(anim, false);
        if (retriggerMs && frame > 20 && (frame - 20) % step === 0) run.instance.play(anim, false);
        run.instance.advance(1 / 60);
        const v = run.vertices();
        for (let i = 0; i < v.length; i += 2) {
          max = Math.max(max, Math.hypot(v[i]! - setup[i]!, v[i + 1]! - setup[i + 1]!));
        }
      }
      return max;
    };

    // Bone levers are long, so these are not "big" numbers in degrees — they are pixels on a
    // 1526 px canvas. The first shake shipped at 70 px over a full second and read as jelly.
    const tap = amplitude('tap');
    assert.ok(tap <= 12, `${art}: tap moves her ${tap.toFixed(1)} px (limit 12)`);
    // A clicker fires faster than a beat lasts: the retriggered reaction must not pile up.
    const tapped = amplitude('tap', 100);
    assert.ok(tapped <= 12, `${art}: tap retriggered every 100 ms reaches ${tapped.toFixed(1)} px`);

    const shake = amplitude('shake');
    assert.ok(shake <= 32, `${art}: shake moves her ${shake.toFixed(1)} px (limit 32)`);

    // ...and it has to END: a spring that keeps ringing is the wobble the player complained about.
    const run = open(art);
    const setup = Float32Array.from(run.vertices());
    run.instance.play('idle', true);
    let tail = 0;
    for (let frame = 0; frame < 200; frame++) {
      if (frame === 20) run.instance.play('shake', false);
      run.instance.advance(1 / 60);
      if (frame < 130) continue; // 2 s after the reaction
      const v = run.vertices();
      for (let i = 0; i < v.length; i += 2) {
        tail = Math.max(tail, Math.hypot(v[i]! - setup[i]!, v[i + 1]! - setup[i + 1]!));
      }
    }
    assert.ok(tail <= 2, `${art}: still moving ${tail.toFixed(1)} px two seconds after the reaction`);
  }
});

// Dump the exact draw list the browser would draw, frame by frame, as JSON.
// Used by scripts/rig_preview.py to rasterise what a phone shows — there is no browser here.
//   node experiments/dump_frames.mjs t1_s0 tap 1.0 60 > /tmp/tap.json
//
// Optional live-gaze arguments (the feature the game actually runs, see `src/heroine/gaze.ts`):
//   --gaze=0.8          hold a look to the right (normalised −1..1)
//   --sweep=6           the pointer sweeps left↔right every 6 s, like a player moving a mouse
//
// And the reaction path, exactly as `LiveHeroine.react` runs it: the idle loop first, then the
// reaction cross-faded in on top of it.
//   --after=1.2         how long she has been idling before the reaction
//   --mix=0.08          the cross-fade the runtime uses (0.2 is the library default and eats the nod)
import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
import { applyGaze, aimFromPointer, gazeDegrees, GazeSpring } from '../src/heroine/gaze.ts';

const [, , art = 't1_s0', anim = 'tap', seconds = '1.0', fps = '60'] = process.argv;
// argv[6] is the optional .obone override — unless it is a flag (`--sweep=6`).
const docPath = process.argv[6] && !process.argv[6].startsWith('--') ? process.argv[6] : undefined;
const doc = JSON.parse(
  readFileSync(docPath ?? new URL(`../public/rigs/${art}.obone`, import.meta.url), 'utf8'),
);
const instance = new OpenBoneInstance(doc);

const flag = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : null;
};
const gaze = flag('gaze');
const sweep = flag('sweep');
const mix = flag('mix');
const after = flag('after') ?? 1.2;
const live = new GazeSpring();
// A live gaze needs a looping animation: the whole point is that she keeps looking while the loop
// underneath carries on.
if (mix !== null) instance.play('idle', true);
else instance.play(anim, gaze !== null || sweep !== null);
let switched = false;
let resumed = false;

const frames = [];
const dt = 1 / Number(fps);
const count = Math.round(Number(seconds) * Number(fps));
for (let f = 0; f < count; f++) {
  if (mix !== null && !switched && f * dt >= after) {
    instance.animationState.setAnimation(0, anim, false, mix);
    switched = true;
  }
  // `LiveHeroine.update` hands her back to the idle loop when `reactionUntil` (480 ms for a tap)
  // runs out, before the beat has finished — the clip shows that hand-back too.
  if (mix !== null && switched && !resumed && f * dt >= after + 0.48) {
    instance.play('idle', true);
    resumed = true;
  }
  instance.advance(dt);
  if (gaze !== null || sweep !== null) {
    // Exactly what `LiveHeroine.update` does each frame: aim, step the spring, write after the
    // animation, rebuild the world matrices.
    const pointerX = sweep ? Math.sin((2 * Math.PI * f * dt) / sweep) * 0.9 : gaze;
    live.aim(aimFromPointer(pointerX, 0).x, 0);
    applyGaze(instance.skeleton, gazeDegrees(live.step(dt)));
  }
  const items = instance.drawList().map((d) => ({
    image: d.image ? d.image.id : null,
    uvs: Array.from(d.uvs),
    vertices: Array.from(d.vertices),
    indices: Array.from(d.indices),
    color: d.color,
  }));
  frames.push({ t: f * dt, items });
}
process.stdout.write(
  JSON.stringify({ art, anim, frames, width: doc.width, height: doc.height, docPath: docPath ?? null }),
);

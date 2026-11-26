// Dump the exact draw list the browser would draw, frame by frame, as JSON.
// Used by scripts/rig_preview.py to rasterise what a phone shows — there is no browser here.
//   node experiments/dump_frames.mjs t1_s0 tap 1.0 60 > /tmp/tap.json
import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';

const [, , art = 't1_s0', anim = 'tap', seconds = '1.0', fps = '60'] = process.argv;
const docPath = process.argv[6];
const doc = JSON.parse(
  readFileSync(docPath ?? new URL(`../public/rigs/${art}.obone`, import.meta.url), 'utf8'),
);
const instance = new OpenBoneInstance(doc);
instance.play(anim, false);

const frames = [];
const dt = 1 / Number(fps);
const count = Math.round(Number(seconds) * Number(fps));
for (let f = 0; f < count; f++) {
  instance.advance(dt);
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

// Publish the per-art rigs to `public/rigs/` in the form the game loads.
//
// The authored documents in `experiments/rig-lab` are pretty-printed JSON (~1.6 MB each) so they
// can be read and diffed. What ships is the OpenBone **binary** document (`.obonb`): the runtime
// detects it from the bytes (`parseDocument`), so nothing in the game changes but the extension.
//
// It is roughly half the JSON: t1_s0 is 670 KB as minified JSON and 319 KB as .obonb, and the whole
// set went 22.5 MB → 11 MB. The JSON is not kept next to it on purpose — a second copy of the same
// rigs doubles the repo for nothing, and the lab documents are the source anyway.
//
//   node scripts/publish_rigs.mjs
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument, serializeBinary } from '@openbone/core';

const SRC = 'experiments/rig-lab';
const OUT = 'public/rigs';

// `miya_day1.obone` is the day-1 opening plate — `/art/heroine_t1_s0.webp`, not `t1_base`.
const artOf = (file) => file.replace(/^miya_day1\.obone$/, 't1_s0').replace(/^miya_/, '').replace(/\.obone$/, '');

mkdirSync(OUT, { recursive: true });
const index = {};
let total = 0;
let jsonTotal = 0;

for (const file of readdirSync(SRC).filter((f) => f.startsWith('miya_') && f.endsWith('.obone')).sort()) {
  const art = artOf(file);
  const text = readFileSync(join(SRC, file), 'utf8');
  // `parseDocument` takes the authored JSON bytes and normalises the document, which is exactly what
  // the runtime used to do after `JSON.parse` — so the binary is built from a document the game has
  // already blessed rather than from a second, hand-rolled reading of the format.
  const doc = parseDocument(new Uint8Array(Buffer.from(text)));
  doc.scripts ??= [];
  const bytes = serializeBinary(doc);
  const target = join(OUT, `${art}.obonb`);
  writeFileSync(target, bytes);
  total += bytes.length;
  jsonTotal += text.length;
  // The breath clip's length is published, not just its name: the room's ambience has to breathe at
  // the tempo her chest was authored at, and `tests/roomPlan.test.ts` reads this number to check it.
  // A retuned chest therefore moves the room in the same commit instead of drifting a beat behind it.
  const breath = doc.animations.find((a) => a.name === 'breath');
  index[art] = {
    file: `${'/rigs/'}${art}.obonb`,
    plate: doc.images[0].src,
    animations: doc.animations.map((a) => a.name),
    hasMouth: doc.skeleton.slots.some((s) => s.id === 'slot_mouth'),
    bones: doc.skeleton.bones.length,
    breathSec: breath ? Math.round(breath.duration * 100) / 100 : null,
    bytes: bytes.length,
  };
  console.log(`  ${art.padEnd(14)} ${String(Math.round(bytes.length / 1024)).padStart(5)} KB  ${doc.animations.length} animations`);
}

// Anything the previous publisher left in the JSON format is stale the moment this runs.
for (const file of readdirSync(OUT)) {
  if (file.endsWith('.obone')) rmSync(join(OUT, file));
}

writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 1));
console.log(
  `\n${Object.keys(index).length} rigs, ${(total / 1024 / 1024).toFixed(1)} MB of .obonb ` +
    `(authored JSON was ${(jsonTotal / 1024 / 1024).toFixed(1)} MB), index.json ${Math.round(statSync(join(OUT, 'index.json')).size / 1024)} KB`,
);

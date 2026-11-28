// The tap as the game actually plays it: idle loop + live gaze every frame, then the reaction
// cross-faded in — measure the peak the player sees and when it lands.
//   node experiments/_tap_live.mjs <doc.obonb> <mix> [phase] [art]
import { readFileSync } from 'node:fs';
import { OpenBoneInstance } from '@openbone/runtime';
import { applyGaze, gazeDegrees, GazeSpring, aimFromPointer } from '../src/heroine/gaze.ts';

const docPath = process.argv[2] ?? 'public/rigs/t1_s0.obonb';
const mix = Number(process.argv[3] ?? 0.06);
const doc = JSON.parse(readFileSync(docPath, 'utf8'));

function run(phase) {
  const inst = new OpenBoneInstance(doc);
  const slot = inst.skeleton.slots.find((s) => s.data.id === 'slot_body');
  const att = inst.skeleton.getAttachment(slot);
  const V = () => Float32Array.from(inst.skeleton.attachmentWorldVertices(slot, att));
  const spring = new GazeSpring();
  inst.play('idle', true);
  // the player's finger is on her face the whole time — the worst case for the gaze eating the nod
  const aim = aimFromPointer(0.55, -0.1);
  spring.aim(aim.x, aim.y);
  const frames = Math.round(phase * 60);
  for (let f = 0; f < frames; f++) {
    inst.advance(1 / 60);
    const g = spring.step(1 / 60);
    if (!spring.settled) applyGaze(inst.skeleton, gazeDegrees(g));
  }
  const base = V();
  inst.animationState.setAnimation(0, 'tap', false, mix);
  let peak = 0;
  let at = 0;
  let felt = 0;
  for (let f = 1; f <= 36; f++) {
    inst.advance(1 / 60);
    const g = spring.step(1 / 60);
    if (!spring.settled) applyGaze(inst.skeleton, gazeDegrees(g));
    const v = V();
    let now = 0;
    for (let i = 0; i < v.length; i += 2) {
      const d = Math.hypot(v[i] - base[i], v[i + 1] - base[i + 1]);
      if (d > now) now = d;
    }
    if (now >= 8 && !felt) felt = f;
    if (now > peak) {
      peak = now;
      at = f / 60;
    }
  }
  return { peak, at, felt: felt / 60 };
}

const rows = [];
for (const phase of [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]) rows.push(run(phase));
const peaks = rows.map((r) => r.peak).sort((a, b) => a - b);
const felt = Math.max(...rows.map((r) => r.felt));
console.log(
  `${docPath.split('/').pop()} mix ${mix}: peak min ${peaks[0].toFixed(1)}  median ${peaks[5].toFixed(1)}  max ${peaks.at(-1).toFixed(1)} px` +
    `   (she has moved 8 px within ${felt.toFixed(2)} s on every beat)`
);

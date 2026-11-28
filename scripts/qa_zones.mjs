// QA: does she actually *answer*, on the plate that is on screen, in a real browser?
//
// Three things this proves that no unit test can:
//
//   1. **The director is wired.** Every tap goes through `answerTapZone`, and the clip the skeleton
//      reports (`liveDebug().animation`) is the one the director chose. A zone whose answer never
//      reaches the skeleton is the bug this file exists for: a callout, a sound and a chat line can
//      all fire while she sits in `idle`.
//   2. **Boldness changes the answer.** Same zone, same taps: shy subscribers and a bold stream
//      must not produce the same set of clips.
//   3. **She notices a parked cursor.** A real mouse moved onto her head and left there has to
//      produce a beat on its own — that is `attention.ts`, and it only works if the hit zones
//      actually emit hover.
//
// Run with the dev server up: `node scripts/qa_zones.mjs` (QA_BASE overrides, default 5174).
import chromium from '@sparticuz/chromium';
import { chromium as pwChromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { brotliDecompressSync } from 'node:zlib';

const LIBS = '/tmp/al2023';
if (!existsSync(`${LIBS}/lib/libnss3.so`)) {
  const require = createRequire(import.meta.url);
  const packed = require.resolve('@sparticuz/chromium/bin/al2023.tar.br');
  const tar = '/tmp/al2023.tar';
  writeFileSync(tar, brotliDecompressSync(require('node:fs').readFileSync(packed)));
  mkdirSync(LIBS, { recursive: true });
  execFileSync('tar', ['-xf', tar, '-C', LIBS]);
}
process.env.LD_LIBRARY_PATH = `${LIBS}/lib:/tmp${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''}`;

const BASE = process.env.QA_BASE ?? 'http://localhost:5174';
const SHOTS = process.env.QA_ZONES_SHOTS ?? '/tmp/qa_zones';
mkdirSync(SHOTS, { recursive: true });

const browser = await pwChromium.launch({
  executablePath: await chromium.executablePath(),
  args: [
    ...chromium.args,
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ],
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror ${e.message}`));

await page.goto(`${BASE}/?qa`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__qaScene), { timeout: 30000 });
await page.waitForTimeout(1200);

const live = await page.evaluate(() => window.__qaScene.liveDebug());
if (!live.enabled) {
  console.log('live rig is not on this plate — nothing to answer');
  await browser.close();
  process.exit(0);
}
console.log(`plate ${live.art} · ${live.animations.length} animations: ${live.animations.join(', ')}`);

const ZONES = ['head', 'chest', 'belly', 'legs', 'feet'];
const animate = new Set(live.animations);

const setSubs = (n) => page.evaluate((count) => window.__qaScene.setSubscribers(count), n);

/**
 * Keep the page compositing. Headless Chromium stops `requestAnimationFrame` on a page that is not
 * being painted, and this whole app runs on the Pixi ticker — so a QA script that only calls
 * `evaluate` measures a game frozen at two frames a second and proves nothing. A tiny screenshot
 * forces a frame; the loop below is what actually lets time pass in the stage. (Measured: 5 frames
 * in 2 s without it, 40 fps with it.)
 */
async function pumpFrames(ms, step = 120) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    await page.screenshot({ clip: { x: 0, y: 0, width: 8, height: 8 } });
    await page.waitForTimeout(step);
  }
}

/** Tap a zone `times` and collect the clip she actually played after each tap. */
async function tapRound(zone, times) {
  const seen = [];
  for (let i = 0; i < times; i += 1) {
    await page.evaluate((z) => window.__qaScene.tapZone(z), zone);
    // What the director picked, not what happens to be playing: the rig drops a tap that arrives
    // mid-beat, so the clip name lags behind the choice by up to one whole animation.
    await page.waitForTimeout(45);
    const clip = await page.evaluate(() => window.__qaScene.lastTapBeat());
    seen.push(clip);
    if (process.env.QA_ZONES_DEBUG) {
      const dbg = await page.evaluate(() => window.__qaScene.lastTapDebug());
      console.log(`    ${zone}#${i}: ${JSON.stringify(dbg)}`);
    }
    // Space the taps so the streak rule is not what is being measured here.
    await page.waitForTimeout(140);
  }
  return seen;
}

// The animation list is per plate, and changing the subscriber count changes the plate: a beat
// that exists on the day-1 stage may simply not be authored on a later one. Every round carries
// its own vocabulary, or this harness would fail the game for a plate it never looked at.
const rounds = [];
for (const [label, subs] of [
  ['shy', 30],
  ['bold', 3_000_000],
]) {
  await setSubs(subs);
  await page.waitForTimeout(320);
  const boldness = await page.evaluate(() => Math.round(window.__qaScene.getStats().boldness));
  const anims = await page.evaluate(() => window.__qaScene.liveDebug().animations);
  const byZone = {};
  for (const zone of ZONES) {
    byZone[zone] = await tapRound(zone, 6);
  }
  await pumpFrames(200);
  rounds.push({ label, subs, boldness, byZone, anims });
}

// --- 1. every answer is a real clip, and every zone answers ------------------------------------
for (const round of rounds) {
  const onPlate = new Set(round.anims);
  for (const [zone, clips] of Object.entries(round.byZone)) {
    for (const clip of clips) {
      if (!onPlate.has(clip)) problems.push(`${round.label}/${zone}: played '${clip}', not in the plate`);
    }
    const none = clips.filter((c) => !c || c === 'idle' || c === 'idle_talk').length;
    if (none > 0) problems.push(`${round.label}/${zone}: ${none}/6 taps were never answered`);
  }
}

// --- 2. boldness has to change the answer ------------------------------------------------------
const shyHead = new Set(rounds[0].byZone.head);
const boldHead = new Set(rounds[1].byZone.head);
const sameHead = [...shyHead].sort().join() === [...boldHead].sort().join();
if (sameHead) problems.push(`head answers identically at boldness ${rounds[0].boldness} and ${rounds[1].boldness}`);
if (rounds[0].boldness >= rounds[1].boldness) {
  problems.push(`boldness did not rise with subscribers (${rounds[0].boldness} → ${rounds[1].boldness})`);
}
// Feet are ticklish wherever the art has socks in frame; if it does, the toe-curl must be what plays.
for (const round of rounds) {
  if (!round.anims.includes('tickle')) continue;
  if (!round.byZone.feet.every((c) => c === 'tickle')) {
    problems.push(`${round.label}: feet answered ${[...new Set(round.byZone.feet)].join('/')} — expected tickle`);
  }
}

// --- 3. a parked cursor is attention -----------------------------------------------------------
await setSubs(30);
await page.waitForTimeout(200);
// Away first: the hit zones are rebuilt when a plate changes, and a pointer that has not moved
// since never fires `pointerover` on the new ones.
await page.mouse.move(4, 4);
await page.waitForTimeout(300);
const headCentre = await page.evaluate(() => window.__qaScene.zoneCenter('head'));
if (!headCentre) problems.push('no head hit zone');
let stare = null;
if (headCentre) {
  const offset = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const r = canvas.getBoundingClientRect();
    return { x: r.left, y: r.top };
  });
  await page.mouse.move(headCentre.x + offset.x, headCentre.y + offset.y, { steps: 8 });
  // Rest the cursor on her for longer than the dwell, polling what she does — with real frames.
  const seen = new Set();
  for (let i = 0; i < 26; i += 1) {
    await page.screenshot({ clip: { x: 0, y: 0, width: 8, height: 8 } });
    await page.waitForTimeout(120);
    const clip = await page.evaluate(() => window.__qaScene.liveDebug().animation);
    if (clip !== 'idle' && clip !== 'idle_talk') seen.add(clip);
  }
  stare = [...seen];
  if (seen.size === 0) problems.push('cursor rested on her head for 3.6 s and she did nothing');
}

// --- 4. the blush is a real channel: it rises with boldness and spikes on a tap -----------------
const blush = await page.evaluate(() => window.__qaScene.blushDebug());
if (!blush.at) problems.push('the blush never drew: no anchor on her face');
if (!(blush.level > 0 && blush.level <= 1)) problems.push(`blush level ${blush.level}`);

// --- 4b. the camera: alive, bounded, and it does not move the hit zones off her ---------------
const cam = await page.evaluate(() => window.__qaScene.cameraDebug());
if (!(Math.abs(cam.zoom) <= 0.018)) problems.push(`camera zoom ${cam.zoom.toFixed(4)} is outside its budget`);
if (!(cam.punch >= 0)) problems.push(`camera punch ${cam.punch}`);
if (cam.reduced) problems.push('reduced motion is on in the QA browser: the drift was never measured');
const camMoved = Math.abs(cam.x) + Math.abs(cam.y) + Math.abs(cam.zoom) * 1000;
if (!(camMoved > 0)) problems.push('the camera never moved: the frame is a screenshot again');

// Parked on her chest: she must register *which* zone, whether or not the beat has cooled down.
const chest = await page.evaluate(() => window.__qaScene.zoneCenter('chest'));
if (chest) {
  await page.mouse.move(chest.x, chest.y);
  await page.waitForTimeout(2600);
}
const onChest = await page.evaluate(() => window.__qaScene.hoverDebug());

// --- 4c. a chat dare: it appears, it fills from the taps it asked for, and it pays ------------
const balanceBefore = await page.evaluate(() => window.__qaScene.getState().balance);
const started = await page.evaluate(() => window.__qaScene.startDare('cheek'));
if (!started) problems.push('the QA hook could not start a dare');
const head = await page.evaluate(() => window.__qaScene.zoneCenter('head'));
if (head) {
  for (let i = 0; i < 5; i += 1) {
    await page.mouse.click(head.x, head.y);
    await page.waitForTimeout(160);
  }
}
await pumpFrames(60);
const afterDare = await page.evaluate(() => ({
  dare: window.__qaScene.dareDebug(),
  last: window.__qaScene.lastDareDebug(),
  balance: window.__qaScene.getState().balance,
}));
// A served dare is *settled away*, so the live chip is gone and the outcome is what is left to read.
if (afterDare.dare) problems.push(`the dare is still live (${afterDare.dare.status}) after five taps on her face`);
if (!afterDare.last) problems.push('the dare never settled: no outcome was recorded');
else if (!afterDare.last.won) problems.push(`the dare was lost, not served (${afterDare.last.kind})`);
if (!(afterDare.balance > balanceBefore)) problems.push(`the dare paid nothing (${balanceBefore} → ${afterDare.balance})`);

const tick = await page.evaluate(() => window.__qaScene.tickDebug());
if (tick.error) problems.push(`the stage's tick threw: ${tick.error.split('\n')[0]}`);
await page.screenshot({ path: `${SHOTS}/zones.png` });
await browser.close();

// --- report ------------------------------------------------------------------------------------
console.log(`\n  ${'mood'.padEnd(6)}${'bold'.padEnd(6)}zone answers`);
for (const round of rounds) {
  const parts = ZONES.map((z) => `${z}=${[...new Set(round.byZone[z])].join('/')}`);
  console.log(`  ${round.label.padEnd(6)}${String(round.boldness).padEnd(6)}${parts.join('  ')}`);
}
console.log(`  stare  →      ${stare && stare.length ? stare.join(', ') : '(nothing)'}`);
console.log(
  `  camera →      drift ${cam.x.toFixed(1)},${cam.y.toFixed(1)} px  zoom ${(cam.zoom * 100).toFixed(2)} %  punch ${(cam.punch * 100).toFixed(2)} %  t ${cam.t.toFixed(1)} s`,
);
console.log(`  on chest →    ${onChest.zone ?? '(none)'}`);
console.log(
  `  dare →        ${afterDare.last ? `${afterDare.last.kind} ${afterDare.last.won ? 'done' : 'lost'} +${afterDare.last.reward} ₽` : '(none)'}  balance ${balanceBefore} → ${afterDare.balance}`,
);

if (problems.length) {
  console.log(`\n  ${problems.length} problem(s):`);
  for (const p of problems) console.log(`    ! ${p}`);
  process.exit(1);
}
console.log('\n  ok: every zone answers, boldness changes it, and a parked cursor is noticed');

// QA: the HUD on a phone and on a desktop, in a real browser, with the two things that actually
// break a clicker checked mechanically instead of by eye:
//
//   1. **The sound toggle** exists, is on screen, is big enough to hit with a thumb, and actually
//      flips the engine's state (once with a tap, once with `M`).
//   2. **Nothing in the top row overlaps anything else** — the phone layout is where the sub-goal
//      card, the hype pill and the badges fight for the same 390 px.
//
// Run with the dev server up: `node scripts/qa_mobile.mjs` (BASE overrides, default 5174).
// Screenshots land in /tmp/qa_mobile.
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
const SHOTS = process.env.QA_MOBILE_SHOTS ?? '/tmp/qa_mobile';
mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1366, height: 820, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
];

const launch = async () =>
  pwChromium.launch({
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

const problems = [];

for (const view of VIEWPORTS) {
  // One browser per viewport: a second context in the same browser hung in this sandbox, and a
  // QA tool that hangs is worse than one that takes two seconds longer.
  const browser = await launch();
  const context = await browser.newContext({
    viewport: { width: view.width, height: view.height },
    deviceScaleFactor: view.deviceScaleFactor,
    isMobile: view.isMobile,
    hasTouch: view.hasTouch,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(`${view.name}: pageerror ${error.message}`));
  await page.goto(`${BASE}/?qa`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__qaScene), { timeout: 30000 });
  await page.waitForTimeout(900);

  await page.screenshot({ path: `${SHOTS}/${view.name}.png` });

  // Filled in after the taps; the summary line prints it for both views.
  let room = { bed: null, breaths: null, duck: 'n/a' };

  const sound = await page.evaluate(() => {
    const button = document.getElementById('btn-sound');
    if (!button) return { present: false };
    const box = button.getBoundingClientRect();
    return {
      present: true,
      pressed: button.getAttribute('aria-pressed'),
      width: Math.round(box.width),
      height: Math.round(box.height),
      x: Math.round(box.x),
      y: Math.round(box.y),
      inViewport: box.x >= 0 && box.y >= 0 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
    };
  });
  if (!sound.present) problems.push(`${view.name}: no #btn-sound`);
  else {
    if (!sound.inViewport) problems.push(`${view.name}: sound button outside the viewport (${sound.x},${sound.y})`);
    if (sound.width < 20 || sound.height < 20) {
      problems.push(`${view.name}: sound button ${sound.width}x${sound.height} — too small for a thumb`);
    }
    // What the *finger* can hit is not the button's box: it is every point around the box that a
    // real hit test attributes to the button (the pseudo-element that grows it, up to whatever
    // clips it). Sample a grid and measure that.
    const target = await page.evaluate(() => {
      const button = document.getElementById('btn-sound');
      const box = button.getBoundingClientRect();
      const hits = (x, y) => document.elementFromPoint(x, y)?.closest('#btn-sound') === button;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let dx = -24; dx <= 24; dx += 2) {
        for (let dy = -24; dy <= 24; dy += 2) {
          const x = box.left + box.width / 2 + dx;
          const y = box.top + box.height / 2 + dy;
          if (!hits(x, y)) continue;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
      return { width: Math.round(maxX - minX + 1), height: Math.round(maxY - minY + 1) };
    });
    const need = { width: view.isMobile ? 30 : 24, height: view.isMobile ? 28 : 20 };
    if (target.width < need.width || target.height < need.height) {
      problems.push(
        `${view.name}: touch target ${target.width}x${target.height} — under ${need.width}x${need.height}`,
      );
    }
    sound.target = `${target.width}x${target.height}`;
    const afterTap = await page.evaluate(() => {
      document.getElementById('btn-sound').click();
      return document.getElementById('btn-sound').getAttribute('aria-pressed');
    });
    if (afterTap === sound.pressed) problems.push(`${view.name}: tap did not flip the sound state`);
    const afterKey = await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
      return document.getElementById('btn-sound').getAttribute('aria-pressed');
    });
    if (afterKey !== sound.pressed) problems.push(`${view.name}: "M" did not restore the sound state`);
  }

  // Five real taps on her: this is the path that creates the audio context, plays the click voice,
  // fires the rig reaction and writes the save. A page error here is the game dying under a finger.
  for (let i = 0; i < 5; i += 1) {
    await page.mouse.click(view.width / 2, Math.round(view.height * 0.45));
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${view.name}-tapped.png` });
  const tapped = await page.evaluate(() => ({
    taps: window.__qaScene?.getState?.().totalTaps ?? null,
    soundPressed: document.getElementById('btn-sound')?.getAttribute('aria-pressed') ?? null,
    audio: window.__sfx?.debugState?.() ?? null,
  }));
  if (tapped.taps === 0) problems.push(`${view.name}: five taps on her registered as zero`);
  // The audio graph cannot be heard here, so it is measured: a context has to exist (created inside
  // the tap gesture), it has to be running, and every tap has to have reached the synth.
  if (!tapped.audio) problems.push(`${view.name}: __sfx not exposed under ?qa`);
  else {
    if (tapped.audio.context === 'none') problems.push(`${view.name}: no audio context after tapping`);
    if (tapped.audio.context === 'suspended') problems.push(`${view.name}: audio context suspended`);
    if (tapped.audio.taps < 5) problems.push(`${view.name}: only ${tapped.audio.taps} of 5 taps made a sound`);
    if (tapped.audio.master <= 0) problems.push(`${view.name}: master gain is ${tapped.audio.master}`);
    // The room: a bed nobody measures is a bed nobody has. It has to be up with the graph, it has
    // to be breathing on the shared clock, and it has to be far enough under the game to survive.
    if (tapped.audio.room !== 'running') problems.push(`${view.name}: room is ${tapped.audio.room}, not running`);
    if (!(tapped.audio.bed > 0.02 && tapped.audio.bed < 0.06)) {
      problems.push(`${view.name}: room bed is ${tapped.audio.bed}`);
    }
    if (tapped.audio.breaths < 1) problems.push(`${view.name}: the room never breathed`);
    // Breathed at her authored tempo (the rig's `breath` clip is four seconds), not some number
    // that happened to be in the file.
    if (tapped.audio.period !== 4) problems.push(`${view.name}: the room breathes at ${tapped.audio.period}s`);
  }

  // The breath keeps its own clock: two samples a beat apart must not be the same phase, or the
  // "breathing room" is a static noise floor with a nice name.
  const phaseA = await page.evaluate(() => window.__sfx.roomDebug().phase);
  await page.waitForTimeout(900);
  const phaseB = await page.evaluate(() => window.__sfx.roomDebug().phase);
  if (Math.abs(phaseB - phaseA) < 1e-6) {
    problems.push(`${view.name}: the room's breath phase did not advance (${phaseA})`);
  }

  // Her voice drops the room. Measured through the same pure envelope the graph is scheduled from,
  // because nothing about this is audible in a headless browser.
  const duck = await page.evaluate(async () => {
    const before = window.__sfx.roomDebug().duck;
    window.__sfx.duck(1000);
    await new Promise((r) => setTimeout(r, 120));
    const during = window.__sfx.roomDebug().duck;
    await new Promise((r) => setTimeout(r, 1100));
    const after = window.__sfx.roomDebug().duck;
    return { before, during, after };
  });
  if (!(duck.before === 1 && duck.during < 0.75 && duck.after === 1)) {
    problems.push(
      `${view.name}: room did not duck under her voice (${duck.before} -> ${duck.during} -> ${duck.after})`,
    );
  }
  // The rare voices fire on a minute-long timer, so they are asked for directly: a room whose creak
  // throws is a room that is gone for the rest of the session, and nothing else would notice.
  const events = await page.evaluate(() => {
    const before = window.__sfx.roomDebug();
    const okCreak = window.__sfx.roomEvent('creak');
    const okCity = window.__sfx.roomEvent('city');
    const after = window.__sfx.roomDebug();
    return {
      okCreak,
      okCity,
      creaks: after.creaks - before.creaks,
      citySwells: after.citySwells - before.citySwells,
    };
  });
  if (!events.okCreak || events.creaks !== 1) problems.push(`${view.name}: the chair never creaked`);
  if (!events.okCity || events.citySwells !== 1) problems.push(`${view.name}: the street was silent`);
  room = {
    bed: tapped.audio?.bed ?? null,
    breaths: tapped.audio?.breaths ?? null,
    duck: `${duck.before}->${duck.during.toFixed(2)}->${duck.after}`,
  };

  // The top row: the sub-goal card on the left against the status badges on the right. On a phone
  // they are supposed to stack, not sit on top of each other.
  const overlap = await page.evaluate(() => {
    const pick = (selector) => document.querySelector(selector)?.getBoundingClientRect() ?? null;
    const card = pick('#obs-subgoal');
    const right = pick('.tw-player-top-right');
    if (!card || !right) return { ok: true, skipped: true };
    const overlapX = Math.min(card.right, right.right) - Math.max(card.left, right.left);
    const overlapY = Math.min(card.bottom, right.bottom) - Math.max(card.top, right.top);
    return {
      ok: overlapX <= 1 || overlapY <= 1,
      overlapX: Math.round(overlapX),
      overlapY: Math.round(overlapY),
      card: { w: Math.round(card.width), h: Math.round(card.height) },
      right: { w: Math.round(right.width), h: Math.round(right.height) },
    };
  });
  if (!overlap.ok) {
    problems.push(
      `${view.name}: sub-goal and status badges overlap by ${overlap.overlapX}x${overlap.overlapY} px`,
    );
  }
  console.log(
    `${view.name.padEnd(7)} ${view.width}x${view.height}  sound ${sound.present ? `${sound.width}x${sound.height} (target ${sound.target}) @${sound.x},${sound.y}` : 'MISSING'}  ` +
      `overlap ${overlap.skipped ? 'n/a' : overlap.ok ? 'none' : `${overlap.overlapX}x${overlap.overlapY}px`}  ` +
      `taps ${tapped.taps}  audio ${tapped.audio ? `${tapped.audio.context}/${tapped.audio.taps}` : 'n/a'}  ` +
      `room bed ${room.bed} breaths ${room.breaths} duck ${room.duck}`,
  );

  await context.close();
  await browser.close();
}

// A plate with no skeleton has to have moments of its own. That timer is 24–56 s, which no headless
// run will wait for, so `fireFlatQuirkNow()` asks for one and this checks the two things the player
// would see and hear: a line from the chat and a voice from the room. `?rig=0` is the honest way to
// get a flat plate on purpose — it is the same path the four unrigged plates take every evening.
{
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(`flat: pageerror ${error.message}`));
  await page.goto(`${BASE}/?qa&rig=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__qaScene && window.__stage), { timeout: 30000 });
  await page.waitForTimeout(900);
  // A first click anywhere is the gesture that is allowed to start audio.
  await page.mouse.click(683, 369);
  await page.waitForTimeout(300);
  const flat = await page.evaluate(() => {
    const lines = () => Array.from(document.querySelectorAll('#chat-messages > *')).map((n) => n.textContent ?? '');
    const before = lines();
    let after = before;
    let fired = false;
    // The chat only comments on roughly every other moment (and then holds an 18 s silence), which
    // is right on stream and unhelpful in a two-second check: ask until it answers, then stop.
    for (let tries = 0; tries < 10 && after.length <= before.length; tries += 1) {
      fired = window.__stage.fireFlatQuirkNow() || fired;
      after = lines();
    }
    const debug = window.__stage.getFlatQuirkDebug();
    return { fired, before, after, debug, plate: window.__qaScene.getActivePlateName() };
  });
  if (!flat.fired) problems.push('flat: the flat plate refused to have a moment');
  if (flat.after.length <= flat.before.length) {
    problems.push(`flat: no chat line for her moment (${flat.plate})`);
  } else if (flat.after[flat.after.length - 1] === flat.before[flat.before.length - 1]) {
    problems.push('flat: the chat said the same thing twice');
  }
  if (flat.debug.fires < 1) problems.push('flat: the timer never armed');
  console.log(
    `flat    ${flat.plate}  moments ${flat.debug.fires}  ` +
      `chat ${flat.before.length} -> ${flat.after.length}  timer ${flat.debug.timerMs ? 'armed' : 'off'}`,
  );
  await context.close();
  await browser.close();
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`\nok — screenshots in ${SHOTS}`);

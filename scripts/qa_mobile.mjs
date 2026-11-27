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
  }));
  if (tapped.taps === 0) problems.push(`${view.name}: five taps on her registered as zero`);

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
      `taps ${tapped.taps}`,
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

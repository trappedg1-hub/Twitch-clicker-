// QA: ride every day and every sub-stage and report whether the live rig or the flat plate is up.
// Run against the dev server: `node scripts/qa_rig_days.mjs` (npm run dev has to be up first).
// Screenshots and a report land in /tmp/ride.
//
// The bundled chromium needs its AL2023 shared libraries (libnss3 and friends). They ship inside
// @sparticuz/chromium as a brotli-packed tar, so the script unpacks them to /tmp/al2023 the first
// time — no system install, no root.
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
const SHOTS = process.env.QA_SHOTS ?? '/tmp/ride';
mkdirSync(SHOTS, { recursive: true });

const executablePath = await chromium.executablePath();
const browser = await pwChromium.launch({
  executablePath,
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1366, height: 820 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
page.on('response', (r) => {
  if (r.url().includes('/rigs/') && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});

await page.goto(`${BASE}/?qa`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__qaScene && window.__heroineRig), { timeout: 30000 });
await page.waitForTimeout(1200);

// Progress gates are real: days unlock off the previous day's finale, sub-stages off subscribers.
await page.evaluate(() => {
  window.__qaScene.addFunds(50_000_000);
  window.__qaScene.setSubscribers(5_000_000);
});
await page.waitForTimeout(600);

const rows = [];
const snap = async (day, stage) => {
  const info = await page.evaluate(() => ({
    plate: window.__qaScene.getActivePlateName(),
    flat: window.__heroineRig.plateVisible,
    stage: window.__heroineRig.getStageIndex?.() ?? null,
  }));
  const file = `${SHOTS}/day${day}_s${stage}.png`;
  await page.screenshot({ path: file });
  rows.push({ day, stage, ...info, file });
};

for (const day of [1, 2, 3, 4, 5, 6]) {
  const started = await page.evaluate((d) => {
    const fn = window.__qaScene[`startDay${d}`];
    // Day 1 is the boot state, not a jump: there is nothing to start.
    return typeof fn === 'function' ? fn() : d === 1;
  }, day);
  await page.waitForTimeout(900);
  if (!started) {
    rows.push({ day, stage: -1, plate: '—', flat: true, note: 'day refused' });
    continue;
  }
  for (let stage = 0; stage <= 4; stage += 1) {
    const ok = await page.evaluate((st) => window.__qaScene.setSubStage(st), stage);
    if (!ok) {
      rows.push({ day, stage, plate: '—', flat: true, note: 'stage refused' });
      continue;
    }
    await page.waitForTimeout(900);
    await snap(day, stage);
  }
}

const table = rows
  .map((r) => `${String(r.day).padStart(2)} ${String(r.stage).padStart(2)} ${r.flat ? 'FLAT' : 'live'} ${r.plate}${r.note ? ` (${r.note})` : ''}`)
  .join('\n');
console.log('day stage state plate');
console.log(table);
const flat = rows.filter((r) => r.flat && r.plate !== '—').length;
console.log(`\nlive ${rows.filter((r) => !r.flat && r.plate !== '—').length}, flat ${flat}`);
console.log('errors:', errors.length ? errors.slice(0, 10) : 'none');
writeFileSync(`${SHOTS}/report.txt`, `${table}\n\nerrors: ${errors.join('\n')}\n`);
await browser.close();

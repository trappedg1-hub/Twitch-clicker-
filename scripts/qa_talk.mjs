// QA: does she actually speak, in the browser, on the plates that are supposed to?
//
// The talk policy has node tests, but those never touch the game: they read a document and call a
// pure function. This one rides the real client — the same chat-line path a player triggers — and
// asks the live heroine which animation is playing, on every distinct plate the days 1-6 can show.
//
//   npm run dev            # in one terminal
//   node scripts/qa_talk.mjs
//
// What has to be true, per plate, decided by the document on screen (not by a list in this file):
//   with a mouth     — talk() starts `idle_talk` at once, holds it, releases it on time, and a chat
//                      line reaches it too (the reaction comes first, the mouth after it);
//   without a mouth  — talk() changes nothing, a chat line never produces `idle_talk`;
//   without a rig    — both are silent no-ops;
// and no plate may leave a fault behind: a fault hides the rig for the rest of the run.
import chromium from '@sparticuz/chromium';
import { chromium as pwChromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { brotliDecompressSync } from 'node:zlib';

const BASE = process.env.QA_BASE ?? 'http://localhost:5174';
const SHOTS = process.env.QA_SHOTS ?? '/tmp/talk';
mkdirSync(SHOTS, { recursive: true });

const LIBS = '/tmp/al2023';
if (!existsSync(`${LIBS}/lib/libnss3.so`)) {
  const require = createRequire(import.meta.url);
  const packed = require.resolve('@sparticuz/chromium/bin/al2023.tar.br');
  writeFileSync('/tmp/al2023.tar', brotliDecompressSync(readFileSync(packed)));
  mkdirSync(LIBS, { recursive: true });
  execFileSync('tar', ['-xf', '/tmp/al2023.tar', '-C', LIBS]);
}
process.env.LD_LIBRARY_PATH = `${LIBS}/lib:/tmp${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''}`;

const index = JSON.parse(readFileSync('public/rigs/index.json', 'utf8'));

const browser = await pwChromium.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  headless: true,
});
const page = await (await browser.newContext({ viewport: { width: 1366, height: 820 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

await page.goto(`${BASE}/?qa`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__qaScene && window.__heroineRig), { timeout: 30000 });
await page.waitForTimeout(1200);
await page.evaluate(() => {
  window.__qaScene.addFunds(50_000_000);
  window.__qaScene.setSubscribers(5_000_000);
  // Silence the game's own callouts: it answers lines and donations on its own schedule, and "did
  // the mouth move" cannot be measured while something else keeps throwing reactions on the rig.
  // The QA's own line goes straight to the stage, so it is not affected.
  window.__qaScene.muteChat(true);
});

const debug = () => page.evaluate(() => window.__qaScene.liveDebug());
const plateName = () => page.evaluate(() => window.__qaScene.plate());
const artOf = (plate) => plate.replace(/^heroine_/, '').replace(/\.webp$/, '');

/** Wait until the same plate has been on screen for a beat — a swap mid-measurement proves nothing. */
async function settledPlate() {
  let previous = await plateName();
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(220);
    const now = await plateName();
    if (now === previous) return now;
    previous = now;
  }
  return previous;
}

/** Every (day, stage) the game can land on, in order, each one visited once. */
async function visit(day, stage) {
  await page.evaluate(
    (jump) => {
      const s = window.__qaScene;
      if (jump.day > s.getState().streamDay) s[`startDay${jump.day}`]?.();
      s.setSubStage(jump.stage);
    },
    { day, stage },
  );
  await page.waitForTimeout(750);
}

// ---- the run: walk the days, test each plate the first time it appears -------------------------
// Forward-only: the QA hook can advance the stream but not rewind it, so a second pass over the
// same plates would need a reload. Testing on arrival is also the honest order — it is exactly when
// a player hears the first line on that plate.
const rows = [];
const seenArt = new Set();
const flats = [];
// ---- pass 2: talk on every distinct plate -------------------------------------------------------
/** Wait until she is at rest: idle, no beat, no sentence. Measuring a "starts at once" needs that. */
async function waitForRest(ms = 8000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const d = await page.evaluate(() => {
      const q = window.__qaScene.liveDebug();
      return { a: q.animation, talk: q.talkUntil - q.now, beat: q.reactionUntil - q.now };
    });
    if (d.a === 'idle' && d.talk <= 0 && d.beat <= 0) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

async function testPlate(where, art) {
  // The rig reads its own art name long after the stage moved on — `hide()` keeps it. So wait for
  // the rig to be showing THIS plate, and let a load in flight finish: it resets the talk
  // deadline, which would make a working mouth look broken.
  await page.waitForFunction((a) => window.__qaScene.liveDebug().art === a, art, { timeout: 15000 });
  await page.waitForTimeout(700);

  const meta = index[art];
  const docHasMouth = Array.isArray(meta?.animations) ? meta.animations.includes('idle_talk') : null;
  await waitForRest();
  const before = await debug();
  const runtimeHasMouth = before.animations.includes('idle_talk');

  // A — the talk path alone. Start, hold, release.
  await page.evaluate(() => window.__qaScene.talk(1500));
  await page.waitForTimeout(120);
  const start = await debug();
  // Sampled, not assumed: with the game's own chatter muted nothing else should touch her, so every
  // sample in the middle of the sentence has to show the mouth.
  const holdSamples = [];
  for (let i = 0; i < 6; i += 1) {
    await page.waitForTimeout(200);
    holdSamples.push((await debug()).animation);
  }
  const hold = holdSamples.every((a) => a === 'idle_talk') ? 'idle_talk' : `held:${holdSamples.join('|')}`;
  if (runtimeHasMouth) await page.screenshot({ path: `${SHOTS}/${art}_talking.png` });
  await page.waitForTimeout(1150);
  const end = await debug();

  // B — a real chat line, sampled across the whole beat: the reaction comes first, the mouth after
  // it, so one sample can land on either and only a set can answer "did she speak".
  await page.evaluate(() => window.__qaScene.say('привет, мия'));
  const samples = [];
  for (let i = 0; i < 18; i += 1) {
    await page.waitForTimeout(200);
    const d = await debug();
    samples.push({ at: i * 200, ...d });
  }
  await page.waitForTimeout(500);
  const rest = await debug();

  const lineSeen = [...new Set(samples.map((s) => s.animation))];
  rows.push({
    ...where,
    art,
    docHasMouth,
    runtimeHasMouth,
    before: before.animation,
    start: start.animation,
    hold,
    end: end.animation,
    lineSeen,
    spokeOnLine: lineSeen.includes('idle_talk'),
    // If the mouth never came, the deadlines say who dropped it: the rig (talkUntil) or the beat
    // (reactionUntil). Both in seconds relative to the sample, so the table reads like a timeline.
    lineTrace: samples
      .map(
        (s) =>
          `${(s.at / 1000).toFixed(1)}s ${s.animation}(talk ${((s.talkUntil - s.now) / 1000).toFixed(1)}, beat ${((s.reactionUntil - s.now) / 1000).toFixed(1)})`,
      )
      .join('\n  '),
    fault: start.fault ?? hold.fault ?? end.fault ?? rest.fault ?? samples.find((s) => s.fault)?.fault ?? null,
  });
}

/** A plate with no rig at all: both calls must be silent no-ops. */
async function testFlat(flat, art) {
  const before = await debug();
  await page.evaluate(() => window.__qaScene.talk(1500));
  await page.waitForTimeout(400);
  const afterTalk = await debug();
  await page.evaluate(() => window.__qaScene.say('привет, мия'));
  await page.waitForTimeout(1200);
  const afterLine = await debug();
  rows.push({
    ...flat,
    art: art ?? '(no rig)',
    docHasMouth: art && index[art] ? index[art].animations.includes('idle_talk') : null,
    runtimeHasMouth: false,
    before: before.animation,
    start: afterTalk.animation,
    hold: afterLine.animation,
    end: afterLine.animation,
    lineSeen: [],
    spokeOnLine: false,
    lineTrace: '',
    fault: afterTalk.fault ?? afterLine.fault ?? null,
  });
}

for (let day = 1; day <= 6; day += 1) {
  for (let stage = 0; stage <= 5; stage += 1) {
    await visit(day, stage);
    const plate = await settledPlate();
    const art = artOf(plate);
    if (seenArt.has(plate)) continue;
    seenArt.add(plate);
    if (!index[art]) {
      // No rig ships for this plate: the flat art is the whole show, and both calls must be silent.
      await testFlat({ day, stage }, art);
      continue;
    }
    // A load is async: give it its chance before calling a rigged plate "hidden".
    await page
      .waitForFunction((a) => {
        const q = window.__qaScene.liveDebug();
        return q.art === a && q.visible;
      }, art, { timeout: 6000 })
      .catch(() => undefined);
    const d = await debug();
    if (!d.visible) {
      // A plate that HAS a rig but is not showing it is the interesting failure — say so.
      rows.push({
        day,
        stage,
        art,
        docHasMouth: index[art].animations.includes('idle_talk'),
        runtimeHasMouth: false,
        before: d.animation,
        start: 'hidden',
        hold: 'hidden',
        end: 'hidden',
        lineSeen: [],
        spokeOnLine: false,
        lineTrace: '',
        fault: `plate ${plate} has a rig but the rig is hidden`,
      });
      continue;
    }
    await testPlate({ day, stage }, art);
  }
}

const head = 'day stg art            mouth doc   talk start/hold/end             spoke on a line  fault';
console.log(head);
let bad = 0;
for (const r of rows) {
  let ok = !r.fault;
  if (!r.runtimeHasMouth && r.art !== '(no rig)' && r.start === 'hidden') {
    // already flagged above
  } else if (!r.runtimeHasMouth && r.docHasMouth === null) {
    // Nothing to animate: the only requirement is that neither call throws or faults.
    ok = ok && r.start === r.before && r.hold === r.before;
  } else if (r.runtimeHasMouth) {
    ok = ok && r.start === 'idle_talk' && r.hold === 'idle_talk' && r.end !== 'idle_talk' && r.spokeOnLine;
  } else {
    // A mouthless plate: talk() must be a no-op, and a line must never make the runtime look for a
    // clip the document does not have.
    ok = ok && r.start !== 'idle_talk' && !r.spokeOnLine;
  }
  // The document and the runtime must agree about the mouth, or the QA is lying to itself.
  if (r.docHasMouth !== null && r.docHasMouth !== r.runtimeHasMouth) ok = false;
  if (!ok) bad += 1;
  console.log(
    `${String(r.day).padStart(2)} ${String(r.stage).padStart(3)} ${String(r.art).padEnd(14)} ${String(r.runtimeHasMouth).padEnd(6)} ${String(r.docHasMouth).padEnd(5)} ${`${r.start}/${r.hold}/${r.end}`.padEnd(31)} ${String(r.spokeOnLine).padEnd(16)} ${r.fault ?? '—'}${ok ? '' : '  <-- FAIL'}`,
  );
}
// The timeline is the point of the trace: when a mouth does not move, these two clocks say whether
// the deadline was dropped or the beat swallowed it.
for (const r of rows.filter((x) => x.lineTrace && (x.fault || x.art !== '(no rig)'))) {
  const expectedTalk = r.runtimeHasMouth && r.spokeOnLine;
  if (r.fault || !expectedTalk) console.log(`\n${r.art} line timeline:\n  ${r.lineTrace}`);
}
console.log(`\n${rows.length - bad}/${rows.length} plates as expected`);
console.log('errors:', errors.length ? errors.slice(0, 6) : 'none');
writeFileSync(`${SHOTS}/report.json`, JSON.stringify({ rows, errors }, null, 1));
await browser.close();
if (bad) process.exitCode = 1;

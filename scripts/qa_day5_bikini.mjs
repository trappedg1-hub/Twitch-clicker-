// QA: Day 5 («5 бикини стрим») — the art gate, the 7000-sub ladder, the plate swap, the copy the player
// actually hears, and the day's "no flash plate" rule, run in a real browser against the dev server.
//   npm run dev            # vite on :5173
//   node scripts/qa_day5_bikini.mjs
// Exits 1 on any console error, any failed plate request and any broken invariant.
import chromium from '@sparticuz/chromium';
import { chromium as pwChromium } from 'playwright-core';

const BASE = process.env.QA_BASE ?? 'http://localhost:5173';
const OUT = '.qa-out';

const executablePath = await chromium.executablePath();
// One browser per pass, and each pass closes it again: this chromium build runs `--single-process`, so a
// second context created after the first one closes hangs forever instead of loading the page.
async function launchBrowser() {
  return pwChromium.launch({
    executablePath,
    args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
    headless: true,
  });
}

const failures = [];
const notes = [];
const plateRequests = new Set();

async function open(day5Unlocked) {
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('response', (res) => {
    const name = res.url().split('/').pop() ?? '';
    if (/^heroine_t5_/.test(name)) {
      plateRequests.add(`${name}:${res.status()}`);
      if (res.status() !== 200) errors.push(`plate ${name} answered ${res.status()}`);
    }
  });

  await page.addInitScript(
    ([on]) => {
      window.__day5Unlocked = on;
    },
    [day5Unlocked],
  );
  await page.goto(`${BASE}/?qa`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__qaScene?.getState && window.__pixiApp), { timeout: 40000 });
  await page.waitForTimeout(1500);
  return { page, context, errors, browser };
}

const snap = (page) =>
  page.evaluate(() => {
    const qa = window.__qaScene;
    const s = qa.getState();
    const text = (id) => document.getElementById(id)?.textContent?.trim() ?? '';
    return {
      day: s.streamDay,
      subs: s.subscribers,
      stage: s.unlockedSubStage,
      displayed: s.displayedSubStage,
      ghostAt: s.ghostBurstAt ?? 0,
      emotion: s.emotion,
      plate: qa.getActivePlateName(),
      bikini: qa.bikiniInfo(),
      day5Unlocked: qa.isDay5Unlocked(),
      rigPlates: qa.getState() && window.__heroineRig.hasDay5Plates(),
      title: text('stream-title'),
      goal: text('subgoal-target-name'),
      pct: text('subgoal-pct'),
      speech: text('speech-text'),
      dayBadge: text('stream-day-badge'),
      steps: [...document.querySelectorAll('#subgoal-steps-row .goal-step')].map((n) => n.textContent?.trim() ?? ''),
      chatCount: document.querySelectorAll('.chat-msg').length,
    };
  });

// Walk the day chain for real, because the gate is the product: every day opens on the previous finale.
const CHAIN = `
  const qa = window.__qaScene;
  qa.setSubscribers(5000); const d2 = qa.startDay2();
  qa.setSubscribers(15000); const d3 = qa.startDay3();
  qa.setSubscribers(15000); const d4 = qa.startDay4();
  qa.setSubscribers(26000); const d5 = qa.startDay5();
  ({ d2, d3, d4, d5, day: qa.getState().streamDay });
`;

const check = (cond, msg) => {
  if (!cond) failures.push(msg);
};

// ---------- 1) LOCKED BUILD: the day stays shut and says why ----------
{
  const { page, context, errors, browser: br } = await open(false);
  const locked = await snap(page);
  check(locked.day5Unlocked === false, 'locked: isDay5Unlocked() must be false with __day5Unlocked=false');
  check(locked.bikini.unlocked === false, 'locked: bikiniInfo().unlocked must be false');
  // `plates` reads the rig's own texture cache, so in a repo that SHIPS the art it stays true even when
  // the gate is forced shut — that is the distinction the gate exists to make (art present vs. day open).
  notes.push(`locked build: gate=${locked.day5Unlocked} plates=${locked.bikini.plates} (art ships, day does not)`);
  check(locked.bikini.flashLive === false, 'locked: Day 5 has no flash plate, so nothing may be live');
  const chain = await page.evaluate(CHAIN);
  check(chain.d5 === false, 'locked: Day 5 must not open without its art');
  check(chain.day === 4, `locked: the chain should stop on Day 4, got ${chain.day}`);
  check(locked.plate.startsWith('heroine_t4_s') || locked.plate.startsWith('heroine_t1_'), `locked: plate should still be a previous day's: ${locked.plate}`);
  await page.screenshot({ path: `${OUT}/day5_locked.png` });
  check(errors.length === 0, `locked: console errors: ${errors.slice(0, 3).join(' | ')}`);
  notes.push(`locked plate at the shut gate: ${locked.plate}`);
  await context.close();
}

// ---------- 2) UNLOCKED BUILD: gates, ladder, plates, copy ----------
{
  const { page, context, errors, browser: br } = await open(true);
  const boot = await snap(page);
  check(boot.day5Unlocked === true, 'unlocked: isDay5Unlocked() should be true with the override');
  check(boot.bikini.plates === true, 'unlocked: the rig should have loaded heroine_t5_s0..s3');
  check(boot.rigPlates === true, 'unlocked: hasDay5Plates() should be true once the day is running');
  check(boot.bikini.flashLive === false, 'unlocked: Day 5 has no flash plate by design');
  notes.push(`boot plate: ${boot.plate} / requests: ${[...plateRequests].join(', ')}`);

  const chain = await page.evaluate(CHAIN);
  check(chain.d2 && chain.d3 && chain.d4 && chain.d5, `chain: the day chain should reach Day 5: ${JSON.stringify(chain)}`);
  // The chain above jumps four days in a second, which is only possible from QA/admin. Every day flow
  // queues beats on timers, so the bubble needs to settle before its text means anything — and the day
  // that is not current any more must NOT speak: the check below would catch a stale Day-2 arc.
  await page.waitForTimeout(3500);
  const SHAME = /краснела|провалиться сквозь кресло|тихо-тихо в чате|стыднее/i;

  const opened = await snap(page);
  check(opened.day === 5, `the day should be 5, got ${opened.day}`);
  check(opened.stage === 0, `Day 5 must start its own ladder at stage 0, got ${opened.stage}`);
  check(opened.ghostAt === 0, 'Day 5 has no flash plate: the reveal timer must stay unarmed');
  check(opened.plate === 'heroine_t5_s0.webp', `the opening frame must be the approved sg1 plate: ${opened.plate}`);
  check(/БИКИНИ/i.test(opened.dayBadge), `the day badge should read 5 ★ БИКИНИ: ${opened.dayBadge}`);
  check(/Ножки в кадр/.test(opened.goal), `the subgoal label should name the first Day-5 target: ${opened.goal}`);
  check(opened.steps.join(' ').includes('33000'), `the ladder rail should show this day's targets: ${opened.steps.join(' / ')}`);
  notes.push(`day badge: "${opened.dayBadge}" | steps: ${opened.steps.join(' / ')}`);
  notes.push(`opening goal: ${opened.goal} | speech: ${opened.speech.slice(0, 140)}`);
  check(!SHAME.test(opened.speech), `another day's shy arc is still speaking on Day 5: ${opened.speech.slice(0, 90)}`);
  await page.screenshot({ path: `${OUT}/day5_s0.png` });

  // The ladder: +7000 per step, each stage swapping to its own approved frame.
  for (const [subs, wantStage, plate] of [
    [33000, 1, 'heroine_t5_s1.webp'],
    [40000, 2, 'heroine_t5_s2.webp'],
    [47000, 3, 'heroine_t5_s3.webp'],
  ]) {
    await page.evaluate((n) => window.__qaScene.setSubscribers(n), subs);
    await page.waitForTimeout(500);
    const s = await snap(page);
    check(s.stage === wantStage, `subs ${subs}: ladder stage should be ${wantStage}, got ${s.stage}`);
    check(s.day === 5, `subs ${subs}: the day drifted to ${s.day}`);
    check(s.plate === plate, `subs ${subs}: the plate should be ${plate}, got ${s.plate}`);
    check(/33000|40000|47000/.test(s.title), `subs ${subs}: the banner must show this day's targets: ${s.title}`);
    notes.push(`s${wantStage}: plate=${s.plate} pct=${s.pct} speech="${s.speech.slice(0, 90)}"`);
    check(!SHAME.test(s.speech), `s${wantStage}: another day's shy arc is speaking over the bikini plate: ${s.speech.slice(0, 90)}`);
    await page.screenshot({ path: `${OUT}/day5_s${wantStage}.png` });
  }

  // The finale and the reveal rule.
  const finale = await page.evaluate(() => {
    const qa = window.__qaScene;
    qa.setSubscribers(52000);
    const booRefused = qa.ghostBoo(500) === false;
    const text = (id) => document.getElementById(id)?.textContent?.trim() ?? '';
    return {
      day: qa.getState().streamDay,
      stage: qa.getState().unlockedSubStage,
      ghostAt: qa.getState().ghostBurstAt ?? 0,
      booRefused,
      goal: text('subgoal-target-name'),
      title: text('stream-title'),
      subgoalClass: document.getElementById('obs-subgoal')?.className ?? '',
    };
  });
  check(finale.stage === 3, `the finale is the last stage of the ladder: ${finale.stage}`);
  check(finale.ghostAt === 0, 'the reveal must never arm itself on the bikini day');
  check(finale.booRefused === true, 'triggerGhostBoo must answer false while Day 5 has no flash plate');
  check(/День 5/.test(finale.goal), `the completed ladder should read as Day 5: ${finale.goal}`);
  check(/финал дня/i.test(finale.title), `the banner should read as the day's close: ${finale.title}`);
  check(/47000/.test(finale.title), `the banner must show the day's own finale target: ${finale.title}`);
  notes.push(`finale: "${finale.goal}" | class: ${finale.subgoalClass} | title: ${finale.title}`);

  // The finale card, opened the way a player opens it: the subgoal CTA, then skip the goodbye beats.
  const card = await page.evaluate(async () => {
    const click = (id) => document.getElementById(id)?.click();
    const text = (id) => document.getElementById(id)?.textContent?.trim() ?? '';
    const visible = (id) => !document.getElementById(id)?.classList.contains('hidden');
    click('btn-finale-open');
    await new Promise((r) => setTimeout(r, 500));
    click('btn-skip-farewell');
    await new Promise((r) => setTimeout(r, 1400));
    const cta = document.getElementById('btn-start-day2');
    return {
      overlay: visible('day-finale-overlay'),
      kicker: text('finale-kicker'),
      title: text('finale-title'),
      desc: text('finale-desc'),
      beat: text('finale-farewell-line'),
      ctaLabel: cta?.textContent?.trim() ?? '',
      ctaDisabled: cta?.disabled ?? null,
    };
  });
  check(card.overlay === true, 'the finale card must open from the subgoal CTA on the bikini day');
  check(/БИКИНИ/i.test(card.kicker), `the card kicker should name the day: ${card.kicker}`);
  check(/47000/.test(card.title), `the card title should read the day's own finale: ${card.title}`);
  check(/ни одна деталь не сдвинулась|формат/i.test(card.desc), `the card copy should tell the truth about the day: ${card.desc}`);
  check(/формат выберет чат/i.test(card.ctaLabel), `Day 5 has no next day to open, the CTA must say so: ${card.ctaLabel}`);
  check(card.ctaDisabled === true, 'the Day-5 finale CTA must stay disabled — there is no Day 6 yet');
  check(/Пятый день закрыт|камера выключается/i.test(card.beat), `the goodbye should close the fifth day: ${card.beat}`);
  notes.push(`finale card: "${card.ctaLabel}" (disabled=${card.ctaDisabled}) beat="${card.beat.slice(0, 80)}"`);
  await page.screenshot({ path: `${OUT}/day5_finale_card.png` });

  // Her voice for real: every zone, every stage, through the engine's own picker.
  const voices = await page.evaluate(() => {
    const qa = window.__qaScene;
    const zones = ['head', 'chest', 'belly', 'legs', 'feet'];
    const out = [];
    for (let stage = 0; stage <= 4; stage++) {
      for (let i = 0; i < 10; i++) {
        out.push({ stage, zone: zones[i % 5], line: qa.tapLine(zones[i % 5], i, stage, 5) });
      }
      out.push({ stage, zone: 'situation', line: qa.situationLine(stage * 7 + 1) });
    }
    return out;
  });
  check(voices.every((v) => typeof v.line === 'string' && v.line.length > 12), 'every Day-5 zone must have a line');
  const shy = voices.filter((v) => /стесняюсь, чат|не снимите с меня|уберите глаза|спрячусь/i.test(v.line));
  check(shy.length === 0, `she must not go shy on this day: ${shy.map((s) => s.line.slice(0, 60)).join(' | ')}`);
  const money = voices.filter((v) => /саб|донат|подписк|прайс|цен|легон/i.test(v.line)).length;
  check(money >= 8, `the day should sound like a sale she is running: only ${money} price lines`);
  notes.push(`voice sample s3: ${voices.filter((v) => v.stage === 3).slice(0, 2).map((v) => v.line.slice(0, 70)).join(' | ')}`);

  // Chat, live: the day's own ambient pools must be talking, not the ghost day's.
  const chat = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.chat-msg')].map((n) => n.textContent?.trim() ?? '');
    return { total: rows.length, last: rows.slice(-6) };
  });
  check(chat.total > 0, 'the chat panel should be running');
  const ghost = chat.last.filter((l) => /призрак|полтергейст/i.test(l));
  check(ghost.length === 0, `the Day-3 ghost chat leaked into Day 5: ${ghost.join(' | ')}`);
  notes.push(`chat tail: ${chat.last.map((l) => l.slice(0, 46)).join(' || ')}`);

  // Mobile portrait: the plate must still sit inside its box and the ladder must still fit.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  const mob = await page.evaluate(() => {
    const stageEl = document.getElementById('stage-wrap') ?? document.querySelector('[class*=stage]');
    const r = stageEl?.getBoundingClientRect();
    return { w: r?.width ?? 0, h: r?.height ?? 0, plate: window.__qaScene.getActivePlateName() };
  });
  check(mob.plate === 'heroine_t5_s3.webp', `mobile must keep the finale plate: ${mob.plate}`);
  check(mob.w > 0 && mob.h > 0, 'the stage box must have a size on mobile');
  notes.push(`mobile stage box: ${Math.round(mob.w)}x${Math.round(mob.h)}, plate ${mob.plate}`);
  await page.screenshot({ path: `${OUT}/day5_mobile.png` });

  check(errors.length === 0, `unlocked: console errors: ${errors.slice(0, 3).join(' | ')}`);
  await br.close();
}

console.log('\n--- notes ---');
for (const n of notes) console.log(`  ${n}`);
console.log(`\nplate files served: ${[...plateRequests].sort().join(', ') || '(none)'}`);
if (failures.length) {
  console.log(`\n--- ${failures.length} FAILURES ---`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log('\n✓ Day 5 browser QA passed');

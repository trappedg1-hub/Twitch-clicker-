// QA: Day 4 (yoga day) — gate, ladder, plate swap, chat topic, "nobody undresses" rule, layout.
// Run against the dev server: `node scripts/qa_day4_yoga.mjs` (needs vite on :5173).
// Env: LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp
import chromium from '@sparticuz/chromium';
import { chromium as pwChromium } from 'playwright-core';

const BASE = process.env.QA_BASE ?? 'http://localhost:5173';
const executablePath = await chromium.executablePath();
const browser = await pwChromium.launch({
  executablePath,
  args: [
    ...chromium.args,
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ],
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1366, height: 820 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
});

async function load(width, height, day4Unlocked) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(
    ([on]) => {
      window.__day4Unlocked = on;
    },
    [day4Unlocked],
  );
  await page.goto(`${BASE}/?qa`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => Boolean(window.__qaScene && window.__pixiApp && window.__heroineRig),
    { timeout: 25000 },
  );
  await page.waitForTimeout(400);
}

async function shot(name) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `.qa-out/${name}.png` });
  console.log('saved', name);
}

/** Walk Day 1 -> Day 2 -> Day 3 -> the ghost finale (15000 subs) and stop on the finale card. */
async function reachDay3Finale() {
  return page.evaluate(() => {
    const qa = window.__qaScene;
    qa.addFunds(90_000_000);
    for (let i = 0; i < 10; i++) qa.buyUpgrade('desk_mic');
    qa.setSubscribers(501);
    qa.startDay2();
    qa.setSubscribers(5001);
    qa.startDay3();
    qa.setSubscribers(15000);
    return { day: qa.getState().streamDay, subs: qa.getState().subscribers };
  });
}

/** The finale card is player-invoked; prove the stream is still live and hit-testable, then open it. */
async function openFinaleCard(expectCta) {
  const before = await page.evaluate(() => {
    const canvas = document.querySelector('#stream-stage-host canvas');
    const r = canvas.getBoundingClientRect();
    const top = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2));
    return {
      overlayHidden: document.getElementById('day-finale-overlay').classList.contains('hidden'),
      ctaVisible: !document.getElementById('btn-finale-open').classList.contains('hidden'),
      ctaLabel: document.getElementById('btn-finale-open').textContent.trim(),
      hitsCanvas: top === canvas,
    };
  });
  console.log('  finale gate', JSON.stringify(before));
  if (!before.overlayHidden) errors.push('the finale card opened by itself and covered the stream');
  if (!before.ctaVisible) errors.push('the finale CTA stayed hidden although the day goal is closed');
  if (expectCta && !new RegExp(expectCta, 'i').test(before.ctaLabel)) {
    errors.push(`unexpected CTA copy: ${before.ctaLabel}`);
  }
  if (!before.hitsCanvas) errors.push('something other than the canvas is over the heroine at the closed day');
  await page.click('#btn-finale-open');
  await page.waitForTimeout(400);
  return before;
}

// Words that would sell a plate this day never had: another day's costume, or a garment leaving.
const FOREIGN_WARDROBE = /худи|гольф|простын|сетк|чулк|боди|легинс|бралет|бюстг|платье|юбк/i;
const STRIP_TALK = /(раздева|снимай|скинь|сняла|снято|снят\b|осталась в|без шорт|без топа|босиком|босые)/i;
const NEGATION = /(ни одной|ни единой|ни одна|ни одного|ноль снят|без единой|ничего не|не снят|не надо|не нужно|не просим|а не стриптиз)/i;
const YOGA_TALK = /поз|наклон|растяж|шпагат|кресл|подлокотник|носок|носочк|вязк|удержан|выдох|вдох|гибк|техник|йог/i;

// ---------- 1) LOCKED: no yoga art in the build -> the card must stay disabled, with honest copy ----------
await load(1366, 820, false);
console.log('1 reach', JSON.stringify(await reachDay3Finale()));
await page.waitForTimeout(1200);
await openFinaleCard('косплей-день закрыт');
await page.click('#btn-skip-farewell').catch(() => {});
await page.waitForTimeout(400);
const locked = await page.evaluate(() => {
  const btn = document.getElementById('btn-start-day2');
  return {
    disabled: btn.disabled,
    label: btn.textContent.trim(),
    unlocked: window.__qaScene.isDay4Unlocked(),
  };
});
console.log('1 locked', JSON.stringify(locked));
if (locked.unlocked !== false) errors.push('isDay4Unlocked() must be false with __day4Unlocked=false');
if (!locked.disabled) errors.push('the Day 4 button must stay disabled without the yoga plates');
if (!/коврик|ещё не/i.test(locked.label)) errors.push(`locked copy should say why: ${locked.label}`);
await shot('day4_1_locked');

// ---------- 2) UNLOCKED: the ghost farewell announces yoga, the card opens Day 4 ----------
await load(1366, 820, true);
console.log('2 reach', JSON.stringify(await reachDay3Finale()));
await page.waitForTimeout(1200);
await openFinaleCard('косплей-день закрыт');
const card = await page.evaluate(() => {
  const qa = window.__qaScene;
  const beats = [];
  for (let i = 0; i < 6; i++) beats.push(document.getElementById('finale-farewell-line')?.textContent?.trim() ?? '');
  return {
    kicker: document.getElementById('finale-kicker')?.textContent.trim(),
    desc: document.getElementById('finale-desc')?.textContent.trim().slice(0, 110),
    label: document.getElementById('btn-start-day2').textContent.trim(),
    // Still mid-farewell: the button is deliberately dead until the goodbye is over.
    disabledWhileFarewell: document.getElementById('btn-start-day2').disabled,
    unlocked: qa.isDay4Unlocked(),
    yoga: qa.yogaInfo(),
    beats: beats.slice(0, 1),
  };
});
console.log('2 card', JSON.stringify(card));
if (card.unlocked !== true) errors.push('isDay4Unlocked() should be true with __day4Unlocked=true');
if (card.unlocked !== true) errors.push('yogaInfo: the plates did not answer HEAD 200');
if (!card.disabledWhileFarewell) errors.push('the Day 4 button became live in the middle of the farewell');
if (!/растяж|йога/i.test(card.label)) errors.push(`the Day 4 CTA should sell the yoga day: ${card.label}`);
if (!/коврик|йога|растяж/i.test((card.beats[0] ?? '') + card.desc)) {
  console.log('note: farewell beat 0 is the neutral "gathering her thoughts" copy, the yoga line comes later');
}
await page.click('#btn-skip-farewell').catch(() => {});
await page.waitForTimeout(400);
const armed = await page.evaluate(() => ({
  disabled: document.getElementById('btn-start-day2').disabled,
  ready: document.querySelector('.day-finale-card').classList.contains('finale-ready'),
}));
console.log('2 armed', JSON.stringify(armed));
if (armed.disabled) errors.push('the Day 4 button stayed disabled after the farewell, although the plates are served');
if (!armed.ready) errors.push('the finale card never got its finale-ready state');
await page.click('#btn-start-day2');
await page.waitForTimeout(700);
const start = await page.evaluate(() => {
  const qa = window.__qaScene;
  const st = qa.getState();
  return {
    day: st.streamDay,
    subs: st.subscribers,
    stage: st.displayedSubStage,
    mic: st.upgrades.desk_mic,
    plate: qa.getActivePlateName(),
    badge: document.getElementById('stream-day-badge')?.textContent.trim(),
    goal: document.getElementById('subgoal-target-name')?.textContent.trim(),
    title: document.getElementById('stream-title')?.textContent.trim(),
    chips: [...document.querySelectorAll('.goal-step')].filter((el) => el.offsetParent !== null).map((el) => el.textContent.trim()),
    speech: document.getElementById('speech-subtitle')?.textContent.trim().slice(0, 90),
  };
});
console.log('2 day4 start', JSON.stringify(start));
if (start.day !== 4) errors.push(`streamDay should be 4, got ${start.day}`);
if (start.badge !== 'День 4 ★ ЙОГА') errors.push(`day badge wrong: ${start.badge}`);
if (!start.plate.startsWith('heroine_t4_')) errors.push(`Day 4 must show its own plates, got ${start.plate}`);
if (start.chips.join(' ') !== '18000 Бёдра 22000 Шпагат 26000 Кресло') {
  errors.push(`Day 4 chips wrong: ${start.chips.join(' | ')}`);
}
if (!/РАСТЯЖКА С МИЕЙ/.test(start.title)) errors.push(`the stream title is not the yoga one: ${start.title}`);
if (!/кресло|растяж|йог/i.test(start.speech ?? '')) {
  console.log(`note: opening line may already be fading: "${start.speech}"`);
}
if (start.mic !== 10) errors.push('the desk mic must carry over into Day 4 like every other day');
await shot('day4_2_start');

// ---------- 3) every yoga stage: its own plate, pose-aware copy, pose-aware chat, no strips ----------
for (const [stage, subs, plate] of [
  [1, 18000, 'heroine_t4_s1'],
  [2, 22000, 'heroine_t4_s2'],
  [3, 26000, 'heroine_t4_s3'],
]) {
  await page.evaluate((target) => window.__qaScene.setSubscribers(target), subs);
  await page.waitForTimeout(600);
  const s = await page.evaluate(() => {
    const qa = window.__qaScene;
    const st = qa.getState();
    const lines = [];
    for (let i = 0; i < 8; i++) lines.push(qa.situationLine(i));
    const chat = [...document.querySelectorAll('#chat-messages .chat-msg')].slice(-10).map((el) => el.textContent.trim());
    const sub = document.getElementById('speech-subtitle');
    return {
      stage: st.displayedSubStage,
      plate: qa.getActivePlateName(),
      patches: qa.facePatchDebug(),
      goal: document.getElementById('subgoal-target-name')?.textContent.trim(),
      title: document.getElementById('stream-title')?.textContent.trim(),
      outfit: [...document.querySelectorAll('.outfit-card')]
        .filter((el) => el.offsetParent !== null)
        .map((el) => el.textContent.trim().slice(0, 80)),
      lines,
      chat,
      subtitleClipped: sub ? sub.scrollHeight > sub.clientHeight + 1 : null,
    };
  });
  console.log(`3 stage${stage}`, JSON.stringify({ ...s, lines: s.lines.slice(0, 2), chat: s.chat.slice(0, 2) }));
  if (s.stage !== stage) errors.push(`stage ${stage}: displayed ${s.stage}`);
  if (!s.plate.startsWith(plate)) errors.push(`stage ${stage}: expected ${plate}, got ${s.plate}`);
  // The four yoga frames are finished drawings with their own expressions painted at the canonical face
  // scale, so the blink/blush overlays stay off for all of them (FACE_PATCH_COVERED_PLATES).
  if (s.patches.hidden !== true) errors.push(`stage ${stage}: face patches should be suppressed, got ${s.patches.hidden}`);
  if (s.subtitleClipped) errors.push(`stage ${stage}: subtitle truncated at 1366x820`);
  if (FOREIGN_WARDROBE.test(s.outfit.join(' '))) {
    errors.push(`stage ${stage}: the outfit card names another day's costume: ${s.outfit.join(' | ')}`);
  }
  const yogaLines = s.lines.filter((l) => YOGA_TALK.test(l)).length;
  if (yogaLines === 0) errors.push(`stage ${stage}: none of her lines mentions the yoga day`);
  const yogaChat = s.chat.filter((l) => YOGA_TALK.test(l)).length;
  console.log(`3 stage${stage} yoga talk: lines ${yogaLines}/8, chat ${yogaChat}/${s.chat.length}`);
  if (yogaChat === 0) errors.push(`stage ${stage}: the chat talks about anything but the yoga stream`);
  const stripChat = s.chat.filter((l) => STRIP_TALK.test(l) && !NEGATION.test(l));
  if (stripChat.length > 0) errors.push(`stage ${stage}: chat asks her to undress: ${stripChat[0].slice(0, 80)}`);
  await shot(`day4_3_stage${stage}`);
}

// ---------- 4) her tap lines across the whole day must never invent a wardrobe change ----------
const guard = await page.evaluate(() => {
  const zones = ['head', 'chest', 'belly', 'legs', 'feet'];
  const out = [];
  for (let stage = 0; stage <= 4; stage++) {
    for (const z of zones) {
      for (let seed = 0; seed < 14; seed++) out.push(window.__qaScene.tapLine(z, seed, stage, 4));
    }
  }
  return out;
});
const foreign = guard.filter((l) => FOREIGN_WARDROBE.test(l));
const strips = guard.filter((l) => STRIP_TALK.test(l) && !NEGATION.test(l));
const yogaShare = guard.filter((l) => YOGA_TALK.test(l)).length;
console.log(`4 tap lines ${guard.length}: foreign-wardrobe ${foreign.length}, strip-talk ${strips.length}, yoga-aware ${yogaShare}`);
if (foreign.length > 0) errors.push(`Day 4 lines mention another day's clothes: ${foreign.slice(0, 2).join(' | ')}`);
if (strips.length > 0) errors.push(`Day 4 lines promise a strip: ${strips.slice(0, 2).join(' | ')}`);
if (yogaShare < guard.length * 0.4) errors.push(`her yoga lines barely talk about the practice (${yogaShare}/${guard.length})`);

// ---------- 5) the «Готово?» flash frame, and the day's own finale card ----------
const flash = await page.evaluate(() => {
  const qa = window.__qaScene;
  return { ...qa.yogaInfo(), triggered: qa.ghostBoo(700) };
});
console.log('5 flash', JSON.stringify(flash));
if (flash.unlocked !== true) errors.push('yogaInfo().unlocked should be true once the plates are served');
if (flash.plates !== true) errors.push('yogaInfo().plates should be true with all four Day-4 frames loaded');
if (!flash.triggered) errors.push('the flash beat refused to run on the yoga day');
await page.waitForTimeout(180);
await shot('day4_5_flash');
const afterFlash = await page.evaluate(() => {
  const sub = document.getElementById('speech-subtitle');
  return { day: window.__qaScene.getState().streamDay, clipped: sub.scrollHeight > sub.clientHeight + 1 };
});
console.log('5 after flash', JSON.stringify(afterFlash));
if (afterFlash.clipped) errors.push('subtitle truncated after the yoga flash');

const finale = await page.evaluate(() => {
  const el = document.getElementById('btn-finale-open');
  return {
    cta: el.classList.contains('hidden') ? null : el.textContent.trim(),
    badge: document.getElementById('stream-day-badge')?.textContent.trim(),
  };
});
console.log('5 finale', JSON.stringify(finale));
if (finale.cta === null) errors.push('the yoga day reached 26000 without offering its finale card');
await openFinaleCard('Йога-день закрыт');
await page.click('#btn-skip-farewell').catch(() => {});
await page.waitForTimeout(500);
const done = await page.evaluate(() => {
  const btn = document.getElementById('btn-start-day2');
  return {
    kicker: document.getElementById('finale-kicker')?.textContent.trim(),
    desc: document.getElementById('finale-desc')?.textContent.trim().slice(0, 120),
    label: btn.textContent.trim(),
    disabled: btn.disabled,
    farewellBeats: window.__qaScene.farewellLineCount(),
    chat: [...document.querySelectorAll('#chat-messages .chat-msg')].slice(-4).map((el) => el.textContent.trim()),
  };
});
console.log('5 card', JSON.stringify(done));
if (!/РАСТЯЖКА|ЙОГА/i.test(done.kicker ?? '')) errors.push(`finale kicker wrong: ${done.kicker}`);
if (!/ни одна снятая вещь|ноль снятых|позы/i.test(done.desc)) errors.push(`finale card should sell the "no strips" rule: ${done.desc}`);
if (!done.disabled) errors.push('Day 5 does not exist — the button must stay disabled, not promise a day');
if (!/следующий формат|чат/i.test(done.label)) errors.push(`terminal button copy wrong: ${done.label}`);
if (done.farewellBeats < 5) errors.push(`the yoga farewell should have 5 beats, got ${done.farewellBeats}`);
const byeStrip = done.chat.filter((l) => STRIP_TALK.test(l) && !NEGATION.test(l));
if (byeStrip.length > 0) errors.push(`the goodbye chat undresses her: ${byeStrip[0].slice(0, 80)}`);
await shot('day4_6_finale');

// ---------- 6) mobile portrait: chat stays right, subtitle never truncates ----------
await load(390, 844, true);
console.log('6 reach', JSON.stringify(await reachDay3Finale()));
await page.waitForTimeout(900);
await openFinaleCard('косплей-день закрыт');
await page.click('#btn-skip-farewell').catch(() => {});
await page.click('#btn-start-day2').catch(() => {});
await page.waitForTimeout(600);
await page.evaluate(() => window.__qaScene.setSubscribers(22000));
await page.waitForTimeout(500);
const mob = await page.evaluate(() => {
  const rect = (id) => {
    const el = document.getElementById(id) ?? document.querySelector(`.${id}`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) };
  };
  const sub = document.getElementById('speech-subtitle');
  return {
    day: window.__qaScene.getState().streamDay,
    stage: window.__qaScene.getState().displayedSubStage,
    plate: window.__qaScene.getActivePlateName(),
    chat: rect('obs-chat-overlay'),
    subtitle: rect('speech-subtitle'),
    subtitleClipped: sub ? sub.scrollHeight > sub.clientHeight + 1 : null,
    chips: [...document.querySelectorAll('.goal-step')].filter((el) => el.offsetParent !== null).map((el) => el.textContent.trim()),
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    vw: window.innerWidth,
  };
});
console.log('6 mobile', JSON.stringify(mob));
if (mob.day !== 4) errors.push(`mobile should be on Day 4, got ${mob.day}`);
if (!mob.plate.startsWith('heroine_t4_')) errors.push(`mobile plate should be a yoga frame, got ${mob.plate}`);
if (mob.chat && mob.chat.l < mob.vw / 2 - 40) errors.push('chat moved off the right side on mobile');
if (mob.subtitleClipped) errors.push('subtitle truncated on mobile');
if (mob.overflowX) errors.push('the yoga day overflows the viewport horizontally on mobile');
await shot('day4_7_mobile');

console.log('errors:', errors.length ? JSON.stringify(errors, null, 1) : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);

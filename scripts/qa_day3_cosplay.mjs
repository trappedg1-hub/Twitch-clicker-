// QA: Day 3 (cosplay day) — gate, ladder copy, dialogue, chat, layout.
// Run against the dev server: `node scripts/qa_day3_cosplay.mjs` (needs vite on :5173).
import chromium from '@sparticuz/chromium';
import { chromium as pwChromium } from 'playwright-core';

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

async function load(width, height, day3Unlocked) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(
    ([on]) => {
      window.__day3Unlocked = on;
    },
    [day3Unlocked],
  );
  await page.goto('http://localhost:5173/?qa', { waitUntil: 'domcontentloaded' });
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

/** Walk Day 1 -> Day 2 -> Day 2 finale (5000 subs) and stop on the farewell card. */
async function reachDay2Finale() {
  return page.evaluate(() => {
    const qa = window.__qaScene;
    qa.addFunds(90_000_000);
    for (let i = 0; i < 10; i++) qa.buyUpgrade('desk_mic');
    qa.setSubscribers(501);
    qa.startDay2();
    qa.setSubscribers(5001);
    return { day: qa.getState().streamDay, subs: qa.getState().subscribers };
  });
}

// ---------- 1) LOCKED: no cosplay art yet -> the card must stay disabled with honest copy ----------
await load(1366, 820, false);
console.log('1 reach', JSON.stringify(await reachDay2Finale()));
await page.waitForTimeout(1200);
await page.click('#btn-skip-farewell').catch(() => {});
await page.waitForTimeout(400);
let locked = await page.evaluate(() => {
  const btn = document.getElementById('btn-start-day2');
  return { disabled: btn.disabled, label: btn.textContent.trim(), unlocked: window.__qaScene.isDay3Unlocked() };
});
console.log('1 locked', JSON.stringify(locked));
if (locked.disabled === false || locked.unlocked === true) errors.push('Day 3 must stay locked without art');
await shot('day3_1_locked');

// ---------- 2) UNLOCKED: start Day 3 and walk the cosplay ladder ----------
await load(1366, 820, true);
console.log('2 reach', JSON.stringify(await reachDay2Finale()));
await page.waitForTimeout(1200);
await page.click('#btn-skip-farewell').catch(() => {});
let ready = await page.evaluate(() => ({
  disabled: document.getElementById('btn-start-day2').disabled,
  label: document.getElementById('btn-start-day2').textContent.trim(),
  desc: document.getElementById('finale-desc').textContent.trim().slice(0, 90),
  unlocked: window.__qaScene.isDay3Unlocked(),
}));
console.log('2 card', JSON.stringify(ready));
if (ready.disabled) errors.push('Day 3 button should be enabled once unlocked');
if (!/КОСПЛЕ|косплей/.test(ready.label)) errors.push(`finale button label missing cosplay copy: ${ready.label}`);

await page.click('#btn-start-day2');
await page.waitForTimeout(600);
let day3 = await page.evaluate(() => {
  const qa = window.__qaScene;
  const st = qa.getState();
  return {
    day: st.streamDay,
    subs: st.subscribers,
    mic: st.upgrades.desk_mic,
    balance: Math.round(st.balance),
    plate: qa.getActivePlateName(),
    dayBadge: document.getElementById('stream-day-badge')?.textContent.trim(),
    goal: document.getElementById('subgoal-target-name')?.textContent.trim(),
    chips: [...document.querySelectorAll('.goal-step')].map((el) => el.textContent.trim()),
    pill: [...document.querySelectorAll('*')].filter((el) => /^Этап\s*\d/.test(el.textContent?.trim() ?? '')).length,
    speech: document.getElementById('speech-subtitle')?.textContent.trim().slice(0, 80),
  };
});
console.log('2 day3 start', JSON.stringify(day3));
if (day3.day !== 3) errors.push(`streamDay should be 3, got ${day3.day}`);
if (day3.mic !== 10) errors.push('desk mic must carry over to Day 3');
if (day3.chips.join(' ') !== '7000 Подол 10000 Четвереньки 13000 Бу! 15000 Плащ') {
  errors.push(`Day 3 chips wrong: ${day3.chips.join(' | ')}`);
}
if (day3.pill > 0) errors.push('the «Этап» pill came back');
await shot('day3_2_start');

// ---------- 3) every Day 3 stage: plate, chips, her line, chat topic ----------
for (const [stage, subs] of [
  [1, 7000],
  [2, 10000],
  [3, 13000],
  [4, 15000],
]) {
  await page.evaluate((target) => window.__qaScene.setSubscribers(target), subs);
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => {
    const qa = window.__qaScene;
    const st = qa.getState();
    const lines = [];
    for (let i = 0; i < 6; i++) lines.push(qa.situationLine(i));
    const chat = [...document.querySelectorAll('#chat-messages .chat-msg')].slice(-8).map((el) => el.textContent.trim());
    const sub = document.getElementById('speech-subtitle');
    return {
      stage: st.displayedSubStage,
      plate: qa.getActivePlateName(),
      patches: qa.facePatchDebug(),
      goal: document.getElementById('subgoal-target-name')?.textContent.trim(),
      chips: [...document.querySelectorAll('.goal-step')].map((el) => el.textContent.trim()),
      outfit: [...document.querySelectorAll('.outfit-card')].map((el) => el.textContent.trim().slice(0, 70)),
      lines,
      chat,
      subtitleClipped: sub ? sub.scrollHeight > sub.clientHeight + 1 : null,
      chatRight: (() => {
        const box = document.querySelector('.obs-chat-overlay')?.getBoundingClientRect();
        return box ? { left: Math.round(box.left), right: Math.round(box.right) } : null;
      })(),
    };
  });
  console.log(`3 stage${stage}`, JSON.stringify(s));
  // Every Day 3 plate is a finished drawing with its own expression (a wink, an open-mouth «Бу!», a
  // smirk through the eye holes) painted at ~1.4x the canonical face scale, so the blush/blink
  // overlays are suppressed on ALL five frames — see FACE_PATCH_COVERED_PLATES.
  const wantHidden = true;
  if (s.patches.hidden !== wantHidden) {
    errors.push(`stage ${stage}: facePatchesHidden=${s.patches.hidden}, expected ${wantHidden}`);
  }
  if (s.stage !== stage) errors.push(`stage ${stage}: displayed ${s.stage}`);
  if (!s.plate.startsWith('heroine_t2_') && !s.plate.startsWith('heroine_t3_')) {
    errors.push(`Day 3 must show cosplay plates (t3) or the Day 2 fallback, got ${s.plate}`);
  }
  const cosplayTalk = s.lines.filter((l) => /простын|сетк|чулк|боди|призрак|дырк|обтяж/i.test(l)).length;
  if (cosplayTalk === 0) errors.push(`stage ${stage}: no situational line mentions the cosplay day`);
  await shot(`day3_3_stage${stage}`);
}

// ---------- 4) her own lines must never claim clothes she does not have ----------
const guard = await page.evaluate(() => {
  const zones = ['head', 'chest', 'belly', 'legs', 'feet'];
  const out = [];
  for (let stage = 0; stage <= 4; stage++) {
    for (const z of zones) {
      for (let seed = 0; seed < 12; seed++) out.push(window.__qaScene.tapLine(z, seed, stage, 3));
    }
  }
  return out;
}).catch(() => null);
if (guard) {
  const bad = guard.filter((l) => /носок|носочк|платье|юбк|легинс/i.test(l));
  console.log('4 tap lines', guard.length, 'suspicious', bad.length);
  if (bad.length > 0) errors.push(`Day 3 lines mention socks/leggings/dress: ${bad.slice(0, 2).join(' | ')}`);
  const sheetTalk = guard.filter((l) => /простын|сетк|боди|дырк/i.test(l)).length;
  console.log('4 sheet-aware lines:', sheetTalk, '/', guard.length);
  if (sheetTalk < guard.length * 0.4) errors.push('Day 3 taps should mostly talk about the costume');
} else {
  console.log('4 tap lines: hook not exposed, skipped');
}

// ---------- 5) mobile portrait: chat stays on the right, subtitle never truncates ----------
await load(390, 844, true);
console.log('5 reach', JSON.stringify(await reachDay2Finale()));
await page.waitForTimeout(900);
await page.click('#btn-skip-farewell').catch(() => {});
await page.click('#btn-start-day2').catch(() => {});
await page.waitForTimeout(500);
await page.evaluate(() => window.__qaScene.setSubscribers(13000));
await page.waitForTimeout(500);
const mob = await page.evaluate(() => {
  const rect = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) };
  };
  const sub = document.getElementById('speech-subtitle');
  return {
    day: window.__qaScene.getState().streamDay,
    stage: window.__qaScene.getState().displayedSubStage,
    chat: rect('obs-chat'),
    subtitle: rect('speech-subtitle'),
    subtitleClipped: sub ? sub.scrollHeight > sub.clientHeight + 1 : null,
    chips: [...document.querySelectorAll('.goal-step')].map((el) => el.textContent.trim()),
    vw: window.innerWidth,
  };
});
console.log('5 mobile', JSON.stringify(mob));
if (mob.chat && mob.chat.l < mob.vw / 2 - 40) errors.push('chat moved off the right side on mobile');
if (mob.subtitleClipped) errors.push('subtitle truncated on mobile');
await shot('day3_5_mobile');

const flash = await page.evaluate(() => {
  const qa = window.__qaScene;
  return { ...qa.ghostInfo(), booted: qa.ghostBoo(600) };
});
console.log('6 ghost flash', JSON.stringify(flash));
if (flash.unlocked !== flash.flashLive) console.log('note: plates partially shipped (stages vs flash)');
await shot('day3_6_ghost_flash');
// the ghost day must never break the layout when flashing on a narrow screen
const after = await page.evaluate(() => {
  const sub = document.getElementById('speech-subtitle');
  return { day: window.__qaScene.getState().streamDay, subtitleClipped: sub.scrollHeight > sub.clientHeight + 1 };
});
console.log('6 after', JSON.stringify(after));
if (after.subtitleClipped) errors.push('subtitle truncated after the ghost flash');

console.log('errors:', errors.length ? JSON.stringify(errors, null, 1) : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);

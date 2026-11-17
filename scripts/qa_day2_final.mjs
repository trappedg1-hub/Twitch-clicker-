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
const context = await browser.newContext({
  viewport: { width: 1366, height: 820 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
});

async function load(width, height) {
  await page.setViewportSize({ width, height });
  await page.goto('http://localhost:5173/?qa', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => Boolean(window.__qaScene && window.__pixiApp && window.__heroineRig),
    { timeout: 25000 },
  );
  await page.waitForTimeout(500);
}

async function shot(name) {
  await page.waitForTimeout(320);
  await page.screenshot({ path: `.qa-out/${name}.png` });
  console.log('saved', name);
}

const micInfo = () =>
  page.evaluate(() => {
    const qa = window.__qaScene;
    const d = qa.getDeskMicDebug();
    const mid = (d.visibleLeft + d.visibleRight) / 2;
    return {
      ...d,
      rightOfCenter: d.x > mid + 40,
      offLeftEdge: d.x - d.width / 2 < d.visibleLeft,
      clippedRight: d.x + d.width / 2 > d.visibleRight,
    };
  });

// ---------- A) Desktop, Tier 0: desk must be empty (no baked mic) ----------
await load(1366, 820);
let m = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.setSubStage(0);
  window.__qaFreezeTicker?.();
  return { mic: qa.getState().upgrades.desk_mic };
});
console.log('A tier0', JSON.stringify(m), JSON.stringify(await micInfo()));
await shot('final_A_desk_empty');

// ---------- B) Desktop, Tier 10: mic planted on the right desk edge ----------
await load(1366, 820);
m = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(900000);
  for (let i = 0; i < 10; i++) qa.buyUpgrade('desk_mic');
  window.__qaFreezeTicker?.();
  return { mic: qa.getState().upgrades.desk_mic };
});
console.log('B tier10', JSON.stringify(m), JSON.stringify(await micInfo()));
await shot('final_B_desk_mic_t10');

// ---------- C) Mobile portrait, tier 10 ----------
await load(390, 844);
m = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(900000);
  for (let i = 0; i < 10; i++) qa.buyUpgrade('desk_mic');
  window.__qaFreezeTicker?.();
  return { mic: qa.getState().upgrades.desk_mic };
});
console.log('C mobile tier10', JSON.stringify(m), JSON.stringify(await micInfo()));
await shot('final_C_mobile_mic_t10');

// ---------- D) Day 1 finale farewell sequence ----------
await load(1366, 820);
m = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(9_000_000);
  let guard = 0;
  while (qa.getState().subscribers < 500 && guard < 60) {
    qa.giftSubs(25);
    guard += 1;
  }
  return { subs: qa.getState().subscribers, stage: qa.getState().displayedSubStage, guard };
});
console.log('D subs', JSON.stringify(m));
await page.waitForTimeout(700);
const beat0 = await page.evaluate(() => ({
  overlayHidden: document.getElementById('day-finale-overlay').classList.contains('hidden'),
  line: document.getElementById('finale-farewell-line').textContent.trim().slice(0, 60),
  btnDisabled: document.getElementById('btn-start-day2').disabled,
  skipVisible: !document.getElementById('btn-skip-farewell').classList.contains('hidden'),
  chatCount: document.querySelectorAll('#chat-messages .chat-msg').length,
  lineH: document.getElementById('finale-farewell-line').getBoundingClientRect().height,
}));
console.log('D beat0', JSON.stringify(beat0));
await shot('final_D1_farewell_beat0');

await page.waitForTimeout(6200);
const beat2 = await page.evaluate(() => ({
  line: document.getElementById('finale-farewell-line').textContent.trim().slice(0, 60),
  btnDisabled: document.getElementById('btn-start-day2').disabled,
  ready: document.querySelector('.day-finale-card').classList.contains('finale-ready'),
}));
console.log('D beat2', JSON.stringify(beat2));
await shot('final_D2_farewell_later');

// skip -> ready, then start Day 2
if (await page.locator('#btn-skip-farewell:visible').count() > 0) {
  await page.click('#btn-skip-farewell');
} else {
  console.log('D skip already hidden (farewell auto-finished or reset)');
}
await page.waitForTimeout(250);
const ready = await page.evaluate(() => ({
  btnDisabled: document.getElementById('btn-start-day2').disabled,
  ready: document.querySelector('.day-finale-card').classList.contains('finale-ready'),
  descVisible: getComputedStyle(document.querySelector('.day-finale-desc')).display,
}));
console.log('D ready', JSON.stringify(ready));
await shot('final_D3_ready');

await page.click('#btn-start-day2');
await page.waitForTimeout(600);
const day2 = await page.evaluate(() => {
  const qa = window.__qaScene;
  const rig = window.__heroineRig;
  const url = rig.mesh?.texture?.source?.url ?? '';
  const wearingDay2 = window.__qaScene.isWearingDay2Outfit();
  return {
    streamDay: qa.getState().streamDay,
    displayed: qa.getState().displayedSubStage,
    carried: qa.getState().carriedOverWardrobeStage,
    mic: qa.getState().upgrades.desk_mic,
    plate: url.split('/').pop(),
    wearingDay2,
    overlayHidden: document.getElementById('day-finale-overlay').classList.contains('hidden'),
    dayBadge: document.getElementById('stream-day-badge').textContent,
    speech: document.getElementById('speech-subtitle').textContent.trim().slice(0, 50),
    speechVisible: document.getElementById('speech-subtitle').classList.contains('visible'),
  };
});
console.log('D day2', JSON.stringify(day2));
await shot('final_D4_day2_outfit');
console.log('D day2 mic', JSON.stringify(await micInfo()));

// ---------- E) Day 2 copy: outfit drawer + ambient chat (still Day 2 state) ----------
const day2Copy = await page.evaluate(() => {
  window.__qaScene.switchTab('outfits');
  const cards = Array.from(document.querySelectorAll('#outfits-grid .outfit-card'));
  const txt = (cards[0]?.textContent ?? '').replace(/\s+/g, ' ').trim();
  return {
    equippedLabel: txt.slice(0, 170),
    mentionsDay2: txt.includes('День 2'),
    mentionsGolf: txt.toLowerCase().includes('гольфы'),
    noZipperTalk: !txt.toLowerCase().includes('молни'),
  };
});
console.log('E outfit day2', JSON.stringify(day2Copy));
await shot('final_E_outfit_day2');

await page.waitForTimeout(11000); // ambient chat ticker pushes Day 2 provocation lines
const ambient = await page.evaluate(() => {
  const texts = Array.from(document.querySelectorAll('#chat-messages .chat-msg')).map((n) =>
    (n.textContent ?? '').toLowerCase(),
  );
  return {
    count: texts.length,
    golfOrHoodie: texts.some((t) => t.includes('гольф') || t.includes('оверсайз')),
    repeatYesterday: texts.some((t) => t.includes('повторим') || t.includes('вчерашн')),
    staleDay1Socks: texts.some((t) => t.includes('полосатые носочки')),
  };
});
console.log('E2 chat day2', JSON.stringify(ambient));
await page.evaluate(() => window.__qaScene.switchTab('stream'));

// ---------- H) Day 2 Sub Goal ladder: 1500 / 2000 / 2500 / 5000 ----------
const ladderSnap = (label) =>
  page.evaluate(
    (lbl) => {
      const qa = window.__qaScene;
      const st = qa.getState();
      const plate = qa.getDeskMicDebug?.().plate ?? '';
      const chips = Array.from(document.querySelectorAll('#subgoal-steps-row .goal-step')).map((n) =>
        (n.textContent ?? '').trim(),
      );
      const mic = qa.getDeskMicDebug();
      return {
        lbl,
        subs: st.subscribers,
        day: st.streamDay,
        unlocked: st.unlockedSubStage,
        displayed: st.displayedSubStage,
        plate,
        goal: (document.getElementById('subgoal-target-name')?.textContent ?? '').trim(),
        chips,
        speech: (document.getElementById('speech-subtitle')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
        micBehind: mic.behindHeroine,
        micX: mic.x,
        micClippedRight: mic.x + mic.width / 2 > mic.visibleRight,
        outfitCard0: (
          document.querySelector('#outfits-grid .outfit-card')?.textContent ?? ''
        )
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 60),
        outfitCards: Array.from(document.querySelectorAll('#outfits-grid .outfit-card')).map((n) =>
          [
            (n.querySelector('.outfit-name')?.textContent ?? '').trim(),
            (n.querySelector('.outfit-req')?.textContent ?? '').trim(),
          ].join(' | '),
        ),
      };
    },
    label,
  );

const climb = (target) =>
  page.evaluate((t) => {
    // QA-only setter: no chat flood, no money grind — just replay the day's ladder.
    window.__qaScene.setSubscribers(t);
  }, target);

console.log('H day2 start', JSON.stringify(await ladderSnap('day2-start')));
await climb(1500);
await page.waitForTimeout(900);
const h1 = await ladderSnap('1500');
console.log('H stage1', JSON.stringify(h1));
await shot('final_H1_day2_1500');
if (h1.displayed !== 1 || !String(h1.plate).includes('heroine_t2_s1')) {
  errors.push(`Day 2 stage 1 (1500 subs) did not swap the plate: ${JSON.stringify(h1)}`);
}
if (!h1.micBehind) errors.push('Desk mic is drawn OVER the heroine plate — it must sit behind her');

for (const [goal, expect] of [[2000, 'heroine_t2_s2'], [2500, 'heroine_t2_s3']]) {
  await climb(goal);
  await page.waitForTimeout(700);
  const mid = await ladderSnap(String(goal));
  console.log(`H stage${goal}`, JSON.stringify(mid));
  await shot(`final_H_day2_${goal}`);
  if (!String(mid.plate).includes(expect)) {
    errors.push(`Day 2 ${goal} subs must show ${expect}, got ${mid.plate}`);
  }
}

await climb(5000);
await page.waitForTimeout(1400);
const h4 = await ladderSnap('5000');
console.log('H finale', JSON.stringify(h4));
await shot('final_H2_day2_finale');
if (h4.unlocked !== 4 || !String(h4.plate).includes('heroine_t2_s4')) {
  errors.push(`Day 2 finale (5000 subs) plate not applied: ${JSON.stringify(h4)}`);
}
if (JSON.stringify(h4.chips) !== JSON.stringify(['✓ 1500 Худи', '✓ 2000 Талия', '✓ 2500 Лямки', '✓ 5000 Гольфы'])) {
  errors.push(`Day 2 chip row wrong at the finale: ${JSON.stringify(h4.chips)}`);
}
if (!h4.chips.every((c) => c.startsWith('\u2713'))) {
  errors.push(`Day 2 sub goal chips not all done at 5000 subs: ${JSON.stringify(h4.chips)}`);
}
if (!String(h4.outfitCards?.[4] ?? '').includes('Сейчас в кадре')) {
  errors.push(`Day 2 finale outfit card not marked equipped: ${JSON.stringify(h4.outfitCards)}`);
}
if (!/босы|гольф/.test(String(h4.outfitCards?.[4] ?? '').toLowerCase())) {
  errors.push(`Day 2 finale card must describe the socks coming off: ${h4.outfitCards?.[4]}`);
}
if (/носки|носочк/.test(h4.speech)) {
  errors.push(`Day 2 unlock speech still talks about socks: ${h4.speech}`);
}
await page.evaluate(() => window.__qaScene.switchTab('stream'));

// ---------- F) Mobile Day 2 look ----------
await load(390, 844);
m = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(900000);
  for (let i = 0; i < 3; i++) qa.buyUpgrade('desk_mic');
  window.__qaFreezeTicker?.();
  return { mic: qa.getState().upgrades.desk_mic };
});
console.log('F mobile day2', JSON.stringify(m), JSON.stringify(await micInfo()));
await shot('final_F_mobile_day2');

// ---------- G) Upgrades drawer screenshot for overlap review ----------
await page.evaluate(() => window.__qaScene.switchTab('upgrades'));
await page.waitForTimeout(450);
const drawer = await page.evaluate(() => {
  const d = document.getElementById('tab-drawer');
  const r = d?.getBoundingClientRect();
  return {
    drawerTop: r ? Math.round(r.top) : null,
    drawerBottom: r ? Math.round(r.bottom) : null,
    scrollable: d ? d.scrollHeight > d.clientHeight + 2 : null,
    innerH: window.innerHeight,
  };
});
console.log('G drawer', JSON.stringify(drawer));
await shot('final_G_shop_drawer');

// ---------- I) Face patches glued per plate, mic compact on the desk edge, gift-sub pack picker ----------
const faceProbe = () =>
  page.evaluate(() => {
    const qa = window.__qaScene;
    const st = qa.getState();
    const a = qa.getFaceAnchorDebug();
    const d = qa.getDeskMicDebug();
    return {
      subs: st.subscribers,
      stage: st.displayedSubStage,
      plate: qa.getActivePlateName(),
      anchor: `${a.x},${a.y},${a.w},${a.h}`,
      anchorTracksHead: a.w !== 348 || a.h !== 397,
      micWidth: d.width,
      micBehind: d.behindHeroine,
      micClippedRight: d.x + d.width / 2 > d.visibleRight,
      micOffLeft: d.x - d.width / 2 < d.visibleLeft,
    };
  });

// Re-enter Day 2 from scratch (a reload resets to Day 1), then buy the desk mic.
await load(1366, 820);
await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(900000);
  for (let i = 0; i < 10; i++) qa.buyUpgrade('desk_mic');
  qa.setSubscribers(501);
});
await page.waitForTimeout(900);
if (await page.locator('#btn-skip-farewell:visible').count() > 0) {
  await page.click('#btn-skip-farewell');
}
await page.waitForTimeout(300);
await page.click('#btn-start-day2');
await page.waitForTimeout(700);
const day2ready = await page.evaluate(() => window.__qaScene.getState().streamDay);
if (day2ready !== 2) errors.push(`I: failed to enter Day 2 (streamDay=${day2ready})`);

for (const [label, subs] of [
  ['2500', 2500],
  ['5000', 5001],
]) {
  await page.evaluate((target) => window.__qaScene.setSubscribers(target), subs);
  await page.evaluate(() => {
    window.__qaFreezeTicker?.();
    window.__qaScene.forceFluster();
  });
  await page.waitForTimeout(420);
  const probe = await faceProbe();
  console.log(`I day2 ${label}`, JSON.stringify(probe));
  if (probe.plate !== (label === '2500' ? 'heroine_t2_s3.webp' : 'heroine_t2_s4.webp')) {
    errors.push(`I ${label}: wrong plate ${probe.plate}`);
  }
  // The leaning plates must use their own measured box, not the canonical one.
  if (!probe.anchorTracksHead) errors.push(`I ${label}: face patch still on the canonical box (${probe.anchor})`);
  if (probe.micOffLeft) errors.push(`I ${label}: mic slid off the left edge of the desk`);
  await shot(`final_I_day2_${label}_face`);
}

// Gift-sub packs: the caret opens a Twitch-style picker with 5/25/50/100.
await load(1366, 820);
const packState = () =>
  page.evaluate(() => {
    const menu = document.getElementById('sub-pack-menu');
    const rows = Array.from(document.querySelectorAll('#sub-pack-menu .sub-pack-row'));
    return {
      open: Boolean(menu) && !menu.hidden,
      caret: document.querySelector('.tw-sub-pack-now')?.textContent ?? '',
      caretCost: document.getElementById('gift-cost-pack')?.textContent ?? '',
      single: document.getElementById('gift-cost-1')?.textContent ?? '',
      rows: rows.map((r) => `${r.dataset.pack}:${r.querySelector('span')?.textContent}:${r.disabled ? 'off' : 'on'}`),
      subs: window.__qaScene.getState().subscribers,
      etapaText: [...document.querySelectorAll('*')].filter((el) =>
        /\bЭтап \d/.test(el.textContent ?? ''),
      ).length,
    };
  });

const closed = await packState();
if (closed.open) errors.push('I packs: menu is open on load');
if (closed.etapaText > 0) errors.push(`I packs: "Этап N" still rendered in ${closed.etapaText} nodes`);
await page.click('#btn-gift-sub-menu');
await page.waitForTimeout(160);
const opened = await packState();
console.log('I packs open', JSON.stringify(opened));
if (!opened.open) errors.push('I packs: caret did not open the picker');
if (opened.rows.length !== 4) errors.push(`I packs: expected 4 pack sizes, got ${opened.rows.length}`);
for (const need of ['5:', '25:', '50:', '100:']) {
  if (!opened.rows.some((r) => r.startsWith(need))) errors.push(`I packs: missing pack ${need}`);
}
await shot('final_I_subpack_menu');

// x50 must actually gift 50 subs and close the menu.
await page.evaluate(() => window.__qaScene.addFunds(100000));
// The picker is still open from the previous step: Escape proves it closes, then reopen it.
await page.keyboard.press('Escape');
await page.waitForTimeout(120);
if ((await packState()).open) errors.push('I packs: Escape did not close the picker');
await page.click('#btn-gift-sub-menu');
await page.waitForTimeout(140);
await page.click('#sub-pack-menu .sub-pack-row[data-pack="50"]');
await page.waitForTimeout(320);
const afterGift = await packState();
console.log('I packs x50', JSON.stringify(afterGift));
if (afterGift.open) errors.push('I packs: menu stayed open after picking a pack');
if (afterGift.subs - opened.subs < 50) {
  errors.push(`I packs: x50 gifted only ${afterGift.subs - opened.subs} subs`);
}
if (afterGift.caret.trim() !== 'x50') errors.push(`I packs: caret still shows ${afterGift.caret}`);

// Clicking outside closes it, and the single-sub button is untouched.
await page.click('#stat-viewers-val');
await page.waitForTimeout(140);
if ((await packState()).open) errors.push('I packs: outside click did not close the menu');
await page.evaluate(() => window.__qaScene.giftSubs(1));
await page.waitForTimeout(200);
const single = await packState();
if (single.subs - afterGift.subs < 1) errors.push('I packs: single-sub button stopped working');

console.log('errors:', errors.length ? JSON.stringify(errors) : 'none');
await browser.close();
process.exit(0);

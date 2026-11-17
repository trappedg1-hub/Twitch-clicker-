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

console.log('errors:', errors.length ? JSON.stringify(errors) : 'none');
await browser.close();
process.exit(0);

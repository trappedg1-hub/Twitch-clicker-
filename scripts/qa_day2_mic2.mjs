import chromium from '@sparticuz/chromium';
import { chromium as pwChromium } from 'playwright-core';

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
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`); });

async function load(width, height) {
  await page.setViewportSize({ width, height });
  await page.goto('http://localhost:5173/?qa', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__qaScene && window.__pixiApp && window.__heroineRig), { timeout: 20000 });
  await page.waitForTimeout(400);
}

async function shot(name) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `.qa-out/${name}.png` });
  console.log('saved', name);
}

// Desktop T8
await load(1366, 820);
let m = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(500000);
  for (let i = 0; i < 8; i++) qa.buyUpgrade('desk_mic');
  qa.setSubStage(4);
  qa.tapZone('chest');
  window.__qaFreezeTicker?.();
  const alertEl = document.getElementById('donation-alert');
  return { mic: qa.getState().upgrades.desk_mic, alertHidden: alertEl.classList.contains('hidden'), alertText: document.getElementById('donation-alert-amount')?.textContent };
});
console.log('desktop_t8', JSON.stringify(m));
await shot('day2_desktop_mic_t8');

// Desktop T10
await load(1366, 820);
m = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(500000);
  for (let i = 0; i < 10; i++) qa.buyUpgrade('desk_mic');
  qa.setSubStage(4);
  window.__qaFreezeTicker?.();
  return { mic: qa.getState().upgrades.desk_mic };
});
console.log('desktop_t10', JSON.stringify(m));
await shot('day2_desktop_mic_t10');

// Mobile T1
await load(390, 844);
m = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(500000);
  qa.buyUpgrade('desk_mic');
  qa.tapZone('chest');
  qa.tapZone('legs');
  window.__qaFreezeTicker?.();
  const chat = document.querySelector('.obs-chat-overlay');
  const speech = document.getElementById('speech-subtitle');
  const cr = chat.getBoundingClientRect();
  const sr = speech.getBoundingClientRect();
  const alertEl = document.getElementById('donation-alert');
  return {
    mic: qa.getState().upgrades.desk_mic,
    chatRight: Math.round(cr.right), chatLeft: Math.round(cr.left),
    speechW: Math.round(sr.width), speechH: Math.round(sr.height),
    speechOpacity: getComputedStyle(speech).opacity,
    speechWS: getComputedStyle(speech).whiteSpace,
    alertHidden: alertEl.classList.contains('hidden'),
  };
});
console.log('mobile_t1', JSON.stringify(m));
await shot('day2_mobile_mic_t1');

// Mobile T8
await load(390, 844);
m = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(500000);
  for (let i = 0; i < 8; i++) qa.buyUpgrade('desk_mic');
  qa.setSubStage(4);
  qa.tapZone('belly');
  window.__qaFreezeTicker?.();
  return { mic: qa.getState().upgrades.desk_mic };
});
console.log('mobile_t8', JSON.stringify(m));
await shot('day2_mobile_mic_t8');

// Finale overlay
await load(1366, 820);
m = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(500000);
  for (let i = 0; i < 20; i++) qa.giftSubs(25);
  window.__qaFreezeTicker?.();
  return { subs: qa.getState().subscribers, day: qa.getState().streamDay, overlayHidden: document.getElementById('day-finale-overlay').classList.contains('hidden') };
});
console.log('finale', JSON.stringify(m));
await shot('day2_finale_overlay');

// Day 2 started
await load(1366, 820);
m = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(500000);
  qa.buyUpgrade('desk_mic');
  for (let i = 0; i < 20; i++) qa.giftSubs(25);
  qa.startDay2();
  qa.tapZone('chest');
  window.__qaFreezeTicker?.();
  const s = qa.getState();
  return { day: s.streamDay, mic: s.upgrades.desk_mic, stage: s.displayedSubStage, carried: s.carriedOverWardrobeStage };
});
console.log('day2', JSON.stringify(m));
await shot('day2_started');

// Upgrades drawer
await load(1366, 820);
m = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(500000);
  qa.buyUpgrade('desk_mic');
  qa.switchTab('upgrades');
  window.__qaFreezeTicker?.();
  return { mic: qa.getState().upgrades.desk_mic };
});
console.log('upgrades', JSON.stringify(m));
await shot('day2_upgrades_mic');

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
console.log('QA DONE');
process.exit(0);

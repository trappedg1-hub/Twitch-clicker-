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

// Desktop upgrades drawer: mic card fully visible?
await load(1366, 820);
let m = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(500000);
  qa.buyUpgrade('desk_mic');
  qa.switchTab('upgrades');
  window.__qaFreezeTicker?.();
  const micBtn = document.querySelector('[data-upgrade-id="desk_mic"]');
  const r = micBtn.getBoundingClientRect();
  const dayBadge = document.getElementById('stream-day-badge');
  const dr = dayBadge.getBoundingClientRect();
  return {
    micCardTop: Math.round(r.top), micCardBottom: Math.round(r.bottom),
    drawerBottom: Math.round(document.getElementById('tab-drawer').getBoundingClientRect().bottom),
    dayBadgeText: dayBadge.textContent, dayBadgeW: Math.round(dr.width),
    dayBadgeScrollW: dayBadge.scrollWidth,
  };
});
console.log('desktop_upgrades', JSON.stringify(m));
await page.waitForTimeout(350);
await page.screenshot({ path: '.qa-out/fix_desktop_upgrades.png' });

// Mobile: chat above speech, no overlap?
await load(390, 844);
m = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(500000);
  qa.buyUpgrade('desk_mic');
  qa.tapZone('chest');
  qa.tapZone('legs');
  window.__qaFreezeTicker?.();
  const chat = document.querySelector('.obs-chat-overlay').getBoundingClientRect();
  const speech = document.getElementById('speech-subtitle').getBoundingClientRect();
  return {
    chatBottom: Math.round(chat.bottom), speechTop: Math.round(speech.top),
    chatAboveSpeech: chat.bottom <= speech.top + 1,
    chatRight: Math.round(chat.right),
  };
});
console.log('mobile_overlap', JSON.stringify(m));
await page.waitForTimeout(350);
await page.screenshot({ path: '.qa-out/fix_mobile_chat.png' });

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
console.log('QA DONE');
process.exit(0);

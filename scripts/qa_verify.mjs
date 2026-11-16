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
  viewport: { width: 1440, height: 860 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
});

await page.goto('http://localhost:5173/?qa', { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__qaScene && window.__pixiApp && window.__heroineRig), {
  timeout: 15000,
});
await page.waitForTimeout(350);

// 1. Default Pure Twitch Stream View ('stream' tab — tap once so subtitle shows on wooden desk!)
await page.evaluate(() => {
  window.__qaScene.tapZone('legs');
  window.__qaFreezeTicker?.();
});
await page.screenshot({ path: '.qa-out/live_v3_stream.png' });

// 2. Open 'upgrades' drawer
await page.evaluate(() => window.__qaScene.switchTab('upgrades'));
await page.waitForTimeout(100);
await page.screenshot({ path: '.qa-out/live_v3_upgrades.png' });

// 3. Open 'story' drawer + trigger hot challenge + custom Twitch emotes burst
const summary = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.switchTab('story');
  qa.addFunds(500);
  qa.buyUpgrade('ring_lamp');
  qa.buyUpgrade('usb_mic_pop');
  qa.buyUpgrade('obs_alerts');
  for (let i = 0; i < 6; i++) qa.tapZone('chest');
  const challengeRan = qa.runChallenge('pose_feet');
  qa.forceFluster();
  return {
    state: qa.getState(),
    stats: qa.getStats(),
    challengeRan,
  };
});
await page.waitForTimeout(120);
await page.screenshot({ path: '.qa-out/live_v3_story.png' });

await browser.close();

console.log('QA v3 Summary:', JSON.stringify(summary, null, 2));
if (errors.length > 0) {
  console.error('QA Errors:', errors);
  process.exit(1);
}
console.log('QA v3 PASSED with 0 console/page errors!');

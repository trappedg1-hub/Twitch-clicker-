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
  viewport: { width: 1360, height: 800 },
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
await page.waitForTimeout(300);

// 1. Live Fanservice Fever Overheat + Viral Clip Chat + New Emotes + Ticklish Gasp!
const summary = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(260000);
  for (let i = 0; i < 40; i++) {
    qa.giftSubs(25);
  }
  qa.tapZone('chest');
  qa.tapZone('legs');
  qa.tapZone('belly');
  qa.tapZone('feet');
  qa.forceEmotion('fluster');
  window.__qaFreezeTicker?.();
  return {
    state: qa.getState(),
    rig: window.__heroineRig.getDebugSnapshot(),
  };
});
await page.waitForTimeout(350);
await page.screenshot({ path: '.qa-out/live_v7_fever_fanservice.png' });

// 2. Open Story & Fanservice Drawer (Diary + 3x2 6-Challenge Fanservice Deck!)
await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.switchTab('story');
  qa.forceEmotion('tease');
  window.__pixiApp.render();
});
await page.waitForTimeout(250);
await page.screenshot({ path: '.qa-out/live_v7_story_challenges.png' });

await browser.close();

console.log('QA v7 Summary:', JSON.stringify(summary.rig), 'taps=', summary.state.totalTaps);
if (errors.length > 0) {
  console.error('QA Errors:', errors);
  process.exit(1);
}
console.log('QA v7 PASSED with 0 console/page errors!');

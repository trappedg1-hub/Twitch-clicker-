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

// Unlock all the way to 1000 subs -> Stage 5 Mega Cosplay (Feet propped on desk in camera!)
const summary = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(250000);
  for (let i = 0; i < 40; i++) {
    qa.giftSubs(25);
  }
  qa.tapZone('feet');
  window.__qaFreezeTicker?.();
  return {
    state: qa.getState(),
    rig: window.__heroineRig.getDebugSnapshot(),
  };
});
await page.waitForTimeout(350);
await page.screenshot({ path: '.qa-out/live_v6_cosplay_feet_desk.png' });

// Also capture the 3x2 Sub Goal Outfits drawer showing all 6 stages unlocked!
await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.switchTab('outfits');
  qa.forceEmotion('tease');
  window.__pixiApp.render();
});
await page.waitForTimeout(250);
await page.screenshot({ path: '.qa-out/live_v6_outfits_3x2.png' });

await browser.close();

console.log('QA v6 Summary:', JSON.stringify(summary.rig), 'subs=', summary.state.subscribers);
if (errors.length > 0) {
  console.error('QA Errors:', errors);
  process.exit(1);
}
console.log('QA v6 PASSED with 0 console/page errors!');

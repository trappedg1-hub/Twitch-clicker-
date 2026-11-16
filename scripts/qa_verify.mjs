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
  viewport: { width: 1280, height: 760 },
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

// Unlock all 5 stages up to 500 subs (black bralette) + open Sub Goal Wardrobe drawer
const summary = await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(100000);
  for (let i = 0; i < 20; i++) {
    qa.giftSubs(25);
  }
  qa.switchTab('outfits');
  qa.forceFluster();
  window.__qaFreezeTicker?.();
  return {
    state: qa.getState(),
    stats: qa.getStats(),
    rig: window.__heroineRig.getDebugSnapshot(),
  };
});
await page.waitForTimeout(250);
await page.screenshot({ path: '.qa-out/live_s4_v2.png' });

await browser.close();

console.log('QA v4 Summary:', JSON.stringify(summary, null, 2));
if (errors.length > 0) {
  console.error('QA Errors:', errors);
  process.exit(1);
}
console.log('QA v4 PASSED with 0 console/page errors!');

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
  deviceScaleFactor: 2,
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
await page.waitForTimeout(400);

// 1. Capture clean idle state
await page.evaluate(() => window.__qaFreezeTicker?.());
await page.screenshot({ path: '.qa-out/live_ui_idle.png' });

// 2. Test gameplay loop: taps -> donation alert on 12th tap -> add funds -> buy upgrades -> fluster expression
const summary = await page.evaluate(() => {
  const qa = window.__qaScene;
  for (let i = 0; i < 6; i++) qa.tapZone('chest');
  for (let i = 0; i < 6; i++) qa.tapZone('feet'); // 12th tap triggers Donation Alert!
  qa.addFunds(200);
  const boughtLamp = qa.buyUpgrade('ring_lamp');
  const boughtMic = qa.buyUpgrade('usb_mic_pop');
  qa.forceFluster();
  return {
    state: qa.getState(),
    stats: qa.getStats(),
    rig: window.__heroineRig.getDebugSnapshot(),
    boughtLamp,
    boughtMic,
  };
});

await page.waitForTimeout(150);
await page.screenshot({ path: '.qa-out/live_ui_action.png' });
await browser.close();

console.log('QA Summary:', JSON.stringify(summary, null, 2));
if (errors.length > 0) {
  console.error('QA Errors:', errors);
  process.exit(1);
}
console.log('QA PASSED with 0 console/page errors!');

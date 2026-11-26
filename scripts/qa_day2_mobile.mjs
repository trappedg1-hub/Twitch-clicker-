// Fast mobile-portrait check: face patches per plate + compact desk mic at the right corner.
import chromium from '@sparticuz/chromium';
import { chromium as pwChromium } from 'playwright-core';

const browser = await pwChromium.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});

await page.goto('http://localhost:5173/?qa', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__qaScene && window.__heroineRig), { timeout: 30000 });
await page.waitForTimeout(500);

await page.evaluate(() => {
  const qa = window.__qaScene;
  qa.addFunds(900000);
  for (let i = 0; i < 10; i++) qa.buyUpgrade('desk_mic');
  qa.setSubscribers(501);
});
await page.waitForTimeout(900);
if (await page.locator('#btn-skip-farewell:visible').count() > 0) await page.click('#btn-skip-farewell');
await page.waitForTimeout(300);
await page.click('#btn-start-day2');
await page.waitForTimeout(700);

const probe = () =>
  page.evaluate(() => {
    const qa = window.__qaScene;
    const st = qa.getState();
    const d = qa.getDeskMicDebug();
    const a = qa.getFaceAnchorDebug();
    const sub = document.getElementById('speech-subtitle');
    const chat = document.querySelector('.chat-panel') ?? document.getElementById('chat-messages');
    const cs = sub ? getComputedStyle(sub) : null;
    return {
      subs: st.subscribers,
      day: st.streamDay,
      plate: qa.getActivePlateName(),
      anchor: `${a.x},${a.y},${a.w},${a.h}`,
      mic: {
        x: d.x,
        width: d.width,
        behind: d.behindHeroine,
        clippedRight: d.x + d.width / 2 > d.visibleRight,
        offLeftEdge: d.x - d.width / 2 < d.visibleLeft,
        insideFrame: [Math.round(d.visibleLeft), Math.round(d.visibleRight)],
      },
      subtitleOverlapsChat: Boolean(sub && chat) ? sub.getBoundingClientRect().right > chat.getBoundingClientRect().left : null,
      subtitleClipped: cs ? sub.scrollHeight > sub.clientHeight + 2 : null,
    };
  });

for (const [label, subs] of [
  ['2500', 2500],
  ['5000', 5001],
]) {
  await page.evaluate((t) => window.__qaScene.setSubscribers(t), subs);
  await page.evaluate(() => {
    window.__qaFreezeTicker?.();
    window.__qaScene.forceFluster();
  });
  await page.waitForTimeout(450);
  const r = await probe();
  console.log(`M ${label}`, JSON.stringify(r));
  const wantPlate = label === '2500' ? 'heroine_t2_s3.webp' : 'heroine_t2_s4.webp';
  if (r.plate !== wantPlate) errors.push(`M ${label}: plate ${r.plate} != ${wantPlate}`);
  if (r.anchor === '338,61,348,397') errors.push(`M ${label}: face patch not tracking this plate`);
  if (!r.mic.behind) errors.push(`M ${label}: mic drawn over her`);
  if (r.mic.offLeftEdge) errors.push(`M ${label}: mic pushed off the left of the desk`);
  if (r.mic.width > 300) errors.push(`M ${label}: mic too wide (${r.mic.width})`);
  if (r.subtitleClipped) errors.push(`M ${label}: subtitle truncated`);
  await page.screenshot({ path: `.qa-out/final_M_mobile_${label}.png` });
}

console.log('errors:', errors.length ? JSON.stringify(errors) : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);

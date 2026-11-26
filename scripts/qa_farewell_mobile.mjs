import chromium from '@sparticuz/chromium';
import { chromium as pwChromium } from 'playwright-core';

const browser = await pwChromium.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

for (const [w, h, tag] of [[390, 844, 'mobile'], [360, 740, 'small'], [1366, 820, 'desktop']]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('http://localhost:5173/?qa', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__qaScene), { timeout: 25000 });
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => {
    const qa = window.__qaScene;
    qa.addFunds(9_000_000);
    let guard = 0;
    while (qa.getState().subscribers < 500 && guard < 60) {
      qa.giftSubs(25);
      guard += 1;
    }
    return { subs: qa.getState().subscribers };
  });
  await page.waitForTimeout(1200);
  const box = await page.evaluate(() => {
    const card = document.querySelector('.day-finale-card');
    const line = document.getElementById('finale-farewell-line');
    const chat = document.querySelector('.obs-chat-overlay');
    const subgoal = document.getElementById('obs-subgoal');
    const r = card.getBoundingClientRect();
    const lr = line.getBoundingClientRect();
    const cr = chat.getBoundingClientRect();
    const sr = subgoal.getBoundingClientRect();
    return {
      card: { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), rt: Math.round(r.right) },
      lineHeight: Math.round(lr.height),
      lineOverflow: lr.bottom > r.bottom + 1,
      insideViewport: r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.left >= 0 && r.right <= window.innerWidth + 1,
      coversChat: r.bottom > cr.top && r.top < cr.bottom,
      overlapsSubgoal: r.top < sr.bottom && r.bottom > sr.top,
      btnDisabled: document.getElementById('btn-start-day2').disabled,
      vh: window.innerHeight,
    };
  });
  console.log(tag, JSON.stringify(st), JSON.stringify(box));
  await page.screenshot({ path: `.qa-out/farewell_${tag}.png` });
}

console.log('errors:', errors.length ? JSON.stringify(errors) : 'none');
await browser.close();
process.exit(0);

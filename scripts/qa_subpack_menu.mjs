// The gift-sub picker must be fully inside the viewport on desktop AND mobile portrait.
import chromium from '@sparticuz/chromium';
import { chromium as pw } from 'playwright-core';
const browser = await pw.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  headless: true,
});
const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

for (const [w, h, tag] of [[1366, 820, 'desktop'], [390, 844, 'mobile']]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('http://localhost:5173/?qa', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__qaScene), { timeout: 30000 });
  await page.evaluate(() => window.__qaScene.addFunds(900000));
  await page.waitForTimeout(300);
  await page.click('#btn-gift-sub-menu');
  await page.waitForTimeout(260);
  const box = await page.evaluate(() => {
    const m = document.getElementById('sub-pack-menu');
    const r = m.getBoundingClientRect();
    return {
      hidden: m.hidden,
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      rows: m.querySelectorAll('.sub-pack-row').length,
      disabled: m.querySelectorAll('.sub-pack-row:disabled').length,
      vh: window.innerHeight,
      vw: window.innerWidth,
    };
  });
  const fits = box.y >= 0 && box.y + box.h <= box.vh + 1 && box.x >= -1 && box.x + box.w <= box.vw + 1;
  console.log(tag, JSON.stringify(box), 'fits:', fits);
  if (!fits || box.hidden || box.rows !== 4 || box.disabled !== 0) errors.push(`${tag}: menu misplaced/clipped`);
  await page.screenshot({ path: `.qa-out/final_N_subpack_${tag}.png` });
}

console.log('errors:', errors.length ? JSON.stringify(errors) : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);

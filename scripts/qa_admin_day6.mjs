// Check the real admin DOM (the panel is intentionally absent under ?qa).
import assert from 'node:assert/strict';
import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';

const browser = await playwright.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'], headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.QA_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#admin-toggle', { timeout: 40000 });
  await page.click('#admin-toggle');
  const button = page.locator('#admin-panel [data-day="6"]');
  await button.waitFor();
  await page.waitForFunction(() => !document.querySelector('#admin-panel [data-day="6"]').disabled, { timeout: 40000 });
  await button.click();
  await page.waitForFunction(() => document.querySelector('#admin-panel [data-out="day"]').textContent.includes('День 6'));
  assert.match(await page.locator('#admin-panel [data-out="plate"]').textContent(), /heroine_t6_start/);
  for (const stage of [1, 2, 3, 4]) {
    await page.locator(`#admin-panel [data-stage="${stage}"]`).click();
    await page.waitForFunction(s => document.querySelector('#admin-panel [data-out="plate"]').textContent.includes(`heroine_t6_s${s-1}`), stage, { timeout: 10000 });
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#admin-toggle', { timeout: 40000 });
  await page.click('#admin-toggle');
  assert.match(await page.locator('#admin-panel [data-out="day"]').textContent(), /День 6/);
  assert.match(await page.locator('#admin-panel [data-out="plate"]').textContent(), /heroine_t6_s3/);
  assert.deepEqual(errors, []);
  console.log('Admin Day 6 button, all stages and reload: OK');
} finally { await browser.close(); }

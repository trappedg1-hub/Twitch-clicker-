// Real ticker, no taps needed for breathing. Checks both mesh and the fixed chair container.
import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';
import assert from 'node:assert/strict';
const browser = await playwright.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'], headless: true });
try {
  const page = await browser.newPage({viewport:{width:1366,height:820}});
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto(`${process.env.QA_BASE ?? 'http://localhost:5181'}/?qa`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__qaScene?.isDay6Unlocked(),{timeout:40000});
  await page.evaluate(()=>{ const q=window.__qaScene; q.setSubscribers(5000);q.startDay2();q.setSubscribers(15000);q.startDay3();q.setSubscribers(15000);q.startDay4();q.setSubscribers(26000);q.startDay5();q.setSubscribers(47000);q.startDay6(); });
  for (const [subs,index] of [[47000,0],[50500,1],[54000,2],[61000,3],[68000,4]]) {
    await page.evaluate(n=>window.__qaScene.setSubscribers(n),subs);
    await page.waitForFunction(()=>window.__heroineRig.getDebugSnapshot().torsoMovement > 0.15,null,{timeout:20000});
    const s=await page.evaluate(()=>({ rig:window.__heroineRig.getDebugSnapshot(), plate:window.__qaScene.getActivePlateName() }));
    assert.equal(s.plate,index === 0 ? `heroine_t6_start.webp` : `heroine_t6_s${index-1}.webp`);
    assert.equal(s.rig.chairMovement,0); assert.equal(s.rig.bodyX,0); assert.equal(s.rig.bodyY,0);
    assert.equal(s.rig.bodyScaleX,1); assert.equal(s.rig.bodyScaleY,1); assert.equal(s.rig.bodyRotation,0);
    console.log(`s${index}: torso ${s.rig.torsoMovement.toFixed(3)} px, chair ${s.rig.chairMovement} px`);
    if (index===2) await page.screenshot({path:'.qa-out/day6_cheek_live.png'});
  }
  const previous=await page.evaluate(()=>window.__qaScene.getState().totalTaps);
  await page.evaluate(()=>{for(let i=0;i<12;i++)window.__qaScene.tapZone('head');});
  assert.equal(await page.evaluate(()=>window.__qaScene.getState().totalTaps),previous+12);
  const after=await page.evaluate(()=>window.__heroineRig.getDebugSnapshot());
  assert.equal(after.chairMovement,0); assert.equal(after.bodyScaleX,1);
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.waitForFunction(()=>window.__heroineRig.getDebugSnapshot().torsoMovement === 0,null,{timeout:10000});
  assert.deepEqual(errors,[]); console.log('Breathing, static chair, tapping and reduced motion: OK');
} finally { await browser.close(); }

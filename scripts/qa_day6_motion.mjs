import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';
import assert from 'node:assert/strict';

const browser = await playwright.launch({executablePath:await chromium.executablePath(),args:[...chromium.args,'--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'],headless:true});
try {
  const page = await browser.newPage({viewport:{width:1366,height:820}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.QA_BASE ?? 'http://localhost:5180'}/?qa`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__qaScene?.isDay6Unlocked(),{timeout:40000});
  await page.evaluate(()=>{ const q=window.__qaScene; q.setSubscribers(5000); q.startDay2(); q.setSubscribers(15000); q.startDay3(); q.setSubscribers(15000); q.startDay4(); q.setSubscribers(26000); q.startDay5(); q.setSubscribers(47000); q.startDay6(); q.setSubscribers(53980); q.addFunds(100000); });
  assert.equal(await page.evaluate(()=>window.__qaScene.getState().streamDay),6);
  // Freeze rendering for a deterministic burst of actual game taps, then resume the normal ticker.
  const during=await page.evaluate(()=>{
    const q=window.__qaScene; window.__pixiApp.ticker.stop();
    const before={...q.getState()};
    for(let i=0;i<38;i++) q.tapZone('feet');
    const active=window.__heroineRig.getDebugSnapshot();
    const gifted=q.giftSubs(30);
    const out={before,active,gifted,state:{...q.getState()},plate:q.getActivePlateName()};
    window.__pixiApp.ticker.start();
    return out;
  });
  assert.equal(during.active.day6GestureActive,true);
  assert.equal(during.state.totalTaps,during.before.totalTaps+38);
  assert.ok(during.state.totalEarned>during.before.totalEarned);
  assert.equal(during.gifted,true); assert.equal(during.state.unlockedSubStage,1);
  assert.equal(during.state.displayedSubStage,0); assert.equal(during.plate,'heroine_t6_s0.webp');
  await page.waitForFunction(()=>!window.__heroineRig.getDebugSnapshot().day6GestureActive,null,{timeout:30000});
  const after=await page.evaluate(()=>({state:window.__qaScene.getState(),plate:window.__qaScene.getActivePlateName()}));
  assert.equal(after.state.displayedSubStage,1); assert.equal(after.plate,'heroine_t6_s1.webp');
  await page.evaluate(()=>{for(let i=0;i<10;i++) window.__qaScene.tapZone('head');});
  assert.equal(await page.evaluate(()=>window.__heroineRig.getDebugSnapshot().day6GestureActive),false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__qaScene?.isDay6Unlocked(),{timeout:40000});
  await page.evaluate(()=>{ const q=window.__qaScene; q.setSubscribers(5000); q.startDay2(); q.setSubscribers(15000); q.startDay3(); q.setSubscribers(15000); q.startDay4(); q.setSubscribers(26000); q.startDay5(); q.setSubscribers(47000); q.startDay6(); for(let i=0;i<12;i++) q.tapZone('head'); });
  const reduced = await page.evaluate(()=>window.__heroineRig.getDebugSnapshot());
  assert.equal(reduced.day6GestureActive,false); assert.equal(reduced.bodyScale,1);
  assert.deepEqual(errors,[]);
  console.log('Day 6 gesture, rapid taps, rewards, queued stage, cooldown and reduced motion: OK');
} finally {await browser.close();}

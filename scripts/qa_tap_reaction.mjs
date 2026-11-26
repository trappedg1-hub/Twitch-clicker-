import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';
import assert from 'node:assert/strict';
const browser = await playwright.launch({executablePath:await chromium.executablePath(),args:[...chromium.args,'--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'],headless:true});
try {
 const page=await browser.newPage({viewport:{width:1366,height:820}});let errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.QA_BASE??'http://localhost:5182'}/?qa`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__qaScene?.isDay6Unlocked(),{timeout:40000});
 for(const [zone,label] of [['chest','chest'],['legs','legs']]) {
  await page.evaluate(z=>window.__qaScene.tapZone(z),zone);
  await page.waitForFunction(()=>Math.abs(window.__heroineRig.getDebugSnapshot().tapWave)>0.5,null,{timeout:5000});
  const r=await page.evaluate(()=>window.__heroineRig.getDebugSnapshot());
  assert.equal(r.tapZone,zone); assert.ok(r.tapMovement>0.1);
  assert.equal(r.tapRegion,zone === 'legs' ? 'leg' : 'covered');
  // The old chairMovement heuristic counts any motion on the left as chair,
  // even when it is the leg. Check the plate transform here; visual chair-edge
  // inspection is still needed because the image contains chair and body together.
  if (zone === 'chest') assert.equal(r.chairMovement,0);
  assert.equal(r.bodyY,0);assert.equal(r.bodyX,0);
  await page.screenshot({path:`.qa-out/day1_tap_${label}.png`});
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>window.__qaScene.tapZone('chest'));
 await page.waitForFunction(()=>window.__heroineRig.getDebugSnapshot().torsoMovement===0,null,{timeout:10000});
 assert.equal(await page.evaluate(()=>window.__heroineRig.getDebugSnapshot().tapWave),0);
 assert.deepEqual(errors,[]); console.log('Day 1 taps and reduced motion OK');
} finally {await browser.close();}

import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:[...chromium.args,'--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'],headless:true});
try {
 const page=await browser.newPage({viewport:{width:1366,height:820}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.QA_BASE??'http://localhost:5182'}/?qa`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__qaScene?.isDay6Unlocked(),{timeout:40000});
 const ladders=[[0,10,50,200,500],[500,1500,2000,2500,5000],[5000,7000,10000,13000,15000],[15000,16500,18000,22000,26000],[26000,29500,33000,40000,47000],[47000,50500,54000,61000,68000]];
 for(let day=1;day<=6;day++) {
  if(day>1) assert.equal(await page.evaluate(d=>window.__qaScene[`startDay${d}`](),day),true);
  for(let stage=0;stage<5;stage++) {
   await page.evaluate(n=>window.__qaScene.setSubscribers(n),ladders[day-1][stage]);
   await page.waitForFunction(([d,s])=>window.__qaScene.getState().streamDay===d&&window.__qaScene.getState().displayedSubStage===s,[day,stage],{timeout:15000});
   // Story transitions may briefly swap the entire plate; do not judge anatomy on a flash.
   await page.waitForFunction(()=>!window.__heroineRig.isGhostFlashing(),null,{timeout:20000});
   for(const zone of ['chest','legs']) {
    await page.evaluate(z=>window.__heroineRig.triggerTapReaction(z),zone);
    await page.waitForFunction(()=>window.__heroineRig.getDebugSnapshot().tapMovement>0.15,null,{timeout:15000});
    const r=await page.evaluate(()=>window.__heroineRig.getDebugSnapshot());
    assert.equal(r.tapZone,zone);assert.equal(r.bodyX,0);assert.equal(r.bodyY,0);assert.equal(r.bodyScaleX,1);assert.equal(r.bodyScaleY,1);
    assert.equal(r.tapRegion,zone==='legs'?'leg':day===5&&stage>=3?'hip':day===1&&stage<3?'covered':day===2&&stage<2?'covered':day===3&&stage===0?'covered':day===6&&stage===2?'covered':'chest');
    console.log(`day ${day}/${stage} ${zone} ${r.tapRegion}: ${r.tapMovement.toFixed(2)} px`);
   }
  }
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>window.__heroineRig.getDebugSnapshot().tapMovement===0,null,{timeout:10000});
 assert.deepEqual(errors,[]);console.log('30 poses, two target regions and reduced motion OK');
} finally {await browser.close()}

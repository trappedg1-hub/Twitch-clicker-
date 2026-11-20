import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';
import assert from 'node:assert/strict';
const browser = await playwright.launch({executablePath: await chromium.executablePath(), args: [...chromium.args,'--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'],headless:true});
try {
 const page=await browser.newPage({viewport:{width:1366,height:820}});const errors=[];page.on('pageerror', e=>errors.push(e.message));
 await page.goto(`${process.env.QA_BASE??'http://localhost:5182'}/?qa`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__qaScene?.isDay6Unlocked(),{timeout:40000});
 const result=await page.evaluate(()=>{let q=window.__qaScene;q.setSubscribers(5000);q.startDay2();q.setSubscribers(15000);q.startDay3();q.setSubscribers(15000);q.startDay4();q.setSubscribers(26000);q.startDay5();return {day:q.getState().streamDay,plate:q.getActivePlateName()};});
 assert.deepEqual(result,{day:5,plate:'heroine_t5_start_hq2.webp'});
 await page.waitForFunction(()=>window.__heroineRig.getDebugSnapshot().torsoMovement>0.1,null,{timeout:12000});
 let rig=await page.evaluate(()=>window.__heroineRig.getDebugSnapshot());assert.equal(rig.chairMovement,0);assert.equal(rig.bodyY,0);
 await page.screenshot({path:'.qa-out/bikini_hq_live.png'}); assert.deepEqual(errors,[]);console.log('Bikini opener and stationary chair OK');
}finally{await browser.close()}

import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:[...chromium.args,'--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'],headless:true});
try {
 const page=await browser.newPage({viewport:{width:1366,height:820}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.QA_BASE??'http://localhost:5182'}/?qa`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__qaScene?.isDay6Unlocked(),{timeout:40000});
 const ladders=[
  [[0,10,50,200,500],['s0','s1','s2','base','s4']],
  [[500,1500,2000,2500,5000],['s0','s1','s2','s3','s4']],
  [[5000,7000,10000,13000,15000],['s0','s1','s2','s3','s4']],
  [[15000,16500,18000,22000,26000],['start','s0','s1','s2','s3']],
  [[26000,29500,33000,40000,47000],['start','s0','s1','s2','s3']],
  [[47000,50500,54000,61000,68000],['start','s0','s1','s2','s3']],
 ];
 for(let day=1;day<=6;day++){
   if(day>1){let ok=await page.evaluate(d=>window.__qaScene[`startDay${d}`](),day);assert.equal(ok,true,`day ${day} gate`);}
   for(let i=0;i<5;i++){
    await page.evaluate(n=>window.__qaScene.setSubscribers(n),ladders[day-1][0][i]);
    await page.waitForFunction(([d,i])=>window.__qaScene.getState().streamDay===d&&window.__qaScene.getState().displayedSubStage===i,[day,i],{timeout:15000});
    await page.waitForFunction(()=>window.__heroineRig.getDebugSnapshot().torsoMovement>0.08,null,{timeout:15000});
    const r=await page.evaluate(()=>({plate:window.__qaScene.getActivePlateName(),...window.__heroineRig.getDebugSnapshot()}));
    assert.equal(r.plate,`heroine_t${day}_${ladders[day-1][1][i]}.webp`);
    assert.equal(r.chairMovement,0,`${day}/${i} chair`);assert.equal(r.bodyX,0);assert.equal(r.bodyY,0);assert.equal(r.bodyScaleX,1);assert.equal(r.bodyScaleY,1);
    console.log(`day ${day} stage ${i} ${r.plate} movement ${r.torsoMovement.toFixed(2)}`);
    if(day>=4&&i===0 || day===5&&i===4)await page.screenshot({path:`.qa-out/new_day${day}_stage${i}.png`});
   }
 }
 await page.emulateMedia({reducedMotion:'reduce'}); await page.waitForFunction(()=>window.__heroineRig.getDebugSnapshot().torsoMovement===0,null,{timeout:15000});
 assert.deepEqual(errors,[]);console.log('30 stages, still chair and reduced motion OK');
}finally{await browser.close()}

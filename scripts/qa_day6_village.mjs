import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';
import assert from 'node:assert/strict';
const browser = await playwright.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'], headless:true });
try {
  const page=await browser.newPage({viewport:{width:1366,height:820}});
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto(`${process.env.QA_BASE ?? 'http://localhost:5176'}/?qa`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__qaScene?.getState && window.__pixiApp,{timeout:40000});
  await page.waitForFunction(()=>window.__qaScene.isDay6Unlocked(),{timeout:40000});
  const chain=await page.evaluate(()=>{
    const q=window.__qaScene;
    q.setSubscribers(5000); const d2=q.startDay2();
    q.setSubscribers(15000); const d3=q.startDay3();
    q.setSubscribers(15000); const d4=q.startDay4();
    q.setSubscribers(26000); const d5=q.startDay5();
    q.setSubscribers(47000);
    return {d2,d3,d4,d5,day:q.getState().streamDay};
  });
  assert.deepEqual(chain,{d2:true,d3:true,d4:true,d5:true,day:5});
  await page.evaluate(()=>document.getElementById('btn-finale-open').click());
  await page.waitForTimeout(500);
  await page.evaluate(()=>document.getElementById('btn-skip-farewell').click());
  await page.waitForTimeout(800);
  const cta=await page.evaluate(()=>({disabled:document.getElementById('btn-start-day2').disabled,text:document.getElementById('btn-start-day2').textContent}));
  assert.equal(cta.disabled,false); assert.match(cta.text,/День 6/);
  await page.evaluate(()=>document.getElementById('btn-start-day2').click());
  await page.waitForTimeout(400);
  for (const [subs,index] of [[47000,0],[54000,1],[61000,2],[68000,3]]) {
    await page.evaluate(n=>window.__qaScene.setSubscribers(n),subs);
    await page.waitForTimeout(300);
    const state=await page.evaluate(()=>({state:window.__qaScene.getState(),plate:window.__qaScene.getActivePlateName(),ghost:window.__qaScene.ghostBoo(500),has:window.__heroineRig.hasDay6Plates()}));
    assert.equal(state.state.streamDay,6); assert.equal(state.state.displayedSubStage,index);
    assert.equal(state.plate,`heroine_t6_s${index}.webp`); assert.equal(state.ghost,false); assert.equal(state.has,true);
    await page.screenshot({path:`.qa-out/day6_live_s${index}.png`});
    console.log(`stage ${index}: ${state.plate}, subscribers ${subs}`);
  }
  await page.evaluate(()=>document.getElementById('btn-finale-open').click());
  await page.waitForTimeout(500); await page.evaluate(()=>document.getElementById('btn-skip-farewell').click());
  const final=await page.evaluate(()=>({text:document.getElementById('finale-kicker').textContent,disabled:document.getElementById('btn-start-day2').disabled}));
  assert.match(final.text,/ДЕРЕВЕНСКОГО/); assert.equal(final.disabled,true);
  await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(500);
  await page.screenshot({path:'.qa-out/day6_mobile.png'});
  assert.deepEqual(errors,[]); console.log('Day 6 browser QA passed');
} finally { await browser.close(); }

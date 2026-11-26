import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readWebpDims } from './helpers/plateGeometry.ts';
import { DAY6_SUB_GOAL_STAGES, DAY6_FINALE_SUBS, DAY6_FLASH_PLATE, getSubGoalStageForSubs, getGiftSubUnitCost, probeDay6Art } from '../src/domain/subGoals.ts';
import { createInitialState, startDay6, serializeState, deserializeState } from '../src/domain/engine.ts';
import { DAY6_IDLE_BY_STAGE, DAY6_OPENING_LINE, pickIdleTeaseLine, getStreamTitle } from '../src/domain/dialogue.ts';
import { createAmbientChatMessage } from '../src/chat/chatEngine.ts';
import { getWardrobe, contradictsWardrobe } from '../src/domain/wardrobe.ts';
import { FACE_ANCHORS, FACE_PATCH_COVERED_PLATES } from '../src/heroine/faceAnchors.ts';
import type { SubGoalStageIndex } from '../src/domain/types.ts';

test('day six ladder and shipped plates', () => {
  assert.deepEqual(DAY6_SUB_GOAL_STAGES.map(x => x.subsRequired), [0,50500,54000,61000,68000]);
  assert.equal(DAY6_FINALE_SUBS,68000); assert.equal(DAY6_FLASH_PLATE,null);
  for (const [i, def] of DAY6_SUB_GOAL_STAGES.entries()) {
    const name = i === 0 ? 'heroine_t6_start_hq.webp' : `heroine_t6_s${i-1}.webp`;
    assert.equal(def.plateUrl, `/art/${name}`);
    const dims=readWebpDims(readFileSync(new URL(`../public/art/${name}`,import.meta.url)));
    assert.equal(dims?.width,1024); assert.equal(dims?.height,1526); assert.equal(dims?.alpha,true);
    assert.ok(FACE_ANCHORS[name]); assert.ok(FACE_PATCH_COVERED_PLATES.has(name));
  }
  assert.deepEqual([50499,50500,53999,54000,60999,61000,67999,68000].map(n=>getSubGoalStageForSubs(n,6)),[0,1,1,2,2,3,3,4]);
  assert.deepEqual([53999,54000,61000,68000].map(getGiftSubUnitCost),[1600,1820,2060,2320]);
});

test('day 6 unlock probe, transition and saved game', async () => {
  const oldWindow = globalThis.window; const oldFetch = globalThis.fetch;
  try {
    globalThis.window = {} as Window & typeof globalThis;
    globalThis.fetch = (async () => new Response('', { status: 200, headers: {'content-type':'image/webp'} })) as typeof fetch;
    assert.equal(await probeDay6Art(),true);
    const prev = {...createInitialState(), streamDay:5, subscribers:47000, balance:1234, unlockedSubStage:3 as const, displayedSubStage:3 as const};
    const result=startDay6(prev); assert.equal(result.ok,true); assert.equal(result.state.streamDay,6);
    assert.equal(result.state.balance,1234); assert.equal(result.state.displayedSubStage,0);
    const saved=deserializeState(serializeState({...result.state, subscribers:61000, unlockedSubStage:3, displayedSubStage:3}));
    assert.equal(saved.streamDay,6); assert.equal(saved.displayedSubStage,3);
    (globalThis.window as unknown as {__day6Unlocked:boolean}).__day6Unlocked=false;
    assert.equal(startDay6(prev).ok,false);
    (globalThis.window as unknown as {__day6Unlocked:boolean}).__day6Unlocked=true;
    assert.equal(startDay6({...prev,subscribers:46999}).ok,false);
  } finally { globalThis.window = oldWindow; globalThis.fetch = oldFetch; }
});

test('day six voice and chat follow the approved prop ladder', () => {
  assert.match(DAY6_OPENING_LINE,/маленькой/);
  assert.match(DAY6_SUB_GOAL_STAGES[2]!.unlockLine,/что мне с ним делать/i);
  assert.match(DAY6_SUB_GOAL_STAGES[3]!.unlockLine,/чмок/i);
  assert.match(DAY6_SUB_GOAL_STAGES[4]!.unlockLine,/кто бы их облизал/i);
  for (const stage of [0,1,2,3,4] as SubGoalStageIndex[]) {
    const w=getWardrobe(6,stage);
    for (const line of [ ...DAY6_IDLE_BY_STAGE[stage], DAY6_SUB_GOAL_STAGES[stage]!.unlockLine, ...DAY6_SUB_GOAL_STAGES[stage]!.shyApproachLines, ...DAY6_SUB_GOAL_STAGES[stage]!.chatCascade.map(x=>x.text)]) {
      assert.equal(contradictsWardrobe(line,w),null,`stage ${stage}: ${line}`);
    }
    assert.ok(pickIdleTeaseLine(stage,0,6)); assert.match(getStreamTitle(stage,54000,6),/SUB GOAL/);
    assert.ok(createAmbientChatMessage(100,stage,1,6).text);
  }
  assert.equal(contradictsWardrobe('Огурец пахнет огородом',getWardrobe(6,0)),null);
  assert.ok(contradictsWardrobe('Огурец во рту',getWardrobe(6,1)));
  assert.equal(contradictsWardrobe('Огурец во рту',getWardrobe(6,3)),null);
  assert.ok(contradictsWardrobe('Огурец во рту',getWardrobe(6,4)));
  assert.ok(contradictsWardrobe('Масло на ногах',getWardrobe(6,0)));
});

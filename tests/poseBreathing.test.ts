import test from 'node:test';
import assert from 'node:assert/strict';
import { BREATH_REGIONS, poseBreathOffset, tapReactionWave } from '../src/heroine/poseBreathing.ts';
import { createInitialState, deserializeState, serializeState } from '../src/domain/engine.ts';
import type { SubGoalStageIndex } from '../src/domain/types.ts';

test('all thirty frames have contained breathing and a stationary chair', () => {
  assert.equal(BREATH_REGIONS.length, 6);
  for (let day=1; day<=6; day++) for (let stage=0; stage<5; stage++) {
    const s=stage as SubGoalStageIndex;
    const [cx,cy,rx,ry]=BREATH_REGIONS[day-1]![s]!;
    assert.notDeepEqual(poseBreathOffset(day,s,cx,cy,1),{x:0,y:0});
    assert.deepEqual(poseBreathOffset(day,s,cx,cy,0),{x:0,y:0});
    for(const [x,y] of [[cx-rx-50,cy],[cx+rx+50,cy],[cx,cy-ry-50],[cx,cy+ry+50],[100,1400],[950,1400]]) {
      assert.deepEqual(poseBreathOffset(day,s,x!,y!,1),{x:0,y:0});
    }
  }
});

test('tap response is bounded, brief and stays within the breathing region', () => {
  assert.equal(tapReactionWave(-1), 0);
  assert.equal(tapReactionWave(650), 0);
  assert.ok(tapReactionWave(100) > 0.5);
  for (let ms = 0; ms <= 700; ms++) assert.ok(Math.abs(tapReactionWave(ms)) <= 1.8);
  for (let day = 1; day <= 6; day++) for (let stage = 0; stage < 5; stage++) {
    assert.deepEqual(poseBreathOffset(day, stage as SubGoalStageIndex, 100, 1400, tapReactionWave(100)), {x: 0, y: 0});
  }
});

test('saved older late-day stage indices migrate without losing selected art', () => {
  const state={...createInitialState(),streamDay:6 as const,subscribers:61000,unlockedSubStage:2 as const,displayedSubStage:2 as const};
  assert.equal(deserializeState(JSON.stringify(state)).displayedSubStage,3);
  const next={...state,unlockedSubStage:3 as const,displayedSubStage:3 as const};
  assert.equal(deserializeState(serializeState(next)).displayedSubStage,3);
  assert.equal(deserializeState(JSON.stringify({...state,subscribers:47000,unlockedSubStage:0,displayedSubStage:0})).displayedSubStage,0);
});

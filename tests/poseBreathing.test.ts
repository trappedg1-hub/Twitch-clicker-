import test from 'node:test';
import assert from 'node:assert/strict';
import { BREATH_REGIONS, poseBackSwayOffset, poseBreathOffset, poseTapOffset, tapReactionWave } from '../src/heroine/poseBreathing.ts';
import { POSE_ANATOMY } from '../src/heroine/poseAnatomy.ts';
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
  assert.equal(tapReactionWave(800), 0);
  assert.ok(tapReactionWave(100) > 1);
  assert.ok(tapReactionWave(100, 6) > tapReactionWave(100, 1));
  for (let day = 1; day <= 6; day++) for (let ms = 0; ms <= 850; ms++) assert.ok(Math.abs(tapReactionWave(ms, day)) <= 6.4);
  for (let day = 1; day <= 6; day++) for (let stage = 0; stage < 5; stage++) {
    assert.deepEqual(poseBreathOffset(day, stage as SubGoalStageIndex, 100, 1400, tapReactionWave(100)), {x: 0, y: 0});
  }
});

test('tap regions follow first-day legs and the two rear-view bikini poses', () => {
  assert.notDeepEqual(poseTapOffset(1, 0, 'legs', 245, 835, 1), {x: 0, y: 0});
  assert.deepEqual(poseTapOffset(1, 0, 'chest', 245, 835, 1), {x: 0, y: 0});
  assert.notDeepEqual(poseTapOffset(5, 3, 'chest', 455, 840, 1), {x: 0, y: 0});
  assert.notDeepEqual(poseTapOffset(5, 4, 'chest', 420, 590, 1), {x: 0, y: 0});
  assert.equal(POSE_ANATOMY.length, 6);
  for (let day=1; day<=6; day++) for (let stage=0; stage<5; stage++) {
    const s = stage as SubGoalStageIndex;
    const anatomy = POSE_ANATOMY[day-1]![stage]!;
    for (const [region, zone] of [[anatomy.torso, 'chest'], [anatomy.leg, 'legs']] as const) {
      const [cx, cy, rx] = region;
      assert.notDeepEqual(poseTapOffset(day, s, zone, cx, cy, 1), {x: 0, y: 0});
      assert.deepEqual(poseTapOffset(day, s, zone, cx + rx + 50, cy, 1), {x: 0, y: 0});
      // Each region actually intersects the 24 x 32 runtime mesh.
      let max = 0;
      for (let ix=0; ix<24; ix++) for (let iy=0; iy<32; iy++) {
        const offset = poseTapOffset(day, s, zone, ix*1024/23, iy*1526/31, 1);
        max = Math.max(max, Math.hypot(offset.x,offset.y));
      }
      assert.ok(max > 0.1, `${day}/${stage} ${zone} misses the mesh`);
    }
    for (const zone of ['head','chest','belly','legs','feet'] as const) {
      for (const [x,y] of [[100,1400], [950,1400], [0,0]]) {
        assert.deepEqual(poseTapOffset(day, stage as SubGoalStageIndex, zone, x!, y!, 5), {x: 0,y: 0});
      }
    }
  }
});

test('stronger chest tap is limited to front-facing chest, not idle, legs or covered poses', () => {
  const [x,y] = POSE_ANATOMY[4]![0]!.torso;
  const chest = poseTapOffset(5, 0, 'chest', x, y, 1);
  const belly = poseTapOffset(5, 0, 'belly', x, y, 1);
  assert.ok(Math.abs(chest.y / belly.y - 1.2) < 1e-12);
  const [cx,cy] = POSE_ANATOMY[0]![0]!.torso;
  assert.deepEqual(poseTapOffset(1, 0, 'chest', cx, cy, 1), poseTapOffset(1, 0, 'belly', cx, cy, 1));
  const [hx,hy] = POSE_ANATOMY[4]![3]!.torso;
  assert.deepEqual(poseTapOffset(5, 3, 'chest', hx, hy, 1), poseTapOffset(5, 3, 'belly', hx, hy, 1));
});

test('the rear-view finale shifts her weight, and only inside her own body', () => {
  // Exactly one pose answers: the day-5 finale, the one plate that cannot carry the rig.
  const [upper, hips] = [[655, 395], [520, 620]] as const;
  for (let day = 1; day <= 6; day++) for (let stage = 0; stage < 5; stage++) {
    const s = stage as SubGoalStageIndex;
    const hit = day === 5 && stage === 4;
    for (const [x, y] of [upper, hips]) {
      const offset = poseBackSwayOffset(day, s, x, y, 1);
      if (hit) assert.notDeepEqual(offset, {x: 0, y: 0}, `${day}/${stage}`);
      else assert.deepEqual(offset, {x: 0, y: 0}, `${day}/${stage}`);
    }
  }
  assert.deepEqual(poseBackSwayOffset(5, 4, upper[0], upper[1], 0), {x: 0, y: 0});
  // Bounded: a sway, not a shove.
  let max = 0;
  for (let ix = 0; ix < 24; ix++) for (let iy = 0; iy < 32; iy++) {
    const o = poseBackSwayOffset(5, 4, ix * 1024 / 23, iy * 1526 / 31, 1);
    max = Math.max(max, Math.hypot(o.x, o.y));
  }
  assert.ok(max > 4, 'the sway has to read, not whisper');
  assert.ok(max <= 12, `sway of ${max.toFixed(2)} px is a jump, not a shift`);
  // The runtime's "the chair never moves" heuristic watches everything outside this band. The
  // sway must not reach a single sample there, or the promise becomes a number nobody checks.
  for (let ix = 0; ix < 24; ix++) for (let iy = 0; iy < 32; iy++) {
    const x = ix * 1024 / 23;
    const y = iy * 1526 / 31;
    if (x < 300 || x > 760 || y > 900) {
      assert.deepEqual(poseBackSwayOffset(5, 4, x, y, 1), {x: 0, y: 0}, `chair sample ${x},${y}`);
    }
  }
});

test('saved older late-day stage indices migrate without losing selected art', () => {
  const state={...createInitialState(),streamDay:6 as const,subscribers:61000,unlockedSubStage:2 as const,displayedSubStage:2 as const};
  assert.equal(deserializeState(JSON.stringify(state)).displayedSubStage,3);
  const next={...state,unlockedSubStage:3 as const,displayedSubStage:3 as const};
  assert.equal(deserializeState(serializeState(next)).displayedSubStage,3);
  assert.equal(deserializeState(JSON.stringify({...state,subscribers:47000,unlockedSubStage:0,displayedSubStage:0})).displayedSubStage,0);
});

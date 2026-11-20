import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DAY6_BREATH_REGIONS, day6BreathOffset } from '../src/heroine/day6Breathing.ts';
import { FACE_ANCHORS } from '../src/heroine/faceAnchors.ts';
import type { SubGoalStageIndex } from '../src/domain/types.ts';

test('day six breath is automatic and constrained to the torso, never the chair', () => {
  for (const stage of [0,1,2,3] as SubGoalStageIndex[]) {
    const r=DAY6_BREATH_REGIONS[stage]!;
    assert.notDeepEqual(day6BreathOffset(stage,r.cx,r.cy,1),{x:0,y:0});
    assert.deepEqual(day6BreathOffset(stage,r.cx,r.cy,0),{x:0,y:0});
    // These zones encompass the chair frame/armrests and the lower seat and base.
    for (const [x,y] of [[100,650],[250,900],[750,850],[900,1000],[500,1100],[500,1400]]) {
      assert.deepEqual(day6BreathOffset(stage,x!,y!,1),{x:0,y:0},`stage ${stage}: ${x},${y}`);
    }
  }
});

test('the cucumber-in-hands plate comes from the approved cheek pose', () => {
  const cutter=readFileSync(new URL('../scripts/process_day6_frames.py',import.meta.url),'utf8');
  assert.match(cutter,/"heroine_t6_s1": "t6_t141_village_cucumber_toolong_I\.png"/);
  assert.deepEqual(FACE_ANCHORS['heroine_t6_s1.webp'],{x:263,y:88,w:477,h:300});
});

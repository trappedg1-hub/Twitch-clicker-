import assert from 'node:assert/strict';
import test from 'node:test';

import {
  debugGotoDayStage,
  debugMaxOutShop,
  debugSetBars,
  finaleSubsForDay,
  subsToReach,
} from '../src/domain/debug.ts';
import {
  buyUpgrade,
  computeStats,
  createInitialState,
  deserializeState,
  serializeState,
} from '../src/domain/engine.ts';
import { getSubGoalStagesForDay } from '../src/domain/subGoals.ts';
import { TIER1_UPGRADES } from '../src/domain/upgrades.ts';
import type { GameState, SubGoalStageIndex } from '../src/domain/types.ts';

/**
 * The admin panel is only trustworthy while its jumps stay legal, so these tests pin the contract
 * the panel depends on: land on any day/stage through the engine's own gates, never fabricate a
 * state a real run could not reach, and never lose a day to a reload.
 */

const withDay3Art = (on: boolean, run: () => void) => {
  const g = globalThis as unknown as { window?: { __day3Unlocked?: boolean } };
  const prev = g.window;
  g.window = { ...(prev ?? {}), __day3Unlocked: on };
  try {
    run();
  } finally {
    g.window = prev;
  }
};

test('the jump ladder matches the day ladders the UI shows', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((s) => subsToReach(1, s as SubGoalStageIndex)),
    getSubGoalStagesForDay(1).map((d) => d.subsRequired),
  );
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((s) => subsToReach(3, s as SubGoalStageIndex)),
    getSubGoalStagesForDay(3).map((d) => d.subsRequired),
  );
  assert.equal(finaleSubsForDay(1), 500);
  assert.equal(finaleSubsForDay(2), 5000);
  assert.equal(finaleSubsForDay(3), 15000);
  for (const day of [1, 2, 3]) {
    for (let s = 1; s <= 4; s++) {
      assert.ok(
        subsToReach(day, s as SubGoalStageIndex) > subsToReach(day, (s - 1) as SubGoalStageIndex),
        `day ${day}: stage ${s} must cost more than ${s - 1}`,
      );
    }
  }
});

test('a jump pays the ladder instead of faking it: stages and plates agree', () => {
  const start = { ...createInitialState(1000), balance: 250 };
  const jumped = debugGotoDayStage(start, 1, 3);
  assert.equal(jumped.note, null);
  assert.equal(jumped.state.subscribers, 200);
  assert.ok(jumped.state.unlockedSubStage >= 3, 'the stage must be unlocked, not just displayed');
  assert.equal(jumped.state.displayedSubStage, 3);
  // Money and upgrades are untouched — the panel does not hand out a discount.
  assert.equal(jumped.state.balance, 250);
  assert.deepEqual(jumped.state.upgrades, start.upgrades);
});

test('forward jumps carry the day chain: mic tier, money and boldness move with her', () => {
  let s: GameState = { ...createInitialState(1000), balance: 900_000 };
  s = buyUpgrade(s, 'desk_mic').state;
  const micLevel = s.upgrades.desk_mic;
  const res = debugGotoDayStage(s, 2, 2);
  assert.equal(res.note, null);
  assert.equal(res.state.streamDay, 2);
  assert.equal(res.state.subscribers, subsToReach(2, 2));
  assert.equal(res.state.upgrades.desk_mic, micLevel, 'the carry-over must keep the mic');
  assert.ok(res.state.balance > 0, 'day 2 opens with the money from day 1');
  assert.equal(res.state.carriedOverWardrobeStage, 4, 'day 1 ended fully undressed, that carries');
});

test('the Day 3 jump is blocked while the cosplay art is missing, and works once it ships', () => {
  const s = { ...createInitialState(1000), streamDay: 2, subscribers: 5000 };
  withDay3Art(false, () => {
    const blocked = debugGotoDayStage(s, 3, 4);
    assert.equal(blocked.state.streamDay, 2, 'no art, no day 3');
    assert.match(blocked.note ?? '', /День 3 закрыт/);
  });
  withDay3Art(true, () => {
    const ok = debugGotoDayStage(s, 3, 4);
    assert.equal(ok.note, null);
    assert.equal(ok.state.streamDay, 3);
    assert.equal(ok.state.subscribers, 15000);
    assert.equal(ok.state.displayedSubStage, 4);
    assert.equal(ok.state.unlockedSubStage, 4);
  });
});

test('backward jumps re-enter the earlier ladder but keep the shop and the wallet', () => {
  withDay3Art(true, () => {
    const deep = debugGotoDayStage({ ...createInitialState(1000), balance: 40_000 }, 3, 4).state;
    const back = debugGotoDayStage(deep, 1, 1);
    assert.equal(back.state.streamDay, 1);
    assert.equal(back.state.displayedSubStage, 1);
    assert.equal(back.state.balance, deep.balance, 'rewinding a day is not a refund');
    assert.deepEqual(back.state.upgrades, deep.upgrades);
    // Day 1 pays out at 10 subs, so a 15000-sub account simply sits on the last plate it owns.
    assert.ok(back.state.unlockedSubStage >= 1);
  });
});

test('maxing the shop buys every level through the real purchase path', () => {
  const before = debugMaxOutShop({ ...createInitialState(1000), balance: 0 });
  for (const def of TIER1_UPGRADES) {
    assert.equal(before.state.upgrades[def.id], def.maxLevel, `${def.id} must be sold out`);
  }
  assert.ok(before.state.balance >= 0, 'the panel funds the purchase, it never overdraws');
  assert.ok(before.state.totalEarned >= before.spent);
  assert.ok(before.levels >= TIER1_UPGRADES.length);
  assert.ok(computeStats(before.state).onlineViewers > computeStats(createInitialState()).onlineViewers);
  // A second click on a sold-out shop does nothing at all.
  const after = debugMaxOutShop(before.state);
  assert.equal(after.levels, 0);
  assert.equal(after.spent, 0);
  assert.equal(after.state.balance, before.state.balance);
});

test('the bars clamp the way every other surface clamps them', () => {
  const s = debugSetBars(createInitialState(1000), 400, -12);
  assert.equal(s.hype, 100);
  assert.equal(s.boldness, 0);
  const nan = debugSetBars(createInitialState(1000), Number.NaN, 33);
  assert.equal(nan.hype, 0);
  assert.equal(nan.boldness, 33);
});

test('a Day 3 save survives a reload (this used to drop the player back to Day 1)', () => {
  withDay3Art(true, () => {
    const day3 = debugGotoDayStage(createInitialState(1000), 3, 2).state;
    const loaded = deserializeState(serializeState(day3), 2000);
    assert.equal(loaded.streamDay, 3);
    assert.equal(loaded.displayedSubStage, 2);
    assert.equal(loaded.subscribers, day3.subscribers);
    assert.deepEqual(loaded.upgrades, day3.upgrades);
  });
});

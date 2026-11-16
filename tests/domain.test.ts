import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pickDialogueLine,
  pickEmotionForContext,
  pickFeverOverheatLine,
  pickIdleTeaseLine,
  pickReactionCalloutTag,
  UPGRADE_REACTION_LINES,
  ZONE_DIALOGUES,
} from '../src/domain/dialogue.ts';
import {
  applyTap,
  buyGiftSubs,
  buyUpgrade,
  computeStats,
  createInitialState,
  deserializeState,
  selectDisplayedSubStage,
  serializeState,
  tickEconomy,
  triggerStreamChallenge,
} from '../src/domain/engine.ts';
import {
  getStoryChapter,
  STORY_CHAPTERS,
  STREAM_CHALLENGES,
} from '../src/domain/progression.ts';
import {
  pickShySubGoalApproachLine,
  SUB_GOAL_STAGES,
} from '../src/domain/subGoals.ts';
import type { TapZoneId } from '../src/domain/types.ts';
import { getUpgradeCost, TIER1_MILESTONES, TIER1_UPGRADES } from '../src/domain/upgrades.ts';

test('initial state starts bundled up at Stage 0 (0 subs, hoodie + leggings + socks)', () => {
  const s = createInitialState(1000);
  const stats = computeStats(s);
  assert.equal(s.balance, 0);
  assert.equal(s.boldness, 0);
  assert.equal(s.subscribers, 0);
  assert.equal(s.unlockedSubStage, 0);
  assert.equal(s.displayedSubStage, 0);
  assert.equal(stats.currentSubStageDef.plateUrl, '/art/heroine_t1_s0.webp');
  assert.equal(stats.nextSubGoalDef?.subsRequired, 10);
  assert.equal(stats.onlineViewers, 3);
  assert.equal(stats.storyChapter.stage, 1);
  assert.equal(stats.nextMilestone?.id, TIER1_MILESTONES[0]?.id);
});

test('Sub Goal strip-down & cosplay progression unlocks 10 -> 50 -> 200 -> 500 -> 1000 subs cleanly', () => {
  let s = { ...createInitialState(1000), balance: 250_000 };

  // Gift 5 + 5 = 10 subs -> Stage 1 (remove socks)
  s = buyGiftSubs(s, 5).state;
  assert.equal(s.unlockedSubStage, 0);
  const hit10 = buyGiftSubs(s, 5);
  assert.equal(hit10.ok, true);
  assert.equal(hit10.state.subscribers, 10);
  assert.equal(hit10.state.unlockedSubStage, 1);
  assert.equal(hit10.state.displayedSubStage, 1);
  assert.equal(hit10.newlyUnlockedSubStages[0]?.subsRequired, 10);
  s = hit10.state;

  // Gift up to 50 subs -> Stage 2 (remove leggings)
  s = buyGiftSubs(s, 25).state;
  const hit50 = buyGiftSubs(s, 25);
  assert.equal(hit50.state.subscribers, 60);
  assert.equal(hit50.state.unlockedSubStage, 2);
  assert.equal(hit50.state.displayedSubStage, 2);
  s = hit50.state;

  // Gift up to 200+ subs -> Stage 3 (remove hoodie -> crop tee)
  for (let i = 0; i < 6; i++) {
    s = buyGiftSubs(s, 25).state;
  }
  assert.ok(s.subscribers >= 200);
  assert.equal(s.unlockedSubStage, 3);
  assert.equal(s.displayedSubStage, 3);

  // Gift up to 500+ subs -> Stage 4 (remove crop tee -> bralette)
  while (s.subscribers < 500) {
    const r = buyGiftSubs(s, 25);
    assert.equal(r.ok, true);
    s = r.state;
  }
  assert.equal(s.unlockedSubStage, 4);
  assert.equal(s.displayedSubStage, 4);
  assert.equal(computeStats(s).nextSubGoalDef?.subsRequired, 1000);

  // Gift up to 1000+ subs -> Stage 5 (Mega Cosplay: Feet on Desk!)
  while (s.subscribers < 1000) {
    const r = buyGiftSubs(s, 25);
    assert.equal(r.ok, true);
    s = r.state;
  }
  assert.equal(s.unlockedSubStage, 5);
  assert.equal(s.displayedSubStage, 5);

  const maxStats = computeStats(s);
  assert.equal(maxStats.nextSubGoalDef, null);
  assert.equal(maxStats.currentSubStageDef.plateUrl, '/art/heroine_t1_s5.webp');

  // Player can re-equip an earlier unlocked stage without losing Stage 4 income bonus
  const baseIncome = maxStats.clickIncome;
  const switched = selectDisplayedSubStage(s, 0);
  assert.equal(switched.ok, true);
  assert.equal(switched.state.displayedSubStage, 0);
  assert.equal(computeStats(switched.state).clickIncome, baseIncome);
});

test('tapping all 5 zones earns donations, organic subs, and triggers alert on 12th tap', () => {
  let s = createInitialState(1000);
  const zones: TapZoneId[] = ['head', 'chest', 'belly', 'legs', 'feet'];

  for (let i = 1; i <= 12; i++) {
    const z = zones[(i - 1) % zones.length]!;
    const out = applyTap(s, z, 1000 + i * 100);
    assert.ok(out.earned >= 5);
    assert.ok(out.line.length > 5);
    assert.equal(out.triggeredDonationAlert, i === 12);
    s = out.state;
  }

  assert.equal(s.totalTaps, 12);
  assert.equal(s.subscribers, 1); // 10th tap with hype >= 24 grants an organic sub!
  assert.ok(s.boldness >= 4);
  assert.ok(s.hype > 50);
  assert.ok(s.balance > 80);
});

test('buying upgrades raises online viewers, passive income, and boldness story stage', () => {
  let s = { ...createInitialState(1000), balance: 25_000 };

  for (const def of TIER1_UPGRADES) {
    const cost0 = getUpgradeCost(def, 0);
    const res = buyUpgrade(s, def.id);
    assert.equal(res.ok, true);
    assert.equal(res.cost, cost0);
    assert.ok(UPGRADE_REACTION_LINES[def.id].length > 10);
    s = res.state;
  }

  const stats = computeStats(s);
  assert.ok(stats.onlineViewers >= 60);
  assert.ok(stats.boldness >= 35);
  assert.ok(stats.storyChapter.stage >= 2);
  assert.ok(stats.passivePerSec > 150);
});

test('paid stream challenges boost boldness, grant subs, and respect viewer locks & cooldowns', () => {
  let s = { ...createInitialState(1000), balance: 10_000 };
  const lockedAttempt = triggerStreamChallenge(s, 'asmr_tease', 2000);
  assert.equal(lockedAttempt.ok, false);

  const firstRun = triggerStreamChallenge(s, 'lean_mic', 2000);
  assert.equal(firstRun.ok, true);
  assert.ok(firstRun.reward >= 15);
  assert.equal(firstRun.gainedSubs, 1);
  assert.equal(firstRun.state.subscribers, 1);
  s = firstRun.state;

  const cdAttempt = triggerStreamChallenge(s, 'lean_mic', 2500);
  assert.equal(cdAttempt.ok, false);

  const afterCd = triggerStreamChallenge(s, 'lean_mic', 20_000);
  assert.equal(afterCd.ok, true);

  assert.equal(STORY_CHAPTERS.length, 4);
  assert.equal(getStoryChapter(90).stage, 4);
  assert.equal(SUB_GOAL_STAGES.length, 6);
  assert.ok(STREAM_CHALLENGES.length >= 4);
});

test('uncapped elapsed-ms tick accrues passive income and organic viewer subs', () => {
  let s = { ...createInitialState(1000), balance: 500 };
  const bought = buyUpgrade(s, 'ring_lamp');
  assert.equal(bought.ok, true);
  s = { ...bought.state, hype: 0, boldness: 0 };

  const ticked = tickEconomy(s, 60_000, 61_000);
  assert.ok(ticked.state.balance > s.balance);
  assert.ok(ticked.gainedOrganicSubs >= 1);
  assert.ok(ticked.state.subscribers >= 1);
});

test('all 5 tap zones have Russian lines, shy Sub Goal lines, and emotion progression', () => {
  const zones: TapZoneId[] = ['head', 'chest', 'belly', 'legs', 'feet'];
  for (const z of zones) {
    for (const band of [1, 2, 3, 4] as const) {
      assert.ok(ZONE_DIALOGUES[z][band].length >= 2);
      for (const st of [0, 1, 2, 3, 4] as const) {
        assert.ok(pickDialogueLine(z, band, 0, st).length > 8);
      }
    }
  }

  for (const st of SUB_GOAL_STAGES.slice(1)) {
    assert.ok(st.shyApproachLines.length >= 3);
    const line = pickShySubGoalApproachLine(st, 1);
    assert.ok(line && line.length > 15);
  }

  assert.equal(pickEmotionForContext(5, 0, 1), 'shy');
  assert.equal(pickEmotionForContext(95, 4, 1), 'bold');
  assert.equal(pickEmotionForContext(95, 4, 3), 'tease');

  for (const st of [0, 1, 2, 3, 4, 5] as const) {
    assert.ok(pickIdleTeaseLine(st, 1).length > 15);
    assert.ok(pickFeverOverheatLine('chest', st, 1).length > 15);
  }
  assert.ok(pickReactionCalloutTag('feet', true, 2).length > 4);
  assert.equal(STREAM_CHALLENGES.length, 6);
});

test('serialization round-trips subscribers & sub-goal stages cleanly', () => {
  let s = { ...createInitialState(5000), balance: 1000 };
  s = buyGiftSubs(s, 5).state;
  s = buyGiftSubs(s, 5).state;
  const raw = serializeState(s);
  const loaded = deserializeState(raw, 6000);
  assert.equal(loaded.subscribers, 10);
  assert.equal(loaded.unlockedSubStage, 1);
  assert.equal(loaded.displayedSubStage, 1);

  const fallback = deserializeState('{broken_json', 7000);
  assert.equal(fallback.subscribers, 0);
  assert.equal(fallback.displayedSubStage, 0);
});

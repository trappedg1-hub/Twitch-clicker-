import assert from 'node:assert/strict';
import test from 'node:test';
import { pickDialogueLine, UPGRADE_REACTION_LINES, ZONE_DIALOGUES } from '../src/domain/dialogue.ts';
import {
  applyTap,
  buyUpgrade,
  computeStats,
  createInitialState,
  deserializeState,
  serializeState,
  tickEconomy,
  triggerStreamChallenge,
} from '../src/domain/engine.ts';
import {
  getStoryChapter,
  STORY_CHAPTERS,
  STREAM_CHALLENGES,
  WARDROBE_OUTFITS,
} from '../src/domain/progression.ts';
import type { TapZoneId } from '../src/domain/types.ts';
import { getUpgradeCost, TIER1_MILESTONES, TIER1_UPGRADES } from '../src/domain/upgrades.ts';

test('initial Tier 1 state starts as shy rookie (Stage 1, 0% boldness, 3 viewers)', () => {
  const s = createInitialState(1000);
  const stats = computeStats(s);
  assert.equal(s.balance, 0);
  assert.equal(s.boldness, 0);
  assert.equal(s.equippedOutfit, 't1_tight_tee');
  assert.equal(stats.onlineViewers, 3);
  assert.equal(stats.storyChapter.stage, 1);
  assert.equal(stats.dialogueBand, 1);
  assert.equal(stats.nextMilestone?.id, TIER1_MILESTONES[0]?.id);
});

test('tapping all 5 zones earns donations, builds boldness & hype, and triggers alert on 12th tap', () => {
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

test('paid stream challenges boost boldness, respect viewer locks & cooldowns, and progress story to Stage 4', () => {
  let s = { ...createInitialState(1000), balance: 10_000 };
  // asmr_tease requires 50 viewers -> locked initially
  const lockedAttempt = triggerStreamChallenge(s, 'asmr_tease', 2000);
  assert.equal(lockedAttempt.ok, false);

  // lean_mic requires 3 viewers -> succeeds immediately
  const firstRun = triggerStreamChallenge(s, 'lean_mic', 2000);
  assert.equal(firstRun.ok, true);
  assert.ok(firstRun.reward >= 15);
  assert.ok(firstRun.state.boldness > 0);
  s = firstRun.state;

  // Immediate repeat during cooldown fails
  const cdAttempt = triggerStreamChallenge(s, 'lean_mic', 2500);
  assert.equal(cdAttempt.ok, false);

  // After cooldown expires -> succeeds
  const afterCd = triggerStreamChallenge(s, 'lean_mic', 20_000);
  assert.equal(afterCd.ok, true);

  assert.equal(STORY_CHAPTERS.length, 4);
  assert.equal(getStoryChapter(90).stage, 4);
  assert.ok(WARDROBE_OUTFITS.length >= 5);
  assert.ok(STREAM_CHALLENGES.length >= 4);
});

test('uncapped elapsed-ms tick accrues full passive income across background intervals', () => {
  let s = { ...createInitialState(1000), balance: 500 };
  const bought = buyUpgrade(s, 'ring_lamp');
  assert.equal(bought.ok, true);
  s = { ...bought.state, hype: 0, boldness: 0 };

  const stats = computeStats(s);
  const before = s.balance;
  const ticked = tickEconomy(s, 10_000, 11_000);
  assert.equal(ticked.state.balance, Number((before + stats.passivePerSec * 10).toFixed(2)));
});

test('all 5 tap zones have Russian lines across all 4 boldness escalation bands', () => {
  const zones: TapZoneId[] = ['head', 'chest', 'belly', 'legs', 'feet'];
  for (const z of zones) {
    for (const band of [1, 2, 3, 4] as const) {
      assert.ok(ZONE_DIALOGUES[z][band].length >= 3);
      assert.ok(pickDialogueLine(z, band, 0).length > 8);
    }
  }
});

test('serialization round-trips boldness cleanly and recovers from corrupted JSON', () => {
  const s = applyTap(createInitialState(5000), 'chest', 5100).state;
  const raw = serializeState(s);
  const loaded = deserializeState(raw, 6000);
  assert.equal(loaded.balance, s.balance);
  assert.equal(loaded.boldness, s.boldness);
  assert.equal(loaded.totalTaps, 1);

  const fallback = deserializeState('{broken_json', 7000);
  assert.equal(fallback.balance, 0);
  assert.equal(fallback.boldness, 0);
});

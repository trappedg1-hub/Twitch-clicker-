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
} from '../src/domain/engine.ts';
import type { TapZoneId } from '../src/domain/types.ts';
import { getUpgradeCost, TIER1_MILESTONES, TIER1_UPGRADES } from '../src/domain/upgrades.ts';

test('initial Tier 1 state starts humble with 3 online viewers and zero balance', () => {
  const s = createInitialState(1000);
  const stats = computeStats(s);
  assert.equal(s.balance, 0);
  assert.equal(stats.onlineViewers, 3);
  assert.equal(stats.clickIncome, 5);
  assert.equal(stats.passivePerSec, 0);
  assert.equal(stats.dialogueBand, 1);
  assert.equal(stats.nextMilestone?.id, TIER1_MILESTONES[0]?.id);
});

test('tapping all 5 anatomical zones earns donations, raises hype, and triggers alert on 12th tap', () => {
  let s = createInitialState(1000);
  const zones: TapZoneId[] = ['head', 'chest', 'belly', 'legs', 'feet'];

  for (let i = 1; i <= 12; i++) {
    const z = zones[(i - 1) % zones.length]!;
    const out = applyTap(s, z, 1000 + i * 100);
    assert.ok(out.earned >= 5);
    assert.ok(out.line.length > 5);
    if (i === 12) {
      assert.equal(out.triggeredDonationAlert, true);
    } else {
      assert.equal(out.triggeredDonationAlert, false);
    }
    s = out.state;
  }

  assert.equal(s.totalTaps, 12);
  assert.ok(s.hype > 50);
  assert.ok(s.balance > 80);
});

test('buying Tier 1 upgrades scales cost, raises online viewers & passive income, and unlocks milestones', () => {
  let s = { ...createInitialState(1000), balance: 25_000 };

  for (const def of TIER1_UPGRADES) {
    const cost0 = getUpgradeCost(def, 0);
    const res = buyUpgrade(s, def.id);
    assert.equal(res.ok, true);
    assert.equal(res.cost, cost0);
    assert.equal(res.state.upgrades[def.id], 1);
    assert.ok(UPGRADE_REACTION_LINES[def.id].length > 10);
    s = res.state;
  }

  const stats = computeStats(s);
  assert.ok(stats.onlineViewers >= 60, `expected >=60 viewers, got ${stats.onlineViewers}`);
  assert.equal(stats.dialogueBand, 3);
  assert.ok(stats.passivePerSec > 150);
  assert.ok(s.unlockedMilestones.includes('m_10'));
  assert.ok(s.unlockedMilestones.includes('m_25'));
  assert.ok(s.unlockedMilestones.includes('m_60'));
});

test('uncapped elapsed-ms tick accrues full passive income across background intervals', () => {
  let s = { ...createInitialState(1000), balance: 500 };
  const bought = buyUpgrade(s, 'ring_lamp');
  assert.equal(bought.ok, true);
  s = { ...bought.state, hype: 0 };

  const before = s.balance;
  // Simulate 10 seconds in a background tab in a single uncapped tick
  const ticked = tickEconomy(s, 10_000, 11_000);
  assert.equal(ticked.state.balance, Number((before + 15).toFixed(2)));
});

test('all 5 tap zones have non-empty Russian lines across all 3 progression bands', () => {
  const zones: TapZoneId[] = ['head', 'chest', 'belly', 'legs', 'feet'];
  for (const z of zones) {
    for (const band of [1, 2, 3] as const) {
      assert.ok(ZONE_DIALOGUES[z][band].length >= 3);
      assert.ok(pickDialogueLine(z, band, 0).length > 8);
    }
  }
});

test('serialization round-trips cleanly and recovers gracefully from corrupted JSON', () => {
  const s = applyTap(createInitialState(5000), 'feet', 5100).state;
  const raw = serializeState(s);
  const loaded = deserializeState(raw, 6000);
  assert.equal(loaded.balance, s.balance);
  assert.equal(loaded.totalTaps, 1);

  const fallback = deserializeState('{broken_json', 7000);
  assert.equal(fallback.balance, 0);
  assert.equal(fallback.totalTaps, 0);
});

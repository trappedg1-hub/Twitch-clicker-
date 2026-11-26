import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DAY2_OPENING_LINE,
  DAY2_SHAME_LINES,
  DAY3_FAREWELL_LINES,
  DAY3_OPENING_LINE,
  GHOST_BOO_LINES,
  pickDialogueLine,
  pickStageTapLine,
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
  isDay1FinaleReached,
  selectDisplayedSubStage,
  serializeState,
  isDay2FinaleReached,
  startDay2,
  startDay3,
  tickEconomy,
  triggerStreamChallenge,
} from '../src/domain/engine.ts';
import {
  getStoryChapter,
  STORY_CHAPTERS,
  STREAM_CHALLENGES,
} from '../src/domain/progression.ts';
import {
  DAY1_FINALE_SUBS,
  dayFinaleSubs,
  DAY2_SUB_GOAL_STAGES,
  DAY3_FLASH_PLATE,
  getGiftSubUnitCost,
  getShortStepLabelsForDay,
  getStepLabelsForDay,
  isDay3Unlocked,
  getSubGoalStageForSubs,
  getSubGoalStagesForDay,
  pickShySubGoalApproachLine,
  SUB_GOAL_STAGES,
} from '../src/domain/subGoals.ts';
import { DAY1_FAREWELL_LINES, getStreamTitle } from '../src/domain/dialogue.ts';
import type { SubGoalStageIndex, TapZoneId } from '../src/domain/types.ts';
import {
  contradictsWardrobe,
  getWardrobe,
  WARDROBE_SAFE_LINES,
} from '../src/domain/wardrobe.ts';
import { getMicTier, getUpgradeCost, MIC_TIERS, TIER1_MILESTONES, TIER1_UPGRADES } from '../src/domain/upgrades.ts';

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

test('Sub Goal strip-down progression unlocks 10 -> 50 -> 200 -> 500 subs (Day 1 finale) cleanly', () => {
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
  assert.equal(computeStats(s).nextSubGoalDef, null);
  assert.equal(isDay1FinaleReached(s), true);

  const maxStats = computeStats(s);
  assert.equal(maxStats.nextSubGoalDef, null);
  assert.equal(maxStats.currentSubStageDef.plateUrl, '/art/heroine_t1_s4.webp');

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
  assert.equal(SUB_GOAL_STAGES.length, 5);
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

  for (const st of [0, 1, 2, 3, 4] as const) {
    assert.ok(pickIdleTeaseLine(st, 1).length > 15);
    assert.ok(pickFeverOverheatLine('chest', st, 1).length > 15);
  }
  assert.ok(pickReactionCalloutTag('feet', true, 2).length > 4);
  assert.equal(STREAM_CHALLENGES.length, 6);
});

test('the day-final number has exactly one source: the ladder\u02bcs last step', () => {
  // DAY1_FINALE_SUBS is the engine gate, dayFinaleSubs is what the finale card and the CTA read.
  // They must never disagree, or the card offers a transition the engine refuses (or hides one that
  // is already legal). Day 2/3 have no separate constant, so the last step is the rule there too.
  assert.equal(dayFinaleSubs(1), DAY1_FINALE_SUBS);
  assert.equal(dayFinaleSubs(2), 5_000);
  assert.equal(dayFinaleSubs(3), 15_000);
  for (const day of [1, 2, 3]) {
    const ladder = getSubGoalStagesForDay(day);
    assert.equal(dayFinaleSubs(day), ladder[ladder.length - 1]!.subsRequired);
  }
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

test('Day 1 finale at 500 subs carries ALL upgrades, wardrobe, balance & boldness into Day 2', () => {
  let s = { ...createInitialState(1000), balance: 500_000 };
  // Buy some upgrades incl. desk mic tier 3
  s = buyUpgrade(s, 'ring_lamp').state;
  s = buyUpgrade(s, 'desk_mic').state;
  s = buyUpgrade(s, 'desk_mic').state;
  s = buyUpgrade(s, 'desk_mic').state;
  assert.equal(s.upgrades.desk_mic, 3);
  assert.equal(s.streamDay, 1);

  // Gift to 500 subs (Day 1 finale)
  while (s.subscribers < 500) {
    const r = buyGiftSubs(s, 25);
    assert.equal(r.ok, true);
    s = r.state;
  }
  assert.equal(s.unlockedSubStage, 4);
  assert.equal(isDay1FinaleReached(s), true);

  const balanceBefore = s.balance;
  const boldBefore = s.boldness;
  const micBefore = s.upgrades.desk_mic;
  const lampBefore = s.upgrades.ring_lamp;

  const day2 = startDay2(s);
  assert.equal(day2.ok, true);
  const d2 = day2.state;
  assert.equal(d2.streamDay, 2);
  assert.equal(d2.carriedOverWardrobeStage, 4);
  // Day 2 has its own Sub Goal ladder (1500/2000/2500/5000), so the wardrobe stage restarts at 0.
  assert.equal(d2.unlockedSubStage, 0);
  // Day 2 opens back in the new costume plate (stage 0 = Day 2 oversize-hoodie art),
  // while every Day 1 unlock stays available.
  assert.equal(d2.displayedSubStage, 0);
  // 100% carry-over: upgrades, mic tier, balance, boldness
  assert.equal(d2.upgrades.desk_mic, micBefore);
  assert.equal(d2.upgrades.ring_lamp, lampBefore);
  assert.equal(d2.balance, balanceBefore);
  assert.equal(d2.boldness, boldBefore);
  assert.equal(isDay1FinaleReached(d2), false);

  // Day 2 costume logic: the Day 2 plate + labels come from the Sub Goal def, and the
  // story chapter / challenge copy switch to the "ashamed about yesterday" arc.
  const day0 = SUB_GOAL_STAGES[0]!;
  assert.equal(day0.day2PlateUrl, '/art/heroine_t2_s0.webp');
  assert.ok(day0.day2OutfitName?.includes('Оверсайз худи'));
  for (const txt of [day0.day2StoryDesc!, day0.day2OutfitName!, DAY2_OPENING_LINE, ...DAY2_SHAME_LINES]) {
    const low = txt.toLowerCase();
    assert.ok(!low.includes('молни'), `Day 2 costume copy must not mention a zipper: ${txt}`);
    assert.ok(!low.includes('застёжк'), `Day 2 hoodie has no fasteners: ${txt}`);
  }
  assert.notEqual(getStoryChapter(10, 2).badgeTitle, getStoryChapter(10, 1).badgeTitle);
  assert.ok(getStoryChapter(10, 2).badgeTitle.startsWith('День 2'));
  const feet = STREAM_CHALLENGES.find((c) => c.id === 'pose_feet')!;
  assert.ok(!feet.desc.toLowerCase().includes('босым'));
  assert.ok(feet.reactionLineDay2!.includes('гольфы'));

  // Cannot start Day 2 twice / before finale
  assert.equal(startDay2(d2).ok, false);
  assert.equal(startDay2(createInitialState(1000)).ok, false);

  // Serialization round-trips Day 2
  const loaded = deserializeState(serializeState(d2), 2000);
  assert.equal(loaded.streamDay, 2);
  assert.equal(loaded.carriedOverWardrobeStage, 4);
  assert.equal(loaded.upgrades.desk_mic, 3);
});

test('desk microphone upgrade goes Tier 1..10 with visuals on the desk', () => {
  assert.equal(MIC_TIERS.length, 10);
  assert.equal(getMicTier(0), null);
  assert.equal(getMicTier(1)?.spriteUrl, '/art/mics/mic_t1.webp');
  assert.equal(getMicTier(10)?.spriteUrl, '/art/mics/mic_t10.webp');
  assert.ok((getMicTier(10)?.modelName ?? '').includes('Neumann'));

  let s = { ...createInitialState(1000), balance: 1_000_000 };
  for (let tier = 1; tier <= 10; tier++) {
    const res = buyUpgrade(s, 'desk_mic');
    assert.equal(res.ok, true);
    s = res.state;
    assert.equal(s.upgrades.desk_mic, tier);
    assert.equal(getMicTier(tier)?.tier, tier);
  }
  // Maxed out
  assert.equal(buyUpgrade(s, 'desk_mic').ok, false);
  // Costs grow steeply toward Tier 10
  assert.ok(getUpgradeCost(TIER1_UPGRADES.find((u) => u.id === 'desk_mic')!, 9) > 5000);
});

test('Day 2 ladder: 1500 / 2000 / 2500 / 5000 subs, its own plates, rising fanservice', () => {
  assert.equal(DAY2_SUB_GOAL_STAGES.length, 5);
  assert.deepEqual(
    DAY2_SUB_GOAL_STAGES.map((st) => st.subsRequired),
    [0, 1500, 2000, 2500, 5000],
  );
  assert.equal(getSubGoalStagesForDay(1), SUB_GOAL_STAGES);
  assert.equal(getSubGoalStagesForDay(2), DAY2_SUB_GOAL_STAGES);
  assert.equal(getSubGoalStageForSubs(1499, 2), 0);
  assert.equal(getSubGoalStageForSubs(1500, 2), 1);
  assert.equal(getSubGoalStageForSubs(2499, 2), 2);
  assert.equal(getSubGoalStageForSubs(5000, 2), 4);
  // Day 1 thresholds must not leak into Day 2 (624 subs used to instantly strip her!)
  assert.equal(getSubGoalStageForSubs(624, 2), 0);
  assert.equal(getSubGoalStageForSubs(624, 1), 4);

  // Every stage has its own Day 2 plate, and the multiplier/pacing strictly grow.
  DAY2_SUB_GOAL_STAGES.forEach((st, idx) => {
    assert.equal(st.plateUrl, `/art/heroine_t2_s${idx}.webp`);
    if (idx > 0) {
      assert.ok(st.incomeMultiplier > DAY2_SUB_GOAL_STAGES[idx - 1]!.incomeMultiplier);
      assert.ok(st.boldnessBonus > DAY2_SUB_GOAL_STAGES[idx - 1]!.boldnessBonus);
      assert.ok(st.unlockLine.length > 40);
      assert.ok(st.shortGoalTitle.length > 4);
    }
  });

  // Costume logic: zipper-less pullover, golf socks stay ON until the very last stage.
  for (const st of DAY2_SUB_GOAL_STAGES) {
    const blob = [
      st.shortGoalTitle,
      st.outfitName,
      st.removedItemLabel,
      st.storyDesc,
      st.unlockLine,
      ...st.shyApproachLines,
      ...st.chatCascade.map((m) => m.text),
    ]
      .join(' ')
      .toLowerCase();
    assert.ok(!blob.includes('молни'), `pullover hoodie has no zipper: ${st.shortGoalTitle}`);
    assert.ok(!blob.includes('застёжк'), `no fasteners on the hoodie: ${st.shortGoalTitle}`);
    const socksOn = st.stage >= 1 && st.stage <= 3;
    if (socksOn) {
      assert.ok(blob.includes('гольф'), `stage ${st.stage} must keep the golf socks on`);
    } else if (st.stage === 4) {
      assert.ok(
        blob.includes('гольф') || blob.includes('босы'),
        'the finale is where the golf socks finally come off',
      );
      assert.ok(blob.includes('босы'), 'finale plate is barefoot');
      assert.ok(!blob.includes('на месте'), 'finale must not claim the socks are still on');
    }
  }

  // No invented garments: the Day 2 wardrobe stays hoodie + shorts + golf socks (top layers
  // only get removed or re-tied — nothing like a dress or a skirt may ever appear in the copy).
  const forbidden = ['платье', 'платьиц', 'юбк', 'сарафан', 'халат', 'комбинезон', 'молни'];
  for (const st of DAY2_SUB_GOAL_STAGES) {
    const blob = [
      st.shortGoalTitle,
      st.outfitName,
      st.removedItemLabel,
      st.storyDesc,
      st.unlockLine,
      ...st.shyApproachLines,
      ...st.chatCascade.map((msg) => msg.text),
      ...DAY2_OPENING_LINE,
      ...DAY2_SHAME_LINES,
    ]
      .join(' ')
      .toLowerCase();
    for (const word of forbidden) {
      assert.ok(!blob.includes(word), `Day 2 copy must not invent "${word}": ${st.shortGoalTitle}`);
    }
  }

  // Gift-sub pricing keeps up with the Day 2 grind.
  assert.equal(getGiftSubUnitCost(499), 75);
  assert.equal(getGiftSubUnitCost(500), 110);
  assert.equal(getGiftSubUnitCost(2000), 150);
  assert.equal(getGiftSubUnitCost(4999), 195);
  assert.equal(getGiftSubUnitCost(5000), 240);
});

test('Day 1 farewell is a plain sweet goodbye: no sock bragging, no carry-over lecture', () => {
  assert.ok(DAY1_FAREWELL_LINES.length >= 4);
  for (const line of DAY1_FAREWELL_LINES) {
    const low = line.toLowerCase();
    assert.ok(!low.includes('носо'), `farewell must not talk about socks: ${line}`);
    assert.ok(!low.includes('гольф'), `farewell must not list her socks: ${line}`);
    assert.ok(!low.includes('звезд'), 'no "star of the stream" bragging');
    assert.ok(!low.includes('улучшен'), 'no upgrade/carry-over talk in the farewell');
    assert.ok(!low.includes('переезжа'), 'no carry-over talk in the farewell');
    assert.ok(!low.includes('баланс'), 'no balance talk in the farewell');
  }
  // She is shy: her own lines barely mention socks/legs gear, the chat does the shouting.
  const herLines = [DAY2_OPENING_LINE, ...DAY2_SHAME_LINES];
  let sockTalk = 0;
  for (const line of herLines) {
    if (line.toLowerCase().includes('носо')) sockTalk += 1;
  }
  assert.equal(sockTalk, 0, 'Day 2 shame arc must not repeat sock talk from her');
});

test('stream titles follow the day (Day 1 socks goal vs Day 2 5000 subs finale)', () => {
  assert.ok(getStreamTitle(0, 3, 1).includes('/10'));
  assert.ok(getStreamTitle(0, 600, 2).includes('1500'));
  assert.ok(getStreamTitle(3, 4000, 2).includes('5000'));
  assert.ok(getStreamTitle(4, 5000, 2).includes('ФИНАЛ ДНЯ 2'));
  assert.ok(getStreamTitle(4, 500, 1).includes('ПЕРВОГО ДНЯ'));
});

// ============ Wardrobe-consistent dialogue (art vs. what she says) ============
const QA_ZONES: TapZoneId[] = ['head', 'chest', 'belly', 'legs', 'feet'];

test('every line she speaks matches what is actually on her right now', () => {
  for (const day of [1, 2, 3] as const) {
    for (let stage = 0; stage <= 4; stage++) {
      const w = getWardrobe(day, stage);
      for (const line of WARDROBE_SAFE_LINES[day][stage as SubGoalStageIndex]!) {
        assert.equal(contradictsWardrobe(line, w), null, `safe day${day}s${stage}: ${line}`);
      }
      for (const zone of QA_ZONES) {
        for (const band of [1, 2, 3, 4] as const) {
          for (let seed = 0; seed < 10; seed++) {
            const line = pickDialogueLine(zone, band, seed, stage as SubGoalStageIndex, day);
            assert.equal(
              contradictsWardrobe(line, w, zone),
              null,
              `day${day}s${stage} ${zone}/b${band}/#${seed}: ${line}`,
            );
          }
        }
        for (let seed = 0; seed < 10; seed++) {
          const d2 = pickStageTapLine(zone, seed, stage as SubGoalStageIndex, day);
          assert.equal(
            contradictsWardrobe(d2, getWardrobe(day, stage), zone),
            null,
            `day${day} tap: ${d2}`,
          );
          const fever = pickFeverOverheatLine(zone, stage as SubGoalStageIndex, seed, day);
          assert.equal(contradictsWardrobe(fever, w, zone), null, `fever: ${fever}`);
        }
      }
      for (let seed = 0; seed < 10; seed++) {
        const idle = pickIdleTeaseLine(stage as SubGoalStageIndex, seed, day);
        assert.equal(contradictsWardrobe(idle, w), null, `idle: ${idle}`);
      }
    }
  }
});

test('sub goal copy never invents clothing she is not wearing', () => {
  for (const [day, stages] of [
    [1, SUB_GOAL_STAGES],
    [2, DAY2_SUB_GOAL_STAGES],
  ] as const) {
    stages.forEach((stage, idx) => {
      const w = getWardrobe(day, idx);
      const texts = [
        stage.shortGoalTitle,
        stage.outfitName,
        stage.removedItemLabel ?? '',
        stage.storyDesc,
        stage.unlockLine ?? '',
        ...stage.shyApproachLines,
      ];
      for (const text of texts) {
        const why = contradictsWardrobe(text, w);
        assert.equal(why, null, `day${day} stage${idx}: ${why ?? ''} :: ${text}`);
      }
    });
  }
});

test('stream titles sell her arc, not her outfit', () => {
  const garmentWords = [
    'худи', 'гольф', 'носк', 'носочк', 'шорт', 'легинс', 'маек', 'тишк', 'кроп',
    'бралет', 'бра-топ', 'бюст', 'топ ', 'платье', 'юбк', 'босы', 'босиком', 'ступн',
  ];
  for (const day of [1, 2, 3]) {
    for (let stage = 0; stage <= 4; stage++) {
      const title = getStreamTitle(stage as SubGoalStageIndex, 1234, day);
      for (const word of garmentWords) {
        assert.ok(!title.toLowerCase().includes(word), `day${day}s${stage} title mentions "${word}": ${title}`);
      }
      assert.match(title, /SUB GOAL|САБОВ/, `title lost its goal tail: ${title}`);
    }
  }
});

// ============ Day 3 «призрачная стримерша» (cosplay day) ============
test('Day 3 ghost ladder: sheet reveal beats 7000/10000/13000/15000 on its own plates', () => {
  const stages = getSubGoalStagesForDay(3);
  assert.deepEqual(
    stages.map((s) => s.subsRequired),
    [0, 7000, 10000, 13000, 15000],
  );
  // Fanservice escalates monotonically - every stage is strictly more exposed than the last.
  const mults = stages.map((s) => s.incomeMultiplier);
  for (let i = 1; i < mults.length; i++) assert.ok(mults[i]! > mults[i - 1]!, 'income must rise');
  const emotions = stages.map((s) => s.unlockEmotion).join(',');
  // The finale keeps `bold`: stages 3 and 4 differ by what the sheet does, not by her courage.
  assert.equal(emotions, 'shy,tease,fluster,bold,bold');
  for (const s of stages) assert.match(s.plateUrl, /^\/art\/heroine_t3_s[0-4]\.webp$/);
  // She never invents a garment: the whole day is one sheet, one bodysuit and one pair of fishnets.
  for (const s of stages) {
    for (const text of [s.shortGoalTitle, s.outfitName, s.storyDesc, s.unlockLine ?? '', ...s.shyApproachLines]) {
      const t = text.toLowerCase();
      for (const word of ['платье', 'юбк', 'худи', 'гольф', 'носок', 'носочк', 'легинс', 'ушк', 'зайк']) {
        assert.ok(!t.includes(word), `day 3 ladder copy mentions "${word}": ${text}`);
      }
    }
    assert.match(s.outfitName, /простын|сетк|боди/i, 'outfit must name the ghost costume parts');
  }
  // Stage math follows the ghost sheet, and each chat cascade is real Twitch noise.
  assert.equal(getSubGoalStageForSubs(6999, 3), 0);
  assert.equal(getSubGoalStageForSubs(7000, 3), 1);
  assert.equal(getSubGoalStageForSubs(12999, 3), 2);
  assert.equal(getSubGoalStageForSubs(15000, 3), 4);
  for (const s of stages) {
    assert.ok(s.chatCascade.length >= 2, `stage ${s.stage} needs a chat reaction`);
    for (const m of s.chatCascade) {
      assert.ok(m.author.length > 1 && m.text.length > 8, 'cascade entries need an author and a body');
      assert.match(m.color, /^#[0-9a-f]{6}$/i);
    }
  }
});

test('Day 3 copy matches the sheet state on screen (nothing slips before its time)', () => {
  for (let stage = 0; stage <= 4; stage++) {
    const w = getWardrobe(3, stage);
    assert.equal(w.sheet, (['veil', 'hemLift', 'hood', 'off', 'cape'] as const)[stage]);
    assert.equal(w.fishnets, true, 'fishnets are permanent on the ghost day');
    // Stage 0 must reject every "it moved" claim; later stages must accept their own truth.
    if (stage === 0) {
      assert.ok(contradictsWardrobe('Простыня сползла с плеча', w));
      assert.ok(contradictsWardrobe('Под тканью видно бретельку боди', w));
      assert.ok(contradictsWardrobe('Я сижу в худи и гольфах', w));
      assert.ok(contradictsWardrobe('Я задрала подол простыни, и живот открыт', w));
      assert.ok(contradictsWardrobe('Простыня полностью меня закрывает', w) === null);
    }
    if (stage === 4) {
      // Only the finale may call the sheet a cape, and only the finale frame is a cape.
      assert.ok(contradictsWardrobe('Простыня у меня на плечах как плащ', w) === null);
      assert.ok(contradictsWardrobe('Ткань полностью меня закрывает', w));
    }
    for (const line of WARDROBE_SAFE_LINES[3][stage as SubGoalStageIndex]!) {
      assert.equal(contradictsWardrobe(line, w), null, `safe s${stage}: ${line}`);
    }
    for (const zone of QA_ZONES) {
      for (let seed = 0; seed < 60; seed++) {
        const line = pickStageTapLine(zone, seed, stage as SubGoalStageIndex, 3);
        assert.equal(contradictsWardrobe(line, w, zone), null, `s${stage} ${zone}#${seed}: ${line}`);
      }
      for (let seed = 0; seed < 40; seed++) {
        const idle = pickIdleTeaseLine(stage as SubGoalStageIndex, seed, 3);
        assert.equal(contradictsWardrobe(idle, w), null, `s${stage} idle: ${idle}`);
      }
    }
  }
});

test('Day 3 is gated: no ghost plates means no cosplay day, and it starts only after Day 2', () => {
  // Node has no window, so the HEAD probe of heroine_t3_* cannot run from a test.
  assert.equal(isDay3Unlocked(), false);
  const day1 = createInitialState(1000);
  assert.equal(startDay3(day1).ok, false, 'Day 3 cannot start on Day 1');
  const afterDay1 = startDay2({ ...day1, subscribers: 501 });
  assert.ok(afterDay1.ok);
  assert.equal(startDay3(afterDay1.state).ok, false, 'the Day 2 ladder is not finished yet');
  const day2Done = { ...afterDay1.state, subscribers: 5000 };
  assert.equal(isDay2FinaleReached(day2Done), true);
  assert.equal(startDay3(day2Done).ok, false, 'locked while the heroine_t3_* art probe cannot run');
  // ...but everything the day needs to carry over is already in place.
  assert.equal(getStreamTitle(0, 100, 3).includes('7000'), true);
  assert.equal(DAY3_FLASH_PLATE, '/art/heroine_t3_flash.webp');
  assert.equal(getStepLabelsForDay(3).length, 4);
  assert.equal(getShortStepLabelsForDay(3)[3], '15000');
  // Price curve keeps climbing with the ghost ladder instead of freezing at the Day 2 top.
  assert.ok(getGiftSubUnitCost(5200) < getGiftSubUnitCost(7000));
  assert.ok(getGiftSubUnitCost(9999) < getGiftSubUnitCost(10000));
  assert.ok(getGiftSubUnitCost(14999) < getGiftSubUnitCost(15000));
});

test('the ghost farewell and the «Бу!» flash lines close the day without inventing anything', () => {
  const finale = getWardrobe(3, 4);
  for (const line of DAY3_FAREWELL_LINES) {
    assert.equal(contradictsWardrobe(line, finale), null, `farewell: ${line}`);
  }
  assert.match(DAY3_OPENING_LINE, /Бу!/);
  assert.match(DAY3_OPENING_LINE, /простын/);
  // The flash line must be true at EVERY sheet state - the flash happens on any stage.
  for (let stage = 0; stage <= 4; stage++) {
    for (const line of GHOST_BOO_LINES) {
      assert.equal(
        contradictsWardrobe(line, getWardrobe(3, stage)),
        null,
        `boo at s${stage}: ${line}`,
      );
    }
  }
  assert.ok(DAY3_FAREWELL_LINES.length >= 5, 'the ghost day needs a real goodbye');
  assert.match(DAY3_FAREWELL_LINES.join(' '), /сетк/, 'farewell must mention the fishnets punchline');
});

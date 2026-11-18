import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SUB_GOAL_STAGES,
  DAY2_SUB_GOAL_STAGES,
  DAY3_SUB_GOAL_STAGES,
  DAY4_SUB_GOAL_STAGES,
} from '../src/domain/subGoals.ts';
import {
  WARDROBES,
  contradictsWardrobe,
  type DayIndex,
} from '../src/domain/wardrobe.ts';
import {
  DAY1_FAREWELL_LINES,
  DAY2_FAREWELL_LINES,
  DAY2_IDLE_BY_STAGE,
  DAY2_STAGE_ZONE_LINES,
  DAY3_FAREWELL_LINES,
  DAY3_IDLE_BY_STAGE,
  DAY3_STAGE_ZONE_LINES,
  DAY4_DONE_LINES as DAY4_DONE_LINES_POOL,
  DAY4_FAREWELL_LINES,
  DAY4_IDLE_BY_STAGE,
  DAY4_STAGE_ZONE_LINES,
  GHOST_BOO_LINES,
} from '../src/domain/dialogue.ts';
import {
  AMBIENT_DAY3_BY_STAGE,
  AMBIENT_DAY4_BY_STAGE,
  DONATION_TTS_LINES_DAY4,
  VIRAL_CLIP_TITLES_DAY4,
  ZONE_CHAT_REACTIONS_DAY4,
} from '../src/chat/chatEngine.ts';
import { DAY3_STORY_CHAPTERS, DAY4_STORY_CHAPTERS } from '../src/domain/progression.ts';
import type { SubGoalStageDef, SubGoalStageIndex, TapZoneId } from '../src/domain/types.ts';

/**
 * Copy audit: every string the ladder can put on screen is checked against the plate that is on
 * screen at the same time. `scripts/linescan_days.ts` prints the same report for humans; this test
 * is what keeps goal descriptions, her lines and the viewers' chat honest when the art moves.
 */

const DAYS: [DayIndex, readonly SubGoalStageDef[]][] = [
  [1, SUB_GOAL_STAGES],
  [2, DAY2_SUB_GOAL_STAGES],
  [3, DAY3_SUB_GOAL_STAGES],
  [4, DAY4_SUB_GOAL_STAGES],
];

const ZONES: TapZoneId[] = ['head', 'chest', 'belly', 'legs', 'feet'];

test('no copy line claims a garment state the current plate does not show', () => {
  const offenders: string[] = [];
  let checked = 0;

  const check = (where: string, line: string | undefined, day: DayIndex, stage: SubGoalStageIndex): void => {
    if (!line) return;
    checked++;
    const why = contradictsWardrobe(line, WARDROBES[day][stage]);
    if (why) offenders.push(`${where} (${why}): ${line.slice(0, 70)}`);
  };

  for (const [day, stages] of DAYS) {
    for (const st of stages) {
      const at = `d${day}s${st.stage}`;
      check(`${at} outfitName`, st.outfitName, day, st.stage);
      check(`${at} storyDesc`, st.storyDesc, day, st.stage);
      check(`${at} unlockLine`, st.unlockLine, day, st.stage);
      st.shyApproachLines.forEach((l, i) => check(`${at} shy[${i}]`, l, day, st.stage));
      st.chatCascade.forEach((c, i) => check(`${at} chat[${i}]`, c.text, day, st.stage));

      const perDay =
        day === 2
          ? DAY2_STAGE_ZONE_LINES
          : day === 3
            ? DAY3_STAGE_ZONE_LINES
            : day === 4
              ? DAY4_STAGE_ZONE_LINES
              : null;
      if (perDay) {
        const per = (
          perDay as Record<SubGoalStageIndex, Partial<Record<TapZoneId, readonly string[]>>>
        )[st.stage];
        for (const zone of ZONES) {
          (per?.[zone] ?? []).forEach((l, i) => check(`${at} ${zone}[${i}]`, l, day, st.stage));
        }
      }
      const idle =
        day === 2
          ? DAY2_IDLE_BY_STAGE[st.stage]
          : day === 3
            ? DAY3_IDLE_BY_STAGE[st.stage]
            : day === 4
              ? DAY4_IDLE_BY_STAGE[st.stage]
              : undefined;
      (idle ?? []).forEach((l, i) => check(`${at} idle[${i}]`, l, day, st.stage));
      if (day === 3) {
        (AMBIENT_DAY3_BY_STAGE[st.stage] ?? []).forEach((l, i) => check(`${at} ambient[${i}]`, l, day, st.stage));
      }
      if (day === 4) {
        // The viewers' chatter is copy too: it has to describe THIS plate (socks on, kit intact).
        (AMBIENT_DAY4_BY_STAGE[st.stage] ?? []).forEach((l, i) => check(`${at} ambient[${i}]`, l, day, st.stage));
        for (const zone of ZONES) {
          (ZONE_CHAT_REACTIONS_DAY4[zone] ?? []).forEach((l, i) => check(`${at} burst_${zone}[${i}]`, l, day, st.stage));
          (VIRAL_CLIP_TITLES_DAY4[zone] ?? []).forEach((l, i) => check(`${at} clip_${zone}[${i}]`, l, day, st.stage));
        }
        DONATION_TTS_LINES_DAY4.forEach((l, i) => check(`${at} tts[${i}]`, l, day, st.stage));
      }
    }
  }

  // Farewells and the flash pools always play on the finale plate, so they are checked against the
  // finale plate of THEIR OWN day - a Day-4 goodbye about socks must not be graded on Day 1's art.
  const finaleStage = (day: DayIndex): SubGoalStageIndex => (day === 4 ? 3 : 4);
  for (const [day, pool] of [
    [1, DAY1_FAREWELL_LINES],
    [2, DAY2_FAREWELL_LINES],
    [3, [...DAY3_FAREWELL_LINES, ...GHOST_BOO_LINES]],
    [4, [...DAY4_FAREWELL_LINES, ...DAY4_DONE_LINES_POOL]],
  ] as [DayIndex, readonly string[]][]) {
    pool.forEach((l, i) => check(`d${day} farewell[${i}]`, l, day, finaleStage(day)));
  }

  // The story panel is keyed to boldness, not to the ladder, so its copy has to be true for EVERY
  // plate of its day or it will contradict whatever happens to be on screen.
  for (const [day, chapters] of [
    [3, DAY3_STORY_CHAPTERS],
    [4, DAY4_STORY_CHAPTERS],
  ] as [DayIndex, readonly { headline: string; diaryThought: string; badgeTitle: string }[]][]) {
    for (const ch of chapters) {
      for (let stage = 0; stage <= 4; stage++) {
        for (const [field, text] of [
          ['headline', ch.headline],
          ['diary', ch.diaryThought],
          ['badge', ch.badgeTitle],
        ] as const) {
          check(`d${day} story${field}`, text, day, stage as SubGoalStageIndex);
        }
      }
    }
  }

  assert.ok(checked > 250, `the audit degenerated, only ${checked} lines were checked`);
  assert.deepEqual(offenders, []);
});

test('a stage never loses its whole line pool to the wardrobe guard', () => {
  const zoneMap = (day: DayIndex) =>
    day === 3
      ? (DAY3_STAGE_ZONE_LINES as Record<SubGoalStageIndex, Partial<Record<TapZoneId, readonly string[]>>>)
      : day === 2
        ? (DAY2_STAGE_ZONE_LINES as Record<SubGoalStageIndex, Partial<Record<TapZoneId, readonly string[]>>>)
        : null;
  const idleMap = (day: DayIndex) =>
    day === 3 ? DAY3_IDLE_BY_STAGE : day === 2 ? DAY2_IDLE_BY_STAGE : null;

  for (const [day, stages] of DAYS) {
    for (const st of stages) {
      const w = WARDROBES[day][st.stage];
      const zones = zoneMap(day)?.[st.stage];
      const pools: readonly (readonly string[])[] = [
        st.shyApproachLines,
        ...ZONES.map((z) => zones?.[z] ?? []),
        idleMap(day)?.[st.stage] ?? [],
      ];
      for (const pool of pools) {
        if (pool.length === 0) continue;
        const survivors = pool.filter((l) => contradictsWardrobe(l, w) === null);
        assert.ok(
          survivors.length > 0,
          `d${day}s${st.stage} has a pool where every line contradicts the plate`,
        );
      }
    }
  }
});

/**
 * Copy-vs-art audit for every day of the ladder.
 *
 * Each string the game can put on screen - goal descriptions, her approach lines, the subtitle
 * pools per tap zone, the idle monologues and the viewers' chat - is pushed through the very same
 * `contradictsWardrobe()` guard the engine runs before it lets Miya speak. Anything rejected here is
 * a line that claims a garment state the current plate does not show, so either the copy is stale or
 * the art moved; both are bugs the players would actually see.
 *
 *   node --experimental-strip-types scripts/linescan_days.ts
 */
import {
  SUB_GOAL_STAGES,
  DAY2_SUB_GOAL_STAGES,
  DAY3_SUB_GOAL_STAGES,
  DAY4_SUB_GOAL_STAGES,
  DAY5_SUB_GOAL_STAGES,
} from '../src/domain/subGoals.ts';
import {
  contradictsWardrobe,
  WARDROBES,
  type DayIndex,
  type Wardrobe,
} from '../src/domain/wardrobe.ts';
import {
  DAY1_FAREWELL_LINES,
  DAY2_FAREWELL_LINES,
  DAY2_IDLE_BY_STAGE,
  DAY2_OPENING_LINE,
  DAY2_STAGE_ZONE_LINES,
  DAY3_FAREWELL_LINES,
  DAY3_IDLE_BY_STAGE,
  DAY3_OPENING_LINE,
  DAY3_STAGE_ZONE_LINES,
  DAY4_DONE_LINES,
  DAY4_FAREWELL_LINES,
  DAY4_IDLE_BY_STAGE,
  DAY4_OPENING_LINE,
  DAY4_STAGE_ZONE_LINES,
  DAY4_TAP_LINES,
  DAY5_FAREWELL_LINES,
  DAY5_IDLE_BY_STAGE,
  DAY5_OPENING_LINE,
  DAY5_STAGE_ZONE_LINES,
  DAY5_TAP_LINES,
  GHOST_BOO_LINES,
} from '../src/domain/dialogue.ts';
import type { SubGoalStageDef, SubGoalStageIndex, TapZoneId } from '../src/domain/types.ts';
import {
  AMBIENT_DAY3_BY_STAGE,
  AMBIENT_DAY4,
  AMBIENT_DAY4_BY_STAGE,
  AMBIENT_DAY5,
  AMBIENT_DAY5_BY_STAGE,
  DONATION_TTS_LINES_DAY4,
  DONATION_TTS_LINES_DAY5,
  VIRAL_CLIP_TITLES_DAY4,
  VIRAL_CLIP_TITLES_DAY5,
  ZONE_CHAT_REACTIONS_DAY4,
  ZONE_CHAT_REACTIONS_DAY5,
} from '../src/chat/chatEngine.ts';
import {
  DAY3_STORY_CHAPTERS,
  DAY4_STORY_CHAPTERS,
  DAY5_STORY_CHAPTERS,
} from '../src/domain/progression.ts';

const DAYS: [DayIndex, readonly SubGoalStageDef[]][] = [
  [1, SUB_GOAL_STAGES],
  [2, DAY2_SUB_GOAL_STAGES],
  [3, DAY3_SUB_GOAL_STAGES],
  [4, DAY4_SUB_GOAL_STAGES],
  [5, DAY5_SUB_GOAL_STAGES],
];

const ZONES: TapZoneId[] = ['head', 'chest', 'belly', 'legs', 'feet'];

function scan(where: string, line: string, w: Wardrobe): number {
  const why = contradictsWardrobe(line, w);
  if (!why) return 0;
  console.log(`${where} REJECT (${why}) :: ${line.slice(0, 118)}`);
  return 1;
}

function scanPool(where: string, lines: readonly string[] | undefined, w: Wardrobe): [number, number] {
  let bad = 0;
  if (!lines || lines.length === 0) return [0, 0];
  for (const line of lines) bad += scan(where, line, w);
  // A pool where nothing survives is not "safe", it is a silent swap to a canned fallback line.
  const dead = bad === lines.length ? 1 : 0;
  if (dead) console.log(`${where} PICKER FALLBACK: every line rejected`);
  return [bad, dead];
}

let bad = 0;
let fallbacks = 0;
let seen = 0;

for (const [day, stages] of DAYS) {
  for (const st of stages) {
    const w = WARDROBES[day][st.stage as SubGoalStageIndex];
    const pools: [string, string][] = [
      ['outfitName', st.outfitName],
      ['storyDesc', st.storyDesc],
      ['unlockLine', st.unlockLine],
      ['removedItem', st.removedItemLabel],
      ...st.shyApproachLines.map((l, i): [string, string] => [`d${day}s${st.stage} shy[${i}]`, l]),
      ...st.chatCascade.map((c, i): [string, string] => [`d${day}s${st.stage} chat[${i}] ${c.author}`, c.text]),
    ];
    for (const [where, line] of pools) {
      if (!line) continue;
      seen++;
      bad += scan(where, line, w);
    }
    const zoneLines =
      day === 2
        ? DAY2_STAGE_ZONE_LINES
        : day === 3
          ? DAY3_STAGE_ZONE_LINES
          : day === 4
            ? DAY4_STAGE_ZONE_LINES
            : day === 5
              ? DAY5_STAGE_ZONE_LINES
              : null;
    if (zoneLines) {
      const per = (zoneLines as Record<SubGoalStageIndex, Partial<Record<TapZoneId, readonly string[]>>>)[
        st.stage as SubGoalStageIndex
      ];
      for (const zone of ZONES) {
        const [b, f] = scanPool(`d${day}s${st.stage} zone:${zone}`, per?.[zone], w);
        seen += per?.[zone]?.length ?? 0;
        bad += b;
        fallbacks += f;
      }
    }
    const idle =
      day === 2
        ? DAY2_IDLE_BY_STAGE[st.stage]
        : day === 3
          ? DAY3_IDLE_BY_STAGE[st.stage]
          : day === 4
            ? DAY4_IDLE_BY_STAGE[st.stage]
            : day === 5
              ? DAY5_IDLE_BY_STAGE[st.stage]
              : undefined;
    const [b, f] = scanPool(`d${day}s${st.stage} idle`, idle, w);
    seen += idle?.length ?? 0;
    bad += b;
    fallbacks += f;
    if (day === 3) {
      const amb = AMBIENT_DAY3_BY_STAGE[st.stage];
      const [ab, af] = scanPool(`d3s${st.stage} ambientChat`, amb, w);
      seen += amb?.length ?? 0;
      bad += ab;
      fallbacks += af;
    }
    if (day === 4) {
      // Yoga day: the viewers talk about the kit and the poses, so their copy is audited too.
      const pools4: [string, readonly string[] | undefined][] = [
        [`d4s${st.stage} ambientChat`, AMBIENT_DAY4_BY_STAGE[st.stage as SubGoalStageIndex]],
        ...ZONES.map(
          (z): [string, readonly string[]] => [`d4s${st.stage} burst:${z}`, ZONE_CHAT_REACTIONS_DAY4[z]],
        ),
        ...ZONES.map(
          (z): [string, readonly string[]] => [`d4s${st.stage} clip:${z}`, VIRAL_CLIP_TITLES_DAY4[z]],
        ),
        [`d4s${st.stage} donationTts`, DONATION_TTS_LINES_DAY4],
        [`d4s${st.stage} herTaps`, Object.values(DAY4_TAP_LINES).flat()],
      ];
      for (const [where, pool] of pools4) {
        const [b, f] = scanPool(where, pool, w);
        seen += pool?.length ?? 0;
        bad += b;
        fallbacks += f;
      }
    }
    if (day === 5) {
      // Bikini day: the same sweep, because the chat pushes her further while the costume never moves.
      const pools5: [string, readonly string[] | undefined][] = [
        [`d5s${st.stage} ambientChat`, AMBIENT_DAY5_BY_STAGE[st.stage as SubGoalStageIndex]],
        ...ZONES.map(
          (z): [string, readonly string[]] => [`d5s${st.stage} burst:${z}`, ZONE_CHAT_REACTIONS_DAY5[z]],
        ),
        ...ZONES.map(
          (z): [string, readonly string[]] => [`d5s${st.stage} clip:${z}`, VIRAL_CLIP_TITLES_DAY5[z]],
        ),
        [`d5s${st.stage} donationTts`, DONATION_TTS_LINES_DAY5],
        [`d5s${st.stage} herTaps`, Object.values(DAY5_TAP_LINES).flat()],
      ];
      for (const [where, pool] of pools5) {
        const [b, f] = scanPool(where, pool, w);
        seen += pool?.length ?? 0;
        bad += b;
        fallbacks += f;
      }
    }
  }
}

// Day-level lines: checked against the stage-4 wardrobe, which is what is on screen when they play.
for (const [day, lines] of [
  [2, [...DAY2_OPENING_LINE.split('\n'), ...DAY2_FAREWELL_LINES]],
  [3, [DAY3_OPENING_LINE, ...DAY3_FAREWELL_LINES, ...GHOST_BOO_LINES]],
  [4, [DAY4_OPENING_LINE, ...DAY4_FAREWELL_LINES, ...DAY4_DONE_LINES, ...AMBIENT_DAY4]],
  [5, [DAY5_OPENING_LINE, ...DAY5_FAREWELL_LINES, ...AMBIENT_DAY5]],
] as [DayIndex, string[]][]) {
  for (const line of lines) {
    if (!line.trim()) continue;
    seen++;
    bad += scan(`d${day} daylines`, line, WARDROBES[day][4]);
  }
}

// The story panel is keyed to boldness, so its copy has to survive every plate of its day.
for (const [day, chapters] of [
  [3, DAY3_STORY_CHAPTERS],
  [4, DAY4_STORY_CHAPTERS],
  [5, DAY5_STORY_CHAPTERS],
] as [DayIndex, readonly { headline: string; diaryThought: string }[]][]) {
  for (const ch of chapters) {
    for (let stage = 0; stage <= 4; stage++) {
      const w = WARDROBES[day][stage as SubGoalStageIndex];
      for (const text of [ch.headline, ch.diaryThought]) {
        seen++;
        bad += scan(`d${day} story s${stage}`, text, w);
      }
    }
  }
}

console.log(`\nlines checked: ${seen}`);
console.log(`rejects: ${bad}, picker fallbacks: ${fallbacks}`);
if (bad > 0) process.exitCode = 1;

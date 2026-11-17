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
import { SUB_GOAL_STAGES, DAY2_SUB_GOAL_STAGES, DAY3_SUB_GOAL_STAGES } from '../src/domain/subGoals.ts';
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
  GHOST_BOO_LINES,
} from '../src/domain/dialogue.ts';
import type { SubGoalStageDef, SubGoalStageIndex, TapZoneId } from '../src/domain/types.ts';
import { AMBIENT_DAY3_BY_STAGE } from '../src/chat/chatEngine.ts';

const DAYS: [DayIndex, readonly SubGoalStageDef[]][] = [
  [1, SUB_GOAL_STAGES],
  [2, DAY2_SUB_GOAL_STAGES],
  [3, DAY3_SUB_GOAL_STAGES],
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
      day === 2 ? DAY2_STAGE_ZONE_LINES : day === 3 ? DAY3_STAGE_ZONE_LINES : null;
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
    const idle = day === 2 ? DAY2_IDLE_BY_STAGE[st.stage] : day === 3 ? DAY3_IDLE_BY_STAGE[st.stage] : undefined;
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
  }
}

// Day-level lines: checked against the stage-4 wardrobe, which is what is on screen when they play.
for (const [day, lines] of [
  [2, [...DAY2_OPENING_LINE.split('\n'), ...DAY2_FAREWELL_LINES]],
  [3, [DAY3_OPENING_LINE, ...DAY3_FAREWELL_LINES, ...GHOST_BOO_LINES]],
] as [DayIndex, string[]][]) {
  for (const line of lines) {
    if (!line.trim()) continue;
    seen++;
    bad += scan(`d${day} daylines`, line, WARDROBES[day][4]);
  }
}

console.log(`\nlines checked: ${seen}`);
console.log(`rejects: ${bad}, picker fallbacks: ${fallbacks}`);
if (bad > 0) process.exitCode = 1;

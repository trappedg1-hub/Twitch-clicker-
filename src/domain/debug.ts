import {
  buyUpgrade,
  debugSetSubscribers,
  isDay1FinaleReached,
  isDay2FinaleReached,
  isDay3FinaleReached,
  selectDisplayedSubStage,
  startDay2,
  startDay3,
  startDay4,
  isDay4FinaleReached,
  startDay5,
  startDay6,
  isDay5FinaleReached,
} from './engine.ts';
import {
  dayFinaleSubs,
  getSubGoalStagesForDay,
  isDay3Unlocked,
  isDay4Unlocked,
  isDay5Unlocked,
  isDay6Unlocked,
} from './subGoals.ts';
import { TIER1_UPGRADES, getUpgradeCost } from './upgrades.ts';
import type { GameState, SubGoalStageIndex } from './types.ts';

/**
 * Debug jumps behind the admin panel — the «do not make me grind this again» API.
 *
 * Every jump goes through the real gates: `debugSetSubscribers` replays the Sub Goal ladder of the
 * current day, and the day changes are the very `startDay2`/`startDay3` the finale card uses. So a
 * jumped-to state is a state a legit run also passes through — same plates, same wardrobe flags, same
 * income multipliers, same carry-over of money, upgrades and boldness. Only the grinding is skipped.
 * That is the whole point: a panel that invents unreachable states is how an art bug ships unseen.
 */

export const ADMIN_MAX_DAY = 6;

/** Subscribers that close `day` — its last ladder step, which is also the gate into the next day. */
export function finaleSubsForDay(day: number): number {
  return dayFinaleSubs(day);
}

/** Subscribers a given stage needs on a given day (0 = the day's opening plate). */
export function subsToReach(day: number, stage: SubGoalStageIndex): number {
  return getSubGoalStagesForDay(day)[stage]?.subsRequired ?? 0;
}

export interface DebugOutcome {
  state: GameState;
  /** Why the jump stopped short; `null` means it landed exactly where it was asked to. */
  note: string | null;
}

/**
 * Land on `stage` of `day`. Forward jumps pay each skipped finale so the carry-over runs for real;
 * a backward jump re-enters the earlier ladder and leaves money and upgrades alone, which is what you
 * want while comparing one day's plate against another's.
 */
export function debugGotoDayStage(
  state: GameState,
  day: number,
  stage: SubGoalStageIndex = 0,
): DebugOutcome {
  const target = Math.max(1, Math.min(ADMIN_MAX_DAY, Math.floor(day)));
  let cur = state;
  let note: string | null = null;

  if (cur.streamDay > target) {
    // Rewind: this day's ladder decides the wardrobe again, so the stage counters restart.
    cur = { ...cur, streamDay: target, unlockedSubStage: 0, displayedSubStage: 0 };
  }
  while (cur.streamDay < target) {
    if (cur.streamDay === 1) {
      if (!isDay1FinaleReached(cur)) cur = debugSetSubscribers(cur, finaleSubsForDay(1));
      const res = startDay2(cur);
      if (!res.ok) {
        note = 'День 2 не открылся: финал дня 1 не достигнут';
        break;
      }
      cur = res.state;
      continue;
    }
    if (cur.streamDay === 2) {
      if (!isDay2FinaleReached(cur)) cur = debugSetSubscribers(cur, finaleSubsForDay(2));
      if (!isDay3Unlocked()) {
        note = 'День 3 закрыт: косплей-арты ещё не в сборке';
        break;
      }
      const res = startDay3(cur);
      if (!res.ok) {
        note = 'День 3 не открылся: финал дня 2 не достигнут';
        break;
      }
      cur = res.state;
      continue;
    }
    if (cur.streamDay === 3) {
      if (!isDay3FinaleReached(cur)) cur = debugSetSubscribers(cur, finaleSubsForDay(3));
      if (!isDay4Unlocked()) {
        note = 'День 4 закрыт: йога-арты ещё не в сборке';
        break;
      }
      const res = startDay4(cur);
      if (!res.ok) {
        note = 'День 4 не открылся: финал дня 3 не достигнут';
        break;
      }
      cur = res.state;
      continue;
    }
    if (cur.streamDay === 4) {
      if (!isDay4FinaleReached(cur)) cur = debugSetSubscribers(cur, finaleSubsForDay(4));
      if (!isDay5Unlocked()) {
        note = 'День 5 закрыт: бикини-арты ещё не в сборке';
        break;
      }
      const res = startDay5(cur);
      if (!res.ok) {
        note = 'День 5 не открылся: финал дня 4 не достигнут';
        break;
      }
      cur = res.state;
      continue;
    }
    if (cur.streamDay === 5) {
      if (!isDay5FinaleReached(cur)) cur = debugSetSubscribers(cur, finaleSubsForDay(5));
      if (!isDay6Unlocked()) { note = 'День 6 закрыт: арты ещё не загружены'; break; }
      const res = startDay6(cur);
      if (!res.ok) { note = 'День 6 не открылся'; break; }
      cur = res.state;
      continue;
    }
    break;
  }

  // A day opens with the subscribers the previous day ended on — `startDay2`/`startDay3` carry the
  // counter over, so a jump must not zero it, or the panel would land in a state no run ever sees.
  const carriedFloor = target > 1 ? finaleSubsForDay(target - 1) + 1 : 0;
  cur = debugSetSubscribers(cur, Math.max(subsToReach(target, stage), carriedFloor));
  // selectDisplayedSubStage is the game's own "you never wear what you did not pay for" gate.
  cur = selectDisplayedSubStage(cur, stage).state;
  return { state: cur, note };
}

/**
 * «Max the shop»: fund exactly what is outstanding and buy it through `buyUpgrade`, so the boldness
 * bonuses, the hype kick and the viewer milestones arrive the way a player gets them.
 */
export function debugMaxOutShop(state: GameState): { state: GameState; spent: number; levels: number } {
  let outstanding = 0;
  for (const def of TIER1_UPGRADES) {
    let level = state.upgrades[def.id] ?? 0;
    while (level < def.maxLevel) {
      outstanding += getUpgradeCost(def, level);
      level += 1;
    }
  }
  let cur = { ...state, balance: state.balance + outstanding, totalEarned: state.totalEarned + outstanding };
  let spent = 0;
  let levels = 0;
  for (const def of TIER1_UPGRADES) {
    while ((cur.upgrades[def.id] ?? 0) < def.maxLevel) {
      const res = buyUpgrade(cur, def.id);
      if (!res.ok) break;
      cur = res.state;
      spent += res.cost;
      levels += 1;
    }
  }
  return { state: cur, spent, levels };
}

/** hype and boldness are 0..100 everywhere in the game, so the panel edits them as clamped numbers. */
export function debugSetBars(state: GameState, hype: number, boldness: number): GameState {
  const clamp = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
  return { ...state, hype: clamp(hype), boldness: clamp(boldness) };
}

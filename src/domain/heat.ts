/**
 * HEAT — the chat's pressure on Miya.
 *
 * The shipped chat only comments. This module makes it *push*: the audience proposes a dare,
 * votes and donations build pressure, and the dare resolves into either a refusal (which is
 * still content — her fluster, the chat teasing her, pressure keeps climbing) or compliance
 * (a payoff: hype, viewers, boldness, sometimes a new sub-goal stage).
 *
 * Design rules honoured here:
 *  - Deterministic. No Math.random; the caller passes the numbers. Every branch is testable.
 *  - Wardrobe-honest. A dare carries `requiresStage`; it is never proposed on a plate that
 *    cannot truthfully show it (same spirit as `contradictsWardrobe` in `wardrobe.ts`).
 *  - Refusal is not a dead turn. It pays `refusePressure`, so the loop always moves forward.
 */

import type { SubGoalStageIndex, TapZoneId } from "./types.ts";

export type DarePhase = "idle" | "proposed" | "resolved";

export type DareOutcome = "comply" | "refuse";

export interface DarePayout {
  hype: number;
  boldness: number;
  viewers: number;
}

export interface DareDef {
  id: string;
  /** Only offered on this stream day. */
  day: number;
  /** What the chat chants when it proposes. */
  ask: string;
  /** Which body region the camera is supposed to get closer to. */
  zone: TapZoneId;
  /** `boldness + pressure` must reach this for her to actually do it. */
  resist: number;
  /** Votes needed before this dare may become the active one. */
  voteGate: number;
  /** Minimum wardrobe stage on which the comply line is truthful. */
  requiresStage: SubGoalStageIndex;
  payout: DarePayout;
  /** Pressure gained when she refuses — the refusal must still move the loop. */
  refusePressure: number;
  complyLine: string;
  refuseLine: string;
}

export interface HeatState {
  /** 0..100. Shown in the HUD, cools down between dares. */
  heat: number;
  activeDareId: string | null;
  phase: DarePhase;
  /** Votes collected toward the active (or next) dare. */
  votes: number;
  /** Money pledged toward the active dare, in the game's balance units. */
  donations: number;
  totalResolved: number;
  lastOutcome: DareOutcome | null;
  /** Ids already paid out — a dare never pays twice in one day. */
  served: string[];
}

export const HEAT_MAX = 100;
export const HEAT_DECAY_PER_SEC = 0.45;
/** One vote is worth this much pressure. */
export const VOTE_WEIGHT = 4;
/** One unit of balance pledged is worth this much pressure. */
export const DONATION_WEIGHT = 0.35;

export function createHeatState(): HeatState {
  return {
    heat: 0,
    activeDareId: null,
    phase: "idle",
    votes: 0,
    donations: 0,
    totalResolved: 0,
    lastOutcome: null,
    served: [],
  };
}

/** Day 1 dare ladder. Every line describes a pose or a camera move, never a garment that is absent. */
export const DAY1_DARES: readonly DareDef[] = [
  {
    id: "d1_lean_in",
    day: 1,
    ask: "Мия, наклонись к вебке, мы тебя не слышим!!",
    zone: "head",
    resist: 10,
    voteGate: 3,
    requiresStage: 0,
    payout: { hype: 6, boldness: 3, viewers: 4 },
    refusePressure: 2,
    complyLine: "Ладно-ладно... вот так ближе? Я вас слышу, не кричите~",
    refuseLine: "Н-не так близко! Я и отсюда нормально слышу...",
  },
  {
    id: "d1_show_socks",
    day: 1,
    ask: "покажи носочки крупным планом, это же твой бренд!",
    zone: "feet",
    resist: 18,
    voteGate: 5,
    requiresStage: 0,
    payout: { hype: 8, boldness: 4, viewers: 5 },
    refusePressure: 3,
    complyLine: "Вот, смотрите... полосочки на месте. Довольны? :peepoShy:",
    refuseLine: "Носочки не для крупного плана!.. хотя ладно, потом.",
  },
  {
    id: "d1_stretch",
    day: 1,
    ask: "потянись, чат просит, ну пожалуйста!!",
    zone: "chest",
    resist: 26,
    voteGate: 8,
    requiresStage: 2,
    payout: { hype: 11, boldness: 5, viewers: 7 },
    refusePressure: 4,
    complyLine: "А-ах... засиделась. Только не смотрите так, я же вижу~",
    refuseLine: "Ещё чего, я не по этой части... сегодня.",
  },
  {
    id: "d1_hair_flip",
    day: 1,
    ask: "убери чёлку, хотим видеть глаза!!",
    zone: "head",
    resist: 34,
    voteGate: 10,
    requiresStage: 1,
    payout: { hype: 12, boldness: 6, viewers: 8 },
    refusePressure: 5,
    complyLine: "Вот... всё видно. И румянец тоже видно, спасибо, чат.",
    refuseLine: "Глаза — это личное!.. ну, почти.",
  },
  {
    id: "d1_cross_legs",
    day: 1,
    ask: "сядь по-другому, как в рекламе!!",
    zone: "legs",
    resist: 44,
    voteGate: 14,
    requiresStage: 3,
    payout: { hype: 16, boldness: 7, viewers: 11 },
    refusePressure: 6,
    complyLine: "Так? Ноги затекли, а вам лишь бы ракурс...",
    refuseLine: "Я сижу как мне удобно. Пока удобно.",
  },
  {
    id: "d1_name_price",
    day: 1,
    ask: "скажи вслух, сколько сабов стоит следующий шаг!!",
    zone: "chest",
    resist: 56,
    voteGate: 20,
    requiresStage: 3,
    payout: { hype: 20, boldness: 9, viewers: 14 },
    refusePressure: 7,
    complyLine: "Пятьсот. Пятьсот сабов — и я сама решу, что это будет~",
    refuseLine: "Я не торгуюсь... я пока не торгуюсь.",
  },
] as const;

/** Pressure currently banked toward the active dare. */
export function currentPressure(state: HeatState): number {
  return state.votes * VOTE_WEIGHT + state.donations * DONATION_WEIGHT;
}

/** The highest dare the audience has already voted open and that the plate can honour. */
export function pickDare(
  day: number,
  stage: SubGoalStageIndex,
  votes: number,
  served: readonly string[],
  catalogue: readonly DareDef[] = DAY1_DARES,
): DareDef | null {
  let best: DareDef | null = null;
  for (const dare of catalogue) {
    if (dare.day !== day) continue;
    if (served.includes(dare.id)) continue;
    if (dare.requiresStage > stage) continue;
    if (votes < dare.voteGate) continue;
    if (!best || dare.voteGate > best.voteGate) best = dare;
  }
  return best;
}

/**
 * One tick of the loop. Called on a timer, not per frame.
 *
 * Returns the new state plus, when a dare opens, the dare so the UI can render the chant.
 */
export function advanceHeat(
  state: HeatState,
  input: { day: number; stage: SubGoalStageIndex; votes: number; donations: number; dtSec: number },
  catalogue: readonly DareDef[] = DAY1_DARES,
): { state: HeatState; opened: DareDef | null } {
  const next: HeatState = { ...state };

  next.votes = Math.max(0, next.votes + input.votes);
  next.donations = Math.max(0, next.donations + input.donations);
  next.heat = clamp(next.heat - HEAT_DECAY_PER_SEC * Math.max(0, input.dtSec));

  const addedPressure =
    Math.max(0, input.votes) * VOTE_WEIGHT + Math.max(0, input.donations) * DONATION_WEIGHT;
  next.heat = clamp(next.heat + addedPressure * 0.25);

  let opened: DareDef | null = null;
  if (next.phase === "idle") {
    const dare = pickDare(input.day, input.stage, next.votes, next.served, catalogue);
    if (dare) {
      next.activeDareId = dare.id;
      next.phase = "proposed";
      // The gate is SPENT to put the dare on the table. If it also counted as resolution
      // pressure, every dare would open already satisfied and she would comply for free.
      // From here the chat has to push again — and her boldness is what decides.
      next.votes = 0;
      next.donations = 0;
      opened = dare;
    }
  }
  return { state: next, opened };
}

export function resolveDare(
  state: HeatState,
  input: { boldness: number; catalogue?: readonly DareDef[] },
): { state: HeatState; outcome: DareOutcome; dare: DareDef | null; payout: DarePayout; line: string } {
  const catalogue = input.catalogue ?? DAY1_DARES;
  const dare = catalogue.find((d) => d.id === state.activeDareId) ?? null;
  if (!dare || state.phase !== "proposed") {
    return {
      state,
      outcome: "refuse",
      dare: null,
      payout: { hype: 0, boldness: 0, viewers: 0 },
      line: "",
    };
  }

  const pressure = currentPressure(state);
  const complies = input.boldness + pressure >= dare.resist;

  if (complies) {
    const next: HeatState = {
      ...state,
      phase: "idle",
      activeDareId: null,
      votes: 0,
      donations: 0,
      heat: clamp(state.heat + 12),
      totalResolved: state.totalResolved + 1,
      lastOutcome: "comply",
      served: [...state.served, dare.id],
    };
    return { state: next, outcome: "comply", dare, payout: dare.payout, line: dare.complyLine };
  }

  // A refusal keeps the same dare on the table and feeds the pressure that will unlock it.
  const next: HeatState = {
    ...state,
    phase: "idle",
    activeDareId: null,
    votes: 0,
    donations: 0,
    heat: clamp(state.heat + dare.refusePressure),
    totalResolved: state.totalResolved + 1,
    lastOutcome: "refuse",
  };
  return {
    state: next,
    outcome: "refuse",
    dare,
    payout: { hype: 2, boldness: 1, viewers: 1 },
    line: dare.refuseLine,
  };
}

function clamp(v: number, min = 0, max = HEAT_MAX): number {
  return Math.max(min, Math.min(max, Number(v.toFixed(2))));
}

import { type DialogueBand, pickDialogueLine, pickIdleTeaseLine } from './dialogue.ts';
import { getStoryChapter, STREAM_CHALLENGES } from './progression.ts';
import {
  DAY1_FINALE_SUBS,
  DAY3_FINALE_SUBS,
  DAY4_FINALE_SUBS,
  DAY5_FINALE_SUBS,
  isDay5Unlocked,
  isDay6Unlocked,
  isDay4Unlocked,
  isDay3Unlocked,
  getGiftSubPackCost,
  getGiftSubUnitCost,
  getNextSubGoalDef,
  getSubGoalStagesForDay,
  getSubGoalStageForSubs,
} from './subGoals.ts';
import type {
  ChallengeId,
  ComputedStats,
  GameState,
  MilestoneDef,
  SubGoalStageDef,
  SubGoalStageIndex,
  TapOutcome,
  TapZoneId,
  UpgradeId,
} from './types.ts';
import { getUpgradeCost, TIER1_MILESTONES, TIER1_UPGRADES, UPGRADE_MAP } from './upgrades.ts';

export const SAVE_STORAGE_KEY = 'twitch_clicker_save_v4';

const ZONE_CLICK_BONUS_MULT: Record<TapZoneId, number> = {
  head: 1.0,
  chest: 1.3,
  belly: 1.2,
  legs: 1.2,
  feet: 1.25,
};

export function createInitialState(nowMs = Date.now()): GameState {
  return {
    streamDay: 1,
    carriedOverWardrobeStage: 0,
    balance: 0,
    totalEarned: 0,
    totalTaps: 0,
    hype: 0,
    boldness: 0,
    subscribers: 0,
    organicSubProgress: 0,
    unlockedSubStage: 0,
    displayedSubStage: 0,
    challengeCooldownUntilMs: {},
    upgrades: {
      ring_lamp: 0,
      usb_mic_pop: 0,
      obs_alerts: 0,
      webcam_focus: 0,
      chat_emotes: 0,
      clips_boost: 0,
      desk_mic: 0,
    },
    unlockedMilestones: [],
    lastTickMs: nowMs,
    peakViewers: 3,
  };
}

export function computeStats(state: GameState): ComputedStats {
  let baseClick = 5;
  let passivePerSec = 0;
  let upgradeViewers = 0;
  let upgradeBoldnessFloor = 0;

  for (const def of TIER1_UPGRADES) {
    const lvl = state.upgrades[def.id] ?? 0;
    if (lvl > 0) {
      baseClick += def.clickBonus * lvl;
      passivePerSec += def.passivePerSec * lvl;
      upgradeViewers += def.viewersBonus * lvl;
      upgradeBoldnessFloor += def.boldnessBonus * Math.min(lvl, 3);
    }
  }

  // Economy always rewards the highest unlocked Sub Goal stage even if re-wearing an earlier layer.
  // Day 2 climbs its OWN ladder (1500/2000/2500/5000), so both lookups are day-aware.
  const dayLadder = getSubGoalStagesForDay(state.streamDay);
  const unlockedStageDef = dayLadder[state.unlockedSubStage] ?? dayLadder[0]!;
  const currentSubStageDef = dayLadder[state.displayedSubStage] ?? unlockedStageDef;
  const nextSubGoalDef = getNextSubGoalDef(state.unlockedSubStage, state.streamDay);
  const outfitMult = unlockedStageDef.incomeMultiplier;

  const effectiveBoldness = Math.max(
    0,
    Math.min(100, Number(Math.max(state.boldness, upgradeBoldnessFloor * 0.5).toFixed(1))),
  );
  const boldnessMult = 1 + (effectiveBoldness / 100) * 0.65;
  const clampedHype = Math.max(0, Math.min(100, state.hype));
  const hypeMultiplier = Number((1 + (clampedHype / 100) * 1.0).toFixed(2));

  const hypeViewers = Math.floor((clampedHype / 100) * (4 + Math.sqrt(upgradeViewers + 1) * 2.5));
  const boldnessViewers = Math.floor((effectiveBoldness / 100) * 22);
  const tapOrganicViewers = Math.min(14, Math.floor(state.totalTaps / 16));
  const subViewers = unlockedStageDef.viewersBonus + Math.floor(state.subscribers * 0.12);

  const onlineViewers = Math.max(
    3,
    3 + upgradeViewers + hypeViewers + boldnessViewers + tapOrganicViewers + subViewers,
  );

  const storyChapter = getStoryChapter(effectiveBoldness, state.streamDay);
  const dialogueBand: DialogueBand = storyChapter.stage;

  const nextMilestone =
    TIER1_MILESTONES.find((m) => !state.unlockedMilestones.includes(m.id)) ?? null;

  return {
    clickIncome: Math.max(1, Math.round(baseClick * hypeMultiplier * boldnessMult * outfitMult)),
    passivePerSec: Number(
      (passivePerSec * (1 + (clampedHype / 100) * 0.35) * boldnessMult * outfitMult).toFixed(1),
    ),
    onlineViewers,
    hypeMultiplier,
    boldness: effectiveBoldness,
    storyChapter,
    dialogueBand,
    nextMilestone,
    currentSubStageDef,
    nextSubGoalDef,
    giftSubUnitCost: getGiftSubUnitCost(state.subscribers),
  };
}

function checkMilestones(
  state: GameState,
  viewers: number,
): {
  unlockedIds: string[];
  newlyUnlocked: MilestoneDef[];
} {
  const unlockedIds = [...state.unlockedMilestones];
  const newlyUnlocked: MilestoneDef[] = [];
  for (const m of TIER1_MILESTONES) {
    if (viewers >= m.viewersRequired && !unlockedIds.includes(m.id)) {
      unlockedIds.push(m.id);
      newlyUnlocked.push(m);
    }
  }
  return { unlockedIds, newlyUnlocked };
}

function resolveSubGoalUnlocks(state: GameState): {
  state: GameState;
  newlyUnlockedSubStages: SubGoalStageDef[];
} {
  const dayLadder = getSubGoalStagesForDay(state.streamDay);
  // Day 1: the carried-over wardrobe floor keeps earlier stages unlocked. Day 2 re-earns its
  // own stages from scratch (she starts dressed, then strips at 1500 / 2000 / 2500 / 5000).
  const carriedFloor = state.streamDay === 1 ? (state.carriedOverWardrobeStage ?? 0) : 0;
  const targetStage = Math.max(
    getSubGoalStageForSubs(state.subscribers, state.streamDay),
    carriedFloor,
  ) as SubGoalStageIndex;
  if (targetStage <= state.unlockedSubStage) {
    return { state, newlyUnlockedSubStages: [] };
  }

  const newlyUnlockedSubStages: SubGoalStageDef[] = [];
  let addedBoldness = 0;
  for (let s = (state.unlockedSubStage + 1) as SubGoalStageIndex; s <= targetStage; s = (s + 1) as SubGoalStageIndex) {
    const def = dayLadder[s];
    if (def) {
      newlyUnlockedSubStages.push(def);
      addedBoldness += def.boldnessBonus;
    }
    if (s === 4) break;
  }

  const nextState: GameState = {
    ...state,
    unlockedSubStage: targetStage,
    displayedSubStage: targetStage, // Automatically strips down to the newly unlocked stage!
    boldness: Math.min(100, Number((state.boldness + addedBoldness).toFixed(2))),
    hype: 100,
  };

  return { state: nextState, newlyUnlockedSubStages };
}

/**
 * QA/debug helper: jump the subscriber counter straight to `subs` and replay Sub Goal
 * unlocks for the CURRENT day's ladder. Not used by gameplay (gifts go through buyGiftSubs).
 */
export function debugSetSubscribers(state: GameState, subs: number): GameState {
  const next: GameState = { ...state, subscribers: Math.max(0, Math.floor(subs)) };
  return resolveSubGoalUnlocks(next).state;
}

export function applyTap(
  state: GameState,
  zone: TapZoneId,
  nowMs = Date.now(),
): TapOutcome {
  const nextHype = Math.min(100, state.hype + 6.5);
  const boldnessStep = zone === 'chest' || zone === 'feet' ? 0.45 : 0.3;
  const nextBoldness = Math.min(100, Number((state.boldness + boldnessStep).toFixed(2)));
  const nextTaps = state.totalTaps + 1;

  // Excited viewers organically subscribe every 10 taps once hype builds up!
  const gainedOrganicSubs = nextTaps % 10 === 0 && nextHype >= 24 ? 1 : 0;

  const preState: GameState = {
    ...state,
    hype: nextHype,
    boldness: nextBoldness,
    totalTaps: nextTaps,
    subscribers: state.subscribers + gainedOrganicSubs,
    lastTickMs: nowMs,
  };

  const subResolved = resolveSubGoalUnlocks(preState);
  const workingState = subResolved.state;

  const stats = computeStats(workingState);
  const zoneMult = ZONE_CLICK_BONUS_MULT[zone] ?? 1.0;
  const triggeredDonationAlert = workingState.totalTaps % 12 === 0;
  const alertMult = triggeredDonationAlert ? 3.0 : 1.0;
  const earned = Math.max(1, Math.round(stats.clickIncome * zoneMult * alertMult));

  const { unlockedIds, newlyUnlocked } = checkMilestones(workingState, stats.onlineViewers);
  const finalState: GameState = {
    ...workingState,
    balance: Number((workingState.balance + earned).toFixed(2)),
    totalEarned: Number((workingState.totalEarned + earned).toFixed(2)),
    unlockedMilestones: unlockedIds,
    peakViewers: Math.max(workingState.peakViewers, stats.onlineViewers),
  };

  const latestStageUnlock =
    subResolved.newlyUnlockedSubStages[subResolved.newlyUnlockedSubStages.length - 1];
  const line = latestStageUnlock
    ? latestStageUnlock.unlockLine
    : pickDialogueLine(zone, stats.dialogueBand, finalState.totalTaps, finalState.displayedSubStage, finalState.streamDay);

  return {
    state: finalState,
    earned,
    zone,
    line,
    triggeredDonationAlert,
    gainedOrganicSubs,
    newlyUnlockedSubStages: subResolved.newlyUnlockedSubStages,
    newlyUnlockedMilestones: newlyUnlocked,
  };
}

export function buyGiftSubs(
  state: GameState,
  /** Any pack size: 1 (single), or 5 / 25 / 50 / 100 from the gift-sub picker. */
  count: number,
): {
  ok: boolean;
  state: GameState;
  cost: number;
  addedSubs: number;
  newlyUnlockedSubStages: SubGoalStageDef[];
  newlyUnlockedMilestones: MilestoneDef[];
} {
  const cost = getGiftSubPackCost(state.subscribers, count);
  if (state.balance < cost) {
    return {
      ok: false,
      state,
      cost,
      addedSubs: 0,
      newlyUnlockedSubStages: [],
      newlyUnlockedMilestones: [],
    };
  }

  const preState: GameState = {
    ...state,
    balance: Number((state.balance - cost).toFixed(2)),
    subscribers: state.subscribers + count,
    hype: Math.min(100, state.hype + Math.min(35, count * 6)),
    boldness: Math.min(100, Number((state.boldness + Math.min(4, count * 0.35)).toFixed(2))),
  };

  const subResolved = resolveSubGoalUnlocks(preState);
  const afterStats = computeStats(subResolved.state);
  const { unlockedIds, newlyUnlocked } = checkMilestones(
    subResolved.state,
    afterStats.onlineViewers,
  );

  return {
    ok: true,
    cost,
    addedSubs: count,
    newlyUnlockedSubStages: subResolved.newlyUnlockedSubStages,
    newlyUnlockedMilestones: newlyUnlocked,
    state: {
      ...subResolved.state,
      unlockedMilestones: unlockedIds,
      peakViewers: Math.max(subResolved.state.peakViewers, afterStats.onlineViewers),
    },
  };
}

export function selectDisplayedSubStage(
  state: GameState,
  stage: SubGoalStageIndex,
): { ok: boolean; state: GameState } {
  if (stage < 0 || stage > state.unlockedSubStage) {
    return { ok: false, state };
  }
  return {
    ok: true,
    state: {
      ...state,
      displayedSubStage: stage,
    },
  };
}

export function isDay1FinaleReached(state: GameState): boolean {
  return state.streamDay === 1 && state.subscribers >= DAY1_FINALE_SUBS;
}

/**
 * Start Day 2 (only after the Day 1 farewell finishes): ALL Day 1 upgrades (incl. desk
 * microphone tier), unlocked wardrobe, balance and boldness carry over permanently.
 * The carried stage stays unlocked, but Miya changes into her Day 2 costume plate
 * (oversize beige hoodie + shorts + black golf socks with two white stripes).
 */
export function startDay2(state: GameState): { ok: boolean; state: GameState } {
  if (!isDay1FinaleReached(state)) {
    return { ok: false, state };
  }
  const carried = Math.max(
    state.carriedOverWardrobeStage ?? 0,
    state.unlockedSubStage,
  ) as SubGoalStageIndex;
  return {
    ok: true,
    state: {
      ...state,
      streamDay: 2,
      carriedOverWardrobeStage: carried,
      // Day 2 has its own Sub Goal ladder, so wardrobe progress restarts at stage 0 while
      // balance, upgrades (mic tier!), items and boldness stay exactly where Day 1 left them.
      unlockedSubStage: 0,
      displayedSubStage: 0, // Day 2 opens fully dressed again — in the Day 2 wardrobe plate!
      hype: 100,
    },
  };
}

/** Day 2 is over once her own 5000-sub ladder is fully paid off. */
export function isDay2FinaleReached(state: GameState): boolean {
  return state.streamDay === 2 && state.subscribers >= 5000;
}

/**
 * Start Day 3 = COSPLAY DAY (locked until the cosplay plates ship): balance, upgrades (mic tier!),
 * items and boldness carry over again, the wardrobe relocks to 0 and she changes into the
 * bunny-cosplay ladder (ears on the hood, white lace top, white golf socks with ribbons).
 */
export function startDay3(state: GameState): { ok: boolean; state: GameState } {
  if (!isDay2FinaleReached(state) || !isDay3Unlocked()) {
    return { ok: false, state };
  }
  const carried = Math.max(
    state.carriedOverWardrobeStage ?? 0,
    state.unlockedSubStage,
  ) as SubGoalStageIndex;
  return {
    ok: true,
    state: {
      ...state,
      streamDay: 3,
      carriedOverWardrobeStage: carried,
      unlockedSubStage: 0,
      displayedSubStage: 0,
      hype: 100,
    },
  };
}

/** Day 3 is over once the cosplay ladder (15000) is fully paid off. */
export function isDay3FinaleReached(state: GameState): boolean {
  return state.streamDay === 3 && state.subscribers >= DAY3_FINALE_SUBS;
}

/**
 * Start Day 4 = YOGA DAY «Растяжка с Мией» (locked until the four yoga plates ship). Same carry-over
 * rules as the other days: balance, upgrades, items and boldness stay, the wardrobe relocks to 0 and
 * she changes into the knit kit. Nothing on this day is taken off - the ladder is the POSE, so the
 * "carried stage" only decides how much of her own history she mentions, not what she wears.
 */
export function startDay4(state: GameState): { ok: boolean; state: GameState } {
  if (!isDay3FinaleReached(state) || !isDay4Unlocked()) {
    return { ok: false, state };
  }
  const carried = Math.max(
    state.carriedOverWardrobeStage ?? 0,
    state.unlockedSubStage,
  ) as SubGoalStageIndex;
  return {
    ok: true,
    state: {
      ...state,
      streamDay: 4,
      carriedOverWardrobeStage: carried,
      unlockedSubStage: 0,
      displayedSubStage: 0,
      hype: 100,
    },
  };
}

/** Day 4 is over once the yoga ladder (26000) is fully paid off. */
export function isDay4FinaleReached(state: GameState): boolean {
  return state.streamDay === 4 && state.subscribers >= DAY4_FINALE_SUBS;
}

/**
 * Start Day 5 = «5 бикини стрим». Same entry rules as the other days: money, upgrades, items and
 * boldness carry over, the wardrobe relocks to 0.
 *
 * The costume gate is different on purpose. On Days 1-2 relocking the wardrobe meant "she put clothes
 * back on"; on Day 5 there is nothing to put back — the micro bikini is the whole outfit and the four
 * approved frames differ only in how close she lets the camera get. So `carriedOverWardrobeStage` here
 * decides only how much of her own history she mentions (the same role it plays on Day 4), and the
 * ladder escalates the POSE. See `WARDROBES[5]`: one row, `bikiniKit`, four identical garment states.
 */
export function startDay5(state: GameState): { ok: boolean; state: GameState } {
  if (!isDay4FinaleReached(state) || !isDay5Unlocked()) {
    return { ok: false, state };
  }
  const carried = Math.max(
    state.carriedOverWardrobeStage ?? 0,
    state.unlockedSubStage,
  ) as SubGoalStageIndex;
  return {
    ok: true,
    state: {
      ...state,
      streamDay: 5,
      carriedOverWardrobeStage: carried,
      unlockedSubStage: 0,
      displayedSubStage: 0,
      hype: 100,
    },
  };
}

export function isDay5FinaleReached(state: GameState): boolean {
  return state.streamDay === 5 && state.subscribers >= DAY5_FINALE_SUBS;
}
export function startDay6(state: GameState): { ok: boolean; state: GameState } {
  if (!isDay5FinaleReached(state) || !isDay6Unlocked()) return { ok: false, state };
  return { ok: true, state: { ...state, streamDay: 6,
    carriedOverWardrobeStage: Math.max(state.carriedOverWardrobeStage ?? 0, state.unlockedSubStage) as SubGoalStageIndex,
    unlockedSubStage: 0, displayedSubStage: 0, hype: 100 } };
}

export function triggerStreamChallenge(
  state: GameState,
  challengeId: ChallengeId,
  nowMs = Date.now(),
): {
  ok: boolean;
  state: GameState;
  reward: number;
  gainedSubs: number;
  line: string;
  chatBurst: string;
  zoneFocus: TapZoneId;
  newlyUnlockedSubStages: SubGoalStageDef[];
  newlyUnlockedMilestones: MilestoneDef[];
} {
  const def = STREAM_CHALLENGES.find((c) => c.id === challengeId);
  if (!def) {
    return {
      ok: false,
      state,
      reward: 0,
      gainedSubs: 0,
      line: '',
      chatBurst: '',
      zoneFocus: 'chest',
      newlyUnlockedSubStages: [],
      newlyUnlockedMilestones: [],
    };
  }
  const preStats = computeStats(state);
  if (preStats.onlineViewers < def.viewersRequired) {
    return {
      ok: false,
      state,
      reward: 0,
      gainedSubs: 0,
      line: '',
      chatBurst: '',
      zoneFocus: def.zoneFocus,
      newlyUnlockedSubStages: [],
      newlyUnlockedMilestones: [],
    };
  }
  const cdUntil = state.challengeCooldownUntilMs[challengeId] ?? 0;
  if (nowMs < cdUntil) {
    return {
      ok: false,
      state,
      reward: 0,
      gainedSubs: 0,
      line: '',
      chatBurst: '',
      zoneFocus: def.zoneFocus,
      newlyUnlockedSubStages: [],
      newlyUnlockedMilestones: [],
    };
  }

  const gainedSubs = challengeId === 'asmr_tease' ? 3 : challengeId === 'tug_tee' ? 2 : 1;
  const reward = Math.max(15, Math.round(preStats.clickIncome * def.instantRewardMult));
  const nextBoldness = Math.min(100, Number((state.boldness + def.boldnessGain).toFixed(2)));
  const updated: GameState = {
    ...state,
    balance: Number((state.balance + reward).toFixed(2)),
    totalEarned: Number((state.totalEarned + reward).toFixed(2)),
    subscribers: state.subscribers + gainedSubs,
    hype: Math.min(100, state.hype + 28),
    boldness: nextBoldness,
    challengeCooldownUntilMs: {
      ...state.challengeCooldownUntilMs,
      [challengeId]: nowMs + def.cooldownSec * 1000,
    },
  };

  const subResolved = resolveSubGoalUnlocks(updated);
  const afterStats = computeStats(subResolved.state);
  const { unlockedIds, newlyUnlocked } = checkMilestones(
    subResolved.state,
    afterStats.onlineViewers,
  );
  const latestUnlock =
    subResolved.newlyUnlockedSubStages[subResolved.newlyUnlockedSubStages.length - 1];

  return {
    ok: true,
    reward,
    gainedSubs,
    line: latestUnlock
      ? latestUnlock.unlockLine
      : subResolved.state.streamDay === 6
        ? pickIdleTeaseLine(subResolved.state.displayedSubStage, challengeId.length, 6)
      : subResolved.state.streamDay === 2
        ? (def.reactionLineDay2 ?? def.reactionLine)
        : subResolved.state.streamDay === 4
        ? (def.reactionLineDay4 ?? def.reactionLine)
        : subResolved.state.streamDay === 5
          ? (def.reactionLineDay5 ?? def.reactionLine)
          : def.reactionLine,
    // Day 4 rewrites the viewers' demand too: the yoga chat asks for a deeper pose, never a strip.
    // Day 4 and Day 5 both rewrite the viewers' demand: neither day has a garment to remove, so the
    // chat asks for a closer pose instead of a strip.
    chatBurst:
      subResolved.state.streamDay === 6
        ? 'Заявка принята, аванс за эфир поступил! :SubHype: :Pog:'
        : subResolved.state.streamDay === 4
        ? (def.chatBurstDay4 ?? def.chatBurst)
        : subResolved.state.streamDay === 5
          ? (def.chatBurstDay5 ?? def.chatBurst)
          : def.chatBurst,
    zoneFocus: def.zoneFocus,
    newlyUnlockedSubStages: subResolved.newlyUnlockedSubStages,
    newlyUnlockedMilestones: newlyUnlocked,
    state: {
      ...subResolved.state,
      unlockedMilestones: unlockedIds,
      peakViewers: Math.max(subResolved.state.peakViewers, afterStats.onlineViewers),
    },
  };
}

/**
 * Uncapped elapsed-ms idle tick: accrues passive rubles AND organic viewer subscriptions.
 */
export function tickEconomy(
  state: GameState,
  elapsedMs: number,
  nowMs = Date.now(),
): {
  state: GameState;
  gainedOrganicSubs: number;
  newlyUnlockedSubStages: SubGoalStageDef[];
  newlyUnlockedMilestones: MilestoneDef[];
} {
  const safeMs = Math.max(0, elapsedMs);
  if (safeMs === 0) {
    return {
      state: { ...state, lastTickMs: nowMs },
      gainedOrganicSubs: 0,
      newlyUnlockedSubStages: [],
      newlyUnlockedMilestones: [],
    };
  }

  const dtSec = safeMs / 1000;
  const stats = computeStats(state);
  const passiveGain = stats.passivePerSec * dtSec;
  const hypeDecay = dtSec * 3.8;
  const nextHype = Math.max(0, state.hype - hypeDecay);

  // Viewers in chat organically subscribe faster when onlineViewers & chat_emotes upgrade grow
  const emoteBoost = 1 + (state.upgrades.chat_emotes ?? 0) * 0.25;
  const subRatePerSec =
    (0.012 + Math.min(0.28, stats.onlineViewers * 0.0014) + (state.hype / 100) * 0.035) *
    emoteBoost;
  const rawSubProgress = state.organicSubProgress + subRatePerSec * dtSec;
  const gainedOrganicSubs = Math.floor(rawSubProgress);
  const remainderSubProgress = Number((rawSubProgress - gainedOrganicSubs).toFixed(4));

  const updated: GameState = {
    ...state,
    balance: Number((state.balance + passiveGain).toFixed(2)),
    totalEarned: Number((state.totalEarned + passiveGain).toFixed(2)),
    subscribers: state.subscribers + gainedOrganicSubs,
    organicSubProgress: remainderSubProgress,
    hype: nextHype,
    lastTickMs: nowMs,
  };

  const subResolved = resolveSubGoalUnlocks(updated);
  const afterStats = computeStats(subResolved.state);
  const { unlockedIds, newlyUnlocked } = checkMilestones(
    subResolved.state,
    afterStats.onlineViewers,
  );

  return {
    state: {
      ...subResolved.state,
      unlockedMilestones: unlockedIds,
      peakViewers: Math.max(subResolved.state.peakViewers, afterStats.onlineViewers),
    },
    gainedOrganicSubs,
    newlyUnlockedSubStages: subResolved.newlyUnlockedSubStages,
    newlyUnlockedMilestones: newlyUnlocked,
  };
}

export function buyUpgrade(
  state: GameState,
  upgradeId: UpgradeId,
): { ok: boolean; state: GameState; cost: number; newlyUnlockedMilestones: MilestoneDef[] } {
  const def = UPGRADE_MAP[upgradeId];
  if (!def) {
    return { ok: false, state, cost: 0, newlyUnlockedMilestones: [] };
  }
  const currentLvl = state.upgrades[upgradeId] ?? 0;
  if (currentLvl >= def.maxLevel) {
    return { ok: false, state, cost: 0, newlyUnlockedMilestones: [] };
  }
  const cost = getUpgradeCost(def, currentLvl);
  if (state.balance < cost) {
    return { ok: false, state, cost, newlyUnlockedMilestones: [] };
  }

  const nextBoldness = Math.min(100, Number((state.boldness + def.boldnessBonus).toFixed(2)));
  const nextState: GameState = {
    ...state,
    balance: Number((state.balance - cost).toFixed(2)),
    hype: Math.min(100, state.hype + 18),
    boldness: nextBoldness,
    upgrades: {
      ...state.upgrades,
      [upgradeId]: currentLvl + 1,
    },
  };

  const nextStats = computeStats(nextState);
  const { unlockedIds, newlyUnlocked } = checkMilestones(nextState, nextStats.onlineViewers);

  return {
    ok: true,
    cost,
    newlyUnlockedMilestones: newlyUnlocked,
    state: {
      ...nextState,
      unlockedMilestones: unlockedIds,
      peakViewers: Math.max(nextState.peakViewers, nextStats.onlineViewers),
    },
  };
}

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeState(raw: string | null, nowMs = Date.now()): GameState {
  if (!raw) return createInitialState(nowMs);
  try {
    const parsed = JSON.parse(raw) as Partial<GameState>;
    const base = createInitialState(nowMs);
    if (typeof parsed.balance !== 'number' || !Number.isFinite(parsed.balance)) {
      return base;
    }
    const upgrades = { ...base.upgrades };
    if (parsed.upgrades && typeof parsed.upgrades === 'object') {
      for (const def of TIER1_UPGRADES) {
        const val = parsed.upgrades[def.id];
        if (typeof val === 'number' && val >= 0) {
          upgrades[def.id] = Math.min(def.maxLevel, Math.floor(val));
        }
      }
    }
    const subscribers = Math.max(0, Math.floor(Number(parsed.subscribers) || 0));
    const rawDay = Number(parsed.streamDay);
    // Day 3 has to survive a reload: dropping it back to Day 1 here meant replaying the whole ladder
    // just to look at one plate again. Note this deliberately does NOT consult isDay3Unlocked() —
    // that flag only turns on after the async art probe resolves, so gating the load on it would
    // throw Day 3 away on every hard reload, which is exactly the bug being fixed.
    const streamDay = rawDay === 6 ? 6 : rawDay === 5 ? 5 : rawDay === 4 ? 4 : rawDay === 3 ? 3 : rawDay === 2 ? 2 : 1;
    const rawCarried = Number(parsed.carriedOverWardrobeStage);
    const carriedOverWardrobeStage: SubGoalStageIndex = (
      Number.isInteger(rawCarried) && rawCarried >= 0 && rawCarried <= 4
        ? rawCarried
        : 0
    ) as SubGoalStageIndex;
    const carriedFloor = streamDay === 1 ? carriedOverWardrobeStage : 0;
    const unlockedSubStage = Math.max(
      getSubGoalStageForSubs(subscribers, streamDay),
      carriedFloor,
    ) as SubGoalStageIndex;
    const rawDisplayed = Number(parsed.displayedSubStage);
    const displayedSubStage: SubGoalStageIndex =
      Number.isInteger(rawDisplayed) && rawDisplayed >= 0 && rawDisplayed <= unlockedSubStage
        ? Math.min(4, rawDisplayed) as SubGoalStageIndex
        : unlockedSubStage;

    return {
      streamDay,
      carriedOverWardrobeStage,
      balance: Math.max(0, parsed.balance),
      totalEarned: Math.max(0, Number(parsed.totalEarned) || 0),
      totalTaps: Math.max(0, Math.floor(Number(parsed.totalTaps) || 0)),
      hype: Math.max(0, Math.min(100, Number(parsed.hype) || 0)),
      boldness: Math.max(0, Math.min(100, Number(parsed.boldness) || 0)),
      subscribers,
      organicSubProgress: Math.max(
        0,
        Math.min(0.9999, Number(parsed.organicSubProgress) || 0),
      ),
      unlockedSubStage,
      displayedSubStage,
      challengeCooldownUntilMs: {},
      upgrades,
      unlockedMilestones: Array.isArray(parsed.unlockedMilestones)
        ? parsed.unlockedMilestones.filter((x): x is string => typeof x === 'string')
        : [],
      lastTickMs: typeof parsed.lastTickMs === 'number' ? parsed.lastTickMs : nowMs,
      peakViewers: Math.max(3, Math.floor(Number(parsed.peakViewers) || 3)),
    };
  } catch {
    return createInitialState(nowMs);
  }
}

import { type DialogueBand, pickDialogueLine } from './dialogue.ts';
import {
  getStoryChapter,
  STREAM_CHALLENGES,
  WARDROBE_OUTFITS,
} from './progression.ts';
import type {
  ChallengeId,
  ComputedStats,
  GameState,
  MilestoneDef,
  TapOutcome,
  TapZoneId,
  UpgradeId,
} from './types.ts';
import { getUpgradeCost, TIER1_MILESTONES, TIER1_UPGRADES, UPGRADE_MAP } from './upgrades.ts';

export const SAVE_STORAGE_KEY = 'twitch_clicker_save_v2';

const ZONE_CLICK_BONUS_MULT: Record<TapZoneId, number> = {
  head: 1.0,
  chest: 1.3,
  belly: 1.2,
  legs: 1.2,
  feet: 1.25,
};

export function createInitialState(nowMs = Date.now()): GameState {
  return {
    balance: 0,
    totalEarned: 0,
    totalTaps: 0,
    hype: 0,
    boldness: 0,
    equippedOutfit: 't1_tight_tee',
    unlockedOutfits: ['t1_tight_tee'],
    challengeCooldownUntilMs: {},
    upgrades: {
      ring_lamp: 0,
      usb_mic_pop: 0,
      obs_alerts: 0,
      webcam_focus: 0,
      chat_emotes: 0,
      clips_boost: 0,
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

  const outfitDef =
    WARDROBE_OUTFITS.find((o) => o.id === state.equippedOutfit) ?? WARDROBE_OUTFITS[0]!;
  const outfitMult = outfitDef.incomeMultiplier;

  const effectiveBoldness = Math.max(
    0,
    Math.min(100, Number(Math.max(state.boldness, upgradeBoldnessFloor * 0.5).toFixed(1))),
  );
  // Higher boldness directly attracts more viewers & higher donation generosity!
  const boldnessMult = 1 + (effectiveBoldness / 100) * 0.65;
  const clampedHype = Math.max(0, Math.min(100, state.hype));
  const hypeMultiplier = Number((1 + (clampedHype / 100) * 1.0).toFixed(2));

  const hypeViewers = Math.floor((clampedHype / 100) * (4 + Math.sqrt(upgradeViewers + 1) * 2.5));
  const boldnessViewers = Math.floor((effectiveBoldness / 100) * 22);
  const tapOrganicViewers = Math.min(14, Math.floor(state.totalTaps / 16));

  const onlineViewers = Math.max(
    3,
    3 + upgradeViewers + hypeViewers + boldnessViewers + tapOrganicViewers,
  );

  const storyChapter = getStoryChapter(effectiveBoldness);
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

export function applyTap(
  state: GameState,
  zone: TapZoneId,
  nowMs = Date.now(),
): TapOutcome {
  const nextHype = Math.min(100, state.hype + 6.5);
  // Intimate/bold zones gradually desensitize her shyness and build boldness!
  const boldnessStep = zone === 'chest' || zone === 'feet' ? 0.45 : 0.3;
  const nextBoldness = Math.min(100, Number((state.boldness + boldnessStep).toFixed(2)));

  const preState: GameState = {
    ...state,
    hype: nextHype,
    boldness: nextBoldness,
    totalTaps: state.totalTaps + 1,
    lastTickMs: nowMs,
  };

  const stats = computeStats(preState);
  const zoneMult = ZONE_CLICK_BONUS_MULT[zone] ?? 1.0;
  const triggeredDonationAlert = preState.totalTaps % 12 === 0;
  const alertMult = triggeredDonationAlert ? 3.0 : 1.0;
  const earned = Math.max(1, Math.round(stats.clickIncome * zoneMult * alertMult));

  const { unlockedIds, newlyUnlocked } = checkMilestones(preState, stats.onlineViewers);
  const finalState: GameState = {
    ...preState,
    balance: Number((preState.balance + earned).toFixed(2)),
    totalEarned: Number((preState.totalEarned + earned).toFixed(2)),
    unlockedMilestones: unlockedIds,
    peakViewers: Math.max(preState.peakViewers, stats.onlineViewers),
  };

  const line = pickDialogueLine(zone, stats.dialogueBand, finalState.totalTaps);
  return {
    state: finalState,
    earned,
    zone,
    line,
    triggeredDonationAlert,
    newlyUnlockedMilestones: newlyUnlocked,
  };
}

export function triggerStreamChallenge(
  state: GameState,
  challengeId: ChallengeId,
  nowMs = Date.now(),
): {
  ok: boolean;
  state: GameState;
  reward: number;
  line: string;
  chatBurst: string;
  zoneFocus: TapZoneId;
  newlyUnlockedMilestones: MilestoneDef[];
} {
  const def = STREAM_CHALLENGES.find((c) => c.id === challengeId);
  if (!def) {
    return {
      ok: false,
      state,
      reward: 0,
      line: '',
      chatBurst: '',
      zoneFocus: 'chest',
      newlyUnlockedMilestones: [],
    };
  }
  const preStats = computeStats(state);
  if (preStats.onlineViewers < def.viewersRequired) {
    return {
      ok: false,
      state,
      reward: 0,
      line: '',
      chatBurst: '',
      zoneFocus: def.zoneFocus,
      newlyUnlockedMilestones: [],
    };
  }
  const cdUntil = state.challengeCooldownUntilMs[challengeId] ?? 0;
  if (nowMs < cdUntil) {
    return {
      ok: false,
      state,
      reward: 0,
      line: '',
      chatBurst: '',
      zoneFocus: def.zoneFocus,
      newlyUnlockedMilestones: [],
    };
  }

  const reward = Math.max(15, Math.round(preStats.clickIncome * def.instantRewardMult));
  const nextBoldness = Math.min(100, Number((state.boldness + def.boldnessGain).toFixed(2)));
  const updated: GameState = {
    ...state,
    balance: Number((state.balance + reward).toFixed(2)),
    totalEarned: Number((state.totalEarned + reward).toFixed(2)),
    hype: Math.min(100, state.hype + 28),
    boldness: nextBoldness,
    challengeCooldownUntilMs: {
      ...state.challengeCooldownUntilMs,
      [challengeId]: nowMs + def.cooldownSec * 1000,
    },
  };

  const afterStats = computeStats(updated);
  const { unlockedIds, newlyUnlocked } = checkMilestones(updated, afterStats.onlineViewers);

  return {
    ok: true,
    reward,
    line: def.reactionLine,
    chatBurst: def.chatBurst,
    zoneFocus: def.zoneFocus,
    newlyUnlockedMilestones: newlyUnlocked,
    state: {
      ...updated,
      unlockedMilestones: unlockedIds,
      peakViewers: Math.max(updated.peakViewers, afterStats.onlineViewers),
    },
  };
}

/**
 * Uncapped elapsed-ms idle tick so background tabs still accrue passive stream income cleanly.
 */
export function tickEconomy(
  state: GameState,
  elapsedMs: number,
  nowMs = Date.now(),
): { state: GameState; newlyUnlockedMilestones: MilestoneDef[] } {
  const safeMs = Math.max(0, elapsedMs);
  if (safeMs === 0) {
    return { state: { ...state, lastTickMs: nowMs }, newlyUnlockedMilestones: [] };
  }

  const dtSec = safeMs / 1000;
  const stats = computeStats(state);
  const passiveGain = stats.passivePerSec * dtSec;
  const hypeDecay = dtSec * 3.8;
  const nextHype = Math.max(0, state.hype - hypeDecay);

  const updated: GameState = {
    ...state,
    balance: Number((state.balance + passiveGain).toFixed(2)),
    totalEarned: Number((state.totalEarned + passiveGain).toFixed(2)),
    hype: nextHype,
    lastTickMs: nowMs,
  };

  const afterStats = computeStats(updated);
  const { unlockedIds, newlyUnlocked } = checkMilestones(updated, afterStats.onlineViewers);

  return {
    state: {
      ...updated,
      unlockedMilestones: unlockedIds,
      peakViewers: Math.max(updated.peakViewers, afterStats.onlineViewers),
    },
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
    return {
      balance: Math.max(0, parsed.balance),
      totalEarned: Math.max(0, Number(parsed.totalEarned) || 0),
      totalTaps: Math.max(0, Math.floor(Number(parsed.totalTaps) || 0)),
      hype: Math.max(0, Math.min(100, Number(parsed.hype) || 0)),
      boldness: Math.max(0, Math.min(100, Number(parsed.boldness) || 0)),
      equippedOutfit: 't1_tight_tee',
      unlockedOutfits: ['t1_tight_tee'],
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

import { pickDialogueLine } from './dialogue.ts';
import type {
  ComputedStats,
  GameState,
  MilestoneDef,
  TapOutcome,
  TapZoneId,
  UpgradeId,
} from './types.ts';
import { getUpgradeCost, TIER1_MILESTONES, TIER1_UPGRADES, UPGRADE_MAP } from './upgrades.ts';

export const SAVE_STORAGE_KEY = 'twitch_clicker_save_v1';

const ZONE_CLICK_BONUS_MULT: Record<TapZoneId, number> = {
  head: 1.0,
  chest: 1.25,
  belly: 1.15,
  legs: 1.15,
  feet: 1.2,
};

export function createInitialState(nowMs = Date.now()): GameState {
  return {
    balance: 0,
    totalEarned: 0,
    totalTaps: 0,
    hype: 0,
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

  for (const def of TIER1_UPGRADES) {
    const lvl = state.upgrades[def.id] ?? 0;
    if (lvl > 0) {
      baseClick += def.clickBonus * lvl;
      passivePerSec += def.passivePerSec * lvl;
      upgradeViewers += def.viewersBonus * lvl;
    }
  }

  // Hype (0..100) raises income multiplier up to x2.0 and pulls temporary curious viewers into the room
  const clampedHype = Math.max(0, Math.min(100, state.hype));
  const hypeMultiplier = Number((1 + (clampedHype / 100) * 1.0).toFixed(2));
  const hypeViewers = Math.floor((clampedHype / 100) * (4 + Math.sqrt(upgradeViewers + 1) * 2.5));
  const tapOrganicViewers = Math.min(12, Math.floor(state.totalTaps / 18));

  const onlineViewers = Math.max(3, 3 + upgradeViewers + hypeViewers + tapOrganicViewers);

  const dialogueBand: 1 | 2 | 3 =
    onlineViewers >= 60 ? 3 : onlineViewers >= 25 ? 2 : 1;

  const nextMilestone =
    TIER1_MILESTONES.find((m) => !state.unlockedMilestones.includes(m.id)) ?? null;

  return {
    clickIncome: Math.round(baseClick * hypeMultiplier),
    passivePerSec: Number((passivePerSec * (1 + (clampedHype / 100) * 0.35)).toFixed(1)),
    onlineViewers,
    hypeMultiplier,
    dialogueBand,
    nextMilestone,
  };
}

function checkMilestones(state: GameState, viewers: number): {
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
  const preState: GameState = {
    ...state,
    hype: nextHype,
    totalTaps: state.totalTaps + 1,
    lastTickMs: nowMs,
  };

  const stats = computeStats(preState);
  const zoneMult = ZONE_CLICK_BONUS_MULT[zone] ?? 1.0;
  // Every 12th tap triggers a generous viewer "donation alert" x3!
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
  // Gentle hype decay when not clicking (capped so long background tab simply settles at 0)
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

  const nextState: GameState = {
    ...state,
    balance: Number((state.balance - cost).toFixed(2)),
    hype: Math.min(100, state.hype + 18),
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

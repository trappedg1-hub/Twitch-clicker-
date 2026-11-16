export type TapZoneId = 'head' | 'chest' | 'belly' | 'legs' | 'feet';

export type UpgradeId =
  | 'ring_lamp'
  | 'usb_mic_pop'
  | 'obs_alerts'
  | 'webcam_focus'
  | 'chat_emotes'
  | 'clips_boost';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  subtitle: string;
  icon: string;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  clickBonus: number;
  passivePerSec: number;
  viewersBonus: number;
}

export interface MilestoneDef {
  id: string;
  viewersRequired: number;
  title: string;
  rewardText: string;
}

export interface GameState {
  balance: number;
  totalEarned: number;
  totalTaps: number;
  hype: number; // 0..100
  upgrades: Record<UpgradeId, number>;
  unlockedMilestones: string[];
  lastTickMs: number;
  peakViewers: number;
}

export interface ComputedStats {
  clickIncome: number;
  passivePerSec: number;
  onlineViewers: number;
  hypeMultiplier: number;
  dialogueBand: 1 | 2 | 3;
  nextMilestone: MilestoneDef | null;
}

export interface TapOutcome {
  state: GameState;
  earned: number;
  zone: TapZoneId;
  line: string;
  triggeredDonationAlert: boolean;
  newlyUnlockedMilestones: MilestoneDef[];
}

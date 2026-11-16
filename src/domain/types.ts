export type TapZoneId = 'head' | 'chest' | 'belly' | 'legs' | 'feet';

export type UpgradeId =
  | 'ring_lamp'
  | 'usb_mic_pop'
  | 'obs_alerts'
  | 'webcam_focus'
  | 'chat_emotes'
  | 'clips_boost';

export type OutfitId =
  | 't1_tight_tee'
  | 't2_bralette_set'
  | 't2_offshoulder_crop'
  | 't3_glossy_corset'
  | 't3_lace_nightie';

export type ChallengeId =
  | 'lean_mic'
  | 'pose_feet'
  | 'tug_tee'
  | 'asmr_tease';

export type BottomTabId = 'stream' | 'upgrades' | 'outfits' | 'story';

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
  boldnessBonus: number;
}

export interface OutfitDef {
  id: OutfitId;
  tier: 1 | 2 | 3;
  name: string;
  tag: string;
  storyDesc: string;
  cost: number;
  viewersRequired: number;
  boldnessRequired: number;
  incomeMultiplier: number;
  availableInCurrentBuild: boolean;
}

export interface StreamChallengeDef {
  id: ChallengeId;
  name: string;
  desc: string;
  icon: string;
  viewersRequired: number;
  boldnessGain: number;
  instantRewardMult: number;
  cooldownSec: number;
  zoneFocus: TapZoneId;
  reactionLine: string;
  chatBurst: string;
}

export interface StoryChapterDef {
  stage: 1 | 2 | 3 | 4;
  minBoldness: number;
  badgeTitle: string;
  headline: string;
  diaryThought: string;
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
  boldness: number; // 0..100 — шкала раскрепощённости героини
  equippedOutfit: OutfitId;
  unlockedOutfits: OutfitId[];
  challengeCooldownUntilMs: Partial<Record<ChallengeId, number>>;
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
  boldness: number;
  storyChapter: StoryChapterDef;
  dialogueBand: 1 | 2 | 3 | 4;
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

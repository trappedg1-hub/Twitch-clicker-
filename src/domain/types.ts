export type TapZoneId = 'head' | 'chest' | 'belly' | 'legs' | 'feet';

export type HeroineEmotion = 'neutral' | 'shy' | 'fluster' | 'tease' | 'bold';

export type SubGoalStageIndex = 0 | 1 | 2 | 3 | 4;

export type UpgradeId =
  | 'ring_lamp'
  | 'usb_mic_pop'
  | 'obs_alerts'
  | 'webcam_focus'
  | 'chat_emotes'
  | 'clips_boost'
  | 'desk_mic';

export type ChallengeId =
  | 'lean_mic'
  | 'pose_feet'
  | 'tug_tee'
  | 'asmr_tease'
  | 'arch_stretch'
  | 'garter_flash';

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

export interface SubGoalReactionMsg {
  author: string;
  color: string;
  badge?: 'MOD' | 'VIP' | 'SUB' | 'DONATE';
  text: string;
  isSystemHighlight?: boolean;
}

export interface SubGoalStageDef {
  stage: SubGoalStageIndex;
  subsRequired: number;
  shortGoalTitle: string;
  outfitName: string;
  removedItemLabel: string;
  storyDesc: string;
  plateUrl: string;
  incomeMultiplier: number;
  viewersBonus: number;
  boldnessBonus: number;
  unlockEmotion: Exclude<HeroineEmotion, 'neutral'>;
  unlockLine: string;
  shyApproachLines: readonly string[];
  chatCascade: readonly SubGoalReactionMsg[];
  /** Day 2 re-uses the same plate slot for a different costume — labels follow the outfit. */
  day2OutfitName?: string;
  day2StoryDesc?: string;
  day2PlateUrl?: string;
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
  /** Spicy challenges keep working on Day 2 — but she is dressed, so the line must match. */
  reactionLineDay2?: string;
  /**
   * Day 4 is the yoga day: nothing comes off, so both her line and the chat's demand must be about the
   * POSE (depth, holding it, breathing) instead of about revealing more. Without these the shop buttons
   * would put Day-1 strip talk into the middle of a stream where she never undresses.
   */
  reactionLineDay4?: string;
  chatBurst: string;
  chatBurstDay4?: string;
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

export interface MicTierVisualDef {
  tier: number; // 1..10
  modelName: string;
  shortDesc: string;
  spriteUrl: string;
  reactionLine: string;
}

export interface GameState {
  streamDay: number; // День стрима (1 = Первый день до 500 сабов, 2 = Второй день с переносом всех вещей!)
  carriedOverWardrobeStage: SubGoalStageIndex; // Перенесённая открытая одежда из прошлых дней
  balance: number;
  totalEarned: number;
  totalTaps: number;
  hype: number; // 0..100
  boldness: number; // 0..100 — шкала раскрепощённости героини
  subscribers: number; // Платные подписчики канала (Sub Goal 10 / 50 / 200 / 500)
  organicSubProgress: number; // 0..1 дробный прогресс органического саба от зрителей
  unlockedSubStage: SubGoalStageIndex; // Максимальная пробитая цель сабов (0..4)
  displayedSubStage: SubGoalStageIndex; // Какая стадия одежды сейчас надета на сцене (0..unlockedSubStage)
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
  currentSubStageDef: SubGoalStageDef;
  nextSubGoalDef: SubGoalStageDef | null;
  giftSubUnitCost: number;
}

export interface TapOutcome {
  state: GameState;
  earned: number;
  zone: TapZoneId;
  line: string;
  triggeredDonationAlert: boolean;
  gainedOrganicSubs: number;
  newlyUnlockedSubStages: SubGoalStageDef[];
  newlyUnlockedMilestones: MilestoneDef[];
}

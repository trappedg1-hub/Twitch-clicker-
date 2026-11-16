import type { MilestoneDef, UpgradeDef, UpgradeId } from './types.ts';

export const TIER1_UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'ring_lamp',
    name: 'Кольцевая лампа',
    subtitle: 'Тёплый блик на ключицах, груди и бёдрах',
    icon: '💡',
    baseCost: 25,
    costGrowth: 1.55,
    maxLevel: 15,
    clickBonus: 3,
    passivePerSec: 1.5,
    viewersBonus: 2,
    boldnessBonus: 2.5,
  },
  {
    id: 'usb_mic_pop',
    name: 'ASMR-чувствительность мика',
    subtitle: 'Ловит каждое смущённое дыхание и шёпот',
    icon: '🎙️',
    baseCost: 65,
    costGrowth: 1.6,
    maxLevel: 15,
    clickBonus: 5,
    passivePerSec: 4,
    viewersBonus: 4,
    boldnessBonus: 3.5,
  },
  {
    id: 'obs_alerts',
    name: 'Вибро-алерты донатов',
    subtitle: 'Крупный донат заставляет её сладко вздрагивать',
    icon: '🔔',
    baseCost: 160,
    costGrowth: 1.62,
    maxLevel: 12,
    clickBonus: 10,
    passivePerSec: 10,
    viewersBonus: 7,
    boldnessBonus: 5.0,
  },
  {
    id: 'webcam_focus',
    name: 'Чёткий фокус 1080p',
    subtitle: 'Видна каждая капелька румянца и натяжение ткани',
    icon: '📷',
    baseCost: 390,
    costGrowth: 1.65,
    maxLevel: 12,
    clickBonus: 22,
    passivePerSec: 24,
    viewersBonus: 12,
    boldnessBonus: 6.5,
  },
  {
    id: 'chat_emotes',
    name: 'Платные цели фансервиса',
    subtitle: 'Полоска донат-гола раскрепощает её за рубли',
    icon: '💜',
    baseCost: 900,
    costGrowth: 1.68,
    maxLevel: 10,
    clickBonus: 48,
    passivePerSec: 55,
    viewersBonus: 20,
    boldnessBonus: 8.5,
  },
  {
    id: 'clips_boost',
    name: 'Горячий клип в реки',
    subtitle: 'Пикантный момент разлетелся — толпа зрителей в эфире',
    icon: '🔥',
    baseCost: 2100,
    costGrowth: 1.72,
    maxLevel: 10,
    clickBonus: 110,
    passivePerSec: 130,
    viewersBonus: 38,
    boldnessBonus: 11.0,
  },
] as const;

export const UPGRADE_MAP: Record<UpgradeId, UpgradeDef> = Object.fromEntries(
  TIER1_UPGRADES.map((u) => [u.id, u]),
) as Record<UpgradeId, UpgradeDef>;

export const TIER1_MILESTONES: readonly MilestoneDef[] = [
  {
    id: 'm_10',
    viewersRequired: 10,
    title: '10 зрителей — страх уходит',
    rewardText: 'Первые лёгкие деньги: Мия перестаёт зажиматься',
  },
  {
    id: 'm_25',
    viewersRequired: 25,
    title: '25 онлайна — входит во вкус',
    rewardText: 'Открыты кокетливые реплики и челлендж с тишкой',
  },
  {
    id: 'm_60',
    viewersRequired: 60,
    title: '60 онлайна — азарт и фансервис',
    rewardText: 'Открыт ASMR-челлендж и горячие монологи',
  },
  {
    id: 'm_120',
    viewersRequired: 120,
    title: '120 онлайна — звезда Тир-1!',
    rewardText: 'Полное раскрепощение на стартовом этапе',
  },
] as const;

export function getUpgradeCost(def: UpgradeDef, currentLevel: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}

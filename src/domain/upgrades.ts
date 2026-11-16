import type { MilestoneDef, UpgradeDef, UpgradeId } from './types.ts';

export const TIER1_UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'ring_lamp',
    name: 'Кольцевая лампа',
    subtitle: 'Мягкий свет на кожу и блики в глазках',
    icon: '💡',
    baseCost: 25,
    costGrowth: 1.55,
    maxLevel: 15,
    clickBonus: 3,
    passivePerSec: 1.5,
    viewersBonus: 2,
  },
  {
    id: 'usb_mic_pop',
    name: 'Поп-фильтр на мик',
    subtitle: 'Слышно каждый смущённый вздох у микрофона',
    icon: '🎙️',
    baseCost: 65,
    costGrowth: 1.6,
    maxLevel: 15,
    clickBonus: 5,
    passivePerSec: 4,
    viewersBonus: 4,
  },
  {
    id: 'obs_alerts',
    name: 'Озвучка донатов',
    subtitle: 'Внезапные алерты заставляют её мило вздрагивать',
    icon: '🔔',
    baseCost: 160,
    costGrowth: 1.62,
    maxLevel: 12,
    clickBonus: 10,
    passivePerSec: 10,
    viewersBonus: 7,
  },
  {
    id: 'webcam_focus',
    name: 'Чёткий автофокус 1080p',
    subtitle: 'Зрители разглядели каждую складочку на тишке',
    icon: '📷',
    baseCost: 390,
    costGrowth: 1.65,
    maxLevel: 12,
    clickBonus: 22,
    passivePerSec: 24,
    viewersBonus: 12,
  },
  {
    id: 'chat_emotes',
    name: 'Смайлики канала',
    subtitle: 'Чат спамит кастомные сердечки и платные сабки',
    icon: '💜',
    baseCost: 900,
    costGrowth: 1.68,
    maxLevel: 10,
    clickBonus: 48,
    passivePerSec: 55,
    viewersBonus: 20,
  },
  {
    id: 'clips_boost',
    name: 'Нарезка в рекомендации',
    subtitle: 'Момент со стрима залетел — в чат врывается толпа',
    icon: '🔥',
    baseCost: 2100,
    costGrowth: 1.72,
    maxLevel: 10,
    clickBonus: 110,
    passivePerSec: 130,
    viewersBonus: 38,
  },
] as const;

export const UPGRADE_MAP: Record<UpgradeId, UpgradeDef> = Object.fromEntries(
  TIER1_UPGRADES.map((u) => [u.id, u]),
) as Record<UpgradeId, UpgradeDef>;

export const TIER1_MILESTONES: readonly MilestoneDef[] = [
  {
    id: 'm_10',
    viewersRequired: 10,
    title: 'Первая десятка в чате!',
    rewardText: 'Мия перестала прятать взгляд — новые живые реакции',
  },
  {
    id: 'm_25',
    viewersRequired: 25,
    title: '25 онлайна — раскованный вайб',
    rewardText: 'Открыт 2-й уровень смелых реплик Тир-1',
  },
  {
    id: 'm_60',
    viewersRequired: 60,
    title: '60 онлайна — локальная звёздочка',
    rewardText: 'Открыт 3-й уровень дразнящих реплик и бурный чат',
  },
  {
    id: 'm_120',
    viewersRequired: 120,
    title: '120 онлайна — копим на новое кресло!',
    rewardText: 'Пик Тир-1 достигнут — база под переход на Тир-2 готова',
  },
] as const;

export function getUpgradeCost(def: UpgradeDef, currentLevel: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}

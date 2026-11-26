import type { MilestoneDef, UpgradeDef, UpgradeId } from './types.ts';

export const TIER1_UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'ring_lamp',
    name: 'Кольцевая лампа',
    subtitle: 'Тёплый блик на ключицах, груди и бёдрах',
    icon: '✦',
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
    icon: '♪',
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
    icon: '★',
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
    icon: '◉',
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
    icon: '♥',
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
    icon: '▲',
    baseCost: 2100,
    costGrowth: 1.72,
    maxLevel: 10,
    clickBonus: 110,
    passivePerSec: 130,
    viewersBonus: 38,
    boldnessBonus: 11.0,
  },
  {
    id: 'desk_mic',
    name: 'Настольный микрофон',
    subtitle: 'Покупаешь один раз — и он появляется прямо на столе!',
    icon: '🎙',
    baseCost: 180,
    costGrowth: 1.68,
    maxLevel: 10,
    clickBonus: 8,
    passivePerSec: 6,
    viewersBonus: 5,
    boldnessBonus: 4.0,
  },
] as const;

export const MIC_TIERS: readonly import('./types.ts').MicTierVisualDef[] = [
  {
    tier: 1,
    modelName: 'Дешёвый пластиковый микрофон на палочке',
    shortDesc: 'Самый бюджетный вариант — зато теперь Мия не кричит в ноутбук!',
    spriteUrl: '/art/mics/mic_t1.webp',
    reactionLine: 'Ой, теперь у меня есть свой микрофон на столе! Правда он такой дешёвый и пластиковый... но всё равно приятно~ ♥',
  },
  {
    tier: 2,
    modelName: 'USB-микрофон на гибкой ножке',
    shortDesc: 'Гибкая ножка — можно пододвинуть прямо к губкам',
    spriteUrl: '/art/mics/mic_t2.webp',
    reactionLine: 'Смотрите, ножка гнётся! Могу пододвинуть микрофончик прямо к губкам и шептать в него~ ♥',
  },
  {
    tier: 3,
    modelName: 'Fifine AmpliGame A8',
    shortDesc: 'Игровой USB-микрофон с подсветкой',
    spriteUrl: '/art/mics/mic_t3.webp',
    reactionLine: 'Вау, это уже Fifine! Звук стал заметно чище, чат слышит каждое моё дыхание~ ★',
  },
  {
    tier: 4,
    modelName: 'Blue Snowball iCE',
    shortDesc: 'Культовый белый шарик — классика стримов',
    spriteUrl: '/art/mics/mic_t4.webp',
    reactionLine: 'Белый Snowball как у настоящих стримеров! Теперь я выгляжу совсем по-взрослому~ ♥',
  },
  {
    tier: 5,
    modelName: 'RGB QuadCast S',
    shortDesc: 'HyperX QuadCast с переливающейся RGB-подсветкой',
    spriteUrl: '/art/mics/mic_t5.webp',
    reactionLine: 'Ого, он светится всеми цветами радуги! Мой стол теперь как в киберпанк-студии~ ★ ♥',
  },
  {
    tier: 6,
    modelName: 'Конденсаторный + поп-фильтр',
    shortDesc: 'AT2020 с круглым поп-фильтром — студийный звук',
    spriteUrl: '/art/mics/mic_t6.webp',
    reactionLine: 'Поп-фильтр! Теперь мои «п-п» и шёпот звучат так бархатно... чат, слушайте внимательно~ ♥',
  },
  {
    tier: 7,
    modelName: 'Shure MV7',
    shortDesc: 'Динамический микрофон для стримов и подкастов',
    spriteUrl: '/art/mics/mic_t7.webp',
    reactionLine: 'Shure MV7 — как у всех топовых подкастеров! Голос стал таким глубоким и горячим~ ★',
  },
  {
    tier: 8,
    modelName: 'Shure SM7B на пантографе',
    shortDesc: 'Легенда стримов на подвесной руке — максимум стиля',
    spriteUrl: '/art/mics/mic_t8.webp',
    reactionLine: 'Смотрите, он висит на пантографе прямо перед моими губками! Теперь я как настоящая радиоведущая~ ♥',
  },
  {
    tier: 9,
    modelName: '3Dio ASMR уши',
    shortDesc: 'Бинауральный микрофон с ушами — 3D-звук шепота',
    spriteUrl: '/art/mics/mic_t9.webp',
    reactionLine: 'Ушки 3Dio! Теперь мой шёпот будет звучать прямо у вас в ушке... мурашки, да?~ ♥',
  },
  {
    tier: 10,
    modelName: 'Золотой VIP ламповый Neumann',
    shortDesc: 'Champagne-Gold вакуумно-ламповый конденсатор — флагманы!',
    spriteUrl: '/art/mics/mic_t10.webp',
    reactionLine: 'ЗОЛОТОЙ LUXURY-МИКРОФОН С ЛАМПОЙ! Я теперь официально королева стримов — звук как в студии за миллион! ★ ♥',
  },
] as const;

export function getMicTier(level: number): import('./types.ts').MicTierVisualDef | null {
  if (level <= 0) return null;
  return MIC_TIERS[Math.min(10, Math.max(1, Math.floor(level))) - 1] ?? null;
}

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

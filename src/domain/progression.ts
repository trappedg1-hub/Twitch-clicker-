import type {
  OutfitDef,
  StoryChapterDef,
  StreamChallengeDef,
} from './types.ts';

export const STORY_CHAPTERS: readonly StoryChapterDef[] = [
  {
    stage: 1,
    minBoldness: 0,
    badgeTitle: 'Этап 1 • Зажатая скромница',
    headline: 'Дрожат коленки перед первой вебкой',
    diaryThought:
      '«Господи, зачем я надела эту тесную футболку... Ладошки потеют, но за квартиру платить нечем — придётся потерпеть взгляды чата...»',
  },
  {
    stage: 2,
    minBoldness: 25,
    badgeTitle: 'Этап 2 • Вкус лёгких донатов',
    headline: 'Поняла, за что зрители кидают деньги',
    diaryThought:
      '«Стоило чуть податься вперёд и не прикрывать вырез — как сразу полетели сотки и комплименты... Кажется, стесняться тут просто невыгодно~»',
  },
  {
    stage: 3,
    minBoldness: 55,
    badgeTitle: 'Этап 3 • Азартная кокетка',
    headline: 'Сама провоцирует чат ради онлайна',
    diaryThought:
      '«Сердце колотится уже не от страха, а от кайфа! Они готовы засыпать меня деньгами за каждый томный вздох и открытые ножки в кадре...»',
  },
  {
    stage: 4,
    minBoldness: 82,
    badgeTitle: 'Этап 4 • Горячая звезда эфира',
    headline: 'Полное раскрепощение за топ-донаты',
    diaryThought:
      '«Где та тихоня, которая боялась включить камеру? Пусть смотрят во все глаза и открывают кошельки — дальше будет ещё откровеннее~ ★»',
  },
] as const;

export const WARDROBE_OUTFITS: readonly OutfitDef[] = [
  {
    id: 't1_tight_tee',
    tier: 1,
    name: 'Тесная игровая микро-тишка',
    tag: 'Тир 1 • Надето',
    storyDesc:
      'Старая домашняя тишка на два размера меньше и микро-шортики — первая робкая попытка зацепить зрителей фигурой.',
    cost: 0,
    viewersRequired: 1,
    boldnessRequired: 0,
    incomeMultiplier: 1.0,
    availableInCurrentBuild: true,
  },
  {
    id: 't2_offshoulder_crop',
    tier: 2,
    name: 'Сползающий кроп-лонгслив без белья',
    tag: 'Тир 2 • Скоро',
    storyDesc:
      'Тонкий трикотаж с открытыми плечами, намекающий на полное отсутствие скованности перед камерой.',
    cost: 3500,
    viewersRequired: 60,
    boldnessRequired: 40,
    incomeMultiplier: 1.45,
    availableInCurrentBuild: false,
  },
  {
    id: 't2_bralette_set',
    tier: 2,
    name: 'Чёрный халтер-бралетт и микро-шортики',
    tag: 'Тир 2 • Скоро',
    storyDesc:
      'Никаких лишних футболок: минимум ткани, кошачьи RGB-ушки и абсолютная уверенность в своей сексуальности.',
    cost: 8500,
    viewersRequired: 110,
    boldnessRequired: 65,
    incomeMultiplier: 2.0,
    availableInCurrentBuild: false,
  },
  {
    id: 't3_glossy_corset',
    tier: 3,
    name: 'Глянцевый боди-корсет искусительницы',
    tag: 'Тир 3 • VIP-этап',
    storyDesc:
      'Откровенный косплей для закрытых ночных стримов с максимальным потоком крупных донатов.',
    cost: 22000,
    viewersRequired: 220,
    boldnessRequired: 85,
    incomeMultiplier: 3.1,
    availableInCurrentBuild: false,
  },
  {
    id: 't3_lace_nightie',
    tier: 3,
    name: 'Полупрозрачный шёлковый неглиже-сет',
    tag: 'Тир 3 • Финал',
    storyDesc:
      'Пик раскрепощённости: поздний приватный вайб для самых щедрых спонсоров канала.',
    cost: 55000,
    viewersRequired: 400,
    boldnessRequired: 95,
    incomeMultiplier: 4.5,
    availableInCurrentBuild: false,
  },
] as const;

export const STREAM_CHALLENGES: readonly StreamChallengeDef[] = [
  {
    id: 'lean_mic',
    name: 'Наклониться к вебке за донат',
    desc: 'Податься грудью ближе к объективу — пульс чата и донаты взлетают',
    icon: '★',
    viewersRequired: 3,
    boldnessGain: 4.5,
    instantRewardMult: 4,
    cooldownSec: 12,
    zoneFocus: 'chest',
    reactionLine:
      'Т-так достаточно близко к камере?.. Вижу, как сразу полетели донатики, шалуны... ♥',
    chatBurst: 'НАКЛОНИЛАСЬ!! :BOOBA: :BOOBA: ЧАТ ДЕРЖИМСЯ :Kreygasm:',
  },
  {
    id: 'pose_feet',
    name: 'Поиграть пальчиками стоп в кадре',
    desc: 'Специально для ценителей в чате — смущённо показать педикюр поближе',
    icon: '♥',
    viewersRequired: 10,
    boldnessGain: 6.0,
    instantRewardMult: 6,
    cooldownSec: 16,
    zoneFocus: 'feet',
    reactionLine:
      'Кто бы мне вчера сказал, что мне будут кидать такие суммы просто за босые ножки на кресле~ ♥',
    chatBurst: 'ФИОЛЕТОВЫЙ ПЕДИКЮР КРУПНЫМ ПЛАНОМ :Kreygasm: :SubHype: ЗАБИРАЙ ЗАРПЛАТУ!!',
  },
  {
    id: 'tug_tee',
    name: '«Случайно» поправить тесную тишку',
    desc: 'Натянуть ткань ещё плотнее на груди, дразня зрителей открытым животиком',
    icon: '✦',
    viewersRequired: 25,
    boldnessGain: 8.5,
    instantRewardMult: 9,
    cooldownSec: 20,
    zoneFocus: 'belly',
    reactionLine:
      'Ой, хотела одёрнуть пониже, а вырез стал только откровеннее... ну и ладно, вам же так больше нравится~ ♥',
    chatBurst: 'БЕДНАЯ ТИШКА НА ПРЕДЕЛЕ ПРОЧНОСТИ :BOOBA: :Pog: ЛУЧШИЙ СТРИМ!!',
  },
  {
    id: 'asmr_tease',
    name: 'Томный ASMR-вздох в микрофон',
    desc: 'Влажный шёпот прямо в мембрану за жирный чек от топ-донатера',
    icon: '♪',
    viewersRequired: 50,
    boldnessGain: 12.0,
    instantRewardMult: 14,
    cooldownSec: 25,
    zoneFocus: 'head',
    reactionLine:
      'Мм-х... спасибо за жирный донатик, котик~ За такие деньги я готова шептать тебе всю ночь... ♥',
    chatBurst: 'МУРАШКИ ОТ ЭТОГО ВЗДОХА :Kreygasm: :miyaLove: КИДАЮ ЕЩЁ ПЯТИСОТКУ!!',
  },
] as const;

export function getStoryChapter(boldness: number): StoryChapterDef {
  let current = STORY_CHAPTERS[0]!;
  for (const ch of STORY_CHAPTERS) {
    if (boldness >= ch.minBoldness) {
      current = ch;
    }
  }
  return current;
}

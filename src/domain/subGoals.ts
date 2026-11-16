import type { SubGoalStageDef, SubGoalStageIndex } from './types.ts';

export const SUB_GOAL_STAGES: readonly SubGoalStageDef[] = [
  {
    stage: 0,
    subsRequired: 0,
    shortGoalTitle: 'Старт эфира',
    outfitName: 'Уютное худи + легинсы + носочки',
    removedItemLabel: 'Стартовый образ',
    storyDesc:
      'Мия жутко стесняется первого эфира, поэтому укуталась в домашнее худи, плотные легинсы под шортиками и полосатые носочки.',
    plateUrl: '/art/heroine_t1_s0.webp',
    incomeMultiplier: 1.0,
    viewersBonus: 0,
    boldnessBonus: 0,
    unlockLine: '',
    chatCascade: [],
  },
  {
    stage: 1,
    subsRequired: 10,
    shortGoalTitle: 'Снять носочки',
    outfitName: 'Уютное худи + легинсы (босиком)',
    removedItemLabel: '− Носочки сняты!',
    storyDesc:
      '10 сабов: краснея до ушей, стянула полосатые носочки прямо перед вебкой и осталась с голыми ступнями и тёмным педикюром.',
    plateUrl: '/art/heroine_t1_s1.webp',
    incomeMultiplier: 1.25,
    viewersBonus: 6,
    boldnessBonus: 14,
    unlockLine:
      'Б-блин, уже 10 сабов?! Ладно, уговор есть уговор — снимаю носочки прямо в эфире... т-только не пяльтесь так на голые пальчики!',
    chatCascade: [
      {
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: '★ SUB GOAL 10/10 ВЫПОЛНЕН! Носочки улетели из кадра! :Pog: :SubHype:',
        isSystemHighlight: true,
      },
      {
        author: 'feet_connoisseur',
        color: '#f472b6',
        badge: 'SUB',
        text: 'БОСЫЕ СТУПНИ С ТЁМНЫМ ПЕДИКЮРОМ ПРЯМО ПЕРЕД ВЕБКОЙ :Kreygasm: :Kreygasm:',
      },
      {
        author: 'Pasha_Donater',
        color: '#a78bfa',
        badge: 'VIP',
        text: 'как она смущённо поджала пальчики ахах милота :peepoShy: :miyaLove:',
      },
      {
        author: 'simp_police_ru',
        color: '#4ade80',
        badge: 'MOD',
        text: 'ЧАТ ЖМЁМ ДАЛЬШЕ, НА 50 САБОВ СНИМАЕМ ЛЕГИНСЫ!! :SubHype: :BOOBA:',
      },
    ],
  },
  {
    stage: 2,
    subsRequired: 50,
    shortGoalTitle: 'Снять легинсы',
    outfitName: 'То же худи + голые ножки в шортиках',
    removedItemLabel: '− Легинсы сняты!',
    storyDesc:
      '50 сабов: стянула плотные легинсы из-под шортиков — сверху всё то же уютное худи с открытыми ключицами, а снизу голые фарфоровые бёдра!',
    plateUrl: '/art/heroine_t1_s2.webp',
    incomeMultiplier: 1.65,
    viewersBonus: 18,
    boldnessBonus: 22,
    unlockLine:
      'Пятьдесят платных сабов?! Сумасшедшие... Фух, стянула легинсы из-под шортиков... в одном худи и с такими голыми ляжками так непривычно~ ♥',
    chatCascade: [
      {
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: '★ SUB GOAL 50/50 ПРОБИТ! Легинсы сняты в прямом эфире! :Pog: :SubHype:',
        isSystemHighlight: true,
      },
      {
        author: 'maksim_simp',
        color: '#fb7185',
        badge: 'SUB',
        text: 'ГОЛЫЕ ФАРФОРОВЫЕ БЁДРА ПОД ЭТИМ ХУДИ ПРОСТО РАЗРЫВ СЕРДЦА :BOOBA: :Kreygasm:',
      },
      {
        author: 'cyber_stalker77',
        color: '#60a5fa',
        text: 'обожаю этот контраст — уютное худи сверху и полностью голые ножки :BOOBA: :miyaLove:',
      },
      {
        author: 'rich_uncle_msk',
        color: '#ffd54f',
        badge: 'DONATE',
        text: 'СЛЕДУЮЩАЯ ЦЕЛЬ 200 САБОВ — СНИМАЕМ ХУДИ!! ЗАРЯЖАЮ ПОДАРОЧНЫЕ САБКИ :SubHype: :Pog:',
        isSystemHighlight: true,
      },
    ],
  },
  {
    stage: 3,
    subsRequired: 200,
    shortGoalTitle: 'Снять худи',
    outfitName: 'Тесная кроп-тишка с глубоким вырезом',
    removedItemLabel: '− Худи снято!',
    storyDesc:
      '200 сабов: расстегнула и сбросила жаркое худи — под ним оказалась экстремально тесная кроп-тишка с открытым животиком и декольте!',
    plateUrl: '/art/heroine_t1_base.webp',
    incomeMultiplier: 2.35,
    viewersBonus: 45,
    boldnessBonus: 28,
    unlockLine:
      'Двести сабов!! Ладно, в этом плотном худи я уже вся взмокла... Ох, видите, какая под ним крошечная тишка? Чат, вы там ещё дышите?~ ♥',
    chatCascade: [
      {
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: '★★ SUB GOAL 200/200!! ХУДИ УЛЕТЕЛО С ПЛЕЧ!! :BOOBA: :BOOBA: :SubHype:',
        isSystemHighlight: true,
      },
      {
        author: 'night_watcher_',
        color: '#34d399',
        badge: 'SUB',
        text: 'ОНА ВСЁ ЭТО ВРЕМЯ ПРЯТАЛА ТАКОЕ ДЕКОЛЬТЕ ПОД ХУДИ?! :BOOBA: :Kreygasm:',
      },
      {
        author: 'dima_bez_sna',
        color: '#facc15',
        badge: 'VIP',
        text: 'бедный геймпад на груди и голый животик — это лучший стрим года :Kreygasm: :Pog:',
      },
      {
        author: 'VIP_Donater',
        color: '#ffd54f',
        badge: 'DONATE',
        text: 'ФИНАЛ 500 САБОВ — ДОЛОЙ ТИШКУ, ОСТАЁТСЯ БРАЛЕТТ!! ЖМЁМ ВСЕЙ КОМНАТОЙ :SubHype: :BOOBA:',
        isSystemHighlight: true,
      },
    ],
  },
  {
    stage: 4,
    subsRequired: 500,
    shortGoalTitle: 'Снять тишку (Бралетт!)',
    outfitName: 'Чёрный халтер-бралетт и микро-шортики',
    removedItemLabel: '− Тишка снята! Финал ★',
    storyDesc:
      '500 сабов: финал марафона — сняла тесную футболку и осталась в дерзком чёрном бралетте перед сотнями зрителей!',
    plateUrl: '/art/heroine_t1_s4.webp',
    incomeMultiplier: 3.5,
    viewersBonus: 110,
    boldnessBonus: 36,
    unlockLine:
      'ПЯТЬСОТ САБОВ!! Вы реально сделали меня топ-стримершей за один вечер... Ну что, любимый чатик — прощай тишка! В этом бралетте я больше ничего не стесняюсь~ ★ ♥',
    chatCascade: [
      {
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: '★★★ 500/500 САБОВ!! ФИНАЛЬНЫЙ SUB GOAL ВЫПОЛНЕН!! :SubHype: :Pog:',
        isSystemHighlight: true,
      },
      {
        author: 'maksim_simp',
        color: '#fb7185',
        badge: 'SUB',
        text: 'ЧЁРНЫЙ БРАЛЕТТ В ПРЯМОМ ЭФИРЕ Я НЕ МОГУ ОТВЕСТИ ГЛАЗ :BOOBA: :BOOBA: :Kreygasm:',
      },
      {
        author: 'rich_uncle_msk',
        color: '#ffd54f',
        badge: 'DONATE',
        text: 'ИЗ СКРОМНИЦЫ В НОСОЧКАХ И ХУДИ В АБСОЛЮТНУЮ БОГИНЮ ТВИЧА :Kreygasm: :miyaLove:',
        isSystemHighlight: true,
      },
      {
        author: 'simp_police_ru',
        color: '#4ade80',
        badge: 'MOD',
        text: 'ОНЛАЙН УЛЕТЕЛ В КОСМОС, ЛЕГЕНДАРНЫЙ СТРИМ!! :Pog: :SubHype:',
      },
    ],
  },
] as const;

export function getSubGoalStageForSubs(subs: number): SubGoalStageIndex {
  let stage: SubGoalStageIndex = 0;
  for (const def of SUB_GOAL_STAGES) {
    if (subs >= def.subsRequired) {
      stage = def.stage;
    }
  }
  return stage;
}

export function getNextSubGoalDef(currentStage: SubGoalStageIndex): SubGoalStageDef | null {
  if (currentStage >= 4) return null;
  return SUB_GOAL_STAGES[(currentStage + 1) as SubGoalStageIndex] ?? null;
}

/**
 * Cost in rubles to gift 1 subscription at current subscriber count.
 * Tuned so 10 -> 50 -> 200 -> 500 subs progresses briskly alongside gear upgrades.
 */
export function getGiftSubUnitCost(currentSubs: number): number {
  if (currentSubs < 10) return 18;
  if (currentSubs < 50) return 28;
  if (currentSubs < 200) return 45;
  return 75;
}

export function getGiftSubPackCost(currentSubs: number, count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += getGiftSubUnitCost(currentSubs + i);
  }
  return total;
}

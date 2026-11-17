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
    unlockEmotion: 'shy',
    unlockLine: '',
    shyApproachLines: [],
    chatCascade: [],
  },
  {
    stage: 1,
    subsRequired: 10,
    shortGoalTitle: 'Снять носочки',
    outfitName: 'Уютное худи + легинсы (босиком)',
    removedItemLabel: '− Носочки сняты!',
    storyDesc:
      '10 сабов: краснея до кончиков ушей, стянула полосатые носочки прямо перед вебкой и осталась с голыми ступнями.',
    plateUrl: '/art/heroine_t1_s1.webp',
    incomeMultiplier: 1.25,
    viewersBonus: 6,
    boldnessBonus: 14,
    unlockEmotion: 'shy',
    unlockLine:
      'А-АХ, ДЕСЯТЬ САБОВ?! П-подождите, я думала вы не соберёте... боже, как стыдно стягивать носочки на камеру... не пяльтесь так на голые пальчики, умоляю!',
    shyApproachLines: [
      'П-подождите, почему полоска Sub Goal так быстро ползёт?! Я же в шутку написала про носочки!',
      'Э-эй, стоп-стоп, осталось совсем чуть-чуть до 10 сабов!! Мне реально придётся сидеть босиком перед чатом?!',
      'Ч-чатик, не кидайте так быстро сабки, я ещё морально не готова раздевать ножки на вебку...',
      'У меня сейчас уши сгорят со стыда... вы правда платите подписками ради моих голых ступней?!',
    ],
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
        text: 'АХАХ КАК ОНА ПОКРАСНЕЛА!! БОСЫЕ СТУПНИ В ЭФИРЕ :Kreygasm: :Kreygasm:',
      },
      {
        author: 'Pasha_Donater',
        color: '#a78bfa',
        badge: 'VIP',
        text: 'так смущается и отводит глазки, держите меня :peepoShy: :miyaLove:',
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
      '50 сабов: дрожащими руками стянула легинсы из-под шортиков — сверху всё то же уютное худи, а снизу голые фарфоровые бёдра!',
    plateUrl: '/art/heroine_t1_s2.webp',
    incomeMultiplier: 1.65,
    viewersBonus: 18,
    boldnessBonus: 22,
    unlockEmotion: 'fluster',
    unlockLine:
      'П-пятьдесят сабов?! Чат, вы безжалостные... отвернулась на секунду и стянула легинсы... м-мамочки, эти микро-шортики вообще ничего не закрывают!',
    shyApproachLines: [
      'С-стойте! Вы видели, какие короткие на мне шортики?! Если добьёте 50 сабов — у меня же все бёдра наружу будут!',
      'Б-блин, зачем я пообещала снять легинсы на пятидесяти... ладошки вспотели, пожалейте скромницу плз!',
      'А-ах, полоска почти заполнена!! Может передумаете? Без легинсов я со стыда под стол спрячусь...',
      'Сердце так колотится от каждого саб-алерта... неужели сейчас правда придётся стягивать легинсы перед всеми?!',
    ],
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
        text: 'она чуть со стыда не расплакалась пока снимала, какая же милая :peepoShy: :miyaLove:',
      },
      {
        author: 'rich_uncle_msk',
        color: '#ffd54f',
        badge: 'DONATE',
        text: 'СЛЕДУЮЩАЯ ЦЕЛЬ 200 САБОВ — СНИМАЕМ ХУДИ!! ЗАРЯЖАЮ САБ-БОМБУ :SubHype: :Pog:',
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
      '200 сабов: пересилив смущение, сбросила жаркое худи — под ним оказалась экстремально тесная кроп-тишка с открытым животиком!',
    plateUrl: '/art/heroine_t1_base.webp',
    incomeMultiplier: 2.35,
    viewersBonus: 45,
    boldnessBonus: 28,
    unlockEmotion: 'tease',
    unlockLine:
      'Двести сабов!! С-сейчас сгорю со стыда, но уговор дороже... Фух, прощай худи! Ну что, шалуны — стоила эта крошечная тишка ваших подписок?~ ♥',
    shyApproachLines: [
      'Э-э?! Почти 200 сабов?! Чат, под этим худи на мне старая тишка на два размера меньше — мне дико стыдно её показывать!',
      'Пальцы уже дрожат на молнии худи... там же такой глубокий вырез, я точно покраснею до самых ключиц!',
      'Шейхи в чате, дайте хоть секунду перевести дух!! Ещё пара сабов — и придётся раздеваться сверху...',
      'Странное чувство: и страшно снимать худи при сотне зрителей, и мурашки от азарта бегут по спине~',
    ],
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
        text: 'сначала стеснялась, а теперь подмигивает чату — вошла во вкус!! :Kreygasm: :Pog:',
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
      '500 сабов: полное раскрепощение — сняла тесную футболку и с томной улыбкой осталась в дерзком чёрном бралетте!',
    plateUrl: '/art/heroine_t1_s4.webp',
    incomeMultiplier: 3.5,
    viewersBonus: 110,
    boldnessBonus: 36,
    unlockEmotion: 'bold',
    unlockLine:
      'ПЯТЬСОТ САБОВ!! В начале стрима я тряслась даже за носочки, а теперь... прощай тишка! Смотрите во все глаза, любимые спонсоры — сегодня я совсем не стесняюсь~ ★ ♥',
    shyApproachLines: [
      'П-почти 500 сабов?! Чат, опомнитесь — под тишкой только чёрный бралетт, меня же Твич не забанит?!',
      'Щёки горят огнём... ещё горстка сабов — и я останусь перед сотнями зрителей почти в одном белье...',
      'Руки тянутся к краю футболки... раньше я бы выключила стрим от стыда, а сейчас безумно хочу добить эту цель с вами~ ♥',
    ],
    chatCascade: [
      {
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: '★★★ 500/500 САБОВ!! ФИНАЛ ПЕРВОГО ДНЯ! ЧЁРНЫЙ БРАЛЕТТ В ПРЯМОМ ЭФИРЕ!! :SubHype: :Pog:',
        isSystemHighlight: true,
      },
      {
        author: 'maksim_simp',
        color: '#fb7185',
        badge: 'SUB',
        text: 'ЭТОТ ТОМНЫЙ ВЗГЛЯД В ЧЁРНОМ БРАЛЕТТЕ — Я ОФИЦИАЛЬНО ВЛЮБЛЁН :BOOBA: :Kreygasm:',
      },
      {
        author: 'rich_uncle_msk',
        color: '#ffd54f',
        badge: 'DONATE',
        text: 'ИЗ ЗАЖАТОЙ СКРОМНИЦЫ В НОСОЧКАХ В БОГИНЮ ТВИЧА :Kreygasm: :miyaLove:',
        isSystemHighlight: true,
      },
      {
        author: 'simp_police_ru',
        color: '#4ade80',
        badge: 'MOD',
        text: 'ФИНАЛ ДНЯ 1 ДОБИТ! ЗАВТРА ВТОРОЙ ДЕНЬ — ВСЕ УЛУЧШЕНИЯ И ВЕЩИ ПЕРЕЕЗЖАЮТ С НАМИ! :Pog: :SubHype:',
        isSystemHighlight: true,
      },
    ],
  },
] as const;

export const DAY1_FINALE_SUBS = 500;

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
  return SUB_GOAL_STAGES[currentStage + 1] ?? null;
}

export function pickShySubGoalApproachLine(
  nextGoal: SubGoalStageDef | null,
  seed: number,
): string | null {
  if (!nextGoal || nextGoal.shyApproachLines.length === 0) return null;
  return nextGoal.shyApproachLines[Math.abs(seed) % nextGoal.shyApproachLines.length]!;
}

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

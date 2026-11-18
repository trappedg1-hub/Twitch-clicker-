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
    day2OutfitName: 'День 2: Оверсайз худи + шорты + гольфы',
    day2StoryDesc:
      'Второй день: бежевое оверсайз худи натянуто через голову, короткие чёрные шорты и плотные чёрные гольфы с двумя белыми полосками, полностью закрывающие ступни. Стыдно за вчерашнее — но она уже умеет держать чат.',
    plateUrl: '/art/heroine_t1_s0.webp',
    day2PlateUrl: '/art/heroine_t2_s0.webp',
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
      'Пальцы уже дрожат, цепляя ворот худи... там же такой глубокий вырез, я точно покраснею до самых ключиц!',
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
        text: 'ИЗ ЗАЖАТОЙ СКРОМНИЦЫ В БОГИНЮ ТВИЧА С БОСЫМИ ПЯТКАМИ :Kreygasm: :miyaLove:',
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

/**
 * Day 2 Sub Goal ladder (1500 / 2000 / 2500 / 5000 subs). Day 1 progress carries over,
 * so the goals are an order of magnitude higher and the "градус" rises step by step:
 * hoodie → grey cropped tee with slouched golf socks → tee knotted at the waist → black
 * camisole with socks gathered at the ankles → finale in a lace bralette, leaning into the
 * webcam with bare feet. The golf socks stay ON (just lower and lower) until the last stage.
 * Her hoodie is always a zipper-less pullover, so every line only describes what that garment allows.
 */
export const DAY2_SUB_GOAL_STAGES: readonly SubGoalStageDef[] = [
  {
    stage: 0,
    subsRequired: 0,
    shortGoalTitle: 'Старт Дня 2',
    outfitName: 'Бежевое худи через голову + шорты + гольфы',
    removedItemLabel: 'Второй день начат',
    storyDesc:
      'Мия вышла в оверсайз худи через голову, коротких шортах и плотных чёрных гольфах с двумя белыми полосками: стыдно за вчерашнее, но чат уже требует продолжения.',
    plateUrl: '/art/heroine_t2_s0.webp',
    incomeMultiplier: 1.0,
    viewersBonus: 40,
    boldnessBonus: 0,
    unlockEmotion: 'fluster',
    unlockLine: '',
    shyApproachLines: [
      'Вы правда всерьёз набьёте ещё полторы тысячи сабов?! Я же только вчера узнала, что такое Sub Goal...',
      'На 1500 сабов я... ну, сниму худи. Через голову, быстро и без деталей! Зачем я это написала!!',
      'Чат, у меня полоска цели снова поползла. Мне и в первый день хватило, честно!',
    ],
    chatCascade: [],
  },
  {
    stage: 1,
    subsRequired: 1500,
    shortGoalTitle: 'Снять худи',
    outfitName: 'Серая укороченная майка + шорты + гольфы, натянутые до колена',
    removedItemLabel: '− Худи снято!',
    storyDesc:
      '1500 сабов: она стянула худи через голову и осталась в серой укороченной майке и шортах; чёрные гольфы натянуты туго до колена — стянуть их с неё чату пока не удалось.',
    plateUrl: '/art/heroine_t2_s1.webp',
    incomeMultiplier: 1.35,
    viewersBonus: 70,
    boldnessBonus: 6,
    unlockEmotion: 'shy',
    unlockLine:
      'Х-хорошо, я снимаю это худи... оно просто сползло с плеч и улетело, честное слово! А гольфы я натянула до колена сама — мне жарко, и это точно не фансервис!',
    shyApproachLines: [
      'Стойте-стойте... до 1500 сабов ещё далеко, я просто пошутила про худи! ...почему все начали кидать сабки?',
      'Я в майке, а худи уже на полу. Вы вообще понимаете, как громко стучит моё сердце прямо сейчас?!',
      'Не снимайте клип! Я сама всё уберу в кадр, только не пишите «градус» и не считайте сабы вслух...',
      'Гольфы натянуты до колена, и сама бы я их не спустила. Никогда. Слышите, чат?!',
    ],
    chatCascade: [
      {
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: '★ SUB GOAL 1500/1500 ВЫПОЛНЕН! Худи ушло за кадр, остались майка и гольфы, натянутые до колена! :Pog: :SubHype:',
        isSystemHighlight: true,
      },
      {
        author: 'sneaker_head',
        color: '#f472b6',
        badge: 'SUB',
        text: 'ГОЛЬФЫ ДЕРЖАТСЯ ДО КОЛЕНА, саб точный :peepoShy: :peepoShy: майка вообще по-домашнему, обнимаю',
      },
      {
        author: 'mod_kira',
        color: '#4ade80',
        badge: 'MOD',
        text: 'Чат, следующий goal — 2000 — там будет жарко. Не торопим девочку :monkaS:',
      },
    ],
  },
  {
    stage: 2,
    subsRequired: 2000,
    shortGoalTitle: 'Худи — на талию',
    outfitName: 'Чёрный топ на бретелях + худи, повязанное на талии + гольфы',
    removedItemLabel: '− Худи завязано на талии!',
    storyDesc:
      '2000 сабов: сверху остался только чёрный топ на тонких бретелях, а бежевое худи она затянула за рукава на талии; гольфы съехали и собраны у щиколоток — ступни по-прежнему закрыты.',
    plateUrl: '/art/heroine_t2_s2.webp',
    incomeMultiplier: 1.75,
    viewersBonus: 120,
    boldnessBonus: 8,
    unlockEmotion: 'tease',
    unlockLine:
      'Всё, худи уезжает на талию... узел затянула сама, чтобы не сползло! Топ на бретелях, а я делаю вид, что это совсем не фансервис~',
    shyApproachLines: [
      'Две тысячи сабов?! Я правда повяжу худи на талии... вы же не думали, что я написала это просто так?',
      'Худи на талии — это практично, в комнате душно! Совсем не для того, чтобы вы так смотрели...',
      'Не считайте вслух, сколько осталось до 2500, я и так всё понимаю про свой топ на бретелях.',
      'Гольфы я не снимаю, они у щиколоток — вот и весь ваш-plan. Пока что.',
    ],
    chatCascade: [
      {
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: '★ SUB GOAL 2000/2000! Худи затянуто на талии, остался чёрный топ на бретелях :Pog: :SubHype:',
        isSystemHighlight: true,
      },
      {
        author: 'ice_tea_max',
        color: '#f472b6',
        badge: 'VIP',
        text: 'она сама завязала рукава узлом и делает вид что душно :LUL: :peepoShy:',
      },
      {
        author: 'chat_navigator',
        color: '#4ade80',
        badge: 'SUB',
        text: '2500 сабов — спускаем лямку с плеча. Мия, у нас уже план, не сопротивляйся :Pog:',
      },
    ],
  },
  {
    stage: 3,
    subsRequired: 2500,
    shortGoalTitle: 'Спустить лямки',
    outfitName: 'Топ с съехавшими лямками + худи за спиной + гольфы, натянутые обратно',
    removedItemLabel: '− Лямки спущены!',
    storyDesc:
      '2500 сабов: обе бретельки топа съехали на плечи, живот открыт, худи развязано и висит за спиной на локтях, руки на подлокотниках, колени тянутся к камере — а гольфы она на всякий случай натянула обратно до колена.',
    plateUrl: '/art/heroine_t2_s3.webp',
    incomeMultiplier: 2.25,
    viewersBonus: 200,
    boldnessBonus: 10,
    unlockEmotion: 'fluster',
    unlockLine:
      'Лямки... лямки сами съехали! Ну и не подниму. Худи пусть висит за спиной, а гольфы я натянула обратно — хоть что-то я ещё могу контролировать~',
    shyApproachLines: [
      'Две с половиной тысячи?! Бретельки держатся на честном слове, как и моё терпение, чатик!',
      'Не надо «подними лямку» — я её как раз опускаю. Это называется раскрепощение, а не ваш plan.',
      'Худи за спиной, колени вместе, я смотрю прямо в объектив... и почему мне вдруг не стыдно?',
      'Остались гольфы. Один шаг. И я заранее краснею от того, что сама это написала в описании цели.',
    ],
    chatCascade: [
      {
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: '★ SUB GOAL 2500/2500! Обе лямки съехали, худи висит за спиной, колени у самой камеры :monkaS: :SubHype:',
        isSystemHighlight: true,
      },
      {
        author: 'ice_tea_max',
        color: '#f472b6',
        badge: 'VIP',
        text: 'руки на подлокотниках, взгляд в объектив — это уже не «я стесняшечка» :Kreygasm:',
      },
      {
        author: 'sneaker_head',
        color: '#4ade80',
        badge: 'SUB',
        text: 'гольфы она натянула обратно, зато лямки лежат на плечах — финал на 5000, добиваем :Pog: :AWOOGA:',
      },
    ],
  },
  {
    stage: 4,
    subsRequired: 5000,
    shortGoalTitle: 'Снять топ и гольфы — финал',
    outfitName: 'Чёрный топ-бра на бретелях + шорты, босые ступни',
    removedItemLabel: '− Топ и гольфы сняты!',
    storyDesc:
      '5000 сабов: финал Дня 2 — с топа она осталась только в бра на тонких бретелях, шорты те же, худи болтается на локтях за спиной, майка скомкана прямо на сиденье. Гольфы улетели за кадр: она встала на колени на кресло и подалась к вебке, уперевшись ладонями в подушку.',
    plateUrl: '/art/heroine_t2_s4.webp',
    incomeMultiplier: 2.9,
    viewersBonus: 320,
    boldnessBonus: 12,
    unlockEmotion: 'bold',
    unlockLine:
      'Пять тысяч... ладно! На коленях, прямо у камеры, худи за спиной, гольфы в углу. Я сама выбрала эту позу — вчера бы умерла от стыда, а сегодня мне нравится~ ★ ♥',
    shyApproachLines: [],
    chatCascade: [
      {
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: '★ SUB GOAL 5000/5000 ПРОБИТ! ФИНАЛ ДНЯ 2: босые ступни, наклон к вебке, чат в огне :Pog: :AWOOGA: :SubHype:',
        isSystemHighlight: true,
      },
      {
        author: 'feet_connoisseur',
        color: '#f472b6',
        badge: 'SUB',
        text: 'ГОЛЬФЫ УШЛИ!!! она встала на колени у камеры, я не верю своим глазам :Kreygasm: :Kreygasm:',
      },
      {
        author: 'cyber_pelmen',
        color: '#a78bfa',
        badge: 'VIP',
        text: 'день 2 → она уже ведёт игру. Мия, ты страшный человек, я горжусь :LUL: :miyaLove:',
      },
    ],
  },
] as const;

export const DAY1_STEP_LABELS = ['10 Носки', '50 Легинсы', '200 Худи', '500 Тишка'];
export const DAY1_SHORT_STEP_LABELS = ['10', '50', '200', '500'];
export const DAY2_STEP_LABELS = ['1500 Худи', '2000 Талия', '2500 Лямки', '5000 Гольфы'];
export const DAY2_SHORT_STEP_LABELS = ['1500', '2000', '2500', '5000'];

export const DAY1_FINALE_SUBS = 500;
/**
 * Day 3 = COSPLAY DAY. She promised the chat a surprise, and the costume is a bunny cosplay:
 * a beige pullover hoodie with sewn-on ears + a convention name badge, a white lace-trim cropped
 * top, the same black shorts, and white golf socks with two red stripes and little ribbons.
 *
 * Same costume discipline as Day 2: ONE garment set for the whole day, escalation only REMOVES or
 * RE-TIES what already exists. No skirt, no dress, no zipper, no invented accessories on later
 * stages - the copy is written from the plate, and tests/wardrobe.ts proves it.
 */
export const DAY3_SUB_GOAL_STAGES: readonly SubGoalStageDef[] = [
  {
    stage: 0,
    subsRequired: 0,
    shortGoalTitle: 'Старт Дня 3 (призрак)',
    outfitName: 'Простыня на голове и плечах + чёрное боди с открытым животом + полные чулки в сетку',
    removedItemLabel: 'День 3 начат',
    storyDesc:
      'Мия вышла «призрачной стримершей»: белая простыня перекинута через голову и плечи, дырки для глаз вырезаны криво, лицо видно только через них. Ткань она собирает у ключиц руками, поэтому сверху это мем, а снизу — чёрное боди с открытым животом и сетка от верха бедра до самых ступней. Ступни тоже в сетке: оба подошвенных среза смотрят в камеру и лежат на столе, потому что ноги она закинула на столешницу и не собирается убирать. День только начался, а чат уже считает кадры.',
    incomeMultiplier: 1.0,
    viewersBonus: 0,
    boldnessBonus: 0,
    unlockEmotion: 'shy',
    unlockLine: '',
    plateUrl: '/art/heroine_t3_s0.webp',
    shyApproachLines: [
      'Это простыня, чат. Я её сама ножницами кромсала. Бу? Бу. Всё, теперь можно смотреть.',
      'Дырки я вырезала криво, поэтому вы видите только мои глаза и улыбку. И да, глаза подведены, спасибо~',
    ],
    chatCascade: [
      {
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: '★ ДЕНЬ 3: «ПРИЗРАЧНАЯ СТРИМЕРША» ВЫШЛА В ПРОСТЫНЕ :Pog: :SubHype: бу-бу',
        isSystemHighlight: true,
      },
      {
        author: 'Pasha_Donater',
        color: '#ff6b9d',
        badge: 'VIP',
        text: 'простыня на голове, ступни в сетке лежат на столе, и это весь косплей :AWOOGA:',
      },
      {
        author: 'kaktus_mod',
        color: '#4ecdc4',
        badge: 'MOD',
        text: 'правило дня: никто не просит «снять простыню». мы просто скидываем на 7000 :EZ: :ClipIt:',
      },
    ],
  },
  {
    stage: 1,
    subsRequired: 7000,
    shortGoalTitle: 'Подол простыни задран',
    outfitName: 'Простыня, собранная в руках до груди + нижняя часть боди и обе ноги в сетке',
    removedItemLabel: '− Простыня поднята до груди!',
    storyDesc:
      '7000 сабов: она взяла подол простыни в обе руки и подняла его себе под мышки. Ткань теперь закрывает только голову, плечи и грудь — зато всё ниже открыто целиком: живот, боди с высоким вырезом и обе ноги в мелкой сетке. Ступни в сетке по-прежнему лежат на столе, и именно они собрали больше клипов, чем сам трюк с подолом.',
    incomeMultiplier: 1.5,
    viewersBonus: 260,
    boldnessBonus: 5,
    unlockEmotion: 'tease',
    unlockLine:
      'Подол задран, потому что ткань шуршит и лезет в глаза. Совпадение, что видно всё ниже? Абсолютное~',
    plateUrl: '/art/heroine_t3_s1.webp',
    shyApproachLines: [
      'Я держу ткань руками. Руками, чат, а не силой обстоятельств — сразу договоримся на берегу.',
      'Ниже ткани у меня боди и сетка. Вы это видели и до подъема, я просто убрала лишний слой мишуры.',
    ],
    chatCascade: [
      {
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: '★ SUB GOAL 7000/7000! ОНА ПОДНЯЛА ПОДОЛ — НИЖНЯЯ ЧАСТЬ БОДИ И СЕТКА В КАДРЕ :Pog: :AWOOGA:',
        isSystemHighlight: true,
      },
      {
        author: 'neko_chan_uwu',
        color: '#ff75c3',
        badge: 'SUB',
        text: 'призрак с подоткнутой простынёй — это новый жанр, чат уже рисует фанарт :ClipIt: :LUL:',
      },
      {
        author: 'feet_connoisseur',
        color: '#f472b6',
        badge: 'SUB',
        text: 'ступни тоже в сетке и лежат на столе. дальше 10000: простыня уедет на голову :monkaS: :Overheat:',
      },
    ],
  },
  {
    stage: 2,
    subsRequired: 10000,
    shortGoalTitle: 'Простыня только на голове',
    outfitName: 'Простыня-капюшон на голове + костюм виден целиком + полные чулки в сетку',
    removedItemLabel: '− Ткань ушла с тела!',
    storyDesc:
      '10000 сабов: простыня осталась только на голове — маленький белый капюшон с двумя дырками, из-под которого высыпались волосы. Всё остальное видно как есть: боди, живот, сетка на ногах, и поза тоже новая — она встала на четвереньки на сиденье, выгнула спину и развернулась так, что обе ступни в сетке задраны вверх, к камере. Мем-призрак закончился, начался косплей-стенд.',
    incomeMultiplier: 2.0,
    viewersBonus: 520,
    boldnessBonus: 7,
    unlockEmotion: 'fluster',
    unlockLine:
      'Я не «показала всё», я просто поменяла позу. Сидеть на четвереньках удобнее, чат, это эргономика~',
    plateUrl: '/art/heroine_t3_s2.webp',
    shyApproachLines: [
      'Ткань на голове, спина выгнута, ноги в сетке подняты. Ни одного слова «случайно», я взрослая.',
      'Я смотрю через дырки именно на вас, а не вы на меня. Это принципиально разные векторы, чат.',
    ],
    chatCascade: [
      {
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: '★ SUB GOAL 10000/10000! ПРОСТЫНЯ ОСТАЛАСЬ ТОЛЬКО НА ГОЛОВЕ, ПОЗА — НА ЧЕТВЕРЕНЬКАХ :AWOOGA: :Pog:',
        isSystemHighlight: true,
      },
      {
        author: 'Pasha_Donater',
        color: '#ff6b9d',
        badge: 'VIP',
        text: 'капюшон из простыни, ступни в сетке — это же обложка, легион, мы делаем обложку :Kreygasm: :Nosebleed:',
      },
      {
        author: 'kaktus_mod',
        color: '#4ecdc4',
        badge: 'MOD',
        text: '13000: призрак сорвёт с себя ткань на «Бу!». спамим «бу», не спамим просьбами, мы культурные мертвецы :LUL: :ClipIt:',
      },
    ],
  },
  {
    stage: 3,
    subsRequired: 13000,
    shortGoalTitle: 'Бу! — простыня слетела',
    outfitName: 'Простыня в руках, в воздухе + костюм целиком + полные чулки в сетку',
    removedItemLabel: '− Простыня в воздухе!',
    storyDesc:
      '13000 сабов: тот самый кадр, ради которого весь gimmick и жил. Она срывает простыню с головы обеими руками, ткань замирает в воздухе над плечами, лицо свободное, рот открыт в игровом «Бу!», волосы прыгают вперёд. На ней только боди и сетка — ни одного лоскута ткани сверху, и ни одного пальца, который она бы прятала. Через долю секунды кадр вернётся к обычному виду, но клипы уже нарезаны.',
    incomeMultiplier: 2.6,
    viewersBonus: 860,
    boldnessBonus: 9,
    unlockEmotion: 'bold',
    unlockLine:
      'БУ!.. всё, ткань в руках, выдыхайте. Нет, я её не снимала — я её ПОДНЯЛА. Разница есть, чат~',
    plateUrl: '/art/heroine_t3_s3.webp',
    shyApproachLines: [
      'Ткань в воздухе, костюм на месте. Вы сейчас посмотрите на боди и назовёте это призрачным ужасом.',
      'Я знаю, что вы нарезали этот кадр. Я специально его оставила. Бу! — и всё, расходимся~',
    ],
    chatCascade: [
      {
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: '★ SUB GOAL 13000/13000! ПРОСТЫНЯ СЛЕТЕЛА, КАДР «БУ!» ПОШЁЛ В КЛИПЫ :Pog: :AWOOGA: :SubHype:',
        isSystemHighlight: true,
      },
      {
        author: 'neko_chan_uwu',
        color: '#ff75c3',
        badge: 'SUB',
        text: 'она держит ткань над головой и орёт «бу», а чат орит иначе. 47 клипов за минуту, статистика не врёт :ClipIt: :LUL:',
      },
      {
        author: 'cosplay_anon',
        color: '#00e5ff',
        badge: 'VIP',
        text: '15000 и простыня станет плащом на плечах. это финал костюма, легион, добиваем :SubHype: :monkaS:',
      },
    ],
  },
  {
    stage: 4,
    subsRequired: 15000,
    shortGoalTitle: 'Простыня как плащ, одна нога в камеру',
    outfitName: 'Простыня-плащ на плечах + боди с открытым животом + одна нога в сетке на камеру',
    removedItemLabel: '− Финал: плащ из простыни!',
    storyDesc:
      '15000 сабов: финальная фаза костюма. Простыня больше не прикрытие — она закреплена на плечах и висит за спиной как плащ, раздуваясь в стороны, поэтому лицо, плечи и живот свободны целиком. В камеру смотрит одна нога: вытянутая, в мелкой сетке от бедра до ступни, лежащая на столе. Второй палец у губ, один глаз закрыт подмигиванием — она не раздевается, она дразнит, и это, чат, разрешённый жанр.',
    incomeMultiplier: 3.2,
    viewersBonus: 1300,
    boldnessBonus: 10,
    unlockEmotion: 'bold',
    unlockLine:
      'Финал: плащ на плечах, нога в сетке на столе, палец на губах. Бу! — и это последнее «бу» сегодня~ ★ ♥',
    plateUrl: '/art/heroine_t3_s4.webp',
    shyApproachLines: [
      'Плащ из простыни — финальная форма призрака. Я её ношу с гордостью и с открытым животом.',
      'Одна нога в камеру, вторая спрятана. Это не «всё показали», это «показали ровно сколько я решила»~',
    ],
    chatCascade: [
      {
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: '★ SUB GOAL 15000/15000! ПРОСТЫНЯ СТАЛА ПЛАЩОМ, ОДНА НОГА В КАМЕРУ :AWOOGA: :Pog: :SubHype:',
        isSystemHighlight: true,
      },
      {
        author: 'Pasha_Donater',
        color: '#ff6b9d',
        badge: 'VIP',
        text: 'плащ, сетка, палец к губам. я умер, и это был лучший косплей-стрим :Kreygasm: :Nosebleed:',
      },
      {
        author: 'kaktus_mod',
        color: '#4ecdc4',
        badge: 'MOD',
        text: 'финал принят жюри чата. клип «призрак в плаще» уходит в топ месяца :ClipIt: :miyaLove:',
      },
      {
        author: 'cosplay_anon',
        color: '#00e5ff',
        badge: 'VIP',
        text: 'день 3 закрыт на 15000. призрак ушёл сквозь стену, мы остались с плащом в истории :LUL: :sub2:',
      },
    ],
  },
] as const;

/** The «Бу!» flash frame: sheet off, bodysuit + fishnets — crossfaded in for a few hundred ms. */
export const DAY3_FLASH_PLATE = '/art/heroine_t3_flash.webp';

export const DAY3_STEP_LABELS = ['7000 Подол', '10000 Четвереньки', '13000 Бу!', '15000 Плащ'];
export const DAY3_SHORT_STEP_LABELS = ['7000', '10000', '13000', '15000'];
export const DAY3_FINALE_SUBS = 15000;

/**
 * Day 3 art is cut separately (cosplay plates heroine_t3_s0..s4). Until those files actually ship,
 * the day stays locked so nobody can walk into a half-dressed ladder.
 *
 * The gate reads `window.__day3Unlocked` first (QA / manual override), otherwise it reflects the
 * HEAD probe below: the moment the five plates exist in `public/art`, Day 3 unlocks by itself.
 */
let day3ArtProbe = false;

export function isDay3Unlocked(): boolean {
  try {
    const forced = (window as unknown as { __day3Unlocked?: boolean }).__day3Unlocked;
    if (forced === true || forced === false) return forced;
  } catch {
    /* no window during tests */
  }
  return day3ArtProbe;
}

/**
 * Probe the cosplay plate ladder once; flips the Day 3 button as soon as the art is in place.
 * The dev server answers missing files with the SPA index.html (status 200), so the content type
 * is the real signal here - not `res.ok`.
 */
export async function probeDay3Art(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const files = [...DAY3_SUB_GOAL_STAGES.map((def) => def.plateUrl), DAY3_FLASH_PLATE];
    const checks = await Promise.all(
      files.map((url) =>
        fetch(url, { method: 'HEAD' })
          .then((res) => res.ok && (res.headers.get('content-type') ?? '').startsWith('image/'))
          .catch(() => false),
      ),
    );
    day3ArtProbe = checks.every(Boolean);
  } catch {
    day3ArtProbe = false;
  }
  return day3ArtProbe;
}

/** Day 2 runs on its own ladder: Day 1 goals are already paid off, so the bar is 10x higher. */
/** Step labels follow the live day, so the OBS ladder never shows Day 1 wording on Day 3. */
export function getStepLabelsForDay(streamDay: number): readonly string[] {
  if (streamDay === 3) return DAY3_STEP_LABELS;
  if (streamDay === 2) return DAY2_STEP_LABELS;
  return DAY1_STEP_LABELS;
}

export function getShortStepLabelsForDay(streamDay: number): readonly string[] {
  if (streamDay === 3) return DAY3_SHORT_STEP_LABELS;
  if (streamDay === 2) return DAY2_SHORT_STEP_LABELS;
  return DAY1_SHORT_STEP_LABELS;
}

export function getSubGoalStagesForDay(streamDay: number): readonly SubGoalStageDef[] {
  if (streamDay === 3) return DAY3_SUB_GOAL_STAGES;
  if (streamDay === 2) return DAY2_SUB_GOAL_STAGES;
  return SUB_GOAL_STAGES;
}

/**
 * Subscribers that CLOSE a day: its last ladder step (500 / 5000 / 15000). Day 1 spells it out as
 * DAY1_FINALE_SUBS and the two agree, so the ladder stays the only thing a designer has to edit.
 * The finale card, its CTA and the debug jumps all read this one number.
 */
export function dayFinaleSubs(streamDay: number): number {
  const ladder = getSubGoalStagesForDay(streamDay);
  return ladder[ladder.length - 1]?.subsRequired ?? DAY1_FINALE_SUBS;
}

export function getSubGoalStageForSubs(subs: number, streamDay: number = 1): SubGoalStageIndex {
  let stage: SubGoalStageIndex = 0;
  for (const def of getSubGoalStagesForDay(streamDay)) {
    if (subs >= def.subsRequired) {
      stage = def.stage;
    }
  }
  return stage;
}

export function getNextSubGoalDef(
  currentStage: SubGoalStageIndex,
  streamDay: number = 1,
): SubGoalStageDef | null {
  return getSubGoalStagesForDay(streamDay)[currentStage + 1] ?? null;
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
  if (currentSubs < 500) return 75;
  // Day 2 goals are 1500 / 2000 / 2500 / 5000 subs — the price curve keeps climbing with them.
  if (currentSubs < 1500) return 110;
  if (currentSubs < 2500) return 150;
  if (currentSubs < 5000) return 195;
  // Day 3 (ghost cosplay) climbs to 15000 subs, so the curve keeps going up with it.
  if (currentSubs < 7000) return 240;
  if (currentSubs < 10000) return 320;
  if (currentSubs < 13000) return 400;
  if (currentSubs < 15000) return 470;
  return 560;
}

export function getGiftSubPackCost(currentSubs: number, count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += getGiftSubUnitCost(currentSubs + i);
  }
  return total;
}

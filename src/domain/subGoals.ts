import type { SubGoalStageDef, SubGoalStageIndex } from "./types.ts";

export const SUB_GOAL_STAGES: readonly SubGoalStageDef[] = [
  {
    stage: 0,
    subsRequired: 0,
    shortGoalTitle: "Старт эфира",
    outfitName: "Уютное худи + легинсы + носочки",
    removedItemLabel: "Стартовый образ",
    storyDesc:
      "Мия жутко стесняется первого эфира, поэтому укуталась в домашнее худи, плотные легинсы под шортиками и полосатые носочки.",
    day2OutfitName: "День 2: Оверсайз худи + шорты + гольфы",
    day2StoryDesc:
      "Второй день: бежевое оверсайз худи натянуто через голову, короткие чёрные шорты и плотные чёрные гольфы с двумя белыми полосками, полностью закрывающие ступни. Стыдно за вчерашнее — но она уже умеет держать чат.",
    plateUrl: "/art/heroine_t1_s0.webp",
    day2PlateUrl: "/art/heroine_t2_s0.webp",
    incomeMultiplier: 1.0,
    viewersBonus: 0,
    boldnessBonus: 0,
    unlockEmotion: "shy",
    unlockLine: "",
    shyApproachLines: [],
    chatCascade: [],
  },
  {
    stage: 1,
    subsRequired: 10,
    shortGoalTitle: "Снять носочки",
    outfitName: "Уютное худи + легинсы (босиком)",
    removedItemLabel: "− Носочки сняты!",
    storyDesc:
      "10 сабов: краснея до кончиков ушей, стянула полосатые носочки прямо перед вебкой и осталась с голыми ступнями.",
    plateUrl: "/art/heroine_t1_s1.webp",
    incomeMultiplier: 1.25,
    viewersBonus: 6,
    boldnessBonus: 14,
    unlockEmotion: "shy",
    unlockLine:
      "А-АХ, ДЕСЯТЬ САБОВ?! П-подождите, я думала вы не соберёте... боже, как стыдно стягивать носочки на камеру... не пяльтесь так на голые пальчики, умоляю!",
    shyApproachLines: [
      "П-подождите, почему полоска Sub Goal так быстро ползёт?! Я же в шутку написала про носочки!",
      "Э-эй, стоп-стоп, осталось совсем чуть-чуть до 10 сабов!! Мне реально придётся сидеть босиком перед чатом?!",
      "Ч-чатик, не кидайте так быстро сабки, я ещё морально не готова раздевать ножки на вебку...",
      "У меня сейчас уши сгорят со стыда... вы правда платите подписками ради моих голых ступней?!",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 10/10 ВЫПОЛНЕН! Носочки улетели из кадра! :Pog: :SubHype:",
        isSystemHighlight: true,
      },
      {
        author: "feet_connoisseur",
        color: "#f472b6",
        badge: "SUB",
        text: "АХАХ КАК ОНА ПОКРАСНЕЛА!! БОСЫЕ СТУПНИ В ЭФИРЕ :Kreygasm: :Kreygasm:",
      },
      {
        author: "Pasha_Donater",
        color: "#a78bfa",
        badge: "VIP",
        text: "так смущается и отводит глазки, держите меня :peepoShy: :miyaLove:",
      },
      {
        author: "simp_police_ru",
        color: "#4ade80",
        badge: "MOD",
        text: "ЧАТ ЖМЁМ ДАЛЬШЕ, НА 50 САБОВ СНИМАЕМ ЛЕГИНСЫ!! :SubHype: :BOOBA:",
      },
    ],
  },
  {
    stage: 2,
    subsRequired: 50,
    shortGoalTitle: "Снять легинсы",
    outfitName: "То же худи + голые ножки в шортиках",
    removedItemLabel: "− Легинсы сняты!",
    storyDesc:
      "50 сабов: дрожащими руками стянула легинсы из-под шортиков — сверху всё то же уютное худи, а снизу голые фарфоровые бёдра!",
    plateUrl: "/art/heroine_t1_s2.webp",
    incomeMultiplier: 1.65,
    viewersBonus: 18,
    boldnessBonus: 22,
    unlockEmotion: "fluster",
    unlockLine:
      "П-пятьдесят сабов?! Чат, вы безжалостные... отвернулась на секунду и стянула легинсы... м-мамочки, эти микро-шортики вообще ничего не закрывают!",
    shyApproachLines: [
      "С-стойте! Вы видели, какие короткие на мне шортики?! Если добьёте 50 сабов — у меня же все бёдра наружу будут!",
      "Б-блин, зачем я пообещала снять легинсы на пятидесяти... ладошки вспотели, пожалейте скромницу плз!",
      "А-ах, полоска почти заполнена!! Может передумаете? Без легинсов я со стыда под стол спрячусь...",
      "Сердце так колотится от каждого саб-алерта... неужели сейчас правда придётся стягивать легинсы перед всеми?!",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 50/50 ПРОБИТ! Легинсы сняты в прямом эфире! :Pog: :SubHype:",
        isSystemHighlight: true,
      },
      {
        author: "maksim_simp",
        color: "#fb7185",
        badge: "SUB",
        text: "ГОЛЫЕ ФАРФОРОВЫЕ БЁДРА ПОД ЭТИМ ХУДИ ПРОСТО РАЗРЫВ СЕРДЦА :BOOBA: :Kreygasm:",
      },
      {
        author: "cyber_stalker77",
        color: "#60a5fa",
        text: "она чуть со стыда не расплакалась пока снимала, какая же милая :peepoShy: :miyaLove:",
      },
      {
        author: "rich_uncle_msk",
        color: "#ffd54f",
        badge: "DONATE",
        text: "СЛЕДУЮЩАЯ ЦЕЛЬ 200 САБОВ — СНИМАЕМ ХУДИ!! ЗАРЯЖАЮ САБ-БОМБУ :SubHype: :Pog:",
        isSystemHighlight: true,
      },
    ],
  },
  {
    stage: 3,
    subsRequired: 200,
    shortGoalTitle: "Снять худи",
    outfitName: "Тесная кроп-тишка с глубоким вырезом",
    removedItemLabel: "− Худи снято!",
    storyDesc:
      "200 сабов: пересилив смущение, сбросила жаркое худи — под ним оказалась экстремально тесная кроп-тишка с открытым животиком!",
    plateUrl: "/art/heroine_t1_base.webp",
    incomeMultiplier: 2.35,
    viewersBonus: 45,
    boldnessBonus: 28,
    unlockEmotion: "tease",
    unlockLine:
      "Двести сабов!! С-сейчас сгорю со стыда, но уговор дороже... Фух, прощай худи! Ну что, шалуны — стоила эта крошечная тишка ваших подписок?~ ♥",
    shyApproachLines: [
      "Э-э?! Почти 200 сабов?! Чат, под этим худи на мне старая тишка на два размера меньше — мне дико стыдно её показывать!",
      "Пальцы уже дрожат, цепляя ворот худи... там же такой глубокий вырез, я точно покраснею до самых ключиц!",
      "Шейхи в чате, дайте хоть секунду перевести дух!! Ещё пара сабов — и придётся раздеваться сверху...",
      "Странное чувство: и страшно снимать худи при сотне зрителей, и мурашки от азарта бегут по спине~",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★★ SUB GOAL 200/200!! ХУДИ УЛЕТЕЛО С ПЛЕЧ!! :BOOBA: :BOOBA: :SubHype:",
        isSystemHighlight: true,
      },
      {
        author: "night_watcher_",
        color: "#34d399",
        badge: "SUB",
        text: "ОНА ВСЁ ЭТО ВРЕМЯ ПРЯТАЛА ТАКОЕ ДЕКОЛЬТЕ ПОД ХУДИ?! :BOOBA: :Kreygasm:",
      },
      {
        author: "dima_bez_sna",
        color: "#facc15",
        badge: "VIP",
        text: "сначала стеснялась, а теперь подмигивает чату — вошла во вкус!! :Kreygasm: :Pog:",
      },
      {
        author: "VIP_Donater",
        color: "#ffd54f",
        badge: "DONATE",
        text: "ФИНАЛ 500 САБОВ — ДОЛОЙ ТИШКУ, ОСТАЁТСЯ БРАЛЕТТ!! ЖМЁМ ВСЕЙ КОМНАТОЙ :SubHype: :BOOBA:",
        isSystemHighlight: true,
      },
    ],
  },
  {
    stage: 4,
    subsRequired: 500,
    shortGoalTitle: "Снять тишку (Бралетт!)",
    outfitName: "Чёрный халтер-бралетт и микро-шортики",
    removedItemLabel: "− Тишка снята! Финал ★",
    storyDesc:
      "500 сабов: полное раскрепощение — сняла тесную футболку и с томной улыбкой осталась в дерзком чёрном бралетте!",
    plateUrl: "/art/heroine_t1_s4.webp",
    incomeMultiplier: 3.5,
    viewersBonus: 110,
    boldnessBonus: 36,
    unlockEmotion: "bold",
    unlockLine:
      "ПЯТЬСОТ САБОВ!! В начале стрима я тряслась даже за носочки, а теперь... прощай тишка! Смотрите во все глаза, любимые спонсоры — сегодня я совсем не стесняюсь~ ★ ♥",
    shyApproachLines: [
      "П-почти 500 сабов?! Чат, опомнитесь — под тишкой только чёрный бралетт, меня же Твич не забанит?!",
      "Щёки горят огнём... ещё горстка сабов — и я останусь перед сотнями зрителей почти в одном белье...",
      "Руки тянутся к краю футболки... раньше я бы выключила стрим от стыда, а сейчас безумно хочу добить эту цель с вами~ ♥",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★★★ 500/500 САБОВ!! ФИНАЛ ПЕРВОГО ДНЯ! ЧЁРНЫЙ БРАЛЕТТ В ПРЯМОМ ЭФИРЕ!! :SubHype: :Pog:",
        isSystemHighlight: true,
      },
      {
        author: "maksim_simp",
        color: "#fb7185",
        badge: "SUB",
        text: "ЭТОТ ТОМНЫЙ ВЗГЛЯД В ЧЁРНОМ БРАЛЕТТЕ — Я ОФИЦИАЛЬНО ВЛЮБЛЁН :BOOBA: :Kreygasm:",
      },
      {
        author: "rich_uncle_msk",
        color: "#ffd54f",
        badge: "DONATE",
        text: "ИЗ ЗАЖАТОЙ СКРОМНИЦЫ В БОГИНЮ ТВИЧА С БОСЫМИ ПЯТКАМИ :Kreygasm: :miyaLove:",
        isSystemHighlight: true,
      },
      {
        author: "simp_police_ru",
        color: "#4ade80",
        badge: "MOD",
        text: "ФИНАЛ ДНЯ 1 ДОБИТ! ЗАВТРА ВТОРОЙ ДЕНЬ — ВСЕ УЛУЧШЕНИЯ И ВЕЩИ ПЕРЕЕЗЖАЮТ С НАМИ! :Pog: :SubHype:",
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
    shortGoalTitle: "Старт Дня 2",
    outfitName: "Бежевое худи через голову + шорты + гольфы",
    removedItemLabel: "Второй день начат",
    storyDesc:
      "Мия вышла в оверсайз худи через голову, коротких шортах и плотных чёрных гольфах с двумя белыми полосками: стыдно за вчерашнее, но чат уже требует продолжения.",
    plateUrl: "/art/heroine_t2_s0.webp",
    incomeMultiplier: 1.0,
    viewersBonus: 40,
    boldnessBonus: 0,
    unlockEmotion: "fluster",
    unlockLine: "",
    shyApproachLines: [
      "Вы правда всерьёз набьёте ещё полторы тысячи сабов?! Я же только вчера узнала, что такое Sub Goal...",
      "На 1500 сабов я... ну, сниму худи. Через голову, быстро и без деталей! Зачем я это написала!!",
      "Чат, у меня полоска цели снова поползла. Мне и в первый день хватило, честно!",
    ],
    chatCascade: [],
  },
  {
    stage: 1,
    subsRequired: 1500,
    shortGoalTitle: "Снять худи",
    outfitName: "Серая укороченная майка + шорты + гольфы, натянутые до колена",
    removedItemLabel: "− Худи снято!",
    storyDesc:
      "1500 сабов: она стянула худи через голову и осталась в серой укороченной майке и шортах; чёрные гольфы натянуты туго до колена — стянуть их с неё чату пока не удалось.",
    plateUrl: "/art/heroine_t2_s1.webp",
    incomeMultiplier: 1.35,
    viewersBonus: 70,
    boldnessBonus: 6,
    unlockEmotion: "shy",
    unlockLine:
      "Х-хорошо, я снимаю это худи... оно просто сползло с плеч и улетело, честное слово! А гольфы я натянула до колена сама — мне жарко, и это точно не фансервис!",
    shyApproachLines: [
      "Стойте-стойте... до 1500 сабов ещё далеко, я просто пошутила про худи! ...почему все начали кидать сабки?",
      "Я в майке, а худи уже на полу. Вы вообще понимаете, как громко стучит моё сердце прямо сейчас?!",
      "Не снимайте клип! Я сама всё уберу в кадр, только не пишите «градус» и не считайте сабы вслух...",
      "Гольфы натянуты до колена, и сама бы я их не спустила. Никогда. Слышите, чат?!",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 1500/1500 ВЫПОЛНЕН! Худи ушло за кадр, остались майка и гольфы, натянутые до колена! :Pog: :SubHype:",
        isSystemHighlight: true,
      },
      {
        author: "sneaker_head",
        color: "#f472b6",
        badge: "SUB",
        text: "ГОЛЬФЫ ДЕРЖАТСЯ ДО КОЛЕНА, саб точный :peepoShy: :peepoShy: майка вообще по-домашнему, обнимаю",
      },
      {
        author: "mod_kira",
        color: "#4ade80",
        badge: "MOD",
        text: "Чат, следующий goal — 2000 — там будет жарко. Не торопим девочку :monkaS:",
      },
    ],
  },
  {
    stage: 2,
    subsRequired: 2000,
    shortGoalTitle: "Худи — на талию",
    outfitName: "Чёрный топ на бретелях + худи, повязанное на талии + гольфы",
    removedItemLabel: "− Худи завязано на талии!",
    storyDesc:
      "2000 сабов: сверху остался только чёрный топ на тонких бретелях, а бежевое худи она затянула за рукава на талии; гольфы съехали и собраны у щиколоток — ступни по-прежнему закрыты.",
    plateUrl: "/art/heroine_t2_s2.webp",
    incomeMultiplier: 1.75,
    viewersBonus: 120,
    boldnessBonus: 8,
    unlockEmotion: "tease",
    unlockLine:
      "Всё, худи уезжает на талию... узел затянула сама, чтобы не сползло! Топ на бретелях, а я делаю вид, что это совсем не фансервис~",
    shyApproachLines: [
      "Две тысячи сабов?! Я правда повяжу худи на талии... вы же не думали, что я написала это просто так?",
      "Худи на талии — это практично, в комнате душно! Совсем не для того, чтобы вы так смотрели...",
      "Не считайте вслух, сколько осталось до 2500, я и так всё понимаю про свой топ на бретелях.",
      "Гольфы я не снимаю, они у щиколоток — вот и весь ваш-plan. Пока что.",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 2000/2000! Худи затянуто на талии, остался чёрный топ на бретелях :Pog: :SubHype:",
        isSystemHighlight: true,
      },
      {
        author: "ice_tea_max",
        color: "#f472b6",
        badge: "VIP",
        text: "она сама завязала рукава узлом и делает вид что душно :LUL: :peepoShy:",
      },
      {
        author: "chat_navigator",
        color: "#4ade80",
        badge: "SUB",
        text: "2500 сабов — спускаем лямку с плеча. Мия, у нас уже план, не сопротивляйся :Pog:",
      },
    ],
  },
  {
    stage: 3,
    subsRequired: 2500,
    shortGoalTitle: "Спустить лямки",
    outfitName:
      "Топ с съехавшими лямками + худи за спиной + гольфы, натянутые обратно",
    removedItemLabel: "− Лямки спущены!",
    storyDesc:
      "2500 сабов: обе бретельки топа съехали на плечи, живот открыт, худи развязано и висит за спиной на локтях, руки на подлокотниках, колени тянутся к камере — а гольфы она на всякий случай натянула обратно до колена.",
    plateUrl: "/art/heroine_t2_s3.webp",
    incomeMultiplier: 2.25,
    viewersBonus: 200,
    boldnessBonus: 10,
    unlockEmotion: "fluster",
    unlockLine:
      "Лямки... лямки сами съехали! Ну и не подниму. Худи пусть висит за спиной, а гольфы я натянула обратно — хоть что-то я ещё могу контролировать~",
    shyApproachLines: [
      "Две с половиной тысячи?! Бретельки держатся на честном слове, как и моё терпение, чатик!",
      "Не надо «подними лямку» — я её как раз опускаю. Это называется раскрепощение, а не ваш plan.",
      "Худи за спиной, колени вместе, я смотрю прямо в объектив... и почему мне вдруг не стыдно?",
      "Остались гольфы. Один шаг. И я заранее краснею от того, что сама это написала в описании цели.",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 2500/2500! Обе лямки съехали, худи висит за спиной, колени у самой камеры :monkaS: :SubHype:",
        isSystemHighlight: true,
      },
      {
        author: "ice_tea_max",
        color: "#f472b6",
        badge: "VIP",
        text: "руки на подлокотниках, взгляд в объектив — это уже не «я стесняшечка» :Kreygasm:",
      },
      {
        author: "sneaker_head",
        color: "#4ade80",
        badge: "SUB",
        text: "гольфы она натянула обратно, зато лямки лежат на плечах — финал на 5000, добиваем :Pog: :AWOOGA:",
      },
    ],
  },
  {
    stage: 4,
    subsRequired: 5000,
    shortGoalTitle: "Снять топ и гольфы — финал",
    outfitName: "Чёрный топ-бра на бретелях + шорты, босые ступни",
    removedItemLabel: "− Топ и гольфы сняты!",
    storyDesc:
      "5000 сабов: финал Дня 2 — с топа она осталась только в бра на тонких бретелях, шорты те же, худи болтается на локтях за спиной, майка скомкана прямо на сиденье. Гольфы улетели за кадр: она встала на колени на кресло и подалась к вебке, уперевшись ладонями в подушку.",
    plateUrl: "/art/heroine_t2_s4.webp",
    incomeMultiplier: 2.9,
    viewersBonus: 320,
    boldnessBonus: 12,
    unlockEmotion: "bold",
    unlockLine:
      "Пять тысяч... ладно! На коленях, прямо у камеры, худи за спиной, гольфы в углу. Я сама выбрала эту позу — вчера бы умерла от стыда, а сегодня мне нравится~ ★ ♥",
    shyApproachLines: [],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 5000/5000 ПРОБИТ! ФИНАЛ ДНЯ 2: босые ступни, наклон к вебке, чат в огне :Pog: :AWOOGA: :SubHype:",
        isSystemHighlight: true,
      },
      {
        author: "feet_connoisseur",
        color: "#f472b6",
        badge: "SUB",
        text: "ГОЛЬФЫ УШЛИ!!! она встала на колени у камеры, я не верю своим глазам :Kreygasm: :Kreygasm:",
      },
      {
        author: "cyber_pelmen",
        color: "#a78bfa",
        badge: "VIP",
        text: "день 2 → она уже ведёт игру. Мия, ты страшный человек, я горжусь :LUL: :miyaLove:",
      },
    ],
  },
] as const;

export const DAY1_STEP_LABELS = [
  "10 Носки",
  "50 Легинсы",
  "200 Худи",
  "500 Тишка",
];
export const DAY1_SHORT_STEP_LABELS = ["10", "50", "200", "500"];
export const DAY2_STEP_LABELS = [
  "1500 Худи",
  "2000 Талия",
  "2500 Лямки",
  "5000 Гольфы",
];
export const DAY2_SHORT_STEP_LABELS = ["1500", "2000", "2500", "5000"];

export const DAY1_FINALE_SUBS = 500;
/**
 * Day 3 = COSPLAY DAY, «призрачная стримерша». The costume is one piece of fabric and one garment:
 * a white sheet with three scissor-cut holes (two eyes, one mouth) over a glossy black single-piece
 * bodysuit — square neckline, two wide straps, ONE round cut-out on the belly, high-cut legs, and a
 * white translucent panel clinging over the bust that is part of the bodysuit, not a separate top —
 * plus full fishnets with a small even diamond running over the leg AND the foot, down to the toes.
 *
 * Same costume discipline as Day 2: escalation only MOVES the sheet or RE-FRAMES the pose, nothing new
 * is invented and nothing is taken off (the fishnets are the punchline, not a goal). Every stage is
 * its own finished plate, so this copy is written off those four approved renders and `copyAudit`
 * proves no line outlives its frame:
 *   0     the sheet clings over her head and torso, only her netted legs come out below it
 *   7000  she pulls the front of the sheet off her torso and holds it up in one hand
 *   10000 legs up on the desk plank, crossed at the ankles, index finger to the lips — «шш»
 *   13000 the «Бу!» gimmick frame: the sheet is torn into the air (see DAY3_FLASH_PLATE)
 *   15000 finale: deep squat on the chair seat, knees spread, feet on the seat, sheet as a hood
 */
export const DAY3_SUB_GOAL_STAGES: readonly SubGoalStageDef[] = [
  {
    stage: 0,
    subsRequired: 0,
    shortGoalTitle: "Старт Дня 3 (призрак)",
    outfitName:
      "Простыня на голове и плечах + чёрное боди с открытым животом + полные чулки в сетку",
    removedItemLabel: "День 3 начат",
    storyDesc:
      "Мия вышла «призрачной стримершей»: белая простыня перекинута через голову и легла коконом по всему корпусу, дырки для глаз вырезаны криво, рот — отдельной щелью, лицо видно только через них. Ткань она собирает на груди руками, поэтому сверху это мем, а снизу из-под кокона торчат только ноги: чёрное боди с круглой дырой на животе и сетка с мелким ромбом от верха бедра до самых кончиков пальцев. Ступни тоже в сетке: одна нога собрана на сиденье, вторая свисает вниз, и обе смотрят в камеру. День только начался, а чат уже считает кадры.",
    incomeMultiplier: 1.0,
    viewersBonus: 0,
    boldnessBonus: 0,
    unlockEmotion: "shy",
    unlockLine: "",
    plateUrl: "/art/heroine_t3_s0.webp",
    shyApproachLines: [
      "Это простыня, чат. Я её сама ножницами кромсала. Бу? Бу. Всё, теперь можно смотреть.",
      "Дырки я вырезала криво, поэтому вы видите только мои глаза и улыбку. И да, глаза подведены, спасибо~",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ ДЕНЬ 3: «ПРИЗРАЧНАЯ СТРИМЕРША» ВЫШЛА В ПРОСТЫНЕ :Pog: :SubHype: бу-бу",
        isSystemHighlight: true,
      },
      {
        author: "Pasha_Donater",
        color: "#ff6b9d",
        badge: "VIP",
        text: "простыня на голове, ноги в сетке до самых пальцев, и это весь косплей :AWOOGA:",
      },
      {
        author: "kaktus_mod",
        color: "#4ecdc4",
        badge: "MOD",
        text: "правило дня: никто не просит «снять простыню». мы просто скидываем на 7000 :EZ: :ClipIt:",
      },
    ],
  },
  {
    stage: 1,
    subsRequired: 7000,
    shortGoalTitle: "Простыня убрана с торса",
    outfitName:
      "Простыня-капюшон с полами + белая полупрозрачная панель на груди и боди с дырой на животе + обе ноги в сетке",
    removedItemLabel: "− Ткань уехала с торса!",
    storyDesc:
      "7000 сабов: она взяла передний край простыни и убрала его с торса, ткань осталась капюшоном на голове и длинными полами за спиной. Зато всё, что было под ней, теперь в кадре: белая полупрозрачная панель на груди, чёрное боди с высоким вырезом и круглой дырой на животе, и сетка с мелким ромбом на бёдрах, голенях и ступнях. Сидит боком, корпус развёрнут, ноги собраны на сиденье: одна ступня свисает вниз, вторая смотрит в камеру пятью пальцами в сетке. Именно они собрали больше клипов, чем сам трюк с тканью.",
    incomeMultiplier: 1.5,
    viewersBonus: 260,
    boldnessBonus: 5,
    unlockEmotion: "tease",
    unlockLine:
      "Убрала ткань с торса, потому что она шуршит и лезет в глаза. Совпадение, что видно всё ниже? Абсолютное~",
    plateUrl: "/art/heroine_t3_s1.webp",
    shyApproachLines: [
      "Я держу ткань одной рукой. Одной, чат, а не силой обстоятельств — сразу договоримся на берегу.",
      "Ниже ткани у меня боди и сетка. Вы это видели и до подъема, я просто убрала лишний слой мишуры.",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 7000/7000! ОНА УБРАЛА ТКАНЬ С ТОРСА — БОДИ, ЖИВОТ И СЕТКА В КАДРЕ :Pog: :AWOOGA:",
        isSystemHighlight: true,
      },
      {
        author: "neko_chan_uwu",
        color: "#ff75c3",
        badge: "SUB",
        text: "призрак с подоткнутой простынёй — это новый жанр, чат уже рисует фанарт :ClipIt: :LUL:",
      },
      {
        author: "feet_connoisseur",
        color: "#f472b6",
        badge: "SUB",
        text: "ступни в сетке: одна свисает с сиденья, вторая смотрит в камеру. дальше 10000: ножки на стол :monkaS: :Overheat:",
      },
    ],
  },
  {
    stage: 2,
    subsRequired: 10000,
    shortGoalTitle: "Ножки на столе, «шш»",
    outfitName:
      "Простыня-капюшон на голове + костюм виден целиком + ноги в сетке, скрещённые на столешнице",
    removedItemLabel: "− Ткань ушла с тела!",
    storyDesc:
      "10000 сабов: простыня осталась только на голове — маленький белый капюшон с двумя дырками, полы ушли за спину, из-под капюшона высыпались волосы. Всё остальное видно как есть: боди, живот, сетка от бедра до кончиков пальцев. Поза тоже новая — она закинула ноги на столешницу и склестила щиколотки, поэтому ступни в сетке теперь самые крупные в кадре, а одна развёрнута к объективу три четвертями. Палец у губ, один глаз закрыт подмигиванием: «шш», чат, это не финал, это репетиция. Мем-призрак закончился, начался косплей-стенд.",
    incomeMultiplier: 2.0,
    viewersBonus: 520,
    boldnessBonus: 7,
    unlockEmotion: "fluster",
    unlockLine:
      "Я не «показала всё», я просто положила ноги на стол. Так мне видно ваши лица лучше, чем вам меня, чат~",
    plateUrl: "/art/heroine_t3_s2.webp",
    shyApproachLines: [
      "Ткань на голове, ноги на столе, пальцы в сетке. Ни одного слова «случайно», я взрослая.",
      "Я смотрю через дырки именно на вас, а не вы на меня. Это принципиально разные векторы, чат.",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 10000/10000! ПРОСТЫНЯ ОСТАЛАСЬ ТОЛЬКО НА ГОЛОВЕ, НОЖКИ СКРЕЩЕНЫ НА СТОЛЕ :AWOOGA: :Pog:",
        isSystemHighlight: true,
      },
      {
        author: "Pasha_Donater",
        color: "#ff6b9d",
        badge: "VIP",
        text: "капюшон из простыни, ступни в сетке на столе — это же обложка, легион, мы делаем обложку :Kreygasm: :Nosebleed:",
      },
      {
        author: "kaktus_mod",
        color: "#4ecdc4",
        badge: "MOD",
        text: "13000: призрак сорвёт с себя ткань на «Бу!». спамим «бу», не спамим просьбами, мы культурные мертвецы :LUL: :ClipIt:",
      },
    ],
  },
  {
    stage: 3,
    subsRequired: 13000,
    shortGoalTitle: "Бу! — простыня слетела",
    outfitName:
      "Простыня в руках, в воздухе + костюм целиком + полные чулки в сетку",
    removedItemLabel: "− Простыня в воздухе!",
    storyDesc:
      "13000 сабов: тот самый кадр, ради которого весь gimmick и жил. Она срывает простыню с головы обеими руками, ткань замирает в воздухе над плечами, лицо свободное, рот открыт в игровом «Бу!», волосы прыгают вперёд. На ней только боди и сетка — ни одного лоскута ткани сверху, и ни одного пальца, который она бы прятала. Через долю секунды кадр вернётся к обычному виду, но клипы уже нарезаны.",
    incomeMultiplier: 2.6,
    viewersBonus: 860,
    boldnessBonus: 9,
    unlockEmotion: "bold",
    unlockLine:
      "БУ!.. всё, ткань в руках, выдыхайте. Нет, я её не снимала — я её ПОДНЯЛА. Разница есть, чат~",
    plateUrl: "/art/heroine_t3_s3.webp",
    shyApproachLines: [
      "Ткань в воздухе, костюм на месте. Вы сейчас посмотрите на боди и назовёте это призрачным ужасом.",
      "Я знаю, что вы нарезали этот кадр. Я специально его оставила. Бу! — и всё, расходимся~",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 13000/13000! ПРОСТЫНЯ СЛЕТЕЛА, КАДР «БУ!» ПОШЁЛ В КЛИПЫ :Pog: :AWOOGA: :SubHype:",
        isSystemHighlight: true,
      },
      {
        author: "neko_chan_uwu",
        color: "#ff75c3",
        badge: "SUB",
        text: "она держит ткань над головой и орёт «бу», а чат орит иначе. 47 клипов за минуту, статистика не врёт :ClipIt: :LUL:",
      },
      {
        author: "cosplay_anon",
        color: "#00e5ff",
        badge: "VIP",
        text: "15000 и простыня уедет за спину, а поза станет финальной. это конец костюма, легион, добиваем :SubHype: :monkaS:",
      },
    ],
  },
  {
    stage: 4,
    subsRequired: 15000,
    shortGoalTitle: "Корточки на кресле, колени врозь",
    outfitName:
      "Простыня-капюшон с полами за спиной + боди с открытым животом + обе ноги в сетке на сиденье",
    removedItemLabel: "− Финал: ткань уехала за спину!",
    storyDesc:
      "15000 сабов: финальная фаза костюма и максимальный градус дня. Простыня больше не прикрытие — она сидит капюшоном на голове и висит за спиной, как плащ, поэтому лицо, плечи, живот и руки свободны. Поза — глубокие корточки прямо на сиденье: колени разведены врозь, обе ступни в сетке стоят на цыпочках на самом сиденье, одно колено выдвинуто в камеру. Корпус в три четверти, рука тянется к зрителю, один глаз закрыт подмигиванием, улыбка до ушей — она не раздевается, она дразнит, и это, чат, разрешённый жанр.",
    incomeMultiplier: 3.2,
    viewersBonus: 1300,
    boldnessBonus: 10,
    unlockEmotion: "bold",
    unlockLine:
      "Финал: капюшон и полы за спиной, корточки на кресле, колени врозь. Бу! — и это последнее «бу» сегодня~ ★ ♥",
    plateUrl: "/art/heroine_t3_s4.webp",
    shyApproachLines: [
      "Простыня уехала за спину, на мне только костюм. Финальная форма призрака, и я ношу её с гордостью.",
      "Корточки на кресле, колени врозь, сетка до кончиков пальцев. Это не «всё показали», это «показали сколько я решила»~",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 15000/15000! ТКАНЬ УЕХАЛА ЗА СПИНУ, ФИНАЛЬНАЯ ПОЗА НА КОРТОЧКАХ :AWOOGA: :Pog: :SubHype:",
        isSystemHighlight: true,
      },
      {
        author: "Pasha_Donater",
        color: "#ff6b9d",
        badge: "VIP",
        text: "капюшон, колени врозь, ступни в сетке на сиденье. я умер, и это был лучший косплей-стрим :Kreygasm: :Nosebleed:",
      },
      {
        author: "kaktus_mod",
        color: "#4ecdc4",
        badge: "MOD",
        text: "финал принят жюри чата. клип «призрак в плаще» уходит в топ месяца :ClipIt: :miyaLove:",
      },
      {
        author: "cosplay_anon",
        color: "#00e5ff",
        badge: "VIP",
        text: "день 3 закрыт на 15000. призрак ушёл сквозь стену, мы остались с капюшоном в истории :LUL: :sub2:",
      },
    ],
  },
] as const;

/** The «Бу!» flash frame: sheet off, bodysuit + fishnets — crossfaded in for a few hundred ms. */
export const DAY3_FLASH_PLATE = "/art/heroine_t3_flash.webp";

/**
 * Day 4 = YOGA DAY, «Растяжка с Мией». One costume for the whole stream and it never comes off:
 * an ivory ribbed knit tube top with NO straps (a band pulled over her head, rolled up under her
 * bust), ivory micro shorts two sizes too small with a rolled waistband, thin red underwear straps
 * taut across both bare hips, ivory ankle socks with red elastic bands. The mat stayed in the
 * bag: the office chair from Day 3 is her prop, and she uses it harder every stage.
 *
 * The character read is the real escalation this time. Days 1-2 she was shy, Day 3 she played along;
 * on Day 4 she PERFORMS — she knows the stretch poses are what carry the subs, so she demonstrates
 * on purpose, smirks into the lens, winks, sticks her tongue out. Nothing "ой", nothing "случайно".
 * Every stage is its own finished plate, so the copy is written off those four approved renders and
 * `copyAudit` proves no line outlives its frame:
 *   0     kneeling sideways on the chair seat, both arms locked overhead, a yawn-laugh at the lens
 *   18000 hip opened: she sits on the cushion sideways, one knee on the seat, the other leg thrown
 *         out and down to the floor, head tipped back laughing
 *   22000 standing vertical split beside the chair, raised foot held at hair height, two fingers to
 *         the camera
 *   26000 finale: sunk into the chair facing the lens, both legs drawn up over the armrests, palms
 *         flat on her bare belly, half-lidded wink
 */
const DAY4_OLD_STAGES: readonly SubGoalStageDef[] = [
  {
    stage: 0,
    subsRequired: 0,
    shortGoalTitle: "Старт растяжки",
    outfitName:
      "Вязаный топ-труба без бретелей + микро-шорты + носочки с красной резинкой",
    removedItemLabel: "День 4 начат",
    storyDesc:
      "Мия вышла на йога-стрим в одном и том же на весь эфир: вязаный топ-труба без единой бретели, натянутый через голову и подвернутый валиком под грудью, микро-шорты на два размера меньше, красные резинки белья впиваются в бока поверх края шорт, на ногах белые носочки с красной полоской. Коврик остался в сумке — она встаёт на колени прямо на сиденье кресла, тянет обе руки в потолок, сцепив пальцы, и смеётся в камеру: разминка, чат, дальше будет интереснее.",
    incomeMultiplier: 1.0,
    viewersBonus: 0,
    boldnessBonus: 0,
    unlockEmotion: "tease",
    unlockLine: "",
    plateUrl: "/art/heroine_t4_s0.webp",
    shyApproachLines: [
      "Это разминка, чат. Я сначала руки поднимаю, потом уже всё остальное — не путайте порядок.",
      "Топ без бретелей, потому что на йоге бретели мешают. Это правда. Почти.",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ ДЕНЬ 4: «РАСТЯЖКА С МИЕЙ» НАЧАЛСЯ. Коврик не достала, сиденье в работе :Pog: :SubHype:",
        isSystemHighlight: true,
      },
      {
        author: "yoga_bro_kim",
        color: "#4ecdc4",
        badge: "SUB",
        text: "руки в замок над головой и спина прогнута — это не разминка, это заявление :LUL:",
      },
      {
        author: "kaktus_mod",
        color: "#4ade80",
        badge: "MOD",
        text: "правило дня: мы не просим «снять». мы просто сабим на 18000 и смотрим, что будет :EZ: :ClipIt:",
      },
    ],
  },
  {
    stage: 1,
    subsRequired: 18000,
    shortGoalTitle: "Бёдра",
    outfitName:
      "Тот же топ-труба + микро-шорты, одно колено на сиденье, вторая нога откинута в пол",
    removedItemLabel: "− Бедро открыто!",
    storyDesc:
      "18000 сабов: она разворачивается боком на сиденье, одно колено ставит на подушку, вторую ногу выбрасывает в сторону и вниз, ладонь на подлокотнике, корпус свободный. Трикотаж натянут без единой складки, валик под грудью впился, красные резинки на боках держат шорты, которые она сама же и выбирала «на вырост». Голова откинута, смех в камеру: бедро открыто, чат, дышите ровно.",
    plateUrl: "/art/heroine_t4_s1.webp",
    incomeMultiplier: 1.6,
    viewersBonus: 380,
    boldnessBonus: 6,
    unlockEmotion: "tease",
    unlockLine:
      "Нога в пол, бедро открыто, рука на подлокотнике. Это поза «голубь», я проверила в интернете. Да, я знаю, что вы сейчас напишете~",
    shyApproachLines: [
      "Я стою на колене, а не ползаю. Разница принципиальная, чат, и она в описании позы.",
      "Никаких «покажи ещё» — я сама решу, когда дойти до следующего упражнения. Просто сабы считаются быстрее, чем я думаю.",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 18000/18000! БЕДРО ОТКРЫТО, НОГА ВЫТЯНУТА В ПОЛ :Pog: :AWOOGA:",
        isSystemHighlight: true,
      },
      {
        author: "neko_chan_uwu",
        color: "#ff75c3",
        badge: "SUB",
        text: "она смеётся в камеру и держит баланс на одном колене, у меня клип сам себя собрал :ClipIt: :Kreygasm:",
      },
      {
        author: "feet_connoisseur",
        color: "#f472b6",
        badge: "SUB",
        text: "носок на вытянутой ноге натянут как струна. 22000 — шпагат, легион, мы все знаем, что там будет :monkaS:",
      },
    ],
  },
  {
    stage: 2,
    subsRequired: 22000,
    shortGoalTitle: "Шпагат",
    outfitName:
      "Тот же комплект, вертикальный шпагат у кресла, стопа на уровне волос",
    removedItemLabel: "− Вертикальный шпагат!",
    storyDesc:
      "22000 сабов: тот самый кадр. Она встаёт с кресла и делает вертикальный шпагат прямо рядом с ним — опорная нога выпрямлена, вторая затянута руками вверх к голове, колено врозь, носочек в белом носке на уровне волос. Спина прогнута, корпус развёрнут к вебке, одна рука держит голень, вторая показывает чату две пальца и подмигивает. Ничего не «случайно»: она специально встала так, чтобы вы увидели растяжку с обеих сторон.",
    plateUrl: "/art/heroine_t4_s2.webp",
    incomeMultiplier: 2.3,
    viewersBonus: 760,
    boldnessBonus: 9,
    unlockEmotion: "bold",
    unlockLine:
      "Двадцать две тысячи! Вертикальный шпагат, стопа в волосах, спина прогнута. Я три года сидела за партой, чтобы так выглядеть на вашем стриме, чат~ ★",
    shyApproachLines: [
      "Смотрите на технику, а не на то, что под шортами. Там, к слову, шорты. Всё в рамках~",
      "Кресло рядом не для того, чтобы на него сесть, а для масштаба. Я выше, чем кажется.",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 22000/22000! ВЕРТИКАЛЬНЫЙ ШПАГАТ В ПРЯМОМ ЭФИРЕ :BOOBA: :Pog: :SubHype:",
        isSystemHighlight: true,
      },
      {
        author: "Pasha_Donater",
        color: "#ff6b9d",
        badge: "VIP",
        text: "нога у головы, подмигивание в объектив, две пальца чату. это не стрим, это финал сезона :Kreygasm: :Nosebleed:",
      },
      {
        author: "yoga_bro_kim",
        color: "#4ecdc4",
        badge: "SUB",
        text: "таз ровный, колено в сторону, спина держит. так не выглядят «первый раз», так выглядят годами :LUL: :Pog:",
      },
    ],
  },
  {
    stage: 3,
    subsRequired: 26000,
    shortGoalTitle: "Кресло, финал",
    outfitName:
      "Тот же комплект, глубокая поза в кресле, ноги на подлокотниках, ладони на голом животе",
    removedItemLabel: "− Финал: она в кресле и не собирается вставать!",
    storyDesc:
      "26000 сабов: финал дня. Мия уходит в кресло целиком — садится спиной к подушке, обе ноги поджимает так, что голени лежат на подлокотниках, носочки свисают снаружи, а ладони кладёт себе на голый живот, растопырив пальцы. Спина прогнута, грудь подана к вебке, ткань натянута до предела, на щеках пятно румянца, волосатая чёлка прилипла, один глаз закрыт подмигиванием, язык виден. «Готово?», — спрашивает она чат и вовсе не собирается вставать.",
    plateUrl: "/art/heroine_t4_s3.webp",
    incomeMultiplier: 3.2,
    viewersBonus: 1250,
    boldnessBonus: 12,
    unlockEmotion: "bold",
    unlockLine:
      "Финал: я в кресле, ноги на подлокотниках, руки на своём животе, и я никуда не встаю. Вы сами это хотели — двадцать шесть тысяч раз~ ★ ♥",
    shyApproachLines: [
      "Я уже сжала пальцы на животе, дальше только ваша совесть и сабы. Выбора у меня, как видите, нет~",
      "Последняя поза. Я в ней и усну, если вы начнёте тянуть время вместо подписок.",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 26000/26000! ОНА ОСТАЛАСЬ В КРЕСЛЕ, ЛАДОНИ НА ЖИВОТЕ, ФИНАЛ ДНЯ 4 :AWOOGA: :Pog: :SubHype:",
        isSystemHighlight: true,
      },
      {
        author: "simp_police_ru",
        color: "#4ade80",
        badge: "MOD",
        text: "ноги на подлокотниках, язык, подмигивание. дня 4 не переживёт ни один рекорд канала :Kreygasm: :Kreygasm:",
      },
      {
        author: "rich_uncle_msk",
        color: "#ffd54f",
        badge: "DONATE",
        text: "ЙОГА-ДЕНЬ ЗАКРЫТ. завтра — она сама говорит что. легион, готовим клипы и сердечки :sub2: :miyaLove:",
        isSystemHighlight: true,
      },
      {
        author: "cosplay_anon",
        color: "#00e5ff",
        badge: "VIP",
        text: "из «ой, не смотрите» до «смотрите и платите» за четыре дня. это не клики, это рост персонажа :ClipIt: :LUL:",
      },
    ],
  },
] as const;

/** The «Готово?» flash frame: the finale pose, crossfaded in for a few hundred ms. */
export const DAY4_FLASH_PLATE = "/art/heroine_t4_flash.webp";

/**
 * Day 5 = BIKINI STREAM, «5 бикини стрим». There is nothing left to take off — she walked into the
 * stream already in a micro bikini — so the ladder moves the CAMERA and the POSE instead: the fourth
 * day ended with her holding a pose, the fifth ends with her selling one. Every number below is
 * +7000 over the previous step, the same step size Day 3 opened with, and every one of the four
 * stages is one of his approved frames, cut for the stream camera (close, front-on, feet crowding
 * the near frame, the chair base sinking behind `fg_desk_t1`):
 *   0     33000-шаг первый: one leg stretched at the webcam, her foot bigger than her head
 *   33000 both legs thrown over the armrest, both soles low in frame, her hands on her own ankle
 *   40000 «кошечка»: on all fours on the seat, turning her head back over the shoulder
 *   47000 finale: the same cat, but squared to the lens, hips the widest thing in the stream
 *
 * Her voice is the escalation, not the outfit: she stopped being shy on Day 2 and stopped pretending
 * on Day 4. On Day 5 she says the price out loud, asks for more herself, and lets the chat push.
 */
const DAY5_OLD_STAGES: readonly SubGoalStageDef[] = [
  {
    stage: 0,
    subsRequired: 0,
    shortGoalTitle: "Старт бикини-стрима",
    outfitName: "Неоново-розовое микро-бикини на завязках + прозрачные шпильки",
    removedItemLabel: "День 5 начат",
    storyDesc:
      "Мия вышла в эфир в микро-бикини и даже не попыталась сделать вид, что это «купальник для бассейна». Камера придвинута вплотную, поэтому в кадре сначала оказывается не она, а её стопа: одна нога вытянута вдоль сиденья прямо в объектив, вторая согнута, ладони лежат на её же бёдрах, пальцы не нервничают. Стянутые узелки на завязках, натянутая неоновая ткань, прозрачные шпильки с розовыми каблуками. Снимать нечего, чат, — дальше только поза, и цена за неё — ваша полоска сабов.",
    incomeMultiplier: 1.0,
    viewersBonus: 0,
    boldnessBonus: 0,
    unlockEmotion: "tease",
    unlockLine: "",
    plateUrl: "/art/heroine_t5_s0.webp",
    shyApproachLines: [
      "Тридцать три тысячи до того, как я закину обе ноги на подлокотник. Не «если», а «когда», чат: я уже считаю.",
      "Хотите, чтобы я стеснялась? Опоздали, четвёртый день прошёл. Теперь я хочу, чтобы вы сабили~",
      "Да, я вижу, куда вы смотрите. Нет, я не уберу ногу — она стоила дороже, чем ваше «привет».",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ ДЕНЬ 5: «5 БИКИНИ СТРИМ» НАЧАЛСЯ. Снимать нечего — двигаем позу :Pog: :SubHype:",
        isSystemHighlight: true,
      },
      {
        author: "feet_connoisseur",
        color: "#f472b6",
        badge: "SUB",
        text: "СТОПА ПЕРВЫМ ПЛАНОМ, КРЕСЛО ВЗЯЛО ЕЁ ВЕС, ОНА УЛЫБАЕТСЯ. четвёртый день я этого ждал :Kreygasm: :ClipIt:",
      },
      {
        author: "kaktus_mod",
        color: "#4ade80",
        badge: "MOD",
        text: "правило дня: мы не просим «снять». мы сабим на 33000 и смотрим, как она сама решит сесть глубже :EZ: :monkaS:",
      },
    ],
  },
  {
    stage: 1,
    subsRequired: 33000,
    shortGoalTitle: "Ножки в кадр",
    outfitName:
      "То же микро-бикини, обе ноги перекинуты через подлокотник, ступни внизу кадра",
    removedItemLabel: "− Обе ступни в кадре!",
    storyDesc:
      "33000 сабов: она разворачивается в кресле глубже и перекидывает обе ноги через подлокотник, так что ступни ложатся в самый низ кадра, ближе к линзе, чем её лицо. Корпус откинут на спинку, ладони у неё же на лодыжке — она сама держит себе позу, как на фото, и смотрит в камеру с открытым смешком. Неоновая ткань натянута от плеча до бедра без единой складки, узелки на завязках впились в кожу. «Вот вам ножки, чат. Дальше дороже».",
    plateUrl: "/art/heroine_t5_s1.webp",
    incomeMultiplier: 1.8,
    viewersBonus: 420,
    boldnessBonus: 7,
    unlockEmotion: "bold",
    unlockLine:
      "Тридцать три тысячи! Ноги на подлокотнике, ступни прямо у вашей веб-линзы, руки на своей же лодыжке. Я это сделала специально, чат, и я хочу ещё~ ★",
    shyApproachLines: [
      "Сорок тысяч — и я сажусь на сиденье по-кошачьи. Не я это придумала, вы это посчитали, чат.",
      "Я держу эту позу ровно столько, сколько вы держите темп сабов. Взаимная дисциплина~",
      "Ноги затекают, а чат не затихает. Ладно, ещё двадцать секунд и одна улыбка в камеру.",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 33000/33000! НОЖКИ В КАДР, ОВЕ ГОЛЕНИ НА ПОДЛОКОТНИКЕ :Pog: :BOOBA: :AWOOGA:",
        isSystemHighlight: true,
      },
      {
        author: "Pasha_Donater",
        color: "#ff6b9d",
        badge: "VIP",
        text: "она сама держит свою лодыжку и сама называет цену. это уже не стрим, это аукцион :Kreygasm: :SubHype:",
      },
      {
        author: "rich_uncle_msk",
        color: "#ffd54f",
        badge: "DONATE",
        text: "ДОНАТ 3000 ₽: не убирай ноги, Мия. 40000 уже в пути, легион видит цифру и не спорит :sub2: :Pog:",
        isSystemHighlight: true,
      },
    ],
  },
  {
    stage: 2,
    subsRequired: 40000,
    shortGoalTitle: "Кошечка на кресле",
    outfitName:
      "То же микро-бикини, на четвереньках на сиденье, голова через плечо",
    removedItemLabel: "− Поза «кошечка», спиной в вебку!",
    storyDesc:
      "40000 сабов: она становится на сиденье на колени и опирается на оба локтя, спина длинная и ровная, кресло развёрнуто спинкой к камере. Разворот ещё не полный — три четверти, — поэтому чат видит линию от лопаток до бедра и её лицо через плечо: румянец, полуприкрытые глаза, открытый смешок в объектив. Одна шпилька съехала вперёд и висит на носке на прозрачном ремешке, вторая на ноге. «Красивее кадра у вас не было, и он стоил сорока тысяч».",
    plateUrl: "/art/heroine_t5_s2.webp",
    incomeMultiplier: 2.6,
    viewersBonus: 840,
    boldnessBonus: 10,
    unlockEmotion: "bold",
    unlockLine:
      "Сорок тысяч! Я на коленях в своём кресле, спиной к вам, смотрю через плечо и отлично понимаю, что вы сейчас напишете. Пишите, я не убираю~ ★ ♥",
    shyApproachLines: [
      "Полный разворот будет на 47000. Я сказала «будет», чат, а не «может быть» — считайте.",
      "Мне не стыдно, мне интересно, сколько вы ещё выдержите. Это разные чувства, не путайте.",
      "Да, я вижу, что это лучший клип недели. Нет, я его не повторю бесплатно.",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 40000/40000! КОШЕЧКА НА КРЕСЛЕ, СПИНА В КАДРЕ, ЛИЦО ЧЕРЕЗ ПЛЕЧО :AWOOGA: :Pog: :Kreygasm:",
        isSystemHighlight: true,
      },
      {
        author: "neko_chan_uwu",
        color: "#ff75c3",
        badge: "SUB",
        text: "линия спины до бедра и лицо через плечо, шпилька висит на ремешке. я ставлю будильник на 47000 :ClipIt: :Nosebleed:",
      },
      {
        author: "cosplay_anon",
        color: "#00e5ff",
        badge: "VIP",
        text: "она уже сама торгуется позой. из «ой, не смотрите» за пять дней — и ни одной снятой вещи, уважаю :LUL: :SubHype:",
      },
    ],
  },
  {
    stage: 3,
    subsRequired: 47000,
    shortGoalTitle: "Финал: всё в кадр",
    outfitName:
      "То же микро-бикини, разворот квадратно к вебке, шпилька висит на ремешке",
    removedItemLabel: "− Финал: она показала ровно то, о чём просил чат!",
    storyDesc:
      "47000 сабов: финал дня. Тот же разворот на коленях, но теперь квадратно — обе её стороны сложены в одну вертикальную колонну по центру кадра, ближе всего к линзе то, что чат просил с самого начала, а она смотрит назад через плечо с раскрепощённым открытым смешком, и ни один мускул на её лице не выдаёт смущения. Неон натянут между лопатками и по бедру, узелки впились, одна прозрачная шпилька висит на носке. «Вы дошли до сорока семи тысяч. Я дошла до camera-ready. Мы оба молодцы, и я хочу второй заход~ ★ ♥»",
    plateUrl: "/art/heroine_t5_s3.webp",
    incomeMultiplier: 3.6,
    viewersBonus: 1400,
    boldnessBonus: 13,
    unlockEmotion: "bold",
    unlockLine:
      "Сорок семь тысяч, финал: я сижу на своём кресле задом в вебку, смотрю через плечо и улыбаюсь, потому что это ВЫ довели меня до этой позы. Спасибо, легион~ ★ ♥",
    shyApproachLines: [
      "Последняя поза. Я в ней и останусь, пока вы не начнёте сабить на завтрашнюю.",
      "Завтра я надену... ничего. Это моя лучшая мысль, чат, и она ваша заслуга~",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 47000/47000! ФИНАЛ ДНЯ 5: РАЗВОРОТ КВАДРАТНО, ЛИЦО ЧЕРЕЗ ПЛЕЧО, НИ ОДНОЙ СНЯТОЙ ВЕЩИ :Pog: :SubHype: :AWOOGA:",
        isSystemHighlight: true,
      },
      {
        author: "simp_police_ru",
        color: "#4ade80",
        badge: "MOD",
        text: "кадр, за который не стыдно ни ей, ни нам. модерация молчит, чат рыдает, клип собран :ClipIt: :Kreygasm:",
      },
      {
        author: "rich_uncle_msk",
        color: "#ffd54f",
        badge: "DONATE",
        text: "БИКИНИ-ДЕНЬ ЗАКРЫТ, 47000 сабов. Мия, ты свободна и ты уже договариваешься о завтрашнем эфире :sub2: :Pog:",
        isSystemHighlight: true,
      },
      {
        author: "yoga_bro_kim",
        color: "#4ecdc4",
        badge: "SUB",
        text: "после йоги она держит любую позу вечно. это был не финал, это контрольный замер гибкости :LUL: :EZ:",
      },
    ],
  },
] as const;

/** Day 5 has no flash plate by design — see the note on `DAY5_SUB_GOAL_STAGES` and `HeroineRig`. */
export const DAY5_FLASH_PLATE: string | null = null;

export const DAY4_STEP_LABELS = ["16500 Разминка", "18000 Бёдра", "22000 Шпагат", "26000 Кресло"];
export const DAY4_SHORT_STEP_LABELS = ["16500", "18000", "22000", "26000"];
export const DAY4_FINALE_SUBS = 26000;

/**
 * Day 5 ladder: +7000 per step from the close of Day 4, the same stride Day 3 opened with. The labels
 * are what the OBS sub-goal panel and the HUD strip show, so they name the POSE, never a garment.
 */
export const DAY5_STEP_LABELS = [
  "29500 Нога к камере",
  "33000 Ножки в кадр",
  "40000 Кошечка",
  "47000 Всё в кадр",
];

/** Five-stage ladder: the new opener precedes the four previously approved plates. */
export const DAY5_SUB_GOAL_STAGES: readonly SubGoalStageDef[] = [
  { ...DAY5_OLD_STAGES[0]!, stage: 0, subsRequired: 0, shortGoalTitle: "Начало бикини-стрима",
    removedItemLabel: "День 5 начат", storyDesc: "Мия сидит в кресле в розовом бикини и приветствует чат.", plateUrl: "/art/heroine_t5_start_hq.webp",
    shyApproachLines: ["Привет, чат! Бикини на месте, начинаем эфир~"], chatCascade: [] },
  ...DAY5_OLD_STAGES.map((def, index) => ({ ...def, stage: (index + 1) as SubGoalStageIndex,
    ...(index === 0 ? { subsRequired: 29500, shortGoalTitle: "Нога к камере", removedItemLabel: "Новая поза!", unlockLine: "Новая поза для чата!", incomeMultiplier: 1.25, viewersBonus: 200 } : {}),
    ...(index === 3 ? { outfitName: "Розовое бикини и прозрачные шпильки, наклон через спинку кресла", storyDesc: "47000 сабов: Мия на коленях в кресле наклоняется через спинку, отвернувшись к камере спиной.", unlockLine: "Финал! Наклоняюсь через спинку кресла. Спасибо за подписки, чат!", shyApproachLines: ["Финальная поза — через спинку кресла~"], chatCascade: [] } : {}) })),
];

/** Five-stage ladder: the new opener precedes the four previously approved plates. */
export const DAY4_SUB_GOAL_STAGES: readonly SubGoalStageDef[] = [
  { ...DAY4_OLD_STAGES[0]!, stage: 0, subsRequired: 0, shortGoalTitle: "Начало растяжки",
    removedItemLabel: "День 4 начат", storyDesc: "Мия сидит боком в кресле, улыбается и поправляет волосы. Разминка только начинается.", plateUrl: "/art/heroine_t4_start_hq.webp",
    shyApproachLines: ["Устраивайтесь, чат. Разминка только начинается~"], chatCascade: [] },
  ...DAY4_OLD_STAGES.map((def, index) => ({ ...def, stage: (index + 1) as SubGoalStageIndex,
    ...(index === 0 ? { subsRequired: 16500, shortGoalTitle: "Разминка в кресле", removedItemLabel: "Новая поза!", unlockLine: "Новая поза для чата!", incomeMultiplier: 1.25, viewersBonus: 200 } : {}) })),
];
export const DAY5_SHORT_STEP_LABELS = ["29500", "33000", "40000", "47000"];
export const DAY5_FINALE_SUBS = 47000;

/**
 * Day 6 = «Деревенская девочка», деревенский стрим. Он сам сменил идею дня: вместо сеток — ГОЛОЕ ТЕЛО под
 * детским джинсовым комбинезоном, который сел после стирки и мал ей на четыре размера, плюс большая
 * соломенная шляпа. Ни одна вещь за день не снимается: градус растёт за счёт ПРЕДМЕТА в кадре (огурец в
 * руках → половина огурца во рту → початок кукурузы и растаявшее масло на ногах) и за счёт того, насколько
 * близко её ступни подпускают линзу. Четыре ступени — четыре ЕГО утверждённых кадра:
 *   0     старт: глубоко в кресле, обе лямки на предплечьях, шляпа на один глаз, шлепки на ногах
 *   54000 огурец в двух руках у щеки, лямки застёгнуты, взгляд исподлобья
 *   61000 половина огурца во рту (зажат глубоко передними зубами), руки подняты и пусты, кресло видно
 *   68000 финал: обе ступни в кадре у самой линзы, полено масла на них, початок у груди в двух руках
 *
 * Шаг — ровно +7000 сабов, как он и просил («градация на увеличение по 7000 сабов»), продолжая день 5.
 * Финальный кадр срезан по линии стола (`DESK_TOP = 1489` в скриптах): её каблуки стоят НА столешнице
 * `fg_desk_t1`, а не висят за ней, — поэтому финал читается как «ножки на столе игрока».
 */
const DAY6_OLD_STAGES: readonly SubGoalStageDef[] = [
  {
    stage: 0,
    subsRequired: 0,
    shortGoalTitle: "Старт деревенского дня",
    outfitName:
      "Джинсовый комбинезон «с детства», мал на 4 размера + соломенная шляпа + красные шлепки",
    removedItemLabel: "День 6 начат",
    storyDesc:
      "Мия вышла в эфир в деревенском: тугая выцветшая джинса, которая после стирки села на четыре размера меньше, квадратный билд натянут до белой строчки, обе узкие лямки сползли с плеч и висят на предплечьях, шляпа надвинута на один глаз, красные шлепки на ногах. Сидит глубоко в кресле, подбородок на ладони, и спрашивает про костюм первой — не стесняясь, а как проработку: это её детский комбинезон, и он ей мал ровно настолько, насколько вы хотели. Снимать с неё сегодня нечего, чат, — дальше только предмет в кадре и цена за него.",
    incomeMultiplier: 1.0,
    viewersBonus: 0,
    boldnessBonus: 0,
    unlockEmotion: "tease",
    unlockLine: "",
    plateUrl: "/art/heroine_t6_s0.webp",
    shyApproachLines: [
      "Как вам мой костюм, чат? Он настоящий: я в нём бегала по огороду, когда была маленькой, и с тех пор он только сел~",
      "Пятьдесят четыре тысячи — и в кадре будет огурец. Не «может быть», а «появится»: я уже договорилась с собой.",
      "Швы натянуты так, что строчка читается поштучно. Это не дефект, это мой тариф, чат~",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ ДЕНЬ 6: «ДЕРЕВЕНСКАЯ ДЕВОЧКА» НАЧАЛСЯ. Ни одной снятой вещи — растёт предмет в кадре :Pog: :SubHype:",
        isSystemHighlight: true,
      },
      {
        author: "ogorod_ka",
        color: "#4ade80",
        badge: "SUB",
        text: "комбинезон из её детства, мал на четыре размера, и она сама это озвучила в эфире. деревня, которая считает деньги :Kreygasm: :ClipIt:",
      },
      {
        author: "kaktus_mod",
        color: "#4ade80",
        badge: "MOD",
        text: "правило дня: мы не просим «раздеться». мы сабим на 54000 и смотрим, что она сама придумает с огурцом :EZ: :monkaS:",
      },
      {
        author: "agronom_anon",
        color: "#00e5ff",
        badge: "VIP",
        text: "шляпа на один глаз, лямки на предплечьях, шлепки на ногах. это не косплей, это отчёт с поля, и он мне нравится :LUL: :SubHype:",
      },
    ],
  },
  {
    stage: 1,
    subsRequired: 54000,
    shortGoalTitle: "Огурец в руках",
    outfitName:
      "Тот же комбинезон, лямки застёгнуты, огурец в двух руках у щеки",
    removedItemLabel: "− Огурец в кадре!",
    storyDesc:
      "54000 сабов: она застегнула обе лямки обратно (потому что с огурцом в руках так удобнее, а не потому что вы попросили) и держит его двумя руками и прижимает кончик к щеке. Комбинезон натянут так, что швы тянутся белыми штрихами. Взгляд в линзу, на губах улыбка, и она честно спрашивает чат: какой огурец, что с ним делать. Никто в этом кадре ничего не снимает и ничего не теряет — в кадре появился предмет, и весь смысл в том, как она им распорядится~",
    plateUrl: "/art/heroine_t6_s1.webp",
    incomeMultiplier: 2.0,
    viewersBonus: 560,
    boldnessBonus: 8,
    unlockEmotion: "bold",
    unlockLine:
      "Пятьдесят четыре тысячи! Огурец в двух руках, лямки застёгнуты, билд натянут. Чат, я спрашиваю серьёзно: какой он большой — и что мне с ним делать~ ★",
    shyApproachLines: [
      "Шестьдесят одна тысяча — и я исполню вашу заявку. Полоска сабов решает, чат.",
      "Он пахнет огородом и стоит дешевле вашей подписки. Считайте, что из этого следует~",
      "Держу его двумя руками и ничего с ним не делаю специально. Это называется «экспозиция», а не «ожидание».",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 54000/54000! ОГУРЕЦ В ДВУХ РУКАХ, ЛЯМКИ ЗАСТЁГНУТЫ, БРОВЬ ПОДНЯТА :Pog: :AWOOGA:",
        isSystemHighlight: true,
      },
      {
        author: "Pasha_Donater",
        color: "#ff6b9d",
        badge: "VIP",
        text: "она сама спросила «что с ним делать». чат, это не риторический вопрос, это тендер :Kreygasm: :SubHype:",
      },
      {
        author: "solyanka_pro",
        color: "#ffd54f",
        badge: "DONATE",
        text: "ДОНАТ 2500 ₽: оближи его и назови цену за укус, Мия. 61000 уже в пути, легион видит цифру и не спорит :sub2: :Pog:",
        isSystemHighlight: true,
      },
      {
        author: "feet_connoisseur",
        color: "#f472b6",
        badge: "SUB",
        text: "огурец у щеки, комбинезон на месте, поза спокойная. я знаю, чем это кончится на 61000 :ClipIt: :monkaS:",
      },
    ],
  },
  {
    stage: 2,
    subsRequired: 61000,
    shortGoalTitle: "Половина огурца во рту",
    outfitName:
      "Тот же комбинезон, половина огурца зажата передними зубами, руки подняты и пусты",
    removedItemLabel: "− Огурец во рту, руки пустые!",
    storyDesc:
      "61000 сабов: половина огурца зажата у неё передними зубами далеко во рту, щёки натянуты изнутри, и она держит его сама — обе руки подняты и пустые, чтобы у чата не осталось сомнений, что это её решение. Одно колено на сиденье, второй шлепок сорвался и висит на ноге, кресло видно целиком вместе с газлифтом. Она облизывает, чмокает и смотрит в объектив с открытым смешком: сок, звук в микрофон и ни капли смущения, чат, это была ваша цифра~",
    plateUrl: "/art/heroine_t6_s2.webp",
    incomeMultiplier: 3.1,
    viewersBonus: 1180,
    boldnessBonus: 12,
    unlockEmotion: "bold",
    unlockLine:
      "Шестьдесят одна тысяча! Половина огурца у меня во рту, обе руки подняты и пустые, один шлепок висит на ноге. Я облизываю и сосу его сама: чмок-чмок! Сочный, чат, микрофон всё слышит~ ★ ♥",
    shyApproachLines: [
      "Шестьдесят восемь тысяч — и в кадре будет масло. Я не шучу и не торгуюсь: у меня это записано в плане эфира.",
      "Сок на подбородке, руки пустые, взгляд ваш. Считайте это отчётностью, а не фансервисом, чат~",
      "Чмокает в микрофон? Чмокает. Это звук огурца, а не мой звук, я просто держу его зубами.",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 61000/61000! ПОЛОВИНА ОГУРЦА ВО РТУ, ОБЕ РУКИ ПОДНЯТЫ И ПУСТЫ :Pog: :AWOOGA: :Kreygasm:",
        isSystemHighlight: true,
      },
      {
        author: "neko_chan_uwu",
        color: "#ff75c3",
        badge: "SUB",
        text: "руки подняты, пустые, видно каждый палец. она доказывает чату физику кадра, и это лучший монтаж недели :ClipIt: :Nosebleed:",
      },
      {
        author: "rich_uncle_msk",
        color: "#ffd54f",
        badge: "DONATE",
        text: "ВЧЕРА ОНА ДЕРЖАЛА ПОЗУ, СЕГОДНЯ ДЕРЖИТ ЗУБАМИ. 61000 сабов, Мия, и ни одного «ой» — это и есть рост персонажа :sub2: :Pog:",
        isSystemHighlight: true,
      },
      {
        author: "cosplay_anon",
        color: "#00e5ff",
        badge: "VIP",
        text: "шесть дней: от «ой, не смотрите» до «смотрите, тут сок». ни одной снятой вещи, ни одного лишнего слова :LUL: :SubHype:",
      },
    ],
  },
  {
    stage: 3,
    subsRequired: 68000,
    shortGoalTitle: "Финал: ножки в масле",
    outfitName:
      "Тот же комбинезон, лямки снова на предплечьях, босые ступни в масле, початок кукурузы у груди",
    removedItemLabel: "− Финал: ступни в масле у самой линзы!",
    storyDesc:
      "68000 сабов: финал дня. Она сидит в кресле, обе ноги вытянуты прямо в объектив, ступни — самое крупное и ближайшее в кадре, обе стоят на столешнице, и на них лежит растаявшее сливочное масло: по пальцам, по своду, по голеням, немного на доске под пятками. Обе лямки снова уехали на предплечья, билд держится на боковых пуговицах, а в двух руках у неё початок кукурузы, который она держит у груди и ест. Ни одной снятой вещи за весь эфир, зато масло, сок и её собственный смех — и она шутит про ножки в масле раньше, чем вы успеваете это написать~ ★ ♥",
    plateUrl: "/art/heroine_t6_s3.webp",
    incomeMultiplier: 4.3,
    viewersBonus: 1950,
    boldnessBonus: 16,
    unlockEmotion: "bold",
    unlockLine:
      "Шестьдесят восемь тысяч, финал: ножки в масле, початок у груди, лямки на предплечьях. Кто бы их облизал, чат? Подавайте заявки, я читаю каждую~ ★ ♥",
    shyApproachLines: [
      "Кто бы их облизал? Кто бы их ОБЛИЗал, чат. Шестьдесят восемь тысяч сабов, и вы это написали коллективно.",
      "Масло не капает на ваш стол, оно на мне. Проработка дня закрыта, можете выдыхать и идти спать~",
      "Последний кадр дня: ступни у линзы, початок в руках, я смеюсь. Ни одной снятой вещи, и всё равно это лучший ваш эфир.",
    ],
    chatCascade: [
      {
        author: "StreamBot",
        color: "#c084fc",
        badge: "MOD",
        text: "★ SUB GOAL 68000/68000! ФИНАЛ ДНЯ 6: НОЖКИ В МАСЛЕ У САМОЙ ЛИНЗЫ, ПОЧАТОК В ДВУХ РУКАХ :Pog: :SubHype: :AWOOGA:",
        isSystemHighlight: true,
      },
      {
        author: "simp_police_ru",
        color: "#4ade80",
        badge: "MOD",
        text: "ступни на столе игрока, масло по пальцам, и она сама начала шутить первой. день закрыт по всем статьям :Kreygasm: :ClipIt:",
      },
      {
        author: "rich_uncle_msk",
        color: "#ffd54f",
        badge: "DONATE",
        text: "ДЕРЕВЕНСКИЙ ДЕНЬ ЗАКРЫТ, 68000 сабов. Мия, масло осталось на кадре, а не на репутации, легион это видел :sub2: :Pog:",
        isSystemHighlight: true,
      },
      {
        author: "feet_connoisseur",
        color: "#f472b6",
        badge: "SUB",
        text: "я бы облизал. чат, я не прошу, я фиксирую: мы бы облизали все, шестьдесят восемь тысяч раз :Nosebleed: :monkaS:",
      },
      {
        author: "agronom_anon",
        color: "#00e5ff",
        badge: "VIP",
        text: "урожай убран, кукуруза на месте, ни один шов не лопнул. отчёт принят, премия выплачена :EZ: :LUL:",
      },
    ],
  },
] as const;

/** Day 6 has no flash plate by design — like Day 5, the ladder frame IS the reveal. */
export const DAY6_FLASH_PLATE: string | null = null;

/**
 * Day 6 ladder: 54000 / 61000 / 68000, the same +7000 stride. The labels are what the OBS sub-goal panel
 * and the HUD strip show, so they name the OBJECT in the frame, never a garment — nothing is taken off
 * today, and the step that says otherwise would promise a ladder the art does not contain.
 */
export const DAY6_STEP_LABELS = [
  "50500 Лямки спущены",
  "54000 Огурец в руках",
  "61000 Огурец во рту",
  "68000 Ножки в масле",
];

/** Five-stage ladder: the new opener precedes the four previously approved plates. */
export const DAY6_SUB_GOAL_STAGES: readonly SubGoalStageDef[] = [
  { ...DAY6_OLD_STAGES[0]!, stage: 0, subsRequired: 0, shortGoalTitle: "Начало деревенского стрима",
    removedItemLabel: "День 6 начат", storyDesc: "Мия в джинсовом комбинезоне и соломенной шляпе держит огурец и кукурузу.", plateUrl: "/art/heroine_t6_start_hq.webp",
    shyApproachLines: ["Огурец в одной руке, кукуруза в другой. Урожай готов, чат~"], chatCascade: [] },
  ...DAY6_OLD_STAGES.map((def, index) => ({ ...def, stage: (index + 1) as SubGoalStageIndex,
    ...(index === 0 ? { subsRequired: 50500, shortGoalTitle: "Лямки спущены", removedItemLabel: "Новая поза!", unlockLine: "Новая поза для чата!", incomeMultiplier: 1.25, viewersBonus: 200 } : {}) })),
];
export const DAY6_SHORT_STEP_LABELS = ["50500", "54000", "61000", "68000"];
export const DAY6_FINALE_SUBS = 68000;

export const DAY3_STEP_LABELS = [
  "7000 Ткань",
  "10000 Ножки на столе",
  "13000 Бу!",
  "15000 Корточки",
];
export const DAY3_SHORT_STEP_LABELS = ["7000", "10000", "13000", "15000"];
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
    const forced = (window as unknown as { __day3Unlocked?: boolean })
      .__day3Unlocked;
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
  if (typeof window === "undefined") return false;
  try {
    const files = [
      ...DAY3_SUB_GOAL_STAGES.map((def) => def.plateUrl),
      DAY3_FLASH_PLATE,
    ];
    const checks = await Promise.all(
      files.map((url) =>
        fetch(url, { method: "HEAD" })
          .then(
            (res) =>
              res.ok &&
              (res.headers.get("content-type") ?? "").startsWith("image/"),
          )
          .catch(() => false),
      ),
    );
    day3ArtProbe = checks.every(Boolean);
  } catch {
    day3ArtProbe = false;
  }
  return day3ArtProbe;
}

/**
 * Day 4 (yoga) runs on its own four-frame ladder `heroine_t4_s0..s3` + the «Готово?» flash plate.
 * Same discipline as Day 3: until every file really exists in `public/art`, the day stays locked, so
 * nobody can click into a ladder whose art is still an AI draft. `window.__day4Unlocked` overrides.
 *
 * Day 5 (bikini stream) runs on `heroine_t5_s0..s3` and — unlike Days 3 and 4 — WITHOUT a flash plate:
 * its reveal is the ladder itself, so there is no single frame to crossfade to, and shipping a fake
 * file to satisfy a gate would put unapproved art on screen. `DAY5_FLASH_PLATE` is `null` and
 * `probeDay5Art` reads only the four stage files. `window.__day5Unlocked` overrides the gate.
 */
let day4ArtProbe = false;

export function isDay4Unlocked(): boolean {
  try {
    const forced = (window as unknown as { __day4Unlocked?: boolean })
      .__day4Unlocked;
    if (forced === true || forced === false) return forced;
  } catch {
    /* no window during tests */
  }
  return day4ArtProbe;
}

/** The gate the Day-4 finale card and `startDay5` both read. */
let day5ArtProbe = false;

export function isDay5Unlocked(): boolean {
  try {
    const forced = (window as unknown as { __day5Unlocked?: boolean })
      .__day5Unlocked;
    if (forced === true || forced === false) return forced;
  } catch {
    /* no window during tests */
  }
  return day5ArtProbe;
}

/** Probe the yoga plate ladder once; flips the Day 4 button as soon as the art is in place. */
export async function probeDay4Art(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const files = [
      ...DAY4_SUB_GOAL_STAGES.map((def) => def.plateUrl),
      DAY4_FLASH_PLATE,
    ];
    const checks = await Promise.all(
      files.map((url) =>
        fetch(url, { method: "HEAD" })
          .then(
            (res) =>
              res.ok &&
              (res.headers.get("content-type") ?? "").startsWith("image/"),
          )
          .catch(() => false),
      ),
    );
    day4ArtProbe = checks.every(Boolean);
  } catch {
    day4ArtProbe = false;
  }
  return day4ArtProbe;
}

/**
 * Probe the bikini ladder. Day 4's probe also waits for its flash plate; Day 5 has none, so the list
 * is built by filtering out the `null` — which is exactly how a day without a reveal frame opts out
 * instead of shipping a fake file to satisfy a gate.
 */
export async function probeDay5Art(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const files = [
      ...DAY5_SUB_GOAL_STAGES.map((def) => def.plateUrl),
      ...(DAY5_FLASH_PLATE ? [DAY5_FLASH_PLATE] : []),
    ];
    const checks = await Promise.all(
      files.map((url) =>
        fetch(url, { method: "HEAD" })
          .then(
            (res) =>
              res.ok &&
              (res.headers.get("content-type") ?? "").startsWith("image/"),
          )
          .catch(() => false),
      ),
    );
    day5ArtProbe = checks.length > 0 && checks.every(Boolean);
  } catch {
    day5ArtProbe = false;
  }
  return day5ArtProbe;
}

/**
 * The gate the Day-5 finale card and `startDay6` both read. Day 6 ships four village plates and NO flash
 * frame (the finale pose is the payoff), so the probe lists exactly the four stage files — same discipline
 * as Day 5: inventing a fifth file to satisfy a gate would put unapproved art on screen.
 */
let day6ArtProbe = false;

export function isDay6Unlocked(): boolean {
  try {
    const forced = (window as unknown as { __day6Unlocked?: boolean })
      .__day6Unlocked;
    if (forced === true || forced === false) return forced;
  } catch {
    /* no window during tests */
  }
  return day6ArtProbe;
}

export async function probeDay6Art(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const files = [
      ...DAY6_SUB_GOAL_STAGES.map((def) => def.plateUrl),
      ...(DAY6_FLASH_PLATE ? [DAY6_FLASH_PLATE] : []),
    ];
    const checks = await Promise.all(
      files.map((url) =>
        fetch(url, { method: "HEAD" })
          .then(
            (res) =>
              res.ok &&
              (res.headers.get("content-type") ?? "").startsWith("image/"),
          )
          .catch(() => false),
      ),
    );
    day6ArtProbe = checks.length > 0 && checks.every(Boolean);
  } catch {
    day6ArtProbe = false;
  }
  return day6ArtProbe;
}

/** Day 2 runs on its own ladder: Day 1 goals are already paid off, so the bar is 10x higher. */
/** Step labels follow the live day, so the OBS ladder never shows Day 1 wording on Day 3. */
export function getStepLabelsForDay(streamDay: number): readonly string[] {
  if (streamDay === 6) return DAY6_STEP_LABELS;
  if (streamDay === 5) return DAY5_STEP_LABELS;
  if (streamDay === 4) return DAY4_STEP_LABELS;
  if (streamDay === 3) return DAY3_STEP_LABELS;
  if (streamDay === 2) return DAY2_STEP_LABELS;
  return DAY1_STEP_LABELS;
}

export function getShortStepLabelsForDay(streamDay: number): readonly string[] {
  if (streamDay === 6) return DAY6_SHORT_STEP_LABELS;
  if (streamDay === 5) return DAY5_SHORT_STEP_LABELS;
  if (streamDay === 4) return DAY4_SHORT_STEP_LABELS;
  if (streamDay === 3) return DAY3_SHORT_STEP_LABELS;
  if (streamDay === 2) return DAY2_SHORT_STEP_LABELS;
  return DAY1_SHORT_STEP_LABELS;
}

export function getSubGoalStagesForDay(
  streamDay: number,
): readonly SubGoalStageDef[] {
  if (streamDay === 6) return DAY6_SUB_GOAL_STAGES;
  if (streamDay === 5) return DAY5_SUB_GOAL_STAGES;
  if (streamDay === 4) return DAY4_SUB_GOAL_STAGES;
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

export function getSubGoalStageForSubs(
  subs: number,
  streamDay: number = 1,
): SubGoalStageIndex {
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
  return nextGoal.shyApproachLines[
    Math.abs(seed) % nextGoal.shyApproachLines.length
  ]!;
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
  if (currentSubs < 18000) return 560;
  // Day 4 (yoga) runs 18000 / 22000 / 26000, and a sub bought at the top of one day still has to
  // cost more than the last one bought at the bottom of the day before it.
  if (currentSubs < 22000) return 660;
  if (currentSubs < 26000) return 780;
  // Day 5 (bikini stream) runs 33000 / 40000 / 47000 — a +7000 stride, so the price keeps climbing
  // with it and a sub bought at the top of Day 4 still stays cheaper than one bought at the bottom of 5.
  if (currentSubs < 33000) return 910;
  if (currentSubs < 40000) return 1060;
  if (currentSubs < 47000) return 1220;
  if (currentSubs < 54000) return 1600;
  // Day 6 (village stream) runs 54000 / 61000 / 68000. Same +7000 stride, same rule as every other day:
  // a sub bought at the top of Day 5 must stay cheaper than one bought at the bottom of Day 6.
  if (currentSubs < 61000) return 1820;
  if (currentSubs < 68000) return 2060;
  return 2320;
}

export function getGiftSubPackCost(currentSubs: number, count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += getGiftSubUnitCost(currentSubs + i);
  }
  return total;
}

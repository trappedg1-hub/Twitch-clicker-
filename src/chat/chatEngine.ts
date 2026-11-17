import type {
  SubGoalStageDef,
  SubGoalStageIndex,
  TapZoneId,
  UpgradeId,
} from '../domain/types.ts';
import { contradictsWardrobe, getWardrobe } from '../domain/wardrobe.ts';

export interface ChatMessage {
  id: string;
  author: string;
  color: string;
  badge?: 'MOD' | 'VIP' | 'SUB' | 'DONATE';
  text: string;
  isSystemHighlight?: boolean;
}

const VIEWER_NICKS: readonly { name: string; color: string; badge?: ChatMessage['badge'] }[] = [
  { name: 'k0tik_v_chate', color: '#ff75c3', badge: 'VIP' },
  { name: 'shadow_sniper99', color: '#00e5ff' },
  { name: 'Pasha_Donater', color: '#ffb703', badge: 'SUB' },
  { name: 'neko_chan_uwu', color: '#b388ff', badge: 'SUB' },
  { name: 'artem_2am', color: '#69f0ae' },
  { name: 'simp_police_ru', color: '#4dd0e1', badge: 'MOD' },
  { name: 'dima_bez_sna', color: '#ff8a65' },
  { name: 'milky_tea_x', color: '#f48fb1' },
  { name: 'cyber_pelmen', color: '#ffd54f' },
  { name: 'vlad_4k_monitor', color: '#80cbc4', badge: 'VIP' },
  { name: 'stepan_lurker', color: '#ce93d8' },
  { name: 'maksim_simp', color: '#ff5252', badge: 'SUB' },
  { name: 'feet_inspector_77', color: '#f9a8d4', badge: 'VIP' },
  { name: 'night_owl_msk', color: '#a5b4fc' },
  { name: 'gachi_baron', color: '#fcd34d', badge: 'SUB' },
  { name: 'clip_hunter_ru', color: '#67e8f9' },
];

const AMBIENT_BY_STAGE: Record<SubGoalStageIndex, readonly string[]> = {
  0: [
    'привет! так укуталась в худи и носочки, милота :peepoShy: :miyaLove:',
    'чат го накидаем 10 сабов чтобы сняла носочки!! :SubHype: :Pog:',
    'она реально паникует когда ползёт Sub Goal ахаха :monkaS: :LUL:',
    'даже через худи видно какие там формы :BOOBA: :AWOOGA:',
    'ребят тут реальный Sub Goal на раздевание, не переключаемся! :EZ: :ClipIt:',
    'ключицы в вырезе худи уже сводят с ума :Nosebleed: :peepoShy:',
    'ставлю сотку что к концу стрима она раскрепостится на все 100% :EZ: :Pog:',
  ],
  1: [
    '10 сабов есть — босые ступни уже в кадре :AWOOGA: :Kreygasm:',
    'педикюр огонь, чат жмём до 50 сабов на легинсы!! :SubHype: :Pog:',
    'пальчики поджала от смущения ахах, сохраняю клип :ClipIt: :peepoShy:',
    'скоро снимет легинсы, модеры держите оборону :monkaS: :BOOBA:',
    'ценители ножек уже окупили ей аренду квартиры :LUL: :miyaLove:',
    'как же ей идёт краснеть босиком перед вебкой :Nosebleed: :Kreygasm:',
  ],
  2: [
    'уютное худи с ключицами + полностью голые ляжки = лучший фетиш :BOOBA: :AWOOGA:',
    'без легинсов вид стал в 10 раз горячее, у меня перегрев :Overheat: :Nosebleed:',
    'ЧАТ ДАВИМ ДО 200 САБОВ, СНИМАЕМ ХУДИ!! :EZ: :SubHype:',
    'фарфоровые коленки и бёдра в свете лампы просто гипноз :Kreygasm: :ClipIt:',
    'зашёл на 5 минут, сижу уже второй час без отрыва :AWOOGA: :LUL:',
    'представьте что там спрятано под этим серым худи... :BOOBA: :Overheat:',
  ],
  3: [
    'ПОД ХУДИ БЫЛА ТАКАЯ ТЕСНАЯ КРОП-ТИШКА?! :BOOBA: :AWOOGA: :Nosebleed:',
    'животик и глубокий вырез просто космос, не зря били 200 сабов :Overheat: :miyaLove:',
    'Твич не забань пожалуйста, мы почти добили 500 сабов на бралетт :monkaS: :BOOBA:',
    'зашёл с рекомендаций по клипу — инста платная сабка :EZ: :ClipIt: :SubHype:',
    'как натягивается принт геймпада на каждом вдохе... спасите :Nosebleed: :Kreygasm:',
    'одной рукой печатать в чате всё сложнее ахах :Overheat: :LUL:',
  ],
  4: [
    '500 САБОВ!! ЧЁРНЫЙ БРАЛЕТТ В ПРЯМОМ ЭФИРЕ!! :BOOBA: :AWOOGA: :Nosebleed:',
    'первый день добит на 500! завтра второй день — все вещи и улучшения переезжают с нами! :EZ: :Pog:',
    'из зажатой скромницы в носочках в королеву фансервиса :Overheat: :Kreygasm: :miyaLove:',
    'второй день будет ещё горячее — Мия уже совсем раскрепостилась! :SubHype: :AWOOGA:',
    'я уже 15 клипов нарезал с этим бралеттом :ClipIt: :Nosebleed:',
    'пульс 160, вызывайте скорую в чат :Overheat: :BOOBA:',
  ],
};

const ZONE_CHAT_REACTIONS: Record<TapZoneId, readonly string[]> = {
  head: [
    'АХАХ как же она залилась краской и закусила губку :peepoShy: :AWOOGA:',
    'эти томные глазки и румянец просто нелегальны :Nosebleed: :Kreygasm:',
    'подмигнула прямо мне в душу, лови сабку :AWOOGA: :miyaLove:',
    'сохранил этот взгляд на обои рабочего стола :ClipIt: :peepoShy:',
    'голос сорвался на шёпот, мурашки по спине :Overheat: :Kreygasm:',
  ],
  chest: [
    ':BOOBA: :AWOOGA: оператор, лучший ракурс во вселенной!!',
    'ФИЗИКА ДЫХАНИЯ МОЁ ПОЧТЕНИЕ, ЧАТ ФИКСИРУЕМ :BOOBA: :Nosebleed: :ClipIt:',
    'у меня монитор запотел от такого глубокого вдоха :Overheat: :Kreygasm:',
    'чат, кидаем сабы активнее ради такого декольте :SubHype: :AWOOGA:',
    'каждый раз когда она вздрагивает — +10 лет к жизни :BOOBA: :miyaLove:',
    'модеры сами залипли и забыли про правила :monkaS: :LUL: :BOOBA:',
  ],
  belly: [
    'какая тонкая талия и животик :AWOOGA: :Nosebleed: чатик фиксируем!!',
    'она так сладко ойкает и изгибается от щекотки :Overheat: :Kreygasm:',
    'в комнате резко поднялась температура на 10 градусов :Overheat: :Pog:',
    'фигура просто эталонные песочные часы из манхвы :BOOBA: :AWOOGA:',
    'этот изгиб талии гипнотизирует сильнее маятника :Kreygasm: :miyaLove:',
  ],
  legs: [
    'посадка с голыми ножками в кресле — чистый гипноз 10/10 :AWOOGA: :Nosebleed:',
    'блеск кожи на бёдрах под кольцевой лампой сводит с ума :Overheat: :Kreygasm:',
    'даже офисное кресло с такими ляжками выглядит как королевский трон :BOOBA: :EZ:',
    'невозможно моргать, боюсь пропустить хоть секунду :ClipIt: :AWOOGA:',
    'ляжки мечты, оформляю подарочные сабки без раздумий :SubHype: :miyaLove:',
  ],
  feet: [
    'СТУПНИ КРУПНЫМ ПЛАНОМ :AWOOGA: :Nosebleed: ЧАТ ОБЩИЙ СБОР!!',
    'как она сжимает пальчики от щекотки — это сразу в клипы :ClipIt: :Kreygasm:',
    'ценители босых ножек сегодня закидывают весь Sub Goal :EZ: :SubHype: :miyaLove:',
    'аккуратный педикюр и розовые пяточки 100/10 :AWOOGA: :Overheat:',
    'лови ещё донат за фансервис с ножками!! :SubHype: :Kreygasm:',
  ],
};

const DONATION_TTS_LINES: readonly string[] = [
  '«Не прикрывайся руками, ты невероятно сексуальная! Кидаю в копилку на Sub Goal! :AWOOGA: :SubHype:»',
  '«Пошевели ещё раз пальчиками на камеру — и с меня пачка подарочных сабов! :Kreygasm: :miyaLove:»',
  '«Твой смущённый вздох в микрофон растопил мне мозг, держи на косплей! :Nosebleed: :Overheat:»',
  '«Наклонись за чашечкой ещё разок на бис плз, чат просит!! :BOOBA: :ClipIt:»',
  '«Лучшая стримерша Твича, ни в чём себе не отказывай и снимай лишнее смелее! :EZ: :SubHype:»',
];

const VIRAL_CLIP_TITLES: Record<TapZoneId, readonly string[]> = {
  head: [
    'МИЯ ТОМНО ЗАКУСИЛА ГУБКУ В 1080p60',
    'СМУЩЁННЫЙ ШЁПОТ МИИ СЛОМАЛ ЧАТ',
  ],
  chest: [
    'ФИЗИКА НА ВДОХЕ!! ЧАТ УЛЕТЕЛ В КОСМОС',
    'СЛУЧАЙНО НАКЛОНИЛАСЬ СЛИШКОМ БЛИЗКО К ВЕБКЕ',
  ],
  belly: [
    'СЛАДКО ВЫГНУЛАСЬ ОТ ЩЕКОТКИ В ПРЯМОМ ЭФИРЕ',
    'ТАЛИЯ И ЖИВОТИК КРУПНЫМ ПЛАНОМ',
  ],
  legs: [
    'БЁДРА И ПОДВЯЗКА В СВЕТЕ КОЛЬЦЕВОЙ ЛАМПЫ',
    'ПОМЕНЯЛА ПОЗУ В КРЕСЛЕ — ОНЛАЙН Х2',
  ],
  feet: [
    'БОСЫЕ ПЯТОЧКИ ПРЯМО НА СТОЛЕ ПЕРЕД ЛИНЗОЙ 4K',
    'СЖАЛА ПАЛЬЧИКИ ОТ ЩЕКОТКИ НА КАМЕРУ',
  ],
};

const UPGRADE_CHAT_REACTIONS: Record<UpgradeId, string> = {
  ring_lamp: 'Оо, с новым светом каждый изгиб и блик на коже светится как в манхве :AWOOGA: :Kreygasm:',
  usb_mic_pop: 'Звук пушка, теперь слышно каждое горячее дыхание и влажный шёпот :Nosebleed: :Overheat:',
  obs_alerts: 'АХАХ как же сладко она подпрыгивает от вибро-алертов :BOOBA: :ClipIt: :LUL:',
  webcam_focus: 'Чёткость 1080p60!! Чат протираем запотевшие мониторы :AWOOGA: :BOOBA: :Pog:',
  chat_emotes: 'УРА НОВЫЕ 7TV СМАЙЛЫ ФАНСЕРВИСА :AWOOGA: :Nosebleed: :Overheat: :miyaLove:',
  clips_boost: 'РЕЙД С ВИРУСНОГО КЛИПА!! Добиваем Sub Goal всем чатом :ClipIt: :Pog: :SubHype:',
  desk_mic: 'НА СТОЛЕ ПОЯВИЛСЯ МИКРОФОН! Теперь звук стрима стал в 10 раз чище :AWOOGA: :Pog:',
};

let seqCounter = 0;
function nextMsgId(): string {
  seqCounter += 1;
  return `chat_${Date.now()}_${seqCounter}`;
}

/** Day 2: the chat shows up already dressed and instantly starts egging her on. */
const AMBIENT_DAY2: readonly string[] = [
  'ну давай, Мия, повторим вчерашнее? чат уже готов :SubHype: :Pog:',
  'худи на ней сидело опаснее, чем вчерашний бралетт :BOOBA: :AWOOGA:',
  'гольфы в полоску — это же ловушка, они долго не продержатся :Kreygasm: :LUL:',
  'она вспомнила вчерашний вечер и снова краснеет, лучшее украшение эфира :peepoShy:',
  'вчерашние саб-цели пробиты... сегодня мы их просто повторим :EZ: :ClipIt:',
  'сидит обняв колени, как будто мы не видели всё это 12 часов назад :AWOOGA: :miyaLove:',
  'спорю, к концу эфира она снимет и худи, и гольфы, и топ :Pog: :Overheat:',
  'чат, спокойно: она только СДЕЛАЛА ВИД, что подумает над «повтори» :LUL: :Nosebleed:',
];

/**
 * Day 2 ambient chat, phase by phase (1500 / 2000 / 2500 / 5000). The chat reacts to what is on
 * screen at THIS sub goal instead of recycling one generic pool, so the room feels alive as she
 * climbs. Anything that would contradict the plate is filtered out below by the same wardrobe
 * guard Miya's own lines use.
 */
const AMBIENT_DAY2_BY_STAGE: Record<SubGoalStageIndex, readonly string[]> = {
  0: [
    'худи через голову, гольфы натянуты — она оделась как на войну. 1500 сабов это решат :Pog:',
    'день 2, а она всё ещё в коконе. доверьтесь чату, мия_няш :SubHype:',
    'гольфы как школьной форме, чат уже не может :Kreygasm: :peepoShy:',
    'она помнит вчерашнее и краснеет заранее. лучший контент без всякого фансервиса :ClipIt:',
    'спорим на сабку: худи улетит первым, а гольфы она будет защищать до последнего :EZ: :monkaS:',
  ],
  1: [
    'худи нет, майка есть — план выполнен на четверть, чат ликует :Pog:',
    'гольфы всё ещё натянуты, но мы знаем, что резинка не железная :LUL:',
    'она одёргивает подол каждые три секунды, я записал четыре клипа :ClipIt: :Nosebleed:',
    'следующая цель — худи на талию. вяжем, девочки, не торопим :monkaS: :SubHype:',
    '1500 сабов и ни одного намёка с её стороны. она честный человек :peepoShy:',
  ],
  2: [
    'худи на талии = +500 к уверенности, топ = -500 к её стыду :BOOBA:',
    'гольфы у щиколоток, а она делает вид, что так и было задумано :peepoShy:',
    'узел развяжется сам, чат уже скинулся на гравитацию :Pog:',
    '2000 сабов, а она до сих пор думает, что мы не заметили топ :Kreygasm: :ClipIt:',
    'она завязала худи САМА. это главное, чат, запомните навсегда :LUL: :miyaLove:',
  ],
  3: [
    'ЛЯМКИ ОБЕ. я записал 47 клипов за 30 секунд :AWOOGA:',
    'она натянула гольфы обратно и считает это победой. мы тоже :sub2: :Pog:',
    'худи за спиной, колени у камеры — 2500 сабов отработали каждую копейку :Pog:',
    'до финала 2500 сабов. добиваем, легион, не спамим но скидываем :SubHype: :monkaS:',
    'смотрит в камеру как будто это нормально. чат, это не нормально, это прекрасно :Nosebleed:',
  ],
  4: [
    '5000 САБОВ. ОНА ВСТАЛА НА КОЛЕНИ У КАМЕРЫ. ЧАТ В ШОКЕ :AWOOGA:',
    'босые ступни на сиденье, гольфы в углу — план чата выполнен полностью :Pog:',
    'забираю клип в избранное, спасибо за лучший вечер, мия_няш :miyaLove: :SubHype:',
    'она сказала «завтра сюрприз»?? чат уже скупает сабы на день 3 :monkaS: :sub2:',
    'завтра косплей, я уже предчувствую, что не усну до эфира :AWOOGA: :Overheat:',
  ],
};

/**
 * Day 3 «призрачная стримерша»: a cut-down sheet over a glossy bodysuit and fishnets.
 * The chat plays the convention jury AND the horror fan at the same time, and it talks about
 * the reveal mechanic (the «Бу!» flash frame) exactly the way a real Twitch chat would.
 */
const AMBIENT_DAY3: readonly string[] = [
  'простыня с дырками для глаз — гениально, я плакал. 7000 сабов, быстро :AWOOGA: :SubHype:',
  'контраст дня: сверху мем-призрак, снизу СЕТКА. это лучший продакшн на твиче :Pog: :Kreygasm:',
  'она САМА резала края ножницами. я пересматриваю клип, где шов разошёлся :ClipIt: :LUL:',
  '«это отыгрыш призрака», сказала она, прижимая ткань. конечно, дорогая, отыгрыш :peepoShy: :monkaS:',
  'шорох простыни в микрофоне за 10-й тир — это ASMR-контент, чат, мы нашли золото :Overheat:',
  'дырки кривые, глаза светятся, улыбка в третьей дырке. косплей года, без шуток :miyaLove: :SubHype:',
];

/** Exported for scripts/linescan_days.ts: the viewers' per-stage chatter about the costume. */
export const AMBIENT_DAY3_BY_STAGE: Record<SubGoalStageIndex, readonly string[]> = {
  0: [
    'она стоит белым прямоугольником и молчит. 7000 сабов или призрак не отпустит :Pog: :monkaS:',
    'простыня до середины бедра, сетка внизу, и НИЧЕГО больше. это лучший троллинг чата :EZ: :ClipIt:',
    'глаза через дырку подведены, светятся, я не сплю третий час :AWOOGA: :peepoShy:',
    'призрак в обтяжку не даст, призрак стоит статично. учебник выдержки, том 1 :LUL:',
    'саб-цель 7000: сдвинуть ткань с плеча. мы люди вежливые, мы просто скидываем :SubHype: :sub2:',
  ],
  1: [
    'ПЛЕЧО ОТКРЫТО. простыня съехала на одно плечо, и чат потерял рассудок :Pog: :Nosebleed:',
    'Боди без бретелек сползло набок = 47 клипов за минуту, статистика не врёт :ClipIt: :LUL:',
    'она держит ткань одной рукой и делает вид, что так и было задумано :peepoShy: :monkaS:',
    'сетка стала видна выше, и это, чат, прогресс. 10000 сабов, легион, потихоньку :SubHype: :sub2:',
    'призрак с голым плечом — новый жанр, я уже рисую фанарт :Kreygasm: :miyaLove:',
  ],
  2: [
    'ОБТЯЖКА. она прижала простыню и получила силуэт. физика, не фансервис :Pog: :AWOOGA:',
    'натянула ткань на груди, назвала это сквозняком. в комнате нет окон, мы проверяли :LUL: :ClipIt:',
    '10000 сабов и ни одного слова «сними». мы культурные призраколовы, мы ждём :monkaS: :sub2:',
    'обтяжка + сетка = композиция кадра. она учит нас искусству, буквально :miyaLove: :Overheat:',
    'следующая цель 13000: призрак приоткроет ткань. скидываемся молча, без спама :EZ: :SubHype:',
  ],
  3: [
    'ПРОСТЫНЯ ЗАДРАЛАСЬ, БОДИ ДО ТАЛИИ. 13000 сабов отработали каждую копейку :Pog: :Nosebleed:',
    '«Бу!» и ткань вверх. я пересматриваю этот клип, кажется, в сорок седьмой раз :ClipIt: :AWOOGA:',
    'сетка от бедра, плащ-прикрытие в руках. призрак стал обложкой, чат, мы победили :Kreygasm:',
    'она стоит и держит ткань, а мы держим сабы. 15000 до финала, никто не спит :monkaS: :sub2:',
    'до финального кадра 2000 сабов. легион, это последний забег призрака :SubHype: :Overheat:',
  ],
  4: [
    '15000 САБОВ. ПРОСТЫНЯ УШЛА НА ПЛЕЧИ КАК ПЛАЩ. БОДИ + СЕТКА + ПОЗА :AWOOGA: :Pog: :SubHype:',
    'финальная поза с арта, дырки для глаз на месте, плащ развевается. косплей принят без замечаний :Kreygasm:',
    'призрак разделся до костюма, чат распался на клипы. лучший эфир года, я не шучу :ClipIt: :miyaLove:',
    'она сказала «бу» в последний раз, и у меня ком в горле. спокойной ночи, призрачиха :peepoShy: :Overheat:',
    'завтра новый формат?? я уже купил сабы на неделю вперёд, готовьтесь, легион :monkaS: :sub2:',
  ],
};

export function createAmbientChatMessage(
  _onlineViewers: number,
  displayedStage: SubGoalStageIndex = 0,
  seed = seqCounter,
  streamDay = 1,
): ChatMessage {
  const viewer = VIEWER_NICKS[seed % VIEWER_NICKS.length]!;
  const pool =
    streamDay === 3
      ? [
          ...(AMBIENT_DAY3_BY_STAGE[displayedStage] ?? []),
          ...AMBIENT_DAY3,
        ]
      : streamDay === 2
        ? [
            ...(AMBIENT_DAY2_BY_STAGE[displayedStage] ?? []),
            ...AMBIENT_DAY2,
          ]
        : (AMBIENT_BY_STAGE[displayedStage] ?? AMBIENT_BY_STAGE[0]);
  // Same wardrobe truth the heroine's own lines use: chat may beg, but it should not narrate an
  // outfit the plate contradicts ("she looks dangerous in the hoodie" at 5000 subs).
  const wardrobe = getWardrobe(streamDay, displayedStage);
  const usable = pool.filter((line) => contradictsWardrobe(line, wardrobe) === null);
  const spoken = usable.length > 0 ? usable : pool;
  const text = spoken[(seed * 3) % spoken.length]!;
  return {
    id: nextMsgId(),
    author: viewer.name,
    color: viewer.color,
    badge: viewer.badge,
    text,
  };
}

export function createZoneBurstMessage(
  zone: TapZoneId,
  displayedStage: SubGoalStageIndex = 0,
  seed = seqCounter,
  streamDay = 1,
): ChatMessage {
  const viewer = VIEWER_NICKS[(seed * 3 + 2) % VIEWER_NICKS.length]!;
  if (streamDay === 3) {
    // Ghost day: every tap is a «Бу!» - the sheet flies for a frame and the chat clips it forever.
    const day3Text =
      zone === 'feet' || zone === 'legs'
        ? 'бу! и сетка мелькнула. это единственный фансервис, который я готов обсудить :Pog: :ClipIt:'
        : zone === 'head'
          ? 'она смотрит на вас ЧЕРЕЗ ДЫРКУ ДЛЯ ГЛАЗ и это работает лучше любого декольте :peepoShy: :AWOOGA:'
          : 'БУ! простыня взлетела на кадр, чат взорвался на триггер :SubHype: :Nosebleed: :LUL:';
    return {
      id: nextMsgId(),
      author: viewer.name,
      color: viewer.color,
      badge: viewer.badge,
      text: day3Text,
    };
  }
  if (streamDay === 2) {
    // Day 2 costume logic: knees hugged up, legs in opaque golf socks, hoodie fully on.
    const day2Text =
      zone === 'feet' || zone === 'legs'
        ? 'гольфы остаются на ногах... пока чат не набьёт ещё сабов :SubHype: :AWOOGA:'
        : 'худи на ней висит как платье, а чат уже требует вчерашнее шоу :BOOBA: :monkaS:';
    return {
      id: nextMsgId(),
      author: viewer.name,
      color: viewer.color,
      badge: viewer.badge,
      text: day2Text,
    };
  }
  if (zone === 'feet' && displayedStage === 0) {
    return {
      id: nextMsgId(),
      author: viewer.name,
      color: viewer.color,
      badge: viewer.badge,
      text: 'полосатые носочки милые, но го 10 сабов чтобы увидеть голые пяточки!! :SubHype: :AWOOGA:',
    };
  }
  if (zone === 'legs' && displayedStage <= 1) {
    return {
      id: nextMsgId(),
      author: viewer.name,
      color: viewer.color,
      badge: viewer.badge,
      text: 'даже в обтягивающих легинсах ляжки огонь, жмём 50 сабов! :BOOBA: :SubHype:',
    };
  }
  if (zone === 'chest' && displayedStage <= 2) {
    return {
      id: nextMsgId(),
      author: viewer.name,
      color: viewer.color,
      badge: viewer.badge,
      text: 'как натягивается худи на груди... срочно 200 сабов в чат!! :BOOBA: :Overheat:',
    };
  }
  const pool = ZONE_CHAT_REACTIONS[zone];
  return {
    id: nextMsgId(),
    author: viewer.name,
    color: viewer.color,
    badge: viewer.badge,
    text: pool[seed % pool.length]!,
  };
}

export function createViralClipChatMessage(
  zone: TapZoneId,
  onlineViewers: number,
  seed = seqCounter,
): ChatMessage {
  const clipper = VIEWER_NICKS[(seed * 5 + 3) % VIEWER_NICKS.length]!;
  const titles = VIRAL_CLIP_TITLES[zone];
  const title = titles[Math.abs(seed) % titles.length]!;
  const views = Math.max(48, onlineViewers * (6 + (seed % 7)));
  return {
    id: nextMsgId(),
    author: 'TwitchClips',
    color: '#a78bfa',
    badge: 'MOD',
    text: `${clipper.name} сохранил клип «${title}» (${views} просм.) :ClipIt: :AWOOGA: :Nosebleed:`,
    isSystemHighlight: true,
  };
}

export function createDonationChatMessage(amount: number, seed = seqCounter): ChatMessage {
  const viewer = VIEWER_NICKS[(seed * 5 + 1) % VIEWER_NICKS.length]!;
  const tts = DONATION_TTS_LINES[Math.abs(seed) % DONATION_TTS_LINES.length]!;
  return {
    id: nextMsgId(),
    author: viewer.name,
    color: '#ffd54f',
    badge: 'DONATE',
    text: `задонатил ${amount} ₽: ${tts}`,
    isSystemHighlight: true,
  };
}

export function createSubNotificationMessage(
  count: number,
  isGifted: boolean,
  totalSubs: number,
  seed = seqCounter,
): ChatMessage {
  const viewer = VIEWER_NICKS[(seed * 7 + 3) % VIEWER_NICKS.length]!;
  if (isGifted) {
    return {
      id: nextMsgId(),
      author: 'VIP_Sponsor',
      color: '#c084fc',
      badge: 'SUB',
      text:
        count === 1
          ? `подарил подписку ради фансервиса! (Всего: ${totalSubs} сабов) :SubHype: :miyaLove:`
          : `подарил ПАЧКУ ${count} ПОДПИСОК каналу! (Всего: ${totalSubs} сабов) :SubHype: :AWOOGA: :Pog:`,
      isSystemHighlight: count >= 5,
    };
  }
  return {
    id: nextMsgId(),
    author: viewer.name,
    color: '#c084fc',
    badge: 'SUB',
    text: `оформил платную подписку Tier 1! (${totalSubs} сабов) :SubHype: :miyaLove:`,
  };
}

/** Day 1 close-out chatter. */
const FAREWELL_CHAT_DAY1: readonly {
  author: string;
  color: string;
  badge?: ChatMessage['badge'];
  text: string;
  highlight?: boolean;
}[] = [
  {
    author: 'StreamBot',
    color: '#c084fc',
    badge: 'MOD',
    text: '★ ЭФИР ЗАКРЫВАЕТСЯ! Мия прощается с чатом после 500 сабов! :SubHype: :miyaLove:',
    highlight: true,
  },
  {
    author: 'k0tik_v_chate',
    color: '#ff75c3',
    badge: 'VIP',
    text: 'НУ НЕЕЕ, только не уходи!! ещё пятак сабов и она останется :peepoShy: :monkaS:',
  },
  {
    author: 'Pasha_Donater',
    color: '#ffb703',
    badge: 'SUB',
    text: 'первый стрим и 500 сабов — это легенда. спокойной ночи, Мия! :Pog:',
  },
  {
    author: 'feet_connoisseur',
    color: '#f472b6',
    badge: 'SUB',
    text: 'гольф-носки и оверсайз худи завтра?? чат уже оформил подписки на второй день :AWOOGA: :Kreygasm:',
  },
  {
    author: 'shadow_sniper99',
    color: '#00e5ff',
    text: 'клип с прощанием уже в залипнуто, всем спать, завтра 1000 сабов бьём :ClipIt: :LUL:',
  },
];

/** Day 2 close-out chatter: the room already knows she is stronger now, and asks about the cosplay. */
const FAREWELL_CHAT_DAY2: readonly {
  author: string;
  color: string;
  badge?: ChatMessage['badge'];
  text: string;
  highlight?: boolean;
}[] = [
  {
    author: 'StreamBot',
    color: '#c084fc',
    badge: 'MOD',
    text: '★ ДЕНЬ 2 ЗАКРЫТ: 5000 САБОВ! Чат прошёл весь путь от носочков до финала :SubHype: :Pog:',
    highlight: true,
  },
  {
    author: 'k0tik_v_chate',
    color: '#ff75c3',
    badge: 'VIP',
    text: 'НУ НЕЕЕ, она уходит на пике!! я ещё не насмотрелся :peepoShy: :monkaS:',
  },
  {
    author: 'Pasha_Donater',
    color: '#ffb703',
    badge: 'SUB',
    text: 'пять тысяч сабов и ни одной жалобы от модеров. это легенда, Мия :Pog:',
  },
  {
    author: 'feet_connoisseur',
    color: '#f472b6',
    badge: 'SUB',
    text: 'завтра КОСПЛЕЙ?? говорят, призрак в простыне. я уже оплатил три подписки вперёд :AWOOGA: :Kreygasm:',
  },
  {
    author: 'neko_chan_uwu',
    color: '#00e5ff',
    text: 'залип на прощание, она впервые УЛЫБНУЛАСЬ в камеру. спокойной ночи, чат :miyaLove: :ClipIt:',
  },
];

/** Day 3 (cosplay) close-out chatter. */
const FAREWELL_CHAT_DAY3: readonly {
  author: string;
  color: string;
  badge?: ChatMessage['badge'];
  text: string;
  highlight?: boolean;
}[] = [
  {
    author: 'StreamBot',
    color: '#c084fc',
    badge: 'MOD',
    text: '★ КОСПЛЕЙ-ДЕНЬ ЗАКРЫТ: 15000 САБОВ! Призрак в боди и сетке принят жюри без замечаний :SubHype: :Pog:',
    highlight: true,
  },
  {
    author: 'k0tik_v_chate',
    color: '#ff75c3',
    badge: 'VIP',
    text: 'призрак ушёл сквозь стену, а я остался с клипами и пустым кошельком :peepoShy: :LUL:',
  },
  {
    author: 'Pasha_Donater',
    color: '#ffb703',
    badge: 'SUB',
    text: 'пятнадцать тысяч сабов: простыня, сетка, боди. я видел всё, спокойной ночи, Мия :Pog:',
  },
  {
    author: 'cosplay_anon',
    color: '#f472b6',
    badge: 'SUB',
    text: '«Бу!» и простыня вверх — высшая лига косплей-монтажа, чат запомнит :AWOOGA: :ClipIt:',
  },
  {
    author: 'shadow_sniper99',
    color: '#00e5ff',
    text: 'следующий формат?? мы идём на что угодно, только не выключайте камеру :monkaS: :sub2:',
  },
];

const DAY2_PROVOCATION_CHAT: readonly {
  author: string;
  color: string;
  badge?: ChatMessage['badge'];
  text: string;
  highlight?: boolean;
}[] = [
  {
    author: 'StreamBot',
    color: '#c084fc',
    badge: 'MOD',
    text: '★ ДЕНЬ 2 НАЧАЛСЯ! Чат требует: повторить вчерашний прогиб по саб-целям! :SubHype: :Pog:',
    highlight: true,
  },
  {
    author: 'feet_connoisseur',
    color: '#f472b6',
    badge: 'SUB',
    text: 'ну давай, вчерашние носочки были лучше, чем эти гольфы :Kreygasm: :Kreygasm:',
  },
  {
    author: 'Pasha_Donater',
    color: '#ffb703',
    badge: 'SUB',
    text: 'она смущается ВСЕГО ЛИШЬ на 500% сильнее, чем вчера, это идеально :AWOOGA: :miyaLove:',
  },
  {
    author: 'k0tik_v_chate',
    color: '#ff75c3',
    badge: 'VIP',
    text: 'чат уже скинулся на «а теперь как вчера, только медленнее» :LUL: :ClipIt:',
  },
  {
    author: 'shadow_sniper99',
    color: '#00e5ff',
    text: 'худи натянула до бровей? через сотню сабов всё равно спадёт с плеча, мы уже проходили :EZ:',
  },
  {
    author: 'mod_kirito',
    color: '#7ee787',
    badge: 'MOD',
    text: 'напоминаю: вчерашние клипы разлетелись по репостам. Мия, тебя узнали в очереди за кофе :Overheat:',
  },
];

/** Chat eggs Miya on to repeat yesterday's strip ladder, beat by beat. */
export function createDay2ProvocationChatMessage(index: number): ChatMessage {
  const def = DAY2_PROVOCATION_CHAT[index % DAY2_PROVOCATION_CHAT.length]!;
  return {
    id: nextMsgId(),
    author: def.author,
    color: def.color,
    badge: def.badge,
    text: def.text,
    isSystemHighlight: def.highlight ?? false,
  };
}

/** One viewer goodbye line per farewell beat of the Day 1 finale. */
/** The goodbye chat follows the day that just ended - no stale "500 subs" copy on Day 3. */
export function createFarewellChatMessage(index: number, streamDay = 1): ChatMessage {
  const pool = streamDay === 3 ? FAREWELL_CHAT_DAY3 : streamDay === 2 ? FAREWELL_CHAT_DAY2 : FAREWELL_CHAT_DAY1;
  const def = pool[index % pool.length]!;
  return {
    id: nextMsgId(),
    author: def.author,
    color: def.color,
    badge: def.badge,
    text: def.text,
    isSystemHighlight: def.highlight ?? false,
  };
}

export function createSubGoalCascadeMessages(stageDef: SubGoalStageDef): ChatMessage[] {
  return stageDef.chatCascade.map((m) => ({
    id: nextMsgId(),
    author: m.author,
    color: m.color,
    badge: m.badge,
    text: m.text,
    isSystemHighlight: m.isSystemHighlight,
  }));
}

export function createUpgradeChatMessage(upgradeId: UpgradeId): ChatMessage {
  return {
    id: nextMsgId(),
    author: 'StreamBot',
    color: '#c084fc',
    badge: 'MOD',
    text: UPGRADE_CHAT_REACTIONS[upgradeId],
    isSystemHighlight: true,
  };
}

export function createMilestoneChatMessage(title: string): ChatMessage {
  return {
    id: nextMsgId(),
    author: 'StreamBot',
    color: '#00e676',
    badge: 'MOD',
    text: `★ РЕКОРД СТРИМА: ${title}! Чат кипит от фансервиса :Overheat: :Pog: :SubHype:`,
    isSystemHighlight: true,
  };
}

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


/**
 * Day 4 tap reactions. On the yoga day a tap never peels a garment off - it makes the chair take her
 * weight - so the chat reacts to BREATHING, HOLDING and DEPTH instead of to undressing, and it keeps
 * the socks on her feet (bare soles belong to Day 1 and the Day 2 finale, not here).
 */
export const ZONE_CHAT_REACTIONS_DAY4: Record<TapZoneId, readonly string[]> = {
  head: [
    'она ухмыляется, держась за край кресла, и показывает язык. четыре дня назад краснела из-за носочков :miyaLove: :LUL:',
    'это лицо на выдохе — сразу в клип, чат, разбираем :ClipIt: :AWOOGA:',
    'подмигивание в конце позы. она теперь делает это СОЗНАТЕЛЬНО :Kreygasm: :Pog:',
    'тянется к потолку и смотрит в камеру. кадр для обложки, без шуток :Nosebleed: :EZ:',
    'выдох через зубы, прядь прилипла ко лбу, и она не убрала. игра в один кадр :Overheat: :peepoShy:',
  ],
  chest: [
    'вязка на вдохе натягивается как барабан, а топ держится на честной физике :BOOBA: :Kreygasm:',
    'глубина вдоха в наклоне +10 к гибкости, и узор разъехался :Pog: :ClipIt:',
    'ни одной бретели, ни одной застёжки — и ни одного движения в сторону лифта :EZ: :monkaS:',
    'она специально ничего не поправляет. чат, ВООБЩЕ ничего :Overheat: :LUL:',
    'амплитуда вдоха такая, что чат забыл, зачем заходил :SubHype: :BOOBA:',
  ],
  belly: [
    'ладони плашмя на животе, пальцы врозь — это дыхание удджайи, чат, не шумим :EZ: :Pog:',
    'живот втянулся на выдохе, и вязка села складками. лучший урок анатомии на твиче :Kreygasm: :ClipIt:',
    'она держит корпус и дышит в микрофон. это ASMR по подписке :monkaS: :Overheat:',
    'пресс дрогнул в удержании — и она тут же спрятала это за улыбкой :SubHype: :miyaLove:',
    'ни одного лишнего движения, и все пять пальцев на голом животе :AWOOGA: :Nosebleed:',
  ],
  legs: [
    'голени легли на подлокотники, и кресло сказало «я не для этого создано» :LUL: :ClipIt:',
    'бедро раскрыто, спина ровная, шорты держатся на честном слове и красной резинке :Pog: :monkaS:',
    'растяжка сгибателей бедра. мы не подглядываем, мы УЧИМСЯ :EZ: :Kreygasm:',
    'закинула ногу на подлокотник и даже не напряглась. годы тренировок, чат :SubHype: :AWOOGA:',
    'кресло плюс её гибкость = новый инвентарь для фитнес-клубов :ClipIt: :Overheat:',
  ],
  feet: [
    'носочки с красной резинкой свисают с подлокотника, пальцы сжимаются в удержании :Pog: :miyaLove:',
    'СТУПНИ В НОСКАХ НА ПОДЛОКОТНИКАХ. чат, это кадр недели :AWOOGA: :Kreygasm:',
    'она тянет носок на себя и врозь — так асаны делают, а не так, как ты подумал :LUL: :EZ:',
    'пятки в мягких носках, пальцы работают. техника, только техника :ClipIt: :SubHype:',
    'носки на месте, чат. единственные пальцы, которые вы сегодня видите, — ввязанные в резинку :monkaS: :peepoShy:',
  ],
};

const DONATION_TTS_LINES: readonly string[] = [
  '«Не прикрывайся руками, ты невероятно сексуальная! Кидаю в копилку на Sub Goal! :AWOOGA: :SubHype:»',
  '«Пошевели ещё раз пальчиками на камеру — и с меня пачка подарочных сабов! :Kreygasm: :miyaLove:»',
  '«Твой смущённый вздох в микрофон растопил мне мозг, держи на косплей! :Nosebleed: :Overheat:»',
  '«Наклонись за чашечкой ещё разок на бис плз, чат просит!! :BOOBA: :ClipIt:»',
  '«Лучшая стримерша Твича, ни в чём себе не отказывай и снимай лишнее смелее! :EZ: :SubHype:»',
];


/**
 * Day 5 «5 бикини стрим»: the micro-bikini stream. Nothing comes off — there is nothing under it — so the
 * chat talks about DISTANCE (how close she let the lens get), the chair that took all her weight again, the
 * clear vinyl heels, and the fact that she is now the one naming prices. Exported for `copyAudit` and
 * `scripts/linescan_days.ts`, and every line here is checked against the plate that would be on screen.
 */
export const AMBIENT_DAY6: readonly string[] = [
 'отчёт по эфиру: шляпа на месте, подписки растут :Pog:',
 'проводим аванс по накладной, чат :SubHype:',
];
export const AMBIENT_DAY6_BY_STAGE: Record<SubGoalStageIndex, readonly string[]> = {
  0: ['огурец и кукуруза в руках, эфир начинается :Pog:'],
  1: ['комбинезон из детства, шляпа на месте :SubHype:'],
  2: ['огурец у щеки, чат обсуждает урожай :Pog:'],
  3: ['огурец во рту, урожай сочный :ClipIt:'],
  4: ['кукуруза в руках, ножки в масле :SubHype:'],
};
const FAREWELL_CHAT_DAY6: readonly { author: string; color: string; badge?: "MOD" | "SUB" | "VIP" | "DONATE"; text: string; highlight?: boolean }[] = [
 {author:'StreamBot', color:'#c084fc', badge:'MOD' as const, text:'урожай собран, эфир закрыт :SubHype:'},
 {author:'agronom', color:'#4ade80', badge:'SUB' as const, text:'накладная подписана, аванс отправлен :Pog:'},
 {author:'zritel', color:'#00e5ff', badge:'VIP' as const, text:'переработка прошла по тарифу :ClipIt:'},
 {author:'kaktus', color:'#4ade80', badge:'SUB' as const, text:'спасибо за эфир, до завтра :miyaLove:'},
 {author:'StreamBot', color:'#c084fc', badge:'MOD' as const, text:'спокойной ночи, чат :Pog:'},
];
export const AMBIENT_DAY5: readonly string[] = [
  'она сама придвинула кресло ближе к вебке. ПЯТЬ ДНЕЙ НАЗАД Я ТАКОГО НЕ МОГ ПРЕДСТАВИТЬ :Kreygasm: :ClipIt:',
  'микро-бикини, прозрачные шпильки и ни грамма смущения на лице. это не стриптиз, это деловая встреча :Pog: :LUL:',
  'стопа в кадре крупнее, чем её лицо. feet_connoisseur плачет от счастья, я видел его стрим :AWOOGA: :monkaS:',
  'неоновая ткань натянута так, что у меня слетел пресет контрастности. модерация, это физика материалов :EZ: :Overheat:',
  'она называет цены вслух и не краснеет. четыре дня назад за это я бы поставил ей чай и плед :sub2: :miyaLove:',
  'саб-цель 33000: обе ноги на подлокотнике. мы не извращенцы, мы просто считаем быстрее неё :SubHype: :ClipIt:',
];

export const AMBIENT_DAY5_BY_STAGE: Record<SubGoalStageIndex, readonly string[]> = {
  0: [
    'старт дня: нога вытянута вдоль сиденья прямо в линзу. кадр начинается со ступни, и это лучшее решение стрима :Pog: :ClipIt:',
    'она села ровно, сложилась спокойно и смотрит в камеру. чат уже понял, что сегодня он не управляет, а платит :LUL: :monkaS:',
    'узелки затянуты, спина прямая, улыбка деловая. она явно готовилась к этому эфиру сильнее, чем мы к работе :Kreygasm: :Pog:',
    '33000 сабов до «ножки в кадр». у нас есть вечер и ни одного сомнения, легион :SubHype: :sub2:',
    'пятый день, и она первая сказала «снимать нечего». это капитуляция чата, а не её :AWOOGA: :EZ:',
  ],
  1: [
    'обе ступни внизу кадра, руки у неё на своей лодыжке. я пересматриваю в замедлении и считаю пальцы :BOOBA: :ClipIt:',
    'ноги на подлокотнике, кресло сказало «я офисное», она сказала «терпи» :LUL: :Pog: :Kreygasm:',
    'она держит эту позу как будто ей платят. ей платят, чат, у неё прямо в описании написано :SubHype: :monkaS:',
    '40000 до разворота. легион, это не спойлер, это прайс-лист, она сама его озвучила :EZ: :ClipIt:',
    'прозрачные шпильки на просвете выглядят как отдельный предмет интерьера :Overheat: :Nosebleed:',
  ],
  2: [
    'она встала на колени в собственном кресле и смотрит назад через плечо. у меня пропал голос, включился клип :ClipIt: :Pog:',
    'спина длинная, лопатки сведены, ткань легла по талии. это не «кошечка», это демонстрация техники, чат :LUL: :Kreygasm:',
    'одна шпилька висит на ремешке и она её не поправляет. НИ НЕ ПОПРАВЛЯЕТ, легион :AWOOGA: :Overheat:',
    '40000 САБОВ. она развернулась ровно так, как просил весь чат, и ни разу не «ой» :SubHype: :miyaLove:',
    'чат пять дней писал «кошечку», а она просто дождалась нужной цифры. уважаю коммерческую честность :EZ: :Pog:',
  ],
  3: [
    'разворот квадратно к вебке. ближе всего к линзе то, что чат просил с первого дня, и это заслуга подписки :Pog: :BOOBA:',
    'она смотрит назад через плечо и смеётся. я пересмотрел четыре раза и понял: ей весело, а не стыдно :Kreygasm: :Nosebleed:',
    'спина, талия, линия бедра — кадр собран как обложка манхвы. 47000 сабов, и ни одного повода для жалоб :ClipIt: :EZ:',
    'эта поза стоила пяти дней её характера. она их потратила на то, чтобы перестать стесняться :monkaS: :miyaLove:',
    'модерация молчит, чат рыдает, стримерша считает цифры. идеальный эфир, господа :SubHype: :Pog:',
  ],
  4: [
    '47000 САБОВ. ФИНАЛ ДНЯ: ОНА В КРЕСЛЕ, РАЗВЕРНУТА К ВЕБКЕ И СОВСЕМ НЕ СТЕСНЯЕТСЯ :AWOOGA: :Pog: :SubHype:',
    'финальный кадр с арта: спина, бедро, лицо через плечо. ни одна деталь не сдвинулась за весь вечер :Kreygasm: :ClipIt:',
    'пять дней: от «п-подождите» до «смотрите и платите». это не клики, это рост персонажа :LUL: :miyaLove:',
    'она сказала спасибо за сабы и осталась в кадре. легион, мы никогда не уйдём с этого стрима :Overheat: :Nosebleed:',
    'завтрашний формат она отдаёт нам. готовьте подписки и хорошие формулировки, чат :sub2: :EZ:',
  ],
};

/** Her body reacts on Day 5 by holding the pose closer, not by uncovering — so the bursts talk about angle. */
export const ZONE_CHAT_REACTIONS_DAY5: Record<TapZoneId, readonly string[]> = {
  head: [
    'она смотрит в объектив не отводя глаз и улыбается на полсекунды дольше, чем нужно :Pog: :Nosebleed:',
    'чёлка на плечо, подбородок вверх, взгляд «я всё слышу». этот кадр уйдёт в шапку канала :ClipIt: :Kreygasm:',
    'полуприкрытые глаза и румянец от софитов, а не от стыда. чат, это разные румянцы, не путайте :LUL: :monkaS:',
    'она фыркнула на ваше «повернись» и всё равно повернулась. цена согласования — саб :SubHype: :Pog:',
  ],
  chest: [
    'неоновый верх натянут от плеча до рёбер, узелки держат вашу жадность, чат :BOOBA: :Overheat:',
    'выдох — и ткань ложится плотнее. физика материалов в прямом эфире, разбираем покадрово :ClipIt: :EZ:',
    'она специально не поправляет. вообще. ни разу. четыре тапа подряд :AWOOGA: :Kreygasm:',
    'корпус развёрнут к линзе, плечи опущены, никакого «ой». это поза опытного человека :Pog: :LUL:',
  ],
  belly: [
    'талия работает на поворот, живот втянут на выдохе, спина держит. йога-день не прошёл даром :Kreygasm: :SubHype:',
    'ладони у неё на бёдрах, пальцы врозь, ни одного лишнего движения :Overheat: :Nosebleed:',
    'кожа светится от кольца лампы, и она это видит в чате. ей нравится, чат, признаю :miyaLove: :Pog:',
    'она дышит ровно и считает вслух. это не стриптиз, это аукцион с приятным молотком :LUL: :ClipIt:',
  ],
  legs: [
    'линия от бедра до колена занимает полкадра, и кресло это терпит :Pog: :AWOOGA:',
    'бёдра широкие, спина ровная, нога вытянута ровно в вашу линзу. она знает, что делает :Kreygasm: :monkaS:',
    'она разворачивается в кресле на весь кадр и даже не напряглась. годы практики сидения на камеру :EZ: :LUL:',
    'голос чата «ближе», а она спрашивает «за сколько». лучший диалог недели :SubHype: :ClipIt:',
  ],
  feet: [
    'ступня прямо у объектива, каблук прозрачный, пальцы сжимаются в ремешке :BOOBA: :Nosebleed:',
    'вторая шпилька висит на носке и держится на честном ремешке. она оставила так специально :Pog: :ClipIt:',
    'пальцы в гармошку, пятка вытянута, весь чат забыл, зачем заходил :AWOOGA: :Kreygasm:',
    'ценители ножки, это ваш час: она сама поставила ступню в первый план и гордится этим :LUL: :miyaLove:',
  ],
};

/** Viral clip titles for the bikini day: the angle, the distance, the heels — never a wardrobe change. */
export const VIRAL_CLIP_TITLES_DAY5: Record<TapZoneId, readonly string[]> = {
  head: [
    'МИЯ БЕЗ КАПЛИ СМУЩЕНИЯ: УЛЫБКА В ОБЪЕКТИВ НА ВЫДОХЕ',
    '«СМОТРИТЕ И ПЛАТИТЕ» — ФРАЗА ГОДА В ПРЯМОМ ЭФИРЕ',
  ],
  chest: [
    'НЕОН НАТЯНУТ ДО ПРЕДЕЛА, УЗЕЛКИ ДЕРЖАТ, ЧАТ НЕТ',
    'МИКРО-БИКИНИ В 1080p60: КАДР НАЧИНАЕТСЯ С НЕЁ, НО НЕ С ЛИЦА',
  ],
  belly: [
    'ТАЛИЯ НА ПОВОРОТЕ: РАЗБОР КАДРА ОТ БЫВШОГО ЙОГА-ТРЕНЕРА',
    'ОНА СЧИТАЕТ САБЫ ВСЛУХ И ДЫШИТ В МИКРОФОН',
  ],
  legs: [
    'НОГА ВЫТЯНУТА В ВЕБКУ: СТУПНЯ КРУПНЕЕ ГОЛОВЫ, ЧАТ ВСТАЛ',
    'РАЗВОРОТ В КРЕСЛЕ НА 40000 САБОВ — НИ ОДНА ДЕТАЛЬ НЕ СДВИНУЛАСЬ',
  ],
  feet: [
    'ПРОЗРАЧНЫЕ ШПИЛЬКИ ПРЯМО У ЛИНЗЫ, ВТОРАЯ ВИСИТ НА РЕМЕШКЕ',
    'ПАЛЬЦЫ СЖИМАЮТСЯ В РЕМЕШКЕ НА СЧЁТ ТРЁХ — И ДОНАТ',
  ],
};

/** Day 5 donations: the viewers explicitly ask for a closer angle, and she negotiates the price back. */
export const DONATION_TTS_LINES_DAY5: readonly string[] = [
  '«Раздеваться не надо, там уже нечего! Покажи ракурс, где нога ближе всех к линзе — и с меня донат! :SubHype: :Pog:»',
  '«Мия, держи позу на десять сабов дольше. Нет, не для меня, для клипа. :Kreygasm: :ClipIt:»',
  '«Прозрачные шпильки — лучшее инженерное решение за пять дней. Держи их в кадре, легион всё посчитал :AWOOGA: :Overheat:»',
  '«Спасибо, что перестала стесняться. Первый донат был за носочки, этот — за то, как ты смотришь в камеру :miyaLove: :sub2:»',
  '«Сколько стоит следующий поворот? Называй цифру, у меня премия за квартал, чат подтвердит :monkaS: :Pog:»',
];

/** One viewer goodbye line per farewell beat of the Day 5 finale. */
const FAREWELL_CHAT_DAY5: readonly {
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
    text: '★ БИКИНИ-ДЕНЬ ЗАКРЫТ: 47000 САБОВ! Четыре кадра, ноль снятых деталей, кресло снова пострадало :SubHype: :Pog:',
    highlight: true,
  },
  {
    author: 'feet_connoisseur',
    color: '#f472b6',
    badge: 'SUB',
    text: 'она держала ступню в первом плане полвечера и ни разу не убрала. это преданность ремеслу :Kreygasm: :ClipIt:',
  },
  {
    author: 'Pasha_Donater',
    color: '#ff6b9d',
    badge: 'VIP',
    text: 'разворот на сорока семи тысячах — лучший кадр канала за всю историю. клип в шапке, спорить бесполезно :Nosebleed: :Pog:',
  },
  {
    author: 'kaktus_mod',
    color: '#4ade80',
    badge: 'MOD',
    text: 'ни одной жалобы в модерацию за вечер с микро-бикини. чат повзрослел быстрее, чем она, и это новость :EZ: :LUL:',
  },
  {
    author: 'rich_uncle_msk',
    color: '#ffd54f',
    badge: 'DONATE',
    text: 'Мия, ты сказала «смотрите и платите» и это сработало. завтра голосуем форматом: подписка = голос, легион помнит правила :sub2: :miyaLove:',
    highlight: true,
  },
];

/**
 * Day 4 donations: the viewers explicitly ask for DEEPER POSES, not for fewer clothes. That is the
 * whole premise of the yoga day, so the TTS copy states it out loud once per pool.
 */
export const DONATION_TTS_LINES_DAY4: readonly string[] = [
  '«Раздеваться не надо! Покажи тот наклон, где спина круглая, а чат целый! :SubHype: :Pog:»',
  '«Держи позу на десять сабов дольше — и с меня ещё донат. На счёт три, чат считает! :Kreygasm: :ClipIt:»',
  '«Кресло выдержит, я проверял. Вертикальный шпагат на бис! :AWOOGA: :Overheat:»',
  '«Лучший стрим недели: ноль снятых вещей и максимум растяжки. Спасибо, Мия! :miyaLove: :SubHype:»',
  '«Достань ладонями до пола, не сгибая колени — и я задонатю дважды! :monkaS: :sub2:»',
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


/** Viral clip titles for the yoga day: the chair, the depth, the socks - never a wardrobe change. */
export const VIRAL_CLIP_TITLES_DAY4: Record<TapZoneId, readonly string[]> = {
  head: [
    '«ОЙ» БОЛЬШЕ НЕТ: МИЯ УХМЫЛЯЕТСЯ В КАМЕРУ ВО ВРЕМЯ НАКЛОНА',
    'ПОДМИГАНИЕ В ВЕРТИКАЛЬНОМ ШПАГАТЕ, ЧАТ ВСТАЛ',
  ],
  chest: [
    'ВЯЗАНЫЙ ТОП НА ВДОХЕ: УЗОР РАЗЪЕХАЛСЯ, ЧАТ СЧИТАЕТ ГРАДУСЫ',
    'ДЫХАНИЕ БЕЗ БРЕТЕЛЕЙ: РАЗБОР ПОЛЁТОВ ОТ ПОРТНИХИ',
  ],
  belly: [
    'ЛАДОНИ НА ЖИВОТЕ, ВЫДОХ В МИКРОФОН: УДДЖАИ В 4K',
    'УДЕРЖАНИЕ НА 30 СЧЁТОВ И НИ ОДНОЙ СМЯТОЙ ВЕЩИ',
  ],
  legs: [
    'НОГИ НА ПОДЛОКОТНИКАХ: КРЕСЛО ПОДАЛОСЬ, ЧАТ ТОЖЕ',
    'БЁДРО ОТКРЫТО У КРЕСЛА — 22000 САБОВ ЗА ОДИН ВДОХ',
  ],
  feet: [
    'НОСКИ В КРАСНУЮ РЕЗИНКУ НА ПОДЛОКОТНИКЕ, КРУПНЫЙ ПЛАН',
    'ТЯНЕТ НОСОК НА СЕБЯ — ЧАТ ТЯНЕТ САБЫ',
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
/**
 * Day 3 «призрачная стримерша»: a sheet costume over a glossy bodysuit and full fishnets.
 * The chat plays the convention jury AND the horror fan at the same time, and it talks about
 * the reveal mechanic (the «Бу!» flash frame) exactly the way a real Twitch chat would.
 */
const AMBIENT_DAY3: readonly string[] = [
  'простыня с дырками для глаз — гениально, я плакал. 7000 сабов, быстро :AWOOGA: :SubHype:',
  'контраст дня: сверху мем-призрак, снизу СЕТКА до ступней. лучший продакшн на твиче :Pog: :Kreygasm:',
  'она САМА резала края ножницами. я пересматриваю клип, где шов разошёлся :ClipIt: :LUL:',
  '«это отыгрыш призрака», сказала она, держась за ткань. конечно, дорогая, отыгрыш :peepoShy: :monkaS:',
  'шорох простыни в микрофоне за 10-й тир — это ASMR-контент, чат, мы нашли золото :Overheat:',
  'ноги в сетке до самых ступней, дырки кривые. косплей года, без шуток :miyaLove: :SubHype:',
];

/**
 * Day 4 «Растяжка с Мией»: yoga day. The costume never changes, so the chat talks about the POSES,
 * the chair that took all her weight, and the fact that she is having visibly more fun than them.
 * Exported for scripts/linescan_days.ts: the viewers' per-stage chatter about the yoga kit.
 */
/** Exported for the copy audit and scripts/linescan_days.ts: the day-4 chat outside the stage pools. */
export const AMBIENT_DAY4: readonly string[] = [
  'топ без бретелей и держится. я пересматриваю в замедлении, чтобы найти застёжку. не нашёл :Pog: :LUL:',
  'кресло как снаряд для йоги — это новый жанр, чат. инструкторы плачут :AWOOGA: :ClipIt:',
  'она НЕ краснеет. она ухмыляется. четыре дня назад она рыдала из-за носочков :Kreygasm: :miyaLove:',
  'вязка натянута так, что узор разъехался. это физика, легион, открывайте учебник по материалам :Overheat:',
  'красные резинки на боках держат шорты лучше, чем мой пояс для подъёма штанги :monkaS: :Pog:',
  'саб-цель 18000: разогнуть бедро. мы не извращенцы, мы за технику :SubHype: :sub2:',
];

export const AMBIENT_DAY4_BY_STAGE: Record<SubGoalStageIndex, readonly string[]> = {
  0: [
    'разминка: руки в замок, спина прогнута, кресло под ней скрипит. лучший асана-стрим на твиче :EZ: :LUL:',
    'она стоит на коленях на сиденье и тянет руки в потолок. я повторяю на коврике, спина отвечает :peepoShy: :ClipIt:',
    'носочки с красной резинкой, шорты на два размера меньше, и полное спокойствие в лице. это финальный босс :AWOOGA:',
    '18000 сабов до «Бёдер». у нас есть три часа и ни одного сомнения :SubHype: :sub2:',
    'она сказала «это разминка». чат, мы взрослые люди, мы всё поняли :LUL: :monkaS:',
  ],
  1: [
    'БЕДРО ОТКРЫТО, НОГА В ПОЛ, ОНА СМЕЁТСЯ. техника идеальная, я проверил у двух тренеров :Pog: :Nosebleed:',
    'одно колено на подушке, вторая нога откинута, спина держит. это не поза, это заявление :Kreygasm:',
    'шорты натянуты до предела и ни на миллиметр не съехали. вот это я называю инженерией костюма :ClipIt: :EZ:',
    'сабнул и смотрю как она дышит. 22000 на шпагат, легион, не тормозим :SubHype: :Overheat:',
    'у неё прядь прилипла ко лбу, и она специально не убрала. мы все всё поняли :miyaLove: :LUL:',
  ],
  2: [
    'ВЕРТИКАЛЬНЫЙ ШПАГАТ, НОСОК У ГОЛОВЫ. я пересматриваю и считаю градусы. их больше 180 :BOOBA: :Pog:',
    'она держит ногу руками, спина в прогибе и показывает чату две пальца. вот это и есть контроль кадра :Kreygasm:',
    'кресло стоит рядом как свидетель. оно видело, как она это разминала, и молчит :ClipIt: :monkaS:',
    '22000 сабов: ни одна вещь не снята, а ощущение, что мы видим всё. это и есть рост персонажа :miyaLove:',
    'финал на 26000, у неё уже план. я читаю его по её лицу, чат, я не сплю :AWOOGA: :sub2:',
  ],
  3: [
    'ОНА СЕЛА В КРЕСЛО И ПОЛОЖИЛА НОГИ НА ПОДЛОКОТНИКИ. 26000 сабов, миссия выполнена, я плачу :Pog: :SubHype:',
    'ладони на животе, пальцы врозь, взгляд «ну и что». я бы подписался на это навсегда :Kreygasm: :Nosebleed:',
    'финальная поза дня: она в кресле, мы в шоке. вязка доработала, чат разорился :Overheat: :ClipIt:',
    'носки свисают с подлокотников, и она ухмыляется в камеру. йога, чат, сплошная осознанность :LUL: :miyaLove:',
    'день закрыт без единой снятой вещи. четыре дня назад она рыдала из-за носочков, помним :peepoShy: :sub2:',
  ],
  4: [
    '26000 САБОВ. ЙОГА-ДЕНЬ ПРОЙДЕН. она в кресле, мы в клипах, кресло в ремонте :AWOOGA: :Pog:',
    'финал: руки на своём животе, дыхание ровное, чат истерит. профессионал, без шуток :Kreygasm:',
    'ни одна вещь не улетела, и при этом это был самый горячий стрим недели. магия, чат, магия :miyaLove: :LUL:',
    'завтра новый формат, а я уже устал ждать. сохраняйте клипы с креслом :ClipIt: :SubHype:',
    'спокойной ночи, йога-диванная лига. она легла в кресло, мы легли от усталости :peepoShy: :EZ:',
  ],
};

/** Exported for scripts/linescan_days.ts: the viewers' per-stage chatter about the costume. */
export const AMBIENT_DAY3_BY_STAGE: Record<SubGoalStageIndex, readonly string[]> = {
  0: [
    'она стоит белым коконом и молчит. 7000 сабов или призрак не отпустит :Pog: :monkaS:',
    'простыня на голове и на всём теле, ступни в сетке, и НИЧЕГО больше. лучший троллинг чата :EZ: :ClipIt:',
    'глаза через дырку подведены, светятся, я не сплю третий час :AWOOGA: :peepoShy:',
    'призрак держит ткань у ключиц и не дышит. учебник выдержки, том 1 :LUL:',
    'саб-цель 7000: задрать подол. мы люди вежливые, мы просто скидываем :SubHype: :sub2:',
  ],
  1: [
    'ПОДОЛ ЗАДРАН, НИЖНЯЯ ЧАСТЬ БОДИ В КАДРЕ. чат потерял рассудок :Pog: :Nosebleed:',
    'она подняла ткань руками, и это официально косплей-приём, а не намёк :ClipIt: :LUL:',
    'сетка выше, чем была, и это, чат, прогресс. 10000 сабов, легион, потихоньку :SubHype: :sub2:',
    'ноги со сиденья не убрала ни на кадр. вот это я называю верность концепции :Kreygasm: :miyaLove:',
    'следующая цель 10000: простыня уедет на голову. скидываемся молча :EZ: :monkaS:',
  ],
  2: [
    'ПРОСТЫНЯ ОСТАЛАСЬ ТОЛЬКО НА ГОЛОВЕ, всё остальное видно. физика, не фансервис :Pog: :AWOOGA:',
    'ножки скрещены на столе, ступни в сетке, капюшон из ткани. это не стрим, это стенд-модель :Kreygasm: :Nosebleed:',
    '10000 сабов и ни одного слова «сними». мы культурные призраколовы, мы ждём :monkaS: :sub2:',
    'дырки на месте, ткань сползла с тела, чат горит. идеальный косплей-облом :ClipIt: :LUL:',
    'следующая цель 13000: «Бу!» и простыня в воздухе. готовим клиперы :SubHype: :Overheat:',
  ],
  3: [
    'БУ! ТКАНЬ В ВОЗДУХЕ, КОСТЮМ НА МЕСТЕ. 13000 сабов отработали каждую копейку :Pog: :Nosebleed:',
    '«Бу!» и ткань вверх. я пересматриваю этот клип, кажется, в сорок седьмой раз :ClipIt: :AWOOGA:',
    'простыня в руках, сетка на ногах, ноги на столе. призрак стал обложкой, чат, мы победили :Kreygasm:',
    'она держит ткань над головой, а мы держим сабы. 15000 до финала, никто не спит :monkaS: :sub2:',
    'до финального кадра 2000 сабов. легион, это последний забег призрака :SubHype: :Overheat:',
  ],
  4: [
    '15000 САБОВ. ТКАНЬ УЕХАЛА ЗА СПИНУ, ОНА СИДИТ НА КОРТОЧКАХ НА КРЕСЛЕ :AWOOGA: :Pog: :SubHype:',
    'финальная поза с арта: корточки, колени врозь, ступни в сетке на сиденье. косплей принят без замечаний :Kreygasm:',
    'призрак разделся до костюма, чат распался на клипы. лучший эфир года, я не шучу :ClipIt: :miyaLove:',
    'ступни в сетке на сиденье и подмигивание. она убила этот стрим красиво, чат :Overheat: :Nosebleed:',
    'она сказала «бу» в последний раз, и у меня ком в горле. спокойной ночи, призрачиха :peepoShy:',
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
    streamDay === 6
      ? [...AMBIENT_DAY6_BY_STAGE[displayedStage], ...AMBIENT_DAY6]
      : streamDay === 5
      ? [
          ...(displayedStage === 0 ? ["бикини-стрим начинается :Pog:"] : displayedStage === 4 ? ["финал: Мия наклонилась через спинку кресла :ClipIt:"] : AMBIENT_DAY5_BY_STAGE[(displayedStage - 1) as SubGoalStageIndex]),
          ...(displayedStage === 4 ? [] : AMBIENT_DAY5.filter(line => !/33000|стопа в кадре/i.test(line))),
        ]
      : streamDay === 4
        ? [
            ...(displayedStage === 0 ? ["разминка начинается :Pog:"] : AMBIENT_DAY4_BY_STAGE[(displayedStage - 1) as SubGoalStageIndex]),
            ...AMBIENT_DAY4,
          ]
      : streamDay === 3
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
  if (streamDay === 6) {
    const pool = AMBIENT_DAY6_BY_STAGE[displayedStage];
    return { id: nextMsgId(), author: viewer.name, color: viewer.color, badge: viewer.badge, text: pool[Math.abs(seed) % pool.length]! };
  }
  if (streamDay === 5) {
    // Bikini day: same contract as the yoga day — the tap buys a closer angle, not an uncovered inch.
    // The generic pools below are Day-1/Day-2 bare-skin vocabulary and would describe a plate that does
    // not exist, so the day-5 reactions own the whole message.
    const day5Pool = ZONE_CHAT_REACTIONS_DAY5[zone];
    const day5Text =
      (zone === 'feet' || zone === 'legs') && seed % 3 === 0
        ? 'она придвинула ступню ещё ближе, когда услышала звук саба. коммерция в чистом виде :Pog: :ClipIt:'
        : day5Pool[Math.abs(seed) % day5Pool.length]!;
    return {
      id: nextMsgId(),
      author: viewer.name,
      color: viewer.color,
      badge: viewer.badge,
      text: day5Text,
    };
  }
  if (streamDay === 4) {
    // Yoga day: the tap does not reveal anything, it makes the chair take her weight. Every reaction
    // is about the pose she is holding - the generic pools below talk about legs and feet in the
    // bare-skin vocabulary of Day 1/Day 2 and would describe a plate that does not exist.
    const day4Pool = ZONE_CHAT_REACTIONS_DAY4[zone];
    const day4Text =
      (zone === 'feet' || zone === 'legs') && seed % 3 === 0
        ? 'кресло скрипнуло, когда она закинула ноги на подлокотники. звук года, чат :Pog: :ClipIt:'
        : day4Pool[Math.abs(seed) % day4Pool.length]!;
    return {
      id: nextMsgId(),
      author: viewer.name,
      color: viewer.color,
      badge: viewer.badge,
      text: day4Text,
    };
  }
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
  streamDay = 1,
): ChatMessage {
  const clipper = VIEWER_NICKS[(seed * 5 + 3) % VIEWER_NICKS.length]!;
  // The clip title is the day's poster: on the yoga day it names the pose, not a strip.
  const titles =
    streamDay === 6
      ? ['Деревенский эфир: заявка чата', 'Урожай по тарифу']
      : streamDay === 5
      ? VIRAL_CLIP_TITLES_DAY5[zone]
      : streamDay === 4
        ? VIRAL_CLIP_TITLES_DAY4[zone]
        : VIRAL_CLIP_TITLES[zone];
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

/** Donations follow the day: the yoga chat asks for a held pose, never for a removed garment. */
export function createDonationChatMessage(
  amount: number,
  seed = seqCounter,
  streamDay = 1,
): ChatMessage {
  const viewer = VIEWER_NICKS[(seed * 5 + 1) % VIEWER_NICKS.length]!;
  const pool =
    streamDay === 6
      ? ['Аванс за эфир отправлен, чат требует продолжения!', 'Внесите подписку в накладную, пожалуйста!']
      : streamDay === 5
      ? DONATION_TTS_LINES_DAY5
      : streamDay === 4
        ? DONATION_TTS_LINES_DAY4
        : DONATION_TTS_LINES;
  const tts = pool[Math.abs(seed) % pool.length]!;
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


/** Day 4 (yoga) close-out chatter: the day ended in the chair, and tomorrow is already rumoured. */
const FAREWELL_CHAT_DAY4: readonly {
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
    text: '★ ЙОГА-ДЕНЬ ЗАКРЫТ: 26000 САБОВ! Четыре позы, ноль снятых вещей, кресло пострадало :SubHype: :Pog:',
    highlight: true,
  },
  {
    author: 'yoga_bro_kim',
    color: '#4ecdc4',
    badge: 'SUB',
    text: 'вертикальный шпагат без разминки. я как тренер официально снимаю перед ней шляпу :Kreygasm: :ClipIt:',
  },
  {
    author: 'Pasha_Donater',
    color: '#ff6b9d',
    badge: 'VIP',
    text: 'она легла в кресло, а я лёг от усталости. двадцать шесть тысяч сабов, было честь служить :miyaLove: :peepoShy:',
  },
  {
    author: 'kaktus_mod',
    color: '#4ade80',
    badge: 'MOD',
    text: 'чат, мы культурные: мы не просим «встань». мы просто ждём пятый день :EZ: :sub2: :LUL:',
  },
];

/** One viewer goodbye line per farewell beat of the Day 1 finale. */
/** The goodbye chat follows the day that just ended - no stale "500 subs" copy on Day 3. */
export function createFarewellChatMessage(index: number, streamDay = 1): ChatMessage {
  const pool =
    streamDay === 6
      ? FAREWELL_CHAT_DAY6
      : streamDay === 5
      ? FAREWELL_CHAT_DAY5
      : streamDay === 4
        ? FAREWELL_CHAT_DAY4
          : streamDay === 3
            ? FAREWELL_CHAT_DAY3
            : streamDay === 2
              ? FAREWELL_CHAT_DAY2
              : FAREWELL_CHAT_DAY1;
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

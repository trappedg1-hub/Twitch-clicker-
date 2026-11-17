import type {
  SubGoalStageDef,
  SubGoalStageIndex,
  TapZoneId,
  UpgradeId,
} from '../domain/types.ts';

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
    'чат там на 1000 сабов КОСПЛЕЙ ТЁМНОЙ ВОЛШЕБНИЦЫ СО ШНУРОВКОЙ!! жмём!! :EZ: :Pog:',
    'из зажатой скромницы в носочках в королеву фансервиса :Overheat: :Kreygasm: :miyaLove:',
    'добиваем 1000 сабов ради декольте ведьмочки в корсете!! :SubHype: :AWOOGA:',
    'я уже 15 клипов нарезал с этим бралеттом :ClipIt: :Nosebleed:',
    'пульс 160, вызывайте скорую в чат :Overheat: :BOOBA:',
  ],
  5: [
    'ЭТА ШНУРОВКА НА ГРУДИ ТЁМНОЙ ВОЛШЕБНИЦЫ ЕЛЕ ДЕРЖИТСЯ!! :BOOBA: :AWOOGA: :Nosebleed:',
    '1000 САБОВ НЕ ЗРЯ!! ШЛЯПА ВЕДЬМОЧКИ + ОТКРЫТЫЙ КОРСЕТ + ПРОЗРАЧНЫЕ РУКАВА :BOOBA: :Overheat: :ClipIt:',
    'Твич умоляю не бань эту тёмную магию декольте :monkaS: :Kreygasm:',
    'каждый вдох в этом корсете — гипноз 100 уровня :EZ: :BOOBA: :miyaLove:',
    'чокер со звездой, ремешок на бедре и такой вырез крупным планом... я заколдован :Nosebleed: :Overheat:',
    'ЭТОТ КОСПЛЕЙ ВОЙДЁТ В ЗОЛОТОЙ ФОНД JUST CHATTING :Pog: :ClipIt: :SubHype:',
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
};

let seqCounter = 0;
function nextMsgId(): string {
  seqCounter += 1;
  return `chat_${Date.now()}_${seqCounter}`;
}

export function createAmbientChatMessage(
  _onlineViewers: number,
  displayedStage: SubGoalStageIndex = 0,
  seed = seqCounter,
): ChatMessage {
  const viewer = VIEWER_NICKS[seed % VIEWER_NICKS.length]!;
  const pool = AMBIENT_BY_STAGE[displayedStage] ?? AMBIENT_BY_STAGE[0];
  const text = pool[(seed * 3) % pool.length]!;
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
): ChatMessage {
  const viewer = VIEWER_NICKS[(seed * 3 + 2) % VIEWER_NICKS.length]!;
  if (zone === 'feet' && displayedStage === 0) {
    return {
      id: nextMsgId(),
      author: viewer.name,
      color: viewer.color,
      badge: viewer.badge,
      text: 'полосатые носочки милые, но го 10 сабов чтобы увидеть голые пяточки!! :SubHype: :AWOOGA:',
    };
  }
  if (zone === 'feet' && displayedStage === 5) {
    return {
      id: nextMsgId(),
      author: 'feet_inspector_77',
      color: '#f9a8d4',
      badge: 'VIP',
      text: 'ОБЕ БОСЫЕ СТУПНИ ПРЯМО НА СТОЛЕ У ОБЪЕКТИВА!! СОХРАНЯЮ В 4K :ClipIt: :AWOOGA: :Nosebleed:',
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

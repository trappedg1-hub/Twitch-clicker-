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
];

const AMBIENT_BY_STAGE: Record<SubGoalStageIndex, readonly string[]> = {
  0: [
    'привет! так укуталась в худи и носочки, милота :peepoShy: :miyaLove:',
    'чат го накидаем 10 сабов чтобы сняла носочки!! :SubHype: :Pog:',
    'она реально паникует когда ползёт Sub Goal ахаха :monkaS: :LUL:',
    'даже через худи видно какая у неё фигурка :BOOBA: :peepoShy:',
    'ребят тут реальный Sub Goal на раздевание, остаёмся! :EZ: :Pog:',
  ],
  1: [
    '10 сабов есть — босые ступни уже в кадре :Kreygasm: :miyaLove:',
    'педикюр огонь, чат жмём до 50 сабов на легинсы!! :SubHype: :Pog:',
    'пальчики поджала от смущения ахах :peepoShy: :LUL:',
    'скоро снимет легинсы, модеры не баньте :monkaS: :BOOBA:',
  ],
  2: [
    'уютное худи с ключицами + полностью голые ляжки = лучший фетиш :BOOBA: :Kreygasm:',
    'без легинсов вид стал в 10 раз горячее :BOOBA: :Pog:',
    'ЧАТ ДАВИМ ДО 200 САБОВ, СНИМАЕМ ХУДИ!! :EZ: :SubHype:',
    'фарфоровые коленки просто гипноз :Kreygasm: :miyaLove:',
  ],
  3: [
    'ПОД ХУДИ БЫЛА ТАКАЯ ТЕСНАЯ ТИШКА?! :BOOBA: :BOOBA: :Kreygasm:',
    'животик и вырез просто космос, не зря били 200 сабов :Pog: :miyaLove:',
    'Твич не забань пожалуйста, мы почти добили 500 сабов :monkaS: :BOOBA:',
    'зашёл с рекомендаций, инста сабка :EZ: :Kreygasm:',
  ],
  4: [
    '500 САБОВ!! ЧЁРНЫЙ БРАЛЕТТ В ЭФИРЕ!! :BOOBA: :BOOBA: :Kreygasm:',
    'чат там на 1000 сабов СЕКРЕТНЫЙ КОСПЛЕЙ С НОЖКАМИ НА СТОЛ!! жмём!! :EZ: :Pog:',
    'из скромницы в носочках в самую горячую стримершу Твича :Kreygasm: :miyaLove:',
    'добиваем 1000 сабов ради косплея Зайки!! :SubHype: :BOOBA:',
  ],
  5: [
    'БОСЫЕ ПЯТОЧКИ ПРЯМО НА СТОЛЕ В КАМЕРУ!! ЛУЧШИЙ РАКУРС В ИСТОРИИ :BOOBA: :Kreygasm:',
    '1000 САБОВ НЕ ЗРЯ!! УШКИ ЗАЙКИ + ПОДВЯЗКА + СТУПНИ 4K :BOOBA: :BOOBA: :Pog:',
    'Твич умоляю не бань этот шедевр :monkaS: :Kreygasm:',
    'ценители ножек сегодня официально победили в этой жизни :EZ: :Kreygasm: :miyaLove:',
  ],
};

const ZONE_CHAT_REACTIONS: Record<TapZoneId, readonly string[]> = {
  head: [
    'АХАХ как же она залилась краской :peepoShy: :miyaLove:',
    'эти смущённые глазки просто нелегальны :Kreygasm:',
    'посмотрите на этот румянец :peepoShy: :miyaLove:',
    'ути какая няша на вебке :LUL: :miyaLove:',
  ],
  chest: [
    ':BOOBA: :BOOBA: оператор, лучший ракурс в мире!!',
    'физика дыхания моё почтение :BOOBA: :Kreygasm:',
    'чат, кидаем сабы активнее ради такого вида :SubHype: :BOOBA:',
    'сердце остановилось на секунду :Kreygasm: :miyaLove:',
  ],
  belly: [
    'какая тонкая талия :BOOBA: чатик фиксируем!!',
    'она так мило вздрагивает от щекотки :peepoShy: :miyaLove:',
    'в комнате резко потеплело :Kreygasm: :Pog:',
    'фигура просто песочные часы :BOOBA: :miyaLove:',
  ],
  legs: [
    'посадка с ножками в кресле — гипноз 10/10 :BOOBA: :Kreygasm:',
    'спасибо тому кто попросил её откатиться от стола :Pog: :BOOBA:',
    'даже простое офисное кресло с такими ножками — трон :Kreygasm:',
    'невозможно оторваться от экрана :peepoShy: :miyaLove:',
  ],
  feet: [
    'СТУПНИ В КАДРЕ :Kreygasm: ЧАТ СБОР ПО ТРЕВОГЕ :Pog:',
    'ценители ножек сегодня закидывают весь Sub Goal :SubHype: :miyaLove:',
    'как она смущается когда смотрят вниз ахах :peepoShy: :LUL:',
    'лови сабку за ножки :SubHype: :Kreygasm:',
  ],
};

const UPGRADE_CHAT_REACTIONS: Record<UpgradeId, string> = {
  ring_lamp: 'Оо, со светом кожа светится просто топ :Kreygasm: :miyaLove:',
  usb_mic_pop: 'Звук кайф, теперь чистый влажный ASMR :Kreygasm: :peepoShy:',
  obs_alerts: 'АХАХ как она подпрыгивает от саб-алертов :LUL: :BOOBA:',
  webcam_focus: '1080p подъехало!! Чат протираем мониторы :BOOBA: :Pog:',
  chat_emotes: 'УРА КАСТОМНЫЕ СМАЙЛЫ ДЛЯ САБОВ :miyaLove: :BOOBA: :SubHype:',
  clips_boost: 'РЕЙД С РЕКОМЕНДАЦИЙ!! Добиваем Sub Goal :Pog: :SubHype:',
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
      text: 'полосатые носочки милые, но го 10 сабов чтобы сняла!! :SubHype: :peepoShy:',
    };
  }
  if (zone === 'legs' && displayedStage <= 1) {
    return {
      id: nextMsgId(),
      author: viewer.name,
      color: viewer.color,
      badge: viewer.badge,
      text: 'даже в плотных легинсах ляжки огонь, жмём 50 сабов! :BOOBA: :SubHype:',
    };
  }
  if (zone === 'chest' && displayedStage <= 2) {
    return {
      id: nextMsgId(),
      author: viewer.name,
      color: viewer.color,
      badge: viewer.badge,
      text: 'интересно что там спрятано под этим серым худи... го 200 сабов! :BOOBA: :Pog:',
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

export function createDonationChatMessage(amount: number, seed = seqCounter): ChatMessage {
  const viewer = VIEWER_NICKS[(seed * 5 + 1) % VIEWER_NICKS.length]!;
  return {
    id: nextMsgId(),
    author: viewer.name,
    color: '#ffd54f',
    badge: 'DONATE',
    text: `задонатил ${amount} ₽: «Кидаю в копилку на Sub Goal! :miyaLove: :SubHype:»`,
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
          ? `подарил подписку в чат! (Всего: ${totalSubs} сабов) :SubHype: :miyaLove:`
          : `подарил ${count} ПОДПИСОК каналу! (Всего: ${totalSubs} сабов) :SubHype: :Pog:`,
      isSystemHighlight: count >= 5,
    };
  }
  return {
    id: nextMsgId(),
    author: viewer.name,
    color: '#c084fc',
    badge: 'SUB',
    text: `оформил платную подписку Tier 1! (${totalSubs} сабов) :SubHype:`,
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
    text: `★ РЕКОРД СТРИМА: ${title}! Чат сходит с ума :Pog: :SubHype:`,
    isSystemHighlight: true,
  };
}

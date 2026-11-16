import type { TapZoneId, UpgradeId } from '../domain/types.ts';

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

const AMBIENT_POOL_LOW: readonly string[] = [
  'Ого, наткнулся внизу списка на 3 зрителя — а тут такая красотка 😳',
  'привет! первый раз стримишь?',
  'какая милая, и так стесняется ахах 💜',
  'остаюсь тут, уютно капец',
  'футболка с денди-джойстиком топовая 👀',
  'ребят накидайте сердечек в чат чтобы не волновалась ❤️❤️❤️',
  'микрофон простенький, зато голос какой нежный~',
];

const AMBIENT_POOL_HIGH: readonly string[] = [
  'ЧАТИК НЕ СПАТЬ 🔥🔥🔥',
  'я зашёл на 5 минут, сижу уже второй час 😳💜',
  'вот это посадка в кресле, моё почтение 👀',
  'лучшая находка в Just Chatting за месяц!!',
  'Мия краснеет от каждого сообщения, держите меня ❤️',
  'кто с клипа из рекомендаций — ставьте + в чат!',
  '+++ с реков прилетел, подписка мгновенно!',
  'когда апгрейд на геймерское кресло?? копим всем чатом 💸',
];

const ZONE_CHAT_REACTIONS: Record<TapZoneId, readonly string[]> = {
  head: [
    'АХАХ как же она залилась краской 😳❤️',
    'эти смущённые глазки просто нелегальны 💜',
    'ути какая скромница, посмотрите на румянец~',
    'простые проводные уши ей даже идут ❤️',
  ],
  chest: [
    'BOOBA 👀 тишка держится из последних сил!!',
    'бедный пиксельный геймпад, его так растянуло 😳🔥',
    '«села после стирки» — да-да, конечно, верим всем чатом 😏',
    'оператор, не меняй ракурс никогда 💜🔥',
  ],
  belly: [
    'животик открылся 😳 чатик фиксируем момент!!',
    'она так мило одёргивает тишку я не могу ❤️',
    'в комнате резко потеплело на +10 градусов 🔥',
    'талии вообще нет, просто песочные часы 👀💜',
  ],
  legs: [
    'ляжки в этих микро-шортиках — гипноз 10/10 😳',
    'спасибо тому кто попросил её откатиться подальше от стола 🙏🔥',
    'даже простое офисное кресло выглядит как трон с такими ножками!',
    'розовые коленки uwu 💜❤️',
  ],
  feet: [
    'НОЖКИ В КАДРЕ 🚨 ЧАТ СБОР ПО ТРЕВОГЕ 👀🔥',
    'фиолетовый лак на пальчиках — чистое искусство 💜',
    'она пальчики поджала от смущения ахаха милота 😳',
    'бесплатно показывают?? лови донат немедленно 💸❤️',
  ],
};

const UPGRADE_CHAT_REACTIONS: Record<UpgradeId, string> = {
  ring_lamp: 'Оо, со светом картинка сразу сочнее стала! 💡💜',
  usb_mic_pop: 'Звук кайф, теперь без перегрузов — чистый ASMR 🎙️😳',
  obs_alerts: 'АХАХ как она подпрыгнула от нового алерта 🔔❤️',
  webcam_focus: '1080p подъехало!! Чат, протираем мониторы 👀🔥',
  chat_emotes: 'УРА СВОИ СМАЙЛЫ 💜🔥😳 спамим пасту!!',
  clips_boost: 'РЕЙД С РЕКОМЕНДАЦИЙ!! Привет новеньким в чате 🔥🔥🔥',
};

let seqCounter = 0;
function nextMsgId(): string {
  seqCounter += 1;
  return `chat_${Date.now()}_${seqCounter}`;
}

export function createAmbientChatMessage(onlineViewers: number, seed = seqCounter): ChatMessage {
  const viewer = VIEWER_NICKS[seed % VIEWER_NICKS.length]!;
  const pool = onlineViewers >= 25 ? AMBIENT_POOL_HIGH : AMBIENT_POOL_LOW;
  const text = pool[(seed * 3 + onlineViewers) % pool.length]!;
  return {
    id: nextMsgId(),
    author: viewer.name,
    color: viewer.color,
    badge: viewer.badge,
    text,
  };
}

export function createZoneBurstMessage(zone: TapZoneId, seed = seqCounter): ChatMessage {
  const viewer = VIEWER_NICKS[(seed * 3 + 2) % VIEWER_NICKS.length]!;
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
    text: `задонатил ${amount} ₽: «Не стесняйся, ты супер горячая! Продолжай стрим 💜»`,
    isSystemHighlight: true,
  };
}

export function createUpgradeChatMessage(upgradeId: UpgradeId, seed = seqCounter): ChatMessage {
  const viewer = VIEWER_NICKS[(seed + 4) % VIEWER_NICKS.length]!;
  return {
    id: nextMsgId(),
    author: viewer.name,
    color: viewer.color,
    badge: viewer.badge,
    text: UPGRADE_CHAT_REACTIONS[upgradeId],
    isSystemHighlight: true,
  };
}

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
  'наткнулся на стрим с 3 зрителями — а тут такая няша :peepoShy: :miyaLove:',
  'привет! первый раз стримишь? :peepoShy:',
  'какая милая и так стесняется ахах :LUL: :miyaLove:',
  'остаюсь тут, уютно капец :miyaLove:',
  'футболка с денди-джойстиком мое почтение :BOOBA:',
  'чат накидайте сердечек чтобы не волновалась :miyaLove: :miyaLove:',
  'голос в микрофоне такой нежный :Kreygasm:',
];

const AMBIENT_POOL_HIGH: readonly string[] = [
  'ЧАТИК НЕ СПАТЬ :Pog: :SubHype:',
  'зашёл на 5 минут, сижу уже второй час :BOOBA: :miyaLove:',
  'вот это посадка в кресле :Kreygasm: :BOOBA:',
  'лучшая находка в Just Chatting за месяц :Pog:',
  'Мия краснеет от каждого доната, держите меня :peepoShy: :miyaLove:',
  'кто с клипа из реков — ставьте + в чат :Pog:',
  '+++ с реков залетел, инста фоллоу :SubHype: :miyaLove:',
  'копим всем чатом ей на откровенный костюм :BOOBA: :Kreygasm:',
];

const ZONE_CHAT_REACTIONS: Record<TapZoneId, readonly string[]> = {
  head: [
    'АХАХ как же она залилась краской :peepoShy: :miyaLove:',
    'эти смущённые глазки просто нелегальны :Kreygasm:',
    'посмотрите на этот румянец :peepoShy: :miyaLove:',
    'ути какая скромница на вебке :LUL: :miyaLove:',
  ],
  chest: [
    ':BOOBA: :BOOBA: тишка держится из последних сил!!',
    'бедный пиксельный геймпад, его так растянуло :BOOBA: :Kreygasm:',
    '«села после стирки» — да-да, верим всем чатом :LUL: :BOOBA:',
    'оператор, не меняй ракурс никогда :Kreygasm: :miyaLove:',
  ],
  belly: [
    'животик открылся :BOOBA: чатик фиксируем!!',
    'она так мило одёргивает тишку :peepoShy: :miyaLove:',
    'в комнате резко потеплело :Kreygasm: :Pog:',
    'фигура просто песочные часы :BOOBA: :miyaLove:',
  ],
  legs: [
    'ляжки в этих микро-шортиках — гипноз 10/10 :BOOBA: :Kreygasm:',
    'спасибо тому кто попросил её откатиться от стола :Pog: :BOOBA:',
    'даже простое офисное кресло с такими ножками — трон :Kreygasm:',
    'розовые коленки uwu :peepoShy: :miyaLove:',
  ],
  feet: [
    'НОЖКИ В КАДРЕ :BOOBA: ЧАТ СБОР ПО ТРЕВОГЕ :Pog:',
    'фиолетовый лак на пальчиках — чистое искусство :Kreygasm: :miyaLove:',
    'пальчики поджала от смущения ахаха :peepoShy: :LUL:',
    'бесплатно показывают?? лови донат :SubHype: :miyaLove:',
  ],
};

const UPGRADE_CHAT_REACTIONS: Record<UpgradeId, string> = {
  ring_lamp: 'Оо, со светом кожа светится просто топ :Kreygasm: :miyaLove:',
  usb_mic_pop: 'Звук кайф, теперь чистый влажный ASMR :Kreygasm: :peepoShy:',
  obs_alerts: 'АХАХ как она подпрыгивает от алертов :LUL: :BOOBA:',
  webcam_focus: '1080p подъехало!! Чат протираем мониторы :BOOBA: :Pog:',
  chat_emotes: 'УРА СВОИ СМАЙЛЫ КАНАЛА :miyaLove: :BOOBA: :SubHype:',
  clips_boost: 'РЕЙД С РЕКОМЕНДАЦИЙ!! Привет новеньким :Pog: :SubHype:',
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
    text: `задонатил ${amount} ₽: «Не стесняйся, ты супер горячая! :miyaLove: :Kreygasm:»`,
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

import type {
  StoryChapterDef,
  StreamChallengeDef,
} from './types.ts';

export const STORY_CHAPTERS: readonly StoryChapterDef[] = [
  {
    stage: 1,
    minBoldness: 0,
    badgeTitle: 'Этап 1 • Закутанная скромница',
    headline: 'Прячется в худи, легинсах и носочках',
    diaryThought:
      '«Господи, как страшно включать вебку... Надела уютное худи, легинсы под шорты и полосатые носочки, лишь бы никто лишнего не увидел... но за квартиру платить нечем, придётся ставить Sub Goal!»',
  },
  {
    stage: 2,
    minBoldness: 25,
    badgeTitle: 'Этап 2 • Сладкий вкус фансервиса',
    headline: 'Носочки и легинсы уже летят в сторону за сабы',
    diaryThought:
      '«Стоило снять носочки, а потом и легинсы за подписки — как чат буквально взорвался клипами и завалил меня рублями! От их жадных взглядов щёки пылают, но останавливаться совсем не хочется~»',
  },
  {
    stage: 3,
    minBoldness: 55,
    badgeTitle: 'Этап 3 • Жаркий эфир без худи',
    headline: 'Дразнит сотню зрителей в тесной кроп-тишке',
    diaryThought:
      '«Сердце колотится уже не от страха, а от чистого азарта! Вижу, как они сохраняют каждый мой глубокий вдох в клипы... интересно, что с ними будет, когда я останусь в одном бралетте?~ ♥»',
  },
  {
    stage: 4,
    minBoldness: 82,
    badgeTitle: 'Этап 4 • Икона фансервиса 18+',
    headline: 'Бралетт и косплей Тёмной Волшебницы с открытым декольте',
    diaryThought:
      '«Где та тихоня в полосатых носочках, которая тряслась перед камерой час назад? Надела откровенный корсет Тёмной Волшебницы со шнуровкой на груди, купаюсь в тысяче сабов и заколдовываю весь Твич~ ★ ♥»',
  },
] as const;

export const STREAM_CHALLENGES: readonly StreamChallengeDef[] = [
  {
    id: 'lean_mic',
    name: 'Наклониться грудью к вебке',
    desc: 'Податься глубоким вырезом вплотную к линзе — волна клипов и донатов',
    icon: '★',
    viewersRequired: 3,
    boldnessGain: 4.5,
    instantRewardMult: 4,
    cooldownSec: 11,
    zoneFocus: 'chest',
    reactionLine:
      'М-мх, наклонилась почти вплотную к объективу... не прожгите монитор взглядом, мои хорошие~ ♥',
    chatBurst: 'НАКЛОНИЛАСЬ ВПЛОТНУЮ К ЛИНЗЕ!! :BOOBA: :AWOOGA: :ClipIt: КИДАЕМ САБКИ :SubHype:',
  },
  {
    id: 'pose_feet',
    name: 'Сжать пальчики у камеры',
    desc: 'Медленно поиграть босыми ступнями и пяточками на крупном плане',
    icon: '♥',
    viewersRequired: 8,
    boldnessGain: 6.0,
    instantRewardMult: 5.5,
    cooldownSec: 14,
    zoneFocus: 'feet',
    reactionLine:
      'Хи-хи, смотрите внимательнее — специально для ценителей медленно сжимаю и разжимаю пальчики~ ♥',
    chatBurst: 'ПАЛЬЧИКИ НА КРУПНОМ ПЛАНЕ!! :AWOOGA: :Nosebleed: :Kreygasm: +САБКА :SubHype:',
  },
  {
    id: 'tug_tee',
    name: 'Оттянуть край одежды',
    desc: 'На секунду приоткрыть лишнее и подразнить следующим Sub Goal',
    icon: '✦',
    viewersRequired: 16,
    boldnessGain: 8.0,
    instantRewardMult: 7.5,
    cooldownSec: 18,
    zoneFocus: 'belly',
    reactionLine:
      'Упс, пальчик случайно оттянул ткань чуть ниже... хотите увидеть остальное? Добивайте Sub Goal~ ♥',
    chatBurst: 'ЧУТЬ НЕ ПОКАЗАЛА ВСЁ!! :BOOBA: :Overheat: :ClipIt: ЖМЁМ САБ ГОЛ :SubHype:',
  },
  {
    id: 'asmr_tease',
    name: 'Влажный ASMR-чмок в ушко',
    desc: 'Горячий шёпот и нежный поцелуй прямо в мембрану микрофона',
    icon: '♦',
    viewersRequired: 30,
    boldnessGain: 10.0,
    instantRewardMult: 9.5,
    cooldownSec: 22,
    zoneFocus: 'head',
    reactionLine:
      'Ш-ш-ш, надень наушники поплотнее, котик... *чмок* — это лично за твою щедрость сегодня ночью~ ★ ♥',
    chatBurst: 'ВЛАЖНЫЙ ЧМОК В НАУШНИКАХ!! :Nosebleed: :Kreygasm: :Overheat: Я РАСТАЯЛ :miyaLove:',
  },
  {
    id: 'arch_stretch',
    name: 'Сладко выгнуться в кресле',
    desc: 'Поднять ручки, глубоко вдохнуть и свести чат с ума физикой',
    icon: '✿',
    viewersRequired: 48,
    boldnessGain: 12.0,
    instantRewardMult: 12,
    cooldownSec: 25,
    zoneFocus: 'chest',
    reactionLine:
      'А-ах, м-м-м... засиделась перед вами — так сладко потянуться и выгнуть спинку под ваши взгляды~ ★ ♥',
    chatBurst: 'КАК ОНА ВЫГНУЛАСЬ!! ФИЗИКА 12/10 :BOOBA: :AWOOGA: :Nosebleed: :ClipIt:',
  },
  {
    id: 'garter_flash',
    name: 'Погладить бёдра ладошкой',
    desc: 'Медленно провести пальчиками от коленок вверх под шквал сабов',
    icon: '♛',
    viewersRequired: 75,
    boldnessGain: 14.5,
    instantRewardMult: 15,
    cooldownSec: 30,
    zoneFocus: 'legs',
    reactionLine:
      'Кожа на бёдрах вся горит от софитов... проведу ладошкой чуть повыше — только чур не падать в обморок~ ★ ♥',
    chatBurst: 'ЛАДОШКОЙ ПО БЁДРАМ!! ЧАТ В КОМЕ :AWOOGA: :Overheat: :Kreygasm: :SubHype:',
  },
] as const;

export function getStoryChapter(boldness: number): StoryChapterDef {
  let result = STORY_CHAPTERS[0]!;
  for (const ch of STORY_CHAPTERS) {
    if (boldness >= ch.minBoldness) {
      result = ch;
    }
  }
  return result;
}

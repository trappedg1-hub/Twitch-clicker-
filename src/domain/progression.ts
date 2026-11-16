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
      '«Господи, как страшно включать вебку... Застегнула худи под самое горлышко, надела легинсы под шорты и тёплые носочки, лишь бы никто лишнего не увидел... но за квартиру платить нечем, придётся ставить Sub Goal!»',
  },
  {
    stage: 2,
    minBoldness: 25,
    badgeTitle: 'Этап 2 • Первые снятые вещи',
    headline: 'Носочки и легинсы уже летят в сторону за сабы',
    diaryThought:
      '«Стоило снять носочки, а потом и легинсы за подписки — как чат буквально сошёл с ума и завалил меня рублями! Кажется, укутываться на Твиче просто невыгодно~»',
  },
  {
    stage: 3,
    minBoldness: 55,
    badgeTitle: 'Этап 3 • Долой жаркое худи!',
    headline: 'Осталась в тесной кроп-тишке перед сотней глаз',
    diaryThought:
      '«Сердце колотится уже не от страха, а от чистого кайфа! Когда я стянула худи на 200 сабах, счётчик онлайна пробил потолок... интересно, что будет на 500?~»',
  },
  {
    stage: 4,
    minBoldness: 82,
    badgeTitle: 'Этап 4 • Королева Sub Goal в бралетте',
    headline: 'Полное раскрепощение ради топ-донатеров',
    diaryThought:
      '«Где та тихоня в полосатых носочках, которая тряслась перед камерой час назад? Сижу в одном чёрном бралетте, купаюсь в сабах и обожаю каждую секунду этого эфира~ ★»',
  },
] as const;

export const STREAM_CHALLENGES: readonly StreamChallengeDef[] = [
  {
    id: 'lean_mic',
    name: 'Наклониться грудью к вебке',
    desc: 'Податься вперёд к объективу — пульс чата, донаты и подписки взлетают',
    icon: '★',
    viewersRequired: 3,
    boldnessGain: 4.5,
    instantRewardMult: 4,
    cooldownSec: 12,
    zoneFocus: 'chest',
    reactionLine:
      'Т-так достаточно близко к камере?.. Вижу, как сразу полетели донатики и новые сабки, шалуны... ♥',
    chatBurst: 'НАКЛОНИЛАСЬ К ВЕБКЕ!! :BOOBA: :BOOBA: КИДАЕМ САБКИ :SubHype:',
  },
  {
    id: 'pose_feet',
    name: 'Дразнить ножками на краю кресла',
    desc: 'Специально для ценителей в чате — пошевелить пальчиками ближе к кадру',
    icon: '♥',
    viewersRequired: 8,
    boldnessGain: 6.0,
    instantRewardMult: 5.5,
    cooldownSec: 16,
    zoneFocus: 'feet',
    reactionLine:
      'И-ик, вы серьёзно кидаете сабы каждый раз, когда я шевелю ступнями в кадре?! Ладно, смотрите~ ♥',
    chatBurst: 'НОЖКИ В ФОКУСЕ!! :Kreygasm: :Kreygasm: ОФОРМЛЯЮ САБКУ :SubHype:',
  },
  {
    id: 'tug_tee',
    name: 'Поддразнить следующим Sub Goal',
    desc: 'Кокетливо потянуть край одежды и напомнить чату про цель сабов',
    icon: '✦',
    viewersRequired: 18,
    boldnessGain: 8.5,
    instantRewardMult: 7.5,
    cooldownSec: 22,
    zoneFocus: 'belly',
    reactionLine:
      'М-мх, тут становится так жарко... поможете добить полоску Sub Goal, чтобы я сняла лишнее?~ ♥',
    chatBurst: 'ОНА ДРАЗНИТ ЧАТ!! :BOOBA: :Pog: СРОЧНО ДАРИМ САБЫ ДО ЦЕЛИ :SubHype:',
  },
  {
    id: 'asmr_tease',
    name: 'Шёпот в микрофон для спонсоров',
    desc: 'Томно поблагодарить сабов прямо в поп-фильтр — волна мурашек по чату',
    icon: '♦',
    viewersRequired: 35,
    boldnessGain: 11.0,
    instantRewardMult: 10,
    cooldownSec: 28,
    zoneFocus: 'head',
    reactionLine:
      'Спасибо каждому котику за платную подписку... ш-ш-ш, сегодня я сниму для вас всё, что обещала~ ★ ♥',
    chatBurst: 'УШИ ПЛАВЯТСЯ ОТ ШЁПОТА :Kreygasm: :miyaLove: +5 ПОДАРОЧНЫХ САБОВ В ЧАТ :SubHype:',
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

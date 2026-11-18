import type {
  StoryChapterDef,
  StreamChallengeDef,
} from './types.ts';

export const STORY_CHAPTERS: readonly StoryChapterDef[] = [
  {
    stage: 1,
    minBoldness: 0,
    badgeTitle: 'Закутанная скромница',
    headline: 'Прячется в худи, легинсах и носочках',
    diaryThought:
      '«Господи, как страшно включать вебку... Надела уютное худи, легинсы под шорты и полосатые носочки, лишь бы никто лишнего не увидел... но за квартиру платить нечем, придётся ставить Sub Goal!»',
  },
  {
    stage: 2,
    minBoldness: 25,
    badgeTitle: 'Сладкий вкус фансервиса',
    headline: 'Носочки и легинсы уже летят в сторону за сабы',
    diaryThought:
      '«Стоило снять носочки, а потом и легинсы за подписки — как чат буквально взорвался клипами и завалил меня рублями! От их жадных взглядов щёки пылают, но останавливаться совсем не хочется~»',
  },
  {
    stage: 3,
    minBoldness: 55,
    badgeTitle: 'Жаркий эфир без худи',
    headline: 'Дразнит сотню зрителей в тесной кроп-тишке',
    diaryThought:
      '«Сердце колотится уже не от страха, а от чистого азарта! Вижу, как они сохраняют каждый мой глубокий вдох в клипы... интересно, что с ними будет, когда я останусь в одном бралетте?~ ♥»',
  },
  {
    stage: 4,
    minBoldness: 82,
    badgeTitle: 'Икона фансервиса 18+',
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
    reactionLineDay4:
      'М-мх, наклон к полу без сгибания в коленях... линза близко, спина круглая, чат довольный~ ★ ♥',
    chatBurstDay4: 'НАКЛОНЯЕТСЯ К ПОЛУ, НЕ СГИБАЯ КОЛЕНЕЙ!! :Pog: :AWOOGA: :ClipIt: ТЕХНИКА ЧИСТАЯ :SubHype:',
  },
  {
    id: 'pose_feet',
    name: 'Сжать пальчики у камеры',
    desc: 'Медленно поиграть ступнями и пяточками на крупном плане',
    icon: '♥',
    viewersRequired: 8,
    boldnessGain: 6.0,
    instantRewardMult: 5.5,
    cooldownSec: 14,
    zoneFocus: 'feet',
    reactionLine:
      'Хи-хи, смотрите внимательнее — специально для ценителей медленно сжимаю и разжимаю пальчики~ ♥',
    reactionLineDay2:
      'Сегодня пальчики спрятаны в гольфы, так что наслаждайтесь вязкой с полосками... и не просите их снять, я сегодня сильнее, чем вчера~ ♥',
    chatBurst: 'ПАЛЬЧИКИ НА КРУПНОМ ПЛАНЕ!! :AWOOGA: :Nosebleed: :Kreygasm: +САБКА :SubHype:',
    reactionLineDay4:
      'Хи-хи, носочки сегодня остаются на месте — так что сжимаю пальчики прямо в вязке, и это тоже работа~ ♥',
    chatBurstDay4: 'НОСОК НА СЕБЯ, ПАЛЬЦЫ ВРОЗЬ!! :AWOOGA: :Kreygasm: :Pog: КРЕСЛО ЭТО ВИДИТ :SubHype:',
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
    reactionLineDay4:
      'Упс, пальчик случайно оттянул край вязки... дальше ничего не поедет, сегодня у нас растяжка, а не стриптиз~ ♥',
    chatBurstDay4: 'КРАЙ ВЯЗКИ ПОЕХАЛ НА ПАРУ САНТИМЕТРОВ!! :BOOBA: :Overheat: :ClipIt: И ВСЁ, БОЛЬШЕ НИЧЕГО :LUL:',
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
    reactionLineDay4:
      'Ш-ш-ш, дышим вместе: вдох на четыре счёта, выдох на восемь... *чмок* — это за тех, кто удержал позу~ ★ ♥',
    chatBurstDay4: 'СЧЁТ ВДОХА В МИКРОФОН!! :Nosebleed: :Kreygasm: :Overheat: ЭТО УЖЕ ASMR-КОНТЕНТ :miyaLove:',
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
    reactionLineDay4:
      'А-ах, м-м-м... наконец-то поза по мне: руки в замок, спина прогнута, кресло держит~ ★ ♥',
    chatBurstDay4: 'КАК ОНА ВЫГНУЛАСЬ НАД КРЕСЛОМ!! ГИБКОСТЬ 12/10 :BOOBA: :AWOOGA: :ClipIt:',
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
    reactionLineDay4:
      'Бёдра горят от софитов — это мышцы, чат, а не стыд. Раскрываю глубже, держите сабы~ ★ ♥',
    chatBurstDay4: 'БЕДРО РАСКРЫТО ДО ПРЕДЕЛА, И НИ ОДНА ВЕЩЬ НЕ СЪЕХАЛА!! :AWOOGA: :Overheat: :Pog:',
  },
] as const;

/** Day 2 arc: ashamed of yesterday's strip ladder, but already learning how to milk the chat. */
export const DAY2_STORY_CHAPTERS: readonly StoryChapterDef[] = [
  {
    stage: 1,
    minBoldness: 0,
    badgeTitle: 'День 2 • Стыдно за вчерашнее',
    headline: 'Прячется в оверсайз худи, а чат требует «повтори как вчера»',
    diaryThought:
      '«Вчера я краснела от каждого взгляда и сама не поняла, как осталась в бралетте на весь Твич... Сегодня я хотя бы одета: бежевое худи через голову, шорты, гольфы. Но чат уже пишет «повтори» — и, кажется, я знаю, как это продать~»',
  },
  {
    stage: 2,
    minBoldness: 45,
    badgeTitle: 'День 2 • Играю по-взрослому',
    headline: 'Худи сползает с плеча, и я делаю вид, что не замечаю',
    diaryThought:
      '«Вчера я стеснялась носочков, а сегодня сама тяну время перед камерой, зная, что чат купится на любую паузу. Руки трясутся меньше, чем вчера — и это, apparently, называется ростом аудитории~ ♥»',
  },
] as const;

/**
 * Day 3 arc: she came as a meme costume and turned it into the best stream of the week. The diary never
 * claims a specific sheet position (the panel is keyed to boldness, not to the ladder stage, so any state
 * it asserts could contradict the plate that happens to be on screen).
 */
export const DAY3_STORY_CHAPTERS: readonly StoryChapterDef[] = [
  {
    stage: 1,
    minBoldness: 0,
    badgeTitle: 'День 3 • Призрак по заявкам',
    headline: 'Ножницы, простыня и ноль стеснения там, где вчера был ступор',
    diaryThought:
      '«Вчера я пряталась от камеры с ног до головы, а сегодня сама вырезала дырки для глаз ножницами и вышла к камере в этом. Чат писал, что страшно, — и это был комплимент. Это отыгрыш, ребята, просто очень убедительный~ ♥»',
  },
  {
    stage: 2,
    minBoldness: 45,
    badgeTitle: 'День 3 • Держу паузу в костюме',
    headline: 'Считает сабы вместо того, чтобы краснеть',
    diaryThought:
      '«Я уже понимаю, чего они ждут, и делаю вид, что жду вместе с ними. Костюм — это щит: под него можно спрятать всё смущение и выглянуть ровно на один кадр~ ★ ♥»',
  },
  {
    stage: 3,
    minBoldness: 70,
    badgeTitle: 'День 3 • «Бу!» на весь Твич',
    headline: 'Прыжок из-за стула, и клипы разлетаются сами',
    diaryThought:
      '«Я крикнула "бу" в объектив и услышала, как чат потерял рассудок. Ни стыда, ни дрожи — только адреналин и цифры на экране. Кажется, мне это нравится больше, чем нужно~ ♥»',
  },
  {
    stage: 4,
    minBoldness: 88,
    badgeTitle: 'День 3 • Призрачиха года',
    headline: 'Закрывает эфир в кресле и обещает завтра коврик',
    diaryThought:
      '«Пятнадцать тысяч сабов в костюме из простыни. Я села в кресло, подмигнула камере и сказала, что завтра будет йога. Чат уже не спит — и я тоже~ ★ ♥»',
  },
] as const;

/**
 * Day 4 arc: the yoga stream. The costume is fixed for the whole day, so the arc is entirely inside her
 * head — she stops performing shyness and starts performing for the camera. No chapter may mention
 * undressing: the ladder of this day is measured in poses, and the chat asks for exactly that.
 */
export const DAY4_STORY_CHAPTERS: readonly StoryChapterDef[] = [
  {
    stage: 1,
    minBoldness: 0,
    badgeTitle: 'День 4 • Йога вместо стриптиза',
    headline: 'Вязаный топ, шорты на два размера меньше и одно кресло на четыре позы',
    diaryThought:
      '«Они пришли за тем, чего я сегодня не покажу, — и остались смотреть, как я гнусь. Развернула кресло, показала наклон, и чат сам начал считать выдохи. Мне нравится, что они смотрят на технику... почти~ ♥»',
  },
  {
    stage: 2,
    minBoldness: 45,
    badgeTitle: 'День 4 • Держу позу дольше, чем они ждут',
    headline: 'Считает выдохи и не опускает ногу',
    diaryThought:
      '«Раньше я краснела от одного взгляда, а теперь удерживаю позу ровно столько, сколько нужно, чтобы досчитали сабы. Дыхание ровное, ухмылка тоже~ ★ ♥»',
  },
  {
    stage: 3,
    minBoldness: 70,
    badgeTitle: 'День 4 • Показывает чату градусы',
    headline: 'Вертикальный шпагат и две пальца в объектив',
    diaryThought:
      '«Ни одной снятой вещи — и при этом они пишут, что это лучший стрим недели. Я это сделала специально. Йога, ребята, просто очень честная~ ♥»',
  },
  {
    stage: 4,
    minBoldness: 88,
    badgeTitle: 'День 4 • Инструктор поневоле',
    headline: 'Финал в кресле: ноги на подлокотниках, ладони на животе',
    diaryThought:
      '«Двадцать шесть тысяч сабов, кресло в ремонте и ноль поводов для модерации. Я легла на спинку, показала язык и поняла: теперь я хочу только такие эфиры~ ★ ♥»',
  },
] as const;

export function getStoryChapter(boldness: number, streamDay = 1): StoryChapterDef {
  const chapters =
    streamDay === 4
      ? DAY4_STORY_CHAPTERS
      : streamDay === 3
        ? DAY3_STORY_CHAPTERS
        : streamDay === 2
          ? DAY2_STORY_CHAPTERS
          : STORY_CHAPTERS;
  let result = chapters[0]!;
  for (const ch of chapters) {
    if (boldness >= ch.minBoldness) {
      result = ch;
    }
  }
  return result;
}

import type { SubGoalStageIndex, TapZoneId } from './types.ts';

/**
 * Wardrobe truth table for Miya's dialogue.
 *
 * Every line she speaks has to match what is ACTUALLY on the plate right now, otherwise the
 * subtitle says "my socks slipped down" while the art shows knee-highs pulled up tight. The
 * table below is the single source of truth for both days; `contradictsWardrobe()` is the guard
 * that drops (and, in tests, fails) any line that claims a garment state the plate doesn't have.
 */

export type HoodieState = 'on' | 'tied' | 'hanging' | 'off';
export type TopState = 'underHoodie' | 'tee' | 'camisole' | 'bra';
export type SockState = 'up' | 'gathered' | 'gone';

export interface Wardrobe {
  day: 1 | 2;
  stage: SubGoalStageIndex;
  hoodie: HoodieState;
  top: TopState;
  leggings: boolean;
  socks: SockState;
  strapsDown: boolean;
  midriff: boolean;
}

const W = (
  day: 1 | 2,
  stage: SubGoalStageIndex,
  hoodie: HoodieState,
  top: TopState,
  leggings: boolean,
  socks: SockState,
  extra: Partial<Wardrobe> = {},
): Wardrobe => ({
  day,
  stage,
  hoodie,
  top,
  leggings,
  socks,
  strapsDown: false,
  midriff: false,
  ...extra,
});

export const WARDROBES: Record<1 | 2, Record<SubGoalStageIndex, Wardrobe>> = {
  // Day 1: 0 hoodie+leggings+socks → 1 socks off → 2 leggings off → 3 crop tee → 4 bralette.
  1: {
    0: W(1, 0, 'on', 'underHoodie', true, 'up'),
    1: W(1, 1, 'on', 'underHoodie', true, 'gone'),
    2: W(1, 2, 'on', 'underHoodie', false, 'gone'),
    3: W(1, 3, 'off', 'tee', false, 'gone', { midriff: true }),
    4: W(1, 4, 'off', 'bra', false, 'gone', { midriff: true, strapsDown: true }),
  },
  // Day 2: hoodie → tee (socks still pulled up) → camisole + hoodie tied on the waist →
  // straps down + hoodie behind → bra-top finale with bare feet.
  2: {
    0: W(2, 0, 'on', 'underHoodie', false, 'up'),
    1: W(2, 1, 'off', 'tee', false, 'up'),
    2: W(2, 2, 'tied', 'camisole', false, 'gathered'),
    // She yanked the knee-highs back up at 2500 (see t2_day2_s3_v3) - the only thing she could rescue.
    3: W(2, 3, 'hanging', 'camisole', false, 'up', {
      strapsDown: true,
      midriff: true,
    }),
    4: W(2, 4, 'hanging', 'bra', false, 'gone', { strapsDown: true, midriff: true }),
  },
};

export function getWardrobe(streamDay: number, stage: number): Wardrobe {
  const day: 1 | 2 = streamDay === 2 ? 2 : 1;
  const clamped = Math.max(0, Math.min(4, Math.floor(stage))) as SubGoalStageIndex;
  return WARDROBES[day][clamped] ?? WARDROBES[day][0]!;
}

/**
 * Talking about removing something (past, promised, or as a goal title) is always fine - only
 * present-tense claims about what is on her body right now get checked.
 */
const REMOVAL_TALK =
  /(снят|снял|снять|сниму|снимай|стянул|стяну|стянет|стягива|убра|убер|улетел|уносит|полетел|осталась|остался|уже не|больше не|никак|без этого|дожд|заставил|попрос|прятал|цел\b|сабов|вчера|вчерашни|раньше|до этого)/i;

/**
 * A slouch claim only counts when it is about the knee-highs themselves. "Худи сползло с плеч, а
 * гольфы натянуты" must stay legal - the two clauses are about different garments.
 */
const GOLF_SLOUCH = /гольф[ыаоеу]?[^.!?]{0,26}(сполз|съехал|спустил|спущен|спуска|собран|гармошк|свалил|ослаб)/i;
const GOLF_TIGHT = /гольф[ыаоеу]?[^.!?]{0,26}(натянут|натянул|туго|по колено|до колена)/i;

/**
 * Returns the reason a line contradicts the current outfit, or `null` when the line is safe.
 * Kept intentionally coarse: it only rejects statements about the outfit she is wearing NOW.
 */
export function contradictsWardrobe(
  line: string,
  w: Wardrobe,
  zone?: TapZoneId,
): string | null {
  const removal = REMOVAL_TALK.test(line);

  // Knee-highs: only "gathered/slouched" is true at the gathered stage; never while pulled up.
  if (/гольф/i.test(line)) {
    if (w.socks === 'gone' && !removal) return 'mentions golf socks she already took off';
    if (w.socks === 'up' && GOLF_SLOUCH.test(line)) {
      return 'claims the golf socks slipped while they are pulled up';
    }
    if (w.socks === 'gathered' && GOLF_TIGHT.test(line)) {
      return 'claims the golf socks are pulled up while they are gathered at the ankles';
    }
  }

  // Day 1 crew socks: they are gone from stage 1 on, and Day 2 never has them at all.
  if (/носок|носочк|носк[иеов]/i.test(line)) {
    if (w.day === 2) return 'day 2 outfit has knee-highs, not socks';
    if (w.socks === 'gone' && !removal) return 'mentions socks she already removed';
    if (w.socks === 'up' && /носк[а-я]*[^.!?]{0,26}(сполз|съехал|спустил|спущен|собран|гармошк)/i.test(line)) {
      return 'claims her socks slipped while they are on';
    }
  }

  // Saying her feet are COVERED is the opposite claim - always allowed, even with socks on.
  const coversFeet = /(закрыт|спрятал|укутан|в гольфах|в носк|не голы)/i.test(line);

  // Bare-foot talk needs bare feet.
  if (!coversFeet && /бос[ыеиком]+|ступн|пяточк|пятьк|пальц\w* (ног|ступен)/i.test(line)) {
    if (w.socks !== 'gone') return 'describes bare feet/soles while her feet are covered';
  }
  if (zone === 'feet' && w.socks !== 'gone' && /пальчик|пальц[еуы]/i.test(line)) {
    return 'wiggles bare toes while her feet are still inside socks';
  }

  // Hoodie placement.
  if (/худи/i.test(line) && !removal) {
    if (/(в|под|внутри) (оверсайз )?худи|худи (на мне|не спадёт|не спадает|закрывает|держит)/i.test(line)) {
      if (w.hoodie !== 'on') return 'says she is wearing the hoodie while it is not on her shoulders';
    }
    if (/худи[^.!?]{0,22}(на талии|повязан|завязан)/i.test(line) && w.hoodie !== 'tied') {
      return 'says the hoodie is tied on her waist at the wrong stage';
    }
    if (/худи[^.!?]{0,22}(за спиной|на локтях|спадает с плеч|сполз с плеч)/i.test(line)) {
      if (w.hoodie !== 'hanging' && w.hoodie !== 'off') return 'claims the hoodie is hanging behind her too early';
    }
  }

  // Tops.
  if (/майк|тишк|кроп/i.test(line) && !removal && w.top !== 'tee') {
    return 'talks about the t-shirt while she is not wearing one';
  }
  if (/бралет|бра-?топ|бюст/i.test(line) && !removal && w.top !== 'bra') {
    return 'talks about the bralette while she is wearing something else';
  }
  if (/ретелях|лямк/i.test(line) && !removal && w.top === 'underHoodie') {
    return 'mentions thin straps while she is bundled in the hoodie';
  }
  if (/лямк[^.!?]{0,18}(?<!не )(подня|на месте|верну)/i.test(line) && w.strapsDown) {
    return 'claims the straps are up while they are already down';
  }

  // Legs.
  if (/легинс/i.test(line)) {
    if (/без легинс|легинс(ы|ов)? (снят|нет|ушел|улетел|долой)|долой легинсы/i.test(line)) {
      if (w.leggings) return 'says the leggings are off while she still wears them';
    } else if (!removal && w.leggings === false) {
      return 'talks about leggings she has already taken off';
    }
  }

  if (/живот[^.!?]{0,16}(открыт|голый|мёрзнет|мерзнет|холодит)/i.test(line) && !w.midriff) {
    return 'claims a bare stomach while her top covers it';
  }

  return null;
}

/**
 * Drop the lines that cannot be true right now. Never returns an empty array when the input had
 * at least one line: if everything is filtered out the caller falls back to `safeWardrobeLine`.
 */
export function filterWardrobeLines(
  lines: readonly string[],
  w: Wardrobe,
  zone?: TapZoneId,
): string[] {
  return lines.filter((line) => contradictsWardrobe(line, w, zone) === null);
}

/** Guaranteed-correct reactions per day + stage, used when a whole pool contradicts the outfit. */
export const WARDROBE_SAFE_LINES: Record<1 | 2, Record<SubGoalStageIndex, readonly string[]>> = {
  1: {
    0: [
      'Ой!.. Я пока вся в этом огромном худи, поэтому краснею просто от взгляда в камеру, а не от смелости~',
      'Не-не, в худи меня трогать нельзя — я в нём как в коконе, и мне так спокойнее!',
    ],
    1: [
      'Х-холодно... босые ноги свешиваю с кресла и делаю вид, что мне совсем не волнительно~',
      'Ступни спрятала под себя, худи натянула — и всё равно чувствую, что чат смотрит именно туда!',
    ],
    2: [
      'В одном худи и с голыми ногами... чат, вы точно не планируете заставлять меня снимать и его?!',
      'Ноги совсем голые, я их вжала в кресло — так, по крайней мере, меньше горит~',
    ],
    3: [
      'Кроп-тишка, голый живот и весь чат в объективе... я дышу, всё хорошо, это просто эфир!',
      'Ткань короткая, поэтому каждое ваше «милая» ощущается как сквозняк~',
    ],
    4: [
      'В одном чёрном бралетте, наклонилась к вебке — и, кажется, мне это нравится. Страшно, но нравится~',
      'Я сама так села и сама смотрю в камеру. Никаких носочков, никаких отговорок, чатик~ ★ ♥',
    ],
  },
  2: {
    0: [
      'Я в оверсайз худи через голову, и гольфы натянуты до колена — сегодня так просто ничего не спадёт!',
      'Худи на мне, гольфы натянуты, руки в рукавах... чат, вы серьёзно собираетесь всё это снять?',
    ],
    1: [
      'Худи уехало за кадр, осталась серая майка — и гольфы я натянула как надо, специально для вас... то есть для тепла!',
      'Майка коротковата, гольфы туго натянуты, и я делаю вид, что совершенно не волнуюсь~',
    ],
    2: [
      'Худи завязано на талии, топ на бретелях, гольфы собраны внизу — чат, вы же не думали, что я всё это просто так надела?',
      'Узел на талии затянула сама, а я держу лицо. Топ на бретелях, гольфы у щиколоток — всё по вашему коварному плану~',
    ],
    3: [
      'Обе лямки съехали на плечи, худи висит за спиной... и я сижу так близко к камере, как сама захотела~',
      'Лямки я не подниму. Гольфы пока на месте — и это единственное, что ещё стоит между вами и финалом~',
    ],
    4: [
      'Всё: топ снят, гольфы улетели, я на коленях у самой камеры. Пять тысяч сабов, чат — ты получил меня раскрепощённую~ ★ ♥',
      'Босые ступни на сиденье, худи на локтях, и я улыбаюсь в объектив. Вчера бы сгорела — сегодня прошу смотреть~ ♥',
    ],
  },
};

export function safeWardrobeLine(w: Wardrobe, seed: number): string {
  const pool = WARDROBE_SAFE_LINES[w.day][w.stage] ?? WARDROBE_SAFE_LINES[w.day][0]!;
  return pool[Math.abs(seed) % pool.length]!;
}

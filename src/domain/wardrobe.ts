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
export type TopState = 'underHoodie' | 'tee' | 'camisole' | 'bra' | 'bodysuit' | 'tube';
export type SockState = 'up' | 'gathered' | 'gone';
/**
 * Day 3 (ghost cosplay): the sheet IS the reveal mechanic, so its state is tracked like a garment.
 * Each stage of the day is a separate finished frame now, so these five states are literally the
 * five drawings: sheet clinging over her whole body with only the legs out (`veil`), front of the
 * sheet pulled off the torso and held up in one hand (`hemLift`), sheet left only as a hood while
 * her legs rest crossed on the desk plank (`hood`), sheet torn into the air (`off`), sheet slipped
 * back off her shoulders and hanging behind her like a cape over the finale squat (`cape`).
 */
export type SheetState = 'veil' | 'hemLift' | 'hood' | 'off' | 'cape';

export type DayIndex = 1 | 2 | 3 | 4;

export interface Wardrobe {
  day: DayIndex;
  stage: SubGoalStageIndex;
  hoodie: HoodieState;
  top: TopState;
  leggings: boolean;
  socks: SockState;
  strapsDown: boolean;
  midriff: boolean;
  /** Day 3 only: how much of the bodysuit the sheet still hides. */
  sheet?: SheetState;
  /** Day 3 only: fishnet stockings stay on all day - they are the punchline, not a goal. */
  fishnets?: boolean;
  /**
   * Day 4 only: the yoga kit is strapless, sleeveless and permanent — no hoodie, no straps, no
   * bare feet, no removed shorts, for every stage of the day. Copy that claims otherwise
   * contradicts the plate even though the words themselves look harmless.
   */
  yogaKit?: boolean;
}

const W = (
  day: DayIndex,
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

export const WARDROBES: Record<DayIndex, Record<SubGoalStageIndex, Wardrobe>> = {
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
  // Day 3 «призрачная стримерша»: a bed-sheet costume over a glossy bodysuit + FULL fishnets.
  // No slicing of a single render any more: every stage is its own finished frame, so this table
  // only records how much sheet is still on her. The fishnets never come off — the mesh runs over
  // the legs AND the feet — so a bare-sole claim stays illegal for the whole day.
  3: {
    // The sheet clings over her head and torso and she holds its edge at her chest, so the only thing
    // out below it is her netted legs; her belly is already open in frame zero (midriff from stage 0).
    0: W(3, 0, 'off', 'bodysuit', false, 'up', { sheet: 'veil', fishnets: true, midriff: true }),
    // 7000: she pinches the front edge in one hand and pulls it off her torso — the bodysuit, the
    // white bust panel and both legs are out, and that is the whole joke of the stage.
    1: W(3, 1, 'off', 'bodysuit', false, 'up', { sheet: 'hemLift', fishnets: true, midriff: true }),
    // 10000: the sheet is only a hood now, and her crossed ankles are up on the desk plank, so the
    // costume reads fully from the seat up to the soles.
    2: W(3, 2, 'off', 'bodysuit', false, 'up', { sheet: 'hood', fishnets: true, midriff: true }),
    // 13000: the «Бу!» frame — the sheet is in the air, in her hands, and wears nothing.
    3: W(3, 3, 'off', 'bodysuit', false, 'up', { sheet: 'off', fishnets: true, midriff: true }),
    // 15000: finale, the sheet slipped behind her shoulders like a cape, deep squat on the seat with
    // both netted feet on the cushion and knees spread.
    4: W(3, 4, 'off', 'bodysuit', false, 'up', { sheet: 'cape', fishnets: true, midriff: true }),
  },
  // Day 4 «Растяжка с Мией»: ONE knit kit for the whole stream, and nothing is taken off — the ladder
  // escalates the POSE (chair → open hip → vertical split → sunk into the chair), never the wardrobe.
  // The top has no straps at all, so strap talk is illegal the same way it is on Day 3; the socks are
  // ankle socks (they stay on, so bare-foot talk stays illegal too); the micro shorts never leave.
  4: {
    0: W(4, 0, 'off', 'tube', false, 'up', { midriff: true, yogaKit: true }),
    1: W(4, 1, 'off', 'tube', false, 'up', { midriff: true, yogaKit: true }),
    2: W(4, 2, 'off', 'tube', false, 'up', { midriff: true, yogaKit: true }),
    3: W(4, 3, 'off', 'tube', false, 'up', { midriff: true, yogaKit: true }),
    // The day ends at stage 3 (26000). Stage 4 is an alias so any code that still indexes 0..4 on a
    // short ladder reads the finale plate instead of crashing into `undefined`.
    4: W(4, 4, 'off', 'tube', false, 'up', { midriff: true, yogaKit: true }),
  },
};

export function getWardrobe(streamDay: number, stage: number): Wardrobe {
  const day: DayIndex = streamDay === 4 ? 4 : streamDay === 3 ? 3 : streamDay === 2 ? 2 : 1;
  const clamped = Math.max(0, Math.min(4, Math.floor(stage))) as SubGoalStageIndex;
  return WARDROBES[day][clamped] ?? WARDROBES[day][0]!;
}

/**
 * Talking about removing something (past, promised, or as a goal title) is always fine - only
 * present-tense claims about what is on her body right now get checked.
 */
const REMOVAL_TALK =
  /(снят|снял|снять|сниму|снимай|стянул|стяну|стянет|стягива|убра|убер|улетел|уш[ио]л[иа]?|ушли|ушло|уносил|уносит|полетел|осталась|остался|уже не|больше не|никак|без этого|дожд|заставил|попрос|прятал|цел\b|сабов|вчера|вчерашни|раньше|до этого)/i;

/**
 * A slouch claim only counts when it is about the knee-highs themselves. "Худи сползло с плеч, а
 * гольфы натянуты" must stay legal - the two clauses are about different garments.
 */
const GOLF_SLOUCH = /гольф[ыаоеу]?[^.!?]{0,26}(сполз|съехал|спустил|спущен|спуска|собран|гармошк|свалил|ослаб)/i;
const GOLF_TIGHT = /гольф[ыаоеу]?[^.!?]{0,26}(натянут|натянул|туго|по колено|до колена)/i;

/** "Бретелек тут нет", "без единой бретельки" - saying the straps are ABSENT is the whole gag. */
const NEGATED_STRAP_TALK =
  /(без|не|нет|никак\w*|ни одной|ни единой)[^.!?]{0,18}(бретел|лямк)|(бретел|лямк)\w*[^.!?]{0,10}(нет|не было|не будет|не было видно)/i;

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

  // Day 3 is a sheet over a bodysuit: no hoodie, no golf socks, no dress - only the sheet moves.
  if (w.day === 3) {
    if (/худи/i.test(line)) return 'the ghost costume has no hoodie';
    if (/гольф/i.test(line) && !removal) return 'the ghost costume has fishnets, not golf socks';
    if (/^(?!(.*\bне\b)).*(платье|платьиц|юбк|сарафан|халат|пижам)/i.test(line) && !removal) {
      return 'calls the cut-down sheet a dress';
    }
    const sheet = w.sheet ?? 'veil';
    const sheetTalk = /простын|полотенц|ткан|дырк/i.test(line);
    // "Полностью" only counts as a coverage claim next to a covering verb - "живот открыт полностью"
    // is a reveal claim, and must not be filtered as if she said the opposite.
    const claimsCovered =
      /(полност\w*|целиком|абсолютно)[^.!?]{0,18}(закрыт|закрыв|спрятан|спрятал|скрыт|скрыва|укутан|закутан|под ткан|под простын)|(ничего не видно|не видно соверш|вся скрыт|полностью скрыт)/i.test(
        line,
      );
    // Three states belonged to the old sliced ladder (a slipped shoulder, a drum-taut sheet, a hem
    // cut short on one side). None of the five frames shows them, so no line may claim them.
    const claimsShoulderSlip =
      /сполз[^.!?]{0,16}(плеч|набок)|с одного плеча|оголи[^.!?]{0,12}плечо|голое плечо|открыто плечо|плечо открыто/i.test(line);
    const claimsTaut = /обтяж|натянута как чехол|натянул[аи]? (ткан|простын)|затянул[аи]? (ткан|простын)|силуэт под ткан/i.test(line);
    const claimsCape = /как плащ|плащ\b|накидк\w* на плеч/i.test(line);
    const claimsHemLift = /подол|задрал|задерл|поднял[аи]? (ткан|простын)/i.test(line);
    // Previewing the next goal ("дальше будет плащ") is not a claim about the current plate.
    const futureTalk =
      /дальше|следующ|будет|будем|будут|станет|станут|потом|скоро|обеща|до финал|ждём|ждите|цел[ьию] (до|на)/i.test(line);
    if (sheetTalk && !removal && !futureTalk) {
      if (sheet === 'veil' && claimsHemLift) {
        return 'claims a lifted hem while the sheet still hangs at her chest';
      }
      if (sheet !== 'veil' && sheet !== 'hemLift' && claimsHemLift && sheet !== 'off') {
        return 'claims the hem is still held up after the sheet left her body';
      }
      if (sheet !== 'veil' && claimsCovered) return 'claims the sheet still hides her after it moved';
      if (claimsShoulderSlip) return 'the sheet never slips off one shoulder on this ladder';
      if (claimsTaut) return 'claims a stretched-tight sheet these frames never show';
      if (sheet !== 'cape' && claimsCape) return 'the sheet only becomes a cape at the finale';
      if (sheet === 'off' && /простын\w*[^.!?]{0,18}(на мне|надета|одет|накинут|на плечах)/i.test(line)) {
        return 'claims to wear the sheet in the frame where it is in the air';
      }
      if (sheet === 'hood' && /простын\w*[^.!?]{0,14}(торс|тело|груд|живот|бёдра|бедра)/i.test(line)) {
        return 'claims the sheet covers her body while it is only a hood';
      }
    }
  }

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

  // Day 1 crew socks: they are gone from stage 1 on. Day 2 never has them at all (only knee-highs).
  // Day 4 comes back to ANKLE socks — ivory with a red band — and they stay on for the whole stream.
  if (/носок|носочк|носк[иеов]/i.test(line)) {
    if (w.day === 2 || w.day === 3) return `day ${w.day} outfit has knee-highs, not ankle socks`;
    if (w.socks === 'gone' && !removal) return 'mentions socks she already removed';
    if (w.socks === 'up' && /носк[а-я]*[^.!?]{0,26}(сполз|съехал|спустил|спущен|собран|гармошк)/i.test(line)) {
      return 'claims her socks slipped while they are on';
    }
  }

  // Saying her feet are COVERED is the opposite claim - always allowed, even with socks on.
  const coversFeet =
    /(закрыт|спрятал|укутан|в гольфах|в носк|в сетк|под сетк|в чулк|под чулк|не голы)/i.test(line);

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
  // The Day 3 bodysuit has no straps at all - that is the whole joke of «сползает само». Only a
  // line that says so out loud ("бретелек тут нет") is allowed through.
  if ((w.day === 3 || w.day === 4) && /бретел|лямк/i.test(line) && !NEGATED_STRAP_TALK.test(line)) {
    return 'mentions a strap on a strapless top';
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

  // Fishnets are Day 3's permanent legwear: never claim they came off, never claim bare legs.
  if (w.day === 3 && w.fishnets && /сетк|чулк|ступн|пальц|пяток|носок/i.test(line)) {
    if (/без сетк|сетк[ауи]? (снят|нет|ушл|улетел)|голые ноги|ноги без/i.test(line) && !removal) {
      return 'claims the fishnets are off while they are on all day';
    }
    // Full stockings: the net runs over the instep to the toes. "Голая стопа" contradicts the plate.
    if (/(ступн|пяток|пальц\w* (ног|ступен)|подошв)[^.!?]{0,18}(голы|без сетк|нат\b)/i.test(line)) {
      return 'claims a bare foot while the fishnet covers it down to the toes';
    }
  }

  // Day 4 yoga kit: one knit costume for the whole stream. Nothing is removed and nothing from the
  // earlier days exists here, so the guard is short — it only kills garments that are not in frame.
  if (w.yogaKit) {
    if (/простын|сетк|чулк|боди|гольф/i.test(line)) {
      return 'names a Day-2/Day-3 garment the yoga kit does not have';
    }
    /**
     * The whole design rule of the yoga day, in code: heat comes from the POSE, so no line may report a
     * garment leaving her body - not the shorts, not the knit top, not "just for a second". Only two
     * escapes are legal: a promise about a later day, and the negation the chat keeps repeating ("ни одной
     * снятой вещи"). This check is deliberately stricter than the shared REMOVAL_TALK hedge above, which
     * exists for the earlier days where undressing IS the ladder.
     */
    const yogaFutureTalk =
      /дальше|следующ|будет|будем|будут|станет|станут|потом|скоро|обеща|до финал|ждём|ждите|не надо|не нужно|не просим|не ждём|если добьёт|когда добьёте|завтра/i.test(
        line,
      );
    const yogaNegation =
      /(ни одной|ни единой|ни одна|ни одного|ноль снят|без единой|ничего не|не снят|не улетел|не улетает|не съехал|не сполз|не сполза|никак не|не раздев|не просим|так и стоит|так и сидит|остаёт|остается|держится)/i.test(
        line,
      );
    const yogaRemovalClaim =
      /(снял[аи]?\b|снята|снято|сняты|сняла|стянул[аи]?\b|стянут|раздел[аи]?\b|раздева|обнажил[аи]?|оголи[аи]?|сорвал[аи]?|сбросил[аи]?|улетел[аи]?|улетает|унесла|полетел[аи]?|остал[аи]?сь? в (одних|одном|одну|белье|трусиках|чулках|носком|носки)|останусь в (одних|одном|белье|трусиках)|в (одних|белье)|без трусиков|без (верх|низа|шорт|топа))/i.test(
        line,
      );
    if (!yogaFutureTalk && !yogaNegation && yogaRemovalClaim) {
      return 'claims a garment left her body — the yoga day changes poses, not clothes';
    }
    if (
      !yogaFutureTalk &&
      /шорт\w*[^.!?]{0,16}(снят|снял|сняла|нет|ушл|улетел|долой)|без шорт/i.test(line)
    ) {
      return 'claims the micro shorts came off — they stay on for the whole yoga day';
    }
    // Bare toes belong to Day 1 and the Day 2 finale; on the mat she stays in her socks.
    if (!yogaNegation && /босиком|босые|голые ступн|голые пальц/i.test(line)) {
      return 'claims bare feet while she is in socks on the yoga mat';
    }
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
export const WARDROBE_SAFE_LINES: Record<DayIndex, Record<SubGoalStageIndex, readonly string[]>> = {
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
  // Day 3 ghost: a sheet costume over a bodysuit + full fishnets. The safe pool keeps that truth.
  3: {
    0: [
      'Белая простыня, две кривые дырки для глаз и улыбка в одной из них. Бу! — и всё, костюм готов~',
      'Ткань на голове и на плечах, а живот и ноги в сетке вы видите сами. Я не пряталась, я стилизовалась~',
    ],
    1: [
      'Я подняла подол, потому что шуршит и мешается. Ну и живот открыт, да, я вижу, чат, я не слепая~',
      'Смотрите ниже ткани: боди, талия, сетка. Это не случайность, это монтаж кадра, я его специально сделала.',
    ],
    2: [
      'Ткань осталась только на голове, поэтому видно всё. Я взрослая и не скажу «случайно», я скажу «костюм».',
      'Ножки на столе, капюшон из простыни, ступни в сетке целиком. Призрак выехал на позу, чат~',
    ],
    3: [
      'Бу! — и простыня в воздухе. Да, я её сама сорвала. Нет, я её не потеряла, она была у меня в руках.',
      'Ткань улетела вверх, костюм остался на мне. Лучший кадр стрима, и вы его уже нарезали на клипы~',
    ],
    4: [
      'Финал: простыня уехала за спину как плащ, боди и сетка — на камеру. Я красивая, и мне не страшно~ ★ ♥',
      'Корточки на кресле, колени врозь, ступни в сетке целиком. Дразнюсь официально, по договору с эфиром~ ♥',
    ],
  },
  // Day 4 yoga: one knit kit, one chair, four poses. The safe pool never promises a removal, because
  // on this day nothing is taken off — only the pose gets deeper.
  4: {
    0: [
      'Вязаный топ без бретелей, шорты на два размера меньше, руки в замок над головой. Это разминка, чат, а не приглашение~',
      'Кресло под собой я не отпускаю: на нём и будем стоять. Подбородок вверх, спина длинная, дальше — ваши сабы.',
    ],
    1: [
      'Колено на сиденье, вторая нога вытянута в пол. Это поза на открывание бедра, любой учебник подтвердит. Я просто разминаюсь~',
      'Шорты на месте, носочки тоже, я откинулась назад и смеюсь — потому что вижу, что вы написали в чате.',
    ],
    2: [
      'Вертикальный шпагат, носочек у волос, две пальца в камеру. Я встала именно так, чтобы вам было видно всё, чат~',
      'Ногу держу руками, спина прогнута, топ натянут до предела. Ни одна резинка никуда не денется до 26000.',
    ],
    3: [
      'Финал: я в кресле, голени лежат на подлокотниках, ладони у меня на животе. Никуда не встаю — свою часть договора вы выполнили~ ♥',
      'Ноги на подлокотниках, носочки на месте, топ держится на честном натяжении. Смотрите сколько хотите, это ваш стрим~ ★ ♥',
    ],
    4: [
      'Финал: я в кресле, голени лежат на подлокотниках, ладони у меня на животе. Никуда не встаю — свою часть договора вы выполнили~ ♥',
      'Ноги на подлокотниках, носочки на месте, топ держится на честном натяжении. Смотрите сколько хотите, это ваш стрим~ ★ ♥',
    ],
  },
};
export function safeWardrobeLine(w: Wardrobe, seed: number): string {
  const pool = WARDROBE_SAFE_LINES[w.day][w.stage] ?? WARDROBE_SAFE_LINES[w.day][0]!;
  return pool[Math.abs(seed) % pool.length]!;
}

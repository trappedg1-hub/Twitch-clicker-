import type { SubGoalStageIndex, TapZoneId } from "./types.ts";

/**
 * Wardrobe truth table for Miya's dialogue.
 *
 * Every line she speaks has to match what is ACTUALLY on the plate right now, otherwise the
 * subtitle says "my socks slipped down" while the art shows knee-highs pulled up tight. The
 * table below is the single source of truth for both days; `contradictsWardrobe()` is the guard
 * that drops (and, in tests, fails) any line that claims a garment state the plate doesn't have.
 */

export type HoodieState = "on" | "tied" | "hanging" | "off";
export type TopState =
  | "underHoodie"
  | "tee"
  | "camisole"
  | "bra"
  | "bodysuit"
  | "tube"
  | "bikini"
  | "overalls";
export type SockState = "up" | "gathered" | "gone";
/**
 * Day 3 (ghost cosplay): the sheet IS the reveal mechanic, so its state is tracked like a garment.
 * Each stage of the day is a separate finished frame now, so these five states are literally the
 * five drawings: sheet clinging over her whole body with only the legs out (`veil`), front of the
 * sheet pulled off the torso and held up in one hand (`hemLift`), sheet left only as a hood while
 * her legs rest crossed on the desk plank (`hood`), sheet torn into the air (`off`), sheet slipped
 * back off her shoulders and hanging behind her like a cape over the finale squat (`cape`).
 */
export type SheetState = "veil" | "hemLift" | "hood" | "off" | "cape";

/**
 * Day 5 «5 бикини стрим»: the whole outfit is two triangular panels and a pair of clear-vinyl heels, so
 * the day has no garment state to track at all — the bikini never moves. What still has to be tracked is
 * what is NOT on her: no legwear of any kind (his standing rule for this costume), no bare feet either
 * (she is in heels; at the finale one of them only hangs from her toes by the strap).
 */
export type DayIndex = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Day 6 «Деревенская девочка»: the flip-flops are a STAGE fact, not a day fact. The gate frame and the
 * cucumber frame show them on both feet, the finale of the bite shows one of them hanging off her lowered
 * foot by the toe, and the butter finale has none at all (they are out of the picture, not removed on
 * camera). `contradictsWardrobe` reads this instead of `socks`, because the shared sock rule would either
 * allow "босиком" on all four frames or forbid it on all four.
 */
export type FootwearState = "both" | "one" | "none";

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
  /**
   * Day 5 only: the micro bikini is the entire outfit for all four frames. Nothing is worn over it and
   * nothing is taken off it, so the guard's job is to veto legwear/sock vocabulary (which the plate
   * contradicts) and any present-tense claim that a panel moved.
   */
  bikiniKit?: boolean;
  /**
   * Day 6 only: the too-small childhood denim overalls + the straw hat are the WHOLE outfit, so like the
   * bikini kit the day has nothing to track except what is NOT there. Two extra facts are per-stage and
   * both are visible on the plate: which way the straps hang, and whether the flip-flops are on.
   */
  denimKit?: boolean;
  /** Day 6 only: how much of the flip-flop pair is still on her feet in this frame. */
  footwear?: FootwearState;
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

export const WARDROBES: Record<
  DayIndex,
  Record<SubGoalStageIndex, Wardrobe>
> = {
  // Day 1: 0 hoodie+leggings+socks → 1 socks off → 2 leggings off → 3 crop tee → 4 bralette.
  1: {
    0: W(1, 0, "on", "underHoodie", true, "up"),
    1: W(1, 1, "on", "underHoodie", true, "gone"),
    2: W(1, 2, "on", "underHoodie", false, "gone"),
    3: W(1, 3, "off", "tee", false, "gone", { midriff: true }),
    4: W(1, 4, "off", "bra", false, "gone", {
      midriff: true,
      strapsDown: true,
    }),
  },
  // Day 2: hoodie → tee (socks still pulled up) → camisole + hoodie tied on the waist →
  // straps down + hoodie behind → bra-top finale with bare feet.
  2: {
    0: W(2, 0, "on", "underHoodie", false, "up"),
    1: W(2, 1, "off", "tee", false, "up"),
    2: W(2, 2, "tied", "camisole", false, "gathered"),
    // She yanked the knee-highs back up at 2500 (see t2_day2_s3_v3) - the only thing she could rescue.
    3: W(2, 3, "hanging", "camisole", false, "up", {
      strapsDown: true,
      midriff: true,
    }),
    4: W(2, 4, "hanging", "bra", false, "gone", {
      strapsDown: true,
      midriff: true,
    }),
  },
  // Day 3 «призрачная стримерша»: a bed-sheet costume over a glossy bodysuit + FULL fishnets.
  // No slicing of a single render any more: every stage is its own finished frame, so this table
  // only records how much sheet is still on her. The fishnets never come off — the mesh runs over
  // the legs AND the feet — so a bare-sole claim stays illegal for the whole day.
  3: {
    // The sheet clings over her head and torso and she holds its edge at her chest, so the only thing
    // out below it is her netted legs; her belly is already open in frame zero (midriff from stage 0).
    0: W(3, 0, "off", "bodysuit", false, "up", {
      sheet: "veil",
      fishnets: true,
      midriff: true,
    }),
    // 7000: she pinches the front edge in one hand and pulls it off her torso — the bodysuit, the
    // white bust panel and both legs are out, and that is the whole joke of the stage.
    1: W(3, 1, "off", "bodysuit", false, "up", {
      sheet: "hemLift",
      fishnets: true,
      midriff: true,
    }),
    // 10000: the sheet is only a hood now, and her crossed ankles are up on the desk plank, so the
    // costume reads fully from the seat up to the soles.
    2: W(3, 2, "off", "bodysuit", false, "up", {
      sheet: "hood",
      fishnets: true,
      midriff: true,
    }),
    // 13000: the «Бу!» frame — the sheet is in the air, in her hands, and wears nothing.
    3: W(3, 3, "off", "bodysuit", false, "up", {
      sheet: "off",
      fishnets: true,
      midriff: true,
    }),
    // 15000: finale, the sheet slipped behind her shoulders like a cape, deep squat on the seat with
    // both netted feet on the cushion and knees spread.
    4: W(3, 4, "off", "bodysuit", false, "up", {
      sheet: "cape",
      fishnets: true,
      midriff: true,
    }),
  },
  // Day 4 «Растяжка с Мией»: ONE knit kit for the whole stream, and nothing is taken off — the ladder
  // escalates the POSE (chair → open hip → vertical split → sunk into the chair), never the wardrobe.
  // The top has no straps at all, so strap talk is illegal the same way it is on Day 3; the socks are
  // ankle socks (they stay on, so bare-foot talk stays illegal too); the micro shorts never leave.
  4: {
    0: W(4, 0, "off", "tube", false, "up", { midriff: true, yogaKit: true }),
    1: W(4, 1, "off", "tube", false, "up", { midriff: true, yogaKit: true }),
    2: W(4, 2, "off", "tube", false, "up", { midriff: true, yogaKit: true }),
    3: W(4, 3, "off", "tube", false, "up", { midriff: true, yogaKit: true }),
    // The day ends at stage 3 (26000). Stage 4 is an alias so any code that still indexes 0..4 on a
    // short ladder reads the finale plate instead of crashing into `undefined`.
    4: W(4, 4, "off", "tube", false, "up", { midriff: true, yogaKit: true }),
  },
  // Day 5 «5 бикини стрим»: микро-бикини на завязках и прозрачные шпильки, и это весь костюм. Ни одна
  // деталь не едет: legs bare (никаких чулок/гольфов/носков — его правило на этот костюм), feet HEELED
  // (поэтому «босиком» так же запрещено, как на коврике). Эскалирует поза и близость к вебке, не гардероб.
  5: {
    0: W(5, 0, "off", "bikini", false, "gone", {
      midriff: true,
      bikiniKit: true,
    }),
    1: W(5, 1, "off", "bikini", false, "gone", {
      midriff: true,
      bikiniKit: true,
    }),
    2: W(5, 2, "off", "bikini", false, "gone", {
      midriff: true,
      bikiniKit: true,
    }),
    3: W(5, 3, "off", "bikini", false, "gone", {
      midriff: true,
      bikiniKit: true,
    }),
    // The day ends at stage 3 (47000); stage 4 aliases the finale frame for anything indexing 0..4.
    4: W(5, 4, "off", "bikini", false, "gone", {
      midriff: true,
      bikiniKit: true,
    }),
  },
  // Day 6 «Деревенская девочка»: one pair of shrunken denim overalls (four sizes too small, hers from
  // childhood) and a straw hat, worn for the entire stream. NOTHING comes off — the escalation is the
  // object in the frame (cucumber in hands → cucumber in the mouth → an ear of corn in butter) and how
  // close her feet get to the lens. Each row below is written off HIS approved plate, not off the idea:
  //   s0 t136  both straps off the shoulders, hat over one eye, flip-flops ON both feet
  //   s1 t141  straps buckled back up, the cucumber held in both hands against her cheek
  //   s2 t147  straps buckled, half a cucumber caught between her front teeth, ONE flip-flop hanging
  //   s3 t207  straps off again, corn in both hands at her chest, both feet bare and in butter
  // The bib covers her stomach in all four, so `midriff` stays false the whole day — a line about a bare
  // belly would contradict the plate even though everything around it is bare.
  6: {
    0: W(6, 0, "off", "overalls", false, "gone", {
      denimKit: true,
      strapsDown: true,
      footwear: "both",
    }),
    1: W(6, 1, "off", "overalls", false, "gone", {
      denimKit: true,
      strapsDown: false,
      footwear: "both",
    }),
    2: W(6, 2, "off", "overalls", false, "gone", {
      denimKit: true,
      strapsDown: false,
      footwear: "one",
    }),
    3: W(6, 3, "off", "overalls", false, "gone", {
      denimKit: true,
      strapsDown: true,
      footwear: "none",
    }),
    // The day ends at stage 3 (68000); stage 4 aliases the finale frame for anything indexing 0..4.
    4: W(6, 4, "off", "overalls", false, "gone", {
      denimKit: true,
      strapsDown: true,
      footwear: "none",
    }),
  },
};

export function getWardrobe(streamDay: number, stage: number): Wardrobe {
  const day: DayIndex =
    streamDay === 6
      ? 6
      : streamDay === 5
        ? 5
        : streamDay === 4
          ? 4
          : streamDay === 3
            ? 3
            : streamDay === 2
              ? 2
              : 1;
  const clamped = Math.max(
    0,
    Math.min(4, Math.floor(stage)),
  ) as SubGoalStageIndex;
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
const GOLF_SLOUCH =
  /гольф[ыаоеу]?[^.!?]{0,26}(сполз|съехал|спустил|спущен|спуска|собран|гармошк|свалил|ослаб)/i;
const GOLF_TIGHT =
  /гольф[ыаоеу]?[^.!?]{0,26}(натянут|натянул|туго|по колено|до колена)/i;

/**
 * The toe part of a shoe, in Russian literally the same word family as "sock" (носок туфли = the vamp
 * of a pump). Day 5's plates show a clear heel hanging from her toes by one strap, so a line about the
 * "носок шпильки" describes the art; only a hosiery claim would contradict it. Scope: this is consulted
 * on the bikini day and nowhere else, so Day 1/Day 2 cannot use it as an excuse to talk about socks.
 */
const SHOE_TOE =
  /носк\w*[^.!?]{0,40}(шпильк|туфл|босоножк|ремешк)|(шпильк|туфл|босоножк)[^.!?]{0,40}носк\w*/i;

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
    if (/худи/i.test(line)) return "the ghost costume has no hoodie";
    if (/гольф/i.test(line) && !removal)
      return "the ghost costume has fishnets, not golf socks";
    if (
      /^(?!(.*\bне\b)).*(платье|платьиц|юбк|сарафан|халат|пижам)/i.test(line) &&
      !removal
    ) {
      return "calls the cut-down sheet a dress";
    }
    const sheet = w.sheet ?? "veil";
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
      /сполз[^.!?]{0,16}(плеч|набок)|с одного плеча|оголи[^.!?]{0,12}плечо|голое плечо|открыто плечо|плечо открыто/i.test(
        line,
      );
    const claimsTaut =
      /обтяж|натянута как чехол|натянул[аи]? (ткан|простын)|затянул[аи]? (ткан|простын)|силуэт под ткан/i.test(
        line,
      );
    const claimsCape = /как плащ|плащ\b|накидк\w* на плеч/i.test(line);
    const claimsHemLift =
      /подол|задрал|задерл|поднял[аи]? (ткан|простын)/i.test(line);
    // Previewing the next goal ("дальше будет плащ") is not a claim about the current plate.
    const futureTalk =
      /дальше|следующ|будет|будем|будут|станет|станут|потом|скоро|обеща|до финал|ждём|ждите|цел[ьию] (до|на)/i.test(
        line,
      );
    if (sheetTalk && !removal && !futureTalk) {
      if (sheet === "veil" && claimsHemLift) {
        return "claims a lifted hem while the sheet still hangs at her chest";
      }
      if (
        sheet !== "veil" &&
        sheet !== "hemLift" &&
        claimsHemLift &&
        sheet !== "off"
      ) {
        return "claims the hem is still held up after the sheet left her body";
      }
      if (sheet !== "veil" && claimsCovered)
        return "claims the sheet still hides her after it moved";
      if (claimsShoulderSlip)
        return "the sheet never slips off one shoulder on this ladder";
      if (claimsTaut)
        return "claims a stretched-tight sheet these frames never show";
      if (sheet !== "cape" && claimsCape)
        return "the sheet only becomes a cape at the finale";
      if (
        sheet === "off" &&
        /простын\w*[^.!?]{0,18}(на мне|надета|одет|накинут|на плечах)/i.test(
          line,
        )
      ) {
        return "claims to wear the sheet in the frame where it is in the air";
      }
      if (
        sheet === "hood" &&
        /простын\w*[^.!?]{0,14}(торс|тело|груд|живот|бёдра|бедра)/i.test(line)
      ) {
        return "claims the sheet covers her body while it is only a hood";
      }
    }
  }

  // Knee-highs: only "gathered/slouched" is true at the gathered stage; never while pulled up.
  if (/гольф/i.test(line)) {
    if (w.socks === "gone" && !removal)
      return "mentions golf socks she already took off";
    if (w.socks === "up" && GOLF_SLOUCH.test(line)) {
      return "claims the golf socks slipped while they are pulled up";
    }
    if (w.socks === "gathered" && GOLF_TIGHT.test(line)) {
      return "claims the golf socks are pulled up while they are gathered at the ankles";
    }
  }

  // Day 1 crew socks: they are gone from stage 1 on. Day 2 never has them at all (only knee-highs).
  // Day 4 comes back to ANKLE socks — ivory with a red band — and they stay on for the whole stream.
  if (/носок|носочк|носк[иеов]/i.test(line)) {
    if (w.day === 2 || w.day === 3)
      return `day ${w.day} outfit has knee-highs, not ankle socks`;
    if (
      w.socks === "gone" &&
      !removal &&
      !(w.bikiniKit && SHOE_TOE.test(line))
    ) {
      return "mentions socks she already removed";
    }
    if (
      w.socks === "up" &&
      /носк[а-я]*[^.!?]{0,26}(сполз|съехал|спустил|спущен|собран|гармошк)/i.test(
        line,
      )
    ) {
      return "claims her socks slipped while they are on";
    }
  }

  // Saying her feet are COVERED is the opposite claim - always allowed, even with socks on.
  const coversFeet =
    /(закрыт|спрятал|укутан|в гольфах|в носк|в сетк|под сетк|в чулк|под чулк|не голы)/i.test(
      line,
    );

  // Bare-foot talk needs bare feet.
  if (
    !coversFeet &&
    /бос[ыеиком]+|ступн|пяточк|пятьк|пальц\w* (ног|ступен)/i.test(line)
  ) {
    if (w.socks !== "gone")
      return "describes bare feet/soles while her feet are covered";
  }
  if (
    zone === "feet" &&
    w.socks !== "gone" &&
    /пальчик|пальц[еуы]/i.test(line)
  ) {
    return "wiggles bare toes while her feet are still inside socks";
  }

  // Hoodie placement.
  if (/худи/i.test(line) && !removal) {
    if (
      /(в|под|внутри) (оверсайз )?худи|худи (на мне|не спадёт|не спадает|закрывает|держит)/i.test(
        line,
      )
    ) {
      if (w.hoodie !== "on")
        return "says she is wearing the hoodie while it is not on her shoulders";
    }
    if (
      /худи[^.!?]{0,22}(на талии|повязан|завязан)/i.test(line) &&
      w.hoodie !== "tied"
    ) {
      return "says the hoodie is tied on her waist at the wrong stage";
    }
    if (
      /худи[^.!?]{0,22}(за спиной|на локтях|спадает с плеч|сполз с плеч)/i.test(
        line,
      )
    ) {
      if (w.hoodie !== "hanging" && w.hoodie !== "off")
        return "claims the hoodie is hanging behind her too early";
    }
  }

  // Tops.
  if (/майк|тишк|кроп/i.test(line) && !removal && w.top !== "tee") {
    return "talks about the t-shirt while she is not wearing one";
  }
  if (/бралет|бра-?топ|бюст/i.test(line) && !removal && w.top !== "bra") {
    return "talks about the bralette while she is wearing something else";
  }
  if (/ретелях|лямк/i.test(line) && !removal && w.top === "underHoodie") {
    return "mentions thin straps while she is bundled in the hoodie";
  }
  // The Day 3 bodysuit has no straps at all - that is the whole joke of «сползает само». Only a
  // line that says so out loud ("бретелек тут нет") is allowed through.
  if (
    (w.day === 3 || w.day === 4) &&
    /бретел|лямк/i.test(line) &&
    !NEGATED_STRAP_TALK.test(line)
  ) {
    return "mentions a strap on a strapless top";
  }
  if (
    /лямк[^.!?]{0,18}(?<!не )(подня|на месте|верну)/i.test(line) &&
    w.strapsDown
  ) {
    return "claims the straps are up while they are already down";
  }

  // Legs.
  if (/легинс/i.test(line)) {
    if (
      /без легинс|легинс(ы|ов)? (снят|нет|ушел|улетел|долой)|долой легинсы/i.test(
        line,
      )
    ) {
      if (w.leggings)
        return "says the leggings are off while she still wears them";
    } else if (!removal && w.leggings === false) {
      return "talks about leggings she has already taken off";
    }
  }

  if (
    /живот[^.!?]{0,16}(открыт|голый|мёрзнет|мерзнет|холодит)/i.test(line) &&
    !w.midriff
  ) {
    return "claims a bare stomach while her top covers it";
  }

  // Fishnets are Day 3's permanent legwear: never claim they came off, never claim bare legs.
  if (
    w.day === 3 &&
    w.fishnets &&
    /сетк|чулк|ступн|пальц|пяток|носок/i.test(line)
  ) {
    if (
      /без сетк|сетк[ауи]? (снят|нет|ушл|улетел)|голые ноги|ноги без/i.test(
        line,
      ) &&
      !removal
    ) {
      return "claims the fishnets are off while they are on all day";
    }
    // Full stockings: the net runs over the instep to the toes. "Голая стопа" contradicts the plate.
    if (
      /(ступн|пяток|пальц\w* (ног|ступен)|подошв)[^.!?]{0,18}(голы|без сетк|нат\b)/i.test(
        line,
      )
    ) {
      return "claims a bare foot while the fishnet covers it down to the toes";
    }
  }

  // Day 4 yoga kit: one knit costume for the whole stream. Nothing is removed and nothing from the
  // earlier days exists here, so the guard is short — it only kills garments that are not in frame.
  if (w.yogaKit) {
    if (/простын|сетк|чулк|боди|гольф/i.test(line)) {
      return "names a Day-2/Day-3 garment the yoga kit does not have";
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
      return "claims a garment left her body — the yoga day changes poses, not clothes";
    }
    if (
      !yogaFutureTalk &&
      /шорт\w*[^.!?]{0,16}(снят|снял|сняла|нет|ушл|улетел|долой)|без шорт/i.test(
        line,
      )
    ) {
      return "claims the micro shorts came off — they stay on for the whole yoga day";
    }
    // Bare toes belong to Day 1 and the Day 2 finale; on the mat she stays in her socks.
    if (!yogaNegation && /босиком|босые|голые ступн|голые пальц/i.test(line)) {
      return "claims bare feet while she is in socks on the yoga mat";
    }
  }

  // Day 5 bikini kit: the outfit is everything and nothing, so the guard is a whitelist of absences.
  if (w.bikiniKit) {
    // His standing rule for this costume: bare legs in clear neon heels. Any legwear word contradicts
    // the plate, including the Day-3 fishnets and the Day-4 socks that the earlier days made familiar.
    // Saying the garment is ABSENT is the day's premise ("на мне только бикини и шпильки"), so it is
    // allowed; naming one as if it were on her is what the plate contradicts.
    const bikiniAbsence =
      /(нет|не на|без|ни одной|ни единой|только)[^.!?]{0,20}(чулк|гольф|носк|сетк|колгот|подвязк|легинс|шорт|худи|простын|боди|вязан)|(чулк|гольф|носк|сетк|колгот|подвязк|легинс|шорт|худи)[^.!?]{0,14}(нет|не было|не будет|не надета|не надела|сняты не будут)/i;
    if (
      /чулк|гольф|носк|сетк|колгот|подвязк|легинс|шорт|худи|простын|боди|вязан/i.test(
        line,
      ) &&
      !bikiniAbsence.test(line) &&
      !(SHOE_TOE.test(line) && /шпильк|туфл|босоножк/i.test(line))
    ) {
      return "names a garment the micro bikini does not have — bare legs, clear heels, nothing else";
    }
    // She is heeled in all four frames; at the finale one sandal only hangs from her toes by its strap.
    if (
      !bikiniNegation(w, line) &&
      /босиком|босые|голые ступн|голые пальц|без обуви/i.test(line)
    ) {
      return "claims bare feet while she is wearing the clear vinyl heels";
    }
    // Nothing leaves her body on this day either — the ladder is the pose, like Day 4. Two escapes:
    // future talk about the next stream, and the negation the chat keeps repeating.
    const bikiniFutureTalk =
      /дальше|следующ|будет|будем|будут|станет|станут|потом|скоро|обеща|до финал|ждём|ждите|не надо|не нужно|не просим|если добьё|когда добьёте|завтра|в другой стрим|в другой раз/i.test(
        line,
      );
    // "Ни одной детали не сняла", "узелки не развязались", "всё на месте" — these are statements that
    // nothing moved, which is exactly the truth of this day, so they must not be filtered as claims.
    const bikiniNegationHere =
      /(ни одной|ни единой|ни одна|ни одного|ноль снят|без единой|ничего не|не снял|не снят|не улетел|не съехал|не сполз|не развяз|никак не|не раздев|не просим|так и сидит|так и стоит|остаёт|остается|держится|не сдвину)/i.test(
        line,
      );
    /**
     * No `\b` and a Cyrillic lookbehind, both on purpose: JS word boundaries are ASCII, so `снял\b`
     * never matches inside a Cyrillic word — that is how the Day-4 list quietly relies on its bare-stem
     * alternatives, and why a bare stem alone would also flag «стеснялась». The lookbehind keeps the
     * stem at a word start, and every branch stays a claim that a panel left her body, which no Day-5
     * plate shows.
     */
    const bikiniRemovalClaim =
      /(?<![а-яё])(снял|снята|снято|сняты|стянул|стянут|стянула|раздева|раздел[аи]|обнажи|оголи|сорва|сбросил|улетел|улетает|расстегн|развяз|распустил|унесла|полетел)/i.test(
        line,
      );
    if (!bikiniFutureTalk && !bikiniNegationHere && bikiniRemovalClaim) {
      return "claims a bikini panel moved or came off — Day 5 escalates the pose, not the wardrobe";
    }
    // The straps are the whole costume, so "my straps slipped" is a plate contradiction, not flavor.
    if (
      /бретел|лямк/i.test(line) &&
      !/(без|нет|ни одной|ни единой)[^.!?]{0,14}(бретел|лямк)/i.test(line)
    ) {
      return "claims strap trouble on a bikini whose shoulder ties are tied tight in the plate";
    }
  }

  // Day 6 village kit: one pair of shrunken overalls + a straw hat, and the object in her hands. The
  // heat of this day is the PROP and the fabric tension, never the wardrobe, so the guard claims exactly
  // what the matching plate shows and nothing else. Every regex below is Cyrillic-lookaround based: `\b`
  // is ASCII in JS, so a `\b` around a Cyrillic stem silently never matches (the Day-4 lesson).
  if (w.denimKit) {
    const denimFutureTalk =
      /дальше|следующ|будет|будем|будут|станет|станут|потом|скоро|обеща|до финал|ждём|ждите|не надо|не нужно|не просим|если добь|когда добьёте|завтра|в другой стрим|в другой раз|вчера|раньше|в детстве|ранее/i.test(
        line,
      );
    const denimPastTalk =
      /(?<![а-яё])(съел|ел[аи]?|был[аио]?|остал|помню|до стрима|до эфира|начал)/i.test(
        line,
      );
    /**
     * "Ни одной вещи не сняла", "шляпа никуда не делась", "лямию не рву" — saying the outfit is INTACT is
     * the truth of this day, so a negation is never a removal claim.
     */
    const denimNegation =
      /(ни одной|ни единой|ни одна|ни одного|ноль снят|без единой|ничего не|не снял|не снят|не улетел|не съехал|не сполз|не развяз|не расстег|никак не|не раздев|не просим|не трогаю|не рву|так и сидит|так и стоит|остаёт|остается|держится|не сдвину|никуда не)/i.test(
        line,
      );
    const denimRemovalClaim =
      /(?<![а-яё])(снял|снята|снято|сняты|снима|снимай|стянул|стянут|стягива|раздева|раздел[аи]|обнажи|оголи|сорва|сорв[ау]|сбросил|улетел|улетает|расстегн|развяз|распустил|унесла|полетел|скинь|скидывай|разут|обува)/i.test(
        line,
      );
    if (denimRemovalClaim && !denimNegation && !denimFutureTalk) {
      return "claims a garment left her body — the village day never takes the overalls off, the straps let go by themselves";
    }
    // A second garment is the one thing the plates rule out by absence: she is in the overalls and the
    // hat, over nothing, under nothing. Naming the garment is illegal, saying it is NOT there is the
    // day's whole premise ("под комбинезоном у меня ничего нет, чат"), so an absence clause passes.
    const denimAbsence =
      /(нет|не на|не под|без|ни одной|ни единой|только|не ношу|не надену)[^.!?]{0,22}(футболк|маек|маик|топ|бралет|бра-?топ|бюстг|лифчик|рубашк|кофт|свитер|водолазк|чулк|гольф|сетк|колгот|легинс|куртк|пиджак|жакет|платье|юбк|халат|пижам|бель[ие]|трусик|босоножк|туфл|шпильк|кроссовк|носк)|(футболк|маек|маик|топ|бралет|бюстг|лифчик|рубашк|кофт|чулк|гольф|сетк|колгот|легинс|куртк|платье|юбк|бель[ие]|трусик|шпильк|туфл|носк)[^.!?]{0,16}(нет|не было|не будет|не надета|не надела|не ношу|не ношу|сняты не будут)/i;
    if (
      /(?<![а-яё])(футболк|маек|маик|топ|бралет|бра-?топ|бюстг|лифчик|рубашк|кофт|свитер|водолазк|чулк|гольф|сетк|колгот|легинс|куртк|пиджак|жакет|платье|юбк|халат|пижам|бель[ие]|трусик|босоножк|туфл|шпильк|кроссовк)|(?<![а-яё])(бра|ток)[^.!?]{0,10}(на мне|надета)/i.test(
        line,
      ) &&
      !denimAbsence.test(line)
    ) {
      return "names a garment the village plate does not have — one pair of overalls, one straw hat, nothing else";
    }
    // The hat is on her head in all four frames (pushed back on the crown, over one eye at the gate), so
    // any line that reports it leaving is a lie about the art.
    if (
      /шляп\w*[^.!?]{0,20}(снял|сбросил|улетел|уехала|девается|не на|нет на|дожд|жд|съехал[аи]? с головы)|без шляп|(?<![а-яё])снял[аи]? шляп/i.test(
        line,
      ) &&
      !denimNegation &&
      !denimFutureTalk
    ) {
      return "claims the straw hat left her head — it stays on for every village frame";
    }
    // Strap truth is per frame, and the two states are opposite: at s1/s2 the buckles are closed and the
    // straps sit on her shoulders, at s0/s3 both hang on her forearms. (The shared rule above already
    // vetoes "лямки на месте" while `strapsDown` is true; this half vetoes the opposite direction.)
    if (
      !w.strapsDown &&
      /(?<![а-яё])(лямк|бретел)\w*[^.!?]{0,22}(сполз|съехал|спустил|спущен|висит на предплеч|на предплеч|сорван|оторван|отошли)/i.test(
        line,
      ) &&
      !denimNegation &&
      !denimFutureTalk
    ) {
      return "claims the straps slipped down at a frame where both are buckled on her shoulders";
    }
    // Flip-flops: a stage fact. Copy may only claim bare feet once the plate has none, and may not claim
    // both sandals on while one of them hangs off a single foot.
    const footwear = w.footwear ?? "none";
    if (
      /шлепк|вьетнамк|тапочк|сланц|обут|разут/i.test(line) &&
      !denimNegation &&
      !denimPastTalk
    ) {
      if (footwear === "none" && !denimFutureTalk) {
        return "mentions the flip-flops in the finale frame, where they are out of the picture";
      }
      if (
        footwear === "one" &&
        /обе (ноги|ступни|лапки)|на обеих|оба шлепк|обе шлепк/i.test(line)
      ) {
        return "claims both flip-flops are on while one of them hangs from a single foot";
      }
    }
    if (
      footwear !== "none" &&
      /(?<![а-яё])босиком|босые ноги|босые ступн|голые ступн|голые пальц|без обуви/i.test(
        line,
      ) &&
      !denimNegation
    ) {
      return "claims bare feet while the red flip-flops are still on her feet in this frame";
    }
    // The prop ladder is the day, so a prop may only be named on the plate that carries it. The cucumber
    // is in her hands at 54000 and in her mouth at 61000; the corn and the butter belong to 68000 alone.
    const cucumberHere = w.stage === 1 || w.stage === 2;
    if (
      /огур[еёцч]/i.test(line) &&
      !cucumberHere &&
      !denimPastTalk &&
      !denimFutureTalk &&
      !denimNegation
    ) {
      return `names the cucumber on a village frame that does not hold it (stage ${w.stage})`;
    }
    if (
      /огур[еёцч][^.!?]{0,20}(во рту|в рту)|(?<![а-яё])(во рту|в рту)[^.!?]{0,20}огур[еёцч]/i.test(
        line,
      ) &&
      w.stage !== 2
    ) {
      return "claims the cucumber is in her mouth — only the 61000 frame shows it between her teeth";
    }
    if (
      /(кукуруз|початк|зере[нм]|зёрн)/i.test(line) &&
      w.stage !== 3 &&
      !denimFutureTalk &&
      !denimNegation
    ) {
      return "names the ear of corn before the finale frame, where it first appears";
    }
    if (
      /масл/i.test(line) &&
      w.stage !== 3 &&
      !denimFutureTalk &&
      !denimNegation &&
      !denimPastTalk
    ) {
      return "claims the butter mess on a frame that has none — the spill is the finale plate only";
    }
    // The bib closes her torso in every frame, so the midriff rule is not enough: overalls talk must stay
    // about the fabric, the seams, the buckles and the buttons (his Rule 7 — strain lives in the stitch).
    if (
      /комбинезон[^.!?]{0,24}(рванул|разорвал|лопнул|треснул)/i.test(line) &&
      !denimNegation
    ) {
      return "claims the denim tore — on these plates every seam holds and only the stitching is stretched";
    }
  }

  return null;
}

/** "Без чехла", "не сняла ни одной вещи" — a negation is a statement about the outfit, not a change. */
function bikiniNegation(_w: Wardrobe, line: string): boolean {
  return /(без|не|ни одной|ни единой|ничего)[^.!?]{0,16}(обуви|туфель|шпилек|босоножк)|(обувь|шпажки?|туфли|босоножки)[^.!?]{0,12}(на месте|надеты|на ней|не сним)/i.test(
    line,
  );
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
export const WARDROBE_SAFE_LINES: Record<
  DayIndex,
  Record<SubGoalStageIndex, readonly string[]>
> = {
  1: {
    0: [
      "Ой!.. Я пока вся в этом огромном худи, поэтому краснею просто от взгляда в камеру, а не от смелости~",
      "Не-не, в худи меня трогать нельзя — я в нём как в коконе, и мне так спокойнее!",
    ],
    1: [
      "Х-холодно... босые ноги свешиваю с кресла и делаю вид, что мне совсем не волнительно~",
      "Ступни спрятала под себя, худи натянула — и всё равно чувствую, что чат смотрит именно туда!",
    ],
    2: [
      "В одном худи и с голыми ногами... чат, вы точно не планируете заставлять меня снимать и его?!",
      "Ноги совсем голые, я их вжала в кресло — так, по крайней мере, меньше горит~",
    ],
    3: [
      "Кроп-тишка, голый живот и весь чат в объективе... я дышу, всё хорошо, это просто эфир!",
      "Ткань короткая, поэтому каждое ваше «милая» ощущается как сквозняк~",
    ],
    4: [
      "В одном чёрном бралетте, наклонилась к вебке — и, кажется, мне это нравится. Страшно, но нравится~",
      "Я сама так села и сама смотрю в камеру. Никаких носочков, никаких отговорок, чатик~ ★ ♥",
    ],
  },
  2: {
    0: [
      "Я в оверсайз худи через голову, и гольфы натянуты до колена — сегодня так просто ничего не спадёт!",
      "Худи на мне, гольфы натянуты, руки в рукавах... чат, вы серьёзно собираетесь всё это снять?",
    ],
    1: [
      "Худи уехало за кадр, осталась серая майка — и гольфы я натянула как надо, специально для вас... то есть для тепла!",
      "Майка коротковата, гольфы туго натянуты, и я делаю вид, что совершенно не волнуюсь~",
    ],
    2: [
      "Худи завязано на талии, топ на бретелях, гольфы собраны внизу — чат, вы же не думали, что я всё это просто так надела?",
      "Узел на талии затянула сама, а я держу лицо. Топ на бретелях, гольфы у щиколоток — всё по вашему коварному плану~",
    ],
    3: [
      "Обе лямки съехали на плечи, худи висит за спиной... и я сижу так близко к камере, как сама захотела~",
      "Лямки я не подниму. Гольфы пока на месте — и это единственное, что ещё стоит между вами и финалом~",
    ],
    4: [
      "Всё: топ снят, гольфы улетели, я на коленях у самой камеры. Пять тысяч сабов, чат — ты получил меня раскрепощённую~ ★ ♥",
      "Босые ступни на сиденье, худи на локтях, и я улыбаюсь в объектив. Вчера бы сгорела — сегодня прошу смотреть~ ♥",
    ],
  },
  // Day 3 ghost: a sheet costume over a bodysuit + full fishnets. The safe pool keeps that truth.
  3: {
    0: [
      "Белая простыня, две кривые дырки для глаз и улыбка в одной из них. Бу! — и всё, костюм готов~",
      "Ткань на голове и на плечах, а живот и ноги в сетке вы видите сами. Я не пряталась, я стилизовалась~",
    ],
    1: [
      "Я подняла подол, потому что шуршит и мешается. Ну и живот открыт, да, я вижу, чат, я не слепая~",
      "Смотрите ниже ткани: боди, талия, сетка. Это не случайность, это монтаж кадра, я его специально сделала.",
    ],
    2: [
      "Ткань осталась только на голове, поэтому видно всё. Я взрослая и не скажу «случайно», я скажу «костюм».",
      "Ножки на столе, капюшон из простыни, ступни в сетке целиком. Призрак выехал на позу, чат~",
    ],
    3: [
      "Бу! — и простыня в воздухе. Да, я её сама сорвала. Нет, я её не потеряла, она была у меня в руках.",
      "Ткань улетела вверх, костюм остался на мне. Лучший кадр стрима, и вы его уже нарезали на клипы~",
    ],
    4: [
      "Финал: простыня уехала за спину как плащ, боди и сетка — на камеру. Я красивая, и мне не страшно~ ★ ♥",
      "Корточки на кресле, колени врозь, ступни в сетке целиком. Дразнюсь официально, по договору с эфиром~ ♥",
    ],
  },
  // Day 4 yoga: one knit kit, one chair, four poses. The safe pool never promises a removal, because
  // on this day nothing is taken off — only the pose gets deeper.
  4: {
    0: [
      "Вязаный топ без бретелей, шорты на два размера меньше, руки в замок над головой. Это разминка, чат, а не приглашение~",
      "Кресло под собой я не отпускаю: на нём и будем стоять. Подбородок вверх, спина длинная, дальше — ваши сабы.",
    ],
    1: [
      "Колено на сиденье, вторая нога вытянута в пол. Это поза на открывание бедра, любой учебник подтвердит. Я просто разминаюсь~",
      "Шорты на месте, носочки тоже, я откинулась назад и смеюсь — потому что вижу, что вы написали в чате.",
    ],
    2: [
      "Вертикальный шпагат, носочек у волос, две пальца в камеру. Я встала именно так, чтобы вам было видно всё, чат~",
      "Ногу держу руками, спина прогнута, топ натянут до предела. Ни одна резинка никуда не денется до 26000.",
    ],
    3: [
      "Финал: я в кресле, голени лежат на подлокотниках, ладони у меня на животе. Никуда не встаю — свою часть договора вы выполнили~ ♥",
      "Ноги на подлокотниках, носочки на месте, топ держится на честном натяжении. Смотрите сколько хотите, это ваш стрим~ ★ ♥",
    ],
    4: [
      "Финал: я в кресле, голени лежат на подлокотниках, ладони у меня на животе. Никуда не встаю — свою часть договора вы выполнили~ ♥",
      "Ноги на подлокотниках, носочки на месте, топ держится на честном натяжении. Смотрите сколько хотите, это ваш стрим~ ★ ♥",
    ],
  },
  // Day 5 bikini: four frames, one costume, and she sets the terms. The safe pool talks about the pose,
  // the tension of the neon and the price — never about taking anything off, because there is nothing left.
  5: {
    0: [
      "Микро-бикини — и это весь костюм, чат. Снимать нечего, поэтому дальше двигается только поза и ваша полоска сабов~",
      "Нога вытянута в вебку, стопа крупнее головы, ладони на своих бёдрах. Я сидела так специально, не надо делать вид, что случайно.",
    ],
    1: [
      "Обе ноги на подлокотнике, ступни у самой линзы, руки у меня на лодыжке. Тридцать три тысячи, чат, и я их отработала~",
      "Шпильки прозрачные, каблуки неоновые, нога держится на ремешке. Ни одна деталь никуда не денется до сорока тысяч.",
    ],
    2: [
      "Я на коленях в собственном кресле, спиной к камере, смотрю через плечо. Это поза, а не приглашение — приглашение будет дороже.",
      "Спина длинная, ткань натянута, румянец есть, стыда нет. Сорок тысяч сабов, и я только разогрелась~ ★",
    ],
    3: [
      "Финал: разворот квадратно к вебке, и ближе всего к линзе то, что чат просил с первого дня. Вы дошли, я дошла, все молодцы~ ★ ♥",
      "Я смотрю назад через плечо и улыбаюсь, потому что это вы меня довели до camera-ready. Завтра — второй заход, если набьёте.",
    ],
    4: [
      "Финал: разворот квадратно к вебке, и ближе всего к линзе то, что чат просил с первого дня. Вы дошли, я дошла, все молодцы~ ★ ♥",
      "Я смотрю назад через плечо и улыбаюсь, потому что это вы меня довели до camera-ready. Завтра — второй заход, если набьёте.",
    ],
  },
  // Day 6 village: two lines per frame that can only be true of THAT frame, because the prop ladder and
  // the strap states differ plate by plate. The guard above is built from these frames, so the fallback
  // pool has to be as strict as the guard — it is what plays when the chat writes something the plate
  // contradicts.
  6: {
    0: [
      "Комбинезон на мне целиком, чат: один bib, две лямки на предплечьях, шляпа на голове. Снимать с меня нечего, вы считали не туда~",
      "Шлепки на обеих ногах, швы натянуты так, что белая строчка читается штрихами. Это мой рабочий костюм на сегодня, и он мне не мал — это вы маленькие.",
    ],
    1: [
      "Лямки я застегнула обратно, поэтому огурец держат обе руки, а не платье. Пятьдесят четыре тысячи, чат, и я его даже не надкусила~",
      "Огурец в двух руках у щеки, взгляд у меня деловой. Дальше будет дороже, и это не угроза, это прайс.",
    ],
    2: [
      "Половина огурца у меня во рту, руки подняты и пустые — вот вам доказательство, что я его держу зубами, а не выдумала~",
      "Один шлепок висит на ноге, вторая ступня свободна, огурец во рту. Шестьдесят одна тысяча сабов, и я вела этот счёт, а не вы.",
    ],
    3: [
      "Финал: обе ступни в масле, початок у меня в двух руках, комбинезон натянут до последней строчки. Ни одной вещи я не сняла, чат~ ★ ♥",
      "Масло на ногах — это ваша подписка на шестьдесят восемь тысяч, а не авария. Я её честно отработала, теперь смотрите и молча считайте.",
    ],
    4: [
      "Финал: обе ступни в масле, початок у меня в двух руках, комбинезон натянут до последней строчки. Ни одной вещи я не сняла, чат~ ★ ♥",
      "Масло на ногах — это ваша подписка на шестьдесят восемь тысяч, а не авария. Я её честно отработала, теперь смотрите и молча считайте.",
    ],
  },
};
export function safeWardrobeLine(w: Wardrobe, seed: number): string {
  const pool =
    WARDROBE_SAFE_LINES[w.day][w.stage] ?? WARDROBE_SAFE_LINES[w.day][0]!;
  return pool[Math.abs(seed) % pool.length]!;
}

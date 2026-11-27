import type { TapZoneId } from '../domain/types.ts';

/**
 * What she does when you touch her, and why it is not a switch statement.
 *
 * The first version of the tap reaction was three `if`s in the stage: feet got the tickle, the face
 * got the tongue 35 % of the time, the chest got the gasp, everything else got the nod. It read as a
 * machine, for a reason that has nothing to do with animation quality: the answer never depended on
 * *her*. A player who has been feeding her subscribers for ten minutes deserves a different woman
 * than the one who just met her, and the same tap on the same cheek should be able to land
 * differently at boldness 20 and boldness 80.
 *
 * So the choice lives here, as a pure function of what the game knows: the zone, her boldness, the
 * hype, and how hard the player is hammering (`streak` = taps in the last 1.2 s). Pure means it can
 * be tested without Pixi, which is how the table below is verified instead of eyeballed.
 *
 * Two invariants, both enforced by the caller and by the tests:
 *
 * 1. **Only beats the plate actually has.** Every candidate is filtered against `available`, so a
 *    plate without the tongue never plays the tongue, and nothing has to be flagged off by hand.
 * 2. **A tap is always answered.** If every candidate is missing, the fallback is the plain nod.
 *    There is no zone, no mood and no streak that gets a tap with no reaction at all.
 */

export type BeatName =
  | 'tap'
  | 'gasp'
  | 'tease'
  | 'tickle'
  | 'giggle'
  | 'arch'
  | 'shy_tuck'
  | 'shiver'
  | 'settle'
  | 'lean_in'
  | 'hair_flip'
  | 'turn';

export interface Beat {
  anim: BeatName;
  /** How long the game treats her as busy. Longer than the clip is fine: it is a mood, not a timer. */
  ms: number;
}

export interface DirectorContext {
  zone: TapZoneId;
  /** 0..100 — how far the wardrobe has come. The single most important input. */
  boldness: number;
  /** 0..100 — chat heat. Decides whether she plays to the room or to the one person tapping. */
  hype: number;
  /** Taps in the last 1.2 s. 1 is a normal tap; 8+ is a person hammering. */
  streak: number;
  available: ReadonlySet<string>;
  /** Injectable so the table can be tested; defaults to `Math.random` at the call site. */
  random: () => number;
}

export const BEAT_MS: Record<BeatName, number> = {
  tap: 480,
  gasp: 850,
  tease: 1600,
  tickle: 1000,
  giggle: 1150,
  arch: 1700,
  shy_tuck: 1500,
  shiver: 620,
  settle: 1250,
  lean_in: 1800,
  hair_flip: 1400,
  turn: 2400,
};

/** A hammered tap is a different verb from a tap: 8 in 1.2 s is 6.7 per second. */
const HAMMERING = 8;

function pickWeighted(
  options: { anim: BeatName; weight: number }[],
  random: () => number,
): BeatName | null {
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  if (total <= 0) return null;
  let roll = random() * total;
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option.anim;
  }
  return options[options.length - 1]!.anim;
}

/**
 * The table. Read it top to bottom: the first rule that applies wins.
 *
 * The weights are deliberately coarse. A reaction that changes on a 1 % roll is noise, not
 * character; what the player should be able to feel is the *balance* shifting as she gets bolder,
 * which is why the same zone lists the shy beat first at low boldness and the bold beat first at
 * high boldness instead of mixing them at 50/50.
 */
export function pickBeat(context: DirectorContext): Beat {
  const { zone, boldness, hype, streak, available, random } = context;
  const has = (name: BeatName) => available.has(name);
  const answer = (anim: BeatName): Beat => ({ anim, ms: BEAT_MS[anim] });

  // 1. Hammering overrides everything. Past eight taps in a second she is not answering a tap any
  //    more, she is being shaken, and the honest reaction is the one that stops the loop: a shiver
  //    and a laugh, whichever the plate has.
  if (streak >= HAMMERING) {
    if (has('giggle') && random() < 0.6) return answer('giggle');
    if (has('shiver')) return answer('shiver');
    return answer('tap');
  }

  // 2. The zone she was touched in answers where it landed — the whole point of zones.
  if (zone === 'feet') {
    if (has('tickle')) return answer('tickle');
    return answer('tap');
  }

  if (zone === 'chest') {
    // At low boldness a touch on the chest is a small shock; once she is bold it is a performance.
    const bold = boldness >= 55;
    const options: { anim: BeatName; weight: number }[] = [];
    if (bold && has('arch')) options.push({ anim: 'arch', weight: 3 });
    if (has('gasp')) options.push({ anim: 'gasp', weight: bold ? 3 : 5 });
    if (bold && has('tease')) options.push({ anim: 'tease', weight: 1.2 });
    const chosen = pickWeighted(options, random);
    return answer(chosen ?? 'tap');
  }

  if (zone === 'head') {
    const options: { anim: BeatName; weight: number }[] = [];
    if (boldness >= 55) {
      // Bold Miya plays with the person poking her: tongue first, and a giggle as the alternate.
      if (has('tease')) options.push({ anim: 'tease', weight: 4 });
      if (has('giggle')) options.push({ anim: 'giggle', weight: 2.5 });
      if (has('hair_flip')) options.push({ anim: 'hair_flip', weight: 1.5 });
    } else if (boldness >= 30) {
      if (has('tease')) options.push({ anim: 'tease', weight: 1.6 });
      if (has('shy_tuck')) options.push({ anim: 'shy_tuck', weight: 2.2 });
      if (has('giggle')) options.push({ anim: 'giggle', weight: 1 });
    } else {
      // Someone who has not been "seen" much yet hides in her own shoulder rather than performing.
      if (has('shy_tuck')) options.push({ anim: 'shy_tuck', weight: 3.4 });
      if (has('giggle')) options.push({ anim: 'giggle', weight: 0.8 });
    }
    const chosen = pickWeighted(options, random);
    return answer(chosen ?? 'tap');
  }

  if (zone === 'belly') {
    const options: { anim: BeatName; weight: number }[] = [];
    if (has('shiver')) options.push({ anim: 'shiver', weight: 2.6 });
    if (has('giggle')) options.push({ anim: 'giggle', weight: 1.8 });
    if (has('settle')) options.push({ anim: 'settle', weight: 1.2 });
    const chosen = pickWeighted(options, random);
    return answer(chosen ?? 'tap');
  }

  // Legs, and anything the plate puts in that zone: she moves her weight, or leans in if the room
  // is hot enough that a tap is worth a whole body.
  const options: { anim: BeatName; weight: number }[] = [];
  if (has('settle')) options.push({ anim: 'settle', weight: 2.4 });
  if (hype >= 60 && has('lean_in')) options.push({ anim: 'lean_in', weight: 2 });
  if (has('giggle')) options.push({ anim: 'giggle', weight: 0.8 });
  const chosen = pickWeighted(options, random);
  return answer(chosen ?? 'tap');
}

/**
 * The beats she may perform while nobody is doing anything, in the order they are preferred.
 * The idle pool in `LiveHeroine` filters this against the document; keeping the list here means the
 * director owns the whole vocabulary and a new beat cannot be half-wired.
 */
export const IDLE_BEATS: BeatName[] = [
  'turn',
  'hair_flip',
  'lean_in',
  'giggle',
  'arch',
  'shy_tuck',
  'settle',
];

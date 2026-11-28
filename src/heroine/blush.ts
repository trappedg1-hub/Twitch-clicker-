/**
 * Blush — the one hot thing that was missing exactly where it matters most.
 *
 * The flat plates have painted emotion patches (`patch_t1_shy.webp` and so on) with the blush
 * baked in. The moment a plate gets a skeleton, the skeleton draws its own face — and until now
 * that face had eyes, blinking, a mouth and nothing else. So the 26 rigged plates, i.e. almost the
 * whole game, had **no blush at all**: the hotter she got, the more the picture stayed cool.
 *
 * This module is the level, not the drawing: how pink she is, from numbers the game already has.
 * Keeping it pure means the curve can be tested and tuned without a browser, and the renderer
 * (two soft sprites under her cheeks) only has to know a number between 0 and 1.
 *
 * Three rules, all of them about *people* rather than about graphics:
 *
 * 1. **It is mostly slow.** Boldness warms her over a stream, not over a tap; that is the baseline.
 * 2. **It spikes.** A donation, a stare she catches, a milestone — those are moments, and a moment
 *    that fades in over two seconds is not a moment. Warming up is fast (2.2/s), cooling is slow
 *    (0.30/s), so a spike is still faintly there ten seconds later, which is what a real face does.
 * 3. **It never reaches the paint.** A five-alarm red on a cheek is a comic-book shortcut; the
 *    ceiling here is 0.85 and the renderer multiplies it down again.
 */

export interface BlushInput {
  /** 0..100, the same number the rig's emotions use. */
  boldness: number;
  /** 0..100 chat hype. */
  hype: number;
}

/** How much of the boldness scale counts: past ~70 she is already as pink as she gets. */
const BOLD_SPAN = 70;

/** Steady blush from her own state. 0 at a cold start, ~0.55 when she is bold and chat is hot. */
export function baseBlush(input: BlushInput): number {
  const bold = Math.min(1, Math.max(0, input.boldness / BOLD_SPAN));
  const hype = Math.min(1, Math.max(0, input.hype / 100));
  return Math.min(0.55, 0.42 * bold + 0.13 * hype);
}

export interface BlushRampState {
  level: number;
}

/** Seconds to warm by one unit of level, and to cool by one unit. Asymmetric on purpose. */
export const BLUSH_RATE = { warm: 2.2, cool: 0.3 } as const;

/**
 * One frame of the ramp. `spike` is 0..1 of *transient* heat (donation, stare, being tickled),
 * already decayed by the caller — it is added to the target, never stored here.
 */
export function stepBlush(state: BlushRampState, dt: number, target: number, spike = 0): number {
  const aim = Math.min(1, Math.max(0, target + spike));
  const rate = aim > state.level ? BLUSH_RATE.warm : BLUSH_RATE.cool;
  const step = rate * Math.max(0, Math.min(0.1, dt));
  if (aim > state.level) state.level = Math.min(aim, state.level + step);
  else state.level = Math.max(aim, state.level - step);
  return state.level;
}

/** How much visual alpha a level is worth. Capped so she is flushed, never painted. */
export function blushAlpha(level: number): number {
  return 0.38 * Math.min(1, Math.max(0, level)) ** 1.15;
}

/** Transient heat per event, and how fast it leaves. Named so the game reads like a script. */
export const HEAT = {
  tap: 0.16,
  hammer: 0.3,
  stare: 0.7,
  tickle: 0.45,
  donation: 0.9,
  milestone: 0.6,
  /** Fraction of the transient heat still there after one second. */
  decayPerSecond: 0.42,
} as const;

/** Advance a transient heat value by `dt` seconds. */
export function decayHeat(heat: number, dt: number): number {
  return heat * Math.pow(HEAT.decayPerSecond, Math.max(0, Math.min(1, dt)));
}

import { BREATH_PERIOD_SEC, breathPhase } from '../heroine/poseBreathing.ts';

export { BREATH_PERIOD_SEC, breathPhase };

/**
 * The room's own breathing tempo.
 *
 * Her visible breath on 29 of 30 plates is not a sine — it is the authored `breath` clip in the rig,
 * four seconds long (published per art as `breathSec` in `public/rigs/index.json`, so this number is
 * checked against it by test rather than remembered). The room breathes at that tempo and on its own
 * phase, the way two people in the same room do: what has to match is the *speed*, because a room
 * that breathes at a different tempo from the body in it reads as a machine in a second room. The
 * phase cannot be matched — the clip's clock lives inside the runtime and the flat plate breathes at
 * 3.6 s — and pretending otherwise would be a comment, not a feature.
 */
export const ROOM_BREATH_PERIOD_SEC = 4;

/**
 * The room, decided without a speaker.
 *
 * `sfx.ts` can make a click; what it cannot do is make the player believe a person is sitting two
 * metres away at 2 a.m. That is a different kind of sound: not an event, a *presence* — the box fan
 * in the corner, the PC's low hum, her breathing, the chair taking her weight, the city behind the
 * window. It runs for the whole session, so every number here is small and every rule is
 * conservative: a bed nobody notices when it is there and everybody notices when it stops.
 *
 * Everything in this file is arithmetic on purpose. The Web Audio graph in `sfx.ts` is a dozen
 * nodes and cannot be measured in a headless browser (nothing is audible there), so everything that
 * *can* be wrong — the envelope of a breath, how often a chair creaks, how far the room ducks under
 * her voice — is decided here, where `tests/roomPlan.test.ts` can hold it by number.
 *
 * The breath is the one place where sound and picture are the same clock: `BREATH_PERIOD_SEC` is
 * imported from the visual side, so the breath you hear is the breath you see. If someone ever
 * retunes her chest, the room follows in the same commit instead of drifting a beat behind.
 */

/** Everything the room is made of, in order of how loud it is. All gains are pre-master (0..1). */
export interface RoomMix {
  /** The bed: filtered noise, the room's own air. */
  readonly bed: number;
  /** The PC in the corner: a very low sine under the bed. */
  readonly hum: number;
  /** Her breath, the loudest thing in the room and still quieter than a tap. */
  readonly breath: number;
  /** The chair taking her weight. Rare, and the only event with an attack. */
  readonly creak: number;
  /** The street two floors down: a low swell, no detail. */
  readonly city: number;
}

/** Days get later and quieter; the mix follows without anyone retuning it per day. */
export function nightFactor(day: number): number {
  const d = Math.min(6, Math.max(1, Math.round(day)));
  return 1 - (d - 1) * 0.06;
}

/**
 * The level of the whole room for a given day.
 *
 * 0.05 of a 0.3 master is about 10x quieter than a tap — the ratio a real room has against a
 * fingertip on a desk. Night shifts it down, never up: a room that gets louder as the stream goes on
 * is a room that wants attention.
 */
export function bedGain(day: number): number {
  return round3(0.05 * nightFactor(day));
}

export function roomMix(day: number): RoomMix {
  const bed = bedGain(day);
  return {
    bed,
    hum: round3(bed * 0.38),
    breath: round3(bed * 0.85),
    // An event has to stand out of the floor without ever becoming a sound effect: a tenth of a
    // tap is a chair, a quarter is a door slam.
    creak: round3(bed * 1.10),
    city: round3(bed * 1.30 * nightFactor(day)),
  };
}

/** The shape of one breath, as a level and a label — the label is what QA and the doc read. */
export interface BreathPoint {
  readonly level: number;
  readonly kind: 'in' | 'out' | 'rest';
}

// Inhale through the nose is shorter and softer than the exhale; the hold between them is where a
// person is actually silent, and it is most of the cycle. Half-widths are fractions of the cycle.
const INHALE = { centre: 0.16, half: 0.13, amp: 0.42 } as const;
const EXHALE = { centre: 0.52, half: 0.17, amp: 1 } as const;

function bump(phase: number, spec: { centre: number; half: number }): number {
  const raw = phase - spec.centre;
  // The cycle wraps: a breath that straddles the seam must not click.
  const wrapped = raw > 0.5 ? raw - 1 : raw < -0.5 ? raw + 1 : raw;
  if (Math.abs(wrapped) >= spec.half) return 0;
  return 0.5 * (1 + Math.cos((Math.PI * wrapped) / spec.half));
}

/**
 * One cycle of her breathing, 0..1 in and out.
 *
 * `phase` is 0..1 (not seconds) so this stays a pure function of a clock that is easy to fake. The
 * curve is two raised cosines with a real hold in between — a single sine reads as a machine
 * breathing, and flat silence between the lobes is what makes the next inhale an event.
 */
export function breathAt(phase: number): BreathPoint {
  const p = phase - Math.floor(phase);
  const inhale = bump(p, INHALE) * INHALE.amp;
  const exhale = bump(p, EXHALE) * EXHALE.amp;
  if (inhale === 0 && exhale === 0) return { level: 0, kind: 'rest' };
  return exhale >= inhale ? { level: round3(exhale), kind: 'out' } : { level: round3(inhale), kind: 'in' };
}

/**
 * One breath cycle, sampled for the Web Audio curve.
 *
 * The graph plays this array with `setValueCurveAtTime`, so what the test measures is exactly what
 * the speaker plays — not a paraphrase of the envelope. The filter follows the same curve: a nose is
 * duller than a mouth, and the difference is what makes the noise read as air instead of as hiss.
 */
export function breathCycle(steps: number): { level: number; filter: number }[] {
  const out: { level: number; filter: number }[] = [];
  for (let i = 0; i < steps; i += 1) {
    const { level, kind } = breathAt(i / steps);
    out.push({ level, filter: kind === 'in' ? 520 : kind === 'out' ? 760 : 640 });
  }
  return out;
}

/**
 * Dead time between room events, in seconds.
 *
 * Wide on purpose: a creak on a schedule is a metronome, and the whole point is that the player
 * cannot tell whether the chair made that noise because of them or because a body is heavy. The
 * city is more frequent than the chair and even less specific.
 */
export function nextCreakDelay(rng: () => number): number {
  return round3(34 + clamp01(rng()) * 44);
}

export function nextCityDelay(rng: () => number, day = 1): number {
  // Later nights are emptier outside.
  return round3((18 + clamp01(rng()) * 30) / nightFactor(day));
}

/**
 * How far the room drops under her voice, and how it comes back.
 *
 * Speech in a room does not need the room muted — it needs the room to *listen*. Half volume for
 * the first 120 ms, back to full over 900 ms; the shape is a smoothstep so there is no step in the
 * bed, which is the one thing an ear will find in a noise floor.
 */
export const DUCK_DEPTH = 0.5;
export const DUCK_RECOVER_MS = 900;

export function duckGain(msSince: number): number {
  if (msSince <= 0) return DUCK_DEPTH;
  if (msSince >= DUCK_RECOVER_MS) return 1;
  const t = msSince / DUCK_RECOVER_MS;
  return round3(DUCK_DEPTH + (1 - DUCK_DEPTH) * (t * t * (3 - 2 * t)));
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

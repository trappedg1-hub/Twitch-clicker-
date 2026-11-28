/**
 * The camera, which is not the same thing as the room.
 *
 * Everything in the stage is placed in virtual pixels and only ever moves when the *content* moves:
 * a rig animation, the parallax against the pointer, a particle. That covers her and the desk — and
 * it leaves the one thing a live stream always has and a clicker never does: a camera operator. Not
 * a big move; the breath of a tripod, the frame drifting a couple of pixels while someone leans on
 * the desk, and a single push in when something lands.
 *
 * It costs nothing and it changes how the picture reads, because a frame that is perfectly still is
 * the strongest "this is a screenshot" signal in the whole scene — stronger than any single
 * animation. Three rules keep it from becoming a gimmick:
 *
 * 1. **Slow.** The drift is 0.03–0.08 Hz, which is 12–50 seconds per cycle: below the rate at which
 *    the eye starts tracking the motion itself, and above the rate at which the frame looks dead.
 *    Four virtual pixels on a 1376-wide stage is under 0.3 %, i.e. 1.5 px on a phone.
 * 2. **Bounded.** The push (a tap, a donation) is a punch that decays with a spring, capped at
 *    1.8 %. A zoom that stays is a change of framing; a zoom that returns is an event.
 * 3. **Optional.** `prefers-reduced-motion` turns the whole module off and the stage goes back to
 *    the dead-still frame, which is the correct answer for anyone who asked for exactly that.
 *
 * The functions here are pure so the bounds can be tested without a renderer; the stage owns the
 * one number that is not pure (the punch's current value) and feeds it back in every frame.
 */

const TAU = Math.PI * 2;

export const CAMERA = {
  /** Virtual pixels of drift at full deflection. */
  driftX: 3.2,
  driftY: 1.6,
  /**
   * Three incommensurate frequencies. Two would beat against each other in a visible figure-eight
   * every few seconds; three do not repeat inside a stream, which is the point — the frame must
   * never look like it is looping.
   */
  driftHzA: 0.031,
  driftHzB: 0.047,
  driftHzC: 0.083,
  /** A slow breathing push, ~14 per minute: the same rate her chest moves at rest. */
  breathZoom: 0.0016,
  breathHz: 0.235,
  /** One more, very slow zoom cycle, so the breathing is not the only thing changing scale. */
  swellZoom: 0.0011,
  swellHz: 0.019,
  /** Hard cap on how far the frame may ever be pushed, either way. */
  maxPunch: 0.018,
  /** Time constant of the punch's return, in seconds. 0.28 s is gone in about a second. */
  punchTau: 0.28,
  /** How hard each event pushes. A tap is a breath; a donation is a lean. */
  tapPunch: 0.0030,
  teasePunch: 0.0048,
  donationPunch: 0.0110,
  milestonePunch: 0.0090,
} as const;

export interface CameraPose {
  /** Virtual pixels, added to the fitted position. */
  x: number;
  y: number;
  /** Fraction of the fitted scale, added: 0.004 is a 0.4 % push in. */
  zoom: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const PHASE_Y = 0.9;
const PHASE_C_X = 1.7;
const PHASE_C_Y = 0.3;
/** The legs' value at t=0. Subtracted below, so a reload always starts from a still frame. */
const ZERO_X = Math.sin(PHASE_C_X) * 0.38;
const ZERO_Y = Math.sin(PHASE_Y) * 0.68 + Math.cos(PHASE_C_Y) * 0.32;
/**
 * Both legs can peak together, and the constant we subtract moves the centre, so the raw sum can
 * reach `legs + |zero|`. Dividing by that worst case is what makes `driftX` a real budget instead
 * of an average: the frame may pass its nominal amplitude, it may never exceed it.
 */
const NORM_X = 0.62 + 0.38 + Math.abs(ZERO_X);
const NORM_Y = 0.68 + 0.32 + Math.abs(ZERO_Y);

/** The tripod's breath. Zero at t=0 so a reload starts from a still frame. */
export function cameraDrift(tSec: number): { x: number; y: number } {
  if (!Number.isFinite(tSec) || tSec < 0) return { x: 0, y: 0 };
  const x =
    (Math.sin(tSec * CAMERA.driftHzA * TAU) * 0.62 +
      Math.sin(tSec * CAMERA.driftHzC * TAU + PHASE_C_X) * 0.38 -
      ZERO_X) /
    NORM_X *
    CAMERA.driftX;
  const y =
    (Math.sin(tSec * CAMERA.driftHzB * TAU + PHASE_Y) * 0.68 +
      Math.cos(tSec * CAMERA.driftHzC * TAU + PHASE_C_Y) * 0.32 -
      ZERO_Y) /
    NORM_Y *
    CAMERA.driftY;
  return { x, y };
}

/** A new event on top of whatever is still ringing. Capped, so hammering cannot fly the camera. */
export function punchAdd(current: number, amount: number): number {
  if (!Number.isFinite(amount)) return current;
  return clamp(current + amount, -CAMERA.maxPunch, CAMERA.maxPunch);
}

/** Exponential return to rest. `dtSec` is clamped so a stalled tab cannot teleport the frame. */
export function punchDecay(current: number, dtSec: number): number {
  if (!Number.isFinite(current)) return 0;
  const dt = clamp(Number.isFinite(dtSec) ? dtSec : 0, 0, 0.1);
  return current * Math.exp(-dt / CAMERA.punchTau);
}

/**
 * The whole pose for one frame. `reduced` short-circuits to a still frame — that is a promise to
 * the player, not a preference to be blended into.
 */
export function cameraPose(tSec: number, punch: number, reduced = false): CameraPose {
  if (reduced) return { x: 0, y: 0, zoom: 0 };
  const t = Number.isFinite(tSec) && tSec > 0 ? tSec : 0;
  const drift = cameraDrift(t);
  const breath = Math.sin(t * CAMERA.breathHz * TAU);
  const swell = Math.sin(t * CAMERA.swellHz * TAU + 2.1);
  const zoom = CAMERA.breathZoom * breath + CAMERA.swellZoom * swell + (Number.isFinite(punch) ? punch : 0);
  return { x: drift.x, y: drift.y, zoom: clamp(zoom, -CAMERA.maxPunch, CAMERA.maxPunch) };
}

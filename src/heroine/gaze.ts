/**
 * She looks where you point.
 *
 * Everything the rig plays is authored: a twenty-second loop that knows nothing about the player.
 * That is what makes a rig feel like a video of a person rather than a person. This module is the
 * one live channel — the pointer — and it is deliberately the smallest: a critically-damped
 * spring from where her head is pointing to where the cursor is, turned into a few degrees of head,
 * neck and spine, written into the skeleton after the animation has had its say.
 *
 * Why it reads as alive and not as a sticker rotating:
 *
 * 1. **The chain splits the work.** The head takes the whole angle, the neck a third of it, the
 *    spine an eighth — the same 30 % / 11 % overlapping action the idle uses for its glances, so a
 *    live look and an authored glance are the same gesture as far as the eye is concerned.
 * 2. **It lags.** A spring, not a lerp: the head reaches the target a beat after the pointer does.
 *    Eyes lead, the head follows, the hair follows the head (that part is the physics constraint).
 * 3. **It is bounded.** 4.5° of head is 20 px of crown on the plate — enough to read across a
 *    room, small enough that she can never spin her neck off. Values are clamped at the spring, so
 *    a pointer at the edge of the screen cannot push anything further.
 *
 * The write is additive and happens *after* `instance.update(dt)`: OpenBone timelines are
 * absolute, so the next frame rebuilds the animated pose from scratch and the offset never
 * accumulates. Then `updateWorldTransform()` — the runtime caches the bone world matrices, and
 * without it a written rotation is invisible (measured: 0 px vs 33 px for 6°).
 */

export interface GazePoint {
  /** −1 is the left edge of what she can see, +1 the right. */
  x: number;
  /** −1 up, +1 down. */
  y: number;
}

export interface GazeDegrees {
  head: number;
  neck: number;
  spine: number;
  /** Plate pixels: the head dips a little when you point below her eye line. */
  headY: number;
}

/**
 * How much of the turn each joint carries, in degrees at full deflection.
 *
 * The numbers are a budget, not a taste: the angles are additive down the chain, so the crown sees
 * head + neck + spine = 4.3°, which is ~23 px on the plate — the same read as the deepest authored
 * glance in the idle loop, and far below the 3.35°+0.95° of `turn`. A live channel that outruns
 * the authored ones stops reading as "she noticed you" and starts reading as a turret.
 */
export const GAZE_LIMITS = { head: 3.1, neck: 0.9, spine: 0.3, headY: 1.0 } as const;

/** Spring stiffness, 1/s². 90 settles in about 0.3 s — a glance, not a swipe. */
const STIFFNESS = 90;

/**
 * Slightly under critical damping: the head arrives with a hint of overshoot instead of gliding
 * to a halt like a servo. Critical damping is 2·√k; 0.82 of that is the smallest that still
 * cannot ring — measured against the smear limit, not by taste.
 */
const DAMPING_RATIO = 0.82;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export class GazeSpring {
  private x = 0;
  private vx = 0;
  private y = 0;
  private vy = 0;
  private target: GazePoint = { x: 0, y: 0 };

  /** Aim at a point in normalised space; out-of-range values are clamped, never trusted. */
  public aim(x: number, y: number): void {
    this.target = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }

  /** Let go: she looks back to the front. */
  public rest(): void {
    this.target = { x: 0, y: 0 };
  }

  public reset(): void {
    this.x = this.y = this.vx = this.vy = 0;
    this.rest();
  }

  /** Where her head is pointing right now, −1..1. */
  public get position(): GazePoint {
    return { x: this.x, y: this.y };
  }

  /** Is there anything left to move? Lets the caller skip the skeleton write entirely. */
  public get settled(): boolean {
    return (
      Math.abs(this.x) < 1e-4 &&
      Math.abs(this.y) < 1e-4 &&
      Math.abs(this.vx) < 1e-3 &&
      Math.abs(this.vy) < 1e-3 &&
      this.target.x === 0 &&
      this.target.y === 0
    );
  }

  /** Advance the spring. `dt` is capped by the caller; a tab that slept is not a step. */
  public step(dt: number): GazePoint {
    const d = 2 * Math.sqrt(STIFFNESS) * DAMPING_RATIO;
    const n = Math.max(1, Math.min(8, Math.ceil(dt / (1 / 120))));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.vx += (STIFFNESS * (this.target.x - this.x) - d * this.vx) * h;
      this.vy += (STIFFNESS * (this.target.y - this.y) - d * this.vy) * h;
      this.x += this.vx * h;
      this.y += this.vy * h;
    }
    this.x = clamp(this.x, -1.15, 1.15);
    this.y = clamp(this.y, -1.15, 1.15);
    return this.position;
  }
}

/**
 * Where a pointer at normalised `x` sits relative to her face.
 *
 * The stage is wider than her head, so a linear map would make the middle third of the screen
 * dead. A cube root keeps the centre sensitive — she follows small movements near her face — and
 * still saturates smoothly at the edges.
 */
export function aimFromPointer(pointerX: number, pointerY: number): GazePoint {
  const x = clamp(pointerX, -1, 1);
  const y = clamp(pointerY, -1, 1);
  return { x: Math.sign(x) * Math.cbrt(Math.abs(x)), y: clamp(y * 0.6, -1, 1) };
}

/** Split a gaze position into joint angles. */
export function gazeDegrees(point: GazePoint, limits = GAZE_LIMITS): GazeDegrees {
  return {
    head: point.x * limits.head,
    neck: point.x * limits.neck,
    spine: point.x * limits.spine,
    headY: point.y * limits.headY,
  };
}

/** The part of the runtime this module needs. Structural, so tests can pass a plain skeleton. */
export interface GazeSkeleton {
  findBone(ref: string): { rotation: number; y: number } | undefined;
  updateWorldTransform(): void;
}

/**
 * Write the offsets into the skeleton and rebuild the world matrices.
 *
 * Additive on top of the animated pose, and never to the root: the chair she sits on is bound to
 * `root` and must not move when the pointer does.
 */
export function applyGaze(skeleton: GazeSkeleton, degrees: GazeDegrees): boolean {
  const head = skeleton.findBone('bone_head');
  if (!head) return false;
  let moved = false;
  if (degrees.head !== 0) {
    head.rotation += degrees.head;
    moved = true;
  }
  const neck = skeleton.findBone('bone_neck');
  if (neck && degrees.neck !== 0) {
    neck.rotation += degrees.neck;
    moved = true;
  }
  const spine = skeleton.findBone('bone_spine');
  if (spine && degrees.spine !== 0) {
    spine.rotation += degrees.spine;
    moved = true;
  }
  if (degrees.headY !== 0) {
    head.y += degrees.headY;
    moved = true;
  }
  if (moved) skeleton.updateWorldTransform();
  return moved;
}

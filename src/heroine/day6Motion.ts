import type { SubGoalStageIndex } from '../domain/types.ts';

/** A gentle camera-space gesture: plates remain untouched and the mesh is never reshaped. */
export const DAY6_GESTURE_DURATION_MS = 2600;
export const DAY6_GESTURE_COOLDOWN_MS = 8000;
const TAP_WINDOW_MS = 3000;
const REQUIRED_TAPS = 8;

export class Day6Motion {
  private taps: number[] = [];
  private activeMs = 0;
  private cooldownMs = 0;
  private stage: SubGoalStageIndex = 0;
  private active = false;

  public tap(stage: SubGoalStageIndex): boolean {
    if (this.active || this.cooldownMs > 0) return false;
    this.taps.push(0);
    if (this.taps.length < REQUIRED_TAPS) return false;
    this.taps = [];
    this.stage = stage;
    this.activeMs = 0;
    this.active = true;
    return true;
  }

  /** Returns true exactly once, when the gesture finishes. */
  public update(dtMs: number): boolean {
    const dt = Math.max(0, dtMs);
    this.cooldownMs = Math.max(0, this.cooldownMs - dt);
    this.taps = this.taps.map(age => age + dt).filter(age => age <= TAP_WINDOW_MS);
    if (!this.active) return false;
    this.activeMs += dt;
    if (this.activeMs < DAY6_GESTURE_DURATION_MS) return false;
    this.active = false;
    this.activeMs = 0;
    this.cooldownMs = DAY6_GESTURE_COOLDOWN_MS;
    return true;
  }

  public reset(): void {
    this.active = false;
    this.activeMs = 0;
    this.cooldownMs = 0;
    this.taps = [];
  }

  public get isActive(): boolean { return this.active; }
  public get gestureStage(): SubGoalStageIndex { return this.stage; }
  public get progress(): number { return this.active ? Math.min(1, this.activeMs / DAY6_GESTURE_DURATION_MS) : 0; }
  public get intensity(): number {
    if (!this.active) return 0;
    // Smooth approach, long hold, smooth retreat. Repeated taps cannot restart the envelope.
    const t = this.activeMs;
    const smooth = (v: number) => { const x = Math.max(0, Math.min(1, v)); return x*x*(3-2*x); };
    if (t < 650) return smooth(t / 650);
    if (t < 1800) return 1;
    return 1 - smooth((t - 1800) / 800);
  }
}

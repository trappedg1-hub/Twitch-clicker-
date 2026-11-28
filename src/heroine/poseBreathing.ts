import type { SubGoalStageIndex, TapZoneId } from '../domain/types.ts';
import { anatomyFor, POSE_ANATOMY, type MotionRegion } from './poseAnatomy.ts';

// One clock for her chest, shared with the room: `audio/roomPlan.ts` imports this, so the breath
// that is heard is the breath that is seen. Retuning her chest moves both or neither.
export const BREATH_PERIOD_SEC = 3.6;

/** Where in the breath cycle a session clock is, 0..1. The room reads this to stay in phase. */
export function breathPhase(elapsedSec: number): number {
  const p = (elapsedSec / BREATH_PERIOD_SEC) % 1;
  return p < 0 ? p + 1 : p;
}

// A damped oscillator approximates secondary motion, with gentler reactions at the start.
// Repeated taps restart rather than accumulating energy. These are art-directed 2D
// approximations, not an anatomical simulation or separately rigged body parts.
export function tapReactionWave(elapsedMs: number, day = 1): number {
  if (elapsedMs < 0 || elapsedMs >= 800) return 0;
  const intensity = [4.5, 5, 5.4, 5.8, 6.2, 6.4][Math.max(0, Math.min(5, day - 1))]!;
  return Math.sin(Math.PI * elapsedMs / 400) * Math.exp(-elapsedMs / 340) * intensity;
}

// The rear-facing poses breathe in the upper back, not the hip reaction region.
export const BREATH_REGIONS: readonly (readonly MotionRegion[])[] = POSE_ANATOMY.map((poses, day) =>
  poses.map((pose, stage) => day === 4 && stage === 3 ? [490, 650, 85, 70] :
    day === 4 && stage === 4 ? [550, 420, 80, 65] : pose.torso));

function regionOffset([cx,cy,rx,ry]: MotionRegion, x: number, y: number, wave: number) {
  if (!wave) return {x: 0, y: 0};
  const nx=(x-cx)/rx, ny=(y-cy)/ry, d=nx*nx+ny*ny;
  if (d >= 1) return {x: 0,y: 0};
  const weight=(1-d)**2;
  return {x:nx*weight*wave*3,y:-weight*wave*2};
}
export function poseBreathOffset(day: number, stage: SubGoalStageIndex, x: number, y: number, wave: number) {
  return regionOffset((BREATH_REGIONS[day-1] ?? BREATH_REGIONS[0]!)[stage]!, x, y, wave);
}
// The rear-view finale (`t5_s3`, day 5 stage 4) is the one pose in the ride that cannot carry the
// rig: the skeleton template is placed by the eye line, and on a bent-over back view it puts her
// hips 230 px below her hips (see `docs/rig-pilot.md`). She stays a warped plate — but breathing
// alone read as a photo with a pulse. A body leaning over a chair back shifts its weight from one
// elbow to the other, and that is motion the shared plate *can* show: a slow lateral lean of her
// upper back with her hips answering a beat later.
//
// Both ellipses are measured inside her own silhouette on the plate (alpha share 1.00) and stay in
// the chair-free band the runtime's debug heuristic watches (`x` 300..760), so the room keeps its
// promise: only she moves.
const BACK_SWAY: Readonly<Record<string, readonly [MotionRegion, MotionRegion]>> = {
  '5:4': [[655, 395, 100, 120], [520, 620, 95, 90]],
};
// Measured on the runtime's own mesh (24 x 32): gain 1 peaks at 0.8 px, a whisper at the 0.4x the
// plate is drawn at in game; the sitting poses' breath peaks at 1.5 px, so a rear view has to be
// several times that to read as a body rather than a photo. Gain 9 peaks at 7.3 px on the plate —
// 2.9 px on a phone, one slow 7.6 s cycle from shoulder to shoulder. Swept: 14 still reads as a
// lean, 20 starts to slide her hips off the chair.
const BACK_SWAY_GAIN = 9;
// The lean is lateral; the dip is a fraction of it, or she reads as bobbing, not shifting.
const BACK_SWAY_DIP = 0.3;
export function poseBackSwayOffset(day: number, stage: SubGoalStageIndex, x: number, y: number, sway: number) {
  if (!sway) return {x: 0, y: 0};
  const spec = BACK_SWAY[`${day}:${stage}`];
  if (!spec) return {x: 0, y: 0};
  const upper = regionOffset(spec[0], x, y, sway);
  const hips = regionOffset(spec[1], x, y, -sway * 0.6);
  return {
    x: (upper.x + hips.x) * BACK_SWAY_GAIN,
    y: (upper.y * 0.5 + hips.y * 0.4) * BACK_SWAY_GAIN * BACK_SWAY_DIP,
  };
}
export function poseTapOffset(day: number, stage: SubGoalStageIndex, zone: TapZoneId, x: number, y: number, wave: number) {
  const anatomy = anatomyFor(day, stage);
  const isLeg = zone === 'legs' || zone === 'feet';
  // Slightly strengthen only explicit chest taps on front-facing chest regions.
  // Covered torsos, rear views, other tap zones and idle breathing retain their
  // previous amplitudes; this is still a shared-plate warp, not a layered rig.
  const gain = zone === 'chest' && anatomy.torsoKind === 'chest' ? 1.2 : 1;
  return regionOffset(isLeg ? anatomy.leg : anatomy.torso, x, y, wave * gain);
}

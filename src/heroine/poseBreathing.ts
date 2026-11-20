import type { SubGoalStageIndex, TapZoneId } from '../domain/types.ts';
import { anatomyFor, POSE_ANATOMY, type MotionRegion } from './poseAnatomy.ts';

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
export function poseTapOffset(day: number, stage: SubGoalStageIndex, zone: TapZoneId, x: number, y: number, wave: number) {
  const anatomy = anatomyFor(day, stage);
  return regionOffset(zone === 'legs' || zone === 'feet' ? anatomy.leg : anatomy.torso, x, y, wave);
}

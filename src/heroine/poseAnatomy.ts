import type { SubGoalStageIndex } from '../domain/types.ts';

/** Plate-space coordinates, on the final 1024 x 1526 game assets, not the source images.
 * Regions are conservative interiors: the shared plate also includes the chair and props.
 * They describe where the current mesh may deform, not independent cut-out body parts.
 */
export type MotionRegion = readonly [cx: number, cy: number, rx: number, ry: number];
export interface PoseAnatomy {
  readonly torso: MotionRegion;
  readonly leg: MotionRegion;
  readonly torsoKind: 'chest' | 'covered' | 'back' | 'hip';
}
const pose = (torso: MotionRegion, leg: MotionRegion, torsoKind: PoseAnatomy['torsoKind'] = 'chest'): PoseAnatomy => ({torso, leg, torsoKind});
export const POSE_ANATOMY: readonly (readonly PoseAnatomy[])[] = [
  [pose([540,650,115,85],[245,835,65,75], 'covered'),pose([540,650,115,85],[245,835,65,75], 'covered'),pose([540,650,115,85],[245,835,65,75], 'covered'),pose([550,650,115,85],[245,835,65,75]),pose([550,640,115,85],[245,835,65,75])],
  [pose([630,570,65,65],[370,650,55,65], 'covered'),pose([600,560,60,55],[350,650,55,65], 'covered'),pose([550,635,115,80],[420,1100,70,80]),pose([555,650,115,80],[420,1100,70,80]),pose([560,650,100,80],[300,1020,65,80])],
  [pose([510,550,95,85],[410,930,75,75], 'covered'),pose([560,585,90,65],[600,950,80,75]),pose([510,600,100,75],[420,900,70,70]),pose([510,700,95,65],[310,970,55,70]),pose([565,620,100,75],[300,850,65,70])],
  [pose([600,520,100,65],[400,860,90,70]),pose([500,640,105,70],[300,1120,70,65]),pose([510,520,105,70],[300,960,65,75]),pose([445,540,70,55],[420,940,45,70]),pose([510,625,115,70],[230,880,60,70])],
  [pose([550,530,100,65],[400,800,75,70]),pose([530,530,100,65],[470,800,65,70]),pose([520,650,100,70],[300,850,65,70]),pose([455,840,80,55],[440,990,65,70], 'hip'),pose([420,590,80,70],[390,720,60,70], 'hip')],
  [pose([530,545,90,60],[410,865,75,65]),pose([510,555,80,60],[420,750,55,65]),pose([550,575,70,55],[610,1120,70,60], 'covered'),pose([510,555,85,60],[310,1050,70,75]),pose([530,550,80,55],[490,850,65,70])],
];
export function anatomyFor(day: number, stage: SubGoalStageIndex): PoseAnatomy {
  return (POSE_ANATOMY[day - 1] ?? POSE_ANATOMY[0]!)[stage] ?? POSE_ANATOMY[0]![0]!;
}

import type { SubGoalStageIndex } from '../domain/types.ts';

// Interior of the visible torso in plate coordinates, measured for each drawing. Bounds
// deliberately exclude the chair, silhouette and adjacent limbs, including interpolation cells.
export const BREATH_REGIONS: ReadonlyArray<ReadonlyArray<readonly [number, number, number, number]>> = [
  [[500,650,85,90],[500,650,85,90],[500,650,85,90],[500,650,85,90],[500,650,85,90]],
  [[600,560,70,75],[580,540,80,75],[500,620,85,90],[500,620,85,90],[510,590,80,80]],
  [[510,590,80,80],[550,570,70,75],[500,625,80,80],[510,630,80,85],[500,570,80,80]],
  [[530,570,75,80],[500,650,80,85],[510,570,80,80],[500,525,70,75],[510,590,75,80]],
  [[510,580,85,90],[510,560,80,80],[510,550,80,80],[470,580,80,85],[550,475,75,80]],
  [[510,650,80,85],[520,640,80,90],[570,690,85,90],[520,640,85,90],[535,650,85,90]],
];
export function poseBreathOffset(day: number, stage: SubGoalStageIndex, x: number, y: number, wave: number) {
  if (!wave) return {x: 0, y: 0};
  const [cx,cy,rx,ry] = (BREATH_REGIONS[day-1] ?? BREATH_REGIONS[0]!) [stage]!;
  const nx=(x-cx)/rx, ny=(y-cy)/ry, d=nx*nx+ny*ny;
  if (d >= 1) return {x: 0,y: 0};
  const weight=(1-d)**2;
  return {x:nx*weight*wave*3,y:-weight*wave*2};
}

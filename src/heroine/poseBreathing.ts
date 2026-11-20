import type { SubGoalStageIndex, TapZoneId } from '../domain/types.ts';

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
// A brief, damped response. Repeated taps restart it instead of accumulating energy.
// Later days are a little bolder, while the first days remain more restrained.
export function tapReactionWave(elapsedMs: number, day = 1): number {
  if (elapsedMs < 0 || elapsedMs >= 800) return 0;
  const intensity = [4.5, 5, 5.4, 5.8, 6.2, 6.4][Math.max(0, Math.min(5, day - 1))]!;
  return Math.sin(Math.PI * elapsedMs / 400) * Math.exp(-elapsedMs / 340) * intensity;
}

type Region = readonly [number, number, number, number];
function regionOffset([cx,cy,rx,ry]: Region, x: number, y: number, wave: number) {
  if (!wave) return {x: 0, y: 0};
  const nx=(x-cx)/rx, ny=(y-cy)/ry, d=nx*nx+ny*ny;
  if (d >= 1) return {x: 0,y: 0};
  const weight=(1-d)**2;
  return {x:nx*weight*wave*3,y:-weight*wave*2};
}

export function poseBreathOffset(day: number, stage: SubGoalStageIndex, x: number, y: number, wave: number) {
  return regionOffset((BREATH_REGIONS[day-1] ?? BREATH_REGIONS[0]!)[stage]!, x, y, wave);
}

// Only use alternative regions where the anatomy is clear and the surrounding mesh cells
// remain on the body. Other poses use their existing conservative torso region.
export function poseTapOffset(day: number, stage: SubGoalStageIndex, zone: TapZoneId, x: number, y: number, wave: number) {
  let region = (BREATH_REGIONS[day-1] ?? BREATH_REGIONS[0]!)[stage]!;
  if (day === 1 && (zone === 'legs' || zone === 'feet')) region = [350, 820, 65, 60];
  if (day === 5 && stage === 3) region = [455, 840, 80, 55];
  if (day === 5 && stage === 4) region = [420, 590, 80, 70];
  return regionOffset(region, x, y, wave);
}

import type { SubGoalStageIndex } from '../domain/types.ts';

/** Conservative torso-only bounds in plate coordinates. A full mesh cell outside each bound is left
 * untouched, so interpolation cannot move the chair, arms, hat, legs or foreground desk. */
export const DAY6_BREATH_REGIONS: ReadonlyArray<{ cx: number; cy: number; rx: number; ry: number }> = [
  { cx: 520, cy: 640, rx: 80, ry: 90 },
  { cx: 570, cy: 690, rx: 85, ry: 90 },
  { cx: 520, cy: 640, rx: 85, ry: 90 },
  { cx: 535, cy: 650, rx: 85, ry: 90 },
];

/** Displace only the interior of the bodice. Original textures are never resized or edited. */
export function day6BreathOffset(stage: SubGoalStageIndex, x: number, y: number, wave: number): { x: number; y: number } {
  if (wave === 0) return { x: 0, y: 0 };
  const box = DAY6_BREATH_REGIONS[Math.min(stage, 3)]!;
  const nx = (x - box.cx) / box.rx;
  const ny = (y - box.cy) / box.ry;
  const distance = nx * nx + ny * ny;
  if (distance >= 1) return { x: 0, y: 0 };
  const weight = (1 - distance) ** 2;
  return { x: nx * weight * wave * 3, y: -weight * wave * 2 };
}

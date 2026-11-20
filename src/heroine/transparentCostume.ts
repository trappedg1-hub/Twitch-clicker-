import type {
  SubGoalStageIndex,
  TapZoneId,
} from '../domain/types.ts';
import type { PoseAnatomy, MotionRegion } from './poseAnatomy.ts';
import { TRANSPARENT_COSTUME_SUBS } from '../domain/subGoals.ts';

/**
 * TRANSPARENT COSTUME — отдельный костюмный слот, не день.
 *
 * 4 арта в стиле approuved артов игры (черный фон, офисное кресло, длинные
 * черные волосы с челкой, лицо как у Дня 1, премиальный рендер):
 *   s0 (0 сабов)    — старт, сидит в кресле, смущенная улыбка
 *   s1 (1500 сабов) — наряд открыт, смущенное выражение
 *   s2 (4000 сабов) — нога на краю стола, игривое выражение, спинка кресла видна
 *   s3 (8000 сабов) — вид со спины, наклон через спинку кресла, колени разведены
 *
 * Пластины: public/art/heroine_transparent_s0…s3.webp (WEBP, 1024×1526, с альфа-каналом).
 * Не заменяют approuved арты дней 1–6 — подключаются отдельно после утверждения.
 */

/** Анатомия по стадиям, в координатах пластины 1024×1526. */
export const TRANSPARENT_COSTUME_ANATOMY: readonly PoseAnatomy[] = [
  // s0: старт, сидит в кресле, грудь прикрыта тканью
  pose([560, 620, 110, 90], [250, 840, 70, 80], 'covered'),
  // s1: наряд открыт, фронтальный вид, грудь открыта
  pose([560, 590, 115, 85], [250, 860, 70, 80], 'chest'),
  // s2: нога на краю стола, фронтальный вид, грудь открыта
  pose([550, 600, 120, 80], [240, 880, 75, 75], 'chest'),
  // s3: вид со спины, torsoKind = 'back'
  pose([540, 520, 110, 70], [260, 900, 70, 70], 'back'),
] as const;

/** Дыхательные регионы по стадиям. Дыхание есть на всех артах, кресло не движется. */
export const TRANSPARENT_COSTUME_BREATH: readonly MotionRegion[] = [
  [560, 620, 100, 70], // s0
  [560, 590, 105, 75], // s1
  [550, 600, 110, 70], // s2
  [490, 650, 85, 70],  // s3: вид со спины — дышит верхней частью спины
] as const;

function pose(
  torso: MotionRegion,
  leg: MotionRegion,
  torsoKind: PoseAnatomy['torsoKind'] = 'chest',
): PoseAnatomy {
  return { torso, leg, torsoKind };
}

/** Якоря лица для пластин костюма (в пикселях 1024×1526). */
export const TRANSPARENT_COSTUME_FACE_ANCHORS: Record<string, { x: number; y: number; w: number; h: number }> = {
  'heroine_transparent_s0.webp': { x: 338, y: 61, w: 348, h: 397 },
  'heroine_transparent_s1.webp': { x: 340, y: 70, w: 340, h: 380 },
  'heroine_transparent_s2.webp': { x: 330, y: 65, w: 360, h: 390 },
  'heroine_transparent_s3.webp': { x: 320, y: 80, w: 380, h: 360 },
};

/** Пластины, на которых лицо прикрыто поворотом — патч эмоций не накладывать. */
export const TRANSPARENT_COSTUME_FACE_PATCH_COVERED: ReadonlySet<string> = new Set([
  'heroine_transparent_s3.webp', // вид через плечо
]);

function regionOffset(
  [cx, cy, rx, ry]: MotionRegion,
  x: number,
  y: number,
  wave: number,
): { x: number; y: number } {
  if (!wave) return { x: 0, y: 0 };
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  const d = nx * nx + ny * ny;
  if (d >= 1) return { x: 0, y: 0 };
  const weight = (1 - d) ** 2;
  return { x: nx * weight * wave * 3, y: -weight * wave * 2 };
}

/** Смещение вершины mesh при тапе: грудь +20% только на front-facing открытых зонах. */
export function transparentCostumeTapOffset(
  stage: SubGoalStageIndex,
  zone: TapZoneId,
  x: number,
  y: number,
  wave: number,
): { x: number; y: number } {
  const anatomy = TRANSPARENT_COSTUME_ANATOMY[stage]!;
  const isLeg = zone === 'legs' || zone === 'feet';
  const gain = zone === 'chest' && anatomy.torsoKind === 'chest' ? 1.2 : 1;
  return regionOffset(isLeg ? anatomy.leg : anatomy.torso, x, y, wave * gain);
}

/** Смещение при дыхании: torso-регион, кресло не движется. */
export function transparentCostumeBreathOffset(
  stage: SubGoalStageIndex,
  x: number,
  y: number,
  wave: number,
): { x: number; y: number } {
  return regionOffset(TRANSPARENT_COSTUME_BREATH[stage]!, x, y, wave);
}

export function transparentCostumeStageForSubs(subs: number): SubGoalStageIndex {
  let result: SubGoalStageIndex = 0;
  for (let i = 0; i < TRANSPARENT_COSTUME_SUBS.length; i++) {
    if (subs >= TRANSPARENT_COSTUME_SUBS[i]!) result = i as SubGoalStageIndex;
  }
  return result;
}

export function transparentCostumePlateUrl(stage: SubGoalStageIndex): string {
  return `/art/heroine_transparent_s${stage}.webp`;
}

export function transparentCostumeAnatomy(stage: SubGoalStageIndex): PoseAnatomy {
  return TRANSPARENT_COSTUME_ANATOMY[stage]!;
}

export function transparentCostumeBreathRegion(stage: SubGoalStageIndex): MotionRegion {
  return TRANSPARENT_COSTUME_BREATH[stage]!;
}

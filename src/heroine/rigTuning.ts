/**
 * Live tuning of the rig's physics, as plain data.
 *
 * The three constraints (hair, bust, chest) are the only numbers in the whole heroine that are
 * genuinely a matter of taste: `docs/rig-pilot.md` has the values, and until now finding better
 * ones meant editing Python, rebuilding 22 documents, republishing and reloading. This module is
 * the part of the admin panel that makes that a slider — it holds the schema, the clamping and the
 * report format, with no DOM and no Pixi, so it can be tested and read on its own.
 *
 * Nothing here touches the game: a tuned value lives in the runtime's `constraintValues` and dies
 * with the page. Getting it into the shipped rigs is still `scripts/build_miya_rig.py` — hence
 * `formatTuningReport`, which prints exactly the values to paste there.
 */

/** Constraint parameters worth a slider. The rest (`fps`, `volume`, geometry) are build decisions. */
export type TuningKey = 'inertia' | 'strength' | 'damping' | 'mix' | 'gravity';

export interface TuningParam {
  key: TuningKey;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Decimals the UI shows; also the precision two values must agree to before they "differ". */
  digits: number;
}

/**
 * Ranges are generous on purpose — they are the range where the integrator stays stable and the
 * hair stays hair, not the range we like. A slider that cannot make things visibly worse cannot
 * help you find the better value.
 */
export const TUNING_PARAMS: readonly TuningParam[] = [
  { key: 'inertia', label: 'инерция', min: 0, max: 1, step: 0.01, digits: 2 },
  { key: 'strength', label: 'жёсткость', min: 0, max: 500, step: 1, digits: 0 },
  { key: 'damping', label: 'затухание', min: 0, max: 12, step: 0.1, digits: 1 },
  { key: 'mix', label: 'амплитуда', min: 0, max: 1, step: 0.01, digits: 2 },
  { key: 'gravity', label: 'гравитация', min: -40, max: 40, step: 1, digits: 0 },
];

export const CONSTRAINT_LABELS: Record<string, string> = {
  phys_hair: 'волосы',
  phys_bust: 'грудь',
  phys_chest: 'корпус',
};

/** «волосы» instead of `phys_hair` — the panel is read at a glance, in Russian, like the game. */
export function constraintLabel(id: string): string {
  return CONSTRAINT_LABELS[id] ?? id.replace(/^phys_/, '');
}

export type ConstraintTuning = Partial<Record<TuningKey, number>>;
export type RigTuning = Record<string, ConstraintTuning>;

const param = (key: TuningKey): TuningParam => TUNING_PARAMS.find((p) => p.key === key)!;

/** Snap to the slider's step, then clamp: the same value the input would have produced. */
export function clampParam(key: TuningKey, value: number): number {
  const p = param(key);
  if (!Number.isFinite(value)) return p.min;
  const snapped = Math.round(value / p.step) * p.step;
  const clamped = Math.min(p.max, Math.max(p.min, snapped));
  // 0.1 * 3 is 0.30000000000000004; the panel must not show it.
  return Number(clamped.toFixed(p.digits + 2));
}

/** Round to what the UI displays — the precision at which two tunes count as "the same". */
export function displayValue(key: TuningKey, value: number): number {
  return Number(value.toFixed(param(key).digits));
}

/**
 * Accept anything (localStorage from an older build, a hand-pasted object) and return a tune that
 * is safe to apply: known constraints, known keys, clamped numbers. Unknown keys are dropped
 * rather than trusted — this is the only gate between storage and the renderer.
 */
export function clampTuning(raw: unknown): RigTuning {
  if (!raw || typeof raw !== 'object') return {};
  const out: RigTuning = {};
  for (const [id, values] of Object.entries(raw as Record<string, unknown>)) {
    if (!id.startsWith('phys_') || !values || typeof values !== 'object') continue;
    const kept: ConstraintTuning = {};
    for (const p of TUNING_PARAMS) {
      const v = (values as Record<string, unknown>)[p.key];
      if (typeof v === 'number') kept[p.key] = clampParam(p.key, v);
    }
    if (Object.keys(kept).length > 0) out[id] = kept;
  }
  return out;
}

/** Deep merge, patch wins. Used to apply one slider without sending the whole map. */
export function mergeTuning(base: RigTuning, patch: RigTuning): RigTuning {
  const out: RigTuning = {};
  for (const [id, values] of Object.entries(base)) out[id] = { ...values };
  for (const [id, values] of Object.entries(patch)) out[id] = { ...out[id], ...values };
  return out;
}

export interface TuningChange {
  id: string;
  label: string;
  key: TuningKey;
  keyLabel: string;
  from: number;
  to: number;
}

/**
 * What the panel actually moved, in display precision. The panel calls this on every render, so it
 * must not report a change for a value that merely round-trips through a float.
 */
export function diffTuning(current: RigTuning, doc: RigTuning): TuningChange[] {
  const changes: TuningChange[] = [];
  for (const [id, values] of Object.entries(current)) {
    for (const p of TUNING_PARAMS) {
      const to = values[p.key];
      const from = doc[id]?.[p.key];
      if (to === undefined || from === undefined) continue;
      if (displayValue(p.key, to) !== displayValue(p.key, from)) {
        changes.push({ id, label: constraintLabel(id), key: p.key, keyLabel: p.label, from, to });
      }
    }
  }
  return changes;
}

/**
 * The tune as lines to paste into `scripts/build_miya_rig.py`, preceded by a comment listing what
 * differs from the document. Without the comment the report is unreadable after a reload — you
 * cannot tell a lucky slider from the shipped value.
 */
export function formatTuningReport(current: RigTuning, doc: RigTuning): string {
  const changes = diffTuning(current, doc);
  const header =
    changes.length === 0
      ? '# тюнинг совпадает с документом'
      : `# изменено: ${changes
          .map((c) => `${c.id}.${c.key} ${displayValue(c.key, c.from)} → ${displayValue(c.key, c.to)}`)
          .join(' · ')}`;
  const lines = Object.entries(current).map(([id, values]) => {
    const pairs = TUNING_PARAMS.filter((p) => values[p.key] !== undefined).map(
      (p) => `${p.key}=${displayValue(p.key, values[p.key]!)}`,
    );
    return `${id}: ${pairs.join(' ')}`;
  });
  return [header, ...lines].join('\n');
}

/** Storage round-trip: a broken or foreign payload is simply "no tune", never a thrown error. */
export function parseStoredTuning(raw: string | null): RigTuning {
  if (!raw) return {};
  try {
    return clampTuning(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

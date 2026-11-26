import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TUNING_PARAMS,
  clampParam,
  clampTuning,
  constraintLabel,
  diffTuning,
  displayValue,
  formatTuningReport,
  mergeTuning,
  parseStoredTuning,
  type RigTuning,
} from '../src/heroine/rigTuning.ts';

/**
 * The admin console's sliders, as maths. These are the only values a person types into the game at
 * runtime, so the clamping and the diff rules get the same treatment as the rig documents: the panel
 * must never show a number the build script would reject, and must never claim a change it did not
 * make.
 */

const DOC: RigTuning = {
  phys_hair: { inertia: 0.72, strength: 95, damping: 4.5, mix: 0.72, gravity: 12 },
  phys_bust: { inertia: 0.86, strength: 115, damping: 4.2, mix: 0.85, gravity: 0 },
};

test('sliders snap to their step and never leave their range', () => {
  assert.equal(clampParam('inertia', 0.723), 0.72);
  assert.equal(clampParam('inertia', 9), 1);
  assert.equal(clampParam('inertia', -9), 0);
  assert.equal(clampParam('strength', 1000), 500);
  assert.equal(clampParam('damping', 4.26), 4.3);
  assert.equal(clampParam('gravity', -100), -40);
  // 0.1 * 3 must not reach the UI as 0.30000000000000004
  assert.equal(clampParam('damping', 0.1 * 3), 0.3);
  assert.equal(clampParam('mix', Number.NaN), 0);
});

test('a stored tune is trusted only as far as it is known', () => {
  const parsed = parseStoredTuning(
    JSON.stringify({
      phys_hair: { inertia: 0.4, strength: 900, nonsense: 5 },
      phys_bust: 'broken',
      phys_legs: { mix: 0.2 },
      other: { mix: 0.2 },
    }),
  );
  assert.deepEqual(parsed, {
    phys_hair: { inertia: 0.4, strength: 500 },
    phys_legs: { mix: 0.2 },
  });
  assert.deepEqual(parseStoredTuning('{not json'), {});
  assert.deepEqual(parseStoredTuning(null), {});
  assert.deepEqual(clampTuning(42), {});
});

test('merge patches one slider without dropping the rest', () => {
  const merged = mergeTuning(DOC, { phys_hair: { inertia: 0.9 } });
  assert.equal(merged.phys_hair?.inertia, 0.9);
  assert.equal(merged.phys_hair?.strength, 95);
  assert.equal(merged.phys_bust?.mix, 0.85);
  // the base is not mutated: the panel keeps it as the "document" reference
  assert.equal(DOC.phys_hair?.inertia, 0.72);
});

test('the diff speaks display precision, so a float round-trip is not a change', () => {
  assert.equal(diffTuning(DOC, DOC).length, 0);
  const nudged: RigTuning = { ...DOC, phys_hair: { ...DOC.phys_hair!, inertia: 0.7200001 } };
  assert.equal(diffTuning(nudged, DOC).length, 0, 'noise below the shown precision is not a change');

  const changed = diffTuning({ ...DOC, phys_bust: { ...DOC.phys_bust!, mix: 0.4 } }, DOC);
  assert.equal(changed.length, 1);
  assert.deepEqual(changed[0], {
    id: 'phys_bust',
    label: 'грудь',
    key: 'mix',
    keyLabel: 'амплитуда',
    from: 0.85,
    to: 0.4,
  });
  assert.equal(constraintLabel('phys_hair'), 'волосы');
  assert.equal(constraintLabel('phys_unknown'), 'unknown');
});

test('the report is paste-ready and says what it changed', () => {
  const report = formatTuningReport({ ...DOC, phys_hair: { ...DOC.phys_hair!, inertia: 0.9 } }, DOC);
  const lines = report.split('\n');
  assert.equal(lines[0], '# изменено: phys_hair.inertia 0.72 → 0.9');
  assert.equal(lines[1], 'phys_hair: inertia=0.9 strength=95 damping=4.5 mix=0.72 gravity=12');
  assert.equal(lines[2], 'phys_bust: inertia=0.86 strength=115 damping=4.2 mix=0.85 gravity=0');
  assert.match(formatTuningReport(DOC, DOC), /^# тюнинг совпадает с документом/);
});

test('every slider shows a value the document format accepts', () => {
  for (const p of TUNING_PARAMS) {
    const mid = (p.min + p.max) / 2;
    assert.ok(Number.isFinite(displayValue(p.key, mid)));
    assert.equal(displayValue(p.key, clampParam(p.key, mid)), displayValue(p.key, mid));
    assert.ok(p.min < p.max && p.step > 0, `${p.key} has a usable range`);
  }
});

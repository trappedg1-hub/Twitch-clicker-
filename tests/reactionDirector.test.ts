import assert from 'node:assert/strict';
import test from 'node:test';

import { BEAT_MS, IDLE_BEATS, pickBeat, type BeatName } from '../src/heroine/reactionDirector.ts';

const ALL: BeatName[] = [
  'tap',
  'gasp',
  'tease',
  'tickle',
  'giggle',
  'arch',
  'shy_tuck',
  'shiver',
  'settle',
  'lean_in',
  'hair_flip',
  'turn',
];
const available = new Set<string>(ALL);

/** Deterministic rolls, so a weight change is a failing test instead of a feeling. */
const seeded = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const tally = (zone: Parameters<typeof pickBeat>[0]['zone'], boldness: number, rolls = 400) => {
  const counts = new Map<string, number>();
  for (let i = 0; i < rolls; i += 1) {
    const beat = pickBeat({
      zone,
      boldness,
      hype: 50,
      streak: 1,
      available,
      random: seeded(i * 7919 + 13),
    });
    counts.set(beat.anim, (counts.get(beat.anim) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
  return { counts, top: best[0], share: best[1] / rolls };
};

test('feet are ticklish where the art has socks, and nod where it does not', () => {
  for (let i = 0; i < 20; i += 1) {
    const beat = pickBeat({ zone: 'feet', boldness: 50, hype: 0, streak: 1, available, random: seeded(i) });
    assert.equal(beat.anim, 'tickle');
  }
  const bare = new Set<string>(['tap', 'gasp', 'giggle']);
  const beat = pickBeat({ zone: 'feet', boldness: 90, hype: 90, streak: 1, available: bare, random: seeded(1) });
  assert.equal(beat.anim, 'tap', 'a plate with no toes must still answer the tap');
});

test('boldness changes what a poke on the face means', () => {
  const shy = tally('head', 18);
  const bold = tally('head', 78);
  assert.equal(shy.top, 'shy_tuck', `at boldness 18 the face answers ${JSON.stringify([...shy.counts])}`);
  assert.ok(shy.share > 0.5, `shy share ${shy.share.toFixed(2)}`);
  assert.equal(bold.top, 'tease', `at boldness 78 the face answers ${JSON.stringify([...bold.counts])}`);
  assert.ok(bold.share > 0.4, `bold share ${bold.share.toFixed(2)}`);
  // The two moods must not be able to look the same: the shy beat is *never* picked when bold.
  assert.equal(bold.counts.get('shy_tuck') ?? 0, 0);
});

test('a bold chest tap is a performance, a shy one is a shock', () => {
  const shy = tally('chest', 20);
  const bold = tally('chest', 80);
  assert.equal(shy.top, 'gasp');
  assert.equal(shy.counts.get('arch') ?? 0, 0, 'no arch before she is bold enough to arch');
  assert.ok((bold.counts.get('arch') ?? 0) > 0, 'a bold chest tap must reach arch');
  assert.ok((bold.counts.get('tease') ?? 0) > 0, 'a bold chest tap must reach the tongue');
});

test('hammering her gets a shake, not a nod', () => {
  const seen = new Set<string>();
  // One generator across the run, not one per roll: an LCG seeded with 0 stays at 0 forever, and a
  // degenerate roll sequence is exactly the kind of test that passes for the wrong reason.
  const random = seeded(20260101);
  for (let i = 0; i < 60; i += 1) {
    const beat = pickBeat({ zone: 'head', boldness: 70, hype: 90, streak: 9, available, random });
    seen.add(beat.anim);
  }
  assert.deepEqual([...seen].sort(), ['giggle', 'shiver']);
  // Seven taps is not hammering: the normal head table still applies.
  const normal = pickBeat({ zone: 'head', boldness: 70, hype: 90, streak: 7, available, random: seeded(3) });
  assert.ok(['tease', 'giggle', 'hair_flip'].includes(normal.anim), normal.anim);
});

test('a beat the plate does not have is never chosen, and every tap is answered', () => {
  const zones = ['head', 'chest', 'belly', 'legs', 'feet'] as const;
  const thin = new Set<string>(['tap']);
  for (const zone of zones) {
    for (let boldness = 0; boldness <= 100; boldness += 10) {
      for (let streak = 1; streak <= 12; streak += 1) {
        for (let i = 0; i < 12; i += 1) {
          const beat = pickBeat({
            zone,
            boldness,
            hype: (i * 13) % 100,
            streak,
            available: thin,
            random: seeded(i * 31 + boldness + streak),
          });
          assert.equal(beat.anim, 'tap', `${zone}/${boldness}/${streak}: ${beat.anim} on a plate with only tap`);
          assert.ok(beat.ms >= 400 && beat.ms <= 3000, `${beat.anim} holds her for ${beat.ms} ms`);
        }
      }
    }
  }
  // And with everything available, the choice is always something the set actually contains.
  for (const zone of zones) {
    for (let i = 0; i < 50; i += 1) {
      const beat = pickBeat({ zone, boldness: i * 2, hype: i * 2, streak: 1 + (i % 11), available, random: seeded(i) });
      assert.ok(available.has(beat.anim), `${zone}: ${beat.anim} is not in the document`);
      assert.equal(beat.ms, BEAT_MS[beat.anim]);
    }
  }
});

test('the idle vocabulary is made of real beats', () => {
  for (const beat of IDLE_BEATS) {
    assert.ok(BEAT_MS[beat] !== undefined, `idle beat '${beat}' has no duration`);
  }
  assert.ok(IDLE_BEATS.includes('turn'), 'looking around must stay in the pool: it is on every plate');
});

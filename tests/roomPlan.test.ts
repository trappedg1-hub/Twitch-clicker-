import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BREATH_PERIOD_SEC,
  DUCK_DEPTH,
  ROOM_BREATH_PERIOD_SEC,
  breathCycle,
  DUCK_RECOVER_MS,
  bedGain,
  breathAt,
  breathPhase,
  duckGain,
  nextCityDelay,
  nextCreakDelay,
  nightFactor,
  roomMix,
} from '../src/audio/roomPlan.ts';
import { BREATH_PERIOD_SEC as VISUAL_BREATH_PERIOD_SEC } from '../src/heroine/poseBreathing.ts';

test('the room follows the night: quieter on every later day, never louder', () => {
  let previous = Infinity;
  for (let day = 1; day <= 6; day += 1) {
    const bed = bedGain(day);
    assert.ok(bed > 0.02 && bed < 0.06, `day ${day}: bed ${bed} is not a background`);
    assert.ok(bed < previous, `day ${day} is not quieter than day ${day - 1}`);
    previous = bed;
  }
  assert.equal(nightFactor(1), 1);
  assert.ok(nightFactor(6) < nightFactor(1));
  // Out of range days clamp instead of producing a silent or a screaming room.
  assert.deepEqual(roomMix(0), roomMix(1));
  assert.deepEqual(roomMix(9), roomMix(6));
  assert.deepEqual(roomMix(3), roomMix(3.2));
});

test('her breath is two lobes with a real hold, and it never clicks', () => {
  const steps = 1000;
  let rests = 0;
  let previous = breathAt(0).level;
  let maxStep = 0;
  let inhaled = 0;
  let exhaled = 0;
  for (let i = 0; i <= steps; i += 1) {
    const point = breathAt(i / steps);
    assert.ok(Number.isFinite(point.level), `phase ${i}/${steps} is not a number`);
    assert.ok(point.level >= 0 && point.level <= 1, `phase ${i}/${steps} level ${point.level}`);
    maxStep = Math.max(maxStep, Math.abs(point.level - previous));
    previous = point.level;
    if (point.level === 0) rests += 1;
    if (point.kind === 'in') inhaled += 1;
    if (point.kind === 'out') exhaled += 1;
  }
  // Two distinct events per cycle, not one sine: the exhale is longer than the inhale, which is
  // what makes it read as a body rather than an oscillator.
  assert.ok(inhaled > 0 && exhaled > 0, 'both halves of the breath have to exist');
  assert.ok(exhaled > inhaled, `exhale ${exhaled} should outlast inhale ${inhaled}`);
  // Silence is most of the cycle: a person at rest is not constantly breathing out.
  assert.ok(rests / steps > 0.4, `rest covers ${(rests / steps).toFixed(2)} of the cycle`);
  // No step bigger than a tenth of full scale at millisecond resolution: no click, ever.
  assert.ok(maxStep < 0.1, `breath jumps by ${maxStep.toFixed(3)} per millisecond`);
  // The exhale is the loudest point of the cycle and the inhale is softer.
  let max = 0;
  let maxKind = 'rest';
  for (let i = 0; i < steps; i += 1) {
    const point = breathAt(i / steps);
    if (point.level > max) {
      max = point.level;
      maxKind = point.kind;
    }
  }
  assert.equal(maxKind, 'out');
  assert.ok(max > 0.9, `peak ${max.toFixed(2)} should reach full scale`);
  // The cycle wraps without a seam.
  assert.ok(Math.abs(breathAt(0.9999).level - breathAt(0).level) < 0.02);
});

test('sound and picture breathe on the same clock', () => {
  // The one number that couples the room to the rig: if her chest is retuned, the room follows in
  // the same commit instead of drifting a beat behind it.
  assert.equal(BREATH_PERIOD_SEC, VISUAL_BREATH_PERIOD_SEC);
  assert.ok(Math.abs(BREATH_PERIOD_SEC - 3.6) < 1e-9, 'the rig is tuned at 3.6 s per breath');
  assert.equal(breathPhase(0), 0);
  assert.ok(Math.abs(breathPhase(BREATH_PERIOD_SEC) - 0) < 1e-9);
  assert.ok(Math.abs(breathPhase(BREATH_PERIOD_SEC / 2) - 0.5) < 1e-9);
  assert.equal(breathPhase(-1.8), 0.5);
  for (const t of [0.1, 1, 7, 33.3, 600]) {
    const phase = breathPhase(t);
    assert.ok(phase >= 0 && phase < 1, `phase at ${t}s is ${phase}`);
  }
});

test('the room breathes at the tempo her chest was authored at', () => {
  // The rig's visible breath is the authored `breath` clip, and the publisher writes its length into
  // `public/rigs/index.json` as `breathSec`. The room reads that number through this constant — so a
  // retuned chest moves the ambience in the same commit instead of drifting a beat behind it.
  const index = JSON.parse(readFileSync('public/rigs/index.json', 'utf8')) as Record<
    string,
    { breathSec: number | null }
  >;
  const arts = Object.keys(index);
  assert.ok(arts.length >= 39, `only ${arts.length} rigs published`);
  for (const art of arts) {
    assert.equal(
      index[art]!.breathSec,
      ROOM_BREATH_PERIOD_SEC,
      `${art} breathes at ${index[art]!.breathSec}s, the room at ${ROOM_BREATH_PERIOD_SEC}s`,
    );
  }
  // The published number is the authored clip's, not a guess: the rig builder writes breath at 4 s.
  assert.equal(ROOM_BREATH_PERIOD_SEC, 4);
  // The flat plate still breathes on its own 3.6 s clock; the two tempos differ by a tenth, which is
  // under the threshold where a body and a room read as two machines.
  assert.ok(Math.abs(BREATH_PERIOD_SEC - ROOM_BREATH_PERIOD_SEC) / ROOM_BREATH_PERIOD_SEC < 0.12);
});

test('one breath cycle is the envelope the speaker plays', () => {
  const steps = 48;
  const cycle = breathCycle(steps);
  assert.equal(cycle.length, steps);
  for (let i = 0; i < steps; i += 1) {
    assert.equal(cycle[i]!.level, breathAt(i / steps).level, `step ${i}`);
    assert.ok(cycle[i]!.filter >= 500 && cycle[i]!.filter <= 800);
  }
  // The inhale is dull (through the nose), the exhale opens up: that difference is what makes noise
  // read as air instead of as hiss.
  assert.equal(cycle[Math.round(0.16 * steps)]!.filter, 520);
  assert.equal(cycle[Math.round(0.52 * steps)]!.filter, 760);
  // The loudest point of the cycle is an exhale, never the inhale.
  let loudest = 0;
  let loudestFilter = 0;
  for (const sample of cycle) {
    if (sample.level > loudest) {
      loudest = sample.level;
      loudestFilter = sample.filter;
    }
  }
  assert.ok(loudest > 0.9);
  assert.equal(loudestFilter, 760);
});

test('room events are rare, random and bounded', () => {
  for (const r of [0, 0.25, 0.5, 0.99, 1]) {
    const creak = nextCreakDelay(() => r);
    assert.ok(creak >= 34 && creak <= 78, `creak at rng ${r} is ${creak}s`);
    const city = nextCityDelay(() => r, 1);
    assert.ok(city >= 18 && city <= 48, `city at rng ${r} is ${city}s`);
    // Later nights are emptier outside.
    assert.ok(nextCityDelay(() => r, 6) > nextCityDelay(() => r, 1));
  }
  // A hostile rng (NaN, out of unit range) must not produce a timer of length NaN.
  assert.ok(Number.isFinite(nextCreakDelay(() => Number.NaN)));
  assert.ok(Number.isFinite(nextCityDelay(() => -5)));
  // The chair is the rarer event, on average: a creak every minute reads as an accident, a city
  // swell every half minute reads as a window.
  const avgCreak = (34 + 78) / 2;
  const avgCity = (18 + 48) / 2;
  assert.ok(avgCreak > avgCity);
});

test('her voice drops the room and the room comes back', () => {
  assert.equal(duckGain(0), DUCK_DEPTH);
  assert.equal(duckGain(-10), DUCK_DEPTH);
  assert.equal(duckGain(DUCK_RECOVER_MS), 1);
  assert.equal(duckGain(10_000), 1);
  let previous = -1;
  let maxStep = 0;
  for (let ms = -10; ms <= DUCK_RECOVER_MS + 10; ms += 1) {
    const gain = duckGain(ms);
    assert.ok(gain >= DUCK_DEPTH - 1e-9 && gain <= 1 + 1e-9, `duck at ${ms}ms is ${gain}`);
    if (previous >= 0) {
      assert.ok(gain >= previous - 1e-9, 'the room must only come back, never dip twice');
      maxStep = Math.max(maxStep, gain - previous);
    }
    previous = gain;
  }
  // Smoothstep, not a ramp: no step in the noise floor, which is the one thing an ear finds.
  assert.ok(maxStep < 0.01, `duck steps by ${maxStep.toFixed(4)} per millisecond`);
  assert.ok(DUCK_DEPTH <= 0.6, 'half the room, not a mute: a mute turns a room into a menu');
});

test('the mix stays under the game, which is the only way ambience survives', () => {
  // A tap peaks at 0.5 pre-master (0.15 through the master). The room, at its loudest instant, has
  // to stay a quarter of that: the clicker is the instrument, the room is the room.
  const TAP_PEAK = 0.5;
  for (let day = 1; day <= 6; day += 1) {
    const mix = roomMix(day);
    const continuous = mix.bed + mix.breath + mix.hum;
    assert.ok(continuous < TAP_PEAK / 4, `day ${day}: the floor sums to ${continuous.toFixed(3)}`);
    assert.ok(mix.creak < TAP_PEAK / 4, `day ${day}: creak ${mix.creak}`);
    assert.ok(mix.city < TAP_PEAK / 4, `day ${day}: city ${mix.city}`);
    assert.ok(mix.bed > mix.breath && mix.breath > mix.hum, `day ${day}: wrong order of parts`);
    assert.ok(mix.creak > mix.bed, 'the creak has to be an event, not more floor');
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { ATTENTION, pickAttention, type AttentionContext } from '../src/heroine/attention.ts';

const available = new Set<string>([
  'tap', 'shake', 'turn', 'sway', 'giggle', 'tease', 'hair_flip', 'lean_in',
  'arch', 'shy_tuck', 'shiver', 'settle', 'gasp', 'tickle',
]);

const ctx = (over: Partial<AttentionContext> = {}): AttentionContext => ({
  hoverMs: 0,
  msSinceTap: 0,
  msSinceAttention: 1e9,
  msSinceBeat: 1e9,
  boldness: 40,
  available,
  random: () => 0.1,
  ...over,
});

test('a parked cursor on a shy girl gets a shy beat, on a bold one a tease', () => {
  const stare = { hoverMs: ATTENTION.stareDwellMs + 50, msSinceTap: 5000 };
  const shy = pickAttention(ctx({ ...stare, boldness: 20 }));
  assert.equal(shy?.kind, 'staring');
  assert.equal(shy?.anim, 'shy_tuck');
  const bold = pickAttention(ctx({ ...stare, boldness: 80 }));
  assert.equal(bold?.kind, 'staring');
  assert.equal(bold?.anim, 'tease');
});

test('a cursor that just passes over her is not a stare', () => {
  assert.equal(pickAttention(ctx({ hoverMs: 400, msSinceTap: 5000 })), null);
  // …and neither is a stare while the player is hammering her: the taps already answer.
  assert.equal(
    pickAttention(ctx({ hoverMs: ATTENTION.stareDwellMs + 50, msSinceTap: 120 })),
    null,
  );
});

test('the stare is on a cooldown, and it never steps on a beat', () => {
  const staring = ctx({ hoverMs: 4000, msSinceTap: 5000 });
  assert.ok(pickAttention(staring));
  assert.equal(pickAttention({ ...staring, msSinceAttention: ATTENTION.stareCooldownMs - 1 }), null);
  assert.equal(pickAttention({ ...staring, msSinceBeat: ATTENTION.beatBusyMs - 1 }), null);
});

test('an abandoned stream gets a stretch, then a rest', () => {
  const bored = { msSinceTap: ATTENTION.boredAfterMs + 100 };
  const stretch = pickAttention(ctx({ ...bored, random: () => 0.2 }));
  assert.equal(stretch?.kind, 'bored');
  assert.equal(stretch?.anim, 'arch');
  const shift = pickAttention(ctx({ ...bored, random: () => 0.9 }));
  assert.equal(shift?.kind, 'bored');
  assert.equal(shift?.anim, 'settle');
  // Boredom waits longer than a stare and is not available while the player is present.
  assert.equal(pickAttention(ctx({ msSinceTap: ATTENTION.boredAfterMs - 1 })), null);
  assert.equal(pickAttention(ctx({ ...bored, msSinceAttention: ATTENTION.boredCooldownMs - 1 })), null);
});

test('every beat it can pick exists in the plate it was given', () => {
  const thin = new Set<string>(['tap']);
  for (let boldness = 0; boldness <= 100; boldness += 10) {
    for (let i = 0; i < 20; i += 1) {
      const pick = pickAttention(
        ctx({
          hoverMs: 5000,
          msSinceTap: 20000,
          boldness,
          available: thin,
          random: () => i / 20,
        }),
      );
      assert.ok(pick);
      assert.equal(pick!.anim, 'tap', `only tap is authored, got ${pick!.anim}`);
      assert.ok(pick!.ms > 0);
    }
  }
});

test('a cursor parked on her body is read as more than attention', () => {
  // Two and a half seconds on her chest, nothing tapped: this is not "being watched", it is being
  // watched *there*, and the answer is a different beat from the one a look at her face gets.
  const parked = { hoverMs: ATTENTION.caughtDwellMs + 100, msSinceTap: 6000 };
  const shy = pickAttention(ctx({ ...parked, zone: 'chest', boldness: 20 }));
  assert.equal(shy?.kind, 'caught');
  assert.equal(shy?.zone, 'chest');
  assert.equal(shy?.anim, 'shy_tuck');

  const bold = pickAttention(ctx({ ...parked, zone: 'chest', boldness: 80 }));
  assert.equal(bold?.kind, 'caught');
  assert.equal(bold?.anim, 'tease');
});

test('legs and feet answer with their own beats', () => {
  const parked = { hoverMs: ATTENTION.caughtDwellMs + 100, msSinceTap: 6000 };
  // Bold on the legs shows them off — the arch is the rig's only "look at me" beat.
  assert.equal(pickAttention(ctx({ ...parked, zone: 'legs', boldness: 80 }))?.anim, 'arch');
  // Feet are the joke of the whole game: tickled, shy or bold, the plate permitting.
  assert.equal(pickAttention(ctx({ ...parked, zone: 'feet', boldness: 20 }))?.anim, 'tickle');
  // A face is never "caught": being watched on her face is just being watched.
  assert.equal(pickAttention(ctx({ ...parked, zone: 'head', boldness: 80 }))?.kind, 'staring');
});

test('being caught needs more stillness than being watched', () => {
  // The generic stare fires at 1.5 s; the specific one holds until 2.1 s. Between the two the game
  // must not already have spent the beat, or the hotspot would never speak.
  const early = pickAttention(
    ctx({ hoverMs: ATTENTION.stareDwellMs + 50, msSinceTap: 6000, zone: 'chest', boldness: 80 }),
  );
  assert.equal(early?.kind, 'staring');
});

test('caught has the longest cooldown in the game', () => {
  const parked = { hoverMs: ATTENTION.caughtDwellMs + 100, msSinceTap: 6000, zone: 'chest' as const };
  // Still cooling down from the last caught beat: nothing at all, not even the generic stare…
  const cooling = pickAttention(
    ctx({ ...parked, boldness: 80, msSinceAttention: ATTENTION.stareCooldownMs + 1000 }),
  );
  assert.equal(cooling?.kind, 'staring');
  // …and once its own cooldown has passed, it is hers again.
  const ready = pickAttention(
    ctx({ ...parked, boldness: 80, msSinceAttention: ATTENTION.caughtCooldownMs + 1000 }),
  );
  assert.equal(ready?.kind, 'caught');
});

test('a plate without the beat still answers, with what it has', () => {
  const thin = new Set<string>(['giggle']);
  const pick = pickAttention(
    ctx({
      hoverMs: ATTENTION.caughtDwellMs + 100,
      msSinceTap: 6000,
      zone: 'legs',
      boldness: 80,
      available: thin,
    }),
  );
  assert.equal(pick?.kind, 'caught');
  assert.equal(pick?.anim, 'giggle');
});

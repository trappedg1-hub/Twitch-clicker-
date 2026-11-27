import assert from 'node:assert/strict';
import test from 'node:test';

import { createSelfQuirkMessage } from '../src/chat/chatEngine.ts';
import { contradictsWardrobe, getWardrobe } from '../src/domain/wardrobe.ts';
import type { QuirkKind } from '../src/heroine/LiveHeroine.ts';

const KINDS: QuirkKind[] = ['turn', 'hair_flip', 'lean_in', 'giggle', 'tease'];

test('chat can notice her own beats on every day without contradicting what she is wearing', () => {
  // The whole point of these lines is that they are day-agnostic: a giggle is a giggle on the hoodie
  // day and on the ghost day. `contradictsWardrobe` is the project's own definition of "this line
  // describes something the player cannot see", so it is the right judge.
  for (let day = 1; day <= 6; day += 1) {
    for (let stage = 0; stage <= 4; stage += 1) {
      const wardrobe = getWardrobe(day, stage);
      for (const kind of KINDS) {
        for (let seed = 0; seed < 12; seed += 1) {
          const message = createSelfQuirkMessage(kind, seed, day);
          assert.ok(message.text.length > 0, `${kind}/${seed}: empty line`);
          assert.ok(message.author.length > 0, `${kind}/${seed}: no author`);
          const clash = contradictsWardrobe(message.text, wardrobe);
          assert.equal(
            clash,
            null,
            `day ${day} stage ${stage} / ${kind}: "${message.text}" — ${clash}`,
          );
        }
      }
    }
  }
});

test('a quirk line is hers, and it varies', () => {
  const texts = new Set<string>();
  for (const kind of KINDS) {
    for (let seed = 0; seed < 40; seed += 1) texts.add(createSelfQuirkMessage(kind, seed, 2).text);
  }
  // A pool that returns the same line for every seed is a single message wearing a pool's costume.
  assert.ok(texts.size >= 8, `${texts.size} distinct quirk lines`);
});

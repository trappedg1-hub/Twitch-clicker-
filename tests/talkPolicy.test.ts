import assert from 'node:assert/strict';
import test from 'node:test';
import { canTalk, idleAfterReaction } from '../src/heroine/talkPolicy.ts';
import { readPublishedRig } from '../scripts/rig_doc.mjs';

/**
 * The mouth is optional. Seven arts ship without `idle_talk` (food at the lips, or a canon mouth
 * that is already open), and the rig used to ask for it anyway — once per chat line, inside the
 * frame guard, which is a fault that takes the whole live rig down.
 */
test('a document without a mouth never asks for the mouth animation', () => {
  const mouthless = readPublishedRig('t6_s1');
  const mouths = readPublishedRig('t4_start_hq');
  const missing = mouthless.animations.map((a: { name: string }) => a.name);
  const present = mouths.animations.map((a: { name: string }) => a.name);
  assert.equal(canTalk(missing), false, 't6_s1 ships no idle_talk');
  assert.equal(canTalk(present), true, 't4_start_hq ships idle_talk');
  assert.equal(idleAfterReaction(missing, true), 'idle', 'mouthless: a reaction must fall back to idle');
  assert.equal(idleAfterReaction(present, true), 'idle_talk', 'with a mouth: return to the talk loop');
  assert.equal(idleAfterReaction(present, false), 'idle', 'not talking: idle');
});

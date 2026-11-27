import assert from 'node:assert/strict';
import test from 'node:test';
import { canTalk, idleAfterReaction, talkDeadline } from '../src/heroine/talkPolicy.ts';
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

/**
 * A chat line that lands on an idle glance. She turns her head for 2.4 s, the line comes in at the
 * top of it, and the mouth waits for the turn to finish — so the deadline has to start when the beat
 * ends. Starting it at "now" made the sentence expire exactly as the head came back: the mouth
 * never opened at all, and the QA run in the browser caught her answering two lines in silence.
 */
test('a sentence asked for mid-beat starts when the beat ends', () => {
  const now = 1_000;
  assert.equal(talkDeadline(now, 0, 2_400), 3_400, 'no beat: the mouth is due right now');
  assert.equal(talkDeadline(now, 3_400, 2_400), 5_800, 'mid-glance: the full length starts at its end');
  assert.equal(talkDeadline(now, 1_200, 2_400), 3_600, 'beat shorter than the sentence still adds up');
  // The deadline only ever moves forward: a second line during a sentence extends it, never cuts it.
  const first = talkDeadline(now, 0, 2_400);
  const second = talkDeadline(now + 500, 0, 2_400);
  assert.ok(Math.max(first, second) === second);
});

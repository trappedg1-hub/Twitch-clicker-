import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHAT_GLANCE_GAP_MS,
  CHAT_GLANCE_MAX_MS,
  CHAT_GLANCE_MS,
  IDLE_CHAT_GLANCE,
  askChatGlance,
  chatGlanceActive,
  chatGlanceDuty,
} from '../src/heroine/chatGlance.ts';

test('a line starts a short glance and nothing holds it for long', () => {
  const s = askChatGlance(IDLE_CHAT_GLANCE, 10_000);
  assert.equal(chatGlanceActive(s, 10_000), true);
  assert.equal(chatGlanceActive(s, 10_000 + CHAT_GLANCE_MS - 1), true);
  assert.equal(chatGlanceActive(s, 10_000 + CHAT_GLANCE_MS), false, 'it ends on its own');
  assert.equal(askChatGlance(IDLE_CHAT_GLANCE, 0, 99_999).until, CHAT_GLANCE_MAX_MS, 'capped');
});

test('a chat that posts every 100 ms is one glance per gap, not a stare', () => {
  let s = IDLE_CHAT_GLANCE;
  let started = 0;
  for (let now = 0; now <= 30_000; now += 100) {
    const next = askChatGlance(s, now);
    if (next !== s) started += 1;
    s = next;
  }
  // 30 s of a firehose, one glance every 3.2 s: nine or ten, never thirty.
  assert.ok(started >= 9 && started <= 10, `started ${started}`);
  assert.ok(chatGlanceDuty() < 0.25, 'under a quarter of the stream');
});

test('force is for QA: it starts a glance on the same frame it is asked', () => {
  const s = askChatGlance(IDLE_CHAT_GLANCE, 5_000);
  const forced = askChatGlance(s, 5_100, 1_500, true);
  assert.equal(forced.startedAt, 5_100);
  assert.equal(chatGlanceActive(forced, 6_500), true);
});

test('nonsense in, a sane glance out', () => {
  const s = askChatGlance(IDLE_CHAT_GLANCE, 1_000, Number.NaN);
  assert.equal(s.until, 1_000 + CHAT_GLANCE_MS, 'NaN falls back to the default hold');
  assert.equal(askChatGlance(IDLE_CHAT_GLANCE, 1_000, 0), IDLE_CHAT_GLANCE, 'zero is no glance');
  assert.equal(askChatGlance(IDLE_CHAT_GLANCE, 1_000, -5), IDLE_CHAT_GLANCE, 'negative too');
  assert.ok(CHAT_GLANCE_GAP_MS > CHAT_GLANCE_MS, 'the gap must be longer than the glance');
});

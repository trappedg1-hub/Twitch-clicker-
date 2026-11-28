import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AWAY_MS,
  IDLE_RETURN,
  WELCOME_LOCKOUT_MS,
  markHidden,
  welcomeBack,
  welcomeBackBand,
  welcomeBackChatLine,
} from '../src/domain/returnBeat.ts';

test('an alt-tab is not an absence', () => {
  const s = markHidden(IDLE_RETURN, 10_000);
  const r = welcomeBack(s, 10_000 + AWAY_MS - 1);
  assert.equal(r.greet, false);
  assert.equal(r.state.hiddenAt, null, 'the absence is consumed either way');
  // the same absence cannot be greeted twice
  assert.equal(welcomeBack(r.state, 10_000 + AWAY_MS * 3).greet, false);
});

test('a real absence gets one greeting, then the lockout holds', () => {
  const hidden = markHidden(IDLE_RETURN, 0);
  const first = welcomeBack(hidden, AWAY_MS + 1);
  assert.equal(first.greet, true);
  assert.equal(first.awayMs, AWAY_MS + 1);

  const second = markHidden(first.state, AWAY_MS + 1_000);
  const back = welcomeBack(second, AWAY_MS + 1_000 + AWAY_MS + 1);
  assert.equal(back.greet, false, 'still inside the three minutes');
  assert.equal(back.state.hiddenAt, null);

  const later = markHidden(back.state, WELCOME_LOCKOUT_MS + 1);
  const again = welcomeBack(later, WELCOME_LOCKOUT_MS + 1 + AWAY_MS + 1);
  assert.equal(again.greet, true, 'after the lockout she notices again');
});

test('visiting a page that was never hidden greets nobody', () => {
  assert.equal(welcomeBack(IDLE_RETURN, 999_999).greet, false);
  assert.equal(welcomeBack(IDLE_RETURN, 999_999).awayMs, 0);
});

test('the register follows her heat, and the chat line follows the length of the absence', () => {
  assert.equal(welcomeBackBand(0.1), 'shy');
  assert.equal(welcomeBackBand(0.9), 'bold');
  assert.match(welcomeBackChatLine(60_000), /вернулся/);
  assert.match(welcomeBackChatLine(15 * 60_000), /15 минут/);
});

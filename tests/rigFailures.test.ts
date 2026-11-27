import assert from 'node:assert/strict';
import test from 'node:test';
import { isMissingDocumentError } from '../src/heroine/rigFailures.ts';

/**
 * The bug this guards: a plate with no rig (the four `skip` arts) used to be treated as a broken
 * rig, and a broken rig is a one-way door — `LiveHeroine.fail()` switched the skeleton off for the
 * rest of the session and wrote a flag that kept it off after a reload. Day 3 opens on `t3_s0`,
 * the scare frame, so every player lost the animated heroine the moment they reached day 3.
 */
test('a document that is not there is a gap, not a fault', () => {
  for (const message of [
    'Not Found',
    '404 /rigs/t3_s0.obonb',
    'Unexpected token \'<\', "<!doctype "... is not valid JSON',
    'Failed to fetch',
    'TypeError: NetworkError when attempting to fetch resource.',
    'Load failed',
  ]) {
    assert.equal(isMissingDocumentError(new Error(message)), true, `${message} must count as a gap`);
  }
});

test('a document that will not build is a fault', () => {
  for (const message of [
    "Cannot read properties of undefined (reading 'skeleton')",
    'Unknown animation: idle_talk',
    'WebGL context lost',
    'Out of memory',
  ]) {
    assert.equal(isMissingDocumentError(new Error(message)), false, `${message} must count as a fault`);
  }
});

test('a non-Error throw is read as text', () => {
  assert.equal(isMissingDocumentError('404'), true);
  assert.equal(isMissingDocumentError(undefined), false);
});

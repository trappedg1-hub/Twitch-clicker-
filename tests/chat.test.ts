import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAmbientChatMessage,
  createDonationChatMessage,
  createUpgradeChatMessage,
  createZoneBurstMessage,
} from '../src/chat/chatEngine.ts';
import type { TapZoneId } from '../src/domain/types.ts';
import { TIER1_UPGRADES } from '../src/domain/upgrades.ts';

test('chat engine creates valid ambient, zone, donation, and upgrade messages', () => {
  const ambLow = createAmbientChatMessage(3, 1);
  const ambHigh = createAmbientChatMessage(65, 2);
  assert.ok(ambLow.author.length > 2);
  assert.ok(ambHigh.text.length > 4);

  const zones: TapZoneId[] = ['head', 'chest', 'belly', 'legs', 'feet'];
  for (const z of zones) {
    const msg = createZoneBurstMessage(z, 3);
    assert.ok(msg.text.length > 5);
  }

  const don = createDonationChatMessage(150, 4);
  assert.equal(don.badge, 'DONATE');
  assert.equal(don.isSystemHighlight, true);
  assert.ok(don.text.includes('150'));

  for (const def of TIER1_UPGRADES) {
    const up = createUpgradeChatMessage(def.id, 5);
    assert.equal(up.isSystemHighlight, true);
    assert.ok(up.text.length > 5);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAmbientChatMessage,
  createDonationChatMessage,
  createSubGoalCascadeMessages,
  createSubNotificationMessage,
  createUpgradeChatMessage,
  createViralClipChatMessage,
  createZoneBurstMessage,
} from '../src/chat/chatEngine.ts';
import { SUB_GOAL_STAGES } from '../src/domain/subGoals.ts';
import type { TapZoneId } from '../src/domain/types.ts';
import { TIER1_UPGRADES } from '../src/domain/upgrades.ts';
import { renderChatTextWithEmotes } from '../src/presentation/twitchEmotes.ts';

test('chat engine creates valid ambient, zone, sub notification, and cascade messages', () => {
  for (const stage of [0, 1, 2, 3, 4] as const) {
    const amb = createAmbientChatMessage(20, stage, 1);
    assert.ok(amb.author.length > 2);
    assert.ok(amb.text.length > 4);
  }

  const zones: TapZoneId[] = ['head', 'chest', 'belly', 'legs', 'feet'];
  for (const z of zones) {
    const msg = createZoneBurstMessage(z, 0, 3);
    assert.ok(msg.text.length > 5);
  }

  const sub1 = createSubNotificationMessage(1, true, 10, 4);
  assert.equal(sub1.badge, 'SUB');
  assert.ok(sub1.text.includes('10'));

  for (const st of SUB_GOAL_STAGES.slice(1)) {
    const cascade = createSubGoalCascadeMessages(st);
    assert.equal(cascade.length, 4);
    const rendered = renderChatTextWithEmotes(cascade[0]!.text);
    assert.ok(rendered.includes('class="tw-emote'));
  }

  const don = createDonationChatMessage(150, 4);
  assert.equal(don.badge, 'DONATE');
  assert.equal(don.isSystemHighlight, true);

  for (const def of TIER1_UPGRADES) {
    const up = createUpgradeChatMessage(def.id);
    assert.equal(up.isSystemHighlight, true);
    assert.ok(up.text.length > 5);
  }
});

test('renderChatTextWithEmotes replaces all 12 Twitch emote tokens with real Twitch emote images and escapes HTML', () => {
  const html = renderChatTextWithEmotes(
    'чат <script> :BOOBA: :peepoShy: :monkaS: :EZ: :Nosebleed: :AWOOGA: :Overheat: :ClipIt:',
  );
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('/emotes/booba.webp'));
  assert.ok(html.includes('/emotes/nosebleed.webp'));
  assert.ok(html.includes('/emotes/awooga.webp'));
  assert.ok(html.includes('/emotes/overheat.webp'));
  assert.ok(html.includes('/emotes/clipit.webp'));

  const clipMsg = createViralClipChatMessage('feet', 180, 2);
  assert.equal(clipMsg.author, 'TwitchClips');
  assert.ok(renderChatTextWithEmotes(clipMsg.text).includes('/emotes/clipit.webp'));
});

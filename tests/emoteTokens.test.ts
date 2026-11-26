import assert from 'node:assert/strict';
import test from 'node:test';

import * as chatEngine from '../src/chat/chatEngine.ts';
import * as dialogue from '../src/domain/dialogue.ts';
import * as progression from '../src/domain/progression.ts';
import * as subGoals from '../src/domain/subGoals.ts';
import { EMOTE_TOKENS } from '../src/presentation/twitchEmotes.ts';

/**
 * A chat line is typed text, not markup: it goes through `escapeHtml` and then a token replacement, so
 * anything the renderer does not know is printed to the player verbatim (`:sub2:` in the log reads as a
 * bug, and a stray `{x}` reads as a broken template). Day 5 shipped copy that used a Tier-2 sub badge the
 * renderer had never heard of, which is how this file came to exist: the plates and the wording were both
 * fine, and the chat still looked broken.
 *
 * The audit walks the copy modules instead of a hand-kept list, so a new pool is covered the moment it is
 * exported — the same trick `copyAudit` uses for wardrobe truth.
 */

const KNOWN = new Set(EMOTE_TOKENS.map((t) => t.slice(1, -1)));

type Unknown = Record<string, unknown>;

function collectStrings(value: unknown, out: string[], seen = new Set<unknown>()): void {
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (value instanceof Set || value instanceof Map) return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out, seen);
    return;
  }
  for (const v of Object.values(value as Unknown)) collectStrings(v, out, seen);
}

const MODULES: [string, Unknown][] = [
  ['chatEngine', chatEngine],
  ['dialogue', dialogue],
  ['subGoals', subGoals],
  ['progression', progression],
];

test('every emote token in the copy is a token the chat renderer can draw', () => {
  const offenders: string[] = [];
  let tokens = 0;
  let lines = 0;

  for (const [where, mod] of MODULES) {
    const strings: string[] = [];
    collectStrings(mod, strings);
    for (const line of strings) {
      const found = line.match(/:([A-Za-z][A-Za-z0-9_]*):/g) ?? [];
      if (found.length === 0) continue;
      lines++;
      for (const token of found) {
        tokens++;
        if (!KNOWN.has(token.slice(1, -1))) {
          offenders.push(`${where}: ${token} is not in EMOTE_HTML — ${line.slice(0, 70)}`);
        }
      }
    }
  }

  assert.deepEqual(offenders, [], 'chat copy references emotes the renderer does not have');
  // And the sweep must not be vacuous: the day pools really do lean on these glyphs.
  assert.ok(tokens > 40, `the audit only found ${tokens} emote tokens, which means it stopped seeing copy`);
  assert.ok(lines > 20, `only ${lines} lines carry emote tokens`);
});

test('no on-screen copy leaks a template placeholder', () => {
  const offenders: string[] = [];
  for (const [where, mod] of MODULES) {
    const strings: string[] = [];
    collectStrings(mod, strings);
    for (const line of strings) {
      if (/[{}]/.test(line)) offenders.push(`${where}: braces in typed copy — ${line.slice(0, 70)}`);
      if (/\bundefined\b|\[object /i.test(line)) offenders.push(`${where}: ${line.slice(0, 70)}`);
    }
  }
  assert.deepEqual(offenders, [], 'some copy was built from a template that never interpolated');
});

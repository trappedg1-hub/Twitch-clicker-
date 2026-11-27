/**
 * Being watched, and being left alone — the two states a streamer is in all night and a clicker
 * usually ignores.
 *
 * The rig already answers taps (`reactionDirector`) and fills silence with canned quirks
 * (`IDLE_QUIRKS`). Neither knows the one thing the player is doing *constantly* without clicking:
 * resting the cursor on her. A person notices that. They look up, they raise an eyebrow, they get
 * shy — and if nobody touches them for long enough, they stop performing and stretch.
 *
 * This module is that switchboard, as a pure function of numbers so it can be tested without Pixi:
 *
 *  * **staring** — the cursor has rested on her body for `stareDwellMs`, nothing has been tapped
 *    while it was there, and she has not done this for `stareCooldownMs`. A bold girl holds the eye
 *    contact and adds the tongue; a shy one tucks her chin into her shoulder. Same event, two women
 *    — the same rule the tap director uses.
 *  * **bored** — nothing has happened for `boredAfterMs`. She stretches (`arch`), which is the one
 *    beat in the rig that shows the silhouette on purpose, and it reads as "she is alone in her
 *    room" instead of "the game is waiting for input".
 *
 * Both are gated on `msSinceBeat`: stepping on a beat that is still playing is what makes a rig
 * look glitchy, and every beat here is longer than the gate.
 */

import { BEAT_MS, type BeatName } from './reactionDirector.ts';

export type AttentionKind = 'staring' | 'bored';

/** All the tuning in one place, in milliseconds, because this is a timing problem. */
export const ATTENTION = {
  /** Cursor has to rest on her this long before she reacts to it. Under a second reads as a twitch. */
  stareDwellMs: 1500,
  /** …and she has to have been left alone this long, or every tap-hunt becomes a stare. */
  stareQuietMs: 700,
  /** Per-player cooldown: the trick is charming once a minute, creepy five times a minute. */
  stareCooldownMs: 22000,
  /** How long an empty stream has to be before she stops posing and just stretches. */
  boredAfterMs: 15000,
  boredCooldownMs: 26000,
  /** Never step on the tail of another beat. */
  beatBusyMs: 1200,
} as const;

export interface AttentionContext {
  /** How long the pointer has been resting on her body; 0 when it is somewhere else. */
  hoverMs: number;
  /** Milliseconds since the last tap anywhere on the stage. */
  msSinceTap: number;
  /** Milliseconds since the last attention beat of either kind. */
  msSinceAttention: number;
  /** Milliseconds since any reaction or quirk started, taps included. */
  msSinceBeat: number;
  /** 0..100, the same number the rig's blush uses. */
  boldness: number;
  /** What the current plate actually carries. */
  available: ReadonlySet<string>;
  random: () => number;
}

export interface AttentionBeat {
  kind: AttentionKind;
  anim: BeatName;
  ms: number;
}

/** The first beat she has the art for, in preference order, or null. */
function first(available: ReadonlySet<string>, order: BeatName[]): BeatName | null {
  for (const name of order) {
    if (available.has(name)) return name;
  }
  return null;
}

const beat = (kind: AttentionKind, anim: BeatName): AttentionBeat => ({
  kind,
  anim,
  ms: BEAT_MS[anim] ?? 1200,
});

/** Boldness at which she stops being embarrassed about being looked at. Matches the rig's own 68. */
export const BOLD_STARE = 55;

export function pickAttention(ctx: AttentionContext): AttentionBeat | null {
  if (ctx.msSinceBeat < ATTENTION.beatBusyMs) return null;

  const staring =
    ctx.hoverMs >= ATTENTION.stareDwellMs &&
    ctx.msSinceTap >= ATTENTION.stareQuietMs &&
    ctx.msSinceAttention >= ATTENTION.stareCooldownMs;
  if (staring) {
    const bold = ctx.boldness >= BOLD_STARE;
    const name = first(
      ctx.available,
      bold ? ['tease', 'giggle', 'hair_flip', 'tap'] : ['shy_tuck', 'giggle', 'turn', 'tap'],
    );
    if (name) return beat('staring', name);
  }

  const bored =
    ctx.msSinceTap >= ATTENTION.boredAfterMs && ctx.msSinceAttention >= ATTENTION.boredCooldownMs;
  if (bored) {
    // One coin flip so an abandoned stream is not a metronome: she stretches, or she just shifts
    // her weight and looks at the chat. Both are idle, only one is a performance.
    const name =
      ctx.random() < 0.55
        ? first(ctx.available, ['arch', 'settle', 'turn', 'tap'])
        : first(ctx.available, ['settle', 'lean_in', 'turn', 'tap']);
    if (name) return beat('bored', name);
  }

  return null;
}

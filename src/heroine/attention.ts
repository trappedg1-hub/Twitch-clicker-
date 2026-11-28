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

import type { TapZoneId } from '../domain/types.ts';
import { BEAT_MS, type BeatName } from './reactionDirector.ts';

/**
 * The plate that has no skeleton still has moments of its own.
 *
 * Four of the thirty plates never got a rig and one (`t5_s3`, the day-5 finale) never can: the pose
 * is drawn from behind, so there is no line from the eyes to the hips to hang bones on. Those plates
 * are drawn, not played — so `LiveHeroine` never runs, `onQuirk` never fires, and the woman is the
 * only thing on screen that is completely still. The chat keeps talking about a girl who does
 * nothing.
 *
 * This is the fix that needs no rig: on a timer, on the flat layer only, she is given the same kind
 * of moment the skeleton gets — a small sound and a line in chat. What she does not get is a claim
 * that she moved.
 */
export const FLAT_QUIRK_MIN_MS = 24000;
export const FLAT_QUIRK_SPAN_MS = 32000;

/** 24–56 s, so her own moments never land on a rhythm a player can count. */
export function nextFlatQuirkDelay(rng: () => number): number {
  const r = rng();
  const safe = Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : 0.5;
  return FLAT_QUIRK_MIN_MS + safe * FLAT_QUIRK_SPAN_MS;
}

/**
 * The beats that survive having no skeleton.
 *
 * A hair toss and a look around need an arm and a neck; a giggle and a tease need only the line the
 * chat writes about them. Those two are what a back-view plate can honestly do.
 */
export const FLAT_QUIRK_KINDS = ['giggle', 'lean_in', 'tease'] as const;
export type FlatQuirkKind = (typeof FLAT_QUIRK_KINDS)[number];

export function pickFlatQuirk(rng: () => number): FlatQuirkKind {
  const r = rng();
  const safe = Number.isFinite(r) ? Math.min(0.999, Math.max(0, r)) : 0.5;
  return FLAT_QUIRK_KINDS[Math.floor(safe * FLAT_QUIRK_KINDS.length)]!;
}

export type AttentionKind = 'staring' | 'bored' | 'caught';

/**
 * The zones a stare is *allowed* to be caught on, and what each one earns.
 *
 * A cursor resting on her face is attention; a cursor resting on her chest is something else, and a
 * streamer knows the difference instantly. That distinction is the whole point of this table — the
 * same three seconds of stillness land as eye contact, as embarrassment, or as a tease depending on
 * where the pointer is, which is exactly the fan-service the game was missing without adding a
 * single new animation.
 *
 * Every answer is drawn from beats the plate actually carries (`available`), so a plate with no
 * `arch` falls through to `tease`, and a plate with neither falls through to the generic stare list.
 */
export const CAUGHT_ANSWERS: Record<'chest' | 'legs' | 'feet', { bold: BeatName[]; shy: BeatName[] }> = {
  // Caught on her chest: bold owns it (the tongue), shy hides behind her shoulder.
  chest: { bold: ['tease', 'giggle', 'arch'], shy: ['shy_tuck', 'giggle', 'turn'] },
  // Caught on her legs: bold shows them off — `arch` is the one beat that presents the silhouette.
  legs: { bold: ['arch', 'tease', 'giggle'], shy: ['shy_tuck', 'settle', 'turn'] },
  // Feet are the joke of the game and the one place a reaction can be a squeal.
  feet: { bold: ['tickle', 'giggle', 'tease'], shy: ['tickle', 'shy_tuck', 'giggle'] },
};

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
  /**
   * Being caught looking somewhere specific takes the longest to register: two seconds of a cursor
   * parked on her chest is a decision, one second is a mouse passing through. The cooldown is longer
   * than the generic stare's because this beat is much louder.
   */
  caughtDwellMs: 2100,
  caughtQuietMs: 900,
  caughtCooldownMs: 30000,
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
  /** Which part of her the pointer is resting on, when it is resting on one. */
  zone?: TapZoneId | null;
  random: () => number;
}

export interface AttentionBeat {
  kind: AttentionKind;
  anim: BeatName;
  ms: number;
  /** Set for `caught`: which zone she caught the player looking at. The chat line uses it. */
  zone?: 'chest' | 'legs' | 'feet' | null;
}

/** The first beat she has the art for, in preference order, or null. */
function first(available: ReadonlySet<string>, order: BeatName[]): BeatName | null {
  for (const name of order) {
    if (available.has(name)) return name;
  }
  return null;
}

const beat = (kind: AttentionKind, anim: BeatName, zone?: AttentionBeat['zone']): AttentionBeat => ({
  kind,
  anim,
  ms: BEAT_MS[anim] ?? 1200,
  ...(zone ? { zone } : {}),
});

/** Boldness at which she stops being embarrassed about being looked at. Matches the rig's own 68. */
export const BOLD_STARE = 55;

export function pickAttention(ctx: AttentionContext): AttentionBeat | null {
  if (ctx.msSinceBeat < ATTENTION.beatBusyMs) return null;

  // Caught: the pointer has been parked on one part of her for a beat and a half of quiet. This is
  // checked before the generic stare, because it is the more specific reading of the same input —
  // and the longer cooldown means it can never become the loop.
  const zone = ctx.zone ?? null;
  const caughtZone = zone === 'chest' || zone === 'legs' || zone === 'feet' ? zone : null;
  if (
    caughtZone &&
    ctx.hoverMs >= ATTENTION.caughtDwellMs &&
    ctx.msSinceTap >= ATTENTION.caughtQuietMs &&
    ctx.msSinceAttention >= ATTENTION.caughtCooldownMs
  ) {
    const table = CAUGHT_ANSWERS[caughtZone];
    const name = first(ctx.available, ctx.boldness >= BOLD_STARE ? table.bold : table.shy);
    if (name) return beat('caught', name, caughtZone);
  }

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

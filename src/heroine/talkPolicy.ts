/**
 * Which idle a rig should be in — asked as a question, so it can be answered wrongly only once.
 *
 * The mouth is an optional slot: arts with food at the lips, and every art whose canon mouth is
 * already open, ship without `idle_talk` on purpose (seven of them). `LiveHeroine.talk()` used to
 * set the talk deadline *before* checking whether the document had the animation, and `update()`
 * then played `idle_talk` unguarded when a reaction ended — so any chat line that arrived while a
 * mouthless plate was up threw `Animation "idle_talk" not found` inside the frame guard, which is a
 * fault, which turned the heroine flat for the rest of the run. The two lines below are that check,
 * in a place where a test can reach them without a renderer.
 */
export function canTalk(animations: readonly string[]): boolean {
  return animations.includes('idle_talk');
}

/** The idle to return to when a reaction ends: `idle_talk` only if this document has a mouth. */
export function idleAfterReaction(animations: readonly string[], stillTalking: boolean): 'idle' | 'idle_talk' {
  return stillTalking && canTalk(animations) ? 'idle_talk' : 'idle';
}

/**
 * When a sentence asked for now actually ends.
 *
 * A chat line can land in the middle of an idle glance: `talk()` deliberately does not restart the
 * mouth over a beat that is already playing (that reads as a stutter), so the sentence waits for the
 * beat to finish. But the deadline used to start at *now*, which meant a line that arrived at the
 * top of a 2.4 s head turn expired at the exact instant the turn ended — and she finished the turn
 * in silence. The mouth is due from the moment the beat is over, and for the full length asked for.
 */
export function talkDeadline(now: number, reactionUntil: number, ms: number): number {
  return Math.max(now, reactionUntil) + ms;
}

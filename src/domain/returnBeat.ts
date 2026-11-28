/**
 * Leaving and coming back — the one thing every player does that no streamer sim acknowledges.
 *
 * You alt-tab to Discord for two minutes. Nothing in this game noticed: when you come back she is
 * mid-idle-loop, the chat is mid-joke, and the illusion that somebody is *sitting there* takes the
 * hit. A person notices an empty chair. So this module is the doorman, and it is pure numbers for
 * the same reason `chatGlance` is: the hard part is not the line, it is knowing when to keep quiet.
 *
 *  * **a real absence** — under `AWAY_MS` it was a glance at another tab, not leaving. Greeting that
 *    would make her look needy, and the player would see the trick.
 *  * **once per lockout** — `WELCOME_LOCKOUT_MS` keeps a player who is flipping between windows from
 *    getting a greeting every time. One greeting per three minutes, and it lands because it is rare.
 *  * **no state, no scene** — a hidden page does not tick, so `markHidden` records a wall clock and
 *    `welcomeBack` reads it. Nothing accumulates while the tab is in the background, which is also
 *    why the timestamps have to be passed in rather than read from a clock this module owns.
 */

/** Under this, the tab switch was a glance: no greeting. */
export const AWAY_MS = 45_000;
/** At most one greeting per this, no matter how much the player window-shops. */
export const WELCOME_LOCKOUT_MS = 180_000;

export interface ReturnState {
  /**
   * When the page went hidden, `null` when it never did (or the absence was already greeted).
   * `null` and not 0: a page can go hidden at wall clock 0 in a test, and a sentinel that collides
   * with a legal value is a bug waiting for the one caller that starts its clock at zero.
   */
  hiddenAt: number | null;
  /** When she last greeted a return. */
  greetedAt: number;
}

export const IDLE_RETURN: ReturnState = { hiddenAt: null, greetedAt: Number.NEGATIVE_INFINITY };

/** The page went to the background. */
export function markHidden(state: ReturnState, now: number): ReturnState {
  return { hiddenAt: now, greetedAt: state.greetedAt };
}

/**
 * The page came back. `greet` is true at most once per absence and at most once per lockout; the
 * returned state is what the caller stores, whether or not she said anything.
 */
export function welcomeBack(state: ReturnState, now: number): { greet: boolean; awayMs: number; state: ReturnState } {
  if (state.hiddenAt === null) return { greet: false, awayMs: 0, state };
  const awayMs = Math.max(0, now - state.hiddenAt);
  const consumed: ReturnState = { hiddenAt: null, greetedAt: state.greetedAt };
  if (awayMs < AWAY_MS) return { greet: false, awayMs, state: consumed };
  if (now - state.greetedAt < WELCOME_LOCKOUT_MS) return { greet: false, awayMs, state: consumed };
  return { greet: true, awayMs, state: { hiddenAt: null, greetedAt: now } };
}

/** Which register she comes back in: a shy girl checks whether you are still there, a bold one does not pretend. */
export function welcomeBackBand(heat: number): 'shy' | 'bold' {
  return heat >= 0.55 ? 'bold' : 'shy';
}

/** "Ты вернулся" as a chat line for the audience, so the beat is not only inside her head. */
export function welcomeBackChatLine(awayMs: number): string {
  const minutes = Math.max(1, Math.round(awayMs / 60_000));
  return minutes >= 10
    ? `★ она ждала ${minutes} минут и всё это время смотрела в чат`
    : '★ опа, он вернулся — она делает вид, что не заметила';
}

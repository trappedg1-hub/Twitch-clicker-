/**
 * Reading the chat — the thing a streamer does every few seconds and a clicker never shows.
 *
 * The stage already owns where she looks: the pointer aims her, her blush pulls the aim back to the
 * lens, and `holdAtCamera` keeps either from becoming a stare. None of that knows about the column
 * of messages on the right of the screen, which is the one piece of furniture a streaming heroine is
 * *supposed* to look at. This module is the switchboard for that, as pure numbers, because the part
 * that is easy to get wrong is not the look — it is the rate:
 *
 *  * **one glance per gap** — a chat that posts every 1.5 s would otherwise pin her head to the
 *    right edge for the entire session. `CHAT_GLANCE_GAP_MS` is what turns a reflex into a habit.
 *  * **short** — a glance is a beat, not a state. It has to be over before the player's next tap, so
 *    the tap reaction never has to fight it for the head.
 *  * **never over a challenge** — the caller gates that (the dare owns those seconds), and it is
 *    deliberately *not* in here: `chatGlance` knows nothing about gameplay.
 *
 * The state is two numbers, so the whole thing is testable without a browser and re-enterable
 * without allocation — the stage calls `askChatGlance` on every message and `chatGlanceActive` on
 * every frame.
 */

/** Minimum time between two glances, measured from the start of one to the start of the next. */
export const CHAT_GLANCE_GAP_MS = 3200;
/** How long she holds the column. */
export const CHAT_GLANCE_MS = 700;
/** Nothing holds longer than this, even if a caller asks for more. */
export const CHAT_GLANCE_MAX_MS = 1600;

export interface ChatGlanceState {
  /** Wall clock until which the glance is live. */
  until: number;
  /** Wall clock of the last glance that actually started — the rate limit reads this. */
  startedAt: number;
}

export const IDLE_CHAT_GLANCE: ChatGlanceState = { until: 0, startedAt: Number.NEGATIVE_INFINITY };

/**
 * A line landed. Returns the state unchanged when the last glance is too recent, which is the whole
 * rate limit — callers can flood this safely.
 *
 * `force` exists for QA only: a script has to be able to see the glance on the very frame it asks
 * for it, and waiting out three seconds of cooldown per assertion would make the test meaningless.
 */
export function askChatGlance(
  state: ChatGlanceState,
  now: number,
  ms: number = CHAT_GLANCE_MS,
  force = false,
): ChatGlanceState {
  if (!force && now - state.startedAt < CHAT_GLANCE_GAP_MS) return state;
  const hold = Number.isFinite(ms) ? Math.min(Math.max(0, ms), CHAT_GLANCE_MAX_MS) : CHAT_GLANCE_MS;
  if (hold === 0) return state;
  return { until: Math.max(state.until, now + hold), startedAt: now };
}

export function chatGlanceActive(state: ChatGlanceState, now: number): boolean {
  return now < state.until;
}

/**
 * The steady-state share of the stream she spends on the column if the chat never shuts up. This is
 * the number the gap exists for: it is a ceiling on a busy chat, not a measurement of a quiet one.
 */
export function chatGlanceDuty(): number {
  return Math.min(1, CHAT_GLANCE_MS / CHAT_GLANCE_GAP_MS);
}

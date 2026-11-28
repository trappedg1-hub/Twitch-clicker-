/**
 * Chat dares — the layer the game was missing between "tap her" and "buy an upgrade".
 *
 * A clicker has one verb and a streamer has one audience, and the whole night is the two of them
 * doing the same thing at each other. What a real stream has that this game did not is the chat
 * *asking for something*: "а слабо?", "покажи язык", "не трогай её минуту, кто первый сломается".
 * That is free content — it needs no new art, only a rule that reads the input the game already
 * has (which zone was tapped, where the cursor is resting, how long since anything happened) and a
 * heroine who answers differently depending on whether the dare was met.
 *
 * The design constraints, learned from the beats around it:
 *
 * 1. **One dare at a time, and short.** A 9-second window is a challenge; a 60-second one is a
 *    chore, and a permanent one is a HUD decoration.
 * 2. **Never a dare the plate cannot answer.** Every completed dare ends in a beat she owns.
 * 3. **Losing is content too.** An expired dare is the chat mocking the player and the heroine
 *    noticing — that is why `expired` is a state and not a silent reset.
 * 4. **It has to be readable in numbers.** Everything here is pure so the progress bar, the
 *    timer and the answer can be tested without a browser.
 */

import type { TapZoneId } from './types.ts';

export type DareKind = 'cheek' | 'feet' | 'restless' | 'eye_contact' | 'cold_hands';

export interface DareDef {
  kind: DareKind;
  /** The chat's line when the dare appears. */
  ask: string;
  /** One instruction, in the imperative, under the timer. */
  hint: string;
  windowMs: number;
  /** What "done" means, in the units of `unit`. */
  target: number;
  reward: number;
  unit: 'тапов' | 'мс';
}

export const DARES: Record<DareKind, DareDef> = {
  cheek: {
    kind: 'cheek',
    ask: '@miya а слабо пять раз по щеке? не сломайся :peepoShy:',
    hint: 'Тапни по её лицу 5 раз',
    windowMs: 9000,
    target: 5,
    reward: 45,
    unit: 'тапов',
  },
  feet: {
    kind: 'feet',
    ask: 'чат требует: три раза по ступням. она же щекотки боится :LUL:',
    hint: 'Тапни по ступням 3 раза',
    windowMs: 8000,
    target: 3,
    reward: 55,
    unit: 'тапов',
  },
  restless: {
    kind: 'restless',
    ask: 'двенадцать тапов за шесть секунд. кто-нибудь, разгоните её :Pog:',
    hint: '12 тапов за 6 секунд',
    windowMs: 6000,
    target: 12,
    reward: 70,
    unit: 'тапов',
  },
  eye_contact: {
    kind: 'eye_contact',
    ask: 'не двигай мышкой. пусть она поймает твой взгляд :peepoShy:',
    hint: 'Держи курсор на её лице 2.5 с',
    windowMs: 7000,
    target: 2500,
    reward: 50,
    unit: 'мс',
  },
  cold_hands: {
    kind: 'cold_hands',
    ask: 'а слабо НЕ трогать её восемь секунд? :Nosebleed:',
    hint: 'Не трогай её 8 секунд',
    windowMs: 8000,
    target: 8000,
    reward: 60,
    unit: 'мс',
  },
};

export type DareStatus = 'active' | 'done' | 'expired';

export interface DareState {
  kind: DareKind;
  startedMs: number;
  progress: number;
  status: DareStatus;
}

export type DareEvent =
  | { type: 'tap'; zone: TapZoneId }
  | { type: 'hover'; zone: TapZoneId | null; hoverMs: number };

export function startDare(kind: DareKind, nowMs: number): DareState {
  return { kind, startedMs: nowMs, progress: 0, status: 'active' };
}

const finish = (state: DareState, status: DareStatus): DareState => ({ ...state, status });

/** How full the bar is, 0..1. */
export function dareProgressRatio(state: DareState): number {
  const def = DARES[state.kind];
  return Math.max(0, Math.min(1, state.progress / def.target));
}

/** Milliseconds left in the window; 0 once it is over or served. */
export function dareRemainingMs(state: DareState, nowMs: number): number {
  if (state.status !== 'active') return 0;
  return Math.max(0, state.startedMs + DARES[state.kind].windowMs - nowMs);
}

/**
 * One input event against the dare. Unknown events and finished dares are returned untouched, so
 * this can be called from every tap and every frame without a guard at the call site.
 */
export function dareEvent(state: DareState, nowMs: number, event: DareEvent): DareState {
  if (state.status !== 'active') return state;
  const def = DARES[state.kind];
  let next = state;

  if (event.type === 'tap') {
    // "Don't touch her" is the one dare where the input is the failure.
    if (def.kind === 'cold_hands') return finish(state, 'expired');
    const wants =
      def.kind === 'cheek'
        ? event.zone === 'head'
        : def.kind === 'feet'
          ? event.zone === 'feet'
          : def.kind === 'restless'
            ? true
            : false;
    if (wants) next = { ...state, progress: state.progress + 1 };
  } else if (def.kind === 'eye_contact') {
    // A held gaze is a level, not a counter: the bar has to be able to fall back down, otherwise
    // brushing over her face for a frame and then parking somewhere else would still pay.
    const held = event.zone === 'head' ? Math.min(event.hoverMs, def.target) : 0;
    next = { ...state, progress: held };
  }

  if (next.progress >= DARES[next.kind].target) return finish(next, 'done');
  // Out of time on the same event that filled it: done wins, and the check above is why.
  if (nowMs >= state.startedMs + def.windowMs) return finish(next, 'expired');
  return next;
}

/** The clock, once a frame. Serves `cold_hands` (which has no input by design) and expires. */
export function dareClock(state: DareState, nowMs: number): DareState {
  if (state.status !== 'active') return state;
  const def = DARES[state.kind];
  const elapsed = Math.max(0, nowMs - state.startedMs);
  if (def.kind === 'cold_hands') {
    const progress = Math.min(elapsed, def.target);
    if (progress >= def.target) return finish({ ...state, progress }, 'done');
    return { ...state, progress };
  }
  if (elapsed >= def.windowMs) return finish(state, 'expired');
  return state;
}

/**
 * Which dare the chat asks for next. Boldness gates the loud ones — a shy girl's chat does not ask
 * her to hold eye contact — and the previous dare is banned so two in a row never feel scripted.
 */
export function pickDare(
  previous: DareKind | null,
  boldness: number,
  random: () => number,
  day = 1,
): DareKind {
  const bold = boldness >= 55;
  const pool: DareKind[] = bold
    ? ['restless', 'eye_contact', 'cheek', 'feet', 'cold_hands']
    : ['cold_hands', 'cheek', 'eye_contact'];
  if (day >= 3) pool.push('feet');
  const options = pool.filter((k) => k !== previous);
  const list = options.length > 0 ? options : pool;
  const r = Number.isFinite(random()) ? Math.abs(random()) : 0;
  return list[Math.floor(r * list.length) % list.length]!;
}

/** The chat's verdict. Kept next to the dares so the copy moves with the rules. */
export const DARE_LINES = {
  done: [
    'СДЕЛАЛА. она сделала. чат, это была идея чата :Pog:',
    'и ведь не сломалась. уважение :peepoShy:',
    'выполнено. я записываю этот стрим в лучшие :ClipIt:',
  ],
  expired: [
    'не успел. она подождала и вернулась к своим делам :LUL:',
    'слабо, чат. слабо :Nosebleed:',
    'дедлайн прошёл, а она даже не заметила. обидно :peepoShy:',
  ],
  started: [
    'чат просит. она слышала :peepoShy:',
    'ну всё, теперь это челлендж :Pog:',
    'она кивнула. значит, принято :AWOOGA:',
  ],
} as const;

/** What she says when a dare lands — her voice, not the chat's. */
export const DARE_SPEECH = {
  won: [
    'Вот! Видели? Я могу! ...могу же?',
    'Слабо, говорили? Это было не слабо.',
    'Всё, чат, я это сделала. Теперь вы.',
    'Ну и зачем я согласилась... хотя, признаю, было весело.',
  ],
  lost: [
    'Не успели. Я подождала, подождала — и вот.',
    'Чат, вы серьёзно? Я тут стараюсь.',
    'Ладно. Считаю это вашей виной, а не моей.',
  ],
} as const;

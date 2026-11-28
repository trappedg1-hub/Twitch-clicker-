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
 * Who is asking.
 *
 * For the first hour of play the chat asks and she answers, which is the genre's oldest loop. What
 * the best of this genre does is then *flip* it: at some point she stops being the one who is dared
 * and starts daring you. It costs no new art and no new input — the same window, the same bar, the
 * same answer — but it changes who owns the scene, and it is the single hottest switch available
 * here.
 *
 * Rules, so it reads as her and not as a random label:
 *
 *  * **never the first one** — the chat has to establish the verb before she can take it over;
 *  * **only when there is heat** — a bold girl (55+) or a player who is already on a streak;
 *  * **never twice in a row** — a heroine who only ever initiates is as scripted as one who never does;
 *  * **it gets likelier as the streak grows** — the reward for being good is her attention.
 */
export type DareOrigin = 'chat' | 'her';

/** She pays more when she is the one asking — and she knows it. */
export const HER_DARE_BONUS = 1.5;

export interface DareOriginContext {
  /** 1-based counter of dares this session. */
  seq: number;
  streak: number;
  boldness: number;
  lastOrigin: DareOrigin | null;
  random: () => number;
}

/** Chance she takes over, given the room. Pure, so the ramp is testable. */
export function herDareChance(streak: number, boldness: number): number {
  const s = Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
  const b = Number.isFinite(boldness) ? boldness : 0;
  if (s < 1 && b < 55) return 0;
  const base = 0.3 + 0.12 * s + (b >= 80 ? 0.12 : b >= 55 ? 0.05 : 0);
  return Math.min(0.7, base);
}

export function pickDareOrigin(ctx: DareOriginContext): DareOrigin {
  if (ctx.seq < 2) return 'chat';
  if (ctx.lastOrigin === 'her') return 'chat';
  const chance = herDareChance(ctx.streak, ctx.boldness);
  if (chance <= 0) return 'chat';
  const r = Number.isFinite(ctx.random()) ? Math.abs(ctx.random()) : 1;
  return r < chance ? 'her' : 'chat';
}

/** What she says when she is the one asking. Two registers: the tease and the dare. */
export const HER_DARE_LINES: Record<'ask' | 'won' | 'lost', readonly string[]> = {
  ask: [
    'Так, чат, тихо. Теперь я. Смотри мне в глаза и не смей отвлекаться.',
    'Я хочу кое-что проверить. Сможешь — я запомню. Не сможешь — тоже.',
    'Моё задание. И оно сложнее, чем кажется: слушайся.',
    'Знаешь, что мне нравится больше всего? Когда ты делаешь, что я прошу.',
  ],
  won: [
    'Видишь, что со мной делает твоё внимание? Вот и не отвлекайся.',
    'Хороший. Я запомнила это — и запомню ещё раз.',
    'Теперь ты понимаешь, почему я согласилась на этот стрим.',
    'Всё, я довольна. Пока довольна.',
  ],
  lost: [
    'Не справился. А я так старалась придумать.',
    'Хм. Я запомню, что ты сдался.',
    'Ну и кто из нас теперь слабо? Ладно, в следующий раз.',
  ],
} as const;

/**
 * The same instruction, in her voice. The chat's hint is a task ("Тапни по её лицу 5 раз"); hers is
 * something she says to one person in the room ("Пять раз по щеке. Я считаю. Не заставляй меня
 * ждать."). Same game, different owner — and the copy is where the player feels it.
 */
export const HER_HINTS: Record<DareKind, string> = {
  cheek: 'Пять раз по щеке. Я считаю — не заставляй ждать.',
  feet: 'Три раза по ступням. Мне щекотно, а тебе весело?',
  restless: 'Двенадцать за шесть секунд. Покажи, на что ты способен.',
  eye_contact: 'Смотри мне в глаза. Не отводи — я замечу.',
  cold_hands: 'Восемь секунд не трогай меня. Только попробуй.',
};

/** What the chat does when she wins her own dare: the audience is always a step behind her. */
export const HER_DARE_AFTERGLOW = [
  'ОНА ВЫИГРАЛА СВОЁ ЖЕ ЗАДАНИЕ. чат, мы тут вообще нужны :Pog:',
  'это был не челлендж, это был флирт :Nosebleed:',
  'она довольна. вы видели, как она довольна? :AWOOGA:',
  'записывайте: с этой минуты условия диктует она :ClipIt:',
] as const;

/** The chat's reaction when she takes the wheel: the audience is always a step behind her. */
export const HER_DARE_CHAT = [
  'она сама попросила. ЧАТ, ОНА САМА :AWOOGA:',
  'это уже не челлендж чата, это её челлендж :Pog:',
  'она диктует условия. я тут вообще зачем :Nosebleed:',
] as const;

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

/** Her face when the chat asks for something. Half of the joke is that she heard it. */
export const DARE_HEARD = [
  'А? Что? ...ладно, ладно. Показываю.',
  'Чат, вы серьёзно? ...Ну давайте.',
  'Я всё слышала. И я это сделаю, вот увидите.',
  'Опять ваши идеи. Ладно, только быстро.',
] as const;

/**
 * A streak is what turns five little dares into a session: the chat remembers. Each one in a row
 * is worth a quarter more, capped at double, and the multiplier resets the moment one is missed —
 * which is also what makes missing one sting.
 */
export const DARE_STREAK_STEP = 0.25;
export const DARE_STREAK_MAX = 4;

export function dareStreakMultiplier(streak: number): number {
  const s = Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
  return 1 + DARE_STREAK_STEP * Math.min(s, DARE_STREAK_MAX);
}

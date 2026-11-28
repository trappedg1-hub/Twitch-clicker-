import type { ChatMessage } from '../chat/chatEngine.ts';
import {
  DAY1_FAREWELL_LINES,
  DAY2_FAREWELL_LINES,
  DAY3_FAREWELL_LINES,
  DAY4_FAREWELL_LINES,
  DAY5_FAREWELL_LINES,
  DAY6_FAREWELL_LINES,
  getStreamTitle,
} from '../domain/dialogue.ts';
import { STREAM_CHALLENGES } from '../domain/progression.ts';
import {
  dayFinaleSubs,
  getShortStepLabelsForDay,
  getStepLabelsForDay,
  isDay3Unlocked,
  isDay4Unlocked,
  isDay5Unlocked,
  isDay6Unlocked,
  SUB_GOAL_STAGES,
  getGiftSubPackCost,
  getSubGoalStagesForDay,
} from '../domain/subGoals.ts';
import type {
  BottomTabId,
  ChallengeId,
  ComputedStats,
  GameState,
  SubGoalStageIndex,
  UpgradeId,
} from '../domain/types.ts';
import { getMicTier, getUpgradeCost, TIER1_MILESTONES, TIER1_UPGRADES } from '../domain/upgrades.ts';
import { renderChatTextWithEmotes } from './twitchEmotes.ts';
import { sfx } from '../audio/sfx.ts';

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M ₽`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k ₽`;
  return `${Math.floor(n)} ₽`;
}

const UPGRADE_SVGS: Record<UpgradeId, string> = {
  ring_lamp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="10" r="6.5"/><circle cx="12" cy="10" r="2.8" stroke-opacity="0.55"/><path d="M12 16.5V21M8.5 21h7"/></svg>`,
  usb_mic_pop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="10" rx="3"/><path d="M5.5 10.5a6.5 6.5 0 0013 0M12 17v4M8.5 21h7"/></svg>`,
  obs_alerts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13.5H12L11 22L19.5 10.5H12L13 2Z"/></svg>`,
  webcam_focus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="13" rx="3"/><circle cx="12" cy="11.5" r="3.5"/><path d="M8 21h8"/></svg>`,
  chat_emotes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5s-7-4.5-7-10.2A4.2 4.2 0 019.2 6c1.4 0 2.3.7 2.8 1.6.5-.9 1.4-1.6 2.8-1.6A4.2 4.2 0 0119 10.3c0 5.7-7 10.2-7 10.2z"/></svg>`,
  clips_boost: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,4 19,12 5,20"/></svg>`,
  desk_mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="10" rx="3"/><path d="M5.5 10.5a6.5 6.5 0 0013 0M12 17v4M8.5 21h7"/></svg>`,
};

export class UiController {
  private readonly titleEl = document.getElementById('stream-title')!;
  private readonly subsValEl = document.getElementById('stat-subs-val')!;
  private readonly boldnessFillEl = document.getElementById('boldness-fill')!;
  private readonly boldnessPctEl = document.getElementById('boldness-pct')!;

  private readonly obsSubgoalEl = document.getElementById('obs-subgoal')!;
  private readonly subgoalTargetNameEl = document.getElementById('subgoal-target-name')!;
  private readonly subgoalCountEl = document.getElementById('subgoal-count')!;
  private readonly subgoalPctEl = document.getElementById('subgoal-pct')!;
  private readonly subgoalFillEl = document.getElementById('subgoal-fill')!;
  private readonly subgoalStepEls = Array.from(
    document.querySelectorAll<HTMLElement>('#subgoal-steps-row .goal-step'),
  );
  private readonly giftBtn1El = document.getElementById('btn-gift-sub-1') as HTMLButtonElement;
  private readonly giftMenuBtnEl = document.getElementById('btn-gift-sub-menu') as HTMLButtonElement;
  private readonly subPackMenuEl = document.getElementById('sub-pack-menu') as HTMLElement;
  private readonly subPackRowEls = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#sub-pack-menu .sub-pack-row'),
  );
  private readonly giftCost1El = document.getElementById('gift-cost-1')!;
  private readonly giftCostPackEl = document.getElementById('gift-cost-pack')!;
  /** Quantity picked in the gift-sub popup; the big button on its left always stays a single sub. */
  private subPackQty = 5;

  private readonly viewersEl = document.getElementById('stat-viewers-val')!;
  private readonly balanceEl = document.getElementById('stat-balance-val')!;
  private readonly incomeEl = document.getElementById('stat-income-val')!;
  private readonly hypeMultEl = document.getElementById('stat-hype-mult')!;
  private readonly hypeFillEl = document.getElementById('stat-hype-fill')!;

  // The chat's dare: one chip, shown while a dare is live. Read defensively — an older build of
  // the markup (or the lab pages) simply has no chip and the game runs without it.
  private readonly dareEl = document.getElementById('chat-dare') as HTMLElement | null;
  private readonly dareHintEl = document.getElementById('chat-dare-hint') as HTMLElement | null;
  private readonly dareTimerEl = document.getElementById('chat-dare-timer') as HTMLElement | null;
  private readonly dareFillEl = document.getElementById('chat-dare-fill') as HTMLElement | null;
  private readonly dareCountEl = document.getElementById('chat-dare-count') as HTMLElement | null;

  private readonly dareStreakEl = document.getElementById('chat-dare-streak');
  private readonly dareKickerEl = document.querySelector<HTMLElement>('.chat-dare-kicker');
  /** Wall clock until which ordinary speech lines are ignored (a payout or a milestone is up). */
  private speechLockUntil = 0;
  private readonly speechSubEl = document.getElementById('speech-subtitle')!;
  private readonly speechTextEl = document.getElementById('speech-text')!;

  private readonly milestoneLabelEl = document.getElementById('milestone-progress-label')!;
  private readonly milestoneTitleEl = document.getElementById('milestone-title')!;
  private readonly milestoneFillEl = document.getElementById('milestone-fill')!;

  private readonly alertBoxEl = document.getElementById('donation-alert')!;
  private readonly alertAmountEl = document.getElementById('donation-alert-amount')!;
  private readonly alertSubEl = document.getElementById('donation-alert-sub')!;

  private readonly chatMessagesEl = document.getElementById('chat-messages')!;
  private readonly upgAvailDotEl = document.getElementById('upg-avail-dot')!;
  private readonly subAvailDotEl = document.getElementById('sub-avail-dot')!;

  private readonly tabDrawerEl = document.getElementById('tab-drawer')!;
  private readonly upgradesGridEl = document.getElementById('upgrades-grid')!;
  private readonly outfitsGridEl = document.getElementById('outfits-grid')!;
  private readonly challengesGridEl = document.getElementById('challenges-grid')!;

  private readonly diaryStagePillEl = document.getElementById('diary-stage-pill')!;
  private readonly diaryHeadlineEl = document.getElementById('diary-headline')!;
  private readonly diaryThoughtEl = document.getElementById('diary-thought')!;

  private readonly dayBadgeEl = document.getElementById('stream-day-badge')!;
  private readonly finaleOverlayEl = document.getElementById('day-finale-overlay')!;
  private readonly finaleOpenBtnEl = document.getElementById('btn-finale-open')!;
  private readonly finaleCloseBtnEl = document.getElementById('btn-finale-close')!;
  /** Optional on purpose: the game runs headless in tests, where there is no HUD to toggle. */
  private readonly soundBtnEl = document.getElementById('btn-sound') as HTMLButtonElement | null;
  /**
   * The finale card is player-invoked. `false` means "the day is closed, but the stream is still
   * hers": taps, gifts and her commentary keep running, and nothing is covered by the modal.
   */
  private finaleCardOpen = false;
  private readonly finaleCardEl = document.querySelector('.day-finale-card') as HTMLElement;
  private readonly finaleKickerEl = document.getElementById('finale-kicker')!;
  private readonly finaleTitleEl = document.getElementById('finale-title')!;
  private readonly finaleDescEl = document.getElementById('finale-desc')!;
  private readonly farewellBlockEl = document.getElementById('finale-farewell')!;
  private readonly farewellLineEl = document.getElementById('finale-farewell-line')!;
  private readonly skipFarewellBtnEl = document.getElementById('btn-skip-farewell') as HTMLButtonElement;
  private readonly startDay2BtnEl = document.getElementById('btn-start-day2') as HTMLButtonElement;
  // Day 1 finale farewell state machine: Miya says good-bye before Day 2 unlocks.
  private farewellPhase: 'idle' | 'playing' | 'done' = 'idle';
  /** Which day's farewell is playing (1 = Day 1 -> Day 2, 2 = Day 2 -> Day 3). */
  private farewellDay: 1 | 2 | 3 | 4 | 5 | 6 = 1;
  private farewellTimers: number[] = [];

  private activeTab: BottomTabId = 'stream';
  private alertTimer?: number;
  private speechPopTimer?: number;
  private speechFadeTimer?: number;
  private upgradeButtons = new Map<UpgradeId, HTMLButtonElement>();
  private outfitCards = new Map<SubGoalStageIndex, HTMLElement>();
  private challengeButtons = new Map<ChallengeId, HTMLButtonElement>();

  private syncSoundButton(): void {
    if (!this.soundBtnEl) return;
    const on = sfx.isEnabled;
    this.soundBtnEl.setAttribute('aria-pressed', on ? 'true' : 'false');
    this.soundBtnEl.title = on ? 'Звук: вкл (M)' : 'Звук: выкл (M)';
  }

  public onBuyUpgrade?: (id: UpgradeId) => void;
  public onGiftSubs?: (count: number) => void;
  public onSelectSubStage?: (stage: SubGoalStageIndex) => void;
  public onTriggerChallenge?: (id: ChallengeId) => void;
  public onTabChange?: (tab: BottomTabId) => void;
  public onStartDay2?: () => void;
  /** Fired for every farewell beat so the app layer can push matching chat goodbyes. */
  public onFarewellBeat?: (index: number) => void;

  public init(): void {
    this.setupTabs();
    this.setupGiftSubButtons();
    this.buildUpgradeCards();
    this.buildOutfitCards();
    this.buildChallengeCards();
    this.startDay2BtnEl.addEventListener('click', () => this.onStartDay2?.());
    this.finaleOpenBtnEl.addEventListener('click', () => this.openFinaleCard());
    this.syncSoundButton();
    this.soundBtnEl?.addEventListener('click', () => {
      sfx.toggle();
      this.syncSoundButton();
    });
    // `M` for mute, because a clicker is played with one hand on the mouse and the other on the
    // keyboard, and reaching for a 26 px button in a corner is a way to lose a combo.
    window.addEventListener('keydown', (event) => {
      if (event.key !== 'm' && event.key !== 'M' && event.key !== 'ь' && event.key !== 'Ь') return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      event.preventDefault();
      sfx.toggle();
      this.syncSoundButton();
    });
    this.finaleCloseBtnEl.addEventListener('click', () => this.closeFinaleCard());
    this.skipFarewellBtnEl.addEventListener('click', () => this.finishFarewell());

    // Auto-fade initial subtitle after 4.2s so video stays 100% pure when idle
    this.speechFadeTimer = window.setTimeout(() => {
      this.speechSubEl.classList.remove('visible');
    }, 4200);
  }

  private setupGiftSubButtons(): void {
    this.giftBtn1El.addEventListener('click', () => this.onGiftSubs?.(1));

    const close = (): void => {
      this.subPackMenuEl.hidden = true;
      this.giftMenuBtnEl.setAttribute('aria-expanded', 'false');
    };
    const open = (): void => {
      this.subPackMenuEl.hidden = false;
      this.giftMenuBtnEl.setAttribute('aria-expanded', 'true');
    };
    this.giftMenuBtnEl.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (this.subPackMenuEl.hidden) open();
      else close();
    });
    this.subPackRowEls.forEach((row) => {
      row.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const qty = Number(row.dataset.pack);
        if (!Number.isFinite(qty) || qty <= 0) return;
        this.subPackQty = qty;
        this.onGiftSubs?.(qty);
        close();
      });
    });
    // Click anywhere else (or Escape) dismisses it - same as the native Twitch picker.
    document.addEventListener('click', (ev) => {
      if (this.subPackMenuEl.hidden) return;
      if (!this.subPackMenuEl.contains(ev.target as Node)) close();
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !this.subPackMenuEl.hidden) {
        close();
        this.giftMenuBtnEl.focus();
      }
    });
  }

  private setupTabs(): void {
    const tabBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.tw-tab'));
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const clicked = btn.dataset.tab as BottomTabId;
        if (clicked !== 'stream' && this.activeTab === clicked) {
          this.switchTab('stream');
        } else {
          this.switchTab(clicked);
        }
      });
    });
  }

  public switchTab(tab: BottomTabId): void {
    this.activeTab = tab;
    document.querySelectorAll<HTMLButtonElement>('.tw-tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });

    if (tab === 'stream') {
      this.tabDrawerEl.classList.add('hidden');
      document.body.classList.remove('drawer-open');
    } else {
      this.tabDrawerEl.classList.remove('hidden');
      document.body.classList.add('drawer-open');
      document.querySelectorAll<HTMLElement>('.tab-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === `tab-panel-${tab}`);
      });
    }
    this.onTabChange?.(tab);
  }

  private buildUpgradeCards(): void {
    this.upgradesGridEl.innerHTML = '';
    for (const def of TIER1_UPGRADES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'upgrade-card';
      btn.dataset.upgradeId = def.id;
      btn.addEventListener('click', () => this.onBuyUpgrade?.(def.id));
      this.upgradesGridEl.appendChild(btn);
      this.upgradeButtons.set(def.id, btn);
    }
  }

  private buildOutfitCards(): void {
    this.outfitsGridEl.innerHTML = '';
    for (const st of SUB_GOAL_STAGES) {
      const card = document.createElement('div');
      card.className = 'outfit-card';
      card.dataset.subStage = String(st.stage);
      card.addEventListener('click', () => this.onSelectSubStage?.(st.stage));
      this.outfitsGridEl.appendChild(card);
      this.outfitCards.set(st.stage, card);
    }
  }

  private buildChallengeCards(): void {
    this.challengesGridEl.innerHTML = '';
    for (const ch of STREAM_CHALLENGES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'challenge-card';
      btn.dataset.challengeId = ch.id;
      btn.addEventListener('click', () => this.onTriggerChallenge?.(ch.id));
      this.challengesGridEl.appendChild(btn);
      this.challengeButtons.set(ch.id, btn);
    }
  }

  /** The farewell belongs to whichever day just ended. */
  private farewellLines(): readonly string[] {
    if (this.farewellDay === 6) return DAY6_FAREWELL_LINES;
    if (this.farewellDay === 5) return DAY5_FAREWELL_LINES;
    if (this.farewellDay === 4) return DAY4_FAREWELL_LINES;
    if (this.farewellDay === 3) return DAY3_FAREWELL_LINES;
    return this.farewellDay === 2 ? DAY2_FAREWELL_LINES : DAY1_FAREWELL_LINES;
  }

  /** The player asked for the finale card: show it and let the farewell start now, not before. */
  public openFinaleCard(): void {
    this.finaleCardOpen = true;
    if (this.farewellPhase === 'idle') this.startFarewell();
  }

  /** Back to the stream: the card closes, the day stays finished, everything stays clickable. */
  public closeFinaleCard(): void {
    this.finaleCardOpen = false;
    this.finaleOverlayEl.classList.add('hidden');
  }

  /** Play Miya's goodbye to the chat, beat by beat, then unlock the next-day button. */
  private startFarewell(): void {
    this.clearFarewellTimers();
    this.farewellPhase = 'playing';
    this.finaleCardEl.classList.remove('finale-ready');
    this.skipFarewellBtnEl.classList.remove('hidden');
    this.startDay2BtnEl.disabled = true;
    const lines = this.farewellLines();
    const beatMs = 2900;
    for (let i = 1; i < lines.length; i++) {
      this.farewellTimers.push(
        window.setTimeout(() => this.showFarewellBeat(i), i * beatMs),
      );
    }
    this.farewellTimers.push(
      window.setTimeout(() => this.finishFarewell(), lines.length * beatMs + 500),
    );
    this.showFarewellBeat(0);
  }

  private showFarewellBeat(index: number): void {
    if (this.farewellPhase !== 'playing') return;
    const line = this.farewellLines()[index];
    if (!line) return;
    this.farewellLineEl.textContent = line;
    this.farewellBlockEl.classList.remove('beat-in');
    void this.farewellBlockEl.offsetWidth; // restart the fade-in animation
    this.farewellBlockEl.classList.add('beat-in');
    this.onFarewellBeat?.(index);
  }

  private finishFarewell(): void {
    if (this.farewellPhase === 'done') return;
    this.clearFarewellTimers();
    const lines = this.farewellLines();
    const last = lines[lines.length - 1];
    if (last) this.farewellLineEl.textContent = last;
    this.farewellPhase = 'done';
    this.skipFarewellBtnEl.classList.add('hidden');
    this.finaleCardEl.classList.add('finale-ready');
    // The button leads to the NEXT day, so it lights up on that day's art gate. Day 5 is the last day
    // built so far, so its own card has nothing to hand the player to — the copy says so instead.
    this.startDay2BtnEl.disabled =
      this.farewellDay === 5
        ? !isDay6Unlocked()
        : this.farewellDay === 2
        ? !isDay3Unlocked()
        : this.farewellDay === 3
          ? !isDay4Unlocked()
          : this.farewellDay === 4
            ? !isDay5Unlocked()
            : true;
  }

  private resetFarewell(): void {
    this.clearFarewellTimers();
    this.farewellPhase = 'idle';
    this.finaleCardEl.classList.remove('finale-ready');
    this.skipFarewellBtnEl.classList.remove('hidden');
    this.farewellLineEl.textContent =
      'Мия поправляет наушники, смотрит в чат и собирается с мыслями...';
  }

  private clearFarewellTimers(): void {
    this.farewellTimers.forEach((t) => window.clearTimeout(t));
    this.farewellTimers = [];
  }

  public render(state: GameState, stats: ComputedStats, nowMs = Date.now()): void {
    this.dayBadgeEl.textContent =
      state.streamDay === 6
        ? 'День 6 ★ ДЕРЕВНЯ'
        : state.streamDay === 5
        ? 'День 5 ★ БИКИНИ'
        : state.streamDay === 4
          ? 'День 4 ★ ЙОГА'
        : state.streamDay === 3
          ? 'День 3 ★ ПРИЗРАК'
          : state.streamDay === 2
            ? 'День 2 ★'
            : 'День 1';
    const finaleDay: 1 | 2 | 3 | 4 | 5 | 6 =
      state.streamDay === 6
        ? 6
        : state.streamDay === 5
        ? 5
        : state.streamDay === 4
          ? 4
          : state.streamDay === 3
            ? 3
            : state.streamDay === 2
              ? 2
              : 1;
    const finaleTarget = dayFinaleSubs(finaleDay);
    const isFinale = state.subscribers >= finaleTarget && state.streamDay <= 6;
    if (isFinale && this.farewellDay !== finaleDay) {
      this.farewellDay = finaleDay;
      this.farewellPhase = 'idle';
    }
    if (isFinale) {
      this.finaleKickerEl.textContent =
        finaleDay === 6
          ? '★ ФИНАЛ ДЕРЕВЕНСКОГО ДНЯ ★'
          : finaleDay === 5
          ? '★ ФИНАЛ БИКИНИ-ДНЯ: 5 БИКИНИ СТРИМ ★'
          : finaleDay === 4
          ? '★ ФИНАЛ ЙОГА-ДНЯ: РАСТЯЖКА ★'
          : finaleDay === 3
          ? '★ ФИНАЛ КОСПЛЕЙ-ДНЯ: ПРИЗРАК ★'
          : finaleDay === 2
            ? '★ ФИНАЛ ВТОРОГО ДНЯ ★'
            : '★ ФИНАЛ ПЕРВОГО ДНЯ ★';
      this.finaleTitleEl.textContent = `${finaleTarget} сабов пробито!`;
      this.finaleDescEl.innerHTML =
        finaleDay === 6
          ? `Деревенский эфир закрыт: <strong>${finaleTarget} сабов</strong>. Урожай собран, чат доволен!`
          : finaleDay === 5
          ? `Бикини-эфир закрыт: <strong>${finaleTarget} сабов</strong>, четыре кадра и ни одна деталь не сдвинулась. Мия сама выбирала ракурс — и уже думает, что вы набьёте в следующий раз.`
          : finaleDay === 4
          ? `Йога-эфир закрыт: <strong>${finaleTarget} сабов</strong>, четыре позы и ни одна снятая вещь. Мия осталась сидеть в кресле и думает, какой формат выбрать дальше.`
          : finaleDay === 3
          ? `Призрачный эфир закрыт: <strong>${finaleTarget} сабов</strong>, простыня стала плащом. Мия уже думает, какой формат выбрать на следующий стрим.`
          : finaleDay === 2
          ? 'Второй эфир окончен: Мия прощается с чатом и уносит костюм. <strong>Завтра — День 3: косплей-стрим</strong>, и она обещала сюрприз.'
          : 'Первый эфир окончен: Мия прощается с чатом и выключает камеру. <strong>Завтра — День 2</strong>: новый образ и новые Sub Goal.';
      // The CTA names the day it opens, and its gate is that NEXT day's art probe — so a card never
      // promises a ladder whose plates are not in the build. Day 5 is the last day with art today, so
      // its own card has nothing to hand the player to and stays a read-only goodbye.
      this.startDay2BtnEl.textContent =
        finaleDay === 6
          ? 'Деревенский день закрыт'
          : finaleDay === 5
          ? (isDay6Unlocked() ? 'Начать День 6 (деревенская девочка) →' : 'Арты дня 6 ещё не загружены')
          : finaleDay === 4
            ? isDay5Unlocked()
              ? 'Начать День 5 (5 бикини стрим) →'
              : 'Микро-бикини ещё не в сборке — открытие завтра'
            : finaleDay === 3
              ? isDay4Unlocked()
                ? 'Начать День 4 (растяжка с Мией) →'
                : 'Коврик ещё не свёрнут — открытие завтра'
              : finaleDay === 2
                ? isDay3Unlocked()
                  ? 'Начать День 3 (призрачный косплей) →'
                  : 'Простыня ещё не подшита — открытие завтра'
                : 'Начать День 2 →';
      this.finaleOpenBtnEl.classList.remove('hidden');
      this.finaleOpenBtnEl.textContent =
        finaleDay === 6
          ? '★ Деревенский день закрыт — открыть финал'
          : finaleDay === 5
          ? '★ Бикини-день закрыт — открыть финал'
          : finaleDay === 4
          ? '★ Йога-день закрыт — открыть финал'
          : finaleDay === 3
          ? '★ Косплей-день закрыт — открыть финал'
          : finaleDay === 2
            ? '★ День 2 закрыт — открыть финал'
            : '★ День 1 закрыт — открыть финал';
    } else {
      this.finaleOpenBtnEl.classList.add('hidden');
    }
    // Never opened by itself: `finaleCardOpen` is only true after the player pressed the CTA. So the
    // «Бу!» frame stays on screen and clickable, and the day transition stays their decision.
    this.finaleOverlayEl.classList.toggle('hidden', !isFinale || !this.finaleCardOpen);
    if (isFinale && this.finaleCardOpen) {
      // The Day-3 button re-checks the art probe on every render, so it lights up without a reload.
      if (this.farewellPhase === 'done') {
        this.startDay2BtnEl.disabled =
          finaleDay === 6
            ? true
            : finaleDay === 5
            ? !isDay6Unlocked()
            : finaleDay === 4
              ? !isDay5Unlocked()
              : finaleDay === 3
                ? !isDay4Unlocked()
              : finaleDay === 2
                ? !isDay3Unlocked()
                : false;
      }
    }
    if (!isFinale && (this.farewellPhase !== 'idle' || this.finaleCardOpen)) {
      this.finaleCardOpen = false;
      this.resetFarewell();
    }
    this.titleEl.textContent = getStreamTitle(
      state.displayedSubStage,
      state.subscribers,
      state.streamDay,
    );
    this.subsValEl.textContent = String(state.subscribers);
    this.boldnessFillEl.style.width = `${stats.boldness}%`;
    this.boldnessPctEl.textContent = `${Math.floor(stats.boldness)}%`;

    // Top-Left Twitch Creator Sub Goal Bar (Day 1: 10/50/200/500 — Day 2: 1500/2000/2500/5000)
    const dayLadder = getSubGoalStagesForDay(state.streamDay);
    const nextGoal = stats.nextSubGoalDef;
    const prevFloor = dayLadder[state.unlockedSubStage]?.subsRequired ?? 0;
    if (nextGoal) {
      this.obsSubgoalEl.classList.remove('completed');
      this.subgoalTargetNameEl.textContent = `${nextGoal.subsRequired} сабов — ${nextGoal.shortGoalTitle}`;
      this.subgoalCountEl.textContent = `${state.subscribers} / ${nextGoal.subsRequired} сабов`;
      const span = Math.max(1, nextGoal.subsRequired - prevFloor);
      const pct = Math.min(100, Math.max(0, Math.round(((state.subscribers - prevFloor) / span) * 100)));
      this.subgoalPctEl.textContent = `${pct}%`;
      this.subgoalFillEl.style.width = `${pct}%`;
    } else {
      this.obsSubgoalEl.classList.add('completed');
      this.subgoalTargetNameEl.textContent =
        state.streamDay === 6
          ? `День 6: урожай собран — ${finaleTarget} сабов! ★`
          : state.streamDay === 5
          ? `День 5: камера взяла всё, что обещала — ${finaleTarget} сабов! ★`
          : state.streamDay === 4
          ? `День 4: кресло выдержало всё — ${finaleTarget} сабов! ★`
          : state.streamDay === 3
          ? `День 3: призрак ушёл сквозь стену — ${finaleTarget} сабов! ★`
          : state.streamDay === 2
            ? 'День 2: финал пробит — 5000 сабов! ★'
            : 'Финал Дня 1 пробит — 500 сабов! ★';
      this.subgoalCountEl.textContent = `${state.subscribers} сабов`;
      this.subgoalPctEl.textContent = '100% ★';
      this.subgoalFillEl.style.width = '100%';
    }

    const stepLabels = getStepLabelsForDay(state.streamDay);
    const shortStepLabels = getShortStepLabelsForDay(state.streamDay);
    const isNarrow = window.innerWidth <= 680;
    this.subgoalStepEls.forEach((el, idx) => {
      const stepStage = idx + 1;
      const lbl = (isNarrow ? shortStepLabels : stepLabels)[idx];
      // Day 4 unlocks three goals, not four, so the row's last chip has nothing to show. Hiding it is
      // what keeps the strip honest; leaving it blank reads as a goal the player can never reach.
      if (lbl === undefined) {
        el.classList.add('hidden');
        el.textContent = '';
        return;
      }
      el.classList.remove('hidden');
      const done = state.unlockedSubStage >= stepStage;
      const active = state.unlockedSubStage + 1 === stepStage;
      el.classList.toggle('done', done);
      el.classList.toggle('active', active);
      el.textContent = done ? `✓${isNarrow ? '' : ' '}${lbl}` : lbl;
    });

    const cost1 = getGiftSubPackCost(state.subscribers, 1);
    this.giftCost1El.textContent = formatMoney(cost1);
    const canGift1 = state.balance >= cost1;
    this.giftBtn1El.disabled = !canGift1;
    this.giftBtn1El.classList.toggle('affordable', canGift1);

    // Pack rows: live price per option, unaffordable ones grey out, the caret shows what is picked.
    for (const row of this.subPackRowEls) {
      const qty = Number(row.dataset.pack);
      const cost = getGiftSubPackCost(state.subscribers, qty);
      const costEl = row.querySelector('span');
      if (costEl) costEl.textContent = formatMoney(cost);
      const canBuy = state.balance >= cost;
      row.disabled = !canBuy;
      row.classList.toggle('selected', qty === this.subPackQty);
      row.title = canBuy
        ? `Подарить ${qty} подписок за ${formatMoney(cost)}`
        : `Не хватает ${formatMoney(cost - state.balance)}`;
    }
    const packCost = getGiftSubPackCost(state.subscribers, this.subPackQty);
    const packLabel = this.giftMenuBtnEl.querySelector('.tw-sub-pack-now');
    if (packLabel) packLabel.textContent = `x${this.subPackQty}`;
    this.giftCostPackEl.textContent = formatMoney(packCost);
    this.giftMenuBtnEl.disabled = false;
    this.giftMenuBtnEl.classList.toggle('affordable', state.balance >= packCost);

    this.subAvailDotEl.classList.toggle(
      'hidden',
      !canGift1 || nextGoal === null || this.activeTab === 'outfits',
    );

    this.viewersEl.textContent = String(stats.onlineViewers);
    this.balanceEl.textContent = formatMoney(state.balance);
    this.incomeEl.textContent =
      stats.passivePerSec > 0
        ? `+${stats.clickIncome} • ${stats.passivePerSec}/с`
        : `+${stats.clickIncome} ₽/клик`;
    this.hypeMultEl.textContent = `x${stats.hypeMultiplier.toFixed(2)}`;
    this.hypeFillEl.style.width = `${Math.min(100, Math.max(0, state.hype))}%`;

    // Viewer Milestone bar
    const next = stats.nextMilestone;
    if (next) {
      this.milestoneLabelEl.textContent = `/ ${next.viewersRequired}`;
      this.milestoneTitleEl.textContent = `• Цель: ${next.title}`;
      const pct = Math.min(100, Math.round((stats.onlineViewers / next.viewersRequired) * 100));
      this.milestoneFillEl.style.width = `${pct}%`;
    } else {
      const last = TIER1_MILESTONES[TIER1_MILESTONES.length - 1]!;
      this.milestoneLabelEl.textContent = 'MAX';
      this.milestoneTitleEl.textContent = `• Пик Тир-1 (${last.viewersRequired}+ онл.)`;
      this.milestoneFillEl.style.width = '100%';
    }

    // Story diary
    this.diaryStagePillEl.textContent = 'Дневник Мии';
    this.diaryHeadlineEl.textContent = stats.storyChapter.headline;
    this.diaryThoughtEl.textContent = stats.storyChapter.diaryThought;

    // Sub Goal Outfit Stage Cards — the CURRENT DAY's ladder (10/50/200/500 or 1500/2000/2500/5000)
    const liveStages = new Set(dayLadder.map((st) => st.stage));
    for (const [stage, card] of this.outfitCards) {
      // The grid is built once from Day 1's five stages. A shorter ladder (Day 4: four) must hide the
      // surplus card instead of showing the costume the PREVIOUS day left written on it.
      card.classList.toggle('hidden', !liveStages.has(stage));
    }
    for (const st of dayLadder) {
      const card = this.outfitCards.get(st.stage);
      if (!card) continue;
      const unlocked = state.unlockedSubStage >= st.stage;
      const equipped = state.displayedSubStage === st.stage;
      card.className = `outfit-card ${equipped ? 'equipped' : unlocked ? 'unlocked' : 'locked'}`;

      let statusHtml = '';
      if (equipped) {
        statusHtml =
          state.streamDay === 2 && st.stage === 0
            ? '✓ Сейчас в кадре (образ Дня 2)'
            : `✓ Сейчас в кадре (${st.subsRequired === 0 ? 'Старт' : `${st.subsRequired} сабов`})`;
      } else if (unlocked && state.streamDay === 2) {
        statusHtml = `Открыто (${st.subsRequired} сабов) • Надеть этот образ`;
      } else if (unlocked) {
        statusHtml = `Открыто (${st.subsRequired} сабов) • Нажмите, чтобы надеть`;
      } else {
        const missing = Math.max(1, st.subsRequired - state.subscribers);
        statusHtml = `★ Цель: ${st.subsRequired} сабов (ещё ${missing})`;
      }

      const nextHtml = `
        <div>
          <div class="outfit-head">
            <span class="outfit-name">${
              st.stage === 0 && state.streamDay === 1
                ? 'Старт: Худи + носочки'
                : state.streamDay === 2
                  ? `День 2 • ${st.subsRequired === 0 ? '' : `${st.subsRequired}: `}${st.outfitName}`
                  : st.outfitName
            }</span>
            <span class="outfit-mult">x${st.incomeMultiplier.toFixed(2)}</span>
          </div>
          <p class="outfit-desc">${st.storyDesc}</p>
        </div>
        <div class="outfit-req ${equipped ? 'active-tag' : ''}">${statusHtml}</div>
      `;
      if (card.dataset.renderedHtml !== nextHtml) {
        card.dataset.renderedHtml = nextHtml;
        card.innerHTML = nextHtml;
      }
    }

    // Upgrade cards + notify dot when on 'stream' tab
    let anyAffordable = false;
    for (const def of TIER1_UPGRADES) {
      const btn = this.upgradeButtons.get(def.id);
      if (!btn) continue;
      const lvl = state.upgrades[def.id] ?? 0;
      const isMax = lvl >= def.maxLevel;
      const cost = getUpgradeCost(def, lvl);
      const canAfford = !isMax && state.balance >= cost;
      if (canAfford) anyAffordable = true;

      btn.disabled = isMax;
      btn.classList.toggle('affordable', canAfford);
      const lvlPct = Math.min(100, Math.round((lvl / def.maxLevel) * 100));
      const svgIcon = UPGRADE_SVGS[def.id];
      const micTier = def.id === 'desk_mic' ? getMicTier(lvl) : null;
      const micPreviewHtml =
        def.id === 'desk_mic'
          ? micTier
            ? `<div class="upg-mic-preview"><img src="${micTier.spriteUrl}" alt="" /><span class="upg-mic-name">Тир ${micTier.tier}: ${micTier.modelName}</span></div>`
            : `<div class="upg-mic-preview"><span class="upg-mic-name">На столе пока пусто — купи Тир 1!</span></div>`
          : '';
      const nextUpgHtml = `
        <div class="upg-icon-tile">${svgIcon}</div>
        <div class="upg-main">
          <div class="upg-top">
            <span class="upg-name">${def.name}</span>
            <span class="upg-lvl">Ур. ${lvl}/${def.maxLevel}</span>
          </div>
          <div class="upg-sub">${def.subtitle}</div>
          ${micPreviewHtml}
          <div class="upg-meta-row">
            <span class="upg-stat-chip">+${def.clickBonus} ₽/кл</span>
            <span class="upg-stat-chip">+${def.passivePerSec}/с</span>
            <span class="upg-stat-chip upg-chip-viewers">+${def.viewersBonus} онл</span>
            <span class="upg-stat-chip upg-chip-bold">+${def.boldnessBonus}%</span>
          </div>
          <div class="upg-prog-track"><div class="upg-prog-fill" style="width:${lvlPct}%"></div></div>
        </div>
        <div class="upg-cta ${isMax ? 'is-max' : canAfford ? 'can-buy' : ''}">
          <span class="upg-cta-label">${isMax ? 'ГОТОВО' : 'КУПИТЬ'}</span>
          <strong class="upg-cta-price">${isMax ? 'МАКС ★' : formatMoney(cost)}</strong>
        </div>
      `;
      if (btn.dataset.renderedHtml !== nextUpgHtml) {
        btn.dataset.renderedHtml = nextUpgHtml;
        btn.innerHTML = nextUpgHtml;
      }
    }
    this.upgAvailDotEl.classList.toggle('hidden', !anyAffordable || this.activeTab === 'upgrades');

    // Challenge cards
    for (const ch of STREAM_CHALLENGES) {
      const btn = this.challengeButtons.get(ch.id);
      if (!btn) continue;
      const lockedByViewers = stats.onlineViewers < ch.viewersRequired;
      const cdLeftSec = Math.max(
        0,
        Math.ceil(((state.challengeCooldownUntilMs[ch.id] ?? 0) - nowMs) / 1000),
      );
      const ready = !lockedByViewers && cdLeftSec === 0;
      const estReward = Math.max(15, Math.round(stats.clickIncome * ch.instantRewardMult));

      btn.disabled = !ready;
      btn.classList.toggle('ready', ready);

      let statusLabel = `+${estReward} ₽`;
      if (lockedByViewers) {
        statusLabel = `${ch.viewersRequired} онл.`;
      } else if (cdLeftSec > 0) {
        statusLabel = `${cdLeftSec}с`;
      }

      const nextChHtml = `
        <div>
          <div class="ch-name">${ch.icon} ${ch.name}</div>
          <p class="ch-desc">${ch.desc}</p>
        </div>
        <div class="ch-foot">
          <span class="ch-bold">+${ch.boldnessGain}% раскреп.</span>
          <span class="ch-status">${statusLabel}</span>
        </div>
      `;
      if (btn.dataset.renderedHtml !== nextChHtml) {
        btn.dataset.renderedHtml = nextChHtml;
        btn.innerHTML = nextChHtml;
      }
    }
  }

  /** A dare just arrived from the chat. */
  public showDare(hint: string, label: string, streakLabel = '', fromHer = false): void {
    if (!this.dareEl) return;
    // Who is asking changes the whole chip. The chat's dare is pink and public; hers is warmer,
    // quieter and addressed to one person, and the kicker is the only thing that has to change for
    // the player to feel the difference.
    this.dareEl.classList.toggle('from-her', fromHer);
    if (this.dareKickerEl) this.dareKickerEl.textContent = fromHer ? 'МИЯ ПРОСИТ' : 'ЧАТ ПРОСИТ';
    // The streak is the reason to say yes to the second dare, so it belongs on the chip and not
    // only in the payout line the player reads after the fact.
    if (this.dareStreakEl) {
      this.dareStreakEl.hidden = streakLabel === '';
      this.dareStreakEl.textContent = streakLabel;
    }
    this.dareEl.hidden = false;
    // The phone layout has one top slot, and it is the dare's while the timer runs.
    document.body.classList.add('dare-live');
    this.dareEl.classList.remove('urgent');
    if (this.dareHintEl) this.dareHintEl.textContent = hint;
    if (this.dareCountEl) this.dareCountEl.textContent = label;
    if (this.dareFillEl) this.dareFillEl.style.width = '0%';
  }

  /**
   * One frame of a live dare. The timer is written as seconds with a tenth only in the last two
   * seconds — a tenth all the way down reads as a bomb, and this is a dare.
   */
  public updateDare(ratio: number, remainingMs: number, label: string): void {
    if (!this.dareEl || this.dareEl.hidden) return;
    const pct = Math.max(0, Math.min(1, ratio)) * 100;
    if (this.dareFillEl) this.dareFillEl.style.width = `${pct.toFixed(1)}%`;
    if (this.dareCountEl) this.dareCountEl.textContent = label;
    if (this.dareTimerEl) {
      const left = Math.max(0, remainingMs) / 1000;
      this.dareTimerEl.textContent = left < 2 ? `${left.toFixed(1)} с` : `0:0${Math.ceil(left)}`;
    }
    this.dareEl.classList.toggle('urgent', remainingMs > 0 && remainingMs < 2000);
  }

  /** Served, or out of time: the chip goes away and the chat says what it thinks. */
  public hideDare(finalLabel?: string): void {
    if (!this.dareEl) return;
    if (finalLabel && this.dareCountEl) this.dareCountEl.textContent = finalLabel;
    this.dareEl.hidden = true;
    document.body.classList.remove('dare-live');
  }

  /**
   * Her voice line, under the desk.
   *
   * `lockMs` is the difference between a beat and a flash: a tap that lands on the same frame as a
   * dare payout would otherwise replace the payout line immediately, and the line the player was
   * *paid* for is the one they never read. A lock swallows ordinary lines for its duration; the
   * important beats call it, taps do not.
   */
  public showSpeech(line: string, lockMs = 0): void {
    const now = performance.now();
    if (now < this.speechLockUntil) return;
    if (lockMs > 0) this.speechLockUntil = now + lockMs;
    this.speechTextEl.textContent = `«${line}»`;
    this.speechSubEl.classList.add('visible', 'pop');
    window.clearTimeout(this.speechPopTimer);
    window.clearTimeout(this.speechFadeTimer);
    this.speechPopTimer = window.setTimeout(() => {
      this.speechSubEl.classList.remove('pop');
    }, 220);
    this.speechFadeTimer = window.setTimeout(() => {
      this.speechSubEl.classList.remove('visible');
    }, 5200);
  }

  public showDonationAlert(amountLabel: string | number, message: string): void {
    this.alertAmountEl.textContent =
      typeof amountLabel === 'number' ? `★ +${amountLabel} ₽ ★` : amountLabel;
    this.alertSubEl.textContent = message;
    this.alertBoxEl.classList.remove('hidden');
    window.clearTimeout(this.alertTimer);
    this.alertTimer = window.setTimeout(() => {
      this.alertBoxEl.classList.add('hidden');
    }, 3000);
  }

  /**
   * Fired after every message actually drawn in the chat. The stage uses it to have her look at the
   * chat — the one thing a streamer does that this game had no way of noticing.
   */
  public onChatPushed?: () => boolean;

  public pushChatMessage(msg: ChatMessage): void {
    const row = document.createElement('div');
    row.className = `chat-msg${msg.isSystemHighlight ? ' highlight' : ''}`;

    if (msg.badge) {
      const badge = document.createElement('span');
      badge.className = `chat-badge badge-${msg.badge}`;
      badge.textContent = msg.badge === 'DONATE' ? '₽' : msg.badge;
      row.appendChild(badge);
    }

    const author = document.createElement('span');
    author.className = 'chat-author';
    author.style.color = msg.color;
    author.textContent = `${msg.author}:`;
    row.appendChild(author);

    const body = document.createElement('span');
    body.innerHTML = renderChatTextWithEmotes(msg.text);
    row.appendChild(body);

    this.chatMessagesEl.appendChild(row);
    while (this.chatMessagesEl.children.length > 7) {
      this.chatMessagesEl.removeChild(this.chatMessagesEl.firstChild!);
    }
    // The line she turned to is the line that lights up. Unless the glance was rate-limited — then
    // nothing flashes, because she genuinely did not read this one, and a flash would be a lie the
    // player can see through in ten seconds of watching.
    if (this.onChatPushed?.()) this.markRead(row);
  }

  /** A short warm flash on the row she looked at. Timer is unref'd: seven rows, never a leak. */
  private markRead(row: HTMLElement): void {
    row.classList.add('read');
    window.setTimeout(() => row.classList.remove('read'), 1200);
  }
}

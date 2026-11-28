import type { Application } from 'pixi.js';
import { sfx } from '../audio/sfx.ts';
import {
  createAmbientChatMessage,
  createDay2ProvocationChatMessage,
  createDonationChatMessage,
  createFarewellChatMessage,
  createSubGoalCascadeMessages,
  createSubNotificationMessage,
  createUpgradeChatMessage,
  createViralClipChatMessage,
  createSelfQuirkMessage,
  type QuirkLineKind,
  createZoneBurstMessage,
} from '../chat/chatEngine.ts';
import {
  DAY1_FAREWELL_LINES,
  DAY2_FAREWELL_LINES,
  DAY2_OPENING_LINE,
  DAY2_SHAME_LINES,
  DAY3_FAREWELL_LINES,
  DAY3_OPENING_LINE,
  DAY4_DONE_LINES,
  DAY4_FAREWELL_LINES,
  DAY4_OPENING_LINE,
  DAY5_FAREWELL_LINES,
  DAY5_OPENING_LINE,
  DAY6_OPENING_LINE,
  DAY6_FAREWELL_LINES,
  GHOST_BOO_LINES,
  pickStageTapLine,
  pickSituationLine,
  pickFeverOverheatLine,
  pickIdleTeaseLine,
  pickReactionCalloutTag,
  UPGRADE_REACTION_LINES,
} from '../domain/dialogue.ts';
import {
  applyTap,
  buyGiftSubs,
  buyUpgrade,
  computeStats,
  createInitialState,
  debugSetSubscribers,
  deserializeState,
  SAVE_STORAGE_KEY,
  selectDisplayedSubStage,
  serializeState,
  startDay2,
  startDay3,
  startDay4,
  startDay5,
  startDay6,
  tickEconomy,
  triggerStreamChallenge,
} from '../domain/engine.ts';
import {
  dayFinaleSubs,
  getSubGoalStagesForDay,
  isDay3Unlocked,
  isDay4Unlocked,
  isDay5Unlocked,
  isDay6Unlocked,
  pickShySubGoalApproachLine,
  probeDay3Art,
  probeDay4Art,
  probeDay5Art,
  probeDay6Art,
} from '../domain/subGoals.ts';
import { debugGotoDayStage, debugMaxOutShop, debugSetBars, finaleSubsForDay } from '../domain/debug.ts';
import { getMicTier } from '../domain/upgrades.ts';
import type {
  BottomTabId,
  ChallengeId,
  GameState,
  HeroineEmotion,
  SubGoalStageDef,
  SubGoalStageIndex,
  TapZoneId,
  UpgradeId,
} from '../domain/types.ts';
import type { HeroineRig } from '../heroine/HeroineRig.ts';
import { StreamStage } from '../heroine/StreamStage.ts';
import { AdminPanel, type AdminPanelApi, type AdminRigApi } from '../presentation/adminPanel.ts';
import {
  constraintLabel,
  diffTuning,
  displayValue,
  formatTuningReport,
  mergeTuning,
  parseStoredTuning,
  type RigTuning,
} from '../heroine/rigTuning.ts';
import { UiController } from '../presentation/uiController.ts';

declare global {
  interface Window {
    __pixiApp?: Application;
    __heroineRig?: HeroineRig;
    __qaFreezeTicker?: () => void;
    __qaScene?: {
      getState: () => GameState;
      getDeskMicDebug: () => unknown;
      getFaceAnchorDebug: () => { x: number; y: number; w: number; h: number };
      getActivePlateName: () => string;
      facePatchDebug: () => { plate: string; hidden: boolean };
      situationLine: (seed: number) => string;
      tapLine: (zone: TapZoneId, seed: number, stage: number, day: number) => string;
      farewellLineCount: () => number;
      isWearingDay2Outfit: () => boolean;
      getStats: () => ReturnType<typeof computeStats>;
      tapZone: (zone: TapZoneId) => void;
      zoneCenter: (zone: TapZoneId) => { x: number; y: number } | null;
      lastTapBeat: () => string | null;
      lastTapDebug: () => { zone: string; beat: string; streak: number; available: number } | null;
      hoverDebug: () => { zone: string | null; since: number };
      blushDebug: () => { level: number; heat: number; at: { x: number; y: number } | null };
      cameraDebug: () => { x: number; y: number; zoom: number; punch: number; t: number; reduced: boolean };
      attentionDebug: () => { hoverMs: number; picks: number; last: string | null; reason: string; error?: string };
      tickDebug: () => ({ frames: number; error: string | null });
      addFunds: (amount: number) => void;
      setSubscribers: (count: number) => number;
      giftSubs: (count: number) => boolean;
      setSubStage: (stage: SubGoalStageIndex) => boolean;
      buyUpgrade: (id: UpgradeId) => boolean;
      startDay2: () => boolean;
      startDay3: () => boolean;
      startDay4: () => boolean;
      startDay5: () => boolean;
      startDay6: () => boolean;
      isDay6Unlocked: () => boolean;
      say: (text: string) => void;
      talk: (ms: number) => void;
      muteChat: (on: boolean) => void;
      plate: () => string;
      liveDebug: () => {
        animation: string;
        animations: string[];
        art: string | null;
        fault: string | null;
        enabled: boolean;
        talkUntil: number;
        reactionUntil: number;
        lastUpdate: number;
        visible: boolean;
        now: number;
      };
      isDay5Unlocked: () => boolean;
      bikiniInfo: () => { unlocked: boolean; plates: boolean; flashLive: boolean; day: number };
      isDay3Unlocked: () => boolean;
      isDay4Unlocked: () => boolean;
      ghostBoo: (ms?: number) => boolean;
      ghostInfo: () => { unlocked: boolean; flashLive: boolean; day: number };
      yogaInfo: () => { unlocked: boolean; plates: boolean; flashLive: boolean; day: number };
      runChallenge: (id: ChallengeId) => boolean;
      switchTab: (tab: BottomTabId) => void;
      forceBlink: () => void;
      forceFluster: () => void;
      forceEmotion: (emo: Exclude<HeroineEmotion, 'neutral'>) => void;
      resetSave: () => void;
    };
  }
}

export async function bootstrapApp(): Promise<void> {
  const isQa = new URLSearchParams(window.location.search).has('qa');

  let state: GameState = isQa
    ? createInitialState()
    : deserializeState(localStorage.getItem(SAVE_STORAGE_KEY));

  let lastPlayerInteractionMs = performance.now();
  /**
   * The admin panel can hold the save back, so "let me look at the finale plate" never overwrites a
   * real run's progress. It is a session flag on purpose: reload and normal saving is back.
   */
  let adminSaveSuppressed = false;
  let adminPanel: AdminPanel | null = null;
  /** Day whose "the goal is closed" hint the chat already got — see the note in syncAll. */
  let finaleAnnouncedDay = 0;
  let idleTeaseCounter = 0;
  /** She keeps commenting on the stream: idle stares AND live numbers, never over a celebration. */
  let lastCelebrationMs = 0;
  let nextRemarkAtMs = performance.now() + 17000;

  const ui = new UiController();
  ui.init();

  const stageHost = document.getElementById('stream-stage-host')!;
  const stage = new StreamStage();
  await stage.mount(stageHost);
  stage.setSubStage(state.displayedSubStage, false);

  // ---- The rig can only ever cost us the rig -------------------------------------------------
  // The skeleton draws inside the game's own Pixi stage, on the game's own clock. If anything about
  // it throws while a frame is being drawn — a texture that is not decoded yet, a mesh rebuild on a
  // slow phone — Pixi's ticker stops rescheduling itself and the player gets a black canvas with the
  // HUD still on top of it. Nobody can read a console on a phone, so this page heals itself: drop
  // the rig, restart the loop, repaint, and say why on screen.
  const RIG_OFF_KEY = 'mt_rig_off_v2';
  const readFlag = (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null; // private mode / blocked storage: a missing flag, not a crash
    }
  };
  const writeFlag = (key: string, value: string | null): void => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* storage is a convenience here, never a requirement */
    }
  };

  const rigFaults: string[] = [];
  const rigBanner = document.createElement('div');
  rigBanner.id = 'rig-fault';
  rigBanner.className = 'rig-fault hidden';
  rigBanner.innerHTML =
    '<b>живой риг отключён — игра на плоских артах</b><span data-reason></span>' +
    '<button type="button" aria-label="Скрыть">✕</button>';
  stageHost.append(rigBanner);
  let rigBannerTimer = 0;
  rigBanner.querySelector('button')?.addEventListener('click', () => rigBanner.classList.add('hidden'));

  const reportRigFault = (reason: string): void => {
    rigFaults.push(reason);
    // Remember it: a device that could not draw the skeleton should not re-learn that on every
    // reload. `?rig=1` is the deliberate exception.
    writeFlag(RIG_OFF_KEY, '1');
    const line = rigBanner.querySelector<HTMLElement>('[data-reason]');
    if (line) line.textContent = reason;
    rigBanner.classList.remove('hidden');
    window.clearTimeout(rigBannerTimer);
    rigBannerTimer = window.setTimeout(() => rigBanner.classList.add('hidden'), 15_000);
  };
  stage.onLiveFault = reportRigFault;

  /**
   * Is the render loop dead? Pixi's ticker re-requests the next frame AFTER running the callbacks,
   * so an exception leaves `started === true` with no frame pending — the exact state of a black
   * canvas that no `started` check would notice.
   */
  const tickerStalled = (): boolean => {
    const ticker = stage.app.ticker as unknown as { started: boolean; _requestId: number | null };
    return document.visibilityState === 'visible' && ticker.started && ticker._requestId === null;
  };
  const restartLoop = (): void => {
    // `start()` is a no-op while `started` is true, so the ticker has to be cycled.
    stage.app.ticker.stop();
    stage.app.ticker.start();
    stage.app.render();
  };
  const recoverRig = (where: string, error: unknown): void => {
    // Only a stalled loop is a black screen. Anything else — an image that failed, a rejected
    // promise from audio — must NOT cost the player her animated heroine.
    if (!tickerStalled()) return;
    const message = error instanceof Error ? error.message : String(error);
    const culprit = stage.liveEnabled && stage.live.currentArt !== null;
    if (stage.liveEnabled) stage.setLiveEnabled(false);
    restartLoop();
    if (culprit) reportRigFault(`${where}: ${message}`);
  };
  if (!isQa) {
    window.addEventListener('error', (e) => recoverRig('ошибка', e.error ?? e.message));
    window.addEventListener('unhandledrejection', (e) => recoverRig('промис', e.reason));
    // The swallowed case: something killed the loop without reaching a listener at all.
    window.setInterval(() => {
      if (!tickerStalled()) return;
      if (stage.liveEnabled) stage.setLiveEnabled(false);
      restartLoop();
    }, 1500);
  }

  // `?rig=0` forces flat plates, `?rig=1` forces the skeleton back on a device that gave up on it.
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('rig') === '0') stage.setLiveEnabled(false);
  else if (urlParams.get('rig') === '1') writeFlag(RIG_OFF_KEY, null);
  else if (readFlag(RIG_OFF_KEY) === '1') stage.setLiveEnabled(false);

  // Which arts actually have a rig — asked once, from the same index the game could use.
  let riggedArts: Set<string> | null = null;
  void fetch('/rigs/index.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((json: unknown) => {
      if (json && typeof json === 'object') {
        riggedArts = new Set(Object.keys(json as object));
        // Hand the list to the stage as well, so a plate without a rig never even asks for one.
        stage.riggedArts = riggedArts;
        void stage.syncLiveHeroine();
      }
    })
    .catch(() => undefined);

  const artOfPlate = (plate: string) => plate.replace(/^heroine_/, '').replace(/\.webp$/, '');

  ui.onTabChange = (tab: BottomTabId) => {
    lastPlayerInteractionMs = performance.now();
    stage.setDrawerOpen(tab !== 'stream');
  };

  /**
   * Which plate ladder the rig should wear for a saved `streamDay`. Days 3 and 4 each own a ladder,
   * and the rig falls back to the Day 2 art inside `setWardrobeDay` when that day's plates are not in
   * the build yet — so this map is about INTENT, never about availability.
   */
  const wardrobeDayOf = (streamDay: number): 1 | 2 | 3 | 4 | 5 | 6 =>
    streamDay >= 6 ? 6 : streamDay >= 5 ? 5 : streamDay === 4 ? 4 : streamDay === 3 ? 3 : streamDay === 2 ? 2 : 1;

  const syncAll = () => {
    const stats = computeStats(state);
    stage.setRingLampLevel(state.upgrades.ring_lamp ?? 0);
    stage.setHypeLevel(state.hype);
    stage.setMicTier(state.upgrades.desk_mic ?? 0);
    stage.rig.setBoldness(stats.boldness);
    stage.setWardrobeDay(wardrobeDayOf(state.streamDay));
    stage.setSubStage(state.displayedSubStage, false);
    ui.render(state, stats);
    // A closed day is an announcement, not a takeover: the finale card waits for the player's own
    // click (see UiController.openFinaleCard), so this only tells them the button exists. Without it
    // the HUD change is easy to miss while they are mid-click on her, and the day looks stuck.
    if (state.subscribers >= dayFinaleSubs(state.streamDay) && finaleAnnouncedDay !== state.streamDay) {
      finaleAnnouncedDay = state.streamDay;
      ui.pushChatMessage({
        id: `finale_open_${state.streamDay}_${Date.now()}`,
        author: 'StreamBot',
        color: '#ffd54f',
        badge: 'MOD',
        text: `★ День ${state.streamDay} закрыт на ${dayFinaleSubs(state.streamDay)} сабах. Эфир продолжается — карточку с переходом откроешь сам, когда накликаешься.`,
        isSystemHighlight: true,
      });
      ui.showSpeech(
        state.streamDay === 6
          ? 'Шестьдесят восемь тысяч! Урожай собран, чат, финальная карточка ждёт~'
          : state.streamDay === 5
          ? 'Сорок семь тысяч, и я всё ещё в кадре, развернутая ровно так, как вы просили. Карточка в углу — переходи, когда решишь~'
          : state.streamDay === 4
            ? 'Двадцать шесть тысяч, и я всё ещё сижу в кресле. Карточку держу — переходишь, когда решишь, что тебе нужнее: сон или следующий день.'
            : state.streamDay === 3
              ? 'Цель закрыта, чат, а я ещё в кадре. Кликай на здоровье — переход только когда скажешь.'
              : 'Днём я своё заработала. Не выгоняю: кликай сколько надо, а карточку я держу в углу.',
      );
    }
    if (!isQa && !adminSaveSuppressed) {
      localStorage.setItem(SAVE_STORAGE_KEY, serializeState(state));
    }
    // The console is a tool, not a load-bearing part of the game: a bug in it must not be able to
    // stop a frame from being drawn.
    try {
      adminPanel?.refresh();
    } catch (error) {
      console.warn('[admin] refresh failed (ignored)', error);
    }
  };

  const celebrateSubGoalUnlocks = (unlockedStages: SubGoalStageDef[]) => {
    if (unlockedStages.length === 0) return;
    lastCelebrationMs = performance.now();
    sfx.milestone();
    stage.playLiveMilestone();
    const latest = unlockedStages[unlockedStages.length - 1]!;
    stage.setSubStage(latest.stage, true, latest.removedItemLabel, latest.unlockEmotion);
    announce(latest.removedItemLabel, true, latest.stage);
    ui.showSpeech(latest.unlockLine);
    ui.showDonationAlert(
      `★ SUB GOAL ${latest.subsRequired} САБОВ ПРОБИТ!`,
      `${latest.removedItemLabel} • Доход вырос до x${latest.incomeMultiplier.toFixed(2)}!`,
    );

    const cascade = createSubGoalCascadeMessages(latest);
    cascade.forEach((msg, idx) => {
      if (idx === 0) {
        ui.pushChatMessage(msg);
      } else {
        window.setTimeout(() => {
          ui.pushChatMessage(msg);
        }, idx * 240);
      }
    });
  };

  // Every reaction callout the *game* makes goes through here, so QA can silence the script's
  // noise without silencing its own calls: the talk QA asks "does she answer a line", and it cannot
  // answer that if the game is answering lines of its own at the same time.
  let announceMuted = false;
  const announce = (tag: string, isFever = false, seed = 0) => {
    if (announceMuted) return;
    stage.spawnReactionCallout(tag, isFever, seed);
  };

  // What the director knows about her mood. `boldness` is the same number the rig's blush uses, so
  // the body and the face cannot disagree about how far along she is.
  stage.reactionInput = () => ({
    boldness: computeStats(state).boldness,
    hype: state.hype,
  });

  // She entertains herself and the chat notices — but only sometimes, and only when the room is
  // already talking: a chat that comments on every single head turn is a chat full of bots.
  let lastQuirkChatMs = -Infinity;
  stage.onLiveQuirk = (kind) => {
    const now = performance.now();
    if (now - lastQuirkChatMs < 18000) return;
    if (announceMuted) return;
    if (Math.random() > 0.45) return;
    lastQuirkChatMs = now;
    ui.pushChatMessage(createSelfQuirkMessage(kind, state.totalTaps + Math.floor(now / 1000), state.streamDay));
  };

  // She noticed the player staring, or noticed nobody is here. Either way the chat has something
  // to say — this is the cheapest fan-service in the game and the one that never stops working.
  stage.onAttention = (kind, zone) => {
    if (announceMuted) return;
    const now = performance.now();
    if (now - lastQuirkChatMs < 15000) return;
    lastQuirkChatMs = now;
    // "Caught" has three voices, one per zone: the chat noticing the same thing the player was
    // doing is what makes the reaction feel observed rather than scripted.
    const line: QuirkLineKind =
      kind !== 'caught'
        ? kind
        : zone === 'legs'
          ? 'caught_legs'
          : zone === 'feet'
            ? 'caught_feet'
            : 'caught_chest';
    ui.pushChatMessage(createSelfQuirkMessage(line, state.totalTaps + Math.floor(now / 1000), state.streamDay));
  };

  stage.onHeroineTap = (zone: TapZoneId) => {
    lastPlayerInteractionMs = performance.now();
    // Sound first, before any of the bookkeeping: the click has to land on the frame the player
    // clicked, and everything below this line can allocate.
    sfx.tap(state.hype / 100);
    const outcome = applyTap(state, zone);
    state = outcome.state;
    const afterStats = computeStats(state);
    stage.rig.setBoldness(afterStats.boldness);

    const isFever = state.hype >= 72;
    const isFeverTrigger = isFever && state.totalTaps % 4 === 0;

    // Day 3 tap gimmick: a «Бу!» and the sheet flashes up for a beat (crossfade to the reveal plate),
    // and the chat explodes with clips like any decent haunt would.
    const isBoo = state.streamDay === 3 && state.totalTaps % 3 === 0;
    // Yoga day owns the same crossfade: every third tap holds the finale frame for a beat and she asks
    // the chat «Готово?». The plate swap is the joke, so the copy never claims a garment moved.
    const isDone = state.streamDay === 4 && state.totalTaps % 3 === 0;
    const booFlashed =
      isBoo || isDone ? stage.triggerGhostBoo(state.hype >= 72 ? 700 : 480) : false;
    if (booFlashed && isDone) {
      ui.showSpeech(DAY4_DONE_LINES[state.totalTaps % DAY4_DONE_LINES.length]!);
      announce('♥ ГОТОВО? ЧАТ В КЛИПАХ!', true, state.totalTaps);
      ui.pushChatMessage(createZoneBurstMessage(zone, state.displayedSubStage, state.totalTaps, 4));
    } else if (booFlashed) {
      ui.showSpeech(GHOST_BOO_LINES[state.totalTaps % GHOST_BOO_LINES.length]!);
      announce('♥ БУ! ЧАТ В КЛИПАХ!', true, state.totalTaps);
      ui.pushChatMessage(createZoneBurstMessage(zone, state.displayedSubStage, state.totalTaps, 3));
    } else if (isFeverTrigger) {
      stage.rig.triggerArchStretch(afterStats.boldness >= 60 ? 'bold' : 'fluster');
      ui.showSpeech(pickFeverOverheatLine(zone, state.displayedSubStage, state.totalTaps, state.streamDay));
    } else if (state.streamDay >= 2 && state.totalTaps % 2 === 1) {
      // Day 2/3: every tap gets an answer from her, tuned to the stage she is actually on.
      ui.showSpeech(pickStageTapLine(zone, state.totalTaps, state.displayedSubStage, state.streamDay));
    } else {
      ui.showSpeech(outcome.line);
    }

    if (state.totalTaps % 2 === 0 || isFeverTrigger) {
      announce(
        pickReactionCalloutTag(zone, isFever, state.totalTaps),
        isFeverTrigger,
        state.totalTaps,
      );
    }

    if (outcome.gainedOrganicSubs > 0) {
      ui.pushChatMessage(
        createSubNotificationMessage(outcome.gainedOrganicSubs, false, state.subscribers),
      );
      if (outcome.newlyUnlockedSubStages.length === 0) {
        const shyLine = pickShySubGoalApproachLine(afterStats.nextSubGoalDef, state.subscribers);
        if (shyLine) {
          stage.rig.triggerEmotion(afterStats.boldness < 60 ? 'shy' : 'tease', 1900);
          ui.showSpeech(shyLine);
        }
      }
    }

    if (outcome.newlyUnlockedSubStages.length > 0) {
      celebrateSubGoalUnlocks(outcome.newlyUnlockedSubStages);
    } else {
      if (isFeverTrigger || state.totalTaps % 7 === 0) {
        ui.pushChatMessage(
          createViralClipChatMessage(zone, afterStats.onlineViewers, state.totalTaps, state.streamDay),
        );
      } else if (state.totalTaps % 2 === 1 || outcome.triggeredDonationAlert) {
        ui.pushChatMessage(
          createZoneBurstMessage(zone, state.displayedSubStage, state.totalTaps, state.streamDay),
        );
      }

      if (outcome.triggeredDonationAlert) {
        sfx.donation();
        stage.playLiveDonation();
        ui.showDonationAlert(
          `★ ГОРЯЧИЙ ДОНАТ +${outcome.earned} ₽`,
          '«Не прикрывайся, ты сводишь весь чат с ума! ♥»',
        );
        ui.pushChatMessage(createDonationChatMessage(outcome.earned, state.totalTaps, state.streamDay));
      }
    }

    for (const m of outcome.newlyUnlockedMilestones) {
      ui.pushChatMessage({
        id: `ms_${m.id}`,
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: `Достигнута цель онлайна: ${m.title}! :Overheat: :Pog: :SubHype:`,
        isSystemHighlight: true,
      });
    }

    syncAll();
    return { earned: outcome.earned, alert: outcome.triggeredDonationAlert };
  };

  ui.onGiftSubs = (count: number) => {
    lastPlayerInteractionMs = performance.now();
    const res = buyGiftSubs(state, count);
    if (!res.ok) return;
    state = res.state;
    const afterStats = computeStats(state);
    stage.rig.setBoldness(afterStats.boldness);

    ui.pushChatMessage(createSubNotificationMessage(count, true, state.subscribers));

    if (res.newlyUnlockedSubStages.length > 0) {
      celebrateSubGoalUnlocks(res.newlyUnlockedSubStages);
    } else {
      const emo: Exclude<HeroineEmotion, 'neutral'> =
        afterStats.boldness < 50 ? 'shy' : afterStats.boldness < 78 ? 'fluster' : 'tease';
      stage.rig.triggerTapReaction('chest', emo);
      announce(`+${count} САБ ♥`, count >= 5, state.subscribers);
      const shyLine = pickShySubGoalApproachLine(
        afterStats.nextSubGoalDef,
        state.subscribers + count,
      );
      ui.showSpeech(
        shyLine ??
          `Ого, ещё +${count} подарочных сабов в чат! Вы меня совсем разбалуете, спонсоры~ ★ ♥`,
      );
      if (count >= 5) {
        ui.showDonationAlert(
          `★ ПОДАРЕНО ${count} ПОДПИСОК`,
          `VIP_Sponsor разгоняет фансервис! Всего: ${state.subscribers} сабов`,
        );
      }
      if (count >= 50) {
        // Mass drops are a channel event: the chat echoes it the way Twitch does on a 50+ gift run.
        ui.pushChatMessage({
          id: `legion_${state.subscribers}`,
          author: 'StreamBot',
          color: '#ffd54f',
          badge: 'MOD',
          text:
            count >= 100
              ? `ПОЛНЫЙ ЗАХВАТ ЧАТА: +${count} сабов одним дропом! Мия уже не знает, куда деть руки :AWOOGA: :SubHype:`
              : `ТЯЖЁЛЫЙ ЛЕГИОН: +${count} сабов! Мия, держись, это только начало :Pog: :SubHype:`,
          isSystemHighlight: true,
        });
        stage.rig.triggerArchStretch('bold');
      }
    }

    for (const m of res.newlyUnlockedMilestones) {
      ui.pushChatMessage({
        id: `ms_${m.id}`,
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: `Достигнута цель онлайна: ${m.title}! :AWOOGA: :Pog: :SubHype:`,
        isSystemHighlight: true,
      });
    }
    syncAll();
  };

  ui.onSelectSubStage = (targetStage: SubGoalStageIndex) => {
    lastPlayerInteractionMs = performance.now();
    const res = selectDisplayedSubStage(state, targetStage);
    if (!res.ok) return;
    state = res.state;
    stage.setSubStage(state.displayedSubStage, true);
    syncAll();
  };

  ui.onBuyUpgrade = (id: UpgradeId) => {
    lastPlayerInteractionMs = performance.now();
    const res = buyUpgrade(state, id);
    if (!res.ok) return;
    state = res.state;
    const afterStats = computeStats(state);
    stage.rig.setBoldness(afterStats.boldness);
    stage.rig.triggerTapReaction(
      'chest',
      id === 'webcam_focus' || id === 'ring_lamp' ? 'shy' : 'tease',
    );
    if (id === 'desk_mic') {
      const tier = getMicTier(state.upgrades.desk_mic ?? 0);
      ui.showSpeech(tier?.reactionLine ?? UPGRADE_REACTION_LINES[id]);
      announce(
        tier ? `🎙 Тир ${tier.tier} ★` : '🎙 Микрофон ★',
        true,
        state.upgrades.desk_mic ?? 0,
      );
      ui.showDonationAlert(
        `🎙 МИКРОФОН ТИР ${state.upgrades.desk_mic ?? 0} НА СТОЛЕ!`,
        tier?.modelName ?? 'Новый микрофон!',
      );
    } else {
      ui.showSpeech(UPGRADE_REACTION_LINES[id]);
    }
    ui.pushChatMessage(createUpgradeChatMessage(id));
    syncAll();
  };

  // Every farewell beat of the Day 1 finale: a viewer goodbye in chat + a shy wave.
  ui.onFarewellBeat = (index: number) => {
    ui.pushChatMessage(createFarewellChatMessage(index, state.streamDay));
    // Which day is closing decides the beat count, the emotion curve and the last callout.
    const beats =
      state.streamDay === 6
        ? DAY6_FAREWELL_LINES.length
        : state.streamDay === 5
        ? DAY5_FAREWELL_LINES.length
        : state.streamDay === 4
          ? DAY4_FAREWELL_LINES.length
        : state.streamDay === 3
          ? DAY3_FAREWELL_LINES.length
          : state.streamDay === 2
            ? DAY2_FAREWELL_LINES.length
            : DAY1_FAREWELL_LINES.length;
    // Days 3 and 4 close on a wink, not on a blush: by now she likes being watched.
    stage.rig.triggerEmotion(
      state.streamDay >= 3 ? 'bold' : index >= beats - 2 ? 'tease' : 'shy',
      2300,
    );
    if (index === beats - 1) {
      announce(
        state.streamDay === 4
          ? '♥ ЙОГА-ДЕНЬ ЗАКРЫТ!'
          : state.streamDay === 3
            ? '♥ КОСПЛЕЙ-ДЕНЬ ЗАКРЫТ!'
            : '♥ ПОКА-ПОКА, ЧАТ!',
        true,
        index,
      );
    }
  };

  ui.onStartDay2 = () => {
    lastPlayerInteractionMs = performance.now();
    if (state.streamDay === 5) {
      startDay6Flow();
      return;
    }
    if (state.streamDay === 4) {
      startDay5Flow();
      return;
    }
    if (state.streamDay === 3) {
      startDay4Flow();
      return;
    }
    if (state.streamDay === 2) {
      startDay3Flow();
      return;
    }
    const res = startDay2(state);
    if (!res.ok) return;
    state = res.state;
    const afterStats = computeStats(state);
    stage.rig.setBoldness(afterStats.boldness);
    stage.setWardrobeDay(2);
    stage.rig.triggerEmotion('bold', 2600);
    ui.showSpeech(DAY2_OPENING_LINE);
    // Day 2 arc: she is mortified about yesterday, the chat instantly starts provoking her.
    DAY2_SHAME_LINES.forEach((line, i) => {
      window.setTimeout(() => {
        // The arc is timed across ~20s, so a day change (the admin jump does exactly that) must cut it
        // off: Day 2's "I'm still blushing about yesterday" cannot be spoken over the bikini day.
        if (state.streamDay !== 2) return;
        ui.showSpeech(line);
        ui.pushChatMessage(createDay2ProvocationChatMessage(i));
        stage.rig.triggerEmotion(i % 2 === 0 ? 'shy' : 'fluster', 2400);
        if (i === DAY2_SHAME_LINES.length - 1) {
          announce('♥ ЧАТ ПОДНАИВАЕТ!', true, i);
        }
      }, 1500 + i * 4600);
    });
    ui.pushChatMessage({
      id: `day2_${Date.now()}`,
      author: 'StreamBot',
      color: '#c084fc',
      badge: 'MOD',
      text: '★ НАЧАЛСЯ ВТОРОЙ ДЕНЬ СТРИМА! Все улучшения и вещи из Дня 1 перенесены! :SubHype: :Pog:',
      isSystemHighlight: true,
    });
    ui.showDonationAlert('★ ДЕНЬ 2 НАЧАЛСЯ!', 'Улучшения, микрофон и гардероб перенесены!');
    syncAll();
  };

  /**
   * Day 3 = cosplay day. The finale card's single "next day" button routes here once Day 2 is
   * closed; same rule as Day 2: only money, subs, upgrades, items and boldness carry over.
   */
  // Day 3 unlocks itself the moment the cosplay plates land in /art - no flag flipping needed.
  // Day 4 rides the same trick with its own four yoga plates, so the ship order of art and code is
  // irrelevant: the buttons light up as soon as the files exist.
  void Promise.all([probeDay3Art(), probeDay4Art(), probeDay5Art(), probeDay6Art()]).then(() => {
    syncAll();
  });

  /**
   * Day 4 = yoga day «Растяжка с Мией». Same entry shape as Day 3: the plates are already probed, the
   * ladder swaps in one call, and the day's own flash beat («Готово?») is demoed immediately so the
   * player learns the crossfade exists without reading a word about it.
   */
  const startDay4Flow = () => {
    lastPlayerInteractionMs = performance.now();
    const res = startDay4(state);
    if (!res.ok) return;
    state = res.state;
    const afterStats = computeStats(state);
    stage.rig.setBoldness(afterStats.boldness);
    stage.setWardrobeDay(4);
    stage.rig.triggerEmotion('bold', 2600);
    ui.showSpeech(DAY4_OPENING_LINE);
    window.setTimeout(() => {
      if (stage.triggerGhostBoo(760)) {
        ui.showSpeech(DAY4_DONE_LINES[0]!);
        announce('♥ ГОТОВО? МЫ ТОЛЬКО НАЧАЛИ!', true, 0);
      }
    }, 900);
    ui.pushChatMessage({
      id: `day4_${Date.now()}`,
      author: 'StreamBot',
      color: '#c084fc',
      badge: 'MOD',
      text: '★ ДЕНЬ 4: «РАСТЯЖКА С МИЕЙ»! Коврик дома, кресло в работе, вязаный топ без бретелей :SubHype: :Pog:',
      isSystemHighlight: true,
    });
    ui.showDonationAlert('★ ДЕНЬ 4: ЙОГА!', 'Гардероб перенесён, цели обновлены, кресло закреплено!');
    syncAll();
  };

  /**
   * Day 5 = «5 бикини стрим». Same entry shape as Days 3-4 — carry the run over, swap the ladder, say the
   * opening line — minus the flash demo: this day has no reveal plate (`DAY5_FLASH_PLATE` is null), so
   * there is nothing to crossfade and `triggerGhostBoo` answers false on purpose. What the player gets
   * instead is the price list: the chat is told the goal in the same breath she is introduced in.
   */
  const startDay6Flow = () => {
    lastPlayerInteractionMs = performance.now();
    const res = startDay6(state);
    if (!res.ok) return;
    state = res.state;
    stage.rig.setBoldness(computeStats(state).boldness);
    stage.setWardrobeDay(6);
    stage.rig.triggerEmotion('bold', 2600);
    ui.showSpeech(DAY6_OPENING_LINE);
    ui.pushChatMessage({ id: `day6_${Date.now()}`, author: 'StreamBot', color: '#c084fc', badge: 'MOD', text: '★ ДЕНЬ 6: ДЕРЕВЕНСКАЯ ДЕВОЧКА! Аванс принят, урожай ждёт :SubHype:', isSystemHighlight: true });
    ui.showDonationAlert('★ ДЕНЬ 6: ДЕРЕВЕНСКАЯ ДЕВОЧКА!', 'Новые цели и новые заявки чата!');
    syncAll();
  };

  const startDay5Flow = () => {
    lastPlayerInteractionMs = performance.now();
    const res = startDay5(state);
    if (!res.ok) return;
    state = res.state;
    const afterStats = computeStats(state);
    stage.rig.setBoldness(afterStats.boldness);
    stage.setWardrobeDay(5);
    stage.rig.triggerEmotion('bold', 2600);
    ui.showSpeech(DAY5_OPENING_LINE);
    ui.pushChatMessage({
      id: `day5_${Date.now()}`,
      author: 'StreamBot',
      color: '#c084fc',
      badge: 'MOD',
      text: '★ ДЕНЬ 5: «5 БИКИНИ СТРИМ»! Снимать нечего — двигаем позу и придвигаем камеру :SubHype: :Pog:',
      isSystemHighlight: true,
    });
    ui.showDonationAlert('★ ДЕНЬ 5: БИКИНИ-СТРИМ!', 'Гардероб перенесён, цели обновлены, кресло снова в работе!');
    syncAll();
  };

  const startDay3Flow = () => {
    lastPlayerInteractionMs = performance.now();
    const res = startDay3(state);
    if (!res.ok) return;
    state = res.state;
    const afterStats = computeStats(state);
    stage.rig.setBoldness(afterStats.boldness);
    stage.setWardrobeDay(3);
    stage.rig.triggerEmotion('bold', 2600);
    ui.showSpeech(DAY3_OPENING_LINE);
    // The ghost day opens with one free «Бу!» so the flash mechanic is discovered immediately.
    window.setTimeout(() => {
      if (stage.triggerGhostBoo(760)) {
        ui.showSpeech(GHOST_BOO_LINES[0]!);
        announce('♥ БУ! ПРИЗРАК НА СВЯЗИ!', true, 0);
      }
    }, 900);
    ui.pushChatMessage({
      id: `day3_${Date.now()}`,
      author: 'StreamBot',
      color: '#c084fc',
      badge: 'MOD',
      text: '★ ДЕНЬ 3: «ПРИЗРАЧНАЯ СТРИМЕРША»! Простыня надета, сетка на ногах, дырки для глаз вырезаны :SubHype: :Pog:',
      isSystemHighlight: true,
    });
    ui.showDonationAlert('★ ДЕНЬ 3: ПРИЗРАК!', 'Бу! Гардероб перенесён, цели обновлены, простыня на месте!');
    syncAll();
  };

  ui.onTriggerChallenge = (id: ChallengeId) => {
    lastPlayerInteractionMs = performance.now();
    const res = triggerStreamChallenge(state, id);
    if (!res.ok) return;
    state = res.state;
    const afterStats = computeStats(state);
    stage.rig.setBoldness(afterStats.boldness);

    if (id === 'arch_stretch' || id === 'lean_mic') {
      stage.rig.triggerArchStretch('bold');
    } else {
      stage.rig.triggerTapReaction(
        res.zoneFocus,
        id === 'pose_feet' || id === 'asmr_tease' ? 'tease' : 'bold',
      );
    }

    stage.spawnTapBurst(688, 320, res.reward, true, res.zoneFocus);
    announce('ФАНСЕРВИС ★ ♥', true, Math.floor(res.reward));

    ui.pushChatMessage({
      id: `ch_${Date.now()}`,
      author: 'VIP_Donater',
      color: '#ffd54f',
      badge: 'DONATE',
      text: res.chatBurst,
      isSystemHighlight: true,
    });
    window.setTimeout(() => {
      ui.pushChatMessage(
        createViralClipChatMessage(
          res.zoneFocus,
          afterStats.onlineViewers,
          Math.floor(res.reward),
          state.streamDay,
        ),
      );
    }, 380);

    if (res.newlyUnlockedSubStages.length > 0) {
      celebrateSubGoalUnlocks(res.newlyUnlockedSubStages);
    } else {
      ui.showSpeech(res.line);
      ui.showDonationAlert(
        `★ ФАНСЕРВИС-ЧЕЛЛЕНДЖ +${res.reward} ₽`,
        `Чат в восторге и подарил +${res.gainedSubs} саб!`,
      );
    }
    syncAll();
  };

  // Seed initial subtle floating stream chat matching current clothing stage
  for (let i = 1; i <= 3; i++) {
    ui.pushChatMessage(
      createAmbientChatMessage(3, state.displayedSubStage, i * 7, state.streamDay),
    );
  }
  syncAll();

  // Uncapped elapsed-ms economy loop + spontaneous idle fourth-wall teasing!
  let lastEconomyMs = performance.now();
  window.setInterval(() => {
    const nowPerf = performance.now();
    const elapsed = nowPerf - lastEconomyMs;
    lastEconomyMs = nowPerf;
    const res = tickEconomy(state, elapsed);
    state = res.state;

    // Nobody tapped for ~11s -> she notices the silence. Otherwise she still reacts to the live
    // numbers every ~19s: how close the next Sub Goal is, the hype bar, the mic tier, the crowd.
    const idleFor = nowPerf - lastPlayerInteractionMs;
    if (!isQa && (idleFor > 11000 || nowPerf >= nextRemarkAtMs) && nowPerf - lastCelebrationMs > 7000) {
      lastPlayerInteractionMs = nowPerf;
      idleTeaseCounter += 1;
      const statsNow = computeStats(state);
      const situation = idleFor <= 11000 || idleTeaseCounter % 2 === 1;
      nextRemarkAtMs = nowPerf + (situation ? 18000 + (idleTeaseCounter % 3) * 3000 : 14000);
      stage.rig.triggerEmotion(
        statsNow.boldness < 45 ? 'shy' : situation ? 'fluster' : 'tease',
        2200,
      );
      ui.showSpeech(
        situation
          ? pickSituationLine({
              streamDay: state.streamDay,
              stage: state.displayedSubStage,
              subs: state.subscribers,
              nextGoalSubs: statsNow.nextSubGoalDef?.subsRequired ?? null,
              boldness: statsNow.boldness,
              hype: state.hype,
              onlineViewers: statsNow.onlineViewers,
              micTier: state.upgrades.desk_mic ?? 0,
              balance: state.balance,
              seed: idleTeaseCounter,
            })
          : pickIdleTeaseLine(state.displayedSubStage, idleTeaseCounter, state.streamDay),
      );
    }

    if (res.gainedOrganicSubs > 0) {
      ui.pushChatMessage(
        createSubNotificationMessage(res.gainedOrganicSubs, false, state.subscribers),
      );
    }
    if (res.newlyUnlockedSubStages.length > 0) {
      celebrateSubGoalUnlocks(res.newlyUnlockedSubStages);
    }
    for (const m of res.newlyUnlockedMilestones) {
      ui.pushChatMessage({
        id: `ms_${m.id}`,
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: `Достигнута цель онлайна: ${m.title}! :AWOOGA: :Pog: :SubHype:`,
        isSystemHighlight: true,
      });
    }
    syncAll();
  }, 250);

  // Ambient live chat ticker scaling with onlineViewers
  let chatCounter = 4;
  const scheduleNextAmbientChat = () => {
    const viewers = computeStats(state).onlineViewers;
    const delayMs = Math.max(850, 3200 - Math.min(2200, viewers * 28));
    window.setTimeout(() => {
      chatCounter += 1;
      ui.pushChatMessage(
        createAmbientChatMessage(viewers, state.displayedSubStage, chatCounter, state.streamDay),
      );
      scheduleNextAmbientChat();
    }, delayMs);
  };
  scheduleNextAmbientChat();

  // ---- Admin panel: jump the ladder instead of replaying it -------------------------------
  // Every button routes through `src/domain/debug.ts`, i.e. through the same engine gates a real run
  // crosses, so what the panel shows is reachable state — only the grind is skipped. Hidden in QA
  // mode (?qa), where the scripts drive the very same actions over `window.__qaScene`.
  const adminApplyJump = (day: number, stageIdx: SubGoalStageIndex) => {
    const before = state;
    const res = debugGotoDayStage(before, day, stageIdx);
    state = res.state;
    const dayChanged = state.streamDay !== before.streamDay;
    if (dayChanged) {
      stage.setWardrobeDay(wardrobeDayOf(state.streamDay));
      ui.pushChatMessage({
        id: `admin_day_${Date.now()}`,
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: `★ ADMIN: перемотка на День ${state.streamDay}, стадия ${state.displayedSubStage}.`,
        isSystemHighlight: true,
      });
      const openLine =
        state.streamDay === 6
          ? DAY6_OPENING_LINE
          : state.streamDay === 5
          ? DAY5_OPENING_LINE
          : state.streamDay === 4
            ? DAY4_OPENING_LINE
          : state.streamDay === 3
            ? DAY3_OPENING_LINE
            : state.streamDay === 2
              ? DAY2_OPENING_LINE
              : null;
      if (openLine) ui.showSpeech(openLine);
    }
    const fresh = getSubGoalStagesForDay(state.streamDay).slice(
      dayChanged ? 0 : before.unlockedSubStage + 1,
      state.unlockedSubStage + 1,
    );
    syncAll();
    if (fresh.length > 0) {
      // The real unlock sequence (crossfade, callout, alert, her line) — a jump should not look
      // flatter than earning it, otherwise the panel hides exactly the feedback the ladder needs.
      celebrateSubGoalUnlocks(fresh);
    } else {
      stage.setSubStage(state.displayedSubStage, true);
    }
    stage.app.render();
    return res.note;
  };

  // ---- Rig console ---------------------------------------------------------------------------
  // Sliders write into the runtime's live constraint values (the same channel an animation timeline
  // uses), so tuning is felt on the next breath. What survives a reload is kept in localStorage:
  // tuning that vanishes when the phone locks is not tuning, it is a demo.
  const RIG_TUNING_KEY = 'mt_admin_rig_tuning_v1';
  let rigTuning: RigTuning = parseStoredTuning(readFlag(RIG_TUNING_KEY));
  if (Object.keys(rigTuning).length > 0) stage.live.setDefaultTuning(rigTuning);
  const saveRigTuning = (): void => writeFlag(RIG_TUNING_KEY, JSON.stringify(rigTuning));

  /** Animations that are a beat, not a loop — the console should not leave her mid-shake. */
  const ONESHOT = new Set([
  'shake', 'blink', 'smile', 'talk', 'tease', 'tickle', 'gasp',
  'giggle', 'lean_in', 'hair_flip', 'arch', 'shy_tuck', 'shiver', 'settle',
]);

  const rigApi: AdminRigApi = {
    snapshot: () => {
      const docTuning = stage.live.docTuning();
      const current = stage.live.tuning();
      const constraints = Object.keys(docTuning).map((id) => ({
        id,
        label: constraintLabel(id),
        values: current[id] ?? {},
        doc: docTuning[id] ?? {},
      }));
      const plate = stage.getActivePlateName();
      const art = artOfPlate(plate);
      const stats = stage.live.stats();
      return {
        enabled: stage.liveEnabled,
        art: stage.live.currentArt,
        plateHasRig: riggedArts?.has(art) ?? false,
        animations: stage.live.animations,
        current: stage.live.currentAnimation,
        constraints,
        stats: { ...stats, fps: stage.app.ticker.FPS },
        plate,
        changes: diffTuning(current, docTuning).map(
          (c) => `${c.label} ${c.keyLabel} ${displayValue(c.key, c.from)} → ${displayValue(c.key, c.to)}`,
        ),
      };
    },
    setEnabled: (on) => {
      stage.setLiveEnabled(on);
      adminPanel?.refresh();
    },
    play: (name) => {
      stage.live.playAnimation(name, !ONESHOT.has(name));
      stage.app.render();
      adminPanel?.refresh();
    },
    setParam: (id, key, value) => {
      rigTuning = mergeTuning(rigTuning, { [id]: { [key]: value } });
      stage.live.setDefaultTuning(rigTuning);
      saveRigTuning();
      adminPanel?.refresh();
    },
    resetConstraint: (id) => {
      const docTuning = stage.live.docTuning();
      stage.live.applyTuning({ [id]: docTuning[id] ?? {} });
      const next = { ...rigTuning };
      delete next[id];
      rigTuning = next;
      saveRigTuning();
      adminPanel?.refresh();
    },
    resetAll: () => {
      rigTuning = {};
      writeFlag(RIG_TUNING_KEY, null);
      stage.live.resetTuning();
      adminPanel?.refresh();
    },
    report: () => formatTuningReport(stage.live.tuning(), stage.live.docTuning()),
  };

  const adminApi: AdminPanelApi = {
    snapshot: () => {
      const stats = computeStats(state);
      return {
        day: state.streamDay,
        stage: state.displayedSubStage,
        unlockedStage: state.unlockedSubStage,
        subs: state.subscribers,
        balance: state.balance,
        hype: state.hype,
        boldness: stats.boldness,
        viewers: stats.onlineViewers,
        incomePerSec: stats.passivePerSec,
        // What is on screen right now, flash beat included — the panel should never lie about the
        // frame you are looking at, or it reads as a broken jump.
        plate: stage.isGhostFlashing()
          ? `${stage.getActivePlateName()} → flash`
          : stage.getActivePlateName(),
        ladder: getSubGoalStagesForDay(state.streamDay).map((d) => ({
          stage: d.stage,
          label: d.shortGoalTitle,
          subs: d.subsRequired,
        })),
        finaleSubs: finaleSubsForDay(state.streamDay),
        day3Unlocked: isDay3Unlocked(),
        day4Unlocked: isDay4Unlocked(),
        day5Unlocked: isDay5Unlocked(),
        day6Unlocked: isDay6Unlocked(),
        saveSuppressed: adminSaveSuppressed,
      };
    },
    gotoDay: (day) => {
      const note = adminApplyJump(day, 0);
      if (note) ui.showSpeech(note);
    },
    gotoStage: (stageIdx) => {
      const note = adminApplyJump(state.streamDay, stageIdx);
      if (note) ui.showSpeech(note);
    },
    addSubs: (delta) => {
      state = debugSetSubscribers(state, Math.max(0, state.subscribers + delta));
      syncAll();
    },
    setSubs: (count) => {
      state = debugSetSubscribers(state, count);
      syncAll();
    },
    dayFinale: () => {
      state = debugSetSubscribers(state, finaleSubsForDay(state.streamDay));
      syncAll();
      ui.showSpeech('★ Финал дня пробит — карточка ждёт кнопкой ★ в плашке Sub Goal слева вверху.');
    },
    addFunds: (amount) => {
      state = { ...state, balance: state.balance + amount, totalEarned: state.totalEarned + Math.max(0, amount) };
      syncAll();
    },
    maxOutShop: () => {
      const res = debugMaxOutShop(state);
      state = res.state;
      syncAll();
      stage.app.render();
      ui.showSpeech(
        res.levels > 0
          ? `★ Магазин выкуплен: +${res.levels} уровней за ${Math.round(res.spent).toLocaleString('ru-RU')} ₽.`
          : 'Магазин уже выкуплен до последней полки.',
      );
    },
    setBars: (hype, boldness) => {
      state = debugSetBars(state, hype, boldness);
      stage.rig.setBoldness(computeStats(state).boldness);
      stage.setHypeLevel(state.hype);
      syncAll();
      stage.app.render();
    },
    ghostBoo: () => {
      // The same button drives both flash gimmicks: the rig picks the plate for the live day.
      if (state.streamDay === 4) {
        if (stage.triggerGhostBoo(650)) ui.showSpeech(DAY4_DONE_LINES[0]!);
        else ui.showSpeech('«Готово?» живёт в Дне 4 — прыгни туда кнопкой «4».');
        return;
      }
      if (stage.triggerGhostBoo(650)) ui.showSpeech(GHOST_BOO_LINES[0]!);
      else ui.showSpeech('«Бу!» живёт только в Дне 3 — прыгни туда кнопкой «День 3».');
    },
    forceEmotion: (emo) => {
      stage.rig.triggerEmotion(emo, 3500);
      stage.rig.update(120);
      stage.app.render();
    },
    forceBlink: () => {
      stage.rig.triggerBlink();
      stage.rig.update(95);
      stage.app.render();
    },
    // The admin console's version of a tap goes through the same door as the pointer's: a debug
    // button that answers differently from the game is a debug button that lies.
    tapZone: (zone) => {
      stage.rig.triggerTapReaction(zone);
      stage.answerTapZone(zone, 688, 340);
    },
    setSaveSuppressed: (on) => {
      adminSaveSuppressed = on;
      if (!on) localStorage.setItem(SAVE_STORAGE_KEY, serializeState(state));
    },
    exportSave: () => serializeState(state),
    importSave: (raw) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      try {
        JSON.parse(trimmed) as unknown;
      } catch {
        ui.showSpeech('Это не JSON — импорт отменён, сейв не тронут.');
        return;
      }
      state = deserializeState(trimmed);
      stage.setWardrobeDay(wardrobeDayOf(state.streamDay));
      syncAll();
      ui.showSpeech('Сейв импортирован.');
    },
    resetSave: () => {
      localStorage.removeItem(SAVE_STORAGE_KEY);
      state = createInitialState();
      stage.setWardrobeDay(1);
      syncAll();
      ui.showSpeech('Сейв стёрт, День 1 начинается заново.');
    },
    rig: rigApi,
  };
  try {
    adminPanel = new AdminPanel(adminApi);
    adminPanel.init({ hidden: isQa || new URLSearchParams(window.location.search).has('noadmin') });
  } catch (error) {
    adminPanel = null;
    console.warn('[admin] panel failed to mount (game keeps running)', error);
  }

  if (isQa) {
    window.__pixiApp = stage.app;
    window.__heroineRig = stage.rig;
    // The audio graph is invisible by nature; QA reads its state instead of hearing it.
    (window as unknown as { __sfx?: unknown }).__sfx = sfx;
    window.__qaFreezeTicker = () => {
      stage.app.ticker.stop();
      stage.app.render();
    };
    window.__qaScene = {
      getState: () => state,
      getDeskMicDebug: () => stage.getDeskMicDebug(),
      getFaceAnchorDebug: () => stage.rig.getFaceAnchorDebug(),
      getActivePlateName: () => stage.getActivePlateName(),
      situationLine: (seed: number) => {
        const statsNow = computeStats(state);
        return pickSituationLine({
          streamDay: state.streamDay,
          stage: state.displayedSubStage,
          subs: state.subscribers,
          nextGoalSubs: statsNow.nextSubGoalDef?.subsRequired ?? null,
          boldness: statsNow.boldness,
          hype: state.hype,
          onlineViewers: statsNow.onlineViewers,
          micTier: state.upgrades.desk_mic ?? 0,
          balance: state.balance,
          seed,
        });
      },
      farewellLineCount: () =>
        state.streamDay === 6
          ? DAY6_FAREWELL_LINES.length
          : state.streamDay === 5
          ? DAY5_FAREWELL_LINES.length
          : state.streamDay === 4
            ? DAY4_FAREWELL_LINES.length
          : state.streamDay === 3
            ? DAY3_FAREWELL_LINES.length
            : state.streamDay === 2
              ? DAY2_FAREWELL_LINES.length
              : DAY1_FAREWELL_LINES.length,
      isWearingDay2Outfit: () => stage.rig.isWearingDay2Outfit(),
      getStats: () => computeStats(state),
      // The same path a real click takes — director, reaction, burst — so QA can assert on what
      // she actually plays instead of on a parallel implementation that only QA uses.
      tapZone: (zone: TapZoneId) => {
        stage.rig.triggerTapReaction(zone);
        stage.answerTapZone(zone, 688, 340);
      },
      zoneCenter: (zone: TapZoneId) => stage.rig.zoneCenterScreen(zone),
      lastTapBeat: () => stage.lastTapBeat,
      lastTapDebug: () => stage.lastTapDebug,
      hoverDebug: () => stage.getHoverDebug(),
      blushDebug: () => stage.getBlushDebug(),
      cameraDebug: () => stage.getCameraDebug(),
      attentionDebug: () => stage.attentionDebug,
      tickDebug: () => ({ frames: stage.frameCount, error: stage.tickError }),
      addFunds: (amount: number) => {
        state = {
          ...state,
          balance: state.balance + amount,
          totalEarned: state.totalEarned + amount,
        };
        syncAll();
      },
      setSubscribers: (count: number) => {
        state = debugSetSubscribers(state, count);
        syncAll();
        stage.app.render();
        return state.subscribers;
      },
      giftSubs: (count: number) => {
        const prevSubs = state.subscribers;
        ui.onGiftSubs?.(count);
        stage.app.render();
        return state.subscribers > prevSubs;
      },
      setSubStage: (targetStage: SubGoalStageIndex) => {
        const res = selectDisplayedSubStage(state, targetStage);
        if (!res.ok) return false;
        state = res.state;
        syncAll();
        stage.app.render();
        return true;
      },
      buyUpgrade: (id: UpgradeId) => {
        const prev = state.upgrades[id];
        ui.onBuyUpgrade?.(id);
        return state.upgrades[id] > prev;
      },
      // QA only: the same call a chat line makes, so a script can prove she speaks on THIS plate.
      // Straight to the stage, not through `announce`: a muted game must not mute the QA's own line.
      say: (text: string) => stage.spawnReactionCallout(text, false, 0),
      talk: (ms: number) => stage.playLiveTalk(ms),
      muteChat: (on: boolean) => {
        announceMuted = on;
      },
      // Which plate the stage is actually showing — the rig's own art name goes STALE the moment a
      // non-rigged plate hides it, so QA must never judge by that.
      plate: () => stage.getActivePlateName(),
      liveDebug: () => ({
        animation: stage.live.currentAnimation,
        animations: stage.live.animations,
        art: stage.live.currentArt,
        fault: stage.live.faultReason,
        enabled: stage.liveEnabled,
        talkUntil: stage.live.talkDebug.until,
        reactionUntil: stage.live.talkDebug.reactionUntil,
        lastUpdate: stage.live.talkDebug.lastUpdate,
        visible: stage.live.talkDebug.visible,
        now: performance.now(),
      }),
      isDay3Unlocked: () => isDay3Unlocked(),
      isDay4Unlocked: () => isDay4Unlocked(),
      isDay5Unlocked: () => isDay5Unlocked(),
      isDay6Unlocked: () => isDay6Unlocked(),
      startDay6: () => { startDay6Flow(); return state.streamDay === 6; },
      ghostBoo: (ms?: number) => stage.triggerGhostBoo(ms ?? 520),
      facePatchDebug: () => stage.facePatchDebug(),
      ghostInfo: () => ({
        unlocked: isDay3Unlocked(),
        flashLive: stage.hasGhostFlash(),
        day: state.streamDay,
      }),
      yogaInfo: () => ({
        unlocked: isDay4Unlocked(),
        plates: stage.rig.hasDay4Plates(),
        flashLive: stage.hasGhostFlash(),
        day: state.streamDay,
      }),
      // Day 5 reports `flashLive: false` on purpose — the day has no reveal plate, and a QA probe that
      // claimed one existed would be a lie about the ladder rather than a bug report.
      bikiniInfo: () => ({
        unlocked: isDay5Unlocked(),
        plates: stage.rig.hasDay5Plates(),
        flashLive: false,
        day: state.streamDay,
      }),
      tapLine: (zone: TapZoneId, seed: number, stage: number, day: number) =>
        pickStageTapLine(zone, seed, stage as SubGoalStageIndex, day),
      startDay3: () => {
        startDay3Flow();
        return state.streamDay === 3;
      },
      startDay4: () => {
        startDay4Flow();
        return state.streamDay === 4;
      },
      startDay5: () => {
        startDay5Flow();
        return state.streamDay === 5;
      },
      startDay2: () => {
        const prevDay = state.streamDay;
        ui.onStartDay2?.();
        return state.streamDay > prevDay;
      },
      runChallenge: (id: ChallengeId) => {
        const prevBold = state.boldness;
        ui.onTriggerChallenge?.(id);
        return state.boldness > prevBold;
      },
      switchTab: (tab: BottomTabId) => {
        ui.switchTab(tab);
      },
      forceBlink: () => {
        stage.rig.triggerBlink();
        stage.rig.update(95);
        stage.app.render();
      },
      forceFluster: () => {
        stage.rig.triggerEmotion('fluster', 3000);
        stage.rig.update(120);
        stage.app.render();
      },
      forceEmotion: (emo: Exclude<HeroineEmotion, 'neutral'>) => {
        stage.rig.triggerEmotion(emo, 3500);
        stage.rig.update(120);
        stage.app.render();
      },
      resetSave: () => {
        state = createInitialState();
        syncAll();
      },
    };
  }
}

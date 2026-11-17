import type { Application } from 'pixi.js';
import {
  createAmbientChatMessage,
  createDay2ProvocationChatMessage,
  createDonationChatMessage,
  createFarewellChatMessage,
  createSubGoalCascadeMessages,
  createSubNotificationMessage,
  createUpgradeChatMessage,
  createViralClipChatMessage,
  createZoneBurstMessage,
} from '../chat/chatEngine.ts';
import {
  DAY1_FAREWELL_LINES,
  DAY2_FAREWELL_LINES,
  DAY2_OPENING_LINE,
  DAY2_SHAME_LINES,
  DAY3_FAREWELL_LINES,
  DAY3_OPENING_LINE,
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
  tickEconomy,
  triggerStreamChallenge,
} from '../domain/engine.ts';
import { isDay3Unlocked, pickShySubGoalApproachLine, probeDay3Art } from '../domain/subGoals.ts';
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
      situationLine: (seed: number) => string;
      tapLine: (zone: TapZoneId, seed: number, stage: number, day: number) => string;
      farewellLineCount: () => number;
      isWearingDay2Outfit: () => boolean;
      getStats: () => ReturnType<typeof computeStats>;
      tapZone: (zone: TapZoneId) => void;
      addFunds: (amount: number) => void;
      setSubscribers: (count: number) => number;
      giftSubs: (count: number) => boolean;
      setSubStage: (stage: SubGoalStageIndex) => boolean;
      buyUpgrade: (id: UpgradeId) => boolean;
      startDay2: () => boolean;
      startDay3: () => boolean;
      isDay3Unlocked: () => boolean;
      ghostBoo: (ms?: number) => boolean;
      ghostInfo: () => { unlocked: boolean; flashLive: boolean; day: number };
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

  ui.onTabChange = (tab: BottomTabId) => {
    lastPlayerInteractionMs = performance.now();
    stage.setDrawerOpen(tab !== 'stream');
  };

  const syncAll = () => {
    const stats = computeStats(state);
    stage.setRingLampLevel(state.upgrades.ring_lamp ?? 0);
    stage.setHypeLevel(state.hype);
    stage.setMicTier(state.upgrades.desk_mic ?? 0);
    stage.rig.setBoldness(stats.boldness);
    stage.setWardrobeDay(state.streamDay === 3 ? 3 : state.streamDay === 2 ? 2 : 1);
    stage.setSubStage(state.displayedSubStage, false);
    ui.render(state, stats);
    if (!isQa) {
      localStorage.setItem(SAVE_STORAGE_KEY, serializeState(state));
    }
  };

  const celebrateSubGoalUnlocks = (unlockedStages: SubGoalStageDef[]) => {
    if (unlockedStages.length === 0) return;
    lastCelebrationMs = performance.now();
    const latest = unlockedStages[unlockedStages.length - 1]!;
    stage.setSubStage(latest.stage, true, latest.removedItemLabel, latest.unlockEmotion);
    stage.spawnReactionCallout(latest.removedItemLabel, true, latest.stage);
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

  stage.onHeroineTap = (zone: TapZoneId) => {
    lastPlayerInteractionMs = performance.now();
    const outcome = applyTap(state, zone);
    state = outcome.state;
    const afterStats = computeStats(state);
    stage.rig.setBoldness(afterStats.boldness);

    const isFever = state.hype >= 72;
    const isFeverTrigger = isFever && state.totalTaps % 4 === 0;

    // Day 3 tap gimmick: a «Бу!» and the sheet flashes up for a beat (crossfade to the reveal plate),
    // and the chat explodes with clips like any decent haunt would.
    const isBoo = state.streamDay === 3 && state.totalTaps % 3 === 0;
    const booFlashed = isBoo ? stage.triggerGhostBoo(state.hype >= 72 ? 700 : 480) : false;
    if (booFlashed) {
      ui.showSpeech(GHOST_BOO_LINES[state.totalTaps % GHOST_BOO_LINES.length]!);
      stage.spawnReactionCallout('♥ БУ! ЧАТ В КЛИПАХ!', true, state.totalTaps);
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
      stage.spawnReactionCallout(
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
          createViralClipChatMessage(zone, afterStats.onlineViewers, state.totalTaps),
        );
      } else if (state.totalTaps % 2 === 1 || outcome.triggeredDonationAlert) {
        ui.pushChatMessage(
          createZoneBurstMessage(zone, state.displayedSubStage, state.totalTaps, state.streamDay),
        );
      }

      if (outcome.triggeredDonationAlert) {
        ui.showDonationAlert(
          `★ ГОРЯЧИЙ ДОНАТ +${outcome.earned} ₽`,
          '«Не прикрывайся, ты сводишь весь чат с ума! ♥»',
        );
        ui.pushChatMessage(createDonationChatMessage(outcome.earned, state.totalTaps));
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
      stage.spawnReactionCallout(`+${count} САБ ♥`, count >= 5, state.subscribers);
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
      stage.spawnReactionCallout(
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
      state.streamDay === 3
        ? DAY3_FAREWELL_LINES.length
        : state.streamDay === 2
          ? DAY2_FAREWELL_LINES.length
          : DAY1_FAREWELL_LINES.length;
    stage.rig.triggerEmotion(index >= beats - 2 ? 'tease' : 'shy', 2300);
    if (index === beats - 1) {
      stage.spawnReactionCallout(
        state.streamDay === 3 ? '♥ КОСПЛЕЙ-ДЕНЬ ЗАКРЫТ!' : '♥ ПОКА-ПОКА, ЧАТ!',
        true,
        index,
      );
    }
  };

  ui.onStartDay2 = () => {
    lastPlayerInteractionMs = performance.now();
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
        ui.showSpeech(line);
        ui.pushChatMessage(createDay2ProvocationChatMessage(i));
        stage.rig.triggerEmotion(i % 2 === 0 ? 'shy' : 'fluster', 2400);
        if (i === DAY2_SHAME_LINES.length - 1) {
          stage.spawnReactionCallout('♥ ЧАТ ПОДНАИВАЕТ!', true, i);
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
  void probeDay3Art().then(() => {
    syncAll();
  });

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
        stage.spawnReactionCallout('♥ БУ! ПРИЗРАК НА СВЯЗИ!', true, 0);
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
    stage.spawnReactionCallout('ФАНСЕРВИС ★ ♥', true, Math.floor(res.reward));

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
        createViralClipChatMessage(res.zoneFocus, afterStats.onlineViewers, Math.floor(res.reward)),
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

  if (isQa) {
    window.__pixiApp = stage.app;
    window.__heroineRig = stage.rig;
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
        state.streamDay === 3
          ? DAY3_FAREWELL_LINES.length
          : state.streamDay === 2
            ? DAY2_FAREWELL_LINES.length
            : DAY1_FAREWELL_LINES.length,
      isWearingDay2Outfit: () => stage.rig.isWearingDay2Outfit(),
      getStats: () => computeStats(state),
      tapZone: (zone: TapZoneId) => {
        stage.rig.triggerTapReaction(zone);
        const res = stage.onHeroineTap?.(zone);
        if (res) {
          stage.spawnTapBurst(688, 340, res.earned, res.alert, zone);
        }
      },
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
      isDay3Unlocked: () => isDay3Unlocked(),
      ghostBoo: (ms?: number) => stage.triggerGhostBoo(ms ?? 520),
      ghostInfo: () => ({
        unlocked: isDay3Unlocked(),
        flashLive: stage.hasGhostFlash(),
        day: state.streamDay,
      }),
      tapLine: (zone: TapZoneId, seed: number, stage: number, day: number) =>
        pickStageTapLine(zone, seed, stage as SubGoalStageIndex, day),
      startDay3: () => {
        startDay3Flow();
        return state.streamDay === 3;
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

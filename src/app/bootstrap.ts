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
  DAY2_OPENING_LINE,
  DAY2_SHAME_LINES,
  pickDay2TapLine,
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
  tickEconomy,
  triggerStreamChallenge,
} from '../domain/engine.ts';
import { pickShySubGoalApproachLine } from '../domain/subGoals.ts';
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
      isWearingDay2Outfit: () => boolean;
      getStats: () => ReturnType<typeof computeStats>;
      tapZone: (zone: TapZoneId) => void;
      addFunds: (amount: number) => void;
      setSubscribers: (count: number) => number;
      giftSubs: (count: number) => boolean;
      setSubStage: (stage: SubGoalStageIndex) => boolean;
      buyUpgrade: (id: UpgradeId) => boolean;
      startDay2: () => boolean;
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
    stage.setWardrobeDay(state.streamDay === 2 ? 2 : 1);
    stage.setSubStage(state.displayedSubStage, false);
    ui.render(state, stats);
    if (!isQa) {
      localStorage.setItem(SAVE_STORAGE_KEY, serializeState(state));
    }
  };

  const celebrateSubGoalUnlocks = (unlockedStages: SubGoalStageDef[]) => {
    if (unlockedStages.length === 0) return;
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

    if (isFeverTrigger) {
      stage.rig.triggerArchStretch(afterStats.boldness >= 60 ? 'bold' : 'fluster');
      ui.showSpeech(pickFeverOverheatLine(zone, state.displayedSubStage, state.totalTaps, state.streamDay));
    } else if (state.streamDay === 2 && state.totalTaps % 2 === 1) {
      // Day 2: every tap drags yesterday's strip ladder back into her head.
      ui.showSpeech(pickDay2TapLine(zone, state.totalTaps, state.displayedSubStage));
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
    ui.pushChatMessage(createFarewellChatMessage(index));
    stage.rig.triggerEmotion(index >= DAY1_FAREWELL_LINES.length - 2 ? 'tease' : 'shy', 2300);
    if (index === DAY1_FAREWELL_LINES.length - 1) {
      stage.spawnReactionCallout('♥ ПОКА-ПОКА, ЧАТ!', true, index);
    }
  };

  ui.onStartDay2 = () => {
    lastPlayerInteractionMs = performance.now();
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
  ui.pushChatMessage(createAmbientChatMessage(3, state.displayedSubStage, 1));
  ui.pushChatMessage(createAmbientChatMessage(3, state.displayedSubStage, 2));
  ui.pushChatMessage(createAmbientChatMessage(3, state.displayedSubStage, 3));
  syncAll();

  // Uncapped elapsed-ms economy loop + spontaneous idle fourth-wall teasing!
  let lastEconomyMs = performance.now();
  window.setInterval(() => {
    const nowPerf = performance.now();
    const elapsed = nowPerf - lastEconomyMs;
    lastEconomyMs = nowPerf;
    const res = tickEconomy(state, elapsed);
    state = res.state;

    // If viewer has been silently staring at Miya for ~11s, she notices and teases!
    if (!isQa && nowPerf - lastPlayerInteractionMs > 11000) {
      lastPlayerInteractionMs = nowPerf;
      idleTeaseCounter += 1;
      const statsNow = computeStats(state);
      stage.rig.triggerEmotion(statsNow.boldness < 45 ? 'shy' : 'tease', 2200);
      ui.showSpeech(
        pickIdleTeaseLine(state.displayedSubStage, idleTeaseCounter, state.streamDay),
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

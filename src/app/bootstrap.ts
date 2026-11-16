import type { Application } from 'pixi.js';
import {
  createAmbientChatMessage,
  createDonationChatMessage,
  createSubGoalCascadeMessages,
  createSubNotificationMessage,
  createUpgradeChatMessage,
  createZoneBurstMessage,
} from '../chat/chatEngine.ts';
import { UPGRADE_REACTION_LINES } from '../domain/dialogue.ts';
import {
  applyTap,
  buyGiftSubs,
  buyUpgrade,
  computeStats,
  createInitialState,
  deserializeState,
  SAVE_STORAGE_KEY,
  selectDisplayedSubStage,
  serializeState,
  tickEconomy,
  triggerStreamChallenge,
} from '../domain/engine.ts';
import type {
  BottomTabId,
  ChallengeId,
  GameState,
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
      getStats: () => ReturnType<typeof computeStats>;
      tapZone: (zone: TapZoneId) => void;
      addFunds: (amount: number) => void;
      giftSubs: (count: 1 | 5 | 25) => boolean;
      setSubStage: (stage: SubGoalStageIndex) => boolean;
      buyUpgrade: (id: UpgradeId) => boolean;
      runChallenge: (id: ChallengeId) => boolean;
      switchTab: (tab: BottomTabId) => void;
      forceBlink: () => void;
      forceFluster: () => void;
      resetSave: () => void;
    };
  }
}

export async function bootstrapApp(): Promise<void> {
  const isQa = new URLSearchParams(window.location.search).has('qa');

  let state: GameState = isQa
    ? createInitialState()
    : deserializeState(localStorage.getItem(SAVE_STORAGE_KEY));

  const ui = new UiController();
  ui.init();

  const stageHost = document.getElementById('stream-stage-host')!;
  const stage = new StreamStage();
  await stage.mount(stageHost);
  stage.setSubStage(state.displayedSubStage, false);

  ui.onTabChange = (tab: BottomTabId) => {
    stage.setDrawerOpen(tab !== 'stream');
  };

  const syncAll = () => {
    const stats = computeStats(state);
    stage.setRingLampLevel(state.upgrades.ring_lamp ?? 0);
    stage.setSubStage(state.displayedSubStage, false);
    ui.render(state, stats);
    if (!isQa) {
      localStorage.setItem(SAVE_STORAGE_KEY, serializeState(state));
    }
  };

  const celebrateSubGoalUnlocks = (unlockedStages: SubGoalStageDef[]) => {
    if (unlockedStages.length === 0) return;
    const latest = unlockedStages[unlockedStages.length - 1]!;
    stage.setSubStage(latest.stage, true, latest.removedItemLabel);
    ui.showSpeech(latest.unlockLine);
    ui.showDonationAlert(
      `★ SUB GOAL ${latest.subsRequired} САБОВ! ★`,
      `${latest.removedItemLabel} Доход увеличен до x${latest.incomeMultiplier.toFixed(2)}!`,
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
    const outcome = applyTap(state, zone);
    state = outcome.state;
    ui.showSpeech(outcome.line);

    if (outcome.gainedOrganicSubs > 0) {
      ui.pushChatMessage(
        createSubNotificationMessage(outcome.gainedOrganicSubs, false, state.subscribers),
      );
    }

    if (outcome.newlyUnlockedSubStages.length > 0) {
      celebrateSubGoalUnlocks(outcome.newlyUnlockedSubStages);
    } else {
      if (state.totalTaps % 2 === 1 || outcome.triggeredDonationAlert) {
        ui.pushChatMessage(
          createZoneBurstMessage(zone, state.displayedSubStage, state.totalTaps),
        );
      }
      if (outcome.triggeredDonationAlert) {
        ui.showDonationAlert(
          outcome.earned,
          '«Лови донат в копилку на следующий Sub Goal! ♥»',
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
        text: `Достигнута цель онлайна: ${m.title}! :Pog: :SubHype:`,
        isSystemHighlight: true,
      });
    }

    syncAll();
    return { earned: outcome.earned, alert: outcome.triggeredDonationAlert };
  };

  ui.onGiftSubs = (count: 1 | 5 | 25) => {
    const res = buyGiftSubs(state, count);
    if (!res.ok) return;
    state = res.state;

    ui.pushChatMessage(createSubNotificationMessage(count, true, state.subscribers));

    if (res.newlyUnlockedSubStages.length > 0) {
      celebrateSubGoalUnlocks(res.newlyUnlockedSubStages);
    } else {
      stage.rig.triggerFluster(1500);
      stage.rig.triggerTapReaction('chest');
      ui.showSpeech(
        count >= 5
          ? `Ого, сразу +${count} подарочных сабов в чат?! Полоска Sub Goal летит к цели!~ ★ ♥`
          : `Спасибо за подарочный саб, котик! Ещё на шаг ближе к снятию следующей вещи~ ♥`,
      );
    }

    for (const m of res.newlyUnlockedMilestones) {
      ui.pushChatMessage({
        id: `ms_${m.id}`,
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: `Достигнута цель онлайна: ${m.title}! :Pog: :SubHype:`,
        isSystemHighlight: true,
      });
    }
    syncAll();
  };

  ui.onSelectSubStage = (targetStage: SubGoalStageIndex) => {
    const res = selectDisplayedSubStage(state, targetStage);
    if (!res.ok) return;
    state = res.state;
    stage.setSubStage(state.displayedSubStage, true);
    syncAll();
  };

  ui.onBuyUpgrade = (id: UpgradeId) => {
    const res = buyUpgrade(state, id);
    if (!res.ok) return;
    state = res.state;
    stage.rig.triggerFluster(1700);
    stage.rig.triggerTapReaction('chest');
    ui.showSpeech(UPGRADE_REACTION_LINES[id]);
    ui.pushChatMessage(createUpgradeChatMessage(id));
    syncAll();
  };

  ui.onTriggerChallenge = (id: ChallengeId) => {
    const res = triggerStreamChallenge(state, id);
    if (!res.ok) return;
    state = res.state;
    stage.rig.triggerFluster(2100);
    stage.rig.triggerTapReaction(res.zoneFocus);
    stage.spawnTapBurst(688, 320, res.reward, true, res.zoneFocus);
    ui.pushChatMessage({
      id: `ch_${Date.now()}`,
      author: 'VIP_Donater',
      color: '#ffd54f',
      badge: 'DONATE',
      text: res.chatBurst,
      isSystemHighlight: true,
    });

    if (res.newlyUnlockedSubStages.length > 0) {
      celebrateSubGoalUnlocks(res.newlyUnlockedSubStages);
    } else {
      ui.showSpeech(res.line);
      ui.showDonationAlert(res.reward, `★ Челлендж выполнен (+${res.gainedSubs} саб)! ★`);
    }
    syncAll();
  };

  // Seed initial subtle floating stream chat matching current clothing stage
  ui.pushChatMessage(createAmbientChatMessage(3, state.displayedSubStage, 1));
  ui.pushChatMessage(createAmbientChatMessage(3, state.displayedSubStage, 2));
  ui.pushChatMessage(createAmbientChatMessage(3, state.displayedSubStage, 3));
  syncAll();

  // Uncapped elapsed-ms economy loop
  let lastEconomyMs = performance.now();
  window.setInterval(() => {
    const nowPerf = performance.now();
    const elapsed = nowPerf - lastEconomyMs;
    lastEconomyMs = nowPerf;
    const res = tickEconomy(state, elapsed);
    state = res.state;

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
        text: `Достигнута цель онлайна: ${m.title}! :Pog: :SubHype:`,
        isSystemHighlight: true,
      });
    }
    syncAll();
  }, 250);

  // Ambient live chat ticker scaling with onlineViewers
  let chatCounter = 4;
  const scheduleNextAmbientChat = () => {
    const viewers = computeStats(state).onlineViewers;
    const delayMs = Math.max(950, 3600 - Math.min(2400, viewers * 30));
    window.setTimeout(() => {
      chatCounter += 1;
      ui.pushChatMessage(createAmbientChatMessage(viewers, state.displayedSubStage, chatCounter));
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
      giftSubs: (count: 1 | 5 | 25) => {
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
        stage.rig.triggerFluster(3000);
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

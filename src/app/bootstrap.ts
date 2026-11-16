import type { Application } from 'pixi.js';
import {
  createAmbientChatMessage,
  createDonationChatMessage,
  createUpgradeChatMessage,
  createZoneBurstMessage,
} from '../chat/chatEngine.ts';
import { UPGRADE_REACTION_LINES } from '../domain/dialogue.ts';
import {
  applyTap,
  buyUpgrade,
  computeStats,
  createInitialState,
  deserializeState,
  SAVE_STORAGE_KEY,
  serializeState,
  tickEconomy,
} from '../domain/engine.ts';
import type { GameState, TapZoneId, UpgradeId } from '../domain/types.ts';
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
      buyUpgrade: (id: UpgradeId) => boolean;
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

  const syncAll = () => {
    const stats = computeStats(state);
    stage.setRingLampLevel(state.upgrades.ring_lamp ?? 0);
    ui.render(state, stats);
    if (!isQa) {
      localStorage.setItem(SAVE_STORAGE_KEY, serializeState(state));
    }
  };

  stage.onHeroineTap = (zone: TapZoneId) => {
    const outcome = applyTap(state, zone);
    state = outcome.state;
    ui.showSpeech(outcome.line);

    // Chat reacts enthusiastically to taps
    if (state.totalTaps % 2 === 1 || outcome.triggeredDonationAlert) {
      ui.pushChatMessage(createZoneBurstMessage(zone, state.totalTaps));
    }
    if (outcome.triggeredDonationAlert) {
      ui.showDonationAlert(
        outcome.earned,
        '«Не смущайся, ты лучшая! Держи на развитие стрима 💜»',
      );
      ui.pushChatMessage(createDonationChatMessage(outcome.earned, state.totalTaps));
    }
    for (const m of outcome.newlyUnlockedMilestones) {
      ui.pushChatMessage({
        id: `ms_${m.id}`,
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: `🎉 Достигнута цель: ${m.title}! ${m.rewardText}`,
        isSystemHighlight: true,
      });
    }

    syncAll();
    return { earned: outcome.earned, alert: outcome.triggeredDonationAlert };
  };

  ui.onBuyUpgrade = (id: UpgradeId) => {
    const res = buyUpgrade(state, id);
    if (!res.ok) return;
    state = res.state;
    stage.rig.triggerFluster(1700);
    stage.rig.triggerTapReaction('chest');
    ui.showSpeech(UPGRADE_REACTION_LINES[id]);
    ui.pushChatMessage(createUpgradeChatMessage(id, state.totalTaps));
    for (const m of res.newlyUnlockedMilestones) {
      ui.pushChatMessage({
        id: `ms_${m.id}`,
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: `🎉 Достигнута цель: ${m.title}! ${m.rewardText}`,
        isSystemHighlight: true,
      });
    }
    syncAll();
  };

  ui.onPlayerChat = (text: string) => {
    ui.pushChatMessage({
      id: `you_${Date.now()}`,
      author: 'Ты (Зритель #1)',
      color: '#a970ff',
      badge: 'VIP',
      text,
    });
    stage.rig.triggerFluster(1600);
    stage.rig.triggerTapReaction('head');
    ui.showSpeech('Ой, я прочитала твоё сообщение в чате... с-спасибо большое, мне так приятно! 😳💜');
  };

  // Seed initial cozy starter chat lines
  ui.pushChatMessage({
    id: 'welcome_1',
    author: 'StreamBot',
    color: '#c084fc',
    badge: 'MOD',
    text: 'Трансляция miya_nyash началась! Поддержи начинающую стримершу кликами и комплиментами 💜',
    isSystemHighlight: true,
  });
  ui.pushChatMessage(createAmbientChatMessage(3, 1));
  ui.pushChatMessage(createAmbientChatMessage(3, 2));
  syncAll();

  // Uncapped elapsed-ms economy loop (250ms cadence)
  let lastEconomyMs = performance.now();
  window.setInterval(() => {
    const nowPerf = performance.now();
    const elapsed = nowPerf - lastEconomyMs;
    lastEconomyMs = nowPerf;
    const res = tickEconomy(state, elapsed);
    state = res.state;
    for (const m of res.newlyUnlockedMilestones) {
      ui.pushChatMessage({
        id: `ms_${m.id}`,
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: `🎉 Достигнута цель: ${m.title}! ${m.rewardText}`,
        isSystemHighlight: true,
      });
    }
    syncAll();
  }, 250);

  // Ambient live chat ticker scaling with onlineViewers
  let chatCounter = 3;
  const scheduleNextAmbientChat = () => {
    const viewers = computeStats(state).onlineViewers;
    const delayMs = Math.max(950, 3800 - Math.min(2600, viewers * 32));
    window.setTimeout(() => {
      chatCounter += 1;
      ui.pushChatMessage(createAmbientChatMessage(viewers, chatCounter));
      scheduleNextAmbientChat();
    }, delayMs);
  };
  scheduleNextAmbientChat();

  // ?qa deterministic test & screenshot hooks
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
        state = { ...state, balance: state.balance + amount, totalEarned: state.totalEarned + amount };
        syncAll();
      },
      buyUpgrade: (id: UpgradeId) => {
        const prev = state.upgrades[id];
        ui.onBuyUpgrade?.(id);
        return state.upgrades[id] > prev;
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

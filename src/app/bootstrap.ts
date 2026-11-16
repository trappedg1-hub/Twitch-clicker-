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
  triggerStreamChallenge,
} from '../domain/engine.ts';
import type {
  BottomTabId,
  ChallengeId,
  GameState,
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

    if (state.totalTaps % 2 === 1 || outcome.triggeredDonationAlert) {
      ui.pushChatMessage(createZoneBurstMessage(zone, state.totalTaps));
    }
    if (outcome.triggeredDonationAlert) {
      ui.showDonationAlert(
        outcome.earned,
        '«Не смущайся, ты невероятно горячая! Лови на развитие 💜»',
      );
      ui.pushChatMessage(createDonationChatMessage(outcome.earned, state.totalTaps));
    }
    for (const m of outcome.newlyUnlockedMilestones) {
      ui.pushChatMessage({
        id: `ms_${m.id}`,
        author: 'StreamBot',
        color: '#c084fc',
        badge: 'MOD',
        text: `🎉 ${m.title}! ${m.rewardText}`,
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
    syncAll();
  };

  ui.onTriggerChallenge = (id: ChallengeId) => {
    const res = triggerStreamChallenge(state, id);
    if (!res.ok) return;
    state = res.state;
    stage.rig.triggerFluster(2100);
    stage.rig.triggerTapReaction(res.zoneFocus);
    stage.spawnTapBurst(688, 320, res.reward, true, res.zoneFocus);
    ui.showSpeech(res.line);
    ui.showDonationAlert(res.reward, '🔥 Выполнен горячий челлендж чата!');
    ui.pushChatMessage({
      id: `ch_${Date.now()}`,
      author: 'VIP_Donater',
      color: '#ffd54f',
      badge: 'DONATE',
      text: res.chatBurst,
      isSystemHighlight: true,
    });
    syncAll();
  };

  // Seed initial subtle floating stream chat
  ui.pushChatMessage(createAmbientChatMessage(3, 1));
  ui.pushChatMessage(createAmbientChatMessage(3, 2));
  ui.pushChatMessage(createAmbientChatMessage(3, 3));
  syncAll();

  // Uncapped elapsed-ms economy loop
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
        text: `🎉 ${m.title}! ${m.rewardText}`,
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
      ui.pushChatMessage(createAmbientChatMessage(viewers, chatCounter));
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

import type { ChatMessage } from '../chat/chatEngine.ts';
import { STREAM_TITLES_BY_BAND } from '../domain/dialogue.ts';
import { STREAM_CHALLENGES, WARDROBE_OUTFITS } from '../domain/progression.ts';
import type {
  BottomTabId,
  ChallengeId,
  ComputedStats,
  GameState,
  UpgradeId,
} from '../domain/types.ts';
import { getUpgradeCost, TIER1_MILESTONES, TIER1_UPGRADES } from '../domain/upgrades.ts';

function formatMoney(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k ₽`;
  return `${Math.floor(n)} ₽`;
}

export class UiController {
  private readonly stageBadgeEl = document.getElementById('story-stage-badge')!;
  private readonly titleEl = document.getElementById('stream-title')!;
  private readonly boldnessFillEl = document.getElementById('boldness-fill')!;
  private readonly boldnessPctEl = document.getElementById('boldness-pct')!;

  private readonly viewersEl = document.getElementById('stat-viewers-val')!;
  private readonly balanceEl = document.getElementById('stat-balance-val')!;
  private readonly incomeEl = document.getElementById('stat-income-val')!;
  private readonly hypeMultEl = document.getElementById('stat-hype-mult')!;
  private readonly hypeFillEl = document.getElementById('stat-hype-fill')!;

  private readonly speechBubbleEl = document.getElementById('speech-bubble')!;
  private readonly speechTextEl = document.getElementById('speech-text')!;

  private readonly milestoneLabelEl = document.getElementById('milestone-progress-label')!;
  private readonly milestoneTitleEl = document.getElementById('milestone-title')!;
  private readonly milestoneFillEl = document.getElementById('milestone-fill')!;

  private readonly alertBoxEl = document.getElementById('donation-alert')!;
  private readonly alertAmountEl = document.getElementById('donation-alert-amount')!;
  private readonly alertSubEl = document.getElementById('donation-alert-sub')!;

  private readonly chatMessagesEl = document.getElementById('chat-messages')!;

  private readonly bottomDockEl = document.getElementById('bottom-dock')!;
  private readonly toggleDockBtn = document.getElementById('btn-toggle-dock')!;
  private readonly upgradesGridEl = document.getElementById('upgrades-grid')!;
  private readonly outfitsGridEl = document.getElementById('outfits-grid')!;
  private readonly challengesGridEl = document.getElementById('challenges-grid')!;

  private readonly diaryStagePillEl = document.getElementById('diary-stage-pill')!;
  private readonly diaryHeadlineEl = document.getElementById('diary-headline')!;
  private readonly diaryThoughtEl = document.getElementById('diary-thought')!;

  private alertTimer?: number;
  private speechPopTimer?: number;
  private upgradeButtons = new Map<UpgradeId, HTMLButtonElement>();
  private challengeButtons = new Map<ChallengeId, HTMLButtonElement>();

  public onBuyUpgrade?: (id: UpgradeId) => void;
  public onTriggerChallenge?: (id: ChallengeId) => void;
  public onLayoutResize?: () => void;

  public init(): void {
    this.setupTabs();
    this.buildUpgradeCards();
    this.buildOutfitCards();
    this.buildChallengeCards();
  }

  private setupTabs(): void {
    const tabBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.dock-tab'));
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab as BottomTabId;
        this.switchTab(target);
      });
    });

    this.toggleDockBtn.addEventListener('click', () => {
      const collapsed = this.bottomDockEl.classList.toggle('collapsed');
      this.toggleDockBtn.textContent = collapsed ? 'Развернуть меню ▴' : 'Свернуть панель ▾';
      window.setTimeout(() => this.onLayoutResize?.(), 30);
    });
  }

  public switchTab(tab: BottomTabId): void {
    this.bottomDockEl.classList.remove('collapsed');
    this.toggleDockBtn.textContent = 'Свернуть панель ▾';

    document.querySelectorAll<HTMLButtonElement>('.dock-tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll<HTMLElement>('.tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `tab-panel-${tab}`);
    });
    window.setTimeout(() => this.onLayoutResize?.(), 20);
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
    for (const o of WARDROBE_OUTFITS) {
      const card = document.createElement('div');
      card.className = `outfit-card ${o.availableInCurrentBuild ? 'equipped' : 'locked'}`;
      card.innerHTML = `
        <div>
          <div class="outfit-head">
            <span class="outfit-name">${o.name}</span>
            <span class="outfit-mult">x${o.incomeMultiplier.toFixed(2)} ₽</span>
          </div>
          <p class="outfit-desc">${o.storyDesc}</p>
        </div>
        <div class="outfit-req ${o.availableInCurrentBuild ? 'active-tag' : ''}">
          ${
            o.availableInCurrentBuild
              ? '✓ Надето сейчас (Тир 1)'
              : `🔒 Тир ${o.tier}: ${o.viewersRequired} онл. • ${o.boldnessRequired}% смелости • ${o.cost} ₽`
          }
        </div>
      `;
      this.outfitsGridEl.appendChild(card);
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

  public render(state: GameState, stats: ComputedStats, nowMs = Date.now()): void {
    this.stageBadgeEl.textContent = stats.storyChapter.badgeTitle;
    this.titleEl.textContent = STREAM_TITLES_BY_BAND[stats.dialogueBand];
    this.boldnessFillEl.style.width = `${stats.boldness}%`;
    this.boldnessPctEl.textContent = `${Math.floor(stats.boldness)}%`;

    this.viewersEl.textContent = String(stats.onlineViewers);
    this.balanceEl.textContent = formatMoney(state.balance);
    this.incomeEl.textContent = `+${stats.clickIncome} ₽ • ${stats.passivePerSec}/с`;
    this.hypeMultEl.textContent = `x${stats.hypeMultiplier.toFixed(2)}`;
    this.hypeFillEl.style.width = `${Math.min(100, Math.max(0, state.hype))}%`;

    // Milestone bar
    const next = stats.nextMilestone;
    if (next) {
      this.milestoneLabelEl.textContent = `${stats.onlineViewers} / ${next.viewersRequired}`;
      this.milestoneTitleEl.textContent = `Цель: ${next.title}`;
      const pct = Math.min(100, Math.round((stats.onlineViewers / next.viewersRequired) * 100));
      this.milestoneFillEl.style.width = `${pct}%`;
    } else {
      const last = TIER1_MILESTONES[TIER1_MILESTONES.length - 1]!;
      this.milestoneLabelEl.textContent = `${stats.onlineViewers} MAX`;
      this.milestoneTitleEl.textContent = `Пик Тир-1 (${last.viewersRequired}+ онл.) достигнут!`;
      this.milestoneFillEl.style.width = '100%';
    }

    // Story diary
    this.diaryStagePillEl.textContent = `Дневник Мии • Этап ${stats.storyChapter.stage}/4`;
    this.diaryHeadlineEl.textContent = stats.storyChapter.headline;
    this.diaryThoughtEl.textContent = stats.storyChapter.diaryThought;

    // Upgrade cards
    for (const def of TIER1_UPGRADES) {
      const btn = this.upgradeButtons.get(def.id);
      if (!btn) continue;
      const lvl = state.upgrades[def.id] ?? 0;
      const isMax = lvl >= def.maxLevel;
      const cost = getUpgradeCost(def, lvl);
      const canAfford = !isMax && state.balance >= cost;

      btn.disabled = isMax;
      btn.classList.toggle('affordable', canAfford);
      btn.innerHTML = `
        <div class="upg-top">
          <div class="upg-title-wrap">
            <span class="upg-icon">${def.icon}</span>
            <span class="upg-name">${def.name}</span>
          </div>
          <span class="upg-lvl">ур.${lvl}</span>
        </div>
        <div class="upg-bottom">
          <span class="upg-bonuses">+${def.viewersBonus} онл • +${def.boldnessBonus}% смел</span>
          <span class="upg-cost">${isMax ? 'МАКС' : `${cost} ₽`}</span>
        </div>
      `;
    }

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
        statusLabel = `🔒 ${ch.viewersRequired} онл.`;
      } else if (cdLeftSec > 0) {
        statusLabel = `⏳ ${cdLeftSec}с`;
      }

      btn.innerHTML = `
        <div>
          <div class="ch-top">
            <span class="ch-name">${ch.icon} ${ch.name}</span>
          </div>
          <p class="ch-desc">${ch.desc}</p>
        </div>
        <div class="ch-foot">
          <span class="ch-bold">+${ch.boldnessGain}% раскреп.</span>
          <span class="ch-status">${statusLabel}</span>
        </div>
      `;
    }
  }

  public showSpeech(line: string): void {
    this.speechTextEl.textContent = line;
    this.speechBubbleEl.classList.add('pop');
    window.clearTimeout(this.speechPopTimer);
    this.speechPopTimer = window.setTimeout(() => {
      this.speechBubbleEl.classList.remove('pop');
    }, 240);
  }

  public showDonationAlert(amount: number, message: string): void {
    this.alertAmountEl.textContent = `+${amount} ₽`;
    this.alertSubEl.textContent = message;
    this.alertBoxEl.classList.remove('hidden');
    window.clearTimeout(this.alertTimer);
    this.alertTimer = window.setTimeout(() => {
      this.alertBoxEl.classList.add('hidden');
    }, 2500);
  }

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
    body.textContent = msg.text;
    row.appendChild(body);

    this.chatMessagesEl.appendChild(row);
    // Keep only last 7 floating overlay messages so stream screen stays super clean!
    while (this.chatMessagesEl.children.length > 7) {
      this.chatMessagesEl.removeChild(this.chatMessagesEl.firstChild!);
    }
  }
}

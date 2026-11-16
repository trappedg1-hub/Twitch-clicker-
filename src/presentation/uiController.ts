import type { ChatMessage } from '../chat/chatEngine.ts';
import { STREAM_TITLES_BY_BAND } from '../domain/dialogue.ts';
import type { ComputedStats, GameState, UpgradeId } from '../domain/types.ts';
import { getUpgradeCost, TIER1_MILESTONES, TIER1_UPGRADES } from '../domain/upgrades.ts';

function formatMoney(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k ₽`;
  return `${Math.floor(n)} ₽`;
}

export class UiController {
  private readonly titleEl = document.getElementById('stream-title')!;
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

  private readonly upgradesGridEl = document.getElementById('upgrades-grid')!;
  private readonly chatOnlineEl = document.getElementById('chat-online-pill')!;
  private readonly chatMessagesEl = document.getElementById('chat-messages')!;

  private alertTimer?: number;
  private speechPopTimer?: number;
  private cardButtons = new Map<UpgradeId, HTMLButtonElement>();

  public onBuyUpgrade?: (id: UpgradeId) => void;
  public onPlayerChat?: (text: string) => void;

  public init(): void {
    this.buildUpgradeCards();

    const form = document.getElementById('chat-form') as HTMLFormElement;
    const input = document.getElementById('chat-input') as HTMLInputElement;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return;
      input.value = '';
      this.onPlayerChat?.(val);
    });

    document.getElementById('btn-chat-compliment')?.addEventListener('click', () => {
      this.onPlayerChat?.('Мия, ты нереально красивая, не стесняйся! 😳❤️');
    });
    document.getElementById('btn-chat-hearts')?.addEventListener('click', () => {
      this.onPlayerChat?.('💜💜💜 ЧАТИК ПОДДЕРЖИМ СТРИМЕРШУ 🔥🔥🔥');
    });
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
      this.cardButtons.set(def.id, btn);
    }
  }

  public render(state: GameState, stats: ComputedStats): void {
    this.titleEl.textContent = STREAM_TITLES_BY_BAND[stats.dialogueBand];
    this.viewersEl.textContent = String(stats.onlineViewers);
    this.chatOnlineEl.textContent = `👥 ${stats.onlineViewers}`;
    this.balanceEl.textContent = formatMoney(state.balance);
    this.incomeEl.textContent = `+${stats.clickIncome} ₽ • ${stats.passivePerSec} ₽/с`;
    this.hypeMultEl.textContent = `x${stats.hypeMultiplier.toFixed(2)}`;
    this.hypeFillEl.style.width = `${Math.min(100, Math.max(0, state.hype))}%`;

    // Milestone bar
    const next = stats.nextMilestone;
    if (next) {
      this.milestoneLabelEl.textContent = `${stats.onlineViewers} / ${next.viewersRequired}`;
      this.milestoneTitleEl.textContent = next.title;
      const pct = Math.min(100, Math.round((stats.onlineViewers / next.viewersRequired) * 100));
      this.milestoneFillEl.style.width = `${pct}%`;
    } else {
      const last = TIER1_MILESTONES[TIER1_MILESTONES.length - 1]!;
      this.milestoneLabelEl.textContent = `${stats.onlineViewers} / ${last.viewersRequired} MAX`;
      this.milestoneTitleEl.textContent = 'Все цели Тир-1 выполнены! 🔥';
      this.milestoneFillEl.style.width = '100%';
    }

    // Upgrade buttons
    for (const def of TIER1_UPGRADES) {
      const btn = this.cardButtons.get(def.id);
      if (!btn) continue;
      const lvl = state.upgrades[def.id] ?? 0;
      const isMax = lvl >= def.maxLevel;
      const cost = getUpgradeCost(def, lvl);
      const canAfford = !isMax && state.balance >= cost;

      btn.disabled = !canAfford && isMax;
      btn.classList.toggle('affordable', canAfford);
      btn.innerHTML = `
        <div class="upg-left">
          <div class="upg-icon">${def.icon}</div>
          <div class="upg-info">
            <div class="upg-name-row">
              <span class="upg-name">${def.name}</span>
              <span class="upg-lvl">ур. ${lvl}</span>
            </div>
            <div class="upg-bonuses">+${def.clickBonus} клик • +${def.passivePerSec}/с • +${def.viewersBonus} онл.</div>
          </div>
        </div>
        <div class="upg-cost">${isMax ? 'МАКС' : `${cost} ₽`}</div>
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
    }, 2600);
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
    while (this.chatMessagesEl.children.length > 70) {
      this.chatMessagesEl.removeChild(this.chatMessagesEl.firstChild!);
    }
    this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
  }
}

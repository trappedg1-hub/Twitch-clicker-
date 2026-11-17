import type { HeroineEmotion, SubGoalStageIndex, TapZoneId } from '../domain/types.ts';

/**
 * The admin panel: jump to any day / any Sub Goal stage and poke the scene without grinding.
 *
 * It is presentation only — every button calls into `AdminPanelApi` (implemented in bootstrap on top
 * of `src/domain/debug.ts`), which routes through the real engine gates. That separation is the
 * point: the panel can show a state, it can never invent one the game cannot reach.
 *
 * Hidden by default. Toggle: the ⚙ chip in the bottom-right corner of the stream frame (inside the
 * stage, so it never sits on the footer bar), or Ctrl+Shift+A. The panel is not built at all when
 * `?qa` is on, so the automated screenshots stay clean and the QA harness keeps driving the scene
 * through `window.__qaScene` instead of through pixels.
 */

export interface AdminStageChip {
  stage: SubGoalStageIndex;
  label: string;
  subs: number;
}

export interface AdminSnapshot {
  day: number;
  stage: SubGoalStageIndex;
  unlockedStage: SubGoalStageIndex;
  subs: number;
  balance: number;
  hype: number;
  boldness: number;
  viewers: number;
  incomePerSec: number;
  plate: string;
  ladder: AdminStageChip[];
  finaleSubs: number;
  day3Unlocked: boolean;
  saveSuppressed: boolean;
}

export interface AdminPanelApi {
  snapshot(): AdminSnapshot;
  gotoDay(day: number): void;
  gotoStage(stage: SubGoalStageIndex): void;
  addSubs(delta: number): void;
  setSubs(count: number): void;
  /** Pay today's finale in one click: the day card (and the next day's button) opens as usual. */
  dayFinale(): void;
  addFunds(amount: number): void;
  maxOutShop(): void;
  setBars(hype: number, boldness: number): void;
  ghostBoo(): void;
  forceEmotion(emotion: Exclude<HeroineEmotion, 'neutral'>): void;
  forceBlink(): void;
  tapZone(zone: TapZoneId): void;
  setSaveSuppressed(on: boolean): void;
  exportSave(): string;
  importSave(raw: string): void;
  resetSave(): void;
}

const ZONES: { id: TapZoneId; label: string }[] = [
  { id: 'head', label: 'голова' },
  { id: 'chest', label: 'грудь' },
  { id: 'belly', label: 'живот' },
  { id: 'legs', label: 'ноги' },
  { id: 'feet', label: 'ступни' },
];

const EMOTIONS: Exclude<HeroineEmotion, 'neutral'>[] = ['shy', 'fluster', 'tease', 'bold'];

const money = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;
const num = (n: number) => Math.round(n).toLocaleString('ru-RU');

export class AdminPanel {
  private readonly api: AdminPanelApi;
  private root: HTMLElement | null = null;
  private toggle: HTMLButtonElement | null = null;
  private open = false;

  constructor(api: AdminPanelApi) {
    this.api = api;
  }

  /** No-op in QA mode; `mount` is also safe to call twice (dev hot reload). */
  init(options: { hidden?: boolean } = {}): void {
    if (options.hidden || this.root) return;

    this.toggle = document.createElement('button');
    this.toggle.type = 'button';
    this.toggle.id = 'admin-toggle';
    this.toggle.className = 'admin-toggle';
    this.toggle.title = 'Админ-панель — Ctrl+Shift+A';
    this.toggle.textContent = '⚙ ADMIN';
    this.toggle.addEventListener('click', () => this.setOpen(!this.open));

    this.root = document.createElement('section');
    this.root.id = 'admin-panel';
    this.root.className = 'admin-panel hidden';
    this.root.setAttribute('aria-label', 'Админ-панель');
    this.root.innerHTML = TEMPLATE;

    // The handle lives INSIDE the stage frame (absolute, not fixed): glued to the viewport's bottom
    // corner it sat on top of the balance pill in the footer and ate real gameplay UI.
    (document.getElementById('stream-stage-host') ?? document.body).append(this.toggle);
    document.body.append(this.root);
    // Without this, a press on the handle travels to the stage's own pointer handlers and taps Miya.
    this.toggle.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.wire();
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') {
        e.preventDefault();
        this.setOpen(!this.open);
      } else if (e.key === 'Escape' && this.open) {
        this.setOpen(false);
      }
    });
    this.refresh();
  }

  setOpen(open: boolean): void {
    this.open = open;
    if (!this.root || !this.toggle) return;
    this.root.classList.toggle('hidden', !open);
    this.toggle.classList.toggle('is-active', open);
    if (open) this.refresh();
  }

  /** bootstrap calls this from syncAll, so the readout follows changes the panel did not cause. */
  refresh(): void {
    if (!this.root || !this.open) return;
    const s = this.api.snapshot();
    const out = this.root as HTMLElement;
    const put = (key: string, text: string) => {
      const el = out.querySelector<HTMLElement>(`[data-out="${key}"]`);
      if (el) el.textContent = text;
    };
    put('day', `День ${s.day}`);
    put('stage', `стадия ${s.stage}${s.unlockedStage > s.stage ? ` (${s.unlockedStage} открыто)` : ''}`);
    put('plate', s.plate);
    put('subs', `${num(s.subs)} / ${num(s.finaleSubs)} сабов`);
    put('money', money(s.balance));
    put('income', `${s.incomePerSec.toFixed(1)} ₽/с · ${num(s.viewers)} зрителей`);
    put('bars', `хайп ${num(s.hype)} · смелость ${num(s.boldness)}`);
    put('finale', `до финала дня ${num(Math.max(0, s.finaleSubs - s.subs))} сабов`);

    const hype = out.querySelector<HTMLInputElement>('[data-range="hype"]')!;
    const bold = out.querySelector<HTMLInputElement>('[data-range="boldness"]')!;
    if (document.activeElement !== hype) hype.value = String(Math.round(s.hype));
    if (document.activeElement !== bold) bold.value = String(Math.round(s.boldness));
    out.querySelector<HTMLInputElement>('[data-check="save"]')!.checked = s.saveSuppressed;
    put('save', s.saveSuppressed ? 'сейв выключен' : 'сейв пишется');

    out.querySelectorAll<HTMLButtonElement>('[data-day]').forEach((btn) => {
      const day = Number(btn.dataset.day);
      btn.classList.toggle('is-on', day === s.day);
      btn.disabled = day === 3 && !s.day3Unlocked;
      btn.title =
        day === 3 && !s.day3Unlocked ? 'Нет косплей-артов в сборке' : `Прыгнуть в день ${day}, стадия 0`;
    });

    // Stage chips are the day's own ladder, so their labels can never drift from the plates. They are
    // rebuilt only when the day changes: refresh() runs on every economy tick, and rebuilding the row
    // under the cursor made a click on a chip a race the user loses silently.
    const row = out.querySelector<HTMLElement>('[data-ladder]')!;
    const signature = `${s.day}:${s.ladder.map((c) => c.label).join('|')}`;
    if (row.dataset.key !== signature) {
      row.dataset.key = signature;
      row.innerHTML = s.ladder
        .map(
          (c) => `<button class="admin-chip" type="button" data-stage="${c.stage}"><b>${
            c.stage
          }</b><span class="admin-chip-label">${
            c.label
          }</span><i>${num(c.subs)}</i></button>`,
        )
        .join('');
    }
    row.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((btn) => {
      const stage = Number(btn.dataset.stage) as SubGoalStageIndex;
      const locked = stage > s.unlockedStage;
      btn.classList.toggle('is-on', stage === s.stage);
      btn.classList.toggle('is-locked', locked);
      btn.title = locked ? `закрыто — клик выпишет ${num(s.ladder[stage]?.subs ?? 0)} сабов` : `${num(s.ladder[stage]?.subs ?? 0)} сабов`;
    });
  }

  private wire(): void {
    const out = this.root!;
    // One delegated listener for the ladder row: the chips survive every refresh that way.
    out.querySelector<HTMLElement>('[data-ladder]')!.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-stage]');
      if (btn) this.api.gotoStage(Number(btn.dataset.stage) as SubGoalStageIndex);
    });
    const click = (sel: string, fn: (el: HTMLElement) => void) => {
      out.querySelectorAll<HTMLElement>(sel).forEach((el) =>
        el.addEventListener('click', () => fn(el)),
      );
    };
    click('[data-act="close"]', () => this.setOpen(false));
    click('[data-day]', (el) => this.api.gotoDay(Number(el.dataset.day)));
    click('[data-act="subs-"]', () => this.api.addSubs(-100));
    click('[data-act="subs+"]', () => this.api.addSubs(100));
    click('[data-act="subs++"]', () => this.api.addSubs(1000));
    click('[data-act="subs-fin"]', () => this.api.dayFinale());
    click('[data-act="money+"]', () => this.api.addFunds(10_000));
    click('[data-act="money++"]', () => this.api.addFunds(1_000_000));
    const setExactSubs = () => {
      const input = out.querySelector<HTMLInputElement>('[data-subs-input]')!;
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      // Through the same ladder gate as everything else: `debugSetSubscribers` re-derives the
      // unlocked stage, so 6999 leaves the plate locked and 7000 opens it — the boundary is testable.
      this.api.setSubs(Math.max(0, Math.floor(value)));
    };
    click('[data-act="subs-set"]', setExactSubs);
    out.querySelector<HTMLInputElement>('[data-subs-input]')!.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        setExactSubs();
      }
    });
    click('[data-act="shop"]', () => this.api.maxOutShop());
    click('[data-act="boo"]', () => this.api.ghostBoo());
    click('[data-act="blink"]', () => this.api.forceBlink());
    click('[data-act="emo"]', (el) =>
      this.api.forceEmotion(el.dataset.emotion as Exclude<HeroineEmotion, 'neutral'>),
    );
    click('[data-act="zone"]', (el) => this.api.tapZone(el.dataset.zone as TapZoneId));
    click('[data-act="reset"]', () => {
      if (window.confirm('Стереть сейв и вернуться к началу Дня 1?')) this.api.resetSave();
    });
    click('[data-act="export"]', () => {
      const box = out.querySelector<HTMLTextAreaElement>('[data-io]')!;
      box.value = this.api.exportSave();
      box.select();
      navigator.clipboard?.writeText(box.value).catch(() => undefined);
    });
    click('[data-act="import"]', () =>
      this.api.importSave(out.querySelector<HTMLTextAreaElement>('[data-io]')!.value),
    );
    out.querySelector<HTMLInputElement>('[data-check="save"]')!.addEventListener('change', (e) =>
      this.api.setSaveSuppressed((e.target as HTMLInputElement).checked),
    );
    const pushBars = () => {
      const h = Number(out.querySelector<HTMLInputElement>('[data-range="hype"]')!.value);
      const b = Number(out.querySelector<HTMLInputElement>('[data-range="boldness"]')!.value);
      this.api.setBars(h, b);
    };
    out.querySelectorAll<HTMLInputElement>('[data-range]').forEach((el) =>
      el.addEventListener('input', pushBars),
    );
  }
}

const TEMPLATE = `
  <header class="admin-head">
    <span class="admin-title">ADMIN</span>
    <span class="admin-sub">прыжки по дням и стадиям · Ctrl+Shift+A</span>
    <button class="admin-x" type="button" data-act="close" aria-label="Закрыть">✕</button>
  </header>
  <div class="admin-body">
    <div class="admin-stats">
      <b data-out="day"></b><span data-out="stage"></span>
      <span data-out="subs"></span><span data-out="money"></span>
      <span data-out="income"></span><span data-out="bars"></span>
      <span data-out="finale"></span>
      <code data-out="plate"></code><em data-out="save"></em>
    </div>

    <div class="admin-sec">
      <div class="admin-label">День</div>
      <div class="admin-row">
        <button class="admin-btn" type="button" data-day="1">1</button>
        <button class="admin-btn" type="button" data-day="2">2</button>
        <button class="admin-btn" type="button" data-day="3">3</button>
      </div>
    </div>

    <div class="admin-sec">
      <div class="admin-label">Стадия наряда (текущего дня)</div>
      <div class="admin-row admin-ladder" data-ladder></div>
    </div>

    <div class="admin-sec">
      <div class="admin-label">Сабы и деньги</div>
      <div class="admin-row">
        <button class="admin-btn" type="button" data-act="subs-">−100</button>
        <button class="admin-btn" type="button" data-act="subs+">+100</button>
        <button class="admin-btn" type="button" data-act="subs++">+1k</button>
        <button class="admin-btn" type="button" data-act="subs-fin">финал дня</button>
        <input class="admin-num" type="number" step="1" data-subs-input placeholder="сабы ровно" aria-label="Ровно столько сабов" />
        <button class="admin-btn" type="button" data-act="subs-set">ввести</button>
        <button class="admin-btn" type="button" data-act="money+">+10k ₽</button>
        <button class="admin-btn" type="button" data-act="money++">+1M ₽</button>
        <button class="admin-btn" type="button" data-act="shop">магазин в максимум</button>
      </div>
    </div>

    <div class="admin-sec">
      <div class="admin-label">Хайп и смелость</div>
      <label class="admin-range">хайп<input type="range" min="0" max="100" step="1" data-range="hype" /></label>
      <label class="admin-range">смелость<input type="range" min="0" max="100" step="1" data-range="boldness" /></label>
    </div>

    <div class="admin-sec">
      <div class="admin-label">Сцена</div>
      <div class="admin-row">
        <button class="admin-btn" type="button" data-act="boo">Бу!</button>
        <button class="admin-btn" type="button" data-act="blink">моргнуть</button>
        ${EMOTIONS.map((e) => `<button class="admin-btn" type="button" data-act="emo" data-emotion="${e}">${e}</button>`).join('')}
      </div>
      <div class="admin-row">
        ${ZONES.map((z) => `<button class="admin-btn" type="button" data-act="zone" data-zone="${z.id}">${z.label}</button>`).join('')}
      </div>
    </div>

    <div class="admin-sec">
      <div class="admin-label">Сейв</div>
      <label class="admin-check"><input type="checkbox" data-check="save" /> ничего не сохранять (тестить, не портя прогресс)</label>
      <div class="admin-row">
        <button class="admin-btn" type="button" data-act="export">экспорт</button>
        <button class="admin-btn" type="button" data-act="import">импорт</button>
        <button class="admin-btn admin-btn-danger" type="button" data-act="reset">сброс</button>
      </div>
      <textarea class="admin-io" data-io rows="3" spellcheck="false" placeholder="JSON сейва"></textarea>
    </div>
  </div>
`;

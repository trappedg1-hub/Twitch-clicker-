import { ADMIN_MAX_DAY } from '../domain/debug.ts';
import type { HeroineEmotion, SubGoalStageIndex, TapZoneId } from '../domain/types.ts';
import {
  TUNING_PARAMS,
  displayValue,
  type ConstraintTuning,
  type TuningKey,
} from '../heroine/rigTuning.ts';
import type { RigStats } from '../heroine/LiveHeroine.ts';

/**
 * The admin console: jump the ladder, tune the skeleton, poke the scene, handle saves.
 *
 * Presentation only — every button calls into `AdminPanelApi` / `AdminRigApi`, implemented in
 * bootstrap on top of the real engine gates. That separation is the point: the panel can show a
 * state, it can never invent one the game cannot reach. Same for the rig: sliders write into the
 * runtime's live constraint values, which is exactly the channel an animation timeline uses.
 *
 * Hidden by default. Toggle: the ⚙ chip in the bottom-right corner of the stream frame (inside the
 * stage, so it never sits on the footer bar), or Ctrl+Shift+A. The panel is not built at all when
 * `?qa` is on, so the automated screenshots stay clean and the QA harness keeps driving the scene
 * through `window.__qaScene` instead of through pixels.
 *
 * Four tabs, because they answer four different questions: «где я в игре» (прыжок), «почему она
 * так двигается» (риг), «покажи вот это» (сцена), «не сломай мой сейв» (сейв).
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
  day4Unlocked: boolean;
  day5Unlocked: boolean;
  day6Unlocked: boolean;
  saveSuppressed: boolean;
}

/** One physics constraint, as the console needs it: what it is called and what it holds now. */
export interface AdminRigConstraint {
  id: string;
  label: string;
  values: ConstraintTuning;
  doc: ConstraintTuning;
}

export interface AdminRigSnapshot {
  /** The A/B switch: false means every plate is flat, exactly as before the rig existed. */
  enabled: boolean;
  /** Art key of the rig on screen; null when the plate has no rig (19 of 41 do not). */
  art: string | null;
  /** Does the plate on screen have a rig at all? Distinct from `art`: a rig can be mid-load. */
  plateHasRig: boolean;
  animations: string[];
  current: string;
  constraints: AdminRigConstraint[];
  stats: RigStats & { fps: number };
  plate: string;
  /** Slider values that differ from the document, already formatted for a human. */
  changes: string[];
}

export interface AdminRigApi {
  snapshot(): AdminRigSnapshot;
  setEnabled(on: boolean): void;
  play(name: string): void;
  setParam(id: string, key: TuningKey, value: number): void;
  resetConstraint(id: string): void;
  resetAll(): void;
  /** Values to paste back into `scripts/build_miya_rig.py`. */
  report(): string;
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
  /** Live tuning of the heroine's skeleton. */
  rig: AdminRigApi;
}

const ZONES: { id: TapZoneId; label: string }[] = [
  { id: 'head', label: 'голова' },
  { id: 'chest', label: 'грудь' },
  { id: 'belly', label: 'живот' },
  { id: 'legs', label: 'ноги' },
  { id: 'feet', label: 'ступни' },
];

const EMOTIONS: Exclude<HeroineEmotion, 'neutral'>[] = ['shy', 'fluster', 'tease', 'bold'];

/** Animations the console offers first; anything else the document has lands after them. */
const ANIMATION_ORDER = ['idle', 'idle_talk', 'tap', 'shake', 'breath', 'sway', 'turn', 'blink', 'talk', 'smile', 'tease', 'tickle', 'gasp', 'giggle', 'lean_in', 'hair_flip', 'arch', 'shy_tuck', 'shiver', 'settle'];
const ANIMATION_LABELS: Record<string, string> = {
  idle: 'idle',
  idle_talk: 'речь',
  breath: 'дыхание',
  sway: 'качание',
  turn: 'поворот',
  shake: 'встряска',
  tap: 'тап',
  blink: 'моргание',
  talk: 'губы',
  smile: 'улыбка',
  tease: 'показывает язык',
  tickle: 'щекотка: поджимает пальчики',
  gasp: 'вздох: тап по груди',
  giggle: 'смеётся в два всхлипа',
  lean_in: 'наклоняется к камере',
  hair_flip: 'откидывает волосы',
  arch: 'потягивается, прогибаясь',
  shy_tuck: 'прячется в плечо',
  shiver: 'дрожит',
  settle: 'ёрзает, меняет вес',
};

type AdminTab = 'jump' | 'rig' | 'scene' | 'save';

const TABS: { id: AdminTab; label: string; hint: string }[] = [
  { id: 'jump', label: 'прыжок', hint: 'дни, стадии, сабы, деньги' },
  { id: 'rig', label: 'риг', hint: 'скелет и физика' },
  { id: 'scene', label: 'сцена', hint: 'реакции и тапы' },
  { id: 'save', label: 'сейв', hint: 'экспорт и сброс' },
];

const money = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;
const num = (n: number) => Math.round(n).toLocaleString('ru-RU');

export class AdminPanel {
  private readonly api: AdminPanelApi;
  private root: HTMLElement | null = null;
  private toggle: HTMLButtonElement | null = null;
  private open = false;
  private tab: AdminTab = 'jump';

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
    this.setTab('jump');
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

  /** Tab switching is a class flip, never a rebuild: a slider must not lose its drag to a re-render. */
  setTab(tab: AdminTab): void {
    this.tab = tab;
    if (!this.root) return;
    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) => {
      const on = el.dataset.tab === tab;
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    this.root.querySelectorAll<HTMLElement>('[data-pane]').forEach((el) => {
      el.classList.toggle('hidden', el.dataset.pane !== tab);
    });
    const hint = TABS.find((t) => t.id === tab)?.hint ?? '';
    const hintEl = this.root.querySelector<HTMLElement>('[data-out="hint"]');
    if (hintEl) hintEl.textContent = hint;
    this.refresh();
  }

  /** bootstrap calls this from syncAll, so the readout follows changes the panel did not cause. */
  refresh(): void {
    if (!this.root || !this.open) return;
    this.refreshJump();
    if (this.tab === 'rig') this.refreshRig();
  }

  private out(key: string): HTMLElement | null {
    return this.root!.querySelector<HTMLElement>(`[data-out="${key}"]`);
  }

  private put(key: string, text: string): void {
    const el = this.out(key);
    if (el) el.textContent = text;
  }

  private refreshJump(): void {
    const s = this.api.snapshot();
    const out = this.root as HTMLElement;
    this.put('day', `День ${s.day}`);
    this.put('stage', `стадия ${s.stage}${s.unlockedStage > s.stage ? ` (${s.unlockedStage} открыто)` : ''}`);
    this.put('plate', s.plate);
    this.put('subs', `${num(s.subs)} / ${num(s.finaleSubs)} сабов`);
    this.put('money', money(s.balance));
    this.put('income', `${s.incomePerSec.toFixed(1)} ₽/с · ${num(s.viewers)} зрителей`);
    this.put('bars', `хайп ${num(s.hype)} · смелость ${num(s.boldness)}`);
    this.put('finale', `до финала дня ${num(Math.max(0, s.finaleSubs - s.subs))} сабов`);

    const hype = out.querySelector<HTMLInputElement>('[data-range="hype"]');
    const bold = out.querySelector<HTMLInputElement>('[data-range="boldness"]');
    if (hype && document.activeElement !== hype) hype.value = String(Math.round(s.hype));
    if (bold && document.activeElement !== bold) bold.value = String(Math.round(s.boldness));
    const save = out.querySelector<HTMLInputElement>('[data-check="save"]');
    if (save) save.checked = s.saveSuppressed;
    this.put('save', s.saveSuppressed ? 'сейв выключен' : 'сейв пишется');

    out.querySelectorAll<HTMLButtonElement>('[data-day]').forEach((btn) => {
      const day = Number(btn.dataset.day);
      btn.classList.toggle('is-on', day === s.day);
      btn.disabled =
        (day === 3 && !s.day3Unlocked) ||
        (day === 4 && !s.day4Unlocked) ||
        (day === 5 && !s.day5Unlocked) ||
        (day === 6 && !s.day6Unlocked);
      btn.title =
        day === 3 && !s.day3Unlocked
          ? 'Нет косплей-артов в сборке'
          : day === 4 && !s.day4Unlocked
            ? 'Нет йога-артов в сборке'
            : day === 5 && !s.day5Unlocked
              ? 'Нет бикини-артов в сборке'
              : day === 6 && !s.day6Unlocked
                ? 'Нет артов шестого дня в сборке'
              : `Прыгнуть в день ${day}, стадия 0`;
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

  /**
   * The rig tab: what is on screen, how big it is, and the five numbers per physics constraint that
   * decide how she moves. Rebuilt only when the art or the constraint set changes — everything else
   * is a value write, so dragging a slider is never interrupted by a tick.
   */
  private refreshRig(): void {
    const r = this.api.rig.snapshot();
    const out = this.root as HTMLElement;

    this.put('rigArt', r.art ?? (r.plateHasRig ? 'загружается…' : 'нет рига у этой платы'));
    this.put('rigStat', `${r.stats.bones} костей · ${num(r.stats.vertices)} вершин · ${num(r.stats.triangles)} треугольников`);
    this.put('rigPerf', `${r.stats.drawCalls} draw calls · ${Math.round(r.stats.fps)} fps`);
    this.put('rigAnim', r.current);
    this.put('rigChanges', r.changes.length === 0 ? 'как в документе' : r.changes.join(' · '));

    const live = out.querySelector<HTMLInputElement>('[data-check="live"]');
    if (live && document.activeElement !== live) live.checked = r.enabled;

    const rigOff = !r.enabled || !r.art;
    const body = out.querySelector<HTMLElement>('[data-rig-body]');
    if (body) body.classList.toggle('is-dim', rigOff);
    this.put(
      'rigNote',
      !r.enabled
        ? 'живой скелет выключен — на экране плоский плейт'
        : r.art
          ? 'скелет грузится с /rigs и живёт поверх платы'
          : 'у этой платы рига нет: 19 из 41 артов остались плоскими',
    );

    // Animation chips: rebuilt only when the document's animation set changes.
    const animRow = out.querySelector<HTMLElement>('[data-rig-anims]')!;
    const animSig = `${r.art ?? '-'}:${r.animations.join(',')}`;
    if (animRow.dataset.key !== animSig) {
      animRow.dataset.key = animSig;
      const names = [
        ...ANIMATION_ORDER.filter((n) => r.animations.includes(n)),
        ...r.animations.filter((n) => !ANIMATION_ORDER.includes(n)),
      ];
      animRow.innerHTML =
        names.length === 0
          ? '<em class="admin-note">нет анимаций — плата плоская</em>'
          : names
              .map(
                (n) =>
                  `<button class="admin-btn admin-anim" type="button" data-anim="${n}" title="${n}">${
                    ANIMATION_LABELS[n] ?? n
                  }</button>`,
              )
              .join('');
    }
    animRow.querySelectorAll<HTMLButtonElement>('[data-anim]').forEach((btn) => {
      btn.classList.toggle('is-on', btn.dataset.anim === r.current);
      btn.disabled = !r.art;
    });

    // Constraint cards: rebuilt when the rig (and therefore its constraint set) changes art.
    const host = out.querySelector<HTMLElement>('[data-rig-constraints]')!;
    const key = `${r.art ?? '-'}:${r.constraints.map((c) => c.id).join(',')}`;
    if (host.dataset.key !== key) {
      host.dataset.key = key;
      host.innerHTML =
        r.constraints.length === 0
          ? '<em class="admin-note">физики нет — нечего крутить</em>'
          : r.constraints.map((c) => constraintCard(c)).join('');
      this.wireRigInputs(host);
    }
    for (const c of r.constraints) {
      for (const p of TUNING_PARAMS) {
        const input = host.querySelector<HTMLInputElement>(`[data-rig-input="${c.id}.${p.key}"]`);
        const v = c.values[p.key];
        if (!input || v === undefined || document.activeElement === input) continue;
        input.value = String(v);
        input.classList.toggle('is-moved', displayValue(p.key, v) !== displayValue(p.key, c.doc[p.key] ?? v));
      }
      for (const p of TUNING_PARAMS) {
        const v = c.values[p.key];
        this.put(
          `rig.${c.id}.${p.key}`,
          v === undefined ? '—' : displayValue(p.key, v).toString(),
        );
      }
    }
  }

  private wireRigInputs(host: HTMLElement): void {
    host.querySelectorAll<HTMLInputElement>('[data-rig-input]').forEach((input) => {
      input.addEventListener('input', () => {
        const [id, key] = (input.dataset.rigInput ?? '').split('.');
        if (!id || !key) return;
        this.api.rig.setParam(id, key as TuningKey, Number(input.value));
        // The readout must follow the thumb, not the next tick: a slider with stale numbers is a
        // slider you cannot tune with.
        const p = TUNING_PARAMS.find((x) => x.key === key)!;
        this.put(`rig.${id}.${key}`, displayValue(p.key, Number(input.value)).toString());
      });
    });
    host.querySelectorAll<HTMLButtonElement>('[data-rig-reset]').forEach((btn) => {
      btn.addEventListener('click', () => this.api.rig.resetConstraint(btn.dataset.rigReset ?? ''));
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
    click('[data-tab]', (el) => this.setTab(el.dataset.tab as AdminTab));
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
    click('[data-act="talk"]', () => this.api.rig.play('idle_talk'));
    click('[data-act="emo"]', (el) =>
      this.api.forceEmotion(el.dataset.emotion as Exclude<HeroineEmotion, 'neutral'>),
    );
    click('[data-act="zone"]', (el) => this.api.tapZone(el.dataset.zone as TapZoneId));
    click('[data-act="export"]', () => {
      const io = out.querySelector<HTMLTextAreaElement>('[data-io]')!;
      io.value = this.api.exportSave();
      io.focus();
      io.select();
    });
    click('[data-act="import"]', () => {
      const io = out.querySelector<HTMLTextAreaElement>('[data-io]')!;
      this.api.importSave(io.value);
    });
    click('[data-act="reset"]', () => this.api.resetSave());

    // ---- rig tab ----
    out.querySelector<HTMLInputElement>('[data-check="live"]')!.addEventListener('change', (e) =>
      this.api.rig.setEnabled((e.target as HTMLInputElement).checked),
    );
    out.querySelector<HTMLElement>('[data-rig-anims]')!.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-anim]');
      if (!btn || btn.disabled) return;
      this.api.rig.play(btn.dataset.anim ?? '');
    });
    click('[data-act="rig-reset"]', () => this.api.rig.resetAll());
    click('[data-act="rig-report"]', () => {
      const io = out.querySelector<HTMLTextAreaElement>('[data-io]')!;
      io.value = this.api.rig.report();
      // Copying is the whole point of the report (it goes into the build script), but a blocked
      // clipboard must not look like a broken button — the text is in the box either way.
      void navigator.clipboard?.writeText(io.value).catch(() => undefined);
      const btn = out.querySelector<HTMLElement>('[data-act="rig-report"]');
      if (btn) {
        const was = btn.textContent;
        btn.textContent = 'скопировано ✓';
        window.setTimeout(() => (btn.textContent = was), 1200);
      }
    });

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

/**
 * One constraint card: five sliders, each showing its value, and a per-constraint reset. The label
 * is the Russian name (`волосы`), the id stays in the tooltip — the panel must be readable, and the
 * build script must still be findable from what you see.
 */
function constraintCard(c: { id: string; label: string; values: ConstraintTuning }): string {
  const rows = TUNING_PARAMS.filter((p) => c.values[p.key] !== undefined)
    .map(
      (p) => `
      <label class="admin-range admin-range-rig" title="${c.id}.${p.key}">
        <span>${p.label}</span>
        <input type="range" min="${p.min}" max="${p.max}" step="${p.step}"
               value="${c.values[p.key]}" data-rig-input="${c.id}.${p.key}"
               aria-label="${c.id} ${p.label}" />
        <b data-out="rig.${c.id}.${p.key}">${displayValue(p.key, c.values[p.key]!).toString()}</b>
      </label>`,
    )
    .join('');
  return `
    <div class="admin-rig-card">
      <div class="admin-rig-head">
        <span class="admin-rig-name">${c.label}</span>
        <code>${c.id}</code>
        <button class="admin-btn admin-btn-tiny" type="button" data-rig-reset="${c.id}" title="Вернуть значения из документа">сброс</button>
      </div>
      ${rows}
    </div>`;
}

const TEMPLATE = `
  <header class="admin-head">
    <span class="admin-title">ADMIN</span>
    <span class="admin-sub" data-out="hint"></span>
    <button class="admin-x" type="button" data-act="close" aria-label="Закрыть">✕</button>
  </header>

  <div class="admin-tabs" role="tablist">
    ${TABS.map(
      (t) =>
        `<button class="admin-tab" type="button" role="tab" data-tab="${t.id}">${t.label}</button>`,
    ).join('')}
  </div>

  <div class="admin-body">
    <div class="admin-stats">
      <b data-out="day"></b><span data-out="stage"></span>
      <span data-out="subs"></span><span data-out="money"></span>
      <span data-out="income"></span><span data-out="bars"></span>
      <span data-out="finale"></span>
      <code data-out="plate"></code><em data-out="save"></em>
    </div>

    <div class="admin-pane" data-pane="jump">
      <div class="admin-sec">
        <div class="admin-label">День</div>
        <div class="admin-row">
          ${Array.from({ length: ADMIN_MAX_DAY }, (_, i) =>
            `<button class="admin-btn" type="button" data-day="${i + 1}">${i + 1}</button>`,
          ).join('')}
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
    </div>

    <div class="admin-pane hidden" data-pane="rig">
      <div class="admin-sec">
        <div class="admin-label">Скелет</div>
        <label class="admin-check"><input type="checkbox" data-check="live" /> живой скелет <em>(снять — сравнить с плоским плейтом)</em></label>
        <div class="admin-rig-stat">
          <span data-out="rigArt"></span>
          <code data-out="rigStat"></code>
          <em data-out="rigPerf"></em>
        </div>
        <div class="admin-note-line"><span class="admin-dot"></span><span data-out="rigNote"></span></div>
      </div>

      <div class="admin-sec" data-rig-body>
        <div class="admin-label">Анимации <em data-out="rigAnim"></em></div>
        <div class="admin-row admin-rig-anims" data-rig-anims></div>
      </div>

      <div class="admin-sec">
        <div class="admin-label">Физика <span class="admin-label-note" data-out="rigChanges"></span></div>
        <div class="admin-rig-constraints" data-rig-constraints></div>
        <div class="admin-row">
          <button class="admin-btn" type="button" data-act="rig-report">скопировать тюнинг</button>
          <button class="admin-btn" type="button" data-act="rig-reset">сброс всё</button>
        </div>
        <em class="admin-note">значения пишутся в живой скелет сразу. Чтобы они попали в сборку — вставь отчёт в <code>scripts/build_miya_rig.py</code>.</em>
      </div>
    </div>

    <div class="admin-pane hidden" data-pane="scene">
      <div class="admin-sec">
        <div class="admin-label">Вспышки</div>
        <div class="admin-row">
          <button class="admin-btn" type="button" data-act="boo">Бу!</button>
          <button class="admin-btn" type="button" data-act="blink">моргнуть</button>
          <button class="admin-btn" type="button" data-act="talk">заговорить</button>
        </div>
      </div>

      <div class="admin-sec">
        <div class="admin-label">Эмоция</div>
        <div class="admin-row">
          ${EMOTIONS.map((e) => `<button class="admin-btn" type="button" data-act="emo" data-emotion="${e}">${e}</button>`).join('')}
        </div>
      </div>

      <div class="admin-sec">
        <div class="admin-label">Тап по зоне</div>
        <div class="admin-row">
          ${ZONES.map((z) => `<button class="admin-btn" type="button" data-act="zone" data-zone="${z.id}">${z.label}</button>`).join('')}
        </div>
      </div>
    </div>

    <div class="admin-pane hidden" data-pane="save">
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
  </div>
`;

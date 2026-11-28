import { Container } from 'pixi.js';
import { isMissingDocumentError } from './rigFailures.ts';
import { canTalk, idleAfterReaction, talkDeadline } from './talkPolicy.ts';
import { OpenBone, loadOpenBone, type OpenBoneAsset } from '@openbone/pixi';
import { clampTuning, TUNING_PARAMS, type ConstraintTuning, type RigTuning } from './rigTuning.ts';
import { applyGaze, gazeDegrees, GazeSpring } from './gaze.ts';
import { sfx } from '../audio/sfx.ts';
import { IDLE_BEATS } from './reactionDirector.ts';

/**
 * The authored rig, played in the game.
 *
 * `HeroineRig` still owns the stage: plate ladders, crossfades, flashes, emotions, HUD anchors.
 * This class owns what a plate cannot do — the skeleton itself. When a rig ships for the plate on
 * screen it is drawn on top in the exact same slot (`show()`), and the flat plate is hidden
 * underneath; when it does not, nothing changes and the old renderer stays in charge. That is the
 * whole integration: one optional layer, no rewrite of the rig that already works.
 *
 * What the player sees because of it: her chest rises on the breath, her hair swings a beat after
 * her head does, her eyelids really close instead of a patch fading in, and her mouth moves while
 * she talks.
 *
 * ## Why it ticks itself
 *
 * `OpenBone` happily registers on `Ticker.shared` and advances there. On this page the Pixi
 * application runs on the shared ticker too, so a throw inside the skeleton — a texture that is
 * not decoded yet, a mesh rebuild on a slow phone — escapes into the app's own loop, and a Pixi
 * ticker that throws stops rescheduling itself. The result is a black canvas with the HUD still on
 * top of it. So the rig is created with `autoUpdate: false` and advanced from `StreamStage.tick`
 * inside a guard: whatever the skeleton does, it can only ever cost us the skeleton.
 */

export type LiveReaction =
  | 'shake'
  | 'turn'
  | 'sway'
  | 'tap'
  | 'tickle'
  | 'tease'
  | 'gasp'
  | 'giggle'
  | 'lean_in'
  | 'hair_flip'
  | 'arch'
  | 'shy_tuck'
  | 'shiver'
  | 'settle';

/**
 * What she does when nothing is happening to her.
 *
 * An idle loop that only breathes is a screensaver. These are the beats that make a stream feel
 * attended: she looks around, tosses her hair, leans in as if reading chat, giggles at something
 * only she saw. Only the ones that exist in the current document are ever picked — `turn` is on
 * every plate, the rest are extras.
 */
/**
 * Fired when she performs a beat of her own — not on a tap, not on a line of chat, but because
 * nobody was doing anything. The stream reads this: chat notices when she entertains herself.
 */
export type QuirkKind = 'turn' | 'hair_flip' | 'lean_in' | 'giggle' | 'tease';

// The vocabulary itself lives in the director, so a beat cannot be added to the idle pool without
// also being a beat the tap table can reach. `turn` is listed twice: looking around is the most
// natural thing for a person at a desk to do, and it is the only quirk every plate is guaranteed.
export const IDLE_QUIRKS: LiveReaction[] = [...IDLE_BEATS, 'turn'];

export interface RigStats {
  bones: number;
  vertices: number;
  triangles: number;
  drawCalls: number;
}

export class LiveHeroine {
  /** Same transform contract as `HeroineRig.view`: plate pixels, top-left origin. */
  readonly view = new Container();

  /** Called once when the rig gives up, with a human-readable reason. The stage falls back. */
  public onFault: ((reason: string) => void) | null = null;

  private asset: OpenBoneAsset | null = null;
  private bone: OpenBone | null = null;
  private art: string | null = null;
  private loading: Promise<boolean> | null = null;
  private pendingArt: string | null = null;
  /**
   * Arts whose document is not in the build.
   *
   * This is NOT a fault: the four `skip` plates and every plate that never got a rig are on screen
   * during a normal playthrough, and asking for their `.obonb` is a 404 dressed as a JSON parse
   * error. Those used to go through `fail()`, which is a one-way door — so the first `skip` plate
   * on day 3 turned the heroine flat for the rest of the run, and the stage remembered that on the
   * next load too. Keeping the answer here costs one Set and the rig survives the evening.
   */
  private readonly missing = new Set<string>();
  /** Also tolerate a document that parsed but threw while being built (a broken rig, not a gap). */
  private readonly broken = new Set<string>();
  private talkUntil = 0;
  private reactionUntil = 0;
  /** When the last reaction was asked for — the clicker asks faster than a beat lasts. */
  private lastReactionAt = -Infinity;
  /** When the player last did anything to her. Drives the "she gets bored" gap below. */
  private lastInteractionAt = 0;
  /** Called after one of her own beats starts. Never called for reactions to the player. */
  public onQuirk?: (kind: QuirkKind) => void;
  /**
   * When she looks around on her own.
   *
   * This is the cheapest kind of life there is and the one a still illustration misses most: a
   * person sitting at a desk does not hold one pose until something happens to her. Every 12-26
   * seconds, in the gaps between clicks, she turns her head for a beat and settles back.
   */
  private nextGlanceAt = 0;
  /**
   * The one live channel into the skeleton: where the player is pointing.
   *
   * Everything else she does is authored and identical on every machine. This is the part that
   * makes her look back — see `gaze.ts` for why a spring and a split chain read as alive.
   */
  private readonly gaze = new GazeSpring();
  private destroyed = false;
  /** Animation the panel/state asked for last — the readout in the admin console. */
  private current = 'idle';
  /** Own clock, seconds of the last `update()` — the rig is not on Pixi's ticker. */
  private lastUpdateMs = 0;
  private energy = 0;
  /** Everything the stage draws on top of the skeleton (currently: her blush). */
  private readonly overlayLayer = new Container();
  /** How long the beat that started last is meant to last — the tap's interruption rule needs it. */
  private beatMs = 0;
  /** Set when the skeleton threw; the class then stays out of the way for the rest of the page. */
  private fault: string | null = null;
  /**
   * Tuning the admin panel keeps across art changes and reloads. Applied to every document this
   * class loads, so comparing one plate against another never silently drops the sliders.
   */
  private defaultTuning: RigTuning | null = null;

  constructor() {
    this.view.visible = false;
  }

  /** Art key of the rig currently on screen, e.g. `t2_s3`. Null until one loads. */
  public get readyArt(): string | null {
    return this.bone ? this.art : null;
  }

  /** Why the rig is off, when it gave up. Null while it is healthy. */
  public get faultReason(): string | null {
    return this.fault;
  }

  public isReadyFor(art: string): boolean {
    return Boolean(this.bone) && this.art === art;
  }

  /** Art key of the rig on screen, or null when the flat plate is in charge. */
  public get currentArt(): string | null {
    return this.bone ? this.art : null;
  }

  /** Animation names the loaded document actually has, in document order. */
  public get animations(): string[] {
    return this.asset?.doc.animations.map((a) => a.name) ?? [];
  }

  /**
   * The two deadlines, as numbers. Nothing in the game reads this: `scripts/qa_talk.mjs` does, so
   * that when the mouth is not moving the report says *which* clock ran out instead of "it broke".
   */
  public get talkDebug(): { until: number; reactionUntil: number; lastUpdate: number; visible: boolean } {
    return { until: this.talkUntil, reactionUntil: this.reactionUntil, lastUpdate: this.lastUpdateMs, visible: this.view.visible };
  }

  /** What is playing right now, as far as the game is concerned. */
  public get currentAnimation(): string {
    return this.current;
  }

  /**
   * Load the rig for `art` and show it. Resolves false when there is none (most of the 41 plates
   * have no rig — the small or cropped faces were deliberately skipped), and the caller keeps the
   * flat plate.
   */
  public async show(art: string): Promise<boolean> {
    if (this.destroyed || this.fault) return false;
    if (this.missing.has(art) || this.broken.has(art)) return false;
    if (this.art === art && this.bone) {
      this.view.visible = true;
      return true;
    }
    // Rapid stage changes (a tap can push a streak of sub goals) must not start parallel loads.
    if (this.loading) {
      this.pendingArt = art;
      return this.loading.then((ok) => (ok && this.art === art ? true : false));
    }
    this.loading = this.load(art).finally(() => {
      this.loading = null;
      const next = this.pendingArt;
      this.pendingArt = null;
      if (next && next !== this.art) void this.show(next);
    });
    return this.loading;
  }

  private async load(art: string): Promise<boolean> {
    try {
      const asset = await loadOpenBone(`/rigs/${art}.obonb`, {
        // Document image paths are already site-absolute ("/art/heroine_t1_s0.webp").
        resolveImageUrl: (src: string) => src,
      });
      if (this.destroyed || this.fault) return false;
      // `autoUpdate: false` — see the note at the top of the file. Everything else about the
      // document is the build's business.
      const bone = await OpenBone.from(asset, { autoUpdate: false, interactive: false });
      // OpenBone documents are authored y-UP: the runtime keeps an inner container at scale.y = -1
      // to flip their skeleton space into Pixi's y-down one. These rigs were authored y-DOWN, in
      // the same pixel space as the plate (x, y from the top-left corner), because that is the
      // space the face-kit patches, the mesh weights and the Python preview all use. Neutralising
      // the flip makes doc space and container space identical, so the skeleton lands on the plate
      // pixel for pixel instead of standing on its head.
      bone.view.scale.y = 1;
      const previous = this.bone;
      this.asset = asset;
      this.bone = bone;
      this.art = art;
      this.talkUntil = 0;
      this.reactionUntil = 0;
      this.lastUpdateMs = 0;
      this.view.addChild(bone);
      // Overlay is last so it draws over the skeleton, and re-added on every art change because
      // `view` is rebuilt when the plate under it changes.
      if (!this.overlayLayer.parent) this.view.addChild(this.overlayLayer);
      this.view.visible = true;
      bone.play('idle', true);
      this.current = 'idle';
      this.nextGlanceAt = performance.now() + 9000 + Math.random() * 8000;
      this.lastInteractionAt = performance.now();
      this.gaze.reset();
      // The panel's tuning survives the art change: a slider must mean the same thing on every plate.
      if (this.defaultTuning) this.applyTuning(this.defaultTuning);
      if (previous) {
        this.view.removeChild(previous);
        this.destroyBone(previous);
      }
      return true;
    } catch (error) {
      // Which of the two this is: the request never became a document (no rig for this art), or the
      // runtime refused a document that does exist. Either way the flat plate stays; only the
      // second one is worth a console line, and neither may take the whole night's rig down.
      const message = error instanceof Error ? error.message : String(error);
      const absent = isMissingDocumentError(error);
      if (absent) this.missing.add(art);
      else this.broken.add(art);
      if (!absent) console.warn(`[live-heroine] ${art}: document did not build, keeping the plate —`, message);
      return false;
    }
  }

  /**
   * Hide the live rig (no rig for this plate, or a flash frame owns the screen).
   *
   * Parking it matters as much as hiding it: `update()` returns at the top while the view is
   * hidden, so a reaction or a sentence that was in flight when the plate changed keeps its
   * deadlines and its `current` forever. Nothing shows — until the same plate comes back, and the
   * first frame replays a beat from a different scene. Hide, then stand her down.
   */
  public hide(): void {
    this.view.visible = false;
    this.talkUntil = 0;
    this.reactionUntil = 0;
    const bone = this.bone;
    if (!bone) return;
    this.guard('скрыть', () => {
      bone.play('idle', true);
      this.current = 'idle';
    });
  }

  public setTransform(scale: number, x: number, y: number): void {
    this.view.scale.set(scale);
    this.view.position.set(x, y);
  }

  /**
   * Point her attention at a place on the stage (−1..1 in both axes) — or `look(0, 0)` to let go.
   *
   * Called every frame from the stage tick with the pointer position, so a stale target is
   * impossible: whatever the player does, the next frame says where to look.
   */
  public look(x: number, y: number): void {
    this.gaze.aim(x, y);
  }

  /** Drop any live target — the pointer left the stage, or the rig was hidden. */
  public releaseGaze(): void {
    this.gaze.rest();
  }

  /**
   * She talks for a while. The mouth pattern is baked into `idle_talk` as a burst every 2.8 s
   * across the whole twenty-second loop, so any 2.6 s of it contains speech — a chat line can
   * arrive at any moment and the mouth has to be moving then, not only near the loop's start.
   */
  public talk(ms = 2600): void {
    const bone = this.bone;
    if (!bone || this.fault) return;
    // No mouth in this document means no deadline either: leaving `talkUntil` set on a mouthless
    // plate made the next reaction exit play an animation that is not there (see `talkPolicy.ts`).
    if (!canTalk(this.animations)) return;
    const now = performance.now();
    this.talkUntil = Math.max(this.talkUntil, talkDeadline(now, this.reactionUntil, ms));
    // Already talking, or mid-reaction: extend the deadline and leave the picture alone. Replaying
    // the mouth pattern from its first key on every chat line is a stutter, not speech.
    if (this.current === 'idle_talk' || this.reactionUntil > now) return;
    this.guard('речь', () => {
      bone.play('idle_talk', true);
      this.current = 'idle_talk';
    });
  }

  /**
   * One-shot secondary motion — the head turns and the hair catches up by itself.
   *
   * A clicker asks for this faster than a beat lasts. Restarting the animation on every request
   * re-seeds the physics springs from scratch, so a nod becomes a permanent wobble; a request that
   * arrives while the same beat is still playing is therefore dropped, not restarted. `tap` is the
   * clicker's own pulse (a 0.5 s nod), `shake` belongs to donations (0.9 s).
   */
  public react(kind: LiveReaction = 'shake', ms = 1100): void {
    const bone = this.bone;
    if (!bone || this.fault) return;
    const now = performance.now();
    this.lastInteractionAt = now;
    // A tap is the common case and must never restart a short beat that is still playing; a
    // donation is rare and should always be felt, so it only yields to a reaction from the last
    // 160 ms.
    //
    // A *long* beat is the exception. The director answers a tap on her legs with a lean-in (2.6 s)
    // and a tap on her bare shoulder with a stretch (1.7 s); dropping every tap for the whole of
    // that is two and a half seconds of a dead clicker. So a long beat yields to a new tap once it
    // has shown 45 % of itself — the player sees the answer start, and the click still lands.
    const long = this.beatMs > 700;
    const busy = long ? now - this.lastReactionAt < this.beatMs * 0.45 : this.reactionUntil > now;
    if (kind === 'tap' ? busy : now - this.lastReactionAt < 160) return;
    const animation = this.animations.includes(kind) ? kind : 'shake';
    this.guard('реакция', () => {
      // The runtime cross-fades every `play` by `defaultMix`, which is 0.2 s. Against a 0.5 s nod
      // that is 40 % of the beat spent arriving, and the fade is what made a given tap read as
      // 17 px on one beat of the idle loop and 24 on another: the pose was still on its way when
      // the nod had already turned around. 80 ms is long enough to hide the switch under the
      // hoodie and short enough that the dip lands where it was authored.
      bone.instance.animationState.setAnimation(0, animation, false, kind === 'tap' ? 0.06 : 0.16);
      this.current = animation;
    });
    this.reactionUntil = now + ms;
    this.lastReactionAt = now;
    this.beatMs = ms;
  }

  /**
   * How wound up she is, 0..1 — chat hype and her own boldness both feed it.
   *
   * The only thing this changes is the *speed* of the looping bed (breathing, sway, talk), never a
   * one-shot beat: a beat played fast reads as a bug, a breath played fast reads as a person who is
   * excited. 0.94→1.20 is a fifth of a second off a four-second breath, which is exactly the
   * difference between a calm stream and a hot one, and it costs one number per frame.
   */
  public setEnergy(level: number): void {
    this.energy = Math.min(1, Math.max(0, Number.isFinite(level) ? level : 0));
  }

  /** Does this document carry the animation? Some beats only exist where the art does. */
  /**
   * Where her cheeks are, in the rig's own coordinates — the blush renderer's one input.
   *
   * The numbers come out of the document, not out of a constant: the eye patch and the mouth patch
   * are meshes weighted to the head bone, so their corners are the real eye box and mouth box on
   * THIS plate, and the head bone's world matrix carries them wherever the animation has put her
   * head. That is why the blush follows a nod instead of floating where the face used to be — and
   * why it works on all 36 plates, at every stage of leaning toward the camera.
   *
   * Returns null when the document has no eyes or no mouth: a plate with no face art gets no blush
   * rather than two pink dots on her neck.
   */
  public cheekAnchors(): { left: { x: number; y: number }; right: { x: number; y: number }; size: number } | null {
    const skeleton = this.bone?.skeleton;
    const doc = this.asset?.doc as
      | { skeleton?: { skins?: { attachments?: Record<string, Record<string, { vertices?: number[] }>> }[] } }
      | undefined;
    if (!skeleton || !doc?.skeleton?.skins?.[0]?.attachments) return null;
    const head = skeleton.findBone('bone_head');
    if (!head) return null;
    const attachments = doc.skeleton.skins[0]!.attachments!;
    const eyes = attachments.slot_eyes?.eyes_closed?.vertices;
    const mouth = attachments.slot_mouth?.mouth_open?.vertices ?? attachments.slot_mouth?.mouth_closed?.vertices;
    if (!eyes || eyes.length < 8) return null;
    const box = (v: number[]) => {
      const xs = [v[0]!, v[2]!, v[4]!, v[6]!];
      const ys = [v[1]!, v[3]!, v[5]!, v[7]!];
      const x0 = Math.min(...xs);
      const x1 = Math.max(...xs);
      const y0 = Math.min(...ys);
      const y1 = Math.max(...ys);
      return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
    };
    const eye = box(eyes);
    // Cheeks live below the eyes and above the mouth; without a mouth box, a fifth of the eye
    // height below the eye line is the same place on every plate we have.
    const cheekY = mouth && mouth.length >= 8
      ? (eye.cy + eye.h / 2 + (box(mouth).cy - box(mouth).h / 2)) / 2
      : eye.cy + eye.h * 1.05;
    const dx = eye.w * 0.32;
    const world = head.world;
    const toRig = (x: number, y: number) => ({
      x: world.a * x + world.c * y + world.x,
      y: world.b * x + world.d * y + world.y,
    });
    const scale = Math.hypot(world.a, world.b) || 1;
    return {
      left: toRig(eye.cx - dx, cheekY),
      right: toRig(eye.cx + dx, cheekY),
      size: eye.w * 0.46 * scale,
    };
  }

  /** Let the stage draw on top of the skeleton without owning its container. */
  public attachOverlay(display: Container): void {
    this.overlayLayer.removeChildren().forEach((child) => child.destroy());
    this.overlayLayer.addChild(display);
  }

  /**
   * What is actually playing, for QA. The clip name is the only honest answer to "did that tap reach
   * her": a callout, a sound and a chat line can all fire while the skeleton sits in `idle`.
   */
  public debugState(): { current: string; animations: string[] } {
    return { current: this.current, animations: this.animations };
  }

  /** The whole vocabulary of this document, for the director's availability filter. */
  public animationSet(): ReadonlySet<string> {
    return new Set(this.animations);
  }

  public hasAnimation(name: string): boolean {
    return this.animations.includes(name);
  }

  /**
   * Play one animation by name, ignoring the talk/reaction bookkeeping — this is the panel's
   * "show me that again" button, not a game event.
   */
  public playAnimation(name: string, loop = true): boolean {
    const bone = this.bone;
    if (!bone || this.fault || !this.animations.includes(name)) return false;
    this.talkUntil = 0;
    this.reactionUntil = 0;
    return this.guard('анимация', () => {
      bone.play(name, loop);
      this.current = name;
      return true;
    }) ?? false;
  }

  /**
   * Per-frame bookkeeping and the skeleton's own clock. Called from the stage ticker, so every
   * failure path must end in "hide the rig", never in a thrown exception.
   */
  public update(now: number): void {
    const bone = this.bone;
    const previous = this.lastUpdateMs;
    this.lastUpdateMs = now;
    if (!bone || !this.view.visible || this.fault) return;
    this.guard('кадр', () => {
      // 0.1 s cap: a backgrounded tab returns with a delta of minutes, and a spring integrated over
      // that explodes — the hair would fly off her head on the first frame after the tab wakes up.
      const dt = previous ? Math.min(0.1, Math.max(0, (now - previous) / 1000)) : 1 / 60;
      bone.update(dt);
      // The bed breathes at her pace, not the author's. Looping track only: `current` is idle or
      // idle_talk while nothing else is playing, and a one-shot beat is never retimed.
      const bed = bone.instance.animationState.tracks[0];
      if (bed && (this.current === 'idle' || this.current === 'idle_talk')) {
        bed.speed = 0.94 + this.energy * 0.26;
      }
      // Live gaze, after the animation has written its absolute pose: the offset is additive for
      // this frame only, and the next `bone.update` rebuilds the pose from the timelines, so it can
      // never accumulate. `applyGaze` rebuilds the world matrices itself — without that call the
      // runtime keeps drawing the cached ones and a written rotation is invisible.
      // Skipped entirely once the spring has settled: a rig sitting still with the cursor parked on
      // her nose should not pay for a world-transform rebuild every frame.
      const gaze = this.gaze.step(dt);
      if (!this.gaze.settled) applyGaze(bone.skeleton, gazeDegrees(gaze));
      if (this.reactionUntil && now >= this.reactionUntil) {
        this.reactionUntil = 0;
        const next = idleAfterReaction(this.animations, this.talkUntil > now);
        bone.play(next, true);
        this.current = next;
        return;
      }
      if (this.talkUntil && now >= this.talkUntil) {
        this.talkUntil = 0;
        bone.play('idle', true);
        this.current = 'idle';
      }
      // Nothing is happening to her: she fusses. Only in a real gap — never on top of a click, a
      // donation or a line of chat — and the gap shortens the longer the player leaves her alone,
      // because a person waiting for attention does not sit still. Every quirk is filtered against
      // the document, so a plate with no giggle simply never giggles.
      if (
        this.current === 'idle' &&
        !this.reactionUntil &&
        !this.talkUntil &&
        now >= this.nextGlanceAt
      ) {
        const bored = Math.min(1, (now - this.lastInteractionAt) / 45000);
        const pool = IDLE_QUIRKS.filter((n) => this.animations.includes(n));
        const pick = pool[Math.floor(Math.random() * pool.length)] ?? 'turn';
        this.nextGlanceAt = now + (12000 - bored * 5500) + Math.random() * (14000 - bored * 7000);
        this.react(pick, pick === 'turn' ? 2400 : 2000);
        // The idle beats are audible too — quietly, and only the ones that are hers to make.
        if (pick !== 'turn' && pick !== 'sway') sfx.quirk();
        this.onQuirk?.(pick as QuirkKind);
      }
    });
  }

  // ---- tuning ------------------------------------------------------------------------------

  /**
   * Which parameters each physics constraint has, straight from the document. The panel builds its
   * sliders from this: a rig without a `phys_bust` must not offer a bust slider that does nothing.
   */
  public constraintIds(): string[] {
    return (this.asset?.doc.skeleton.physics ?? []).map((c) => c.id);
  }

  /** The document's own values — the reference the panel diffs against and resets to. */
  public docTuning(): RigTuning {
    const out: RigTuning = {};
    for (const c of this.asset?.doc.skeleton.physics ?? []) {
      const values: ConstraintTuning = {};
      for (const p of TUNING_PARAMS) {
        const v = (c as unknown as Record<string, unknown>)[p.key];
        if (typeof v === 'number') values[p.key] = v;
      }
      out[c.id] = values;
    }
    return out;
  }

  /** Values the runtime is integrating with right now (document defaults + what was applied). */
  public tuning(): RigTuning {
    const out = this.docTuning();
    const live = this.bone?.instance.skeleton.constraintValues;
    if (!live) return out;
    for (const [id, values] of live) {
      const current = out[id] ?? {};
      for (const p of TUNING_PARAMS) {
        const v = values[p.key];
        if (typeof v === 'number') current[p.key] = v;
      }
      out[id] = current;
    }
    return out;
  }

  /**
   * Write tuning into the live skeleton. The runtime reads constraint values every frame, so this
   * is felt on the next breath — no reload, no rebuild.
   */
  public applyTuning(tuning: RigTuning): void {
    const bone = this.bone;
    if (!bone || this.fault) return;
    const safe = clampTuning(tuning);
    this.guard('тюнинг', () => {
      const live = bone.instance.skeleton.constraintValues;
      for (const [id, values] of Object.entries(safe)) {
        const record = live.get(id) ?? {};
        for (const p of TUNING_PARAMS) {
          const v = values[p.key];
          if (typeof v === 'number') record[p.key] = v;
        }
        live.set(id, record);
      }
    });
  }

  /** Back to the document's values, as if the page had just loaded. */
  public resetTuning(): void {
    this.applyTuning(this.docTuning());
    this.defaultTuning = null;
  }

  /** Keep `tuning` for this and every future document; null forgets it. */
  public setDefaultTuning(tuning: RigTuning | null): void {
    this.defaultTuning = tuning ? clampTuning(tuning) : null;
    if (this.defaultTuning) this.applyTuning(this.defaultTuning);
  }

  /** What the console prints: skeleton size and the draw-call count Pixi actually issued. */
  public stats(): RigStats {
    const doc = this.asset?.doc;
    let vertices = 0;
    let triangles = 0;
    for (const skin of doc?.skeleton.skins ?? []) {
      for (const attachments of Object.values(skin.attachments ?? {})) {
        for (const attachment of Object.values(attachments as Record<string, unknown>)) {
          const mesh = attachment as { vertices?: number[]; triangles?: number[] };
          if (Array.isArray(mesh.vertices)) vertices += mesh.vertices.length / 2;
          if (Array.isArray(mesh.triangles)) triangles += mesh.triangles.length / 3;
        }
      }
    }
    return {
      bones: doc?.skeleton.bones.length ?? 0,
      vertices: Math.round(vertices),
      triangles: Math.round(triangles),
      drawCalls: this.bone?.drawCalls ?? 0,
    };
  }

  // ---- failure -----------------------------------------------------------------------------

  /** Run `fn`, and on a throw hand the stage the rig's fate instead of the page's. */
  private guard<T>(where: string, fn: () => T): T | null {
    try {
      return fn();
    } catch (error) {
      this.fail(where, error);
      return null;
    }
  }

  /**
   * The rig broke. On a phone there is no console, and a dead skeleton must not be able to take the
   * game down with it, so this is a one-way door: drop everything, tell the stage, stay off.
   */
  private fail(where: string, error: unknown): void {
    if (this.fault) return;
    const message = error instanceof Error ? error.message : String(error);
    this.fault = `${where}: ${message}`;
    console.error('[live-heroine] rig failed, keeping the flat plate —', this.fault, error);
    const bone = this.bone;
    this.bone = null;
    this.asset = null;
    this.art = null;
    this.talkUntil = 0;
    this.reactionUntil = 0;
    try {
      this.view.visible = false;
      if (bone) {
        this.view.removeChild(bone);
        this.destroyBone(bone);
      }
    } catch (cleanupError) {
      console.warn('[live-heroine] rig cleanup failed (ignored)', cleanupError);
    }
    this.onFault?.(this.fault);
  }

  private destroyBone(bone: OpenBone): void {
    try {
      bone.destroy({ children: true });
    } catch (error) {
      console.warn('[live-heroine] rig destroy failed (ignored)', error);
    }
  }

  public destroy(): void {
    this.destroyed = true;
    const bone = this.bone;
    this.bone = null;
    this.asset = null;
    if (bone) this.destroyBone(bone);
    try {
      this.view.destroy({ children: true });
    } catch {
      // Already torn down by Pixi — nothing left to release.
    }
  }
}

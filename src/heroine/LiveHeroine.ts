import { Container } from 'pixi.js';
import { OpenBone, loadOpenBone, type OpenBoneAsset } from '@openbone/pixi';
import { clampTuning, TUNING_PARAMS, type ConstraintTuning, type RigTuning } from './rigTuning.ts';

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

export type LiveReaction = 'shake' | 'turn' | 'sway' | 'tap';

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
  private talkUntil = 0;
  private reactionUntil = 0;
  /** When the last reaction was asked for — the clicker asks faster than a beat lasts. */
  private lastReactionAt = -Infinity;
  /**
   * When she looks around on her own.
   *
   * This is the cheapest kind of life there is and the one a still illustration misses most: a
   * person sitting at a desk does not hold one pose until something happens to her. Every 12-26
   * seconds, in the gaps between clicks, she turns her head for a beat and settles back.
   */
  private nextGlanceAt = 0;
  private destroyed = false;
  /** Animation the panel/state asked for last — the readout in the admin console. */
  private current = 'idle';
  /** Own clock, seconds of the last `update()` — the rig is not on Pixi's ticker. */
  private lastUpdateMs = 0;
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
      const asset = await loadOpenBone(`/rigs/${art}.obone`, {
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
      this.view.visible = true;
      bone.play('idle', true);
      this.current = 'idle';
      this.nextGlanceAt = performance.now() + 9000 + Math.random() * 8000;
      // The panel's tuning survives the art change: a slider must mean the same thing on every plate.
      if (this.defaultTuning) this.applyTuning(this.defaultTuning);
      if (previous) {
        this.view.removeChild(previous);
        this.destroyBone(previous);
      }
      return true;
    } catch (error) {
      this.fail('загрузка', error);
      return false;
    }
  }

  /** Hide the live rig (no rig for this plate, or a flash frame owns the screen). */
  public hide(): void {
    this.view.visible = false;
  }

  public setTransform(scale: number, x: number, y: number): void {
    this.view.scale.set(scale);
    this.view.position.set(x, y);
  }

  /**
   * She talks for a while. The mouth pattern is baked into `idle_talk` as a burst every 2.8 s
   * across the whole twenty-second loop, so any 2.6 s of it contains speech — a chat line can
   * arrive at any moment and the mouth has to be moving then, not only near the loop's start.
   */
  public talk(ms = 2600): void {
    const bone = this.bone;
    if (!bone || this.fault) return;
    const now = performance.now();
    this.talkUntil = Math.max(this.talkUntil, now + ms);
    // Already talking, or mid-reaction: extend the deadline and leave the picture alone. Replaying
    // the mouth pattern from its first key on every chat line is a stutter, not speech.
    if (this.current === 'idle_talk' || this.reactionUntil > now) return;
    if (!this.animations.includes('idle_talk')) return;
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
    // A tap is the common case and must never restart a beat that is still playing; a donation is
    // rare and should always be felt, so it only yields to a reaction from the last 160 ms.
    if (kind === 'tap' ? this.reactionUntil > now : now - this.lastReactionAt < 160) return;
    const animation = this.animations.includes(kind) ? kind : 'shake';
    this.guard('реакция', () => {
      bone.play(animation, false);
      this.current = animation;
    });
    this.reactionUntil = now + ms;
    this.lastReactionAt = now;
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
      if (this.reactionUntil && now >= this.reactionUntil) {
        this.reactionUntil = 0;
        const next = this.talkUntil > now ? 'idle_talk' : 'idle';
        bone.play(next, true);
        this.current = next;
        return;
      }
      if (this.talkUntil && now >= this.talkUntil) {
        this.talkUntil = 0;
        bone.play('idle', true);
        this.current = 'idle';
      }
      // Nothing is happening to her: she looks around by herself. Only in a real gap — never on
      // top of a click, a donation or a line of chat.
      if (
        this.current === 'idle' &&
        !this.reactionUntil &&
        !this.talkUntil &&
        now >= this.nextGlanceAt
      ) {
        this.nextGlanceAt = now + 12000 + Math.random() * 14000;
        this.react('turn', 2400);
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

import { Container } from 'pixi.js';
import { OpenBone, loadOpenBone, type OpenBoneAsset } from '@openbone/pixi';

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
 */

export type LiveReaction = 'shake' | 'turn' | 'sway';

export class LiveHeroine {
  /** Same transform contract as `HeroineRig.view`: plate pixels, top-left origin. */
  readonly view = new Container();

  private asset: OpenBoneAsset | null = null;
  private bone: OpenBone | null = null;
  private art: string | null = null;
  private loading: Promise<boolean> | null = null;
  private pendingArt: string | null = null;
  private talkUntil = 0;
  private reactionUntil = 0;
  private destroyed = false;

  constructor() {
    this.view.visible = false;
  }

  /** Art key of the rig currently on screen, e.g. `t2_s3`. Null until one loads. */
  public get readyArt(): string | null {
    return this.bone ? this.art : null;
  }

  public isReadyFor(art: string): boolean {
    return Boolean(this.bone) && this.art === art;
  }

  /**
   * Load the rig for `art` and show it. Resolves false when there is none (most of the 41 plates
   * have no rig — the small or cropped faces were deliberately skipped), and the caller keeps the
   * flat plate.
   */
  public async show(art: string): Promise<boolean> {
    if (this.destroyed) return false;
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
      if (this.destroyed) return false;
      const bone = await OpenBone.from(asset, { autoUpdate: true, interactive: false });
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
      this.view.addChild(bone);
      this.view.visible = true;
      bone.play('idle', true);
      if (previous) {
        this.view.removeChild(previous);
        previous.destroy({ children: true });
      }
      return true;
    } catch (error) {
      console.warn('[live-heroine] rig load failed, keeping the flat plate', art, error);
      this.hide();
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

  /** She talks for a while: two passes over the mouth pattern inside the 4 s idle loop. */
  public talk(ms = 2600): void {
    if (!this.bone) return;
    this.talkUntil = performance.now() + ms;
    const animations = this.asset?.doc.animations ?? [];
    const has = animations.some((a) => a.name === 'idle_talk');
    if (!has) return;
    this.bone.play('idle_talk', true);
  }

  /** One-shot secondary motion — the head turns and the hair catches up by itself. */
  public react(kind: LiveReaction = 'shake', ms = 1100): void {
    if (!this.bone) return;
    this.bone.play(kind, false);
    this.reactionUntil = performance.now() + ms;
  }

  /**
   * Per-frame bookkeeping: hand control back to the idle loop after a one-shot reaction or a
   * talk cycle. Called from the stage ticker, so it costs nothing when nothing else runs.
   */
  public update(now: number): void {
    if (!this.bone || !this.view.visible) return;
    if (this.reactionUntil && now >= this.reactionUntil) {
      this.reactionUntil = 0;
      this.bone.play(this.talkUntil > now ? 'idle_talk' : 'idle', true);
      return;
    }
    if (this.talkUntil && now >= this.talkUntil) {
      this.talkUntil = 0;
      this.bone.play('idle', true);
    }
  }

  public destroy(): void {
    this.destroyed = true;
    this.bone?.destroy({ children: true });
    this.bone = null;
    this.asset = null;
    this.view.destroy({ children: true });
  }
}

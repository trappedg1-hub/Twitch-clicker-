/**
 * The blush, drawn.
 *
 * `blush.ts` decides how pink she is; this file puts two soft glows under her cheekbones and moves
 * them with her head. It exists as its own module because there are exactly three decisions in it
 * and each one was made for a reason worth writing down:
 *
 * 1. **A generated radial texture, not a Graphics.** A `Graphics` circle has a hard rim; a real
 *    blush has no rim at all. A 128 px gradient baked into a texture costs nothing per frame and
 *    scales smoothly, where `BlurFilter` on a live Graphics would cost a render target on every
 *    frame of a phone.
 * 2. **`add` blend, low alpha, warm tint.** The plate is a painted anime face on a desk at night:
 *    `add` reads as blood under the skin, `normal` reads as a pink sticker. The alpha ceiling
 *    (0.38) is set in `blush.ts` — the layer never overrides it.
 * 3. **Anchored to the document's own eye box.** The positions come from `cheekAnchors()`, which
 *    reads the eye and mouth patches out of the rig and transforms them by the head bone's world
 *    matrix, so the glow follows a nod, a turn and a lean-in without a single magic number here.
 */

import { Container, Sprite, Texture } from 'pixi.js';

import { blushAlpha, baseBlush, decayHeat, stepBlush, HEAT, type BlushRampState } from './blush.ts';

/** Built once per document, on first use: white-hot centre, nothing at the rim. */
function radialTexture(): Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Texture.WHITE;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // Three stops, not two: a hairline of hot centre, most of the falloff, and a wide nothing. A
  // linear two-stop gradient reads as a ball of light rather than as a flush.
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

export interface BlushAnchors {
  left: { x: number; y: number };
  right: { x: number; y: number };
  size: number;
}

export class BlushLayer {
  public readonly container = new Container();
  private readonly texture = radialTexture();
  private readonly left = new Sprite(this.texture);
  private readonly right = new Sprite(this.texture);
  private readonly ramp: BlushRampState = { level: 0 };
  private heat = 0;

  constructor() {
    for (const sprite of [this.left, this.right]) {
      sprite.anchor.set(0.5);
      sprite.tint = 0xff4d78;
      sprite.blendMode = 'add';
      sprite.alpha = 0;
      this.container.addChild(sprite);
    }
    // The glows are decoration: they must never eat a tap meant for her.
    this.container.eventMode = 'none';
    this.container.interactiveChildren = false;
  }

  /** A moment of heat: a donation, a caught stare, a tickle. */
  public bump(amount: number): void {
    this.heat = Math.min(1.6, this.heat + amount);
  }

  /**
   * Advance and place. `anchors` is in the same space as the sprites (the skeleton's view), and
   * null means "this plate has no measurable face" — in which case it fades out rather than
   * sticking two dots to the last known position.
   */
  public update(dt: number, anchors: BlushAnchors | null, state: { boldness: number; hype: number }): void {
    this.heat = decayHeat(this.heat, dt);
    const level = stepBlush(this.ramp, dt, baseBlush(state), this.heat * 0.45);
    const alpha = blushAlpha(level);
    if (!anchors) {
      const faded = Math.max(0, alpha - 0.05);
      this.left.alpha = faded;
      this.right.alpha = faded;
      return;
    }
    for (const [sprite, point] of [
      [this.left, anchors.left],
      [this.right, anchors.right],
    ] as const) {
      sprite.position.set(point.x, point.y);
      // Slightly taller than wide: cheeks are, and a circle reads as a sticker.
      sprite.width = anchors.size;
      sprite.height = anchors.size * 1.12;
      sprite.alpha = alpha;
    }
  }

  /** QA: the level the ramp is at, and where it is drawn. */
  public debug(): { level: number; heat: number; at: { x: number; y: number } | null } {
    return {
      level: this.ramp.level,
      heat: this.heat,
      at: this.left.alpha > 0 ? { x: this.left.x, y: this.left.y } : null,
    };
  }

  public static readonly HEAT = HEAT;
}

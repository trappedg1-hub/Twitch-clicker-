import {
  Container,
   FederatedPointerEvent,
  Graphics,
  MeshPlane,
  Sprite,
  Texture,
} from 'pixi.js';
import type { SubGoalStageIndex, TapZoneId } from '../domain/types.ts';

export interface HeroineTextures {
  stages: readonly [Texture, Texture, Texture, Texture, Texture];
  blink: Texture;
  fluster: Texture;
}

interface EnvelopeState {
  phase: 'idle' | 'attack' | 'hold' | 'release';
  timerMs: number;
  attackMs: number;
  holdMs: number;
  releaseMs: number;
  value: number;
}

function stepEnvelope(env: EnvelopeState, dtMs: number): number {
  if (env.phase === 'idle') {
    env.value = 0;
    return 0;
  }
  env.timerMs += dtMs;
  if (env.phase === 'attack') {
    const t = Math.min(1, env.timerMs / Math.max(1, env.attackMs));
    // Smoothstep ease
    env.value = t * t * (3 - 2 * t);
    if (t >= 1) {
      env.phase = 'hold';
      env.timerMs = 0;
    }
  } else if (env.phase === 'hold') {
    env.value = 1;
    if (env.timerMs >= env.holdMs) {
      env.phase = 'release';
      env.timerMs = 0;
    }
  } else if (env.phase === 'release') {
    const t = Math.min(1, env.timerMs / Math.max(1, env.releaseMs));
    const smooth = t * t * (3 - 2 * t);
    env.value = 1 - smooth;
    if (t >= 1) {
      env.phase = 'idle';
      env.timerMs = 0;
      env.value = 0;
    }
  }
  return env.value;
}

export class HeroineRig {
  public readonly view = new Container();
  private readonly bodyContainer = new Container();
  private readonly mesh: MeshPlane;
  private readonly restPositions: Float32Array;
  private readonly blinkSprite: Sprite;
  private readonly flusterSprite: Sprite;
  private readonly hitLayer = new Container();

  public static readonly PLATE_W = 1024;
  public static readonly PLATE_H = 1526;
  private static readonly SEG_X = 24;
  private static readonly SEG_Y = 32;

  private elapsedSec = 0;
  private nextBlinkCountdownMs = 2800;

  // Damped spring state for localized soft-body bounce
  private chestDisp = 0;
  private chestVel = 0;
  private hipDisp = 0;
  private hipVel = 0;
  private chairRecoilY = 0;
  private chairRecoilVel = 0;

  private readonly blinkEnv: EnvelopeState = {
    phase: 'idle',
    timerMs: 0,
    attackMs: 95,
    holdMs: 55,
    releaseMs: 130,
    value: 0,
  };

  private readonly flusterEnv: EnvelopeState = {
    phase: 'idle',
    timerMs: 0,
    attackMs: 110,
    holdMs: 1450,
    releaseMs: 320,
    value: 0,
  };

  private readonly stageTextures: readonly [Texture, Texture, Texture, Texture, Texture];
  private currentStage: SubGoalStageIndex = 0;

  public onZoneTap?: (
    zone: TapZoneId,
    globalPoint: { x: number; y: number },
  ) => void;

  constructor(textures: HeroineTextures) {
    this.stageTextures = textures.stages;
    this.view.addChild(this.bodyContainer);

    this.mesh = new MeshPlane({
      texture: textures.stages[0],
      verticesX: HeroineRig.SEG_X,
      verticesY: HeroineRig.SEG_Y,
    });
    const posBuffer = this.mesh.geometry.getAttribute('aPosition').buffer;
    this.restPositions = new Float32Array(posBuffer.data as Float32Array);
    this.bodyContainer.addChild(this.mesh);

    // Subpixel-registered expression overlay patches (x=338, y=61 in 1024x1526 plate space)
    this.flusterSprite = new Sprite(textures.fluster);
    this.flusterSprite.position.set(338, 61);
    this.flusterSprite.width = 348;
    this.flusterSprite.height = 397;
    this.flusterSprite.alpha = 0;
    this.bodyContainer.addChild(this.flusterSprite);

    this.blinkSprite = new Sprite(textures.blink);
    this.blinkSprite.position.set(338, 61);
    this.blinkSprite.width = 348;
    this.blinkSprite.height = 397;
    this.blinkSprite.alpha = 0;
    this.bodyContainer.addChild(this.blinkSprite);

    this.bodyContainer.addChild(this.hitLayer);
    this.setupHitZones();
  }

  private setupHitZones(): void {
    // Ordered back-to-front so broad legs zone sits beneath specific chest/belly/feet zones
    const zones: { id: TapZoneId; x: number; y: number; w: number; h: number }[] = [
      { id: 'legs', x: 110, y: 690, w: 805, h: 420 },
      { id: 'head', x: 335, y: 45, w: 360, h: 325 },
      { id: 'chest', x: 355, y: 375, w: 345, h: 255 },
      { id: 'belly', x: 405, y: 630, w: 245, h: 195 },
      { id: 'feet', x: 230, y: 1090, w: 565, h: 350 },
    ];

    for (const z of zones) {
      const g = new Graphics();
      g.rect(z.x, z.y, z.w, z.h).fill({ color: 0xffffff, alpha: 0.001 });
      g.eventMode = 'static';
      g.cursor = 'pointer';
      g.on('pointerdown', (ev: FederatedPointerEvent) => {
        ev.stopPropagation();
        this.triggerTapReaction(z.id);
        this.onZoneTap?.(z.id, { x: ev.global.x, y: ev.global.y });
      });
      this.hitLayer.addChild(g);
    }
  }

  public triggerTapReaction(zone: TapZoneId): void {
    // Inject localized soft-body spring impulse + expression response
    if (zone === 'chest') {
      this.chestVel -= 145;
      this.chairRecoilVel += 42;
      this.triggerFluster(1650);
    } else if (zone === 'belly') {
      this.chestVel -= 85;
      this.hipVel -= 70;
      this.chairRecoilVel += 35;
      this.triggerFluster(1500);
    } else if (zone === 'legs' || zone === 'feet') {
      this.hipVel -= 120;
      this.chestVel -= 55;
      this.chairRecoilVel += 48;
      this.triggerFluster(1600);
    } else {
      // head
      this.chestVel -= 45;
      this.chairRecoilVel += 28;
      this.triggerFluster(1400);
    }
  }

  public triggerBlink(): void {
    this.blinkEnv.phase = 'attack';
    this.blinkEnv.timerMs = 0;
  }

  public triggerFluster(holdMs = 1500): void {
    this.flusterEnv.holdMs = holdMs;
    if (this.flusterEnv.phase === 'idle' || this.flusterEnv.phase === 'release') {
      this.flusterEnv.phase = 'attack';
      this.flusterEnv.timerMs = this.flusterEnv.value * this.flusterEnv.attackMs;
    } else {
      this.flusterEnv.phase = 'hold';
      this.flusterEnv.timerMs = 0;
    }
  }

  public update(dtMs: number): void {
    const clampedDtMs = Math.min(50, Math.max(0, dtMs));
    const dt = clampedDtMs / 1000;
    this.elapsedSec += dt;

    // 1. Random natural blink scheduler (2.2s - 5.6s)
    this.nextBlinkCountdownMs -= clampedDtMs;
    if (this.nextBlinkCountdownMs <= 0) {
      if (this.flusterEnv.value < 0.25) {
        this.triggerBlink();
      }
      this.nextBlinkCountdownMs = 2200 + Math.random() * 3400;
    }

    const flusterAlpha = stepEnvelope(this.flusterEnv, clampedDtMs);
    const rawBlinkAlpha = stepEnvelope(this.blinkEnv, clampedDtMs);
    this.flusterSprite.alpha = flusterAlpha;
    // Suppress open-eye blink overlay while fluster eyes are fully active so eyelids stay clean
    this.blinkSprite.alpha = rawBlinkAlpha * (1 - flusterAlpha * 0.85);

    // 2. Damped harmonic springs (chest bounce, thigh/hip bounce, chair micro-recoil)
    const stepSpring = (
      x: number,
      v: number,
      omega: number,
      zeta: number,
    ): [number, number] => {
      const acc = -omega * omega * x - 2 * zeta * omega * v;
      const nv = v + acc * dt;
      const nx = x + nv * dt;
      return [nx, nv];
    };

    [this.chestDisp, this.chestVel] = stepSpring(this.chestDisp, this.chestVel, 18.5, 0.24);
    [this.hipDisp, this.hipVel] = stepSpring(this.hipDisp, this.hipVel, 15.0, 0.28);
    [this.chairRecoilY, this.chairRecoilVel] = stepSpring(
      this.chairRecoilY,
      this.chairRecoilVel,
      20.0,
      0.38,
    );

    // 3. Whole-body subtle breathing bob + chair recoil (keeps head & face patches 100% locked!)
    const breathWave = Math.sin(this.elapsedSec * ((Math.PI * 2) / 3.6));
    this.bodyContainer.y = breathWave * 2.2 + this.chairRecoilY;

    // 4. MeshPlane vertex deformation strictly BELOW v=0.25 (zero skull/face warp!)
    const posAttr = this.mesh.geometry.getAttribute('aPosition');
    const data = posAttr.buffer.data as Float32Array;
    const rest = this.restPositions;
    const W = HeroineRig.PLATE_W;
    const H = HeroineRig.PLATE_H;

    for (let i = 0; i < data.length; i += 2) {
      const rx = rest[i]!;
      const ry = rest[i + 1]!;
      const u = rx / W;
      const v = ry / H;

      let dx = 0;
      let dy = 0;

      // Chest + shoulders breathing & elastic jiggle envelope: v in [0.25..0.52], u in [0.28..0.74]
      if (v > 0.25 && v < 0.54 && u > 0.26 && u < 0.76) {
        const wy = Math.sin(((v - 0.25) / (0.54 - 0.25)) * Math.PI);
        const wx = Math.sin(((u - 0.26) / (0.76 - 0.26)) * Math.PI);
        const weight = wy * wx;
        // Breathing lifts & subtly expands ribcage/bust
        dy += (-2.8 * breathWave + this.chestDisp) * weight;
        dx += (u - 0.51) * (3.6 * (breathWave * 0.5 + 0.5) - this.chestDisp * 0.22) * weight;
      }

      // Midriff + parted thighs/knees subtle elastic response: v in [0.46..0.88], u in [0.10..0.90]
      if (v > 0.46 && v < 0.88 && u > 0.1 && u < 0.9) {
        const wy = Math.sin(((v - 0.46) / (0.88 - 0.46)) * Math.PI);
        const wx = Math.sin(((u - 0.1) / (0.9 - 0.1)) * Math.PI);
        const weight = wy * wx;
        dy += this.hipDisp * 0.75 * weight;
        dx += (u - 0.5) * (-this.hipDisp * 0.18) * weight;
      }

      data[i] = rx + dx;
      data[i + 1] = ry + dy;
    }
    posAttr.buffer.update();
  }

  public setSubStage(stage: SubGoalStageIndex, celebrate = false): boolean {
    const nextTex = this.stageTextures[stage] ?? this.stageTextures[0];
    const changed = this.currentStage !== stage || this.mesh.texture !== nextTex;
    this.currentStage = stage;
    if (changed) {
      this.mesh.texture = nextTex;
    }
    if (celebrate) {
      this.chestVel -= 170;
      this.hipVel -= 130;
      this.chairRecoilVel += 58;
      this.triggerFluster(2600);
    }
    return changed || celebrate;
  }

  public getDebugSnapshot() {
    return {
      subStage: this.currentStage,
      blinkAlpha: Number(this.blinkSprite.alpha.toFixed(3)),
      flusterAlpha: Number(this.flusterSprite.alpha.toFixed(3)),
      chestDisp: Number(this.chestDisp.toFixed(2)),
    };
  }
}

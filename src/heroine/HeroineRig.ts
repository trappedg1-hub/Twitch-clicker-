import {
  Container,
  FederatedPointerEvent,
  Graphics,
  MeshPlane,
  Sprite,
  Texture,
} from 'pixi.js';
import { pickEmotionForContext } from '../domain/dialogue.ts';
import type {
  HeroineEmotion,
  SubGoalStageIndex,
  TapZoneId,
} from '../domain/types.ts';

export interface HeroineTextures {
  stages: readonly [Texture, Texture, Texture, Texture, Texture];
  blink: Texture;
  shy: Texture;
  fluster: Texture;
  tease: Texture;
  bold: Texture;
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

  private readonly boldRestSprite: Sprite;
  private readonly emotionSprite: Sprite;
  private readonly blinkSprite: Sprite;
  private readonly hitLayer = new Container();

  private readonly stageTextures: readonly [Texture, Texture, Texture, Texture, Texture];
  private readonly emotionTextures: Record<Exclude<HeroineEmotion, 'neutral'>, Texture>;
  private readonly uprightBlinkTex: Texture;

  private currentStage: SubGoalStageIndex = 0;
  private activeEmotion: Exclude<HeroineEmotion, 'neutral'> = 'shy';
  private boldnessLevel = 0;
  private reactionCounter = 0;
  private nextAmbientMicroExprMs = 5200;

  public static readonly PLATE_W = 1024;
  public static readonly PLATE_H = 1526;
  private static readonly SEG_X = 24;
  private static readonly SEG_Y = 32;

  private elapsedSec = 0;
  private nextBlinkCountdownMs = 2600;

  // Damped spring state for localized soft-body bounce, sway & bashful shiver
  private chestDisp = 0;
  private chestVel = 0;
  private hipDisp = 0;
  private hipVel = 0;
  private swayDisp = 0;
  private swayVel = 0;
  private archDisp = 0;
  private archVel = 0;
  private shiverTimerMs = 0;
  private chairRecoilY = 0;
  private chairRecoilVel = 0;

  private readonly blinkEnv: EnvelopeState = {
    phase: 'idle',
    timerMs: 0,
    attackMs: 90,
    holdMs: 55,
    releaseMs: 125,
    value: 0,
  };

  private readonly emotionEnv: EnvelopeState = {
    phase: 'idle',
    timerMs: 0,
    attackMs: 105,
    holdMs: 1650,
    releaseMs: 320,
    value: 0,
  };

  public onZoneTap?: (
    zone: TapZoneId,
    globalPoint: { x: number; y: number },
  ) => void;

  constructor(textures: HeroineTextures) {
    this.stageTextures = textures.stages;
    this.uprightBlinkTex = textures.blink;

    this.emotionTextures = {
      shy: textures.shy,
      fluster: textures.fluster,
      tease: textures.tease,
      bold: textures.bold,
    };

    this.view.addChild(this.bodyContainer);

    this.mesh = new MeshPlane({
      texture: textures.stages[0],
      verticesX: HeroineRig.SEG_X,
      verticesY: HeroineRig.SEG_Y,
    });
    const posBuffer = this.mesh.geometry.getAttribute('aPosition').buffer;
    this.restPositions = new Float32Array(posBuffer.data as Float32Array);
    this.bodyContainer.addChild(this.mesh);

    // Resting confident allure layer that emerges smoothly at high boldness (stages 0..4)
    this.boldRestSprite = new Sprite(textures.bold);
    this.boldRestSprite.position.set(338, 61);
    this.boldRestSprite.width = 348;
    this.boldRestSprite.height = 397;
    this.boldRestSprite.alpha = 0;
    this.bodyContainer.addChild(this.boldRestSprite);

    // Subpixel-registered active emotion patch
    this.emotionSprite = new Sprite(textures.shy);
    this.emotionSprite.position.set(338, 61);
    this.emotionSprite.width = 348;
    this.emotionSprite.height = 397;
    this.emotionSprite.alpha = 0;
    this.bodyContainer.addChild(this.emotionSprite);

    this.blinkSprite = new Sprite(textures.blink);
    this.blinkSprite.position.set(338, 61);
    this.blinkSprite.width = 348;
    this.blinkSprite.height = 397;
    this.blinkSprite.alpha = 0;
    this.bodyContainer.addChild(this.blinkSprite);

    this.bodyContainer.addChild(this.hitLayer);
    this.rebuildHitZones();
  }

  private applyPosePatchGeometry(): void {
    this.emotionSprite.position.set(338, 61);
    this.emotionSprite.width = 348;
    this.emotionSprite.height = 397;
    this.emotionSprite.texture = this.emotionTextures[this.activeEmotion];

    this.blinkSprite.position.set(338, 61);
    this.blinkSprite.width = 348;
    this.blinkSprite.height = 397;
    this.blinkSprite.texture = this.uprightBlinkTex;
    this.boldRestSprite.visible = true;
  }

  private rebuildHitZones(): void {
    this.hitLayer.removeChildren().forEach((c) => c.destroy());

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

  public setBoldness(boldness: number): void {
    this.boldnessLevel = Math.max(0, Math.min(100, boldness));
  }

  public triggerTapReaction(
    zone: TapZoneId,
    forcedEmotion?: Exclude<HeroineEmotion, 'neutral'>,
  ): void {
    this.reactionCounter += 1;
    const chosen =
      forcedEmotion ??
      pickEmotionForContext(this.boldnessLevel, this.currentStage, this.reactionCounter);

    const swayDir = this.reactionCounter % 2 === 0 ? 1 : -1;

    if (zone === 'chest') {
      this.chestVel -= 165;
      this.archVel += 85;
      this.swayVel += swayDir * 42;
      this.chairRecoilVel += 44;
      this.triggerEmotion(chosen, 1850);
    } else if (zone === 'belly') {
      this.chestVel -= 95;
      this.hipVel -= 85;
      this.swayVel += swayDir * 68;
      this.shiverTimerMs = 420;
      this.chairRecoilVel += 38;
      this.triggerEmotion(chosen === 'bold' ? 'tease' : 'fluster', 1700);
    } else if (zone === 'legs' || zone === 'feet') {
      this.hipVel -= 135;
      this.chestVel -= 65;
      this.swayVel += swayDir * 48;
      if (zone === 'feet' || this.boldnessLevel < 45) {
        this.shiverTimerMs = 460;
      }
      this.chairRecoilVel += 50;
      this.triggerEmotion(chosen, 1850);
    } else {
      this.chestVel -= 52;
      this.swayVel += swayDir * 78;
      this.chairRecoilVel += 28;
      this.triggerEmotion(chosen, 1600);
    }
  }

  public triggerArchStretch(emo: Exclude<HeroineEmotion, 'neutral'> = 'bold'): void {
    this.chestVel -= 210;
    this.archVel += 160;
    this.hipVel -= 95;
    this.swayVel += (this.reactionCounter % 2 === 0 ? 1 : -1) * 65;
    this.chairRecoilVel -= 35;
    this.triggerEmotion(emo, 2400);
  }

  public triggerBlink(): void {
    this.blinkEnv.phase = 'attack';
    this.blinkEnv.timerMs = 0;
  }

  public triggerEmotion(
    emotion: Exclude<HeroineEmotion, 'neutral'>,
    holdMs = 1650,
  ): void {
    this.activeEmotion = emotion;
    this.emotionSprite.texture = this.emotionTextures[emotion];
    this.emotionEnv.holdMs = holdMs;
    if (this.emotionEnv.phase === 'idle' || this.emotionEnv.phase === 'release') {
      this.emotionEnv.phase = 'attack';
      this.emotionEnv.timerMs = this.emotionEnv.value * this.emotionEnv.attackMs;
    } else {
      this.emotionEnv.phase = 'hold';
      this.emotionEnv.timerMs = 0;
    }
  }

  public triggerFluster(holdMs = 1650): void {
    const fallback = pickEmotionForContext(
      this.boldnessLevel,
      this.currentStage,
      ++this.reactionCounter,
    );
    this.triggerEmotion(fallback, holdMs);
  }

  public setSubStage(
    stage: SubGoalStageIndex,
    celebrate = false,
    unlockEmotion?: Exclude<HeroineEmotion, 'neutral'>,
  ): boolean {
    const nextTex = this.stageTextures[stage] ?? this.stageTextures[0];
    const stageChanged = this.currentStage !== stage || this.mesh.texture !== nextTex;
    this.currentStage = stage;
    if (stageChanged) {
      this.mesh.texture = nextTex;
      this.applyPosePatchGeometry();
    }
    if (celebrate) {
      this.chestVel -= 170;
      this.hipVel -= 130;
      this.chairRecoilVel += 58;
      this.triggerEmotion(
        unlockEmotion ??
          pickEmotionForContext(this.boldnessLevel, stage, ++this.reactionCounter),
        2800,
      );
    }
    return stageChanged || celebrate;
  }

  public update(dtMs: number): void {
    const clampedDtMs = Math.min(50, Math.max(0, dtMs));
    const dt = clampedDtMs / 1000;
    this.elapsedSec += dt;

    // 1. Spontaneous micro-expressions while streaming live!
    this.nextAmbientMicroExprMs -= clampedDtMs;
    if (this.nextAmbientMicroExprMs <= 0) {
      if (this.emotionEnv.phase === 'idle') {
        const idleEmo =
          this.boldnessLevel < 30 ? 'shy' : this.boldnessLevel < 65 ? 'tease' : 'bold';
        this.triggerEmotion(idleEmo, 1300);
      }
      this.nextAmbientMicroExprMs = 6500 + Math.random() * 5500;
    }

    // 2. Natural blink scheduler
    this.nextBlinkCountdownMs -= clampedDtMs;
    if (this.nextBlinkCountdownMs <= 0) {
      if (this.emotionEnv.value < 0.2) {
        this.triggerBlink();
      }
      this.nextBlinkCountdownMs = 2200 + Math.random() * 3400;
    }

    const emoAlpha = stepEnvelope(this.emotionEnv, clampedDtMs);
    const rawBlinkAlpha = stepEnvelope(this.blinkEnv, clampedDtMs);

    const targetBoldRest =
      this.boldnessLevel >= 68
        ? Math.min(0.96, (this.boldnessLevel - 68) / 26)
        : 0;
    this.boldRestSprite.alpha = targetBoldRest * (1 - emoAlpha);
    this.emotionSprite.alpha = emoAlpha;
    this.blinkSprite.alpha =
      rawBlinkAlpha * (1 - emoAlpha * 0.92) * (1 - this.boldRestSprite.alpha * 0.75);

    // 3. Damped harmonic springs
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
    [this.swayDisp, this.swayVel] = stepSpring(this.swayDisp, this.swayVel, 11.5, 0.32);
    [this.archDisp, this.archVel] = stepSpring(this.archDisp, this.archVel, 10.5, 0.36);
    [this.chairRecoilY, this.chairRecoilVel] = stepSpring(
      this.chairRecoilY,
      this.chairRecoilVel,
      20.0,
      0.4,
    );

    // Physical safety clamps so rapid multi-taps / auto-clickers stay lush & anatomical!
    this.chestVel = Math.max(-230, Math.min(230, this.chestVel));
    this.chestDisp = Math.max(-26, Math.min(26, this.chestDisp));
    this.hipVel = Math.max(-220, Math.min(220, this.hipVel));
    this.hipDisp = Math.max(-28, Math.min(28, this.hipDisp));
    this.swayVel = Math.max(-140, Math.min(140, this.swayVel));
    this.swayDisp = Math.max(-16, Math.min(16, this.swayDisp));
    this.archVel = Math.max(-170, Math.min(170, this.archVel));
    this.archDisp = Math.max(-18, Math.min(22, this.archDisp));
    this.chairRecoilVel = Math.max(-90, Math.min(90, this.chairRecoilVel));
    this.chairRecoilY = Math.max(-10, Math.min(12, this.chairRecoilY));

    if (this.shiverTimerMs > 0) {
      this.shiverTimerMs = Math.max(0, this.shiverTimerMs - clampedDtMs);
    }
    const shiverWave =
      this.shiverTimerMs > 0
        ? Math.sin(this.elapsedSec * 58) * (this.shiverTimerMs / 460) * 3.2
        : 0;

    const breathWave = Math.sin(this.elapsedSec * ((Math.PI * 2) / 3.6));
    this.bodyContainer.y = breathWave * 2.2 + this.chairRecoilY;
    this.bodyContainer.x = shiverWave * 0.65;

    const posAttr = this.mesh.geometry.getAttribute('aPosition');
    const data = posAttr.buffer.data as Float32Array;
    const rest = this.restPositions;
    const W = HeroineRig.PLATE_W;
    const H = HeroineRig.PLATE_H;
    // Sync face patch sprites with upper-body sway!
    const headSwayX = this.swayDisp * 0.72 + shiverWave * 0.45;
    const headArchY = -this.archDisp * 0.25;
    this.boldRestSprite.position.set(338 + headSwayX, 61 + headArchY);
    this.emotionSprite.position.set(338 + headSwayX, 61 + headArchY);
    this.blinkSprite.position.set(338 + headSwayX, 61 + headArchY);

    for (let i = 0; i < data.length; i += 2) {
      const rx = rest[i]!;
      const ry = rest[i + 1]!;
      const u = rx / W;
      const v = ry / H;

      let dx = 0;
      let dy = 0;

      // Upper-body seductive sway & arch (head + shoulders + torso)
      if (v < 0.68) {
        const upperWeight = Math.cos((v / 0.68) * (Math.PI * 0.5));
        dx += this.swayDisp * upperWeight;
        dy -= this.archDisp * 0.35 * upperWeight;
      }

      const cTop = 0.25;
      const cBot = 0.54;
      if (v > cTop && v < cBot && u > 0.26 && u < 0.76) {
        const wy = Math.sin(((v - cTop) / (cBot - cTop)) * Math.PI);
        const wx = Math.sin(((u - 0.26) / (0.76 - 0.26)) * Math.PI);
        const weight = wy * wx;
        const lushExpand = this.archDisp * 0.55;
        dy += (-2.8 * breathWave + this.chestDisp - lushExpand * 0.4) * weight;
        dx +=
          (u - 0.5) *
          (4.0 * (breathWave * 0.5 + 0.5) - this.chestDisp * 0.28 + lushExpand * 0.7) *
          weight;
      }

      const lTop = 0.46;
      const lBot = 0.88;
      if (v > lTop && v < lBot && u > 0.14 && u < 0.86) {
        const wy = Math.sin(((v - lTop) / (lBot - lTop)) * Math.PI);
        const wx = Math.sin(((u - 0.14) / (0.86 - 0.14)) * Math.PI);
        const weight = wy * wx;
        dy += this.hipDisp * 0.75 * weight;
        dx += ((u - 0.5) * (-this.hipDisp * 0.22) + shiverWave * 0.8) * weight;
      }

      data[i] = rx + dx;
      data[i + 1] = ry + dy;
    }
    posAttr.buffer.update();
  }

  public getDebugSnapshot() {
    return {
      subStage: this.currentStage,
      activeEmotion: this.activeEmotion,
      emotionAlpha: Number(this.emotionSprite.alpha.toFixed(3)),
      boldRestAlpha: Number(this.boldRestSprite.alpha.toFixed(3)),
      blinkAlpha: Number(this.blinkSprite.alpha.toFixed(3)),
      chestDisp: Number(this.chestDisp.toFixed(2)),
    };
  }
}

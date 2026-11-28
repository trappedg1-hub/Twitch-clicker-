/** Which day's plate ladder the rig is currently showing. */
export type WardrobeDay = 1 | 2 | 3 | 4 | 5 | 6;

import {
  Container,
  FederatedPointerEvent,
  Graphics,
  MeshPlane,
  Sprite,
  Texture,
} from 'pixi.js';
import { BREATH_PERIOD_SEC, poseBackSwayOffset, poseBreathOffset, poseTapOffset, tapReactionWave } from './poseBreathing.ts';
import { anatomyFor } from './poseAnatomy.ts';
import { pickEmotionForContext } from '../domain/dialogue.ts';
import type {
  HeroineEmotion,
  SubGoalStageIndex,
  TapZoneId,
} from '../domain/types.ts';
import {
  CANONICAL_FACE,
  FACE_PATCH_COVERED_PLATES,
  faceAnchorFor,
  type FaceAnchor,
} from './faceAnchors.ts';

export interface HeroineTextures {
  stages: readonly [Texture, Texture, Texture, Texture, Texture];
  blink: Texture;
  shy: Texture;
  fluster: Texture;
  tease: Texture;
  bold: Texture;
  /** Day 2 Sub Goal ladder plates (stages 0..4): hoodie tee-knot camisole bralette. */
  day2Stages?: Texture[];
  /** Cosplay ladder (Day 3). Optional: the rig falls back to Day 2 plates while it is being cut. */
  day3Stages?: Texture[];
  /** Sheet-off reveal plate used for the Day 3 «Бу!» flash frame. */
  ghostFlash?: Texture[];
  /** Yoga ladder (Day 4): four poses, one knit kit. Optional until heroine_t4_s0..s3 ship. */
  day4Stages?: Texture[];
  /** «Готово?» reveal plate used for the Day 4 flash frame. */
  yogaFlash?: Texture[];
  /**
   * Bikini ladder (Day 5): four frames, one costume, no reveal plate. Optional until heroine_t5_s0..s3
   * ship — and deliberately WITHOUT a `day5Flash`: Day 5's reveal is the ladder itself, so there is no
   * single frame to crossfade to, and inventing one would put unapproved art on screen.
   */
  day5Stages?: Texture[];
  day6Stages?: Texture[];
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

  private stageTextures: Texture[];

  private readonly day1Stages: readonly Texture[];
  private readonly day2Textures: Texture[];
  /** Cosplay plates (heroine_t3_s0..s4) - `null` until that art actually ships. */
  private readonly day3Textures: Texture[] | null;

  /** Yoga plates (heroine_t4_s0..s3) - `null` until that art actually ships. */
  private readonly day4Textures: Texture[] | null;
  /** Day 5 (bikini stream) plates; null until all four ship. No flash plate exists for this day. */
  private readonly day5Textures: Texture[] | null = null;
  private readonly day6Textures: Texture[] | null = null;
  private readonly reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  /** Day 4 «Готово!» flash frame: the finale reveal plate, same crossfade machinery as Day 3. */
  private readonly yogaFlashTex: Texture | null = null;

  /** Day 3 «Бу!» flash frame: the sheet-off reveal plate, crossfaded in for a few hundred ms. */
  private readonly ghostFlashTex: Texture | null = null;
  private ghostFlashUntilMs = 0;
  private ghostFloatSeed = 0;

  private wardrobeDay: WardrobeDay = 1;

  /** Where the canonical emotion/blink patch content lands on the CURRENT plate. */
  private faceBox: FaceAnchor = CANONICAL_FACE;
  /** Day 3: while a costume layer covers her face, the blush/blink/emotion patches stay off. */
  private facePatchesHidden = false;
  /** False while the authored skeleton owns the picture — see `setPlateVisible`. */
  private _plateVisible = true;
  private readonly emotionTextures: Record<Exclude<HeroineEmotion, 'neutral'>, Texture>;
  private readonly uprightBlinkTex: Texture;

  private currentStage: SubGoalStageIndex = 0;
  private activeEmotion: Exclude<HeroineEmotion, 'neutral'> = 'shy';
  private boldnessLevel = 0;
  private reactionCounter = 0;
  private nextAmbientMicroExprMs = 5200;

  /**
   * Hide the flat plate without stopping it.
   *
   * The authored skeleton (`LiveHeroine`) is drawn in the same slot and takes over the picture;
   * the old renderer keeps ticking underneath so that switching back — a plate with no rig, a
   * flash frame, a load failure — is instant and never shows a half-built heroine.
   */
  /** True while the flat plate is drawn. The stage uses this as an invariant, see `StreamStage.tick`. */
  public get plateVisible(): boolean {
    return this._plateVisible;
  }

  public setPlateVisible(visible: boolean): void {
    // Only the PICTURE goes away. `hitLayer` lives in the same container and carries the tap
    // zones — hiding the container would make the whole clicker stop responding to taps on her,
    // which is the one thing this screen must do.
    this._plateVisible = visible;
    this.mesh.visible = visible;
    this.boldRestSprite.visible = visible;
    this.emotionSprite.visible = visible;
    this.blinkSprite.visible = visible;
    if (!visible) {
      // `visible` is not enough on its own: this class keeps writing these three every frame —
      // the procedural blink fires on its own countdown, the blush follows boldness — and
      // `applyPosePatchGeometry` sets `boldRestSprite.visible = true` again on a plate swap. A
      // pasted blush or a plate-era blink drawn over the authored skeleton is exactly the "red
      // square" and the "blinking over her eyebrows" a player sees. So the flag is checked in
      // the writers, not just here.
      this.boldRestSprite.alpha = 0;
      this.emotionSprite.alpha = 0;
      this.blinkSprite.alpha = 0;
    }
  }

  public static readonly PLATE_W = 1024;
  public static readonly PLATE_H = 1526;
  private static readonly SEG_X = 24;
  private static readonly SEG_Y = 32;

  private elapsedSec = 0;
  private tapReactionStartedMs = -Infinity;
  private tapReactionZone: TapZoneId = 'chest';
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

  /**
   * Pointer is resting on her body (or has left it). Sent from the same hit zones that take the
   * taps, so "on her" means the same thing to the gaze, the cursor and the click.
   */
  public onZoneHover?: (zone: TapZoneId | null) => void;

  public onZoneTap?: (
    zone: TapZoneId,
    globalPoint: { x: number; y: number },
  ) => void;

  constructor(textures: HeroineTextures) {
    this.day1Stages = [...textures.stages];
    this.stageTextures = [...textures.stages];
    this.day2Textures = textures.day2Stages && textures.day2Stages.length === textures.stages.length
      ? [...textures.day2Stages]
      : [...textures.stages];
    this.day3Textures =
      textures.day3Stages && textures.day3Stages.length === textures.stages.length
        ? [...textures.day3Stages]
        : null;
    // Day 4 has a SHORTER ladder (4 frames: opener + three poses), so the check is `>= 4`, not
    // "same length as Day 1": indexing past the end of it is handled by the `?? stage 0` fallbacks.
    this.day4Textures =
      textures.day4Stages && textures.day4Stages.length >= 4 ? [...textures.day4Stages] : null;
    this.day6Textures = textures.day6Stages && textures.day6Stages.length >= 4 ? [...textures.day6Stages] : null;
    this.day5Textures =
      textures.day5Stages && textures.day5Stages.length >= 4 ? [...textures.day5Stages] : null;
    this.ghostFlashTex = textures.ghostFlash && textures.ghostFlash.length > 0
      ? textures.ghostFlash[0]!
      : null;
    this.yogaFlashTex = textures.yogaFlash && textures.yogaFlash.length > 0
      ? textures.yogaFlash[0]!
      : null;
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
    this.boldRestSprite.position.set(CANONICAL_FACE.x, CANONICAL_FACE.y);
    this.boldRestSprite.width = CANONICAL_FACE.w;
    this.boldRestSprite.height = CANONICAL_FACE.h;
    this.boldRestSprite.alpha = 0;
    this.bodyContainer.addChild(this.boldRestSprite);

    // Subpixel-registered active emotion patch
    this.emotionSprite = new Sprite(textures.shy);
    this.emotionSprite.position.set(CANONICAL_FACE.x, CANONICAL_FACE.y);
    this.emotionSprite.width = CANONICAL_FACE.w;
    this.emotionSprite.height = CANONICAL_FACE.h;
    this.emotionSprite.alpha = 0;
    this.bodyContainer.addChild(this.emotionSprite);

    this.blinkSprite = new Sprite(textures.blink);
    this.blinkSprite.position.set(CANONICAL_FACE.x, CANONICAL_FACE.y);
    this.blinkSprite.width = CANONICAL_FACE.w;
    this.blinkSprite.height = CANONICAL_FACE.h;
    this.blinkSprite.alpha = 0;
    this.bodyContainer.addChild(this.blinkSprite);

    this.bodyContainer.addChild(this.hitLayer);
    this.rebuildHitZones();
  }

  private applyPosePatchGeometry(): void {
    const box = this.faceBox;
    const apply = (sprite: Sprite, texture: Texture): void => {
      sprite.texture = texture;
      sprite.position.set(box.x, box.y);
      sprite.width = box.w;
      sprite.height = box.h;
    };
    apply(this.emotionSprite, this.emotionTextures[this.activeEmotion]);
    apply(this.blinkSprite, this.uprightBlinkTex);
    apply(this.boldRestSprite, this.emotionTextures.bold);
    this.boldRestSprite.visible = this._plateVisible;
  }

  /**
   * Keep the blush / blink / smirk patches glued to her real eyes. The leaning Day 2 plates
   * (straps down at 2500, kneeling at 5000) draw her head bigger and higher than the canonical
   * plate, so a fixed box drops the patches onto her neck. Boxes are measured off the plates.
   */
  public setFaceAnchorFor(plateName: string): void {
    const next = faceAnchorFor(plateName);
    const hidden = FACE_PATCH_COVERED_PLATES.has(plateName);
    if (hidden !== this.facePatchesHidden) {
      this.facePatchesHidden = hidden;
      if (hidden) {
        // A sheet with scissor-cut holes is on her face: a pasted blush or a blinking eye would
        // float on the fabric, so the patches fade out until the plate shows her again.
        this.emotionSprite.alpha = 0;
        this.blinkSprite.alpha = 0;
        this.boldRestSprite.alpha = 0;
      }
    }
    if (
      next.x === this.faceBox.x &&
      next.y === this.faceBox.y &&
      next.w === this.faceBox.w &&
      next.h === this.faceBox.h
    ) {
      return;
    }
    this.faceBox = next;
    this.applyPosePatchGeometry();
  }

  /** QA/debug: true while a costume layer hides her face (Day 3 sheet stages). */
  public facePatchesHiddenDebug(): boolean {
    return this.facePatchesHidden;
  }

  /**
   * QA: the centre of a hit zone in canvas pixels. The zones are the same rectangles the player's
   * finger hits, so a script that moves a real mouse to this point is testing the real hit test —
   * which is the only way to prove that "cursor resting on her" fires where a player would try it.
   */
  public zoneCenterScreen(zone: TapZoneId): { x: number; y: number } | null {
    const g = this.hitLayer.children.find((c) => c.label === zone);
    if (!g) return null;
    const b = g.getBounds();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }

  /** QA/debug: the patch box currently in use (plate pixels). */
  public getFaceAnchorDebug(): FaceAnchor {
    return { ...this.faceBox };
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

    // Zones overlap slightly at their seams; count them instead of trusting a single `pointerout`,
    // or crossing the shoulder line would read as "left her body" for one frame.
    const hovered = new Set<TapZoneId>();
    const markHover = (id: TapZoneId, on: boolean) => {
      const was = hovered.size > 0;
      if (on) hovered.add(id);
      else hovered.delete(id);
      const now = hovered.size > 0;
      if (now !== was) this.onZoneHover?.(now ? (zones.find((z) => hovered.has(z.id))?.id ?? null) : null);
    };

    for (const z of zones) {
      const g = new Graphics();
      g.rect(z.x, z.y, z.w, z.h).fill({ color: 0xffffff, alpha: 0.001 });
      g.label = z.id;
      g.eventMode = 'static';
      g.cursor = 'pointer';
      g.on('pointerover', () => markHover(z.id, true));
      g.on('pointerout', () => markHover(z.id, false));
      g.on('pointerdown', (ev: FederatedPointerEvent) => {
        ev.stopPropagation();
        this.triggerTapReaction(z.id);
        this.onZoneTap?.(z.id, { x: ev.global.x, y: ev.global.y });
      });
      this.hitLayer.addChild(g);
    }
  }

  /**
   * Day 2 swaps the WHOLE plate ladder (her own 1500/2000/2500/5000 goals) while every purchased
   * upgrade stays on the desk. Day 2 starts with the closed everyday look: oversize beige pullover
   * hoodie, shorts, black golf socks with two white stripes.
   */
  public setWardrobeDay(day: WardrobeDay): void {
    if (this.wardrobeDay === day) return;
    this.wardrobeDay = day;
    // Day 3 (cosplay) reuses the Day 2 plate ladder until heroine_t3_s0..s4 are cut, so the rig
    // never shows a missing texture; the plate swap happens in one place, right here.
    this.stageTextures =
      day === 1
        ? [...this.day1Stages]
        : day === 6 && this.day6Textures
          ? [...this.day6Textures]
        : day === 5 && this.day5Textures
          ? [...this.day5Textures]
          : day === 4 && this.day4Textures
          ? [...this.day4Textures]
          : day === 3 && this.day3Textures
            ? [...this.day3Textures]
            : [...this.day2Textures];
    const nextTex = this.stageTextures[this.currentStage] ?? this.stageTextures[0]!;
    if (this.mesh.texture !== nextTex) {
      this.mesh.texture = nextTex;
      this.applyPosePatchGeometry();
      this.triggerEmotion(
        day === 1 ? 'shy' : day === 3 || day === 4 || day === 5 || day === 6 ? 'bold' : 'fluster',
        2400,
      );
    }
  }

  /** QA/debug: which Sub Goal stage plate is on screen right now (0..4). */
  public getStageIndex(): SubGoalStageIndex {
    return this.currentStage;
  }

  /**
   * Day 3 tap gimmick: the sheet "flies up" for a beat by crossfading to the reveal plate.
   * Returns false when the ghost day is not on screen (or the flash plate has not shipped), so the
   * caller can skip the flash-specific chat/callout noise on other days.
   */
  public triggerGhostBoo(durationMs = 520): boolean {
    // Day 5 has no flash plate at all (`DAY5_FLASH_PLATE === null`), so the crossfade machinery is not
    // borrowed this time: `false` tells the caller to skip the flash-specific callout and chat burst.
    if (this.wardrobeDay === 5 || this.wardrobeDay === 6) return false;
    // Day 4 owns the same crossfade machinery for its «Готово?» beat: one flash plate, one timer.
    if (this.wardrobeDay === 4) return this.flashTo(this.yogaFlashTex, durationMs);
    if (this.wardrobeDay !== 3 || !this.ghostFlashTex) return false;
    return this.flashTo(this.ghostFlashTex, durationMs);
  }

  /** Swap to a reveal plate for a beat; the update loop snaps back to the current stage plate. */
  private flashTo(tex: Texture | null, durationMs: number): boolean {
    if (!tex) return false;
    this.ghostFlashUntilMs = this.elapsedSec * 1000 + Math.max(160, durationMs);
    this.ghostFloatSeed += 1;
    if (this.mesh.texture !== tex) {
      this.mesh.texture = tex;
      this.applyPosePatchGeometry();
    }
    return true;
  }

  public hasGhostFlash(): boolean {
    return this.ghostFlashTex !== null || this.yogaFlashTex !== null;
  }

  public isGhostFlashing(): boolean {
    return this.ghostFlashUntilMs > 0;
  }

  /** True once the cosplay plates exist; Day 3 falls back to the Day 2 ladder until then. */
  public hasDay3Plates(): boolean {
    return this.day3Textures !== null;
  }

  /** True once the yoga plates exist; Day 4 falls back to the Day 2 ladder until then. */
  public hasDay4Plates(): boolean {
    return this.day4Textures !== null;
  }

  /** True once all four bikini plates exist; Day 5 falls back to the Day 2 ladder until then. */
  public hasDay5Plates(): boolean {
    return this.day5Textures !== null;
  }

  /** Which plate ladder is actually on screen (Day 3/4 = Day 2 art until their plates ship). */
  public hasDay6Plates(): boolean { return this.day6Textures !== null; }

  public getPlateDay(): 1 | 2 | 3 | 4 | 5 | 6 {
    if (this.wardrobeDay === 6 && !this.day6Textures) return 2;
    if (this.wardrobeDay === 5 && !this.day5Textures) return 2;
    if (this.wardrobeDay === 4 && !this.day4Textures) return 2;
    return this.wardrobeDay === 3 && !this.day3Textures ? 2 : this.wardrobeDay;
  }

  public getWardrobeDay(): WardrobeDay {
    return this.wardrobeDay;
  }

  public isWearingDay2Outfit(): boolean {
    return this.wardrobeDay === 2 && this.currentStage === 0;
  }

  public setBoldness(boldness: number): void {
    this.boldnessLevel = Math.max(0, Math.min(100, boldness));
  }

  public triggerTapReaction(
    zone: TapZoneId,
    forcedEmotion?: Exclude<HeroineEmotion, 'neutral'>,
  ): void {
    this.reactionCounter += 1;
    this.tapReactionZone = zone;
    this.tapReactionStartedMs = this.elapsedSec * 1000;
    this.triggerEmotion(forcedEmotion ?? pickEmotionForContext(this.boldnessLevel, this.currentStage, this.reactionCounter), 1650);
  }

  public triggerArchStretch(emo: Exclude<HeroineEmotion, 'neutral'> = 'bold'): void {
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
    const nextTex = this.stageTextures[stage] ?? this.stageTextures[0]!;
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
    // The live skeleton draws its own blink and its own blush. Anything this class paints on her
    // face would land on top of it at a plate-era position, so the gate is closed for both reasons.
    const patchGate = this.facePatchesHidden || !this._plateVisible ? 0 : 1;
    this.boldRestSprite.alpha = targetBoldRest * (1 - emoAlpha) * patchGate;
    this.emotionSprite.alpha = emoAlpha * patchGate;
    this.blinkSprite.alpha =
      rawBlinkAlpha * (1 - emoAlpha * 0.92) * (1 - this.boldRestSprite.alpha * 0.75) * patchGate;

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


    // Day 3: when the «Бу!» flash is over, snap back to the current sheet stage.
    if (this.ghostFlashUntilMs > 0 && this.elapsedSec * 1000 >= this.ghostFlashUntilMs) {
      this.ghostFlashUntilMs = 0;
      const back = this.stageTextures[this.currentStage] ?? this.stageTextures[0]!;
      if (this.mesh.texture !== back) {
        this.mesh.texture = back;
        this.applyPosePatchGeometry();
      }
    }

    const breathWave = Math.sin(this.elapsedSec * ((Math.PI * 2) / BREATH_PERIOD_SEC));
    // A second, slower clock: the weight shift of the one rear-view pose has to be able to drift
    // against the breath, or the two lock into a single wobble and read as a machine.
    const swayWave = Math.sin(this.elapsedSec * ((Math.PI * 2) / 7.6) + 0.9);
    // Fixed plate transform: never move the chair, including during taps and unlocks.
    this.bodyContainer.position.set(0, 0);
    const posAttr = this.mesh.geometry.getAttribute('aPosition');
    const data = posAttr.buffer.data as Float32Array;
    this.boldRestSprite.position.set(this.faceBox.x, this.faceBox.y);
    this.emotionSprite.position.set(this.faceBox.x, this.faceBox.y);
    this.blinkSprite.position.set(this.faceBox.x, this.faceBox.y);
    const motionOff = this.reducedMotion?.matches || this.ghostFlashUntilMs > 0;
    const tapWave = motionOff ? 0 : tapReactionWave(this.elapsedSec * 1000 - this.tapReactionStartedMs, this.wardrobeDay);
    for (let i = 0; i < data.length; i += 2) {
      const rx = this.restPositions[i]!;
      const ry = this.restPositions[i + 1]!;
      const breath = poseBreathOffset(this.wardrobeDay, this.currentStage, rx, ry, motionOff ? 0 : breathWave);
      const tap = poseTapOffset(this.wardrobeDay, this.currentStage, this.tapReactionZone, rx, ry, tapWave);
      const sway = poseBackSwayOffset(this.wardrobeDay, this.currentStage, rx, ry, motionOff ? 0 : swayWave);
      data[i] = rx + breath.x + tap.x + sway.x;
      data[i + 1] = ry + breath.y + tap.y + sway.y;
    }
    posAttr.buffer.update();
  }

  public getDebugSnapshot() {
    const positions = this.mesh.geometry.getAttribute('aPosition').buffer.data as Float32Array;
    let torsoMovement = 0;
    let chairMovement = 0;
    let tapMovement = 0;
    const tapWave = this.reducedMotion?.matches || this.ghostFlashUntilMs > 0 ? 0 : tapReactionWave(this.elapsedSec * 1000 - this.tapReactionStartedMs, this.wardrobeDay);
    for (let i = 0; i < positions.length; i += 2) {
      const x = this.restPositions[i]!;
      const y = this.restPositions[i + 1]!;
      const moved = Math.hypot(positions[i]! - x, positions[i + 1]! - y);
      const tap = poseTapOffset(this.wardrobeDay, this.currentStage, this.tapReactionZone, x, y, tapWave);
      tapMovement = Math.max(tapMovement, Math.hypot(tap.x, tap.y));
      // Historical broad heuristic: limbs can also occur in this area, so this is
      // not a segmentation mask and cannot prove the chair pixels are stationary.
      if (x < 300 || x > 760 || y > 900) chairMovement = Math.max(chairMovement, moved);
      else torsoMovement = Math.max(torsoMovement, moved);
    }
    return {
      subStage: this.currentStage,
      activeEmotion: this.activeEmotion,
      emotionAlpha: Number(this.emotionSprite.alpha.toFixed(3)),
      boldRestAlpha: Number(this.boldRestSprite.alpha.toFixed(3)),
      blinkAlpha: Number(this.blinkSprite.alpha.toFixed(3)),
      facePatchesHidden: this.facePatchesHidden,
      chestDisp: Number(this.chestDisp.toFixed(2)),
      bodyX: this.bodyContainer.x,
      bodyY: this.bodyContainer.y,
      bodyScaleX: this.bodyContainer.scale.x,
      bodyScaleY: this.bodyContainer.scale.y,
      bodyRotation: this.bodyContainer.rotation,
      torsoMovement,
      tapWave,
      tapMovement,
      tapZone: this.tapReactionZone,
      tapRegion: this.tapReactionZone === 'legs' || this.tapReactionZone === 'feet' ? 'leg' : anatomyFor(this.wardrobeDay, this.currentStage).torsoKind,
      chairMovement,
    };
  }
}

import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from 'pixi.js';
import type {
  HeroineEmotion,
  SubGoalStageIndex,
  TapZoneId,
} from '../domain/types.ts';
import { DAY3_FLASH_PLATE, DAY4_FLASH_PLATE, DAY5_FLASH_PLATE, DAY6_FLASH_PLATE, getSubGoalStagesForDay } from '../domain/subGoals.ts';
import { HeroineRig } from './HeroineRig.ts';
import { LiveHeroine, type QuirkKind } from './LiveHeroine.ts';
import { pickBeat, type BeatName } from './reactionDirector.ts';
import { pickAttention, type AttentionKind } from './attention.ts';
import { BlushLayer } from './blushLayer.ts';
import { HEAT } from './blush.ts';
import { aimFromPointer } from './gaze.ts';

interface FloatingParticle {
  node: Container;
  vx: number;
  vy: number;
  lifeMs: number;
  maxLifeMs: number;
}

interface DustMote {
  node: Graphics;
  baseX: number;
  baseY: number;
  speedY: number;
  phase: number;
}

export class StreamStage {
  public static readonly VIRTUAL_W = 1376;
  public static readonly VIRTUAL_H = 768;

  // Desk microphone placement: planted ON THE WOOD at the RIGHT EDGE of Miya's desk
  // (exactly where the baked-in studio mic used to sit). It may clip off the frame on
  // narrow mobile portrait — that is intentional: the mic must rest on the plank and
  // NEVER float in front of her legs.
  public static readonly MIC_X = 1245;
  /**
   * The foreground plank's top edge sits at y=708 in virtual space (measured off fg_desk_t1: the
   * wood starts at row 705..709 across the whole right half). A base lower than that buried the
   * mic behind the desk front and made it look like it stood on the floor, so the feet of the rig
   - and its contact shadow - land right on that edge.
   */
  public static readonly MIC_BASE_Y = 708;
  /** Compact desk mic: small enough that it can never shield her, even at the finale plates. */
  public static readonly MIC_HEIGHT = 148;
  /** How much of the mic stays inside the frame when the right desk corner is cropped (mobile). */
  public static readonly MIC_VISIBLE_FRACTION = 0.48;

  public app!: Application;
  public rig!: HeroineRig;
  /** The authored skeleton, when the plate on screen has one. Always behind `rig.view`'s plate. */
  public live!: LiveHeroine;

  private readonly root = new Container();
  private bgSprite!: Sprite;
  private lampGlow = new Graphics();
  private feverGlow = new Graphics();
  private chairShadow = new Graphics();
  private fgDeskSprite!: Sprite;
  private deskMicSprite!: Sprite;
  private deskMicShadow = new Graphics();
  private readonly micHolder = new Container();
  private micTextures: Texture[] = [];
  private micTier = 0;
  private micPopT = 1;
  private readonly dustLayer = new Container();
  private readonly fxLayer = new Container();

  private readonly particles: FloatingParticle[] = [];
  private activeCalloutParticle?: FloatingParticle;
  private readonly motes: DustMote[] = [];
  /** Has the pointer ever been over the stage? On a phone, never — she looks straight ahead. */
  private pointerSeen = false;
  private pointerNormX = 0;
  private pointerNormY = 0;
  private lampLevel = 0;
  private hypeLevel = 0;
  private drawerOpen = false;
  private hostEl?: HTMLElement;
  private elapsedSec = 0;
  private resizeObserver?: ResizeObserver;

  public onHeroineTap?: (zone: TapZoneId) => { earned: number; alert: boolean };

  public async mount(hostEl: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      preference: 'webgl',
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      roundPixels: false,
      resolution: Math.min(window.devicePixelRatio || 1, 3),
      width: Math.max(320, hostEl.clientWidth || 960),
      height: Math.max(180, hostEl.clientHeight || 540),
    });

    hostEl.innerHTML = '';
    hostEl.appendChild(this.app.canvas);
    this.app.stage.addChild(this.root);

    const [
      bgTex,
      s0Tex,
      s1Tex,
      s2Tex,
      s3Tex,
      s4Tex,
      blinkTex,
      shyTex,
      flusterTex,
      teaseTex,
      boldTex,
      fgDeskTex,
      micT1Tex,
      micT2Tex,
      micT3Tex,
      micT4Tex,
      micT5Tex,
      micT6Tex,
      micT7Tex,
      micT8Tex,
      micT9Tex,
      micT10Tex,
    ] = await Promise.all([
      Assets.load<Texture>('/art/bg_room_t1.webp'),
      Assets.load<Texture>('/art/heroine_t1_s0.webp'),
      Assets.load<Texture>('/art/heroine_t1_s1.webp'),
      Assets.load<Texture>('/art/heroine_t1_s2.webp'),
      Assets.load<Texture>('/art/heroine_t1_base.webp'),
      Assets.load<Texture>('/art/heroine_t1_s4.webp'),
      Assets.load<Texture>('/art/patch_t1_blink.webp'),
      Assets.load<Texture>('/art/patch_t1_shy.webp'),
      Assets.load<Texture>('/art/patch_t1_fluster.webp'),
      Assets.load<Texture>('/art/patch_t1_tease.webp'),
      Assets.load<Texture>('/art/patch_t1_bold.webp'),
      Assets.load<Texture>('/art/fg_desk_t1.webp'),
      Assets.load<Texture>('/art/mics/mic_t1.webp'),
      Assets.load<Texture>('/art/mics/mic_t2.webp'),
      Assets.load<Texture>('/art/mics/mic_t3.webp'),
      Assets.load<Texture>('/art/mics/mic_t4.webp'),
      Assets.load<Texture>('/art/mics/mic_t5.webp'),
      Assets.load<Texture>('/art/mics/mic_t6.webp'),
      Assets.load<Texture>('/art/mics/mic_t7.webp'),
      Assets.load<Texture>('/art/mics/mic_t8.webp'),
      Assets.load<Texture>('/art/mics/mic_t9.webp'),
      Assets.load<Texture>('/art/mics/mic_t10.webp'),
    ]);

    // The whole Day 2 ladder (5 plates) loads separately so the tuple types above stay exact.
    const day2StagesTex = await Promise.all(
      getSubGoalStagesForDay(2).map((def) => Assets.load<Texture>(def.plateUrl)),
    );

    // Day 3 cosplay plates are cut last: probe the ladder and load it only when every file exists,
    // otherwise the rig keeps reusing the Day 2 art (a 404 texture would break the whole boot).
    // A missing file still answers 200 with the SPA index.html in dev, so the content type decides.
    // One loader for both late days: Day 3 (cosplay) and Day 4 (yoga) are cut after the boot ladder and
    // may legitimately not exist yet - in that case the rig keeps the Day 2 art instead of 404-ing.
    const loadLadder = async (
      day: 3 | 4 | 5 | 6,
      flashPlate: string | null,
    ): Promise<{ stages?: Texture[]; flash?: Texture }> => {
      const defs = getSubGoalStagesForDay(day);
      const heads = await Promise.all(
        defs.map((def) =>
          fetch(def.plateUrl, { method: 'HEAD' })
            .then((res) => res.ok && (res.headers.get('content-type') ?? '').startsWith('image/'))
            .catch(() => false),
        ),
      );
      if (!heads.every(Boolean)) return {};
      try {
        const loaded = await Promise.all(defs.map((def) => Assets.load<Texture>(def.plateUrl)));
        if (!loaded.every((tex) => Boolean(tex))) return {};
        // Day 5 opts out of the flash frame (`flashPlate === null`), so nothing is fetched for it and
        // the rig never swaps to a reveal plate nobody drew.
        const flash = flashPlate
          ? await Assets.load<Texture>(flashPlate).catch(() => undefined)
          : undefined;
        return { stages: loaded, flash: flash ?? undefined };
      } catch {
        return {}; // decode failed - the Day 2 ladder keeps the rig alive
      }
    };
    const [ghostLadder, yogaLadder, bikiniLadder, villageLadder] = await Promise.all([
      loadLadder(3, DAY3_FLASH_PLATE),
      loadLadder(4, DAY4_FLASH_PLATE),
      loadLadder(5, DAY5_FLASH_PLATE),
      loadLadder(6, DAY6_FLASH_PLATE),
    ]);
    const day3StagesTex = ghostLadder.stages;
    const ghostFlashTex = ghostLadder.flash;
    const day4StagesTex = yogaLadder.stages;
    const yogaFlashTex = yogaLadder.flash;
    const day5StagesTex = bikiniLadder.stages;

    // Layer 0: Tier 1 Starter Bedroom (webcam POV)
    this.bgSprite = new Sprite(bgTex);
    this.bgSprite.width = StreamStage.VIRTUAL_W + 24;
    this.bgSprite.height = StreamStage.VIRTUAL_H + 16;
    this.bgSprite.position.set(-12, -8);
    this.root.addChild(this.bgSprite);

    // Warm upgradeable ring-light glow over center
    this.lampGlow
      .circle(StreamStage.VIRTUAL_W * 0.5, StreamStage.VIRTUAL_H * 0.34, 390)
      .fill({ color: 0xffd6ec, alpha: 1 });
    this.lampGlow.alpha = 0.03;
    this.root.addChild(this.lampGlow);

    // Hot pink/magenta fanservice fever aura when chat hype surges!
    this.feverGlow
      .circle(StreamStage.VIRTUAL_W * 0.5, StreamStage.VIRTUAL_H * 0.42, 430)
      .fill({ color: 0xff3b9a, alpha: 1 });
    this.feverGlow.alpha = 0;
    this.root.addChild(this.feverGlow);

    // Ambient dust motes in warm floor-lamp light
    this.root.addChild(this.dustLayer);
    for (let i = 0; i < 18; i++) {
      const g = new Graphics();
      const radius = 1.4 + (i % 3) * 0.8;
      g.circle(0, 0, radius).fill({ color: 0xffe6c7, alpha: 0.28 });
      const baseX = 120 + ((i * 73) % 1140);
      const baseY = 70 + ((i * 59) % 590);
      g.position.set(baseX, baseY);
      this.dustLayer.addChild(g);
      this.motes.push({
        node: g,
        baseX,
        baseY,
        speedY: 7 + (i % 5) * 3,
        phase: i * 0.7,
      });
    }

    // Soft grounding shadow on the white rug behind/under office chair
    this.chairShadow
      .ellipse(StreamStage.VIRTUAL_W * 0.5, 690, 210, 36)
      .fill({ color: 0x1a1118, alpha: 0.36 });
    this.root.addChild(this.chairShadow);

    // Layer 1: Heroine Rig (5 Sub Goal stages 0..4 — Day 1 finale at 500 subs!)
    this.rig = new HeroineRig({
      stages: [s0Tex, s1Tex, s2Tex, s3Tex, s4Tex],
      blink: blinkTex,
      shy: shyTex,
      fluster: flusterTex,
      tease: teaseTex,
      bold: boldTex,
      day2Stages: day2StagesTex,
      day3Stages: day3StagesTex,
      ghostFlash: ghostFlashTex ? [ghostFlashTex] : undefined,
      day4Stages: day4StagesTex,
      yogaFlash: yogaFlashTex ? [yogaFlashTex] : undefined,
      day5Stages: day5StagesTex,
      day6Stages: villageLadder.stages,
    });
    // The heroine is the product: she takes the full stage height with a hair of margin.
    // 724/768 was 94% of the frame; this is 98.4%, and the 6px offset keeps her head off the edge.
    const heroScale = (StreamStage.VIRTUAL_H - 12) / HeroineRig.PLATE_H;
    this.rig.view.scale.set(heroScale);
    this.rig.view.position.set(
      (StreamStage.VIRTUAL_W - HeroineRig.PLATE_W * heroScale) * 0.5,
      6,
    );
    this.root.addChild(this.rig.view);

    // The authored skeleton lives INSIDE `rig.view` so it inherits her placement, her scale and
    // her z-order for free — the desk still cuts across her, the chair shadow still sits behind.
    // Plate pixels, unit scale: the rig document is authored on the 1024x1526 canvas.
    this.live = new LiveHeroine();
    this.rig.view.addChild(this.live.view);
    // A broken skeleton is a broken ornament, never a broken game: the moment it throws, the flat
    // plate comes back and the console says why (see `onLiveFault` in bootstrap).
    this.live.onQuirk = (kind) => this.onLiveQuirk?.(kind);
    this.live.attachOverlay(this.blush.container);
    this.live.onFault = (reason) => {
      this.liveEnabled = false;
      this.rig?.setPlateVisible(true);
      this.onLiveFault?.(reason);
    };
    // `?rig=0` — the escape hatch that needs no deploy: flat plates, exactly as before the rig.
    this.liveEnabled = new URLSearchParams(window.location.search).get('rig') !== '0';
    void this.syncLiveHeroine();

    // HUD safe zone: `?hudsafe=1` outlines the exact screen column the character owns, so a
    // hud element that reaches into her silhouette is obvious in one glance. Debug only.
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("hudsafe")) {
      const zone = new Graphics();
      zone
        .rect(
          this.rig.view.position.x,
          this.rig.view.position.y,
          HeroineRig.PLATE_W * heroScale,
          HeroineRig.PLATE_H * heroScale,
        )
        .stroke({ color: 0x2bff9e, width: 2, alpha: 0.9 });
      this.root.addChild(zone);
    }

    // Day 2 plates frame her head differently - glue the patches on before the first render.
    this.rig.setFaceAnchorFor(this.getActivePlateName());

    // Layer 2: Foreground Desk Edge + Cat Tea Mug + USB Microphone (3D depth overlap over chair post!)
    this.fgDeskSprite = new Sprite(fgDeskTex);
    this.fgDeskSprite.width = StreamStage.VIRTUAL_W + 28;
    this.fgDeskSprite.height = StreamStage.VIRTUAL_H + 12;
    this.fgDeskSprite.position.set(-14, -2);
    this.root.addChild(this.fgDeskSprite);
    // The desk stays in FRONT of the plate on purpose: she sits at the computer, so the desktop
    // edge in the near field is what sells the depth of the shot. The "nothing covers her" rule
    // applies to the HUD layer, not to the room she is sitting in.

    // Layer 2b: Desk Microphone (Tier 1..10) — appears on the wooden desk once purchased!
    this.micTextures = [micT1Tex, micT2Tex, micT3Tex, micT4Tex, micT5Tex, micT6Tex, micT7Tex, micT8Tex, micT9Tex, micT10Tex];
    // Shadow + mic share one holder so the whole rig can slide onto the visible desk edge
    // on narrow screens without ever floating above Miya's legs.
    this.deskMicShadow.ellipse(0, 3, 40, 7).fill({ color: 0x1a1118, alpha: 0.34 });
    this.deskMicShadow.visible = false;
    this.micHolder.addChild(this.deskMicShadow);
    this.deskMicSprite = new Sprite(micT1Tex);
    this.deskMicSprite.anchor.set(0.5, 1.0);
    this.deskMicSprite.height = StreamStage.MIC_HEIGHT;
    this.deskMicSprite.width = StreamStage.MIC_HEIGHT * (micT1Tex.width / micT1Tex.height);
    this.deskMicSprite.visible = false;
    this.micHolder.addChild(this.deskMicSprite);
    this.micHolder.position.set(this.micAnchorX(), StreamStage.MIC_BASE_Y);
    this.root.addChild(this.micHolder);
    // Drawn just UNDER the heroine plate: the mic pokes in from the right corner of the desk and
    // can never cover her, even when the portrait crop leaves no free strip at the edge.
    this.root.setChildIndex(this.micHolder, this.root.getChildIndex(this.rig.view) - 1);

    // Layer 3: Click Heart / Ruble Popups
    this.root.addChild(this.fxLayer);

    this.rig.onZoneTap = (zone, globalPt) => {
      const localPt = this.root.toLocal(globalPt);
      this.answerTapZone(zone, localPt.x, localPt.y);
    };
    this.wirePointer(hostEl);
  }

  /**
   * A tap on her body, answered. The one function every path goes through — the pointer, the QA
   * harness, and anything else that ever wants to tap her — so the director cannot be bypassed.
   */
  public answerTapZone(zone: TapZoneId, localX: number, localY: number): void {
    // Her answer is chosen by the director, not by a chain of `if`s here: the same tap on the same
    // cheek lands differently at boldness 20 and boldness 80, and a player who hammers her gets
    // shaken rather than nodded at. See `reactionDirector.ts` for the table and the tests.
    const streak = this.tapStreak(performance.now());
    const mood = this.reactionInput?.() ?? { boldness: 40, hype: 0 };
    const beat = pickBeat({
      zone,
      boldness: mood.boldness,
      hype: mood.hype,
      streak,
      available: this.live?.animationSet() ?? new Set<string>(),
      random: Math.random,
    });
    this.live?.react(beat.anim, beat.ms);
    this.lastBeatAt = performance.now();
    // What the director *chose*, which is not the same as what is playing: a tap that arrives
    // mid-beat is dropped by the rig, so the clip name would report the previous answer.
    this.lastTapBeat = beat.anim;
    // A tap is warmth; hammering her is more. Twenty small bumps per second add up to a flush, and
    // then it cools for the next five seconds while she catches her breath. Some beats are simply
    // hotter than others: being tickled is more embarrassing than being nodded at.
    const heat =
      beat.anim === 'tickle'
        ? HEAT.tickle
        : beat.anim === 'tease' || beat.anim === 'giggle' || beat.anim === 'shy_tuck'
          ? HEAT.tap * 1.6
          : beat.anim === 'tap'
            ? HEAT.tap * 0.4
            : HEAT.tap;
    this.blush.bump(heat);
    this.lastTapDebug = { zone, beat: beat.anim, streak, available: (this.live?.animationSet() ?? new Set()).size };
      const res = this.onHeroineTap?.(zone);
    if (res) {
      this.spawnTapBurst(localX, localY, res.earned, res.alert, zone);
    }
  }

  private wirePointer(hostEl: HTMLElement): void {
    this.rig.onZoneHover = (zone) => {
      // The pointer resting on her is a form of attention, and she answers it a second and a half
      // later — see `attention.ts`. Leaving her body resets the dwell, so passing over her on the
      // way to the shop never counts as a stare.
      this.hoverZone = zone;
      if (!zone) this.hoverSince = 0;
      else if (this.hoverSince === 0) this.hoverSince = performance.now();
    };

    const trackPointer = (e: PointerEvent) => {
      const rect = hostEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.pointerNormX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        this.pointerNormY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        this.pointerSeen = true;
      }
    };
    hostEl.addEventListener('pointermove', trackPointer);
    // A tap is also a pointer position, and on a phone it is the ONLY one there is: `pointerdown`
    // arrives before the click, so she has already turned towards the finger by the time she nods.
    hostEl.addEventListener('pointerdown', trackPointer);
    hostEl.addEventListener('pointerleave', () => {
      this.pointerSeen = false;
    });

    this.hostEl = hostEl;
    this.fitStage(hostEl);
    let rafResize = 0;
    this.resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(rafResize);
      rafResize = window.requestAnimationFrame(() => this.fitStage(hostEl));
    });
    this.resizeObserver.observe(hostEl);

    this.app.ticker.add((ticker) => {
      this.tick(ticker.deltaMS);
    });
  }

  /**
   * Right edge of the wooden plank. On narrow portrait viewports the desk is cropped,
   * so the anchor slides left just enough to keep the mic standing ON the visible wood
   * (partially clipped is fine — floating in front of her legs is not).
   */
  private micAnchorX(): number {
    const w = this.deskMicSprite ? this.deskMicSprite.width : 132;
    const bounds = this.getVisibleVirtualBounds();
    // Only a slice of it may be inside the frame; the rest hangs off the right edge. Clamping the
    // other way (pulling the mic left) is what parked it on top of Miya on portrait screens.
    const edge = bounds.right + (0.5 - StreamStage.MIC_VISIBLE_FRACTION) * w;
    return Math.min(StreamStage.MIC_X, edge);
  }

  /** QA/debug helper: where the desk mic actually stands relative to the visible frame. */
  public getDeskMicDebug(): {
    tier: number;
    x: number;
    width: number;
    visible: boolean;
    visibleLeft: number;
    visibleRight: number;
    behindHeroine: boolean;
    plate: string;
  } {
    const bounds = this.getVisibleVirtualBounds();
    return {
      tier: this.micTier,
      x: Math.round(this.micHolder.x),
      width: Math.round(this.deskMicSprite ? this.deskMicSprite.width : 0),
      visible: Boolean(this.deskMicSprite && this.deskMicSprite.visible),
      visibleLeft: Math.round(bounds.left),
      visibleRight: Math.round(bounds.right),
      behindHeroine:
        this.root.getChildIndex(this.micHolder) < this.root.getChildIndex(this.rig.view),
      plate: this.getActivePlateName(),
    };
  }

  /** QA/debug: which plate is up, and whether her face patches are suppressed on it. */
  public facePatchDebug(): { plate: string; hidden: boolean } {
    return {
      plate: this.getActivePlateName(),
      hidden: this.rig?.facePatchesHiddenDebug() ?? false,
    };
  }

  /** QA/debug: file name of the plate currently shown for the current day + stage. */
  public getActivePlateName(): string {
    const day = this.rig?.getPlateDay() ?? 1;
    const stage = this.rig?.getStageIndex() ?? 0;
    const url = getSubGoalStagesForDay(day)[stage]?.plateUrl ?? '';
    return String(url).split('/').pop() ?? '';
  }

  public setRingLampLevel(level: number): void {
    this.lampLevel = level;
  }

  public setHypeLevel(hype: number): void {
    this.hypeLevel = Math.max(0, Math.min(100, hype));
  }

  public setMicTier(level: number): void {
    const clamped = Math.max(0, Math.min(10, Math.floor(level)));
    if (clamped === this.micTier) return;
    this.micTier = clamped;
    if (!this.deskMicSprite) return;
    if (clamped <= 0) {
      this.deskMicSprite.visible = false;
      this.deskMicShadow.visible = false;
      return;
    }
    const tex = this.micTextures[clamped - 1];
    if (tex) {
      this.deskMicSprite.texture = tex;
      this.deskMicSprite.height = StreamStage.MIC_HEIGHT;
      this.deskMicSprite.width = StreamStage.MIC_HEIGHT * (tex.width / tex.height);
      this.micHolder.x = this.micAnchorX();
    }
    this.deskMicSprite.visible = true;
    this.deskMicShadow.visible = true;
    this.micPopT = 0;
    this.app?.render();
  }

  /** Swap Miya's wardrobe plate set: Day 1 canonical ladder vs Day 2 oversize-hoodie look. */
  /** True when the sheet-off reveal plate is loaded, i.e. the «Бу!» flash can actually play. */
  public hasGhostFlash(): boolean {
    return this.rig?.hasGhostFlash() ?? false;
  }

  /** True while the «Бу!» crossfade owns the mesh, i.e. the flash plate is the one on screen. */
  public isGhostFlashing(): boolean {
    return this.rig?.isGhostFlashing() ?? false;
  }

  /**
   * Day 3 «Бу!» / Day 4 «Готово?» flash frame; returns true when something actually flashed on screen.
   * The rig picks the flash plate for the live day, so a day with no flash art simply returns false.
   */
  public triggerGhostBoo(durationMs = 520): boolean {
    const played = this.rig?.triggerGhostBoo(durationMs) ?? false;
    if (played) {
      // The flash is a flat plate crossfade inside the old renderer: hand the screen back to it
      // for the length of the flash, then return to the skeleton.
      this.live.hide();
      this.rig?.setPlateVisible(true);
      window.setTimeout(() => void this.syncLiveHeroine(), durationMs + 120);
    }
    return played;
  }

  public setWardrobeDay(day: 1 | 2 | 3 | 4 | 5 | 6): void {
    this.rig?.setWardrobeDay(day);
    this.rig?.setFaceAnchorFor(this.getActivePlateName());
    void this.syncLiveHeroine();
  }

  /**
   * Point the live skeleton at whatever plate the rig is showing.
   *
   * 22 of the 41 plates have a rig; the other 19 are small or cropped faces where a blink is one
   * or two pixels and a seam is more likely than a life sign, so they keep the flat plate on
   * purpose. Either way this never throws: a missing rig is a normal outcome.
   */
  public async syncLiveHeroine(): Promise<void> {
    if (!this.liveEnabled) {
      // The admin console's A/B switch: compare the animated skeleton against the plate it was
      // built from, on the same frame. Turning it off is a promise — nothing may re-show it until
      // the switch is flipped back, so this line sits before every other path into `show()`.
      this.live.hide();
      this.rig?.setPlateVisible(true);
      return;
    }
    const plate = this.getActivePlateName();
    const art = plate.replace(/^heroine_/, '').replace(/\.webp$/, '');
    if (!art) return;
    // Ask the published index before the network: an art without a rig is a normal plate, not an
    // error, and skipping it keeps the console (and the dev server's SPA fallback) quiet.
    if (this.riggedArts && !this.riggedArts.has(art)) {
      this.live.hide();
      this.rig?.setPlateVisible(true);
      return;
    }
    const ok = await this.live.show(art);
    this.rig?.setPlateVisible(!ok);
  }

  /** Whether plates may be replaced by their rigs. Off = the flat art, exactly as before the rig. */
  public liveEnabled = true;

  /** Art keys that ship a rig, from `/rigs/index.json`. Null until the index answers. */
  public riggedArts: Set<string> | null = null;

  /** Fired when the skeleton gave up after a throw, with the reason. */
  public onLiveFault: ((reason: string) => void) | null = null;

  /** Flip the live skeleton off/on and re-settle the current plate immediately. */
  public setLiveEnabled(on: boolean): void {
    this.liveEnabled = on;
    void this.syncLiveHeroine().then(
      () => this.app?.render(),
      () => this.app?.render(),
    );
  }

  /** QA: how pink she is right now, and where the glows are. */
  public getBlushDebug(): { level: number; heat: number; at: { x: number; y: number } | null } {
    return this.blush.debug();
  }

  /** QA: is the pointer resting on her body, and since when. */
  public getHoverDebug(): { zone: string | null; since: number } {
    return { zone: this.hoverZone, since: this.hoverSince };
  }

  /** QA: which clip the live skeleton is on, and what the plate carries. */
  public getLiveDebug(): { current: string; animations: string[] } | null {
    return this.live?.debugState() ?? null;
  }

  /** Her own beats — the ones she does when the player is not doing anything. */
  public onLiveQuirk?: (kind: QuirkKind) => void;

  /**
   * What the director is allowed to know about her mood. The stage does not own the game state, so
   * the game feeds it in; without it every tap is answered as if she were a stranger.
   */
  public reactionInput?: () => { boldness: number; hype: number };

  /** Tap timestamps, for the "you are hammering her" rule. Kept short on purpose. */
  private tapTimes: number[] = [];

  /** Her blush, drawn over the skeleton and anchored to the document's own eye box. */
  private readonly blush = new BlushLayer();

  /** Pointer is resting on her body: when it started, and which zone. */
  private hoverZone: string | null = null;
  private hoverSince = 0;
  private lastBlushMs = 0;
  /** The beat the director chose for the last tap — QA reads this, the game does not. */
  public lastTapBeat: BeatName | null = null;
  public lastTapDebug: { zone: string; beat: string; streak: number; available: number } | null = null;
  /** QA: frames served, and the last exception the tick swallowed (null while healthy). */
  public tickError: string | null = null;
  public frameCount = 0;

  public attentionDebug: { hoverMs: number; picks: number; last: string | null; reason: string; frames?: number; now?: number; error?: string } = { hoverMs: 0, picks: 0, last: null, reason: '' };

  /** When she last did an attention beat of her own, and when any beat last started. */
  private lastAttentionAt = -1e9;
  private lastBeatAt = -1e9;

  /** Her own beat fired because of the player's attention, for the chat to react to. */
  public onAttention?: (kind: AttentionKind) => void;

  private tapStreak(now: number): number {
    this.tapTimes.push(now);
    // 1.2 s is a little longer than the longest beat it can interrupt, so the counter resets when
    // the player slows down instead of carrying a stale burst into the next tap.
    while (this.tapTimes.length > 0 && now - this.tapTimes[0]! > 1200) this.tapTimes.shift();
    return this.tapTimes.length;
  }

  /** One-shot secondary motion on the live skeleton, if one is up. */
  public playLiveReaction(kind: 'shake' | 'turn' | 'sway' = 'shake'): void {
    this.live.react(kind);
  }

  /**
   * The donation beat: a gasp where the money landed, then a giggle a beat later.
   *
   * Two reactions, sequenced, because one animation cannot say "oh!" and then "hee" — and a body
   * that answers every donation with the same 0.9 s shake is a machine. The second call is guarded:
   * if the plate or the rig changed in between, it is simply dropped.
   */
  /**
   * Attention, once a frame. Two things only: how long the cursor has been on her, and how long
   * since anything happened at all. Everything else is a table in `attention.ts`.
   */
  private pumpAttention(now: number): void {
    this.attentionDebug = { ...this.attentionDebug, frames: (this.attentionDebug.frames ?? 0) + 1, now };
    const live = this.live;
    if (!live) return;
    // Mid-beat is not a state to interrupt: the request would be dropped anyway, but it would also
    // reset the dwell timer and she would never get round to reacting.
    if (live.debugState().current !== 'idle' && live.debugState().current !== 'idle_talk') return;
    const mood = this.reactionInput?.() ?? { boldness: 40, hype: 0 };
    const lastTap = this.tapTimes.length > 0 ? this.tapTimes[this.tapTimes.length - 1]! : -1e9;
    const pick = pickAttention({
      hoverMs: this.hoverZone && this.hoverSince > 0 ? now - this.hoverSince : 0,
      msSinceTap: now - lastTap,
      msSinceAttention: now - this.lastAttentionAt,
      msSinceBeat: now - this.lastBeatAt,
      boldness: mood.boldness,
      available: live.animationSet(),
      random: Math.random,
    });
    this.attentionDebug = { ...this.attentionDebug, hoverMs: now - Math.max(this.hoverSince, now - 1e6), reason: pick ? pick.anim : 'none' };
    if (!pick) return;
    this.attentionDebug = { ...this.attentionDebug, picks: this.attentionDebug.picks + 1, last: pick.anim };
    this.lastAttentionAt = now;
    this.lastBeatAt = now;
    live.react(pick.anim, pick.ms);
    // Being caught looking is the most embarrassing thing in the game, so it is the hottest.
    this.blush.bump(pick.kind === 'staring' ? HEAT.stare : HEAT.tap);
    this.onAttention?.(pick.kind);
  }

  public playLiveDonation(): void {
    const live = this.live;
    if (!live) return;
    if (live.hasAnimation('gasp')) live.react('gasp', 850);
    else live.react('shake', 900);
    // The follow-up is the part that knows who she is by now. Money landing on a shy streamer is a
    // gasp; the same money on a bold one buys a lean toward the camera, and a giggle everywhere
    // else. Same event, different woman — that is the whole point of the director.
    const bold = (this.reactionInput?.().boldness ?? 0) >= 55;
    const follow = bold && live.hasAnimation('lean_in') ? 'lean_in' : live.hasAnimation('giggle') ? 'giggle' : null;
    this.blush.bump(HEAT.donation);
    if (!follow) return;
    window.setTimeout(() => {
      if (this.live === live) live.react(follow, follow === 'lean_in' ? 2000 : 1150);
    }, 900);
  }

  /**
   * A sub goal closed: the new outfit is on the plate and she briefly *presents* it. The arch is the
   * only beat in the rig that shows off the silhouette on purpose, so it is the one a milestone gets
   * — a nod would be the game saying "well done" instead of her saying "look".
   */
  public playLiveMilestone(): void {
    const live = this.live;
    if (!live) return;
    live.react(live.hasAnimation('arch') ? 'arch' : 'giggle', 1700);
    this.blush.bump(HEAT.milestone);
  }

  /** She speaks: the mouth pattern runs for a couple of seconds inside the idle loop. */
  public playLiveTalk(ms = 2600): void {
    this.live.talk(ms);
  }

  public spawnReactionCallout(tagText: string, isFever = false, sideSeed = 0): void {
    // She answers the chat: talk with the mouth, and a small head turn the hair has to catch up
    // with. Both are no-ops when the plate on screen has no rig.
    this.live?.talk(2400);
    // The chat beat answers with a small shake; a donation goes through `playLiveDonation` below,
    // which is a gasp and a giggle instead.
    if (isFever) this.playLiveDonation();
    else this.live?.react('shake', 900);
    // Replace any existing reaction callout so rapid taps NEVER overlap two callout strings!
    if (this.activeCalloutParticle) {
      const idx = this.particles.indexOf(this.activeCalloutParticle);
      if (idx !== -1) {
        this.fxLayer.removeChild(this.activeCalloutParticle.node);
        this.activeCalloutParticle.node.destroy({ children: true });
        this.particles.splice(idx, 1);
      }
      this.activeCalloutParticle = undefined;
    }

    const side = sideSeed % 2 === 0 ? -1 : 1;
    const desiredX = StreamStage.VIRTUAL_W * 0.5 + side * 295;
    const desiredY = 225 + (sideSeed % 3) * 44;

    const style = new TextStyle({
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      fontSize: isFever ? 20 : 17.5,
      fontWeight: '800',
      fontStyle: 'italic',
      fill: isFever ? '#ffd54f' : '#ff85c0',
      stroke: { color: '#160921', width: 4.5 },
      dropShadow: {
        color: isFever ? '#ff2e88' : '#9147ff',
        blur: 7,
        distance: 0,
        alpha: 0.85,
      },
    });
    const label = new Text({ text: tagText, style });
    label.anchor.set(0.5);
    const halfW = Math.max(60, label.width / 2);
    const halfH = Math.max(16, label.height / 2);

    // Clamp inside the ACTUAL visible viewport so left-side labels like
    // "♥ Мурашки по коже!" are never clipped off-screen on narrow mobile portrait!
    const bounds = this.getVisibleVirtualBounds();
    const pad = 10;
    const minX = bounds.left + halfW + pad;
    const maxX = bounds.right - halfW - pad;
    const clampedX = maxX >= minX ? Math.min(maxX, Math.max(minX, desiredX)) : (bounds.left + bounds.right) / 2;
    const minY = bounds.top + halfH + pad;
    const maxY = bounds.bottom - halfH - pad;
    const clampedY = maxY >= minY ? Math.min(maxY, Math.max(minY, desiredY)) : desiredY;

    const container = new Container();
    container.position.set(clampedX, clampedY);
    container.addChild(label);
    this.fxLayer.addChild(container);

    // Drift toward screen centre when clamped at an edge, so text never slides off!
    const clampedLeft = clampedX <= minX + 0.5;
    const clampedRight = clampedX >= maxX - 0.5;
    const vx = clampedLeft ? 16 : clampedRight ? -16 : side * 18;

    const p: FloatingParticle = {
      node: container,
      vx,
      vy: -42,
      lifeMs: 0,
      maxLifeMs: isFever ? 1100 : 880,
    };
    this.particles.push(p);
    this.activeCalloutParticle = p;
  }

  private getVisibleVirtualBounds(): { left: number; top: number; right: number; bottom: number } {
    const w = this.hostEl ? Math.max(320, Math.round(this.hostEl.clientWidth)) : 960;
    const h = this.hostEl ? Math.max(180, Math.round(this.hostEl.clientHeight)) : 540;
    const sx = this.root.scale.x || 1;
    const sy = this.root.scale.y || 1;
    return {
      left: (0 - this.root.position.x) / sx,
      top: (0 - this.root.position.y) / sy,
      right: (w - this.root.position.x) / sx,
      bottom: (h - this.root.position.y) / sy,
    };
  }
  public setSubStage(
    stage: SubGoalStageIndex,
    celebrate = false,
    bannerLabel?: string,
    unlockEmotion?: Exclude<HeroineEmotion, 'neutral'>,
  ): void {
    const didChange = this.rig?.setSubStage(stage, celebrate, unlockEmotion);
    // The new plate may frame her head at a different size/height - move the patches with it.
    this.rig?.setFaceAnchorFor(this.getActivePlateName());
    if (didChange && this.rig && this.fgDeskSprite) {
      // All stages sit naturally behind the wooden foreground desk!
      this.rig.view.y = 18;
      const deskIdx = this.root.getChildIndex(this.fgDeskSprite);
      const rigIdx = this.root.getChildIndex(this.rig.view);
      if (rigIdx > deskIdx) {
        this.root.setChildIndex(this.rig.view, deskIdx);
      }
    }
    if (celebrate && bannerLabel) {
      this.spawnSubGoalBanner(bannerLabel);
    }
    if (didChange) {
      void this.syncLiveHeroine();
      this.app?.render();
    }
  }

  private spawnSubGoalBanner(_labelText: string): void {
    // Festive heart & star burst around Miya (no text over her body — top alert & desk subtitle carry the text!)
    for (let i = 0; i < 10; i++) {
      const hc = new Container();
      const side = i % 2 === 0 ? -1 : 1;
      hc.position.set(
        StreamStage.VIRTUAL_W * 0.5 + side * (175 + Math.random() * 95),
        250 + (Math.random() - 0.5) * 180,
      );
      const heartText = new Text({
        text: i % 2 === 0 ? '♥' : '★',
        style: new TextStyle({
          fontSize: 22 + Math.random() * 12,
          fill: i % 2 === 0 ? '#ff4da6' : '#ffd54f',
        }),
      });
      heartText.anchor.set(0.5);
      hc.addChild(heartText);
      this.fxLayer.addChild(hc);
      this.particles.push({
        node: hc,
        vx: side * (25 + Math.random() * 55),
        vy: -70 - Math.random() * 65,
        lifeMs: 0,
        maxLifeMs: 1100 + Math.random() * 350,
      });
    }
  }

  public setDrawerOpen(open: boolean): void {
    this.drawerOpen = open;
    if (this.hostEl) {
      this.updateRootTransform(
        Math.max(320, Math.round(this.hostEl.clientWidth)),
        Math.max(180, Math.round(this.hostEl.clientHeight)),
      );
      this.app.render();
    }
  }

  private fitStage(hostEl: HTMLElement): void {
    const w = Math.max(320, Math.round(hostEl.clientWidth));
    const h = Math.max(180, Math.round(hostEl.clientHeight));
    if (Math.round(this.app.screen.width) !== w || Math.round(this.app.screen.height) !== h) {
      this.app.renderer.resize(w, h);
    }
    this.updateRootTransform(w, h);
    this.app.render();
  }

  private updateRootTransform(w: number, h: number): void {
    const fitScale = Math.min(w / StreamStage.VIRTUAL_W, h / StreamStage.VIRTUAL_H);
    const maxSafeScale = h / 736;
    const coverScale = Math.max(w / StreamStage.VIRTUAL_W, h / StreamStage.VIRTUAL_H);
    const scale = Math.min(coverScale, Math.max(fitScale, maxSafeScale));

    this.root.scale.set(scale);
    const baseY = (h - StreamStage.VIRTUAL_H * scale) * 0.5;
    const drawerShift = this.drawerOpen && w > 820 ? -42 : 0;
    this.root.position.set((w - StreamStage.VIRTUAL_W * scale) * 0.5, baseY + drawerShift);
    if (this.deskMicSprite) {
      this.micHolder.x = this.micAnchorX();
    }
  }

  public spawnTapBurst(
    x: number,
    y: number,
    earned: number,
    isAlert: boolean,
    zone: TapZoneId,
  ): void {
    // Floating income label
    const container = new Container();
    container.position.set(x, y - 10);

    const badgePrefix = isAlert ? '★ ' : '♥ ';
    const style = new TextStyle({
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      fontSize: isAlert ? 30 : 23,
      fontWeight: '800',
      fill: isAlert ? '#ffd54f' : '#ffffff',
      stroke: { color: '#1b0d26', width: 5 },
      dropShadow: {
        color: '#9147ff',
        blur: 8,
        distance: 0,
        alpha: 0.75,
      },
    });
    const label = new Text({ text: `${badgePrefix}+${earned} ₽`, style });
    label.anchor.set(0.5);
    container.addChild(label);
    this.fxLayer.addChild(container);

    this.particles.push({
      node: container,
      vx: (Math.random() - 0.5) * 28,
      vy: isAlert ? -92 : -68,
      lifeMs: 0,
      maxLifeMs: isAlert ? 1150 : 850,
    });

    // Extra mini hearts around tap point
    const count = isAlert ? 5 : 2;
    for (let i = 0; i < count; i++) {
      const hc = new Container();
      hc.position.set(x + (Math.random() - 0.5) * 44, y + (Math.random() - 0.5) * 24);
      const heartText = new Text({
        text: i % 2 === 0 ? '♥' : '✦',
        style: new TextStyle({
          fontSize: 18 + Math.random() * 10,
          fill: i % 2 === 0 ? (zone === 'chest' || zone === 'feet' ? '#ff4da6' : '#ff75c3') : '#c084fc',
        }),
      });
      heartText.anchor.set(0.5);
      hc.addChild(heartText);
      this.fxLayer.addChild(hc);
      this.particles.push({
        node: hc,
        vx: (Math.random() - 0.5) * 75,
        vy: -55 - Math.random() * 55,
        lifeMs: 0,
        maxLifeMs: 720 + Math.random() * 260,
      });
    }
  }

  /**
   * The ticker's one listener, and the only place an exception is allowed to be caught and *kept*.
   *
   * A Pixi ticker has no supervision: a listener that throws stops the ticker rescheduling itself,
   * and the app keeps rendering a frozen canvas with a live HUD on top. That is the worst failure
   * mode this stage has, and it is invisible in a console that the player never opens — so the
   * error is stored where QA can read it (`tickError`) instead of vanishing into a broken frame.
   */
  private tick(dtMs: number): void {
    this.frameCount = (this.frameCount ?? 0) + 1;
    try {
      this.frame(dtMs);
    } catch (error) {
      this.tickError = String((error as Error)?.stack ?? error).slice(0, 400);
    }
  }

  private frame(dtMs: number): void {
    const safeDt = Math.min(60, Math.max(0, dtMs));
    const dt = safeDt / 1000;
    this.elapsedSec += dt;

    this.rig.update(safeDt);
    // Guarded inside `LiveHeroine`: the skeleton ticks on the stage's clock, so an exception in it
    // can never stop the app's ticker (that is exactly how a rig bug becomes a black screen).
    // Where the player is pointing, every frame, before the skeleton is advanced: the head
    // follows the cursor with a spring, and the parallax below moves the room behind her.
    if (this.pointerSeen && this.live.view.visible) {
      const aim = aimFromPointer(this.pointerNormX, this.pointerNormY);
      this.live.look(aim.x, aim.y);
    } else {
      this.live.releaseGaze();
    }
    const nowMs = performance.now();
    // Blush: the one hot channel the rigged plates were missing, driven by the numbers the game
    // already has. Anchors are null on a plate without measurable face art — then it fades out.
    this.blush.update(nowMs - (this.lastBlushMs || nowMs), this.live.view.visible ? this.live.cheekAnchors() : null, {
      boldness: this.reactionInput?.().boldness ?? 0,
      hype: this.hypeLevel,
    });
    this.lastBlushMs = nowMs;
    // Her pace: chat hype plus how far along she is with the player. Set before the update so the
    // breath that is advancing this frame already carries it.
    this.live.setEnergy(Math.max(this.hypeLevel / 100, (this.reactionInput?.().boldness ?? 0) / 140));
    this.live.update(nowMs);
    // Attention is the one part of the tick that reaches into the chat and the sound engine through
    // a callback the game owns, so it is guarded on its own: a chat line that throws must cost one
    // beat, not the whole stage. (An uncaught throw inside a Pixi ticker listener stops that ticker
    // rescheduling — a black canvas with the HUD still on top of it.)
    try {
      this.pumpAttention(nowMs);
    } catch (error) {
      this.attentionDebug = { ...this.attentionDebug, error: String((error as Error)?.message ?? error) };
    }

    // One invariant instead of a dozen call sites: while the skeleton is on screen the flat plate
    // underneath is hidden. Every path that can raise the plate — a flash beat, a stage change, a
    // load failure, a re-shown patch layer — has to be right anyway, but if one of them is not, the
    // player sees a doubled heroine ("ghosting") for a frame. This is that frame, deleted.
    if (this.live.view.visible && this.rig.plateVisible) this.rig.setPlateVisible(false);

    // Subtle 3D webcam parallax between room back wall, heroine, and foreground desk!
    this.bgSprite.x = -12 - this.pointerNormX * 5.5;
    this.bgSprite.y = -8 - this.pointerNormY * 3.0;
    this.fgDeskSprite.x = -14 + this.pointerNormX * 7.5;
    // Desk microphone rides with the foreground desk parallax so it stays planted on the wood!
    if (this.deskMicSprite?.visible) {
      this.micHolder.x = this.micAnchorX() + this.pointerNormX * 7.5;
      // Gentle purchase pop-in animation
      if (this.micPopT < 1) {
        this.micPopT = Math.min(1, this.micPopT + safeDt / 420);
        const e = 1 - Math.pow(1 - this.micPopT, 3);
        const pop = 0.72 + 0.28 * e;
        this.deskMicSprite.scale.set(pop);
        this.deskMicSprite.alpha = 0.35 + 0.65 * e;
      } else {
        this.deskMicSprite.scale.set(1);
        this.deskMicSprite.alpha = 1;
      }
    }

    // Ring lamp subtle warm glow scales with upgrade level + rosy Fever aura at high hype
    const targetGlow = Math.min(0.16, 0.025 + this.lampLevel * 0.012);
    this.lampGlow.alpha += (targetGlow - this.lampGlow.alpha) * 0.08;

    const targetFever =
      this.hypeLevel > 50
        ? ((this.hypeLevel - 50) / 50) * (0.09 + 0.025 * Math.sin(this.elapsedSec * 5.0))
        : 0;
    this.feverGlow.alpha += (targetFever - this.feverGlow.alpha) * 0.1;

    // Floating dust motes
    for (const m of this.motes) {
      m.baseY -= m.speedY * dt;
      if (m.baseY < 40) m.baseY = 660;
      m.node.x = m.baseX + Math.sin(this.elapsedSec * 0.9 + m.phase) * 14;
      m.node.y = m.baseY;
    }

    // Update tap particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.lifeMs += safeDt;
      const t = p.lifeMs / p.maxLifeMs;
      if (t >= 1) {
        if (this.activeCalloutParticle === p) {
          this.activeCalloutParticle = undefined;
        }
        this.fxLayer.removeChild(p.node);
        p.node.destroy({ children: true });
        this.particles.splice(i, 1);
        continue;
      }
      p.node.x += p.vx * dt;
      p.node.y += p.vy * dt;
      p.node.alpha = 1 - Math.pow(t, 1.8);
      const popScale = t < 0.15 ? 0.75 + (t / 0.15) * 0.35 : 1.1 - t * 0.15;
      p.node.scale.set(popScale);
    }
  }

  public destroy(): void {
    this.resizeObserver?.disconnect();
    this.app.destroy(true, { children: true });
  }
}

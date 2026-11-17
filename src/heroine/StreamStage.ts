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
import { DAY3_FLASH_PLATE, getSubGoalStagesForDay } from '../domain/subGoals.ts';
import { HeroineRig } from './HeroineRig.ts';

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
    const day3Defs = getSubGoalStagesForDay(3);
    // A missing file still answers 200 with the SPA index.html in dev, so the content type decides.
    const day3Heads = await Promise.all(
      day3Defs.map((def) =>
        fetch(def.plateUrl, { method: 'HEAD' })
          .then((res) => res.ok && (res.headers.get('content-type') ?? '').startsWith('image/'))
          .catch(() => false),
      ),
    );
    let day3StagesTex: Texture[] | undefined;
    let ghostFlashTex: Texture | undefined;
    if (day3Heads.every(Boolean)) {
      try {
        const loaded = await Promise.all(day3Defs.map((def) => Assets.load<Texture>(def.plateUrl)));
        day3StagesTex = loaded.every((tex) => Boolean(tex)) ? loaded : undefined;
        ghostFlashTex = await Assets.load<Texture>(DAY3_FLASH_PLATE).catch(() => undefined);
      } catch {
        day3StagesTex = undefined; // decode failed - the Day 2 ladder keeps the rig alive
      }
    }

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
    });
    const heroScale = 724 / HeroineRig.PLATE_H;
    this.rig.view.scale.set(heroScale);
    this.rig.view.position.set(
      (StreamStage.VIRTUAL_W - HeroineRig.PLATE_W * heroScale) * 0.5,
      18,
    );
    this.root.addChild(this.rig.view);
    // Day 2 plates frame her head differently - glue the patches on before the first render.
    this.rig.setFaceAnchorFor(this.getActivePlateName());

    // Layer 2: Foreground Desk Edge + Cat Tea Mug + USB Microphone (3D depth overlap over chair post!)
    this.fgDeskSprite = new Sprite(fgDeskTex);
    this.fgDeskSprite.width = StreamStage.VIRTUAL_W + 28;
    this.fgDeskSprite.height = StreamStage.VIRTUAL_H + 12;
    this.fgDeskSprite.position.set(-14, -2);
    this.root.addChild(this.fgDeskSprite);

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
      const res = this.onHeroineTap?.(zone);
      if (res) {
        this.spawnTapBurst(localPt.x, localPt.y, res.earned, res.alert, zone);
      }
    };

    hostEl.addEventListener('pointermove', (e) => {
      const rect = hostEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.pointerNormX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        this.pointerNormY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      }
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

  /** Day 3 «Бу!» flash frame; returns true when something actually flashed on screen. */
  public triggerGhostBoo(durationMs = 520): boolean {
    return this.rig?.triggerGhostBoo(durationMs) ?? false;
  }

  public setWardrobeDay(day: 1 | 2 | 3): void {
    this.rig?.setWardrobeDay(day);
    this.rig?.setFaceAnchorFor(this.getActivePlateName());
  }

  public spawnReactionCallout(tagText: string, isFever = false, sideSeed = 0): void {
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

  private tick(dtMs: number): void {
    const safeDt = Math.min(60, Math.max(0, dtMs));
    const dt = safeDt / 1000;
    this.elapsedSec += dt;

    this.rig.update(safeDt);

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

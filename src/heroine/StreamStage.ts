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

  public app!: Application;
  public rig!: HeroineRig;

  private readonly root = new Container();
  private bgSprite!: Sprite;
  private lampGlow = new Graphics();
  private feverGlow = new Graphics();
  private chairShadow = new Graphics();
  private fgDeskSprite!: Sprite;
  private micLed = new Graphics();
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
      s5Tex,
      blinkTex,
      shyTex,
      flusterTex,
      teaseTex,
      boldTex,
      s5BlinkTex,
      s5TeaseTex,
      s5FlusterTex,
      fgDeskTex,
    ] = await Promise.all([
      Assets.load<Texture>('/art/bg_room_t1.webp'),
      Assets.load<Texture>('/art/heroine_t1_s0.webp'),
      Assets.load<Texture>('/art/heroine_t1_s1.webp'),
      Assets.load<Texture>('/art/heroine_t1_s2.webp'),
      Assets.load<Texture>('/art/heroine_t1_base.webp'),
      Assets.load<Texture>('/art/heroine_t1_s4.webp'),
      Assets.load<Texture>('/art/heroine_t1_s5.webp'),
      Assets.load<Texture>('/art/patch_t1_blink.webp'),
      Assets.load<Texture>('/art/patch_t1_shy.webp'),
      Assets.load<Texture>('/art/patch_t1_fluster.webp'),
      Assets.load<Texture>('/art/patch_t1_tease.webp'),
      Assets.load<Texture>('/art/patch_t1_bold.webp'),
      Assets.load<Texture>('/art/patch_t1_s5_blink.webp'),
      Assets.load<Texture>('/art/patch_t1_s5_tease.webp'),
      Assets.load<Texture>('/art/patch_t1_s5_fluster.webp'),
      Assets.load<Texture>('/art/fg_desk_t1.webp'),
    ]);

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

    // Layer 1: Heroine Rig (6 Sub Goal stages including Stage 5 Cosplay Feet-on-Desk!)
    this.rig = new HeroineRig({
      stages: [s0Tex, s1Tex, s2Tex, s3Tex, s4Tex, s5Tex],
      blink: blinkTex,
      shy: shyTex,
      fluster: flusterTex,
      tease: teaseTex,
      bold: boldTex,
      s5Blink: s5BlinkTex,
      s5Tease: s5TeaseTex,
      s5Fluster: s5FlusterTex,
    });
    const heroScale = 724 / HeroineRig.PLATE_H;
    this.rig.view.scale.set(heroScale);
    this.rig.view.position.set(
      (StreamStage.VIRTUAL_W - HeroineRig.PLATE_W * heroScale) * 0.5,
      18,
    );
    this.root.addChild(this.rig.view);

    // Layer 2: Foreground Desk Edge + Cat Tea Mug + USB Microphone (3D depth overlap over chair post!)
    this.fgDeskSprite = new Sprite(fgDeskTex);
    this.fgDeskSprite.width = StreamStage.VIRTUAL_W + 28;
    this.fgDeskSprite.height = StreamStage.VIRTUAL_H + 12;
    this.fgDeskSprite.position.set(-14, -2);
    this.root.addChild(this.fgDeskSprite);

    // Subtle pulsing power LED on the right foreground USB microphone
    this.micLed.circle(1253, 598, 5.5).fill({ color: 0x8ea8ff, alpha: 0.45 });
    this.root.addChild(this.micLed);

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

  public setRingLampLevel(level: number): void {
    this.lampLevel = level;
  }

  public setHypeLevel(hype: number): void {
    this.hypeLevel = Math.max(0, Math.min(100, hype));
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
    const container = new Container();
    container.position.set(
      StreamStage.VIRTUAL_W * 0.5 + side * 295,
      225 + (sideSeed % 3) * 44,
    );

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
    container.addChild(label);
    this.fxLayer.addChild(container);

    const p: FloatingParticle = {
      node: container,
      vx: side * 18,
      vy: -42,
      lifeMs: 0,
      maxLifeMs: isFever ? 1100 : 880,
    };
    this.particles.push(p);
    this.activeCalloutParticle = p;
  }

  public setSubStage(
    stage: SubGoalStageIndex,
    celebrate = false,
    bannerLabel?: string,
    unlockEmotion?: Exclude<HeroineEmotion, 'neutral'>,
  ): void {
    const didChange = this.rig?.setSubStage(stage, celebrate, unlockEmotion);
    if (didChange && this.rig && this.fgDeskSprite) {
      // In Stage 5 Cosplay, her bare heels & soles rest ON TOP OF the wooden desk!
      const deskIdx = this.root.getChildIndex(this.fgDeskSprite);
      const rigIdx = this.root.getChildIndex(this.rig.view);
      if (stage === 5) {
        this.rig.view.y = 32;
        if (rigIdx < deskIdx) {
          this.root.setChildIndex(this.rig.view, deskIdx);
        }
      } else {
        this.rig.view.y = 18;
        if (rigIdx > deskIdx) {
          this.root.setChildIndex(this.rig.view, deskIdx);
        }
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
    const drawerShift = this.drawerOpen ? -42 : 0;
    this.root.position.set((w - StreamStage.VIRTUAL_W * scale) * 0.5, baseY + drawerShift);
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
    this.micLed.x = this.pointerNormX * 7.5;
    this.micLed.alpha = 0.3 + 0.25 * Math.sin(this.elapsedSec * 3.2);

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

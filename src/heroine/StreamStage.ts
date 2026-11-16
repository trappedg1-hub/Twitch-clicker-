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
import type { TapZoneId } from '../domain/types.ts';
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
  private chairShadow = new Graphics();
  private fgDeskSprite!: Sprite;
  private micLed = new Graphics();
  private readonly dustLayer = new Container();
  private readonly fxLayer = new Container();

  private readonly particles: FloatingParticle[] = [];
  private readonly motes: DustMote[] = [];
  private pointerNormX = 0;
  private pointerNormY = 0;
  private lampLevel = 0;
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

    const [bgTex, baseTex, blinkTex, flusterTex, fgDeskTex] = await Promise.all([
      Assets.load<Texture>('/art/bg_room_t1.webp'),
      Assets.load<Texture>('/art/heroine_t1_base.webp'),
      Assets.load<Texture>('/art/patch_t1_blink.webp'),
      Assets.load<Texture>('/art/patch_t1_fluster.webp'),
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

    // Layer 1: Heroine Rig (scaled so head is at y=18 and all 10 bare toes sit above desk plank at y=696!)
    this.rig = new HeroineRig({
      base: baseTex,
      blink: blinkTex,
      fluster: flusterTex,
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

    this.fitStage(hostEl);
    this.resizeObserver = new ResizeObserver(() => this.fitStage(hostEl));
    this.resizeObserver.observe(hostEl);

    this.app.ticker.add((ticker) => {
      this.tick(ticker.deltaMS);
    });
  }

  public setRingLampLevel(level: number): void {
    this.lampLevel = level;
  }

  private fitStage(hostEl: HTMLElement): void {
    const w = Math.max(320, hostEl.clientWidth);
    const h = Math.max(180, hostEl.clientHeight);
    this.app.renderer.resize(w, h);

    // Fill width edge-to-edge when aspect is close to 16:9 while keeping 100% of heroine (head y=18..feet y=704) visible!
    const fitScale = Math.min(w / StreamStage.VIRTUAL_W, h / StreamStage.VIRTUAL_H);
    const maxSafeScale = h / 736; // Never crop head (y=18) or bare toes (y=704)
    const coverScale = Math.max(w / StreamStage.VIRTUAL_W, h / StreamStage.VIRTUAL_H);
    const scale = Math.min(coverScale, Math.max(fitScale, maxSafeScale));

    this.root.scale.set(scale);
    this.root.position.set(
      (w - StreamStage.VIRTUAL_W * scale) * 0.5,
      (h - StreamStage.VIRTUAL_H * scale) * 0.5,
    );
    this.app.render();
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

    // Ring lamp subtle warm glow scales with upgrade level
    const targetGlow = Math.min(0.16, 0.025 + this.lampLevel * 0.012);
    this.lampGlow.alpha += (targetGlow - this.lampGlow.alpha) * 0.08;

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

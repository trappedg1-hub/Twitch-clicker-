/**
 * The game's sound, synthesized at runtime.
 *
 * There is not a single audio file in this build, and for a clicker that is the right call rather
 * than a shortcut: a tap sound is heard a few thousand times an hour, so it has to be *identical*
 * every time (a 40 KB sample heard 3000 times is also 40 KB downloaded before the first click),
 * and it has to move with the game instead of just repeating. Everything here is oscillators and
 * one noise buffer, shaped by envelopes, so the pitch can ride the hype meter and a donation can
 * land on a real chord.
 *
 * Three rules keep it from being annoying, which is the only way sound in a clicker survives:
 * nothing plays before the player's first gesture (the browser requires it anyway, and a
 * context created without a gesture starts suspended on iOS), taps are rate limited and jittered
 * so a fast player gets a texture rather than a machine gun, and the master gain sits low enough
 * that the sound is a detail under the stream, not a soundtrack over it.
 */

const STORAGE_KEY = 'miya_sound_v1';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  // -1, not 0: a fresh AudioContext's clock starts at zero too, so `now - 0 < 0.028` swallowed the
  // very first click of the session — the one that matters most, because it is the click that
  // creates the context.
  private lastTapAt = -1;
  /** Counted for QA only — the audio graph itself has no need for it. */
  private taps = 0;
  private enabled: boolean;

  public constructor() {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    this.enabled = stored !== 'off';
  }

  public get isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(on: boolean): void {
    this.enabled = on;
    try {
      localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    } catch {
      /* private mode: the toggle still works for this session */
    }
    if (!on && this.master && this.ctx) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    } else if (on && this.master && this.ctx) {
      this.master.gain.setTargetAtTime(Sfx.MASTER, this.ctx.currentTime, 0.02);
    }
  }

  /**
   * What QA needs to know about a thing that cannot be heard in a headless browser: did a context
   * actually come up, and is it running (iOS leaves a context suspended until a real gesture)?
   */
  public debugState(): { enabled: boolean; context: string; master: number; taps: number } {
    return {
      enabled: this.enabled,
      context: this.ctx?.state ?? 'none',
      master: this.master?.gain.value ?? 0,
      taps: this.taps,
    };
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  /** Must be called from inside a user gesture the first time, or iOS leaves the context asleep. */
  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = Sfx.MASTER;
      // One compressor for everything: a fever run plus a donation can stack four voices in the
      // same 20 ms, and without this the peaks clip instead of getting louder.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      master.connect(comp);
      comp.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.noise = this.makeNoise(ctx);
      return ctx;
    } catch {
      return null;
    }
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const frames = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      // Shaped decay rather than flat white noise: it reads as a tick, not as static.
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 3;
    }
    return buffer;
  }

  private static readonly MASTER = 0.3;

  /** One shaped sine, optionally gliding. The workhorse of every voice below. */
  private tone(
    ctx: AudioContext,
    opts: {
      at: number;
      freq: number;
      to?: number;
      dur: number;
      gain: number;
      type?: OscillatorType;
      attack?: number;
    },
  ): void {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freq, opts.at);
    if (opts.to && opts.to !== opts.freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), opts.at + opts.dur);
    }
    const attack = opts.attack ?? 0.004;
    env.gain.setValueAtTime(0.0001, opts.at);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), opts.at + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.dur);
    osc.connect(env);
    env.connect(this.master!);
    osc.start(opts.at);
    osc.stop(opts.at + opts.dur + 0.02);
  }

  /** A filtered noise burst: the "wood" in a click, which a sine alone cannot give. */
  private tick(ctx: AudioContext, at: number, gain: number, centre: number): void {
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = centre;
    bp.Q.value = 0.9;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    src.connect(bp);
    bp.connect(env);
    env.connect(this.master!);
    src.start(at);
    src.stop(at + 0.06);
  }

  /**
   * The tap. `heat` is 0..1 and pushes the pitch up, so a long fever run climbs instead of
   * hammering one note; the tiny random detune keeps consecutive taps from phase-locking.
   */
  public tap(heat = 0): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastTapAt < 0.028) return;
    this.lastTapAt = now;
    this.taps += 1;
    const h = Math.min(1, Math.max(0, heat));
    const base = 520 + h * 380 + (Math.random() * 12 - 6);
    this.tone(ctx, { at: now, freq: base, to: base * 1.06, dur: 0.085, gain: 0.5 });
    this.tick(ctx, now, 0.22 + h * 0.1, 1900 + h * 900);
    if (h > 0.55) {
      // A soft octave only once the hype is up: the tap stops being a click and starts being a note.
      this.tone(ctx, { at: now, freq: base * 2, dur: 0.06, gain: 0.09, type: 'triangle' });
    }
  }

  /** A donation: a rising two-note bell, deliberately the loudest thing in the mix. */
  public donation(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(ctx, { at: now, freq: 1046.5, dur: 0.5, gain: 0.35 });
    this.tone(ctx, { at: now, freq: 1568, dur: 0.42, gain: 0.14 });
    this.tone(ctx, { at: now + 0.09, freq: 1568, dur: 0.65, gain: 0.3 });
    this.tone(ctx, { at: now + 0.09, freq: 2093, dur: 0.5, gain: 0.1 });
    this.tick(ctx, now, 0.16, 5200);
  }

  /** A sub goal closed: a four-note arpeggio that resolves, so it sounds finished, not cut off. */
  public milestone(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      this.tone(ctx, { at: now + i * 0.085, freq, dur: 0.42, gain: 0.24, type: 'triangle' });
    });
    this.tone(ctx, { at: now + 0.26, freq: 1046.5, dur: 0.9, gain: 0.1 });
  }

  /** The chat asks for something: two soft blips, a notification rather than a fanfare. */
  public dareAsk(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(ctx, { at: now, freq: 880, dur: 0.07, gain: 0.12, type: 'triangle' });
    this.tone(ctx, { at: now + 0.1, freq: 1174.7, dur: 0.1, gain: 0.1, type: 'triangle' });
  }

  /** Served: a rising fifth that resolves, so the ear hears "done" and not just "beep". */
  public dareServed(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(ctx, { at: now, freq: 659.25, dur: 0.16, gain: 0.2, type: 'triangle' });
    this.tone(ctx, { at: now + 0.11, freq: 987.77, dur: 0.34, gain: 0.18, type: 'triangle' });
    this.tick(ctx, now + 0.11, 0.1, 4200);
  }

  /**
   * Missed: a small falling pair, quiet on purpose. The chat mocking the player is the joke; the
   * game is not allowed to punish them with a noise.
   */
  public dareMissed(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(ctx, { at: now, freq: 440, dur: 0.12, gain: 0.09, type: 'sine' });
    this.tone(ctx, { at: now + 0.12, freq: 392, dur: 0.22, gain: 0.075, type: 'sine' });
  }

  /**
   * Her own little moments — a giggle, a hair toss. Barely there on purpose: the player should
   * notice that the room has a voice, not that the game has a sound effect for idling.
   */
  public quirk(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const a = 720 + Math.random() * 60;
    this.tone(ctx, { at: now, freq: a, to: a * 1.18, dur: 0.11, gain: 0.06, type: 'triangle' });
    this.tone(ctx, {
      at: now + 0.13,
      freq: a * 1.1,
      to: a * 1.3,
      dur: 0.1,
      gain: 0.045,
      type: 'triangle',
    });
  }
}

/** One instance for the session: the audio context is expensive and stateful, the toggle is global. */
export const sfx = new Sfx();

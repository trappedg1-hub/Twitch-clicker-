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

import {
  breathCycle,
  breathPhase,
  duckGain,
  DUCK_DEPTH,
  DUCK_RECOVER_MS,
  nextCityDelay,
  nextCreakDelay,
  roomMix,
  ROOM_BREATH_PERIOD_SEC,
  type RoomMix,
} from './roomPlan.ts';

const STORAGE_KEY = 'miya_sound_v1';

/** The room's own graph, kept apart from the one-shot voices so it can be built once and tuned. */
interface RoomGraph {
  /** The duck target: everything in the room passes through it, so her voice drops the room. */
  gain: GainNode;
  bed: GainNode;
  hum: GainNode;
  breath: { filter: BiquadFilterNode; gain: GainNode; source: AudioBufferSourceNode };
  mix: RoomMix;
  day: number;
  creakTimer: number;
  cityTimer: number;
  breathTimer: number;
  breaths: number;
  creaks: number;
  citySwells: number;
  /** Context time (s) of the last duck, -1 before the first one. */
  duckAt: number;
  /** Context time (s) when the first breath was scheduled, so the phase can be reported. */
  breathStart: number;
}

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
  /** The ambience. Built on the first gesture with the rest of the graph, never before. */
  private room: RoomGraph | null = null;

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
  public debugState(): {
    enabled: boolean;
    context: string;
    master: number;
    taps: number;
    room: string;
    bed: number;
    breaths: number;
    duck: number;
    period: number;
  } {
    const room = this.roomDebug();
    return {
      enabled: this.enabled,
      context: this.ctx?.state ?? 'none',
      master: this.master?.gain.value ?? 0,
      taps: this.taps,
      room: room.running ? 'running' : 'off',
      bed: room.bed,
      breaths: room.breaths,
      duck: room.duck,
      period: room.period,
    };
  }

  /**
   * What the room is doing right now, for QA.
   *
   * Nothing about a noise floor can be heard in a headless browser, so the room is measured the
   * way the rig is: by its state. `duck` is the live envelope value from the same pure function the
   * graph is scheduled from, so a QA run can prove that a line of her speech drops the room and
   * that the room comes back.
   */
  public roomDebug(): {
    running: boolean;
    day: number;
    bed: number;
    breath: number;
    creak: number;
    city: number;
    breaths: number;
    creaks: number;
    citySwells: number;
    duck: number;
    phase: number;
    period: number;
  } {
    const room = this.room;
    if (!room) {
      return {
        running: false,
        day: 1,
        bed: 0,
        breath: 0,
        creak: 0,
        city: 0,
        breaths: 0,
        creaks: 0,
        citySwells: 0,
        duck: 1,
        phase: 0,
        period: ROOM_BREATH_PERIOD_SEC,
      };
    }
    const now = this.ctx?.currentTime ?? 0;
    return {
      running: this.ctx?.state === 'running',
      day: room.day,
      bed: Number(room.bed.gain.value.toFixed(4)),
      breath: room.mix.breath,
      creak: room.mix.creak,
      city: room.mix.city,
      breaths: room.breaths,
      creaks: room.creaks,
      citySwells: room.citySwells,
      duck: room.duckAt < 0 ? 1 : duckGain((now - room.duckAt) * 1000),
      phase: Number(breathPhase(now - room.breathStart).toFixed(3)),
      period: ROOM_BREATH_PERIOD_SEC,
    };
  }

  /**
   * Play one of the room's rare events now.
   *
   * The scheduler uses this and so does QA: a creak fires once a minute, which is longer than any
   * headless run, so the only way to prove the voice builds without throwing is to ask for it. If
   * this ever throws, the room silently dies for the rest of the session — that is the failure mode
   * worth a QA line.
   */
  public roomEvent(kind: 'creak' | 'city'): boolean {
    const room = this.room;
    const ctx = this.ctx;
    if (!room || !ctx) return false;
    try {
      if (kind === 'creak') this.creak(room, ctx);
      else this.citySwell(room, ctx);
      return true;
    } catch {
      return false;
    }
  }

  /** The night gets later; the room gets quieter. Called whenever the day changes. */
  public setDay(day: number): void {
    const room = this.room;
    if (!room) return;
    const d = Math.min(6, Math.max(1, Math.round(day)));
    if (d === room.day) return;
    room.day = d;
    room.mix = roomMix(d);
    this.applyRoomMix(room);
  }

  /**
   * Her voice in the room: the bed drops to half and comes back over 900 ms.
   *
   * Deliberately modest. The mistake a game makes here is to mute the world under dialogue, which
   * turns a room into a menu; what a real room does is stop being the loudest thing in it.
   */
  public duck(ms = 1200): void {
    const room = this.room;
    const ctx = this.ctx;
    if (!room || !ctx) return;
    const now = ctx.currentTime;
    room.duckAt = now;
    const gain = room.gain.gain;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(DUCK_DEPTH, now, 0.04);
    gain.setTargetAtTime(1, now + Math.max(0.05, ms / 1000), DUCK_RECOVER_MS / 3000);
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
      // The room comes up with the graph, inside the same gesture: on iOS a context built without
      // one starts suspended, and a room that fades in a minute later reads as a bug.
      this.startRoom(ctx);
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

  // --- the room ---------------------------------------------------------------------------

  /**
   * Three seconds of soft noise for the bed, darker than the tap's tick.
   *
   * One-pole lowpassed white noise, i.e. a cheap pink: the point is that it has no spectral spike
   * anywhere an ear can learn, because this buffer loops for an hour. The tap's buffer is 250 ms and
   * shaped — it is a transient, and transient buffers are allowed to be interesting.
   */
  private makeRoomNoise(ctx: AudioContext): AudioBuffer {
    const seconds = 3;
    const frames = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < frames; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.86 + white * 0.14;
      data[i] = last * 2.4;
    }
    // Crossfade the seam: a click every three seconds is the one artefact this must never have.
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i += 1) {
      const t = i / fade;
      const head = data[i]!;
      const tail = data[frames - fade + i]!;
      data[i] = head * t + tail * (1 - t);
    }
    return buffer;
  }

  private startRoom(ctx: AudioContext): void {
    if (this.room || !this.master) return;
    const mix = roomMix(1);
    const gain = ctx.createGain();
    gain.gain.value = 1;
    gain.connect(this.master);

    // The bed: the room's air.
    const noise = this.makeRoomNoise(ctx);
    const bedSource = ctx.createBufferSource();
    bedSource.buffer = noise;
    bedSource.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 340;
    lowpass.Q.value = 0.6;
    const bed = ctx.createGain();
    bed.gain.value = mix.bed;
    bedSource.connect(lowpass);
    lowpass.connect(bed);
    bed.connect(gain);
    bedSource.start();

    // The PC in the corner: a sine an octave below anything the game plays, its own quiet engine.
    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 46;
    const humGain = ctx.createGain();
    humGain.gain.value = mix.hum;
    hum.connect(humGain);
    humGain.connect(gain);
    hum.start();

    // Her breath: the bed's noise through a moving band, so it is the same air, shaped.
    const breathSource = ctx.createBufferSource();
    breathSource.buffer = noise;
    breathSource.loop = true;
    const breathFilter = ctx.createBiquadFilter();
    breathFilter.type = 'bandpass';
    breathFilter.frequency.value = 640;
    breathFilter.Q.value = 1.3;
    const breathGain = ctx.createGain();
    breathGain.gain.value = 0;
    breathSource.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(gain);
    breathSource.start();

    this.room = {
      gain,
      bed,
      hum: humGain,
      breath: { filter: breathFilter, gain: breathGain, source: breathSource },
      mix,
      day: 1,
      creakTimer: 0,
      cityTimer: 0,
      breathTimer: 0,
      breaths: 0,
      creaks: 0,
      citySwells: 0,
      duckAt: -1,
      breathStart: ctx.currentTime,
    };
    this.scheduleBreath(this.room, ctx);
    this.room.breathTimer = window.setInterval(
      () => this.scheduleBreath(this.room!, ctx),
      ROOM_BREATH_PERIOD_SEC * 1000,
    );
    this.scheduleCreak(this.room, ctx);
    this.scheduleCity(this.room, ctx);
  }

  /**
   * The day changed: retune every level through a 0.4 s exponent.
   *
   * `setTargetAtTime` and not `setValueAtTime`: a step in a noise floor is audible as a click, and
   * the room is the one signal the player hears continuously, so every change to it is a fade.
   */
  private applyRoomMix(room: RoomGraph): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    room.bed.gain.setTargetAtTime(room.mix.bed, now, 0.4);
    room.hum.gain.setTargetAtTime(room.mix.hum, now, 0.4);
  }

  /**
   * One breath, written straight from `breathAt`.
   *
   * The curve is scheduled a cycle ahead through `setValueCurveAtTime`, which is the Web Audio
   * equivalent of "this is the shape, not a series of ramps" — so what the test measures is what the
   * speaker plays, not a paraphrase of it.
   */
  private scheduleBreath(room: RoomGraph, ctx: AudioContext): void {
    const steps = 48;
    const curve = new Float32Array(steps);
    const filterCurve = new Float32Array(steps);
    const samples = breathCycle(steps);
    for (let i = 0; i < steps; i += 1) {
      const sample = samples[i]!;
      curve[i] = sample.level * room.mix.breath;
      // Inhale is through the nose: duller. Exhale opens up. 120 Hz of travel is enough to hear it.
      filterCurve[i] = sample.filter;
    }
    const at = ctx.currentTime + 0.02;
    try {
      room.breath.gain.gain.cancelScheduledValues(at);
      room.breath.gain.gain.setValueCurveAtTime(curve, at, ROOM_BREATH_PERIOD_SEC);
      room.breath.filter.frequency.cancelScheduledValues(at);
      room.breath.filter.frequency.setValueCurveAtTime(filterCurve, at, ROOM_BREATH_PERIOD_SEC);
      room.breaths += 1;
    } catch {
      /* a suspended or closing context: the next tick will schedule again */
    }
  }

  // Two handles, replaced on every reschedule. An array of handles is the obvious shape and it grows
  // by one per event for the whole session — a leak nobody would notice until a two-hour stream.
  private scheduleCreak(room: RoomGraph, ctx: AudioContext): void {
    window.clearTimeout(room.creakTimer);
    room.creakTimer = window.setTimeout(() => {
      this.creak(room, ctx);
      this.scheduleCreak(room, ctx);
    }, nextCreakDelay(Math.random) * 1000);
  }

  private scheduleCity(room: RoomGraph, ctx: AudioContext): void {
    window.clearTimeout(room.cityTimer);
    room.cityTimer = window.setTimeout(() => {
      this.citySwell(room, ctx);
      this.scheduleCity(room, ctx);
    }, nextCityDelay(Math.random, room.day) * 1000);
  }

  /**
   * The chair taking her weight: a slow saw through a tight band, rising then falling.
   *
   * The only room event with an audible attack, which is why it is the rarest. Two partials a few
   * hertz apart so it beats slightly, the way stressed wood does.
   */
  private creak(room: RoomGraph, ctx: AudioContext): void {
    const at = ctx.currentTime + 0.01;
    const gain = room.mix.creak;
    for (const [freq, detune] of [[96, 0], [143, 7]] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, at);
      osc.frequency.linearRampToValueAtTime(freq * 0.82, at + 0.34);
      osc.detune.value = detune;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(430, at);
      bp.frequency.linearRampToValueAtTime(360, at + 0.34);
      bp.Q.value = 7;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(gain * 0.5, at + 0.09);
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
      osc.connect(bp);
      bp.connect(env);
      env.connect(room.gain);
      osc.start(at);
      osc.stop(at + 0.46);
    }
    room.creaks += 1;
  }

  /** The street two floors down: a low swell with no detail, so it can only ever be the city. */
  private citySwell(room: RoomGraph, ctx: AudioContext): void {
    if (!this.noise) return;
    const at = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 190;
    lp.Q.value = 0.7;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(room.mix.city, at + 1.1);
    env.gain.linearRampToValueAtTime(0.0001, at + 3.2);
    src.connect(lp);
    lp.connect(env);
    env.connect(room.gain);
    src.start(at);
    src.stop(at + 3.3);
    room.citySwells += 1;
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

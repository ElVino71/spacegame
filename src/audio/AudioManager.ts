/**
 * AudioManager — hybrid procedural SFX + ambient music system.
 *
 * All SFX are synthesized at runtime via the Web Audio API (no files needed).
 * Ambient music uses layered oscillators/noise for per-scene atmospheres.
 */

type SfxName =
  | 'ui_click' | 'ui_select' | 'ui_confirm' | 'ui_deny' | 'ui_navigate'
  | 'warp_start' | 'warp_end'
  | 'land' | 'takeoff'
  | 'dock' | 'undock'
  | 'engine_thrust'
  | 'footstep'
  | 'rover_move'
  | 'mine'
  | 'terminal_key' | 'terminal_execute' | 'terminal_error'
  | 'trade_buy' | 'trade_sell' | 'refuel' | 'repair'
  | 'combat_hit' | 'combat_victory' | 'combat_flee';

type AmbienceName =
  | 'galaxy_map' | 'system_flight' | 'planet_surface'
  | 'station' | 'ship_interior' | 'terminal' | 'transition';

let instance: AudioManager | null = null;

export function getAudioManager(): AudioManager {
  if (!instance) instance = new AudioManager();
  return instance;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private _masterVolume = 0.5;
  private _sfxVolume = 0.7;
  private _musicVolume = 0.4;
  private _muted = false;

  // Ambient state
  private currentAmbience: AmbienceName | null = null;
  private ambienceNodes: AudioNode[] = [];
  private ambienceSources: OscillatorNode[] = [];
  private ambienceNoiseSource: AudioBufferSourceNode | null = null;
  private ambienceFadeGain: GainNode | null = null;

  // Throttle for rapid-fire SFX
  private lastSfxTime: Record<string, number> = {};
  private readonly SFX_COOLDOWN = 50; // ms

  private ensureContext(): AudioContext | null {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this._masterVolume;
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this._sfxVolume;
        this.sfxGain.connect(this.masterGain);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this._musicVolume;
        this.musicGain.connect(this.masterGain);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  // ─── VOLUME CONTROLS ──────────────────────────────────

  get masterVolume(): number { return this._masterVolume; }
  set masterVolume(v: number) {
    this._masterVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this._muted ? 0 : this._masterVolume;
  }

  get sfxVolume(): number { return this._sfxVolume; }
  set sfxVolume(v: number) {
    this._sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.value = this._sfxVolume;
  }

  get musicVolume(): number { return this._musicVolume; }
  set musicVolume(v: number) {
    this._musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain) this.musicGain.gain.value = this._musicVolume;
  }

  get muted(): boolean { return this._muted; }
  set muted(v: boolean) {
    this._muted = v;
    if (this.masterGain) this.masterGain.gain.value = v ? 0 : this._masterVolume;
  }

  toggleMute(): boolean {
    this.muted = !this._muted;
    return this._muted;
  }

  // ─── SFX ──────────────────────────────────────────────

  playSfx(name: SfxName): void {
    try {
      const now = performance.now();
      if (now - (this.lastSfxTime[name] ?? 0) < this.SFX_COOLDOWN) return;
      this.lastSfxTime[name] = now;

      const ctx = this.ensureContext();
      if (!ctx || this._muted) return;

      switch (name) {
        case 'ui_click':      this.synthClick(ctx, 800, 0.06); break;
        case 'ui_select':     this.synthClick(ctx, 600, 0.08); break;
        case 'ui_confirm':    this.synthConfirm(ctx); break;
        case 'ui_deny':       this.synthDeny(ctx); break;
        case 'ui_navigate':   this.synthClick(ctx, 1000, 0.04); break;
        case 'warp_start':    this.synthWarp(ctx); break;
        case 'warp_end':      this.synthWarpEnd(ctx); break;
        case 'land':          this.synthLand(ctx); break;
        case 'takeoff':       this.synthTakeoff(ctx); break;
        case 'dock':          this.synthDock(ctx); break;
        case 'undock':        this.synthDock(ctx); break;
        case 'engine_thrust': this.synthThrust(ctx); break;
        case 'footstep':      this.synthFootstep(ctx); break;
        case 'rover_move':    this.synthRoverMove(ctx); break;
        case 'mine':          this.synthMine(ctx); break;
        case 'terminal_key':  this.synthTerminalKey(ctx); break;
        case 'terminal_execute': this.synthConfirm(ctx); break;
        case 'terminal_error':  this.synthDeny(ctx); break;
        case 'trade_buy':     this.synthTrade(ctx, true); break;
        case 'trade_sell':    this.synthTrade(ctx, false); break;
        case 'refuel':        this.synthRefuel(ctx); break;
        case 'repair':        this.synthRepair(ctx); break;
        case 'combat_hit':    this.synthCombatHit(ctx); break;
        case 'combat_victory': this.synthCombatVictory(ctx); break;
        case 'combat_flee':   this.synthCombatFlee(ctx); break;
      }
    } catch {
      // Audio errors must never crash game scenes
    }
  }

  // ─── AMBIENCE ─────────────────────────────────────────

  setAmbience(name: AmbienceName): void {
    if (name === this.currentAmbience) return;
    this.stopAmbience(0.8);
    this.currentAmbience = name;

    try {
      const ctx = this.ensureContext();
      if (!ctx || this._muted) return;

      this.ambienceFadeGain = ctx.createGain();
      this.ambienceFadeGain.gain.setValueAtTime(0, ctx.currentTime);
      this.ambienceFadeGain.connect(this.musicGain!);
      // Fade in
      this.ambienceFadeGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);

      switch (name) {
        case 'galaxy_map':     this.ambienceSpace(ctx); break;
        case 'system_flight':  this.ambienceSystem(ctx); break;
        case 'planet_surface': this.ambiencePlanet(ctx); break;
        case 'station':        this.ambienceStation(ctx); break;
        case 'ship_interior':  this.ambienceShip(ctx); break;
        case 'terminal':       this.ambienceTerminal(ctx); break;
        case 'transition':     break; // transitions use SFX, no ambience
      }
    } catch {
      // Audio errors must never crash game scenes
    }
  }

  stopAmbience(fadeTime = 0.5): void {
    if (!this.ctx || !this.ambienceFadeGain) return;
    const now = this.ctx.currentTime;

    try {
      this.ambienceFadeGain.gain.cancelScheduledValues(now);
      this.ambienceFadeGain.gain.setValueAtTime(this.ambienceFadeGain.gain.value, now);
      this.ambienceFadeGain.gain.linearRampToValueAtTime(0, now + fadeTime);
    } catch {
      // gain node may already be disconnected
    }

    const sources = [...this.ambienceSources];
    const noiseSource = this.ambienceNoiseSource;
    const nodes = [...this.ambienceNodes];
    const fadeGain = this.ambienceFadeGain;

    setTimeout(() => {
      for (const s of sources) { try { s.stop(); } catch { /* */ } }
      if (noiseSource) { try { noiseSource.stop(); } catch { /* */ } }
      for (const n of nodes) { try { n.disconnect(); } catch { /* */ } }
      try { fadeGain.disconnect(); } catch { /* */ }
    }, fadeTime * 1000 + 100);

    this.ambienceSources = [];
    this.ambienceNoiseSource = null;
    this.ambienceNodes = [];
    this.ambienceFadeGain = null;
    this.currentAmbience = null;
  }

  // ─── PROCEDURAL SFX SYNTHESIZERS ──────────────────────

  private synthClick(ctx: AudioContext, freq: number, duration: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  private synthConfirm(ctx: AudioContext): void {
    const t = ctx.currentTime;
    // Two-tone ascending
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = i === 0 ? 600 : 900;
      gain.gain.setValueAtTime(0.12, t + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.1);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.1);
    }
  }

  private synthDeny(ctx: AudioContext): void {
    const t = ctx.currentTime;
    // Descending buzz
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.linearRampToValueAtTime(150, t + 0.15);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  private synthWarp(ctx: AudioContext): void {
    const t = ctx.currentTime;
    // Rising sweep with noise burst
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(2000, t + 1.5);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.setValueAtTime(0.15, t + 1.0);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(4000, t + 1.5);
    filter.Q.value = 5;

    osc.connect(filter).connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 2.0);

    // Sub-bass rumble
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.value = 40;
    subGain.gain.setValueAtTime(0.2, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
    sub.connect(subGain).connect(this.sfxGain!);
    sub.start(t);
    sub.stop(t + 2.0);
  }

  private synthWarpEnd(ctx: AudioContext): void {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1500, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.8);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.8);

    osc.connect(filter).connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 1.0);
  }

  private synthLand(ctx: AudioContext): void {
    const t = ctx.currentTime;
    // Atmospheric entry whoosh + thud
    const noise = this.createNoise(ctx, 1.5);
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2000, t);
    noiseFilter.frequency.linearRampToValueAtTime(400, t + 1.2);
    noiseFilter.Q.value = 1;
    noiseGain.gain.setValueAtTime(0.15, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    noise.connect(noiseFilter).connect(noiseGain).connect(this.sfxGain!);
    noise.start(t);
    noise.stop(t + 1.5);

    // Landing thud
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(80, t + 1.2);
    thud.frequency.exponentialRampToValueAtTime(30, t + 1.6);
    thudGain.gain.setValueAtTime(0, t);
    thudGain.gain.setValueAtTime(0.25, t + 1.2);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    thud.connect(thudGain).connect(this.sfxGain!);
    thud.start(t + 1.2);
    thud.stop(t + 1.6);
  }

  private synthTakeoff(ctx: AudioContext): void {
    const t = ctx.currentTime;
    // Engines spooling up
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 1.5);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(2000, t + 1.5);

    osc.connect(filter).connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 1.8);
  }

  private synthDock(ctx: AudioContext): void {
    const t = ctx.currentTime;
    // Mechanical clunk + hiss
    const clunk = ctx.createOscillator();
    const clunkGain = ctx.createGain();
    clunk.type = 'square';
    clunk.frequency.setValueAtTime(120, t + 0.3);
    clunk.frequency.exponentialRampToValueAtTime(40, t + 0.5);
    clunkGain.gain.setValueAtTime(0.15, t + 0.3);
    clunkGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    clunk.connect(clunkGain).connect(this.sfxGain!);
    clunk.start(t + 0.3);
    clunk.stop(t + 0.5);

    // Pressurization hiss
    const noise = this.createNoise(ctx, 0.8);
    const noiseGain = ctx.createGain();
    const nf = ctx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 3000;
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.setValueAtTime(0.06, t + 0.5);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    noise.connect(nf).connect(noiseGain).connect(this.sfxGain!);
    noise.start(t + 0.5);
    noise.stop(t + 1.3);
  }

  private synthThrust(ctx: AudioContext): void {
    const t = ctx.currentTime;
    const noise = this.createNoise(ctx, 0.15);
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    noise.connect(filter).connect(gain).connect(this.sfxGain!);
    noise.start(t);
    noise.stop(t + 0.15);
  }

  private synthFootstep(ctx: AudioContext): void {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100 + Math.random() * 40, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.06);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  private synthRoverMove(ctx: AudioContext): void {
    const t = ctx.currentTime;
    const dur = 0.18;

    // Engine rumble — low sawtooth with slight pitch variation
    const eng = ctx.createOscillator();
    const engGain = ctx.createGain();
    eng.type = 'sawtooth';
    eng.frequency.setValueAtTime(38 + Math.random() * 8, t);
    eng.frequency.linearRampToValueAtTime(32 + Math.random() * 5, t + dur);
    engGain.gain.setValueAtTime(0.09, t);
    engGain.gain.setValueAtTime(0.07, t + dur * 0.3);
    engGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const engFilter = ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 160;
    engFilter.Q.value = 2;
    eng.connect(engFilter).connect(engGain).connect(this.sfxGain!);
    eng.start(t);
    eng.stop(t + dur);

    // Motor whine — higher harmonic
    const whine = ctx.createOscillator();
    const whineGain = ctx.createGain();
    whine.type = 'square';
    whine.frequency.setValueAtTime(120 + Math.random() * 20, t);
    whine.frequency.exponentialRampToValueAtTime(90, t + dur);
    whineGain.gain.setValueAtTime(0.02, t);
    whineGain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.7);
    const whineFilter = ctx.createBiquadFilter();
    whineFilter.type = 'bandpass';
    whineFilter.frequency.value = 300;
    whineFilter.Q.value = 3;
    whine.connect(whineFilter).connect(whineGain).connect(this.sfxGain!);
    whine.start(t);
    whine.stop(t + dur);

    // Tread grind — filtered noise burst
    const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * dur * 0.6), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.05, t);
    nGain.gain.linearRampToValueAtTime(0.03, t + dur * 0.3);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.6);
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.value = 500 + Math.random() * 200;
    nFilter.Q.value = 1;
    noise.connect(nFilter).connect(nGain).connect(this.sfxGain!);
    noise.start(t);
    noise.stop(t + dur * 0.6);
  }

  private synthMine(ctx: AudioContext): void {
    const t = ctx.currentTime;
    // Impact + chime for mineral found
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 200 + i * 80;
      gain.gain.setValueAtTime(0.1, t + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.1);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.05);
      osc.stop(t + i * 0.05 + 0.1);
    }
  }

  private synthTerminalKey(ctx: AudioContext): void {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1200 + Math.random() * 400;
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  private synthTrade(ctx: AudioContext, isBuy: boolean): void {
    const t = ctx.currentTime;
    const freqs = isBuy ? [400, 600, 800] : [800, 600, 400];
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freqs[i];
      gain.gain.setValueAtTime(0.1, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.08);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.08);
    }
  }

  private synthRefuel(ctx: AudioContext): void {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.linearRampToValueAtTime(600, t + 0.4);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  private synthRepair(ctx: AudioContext): void {
    const t = ctx.currentTime;
    // Wrench-like clinks
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 800 + i * 200;
      gain.gain.setValueAtTime(0.08, t + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.05);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.05);
    }
  }

  private synthCombatHit(ctx: AudioContext): void {
    const t = ctx.currentTime;
    // Impact noise burst + low thud
    const bufSize = ctx.sampleRate * 0.15;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.15, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    noise.connect(filter).connect(nGain).connect(this.sfxGain!);
    noise.start(t);
    // Low thud
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.2);
    oGain.gain.setValueAtTime(0.2, t);
    oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(oGain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  private synthCombatVictory(ctx: AudioContext): void {
    const t = ctx.currentTime;
    // Ascending triumphant tones
    const notes = [440, 554, 659, 880];
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = notes[i];
      const start = t + i * 0.1;
      gain.gain.setValueAtTime(0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.2);
    }
  }

  private synthCombatFlee(ctx: AudioContext): void {
    const t = ctx.currentTime;
    // Descending whoosh
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.3);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.3);
    osc.connect(filter).connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  // ─── AMBIENCE GENERATORS ──────────────────────────────

  private ambienceSpace(ctx: AudioContext): void {
    // Deep, wide pad — mysterious space
    const drone1 = this.createDrone(ctx, 55, 'sine', 0.08);
    const drone2 = this.createDrone(ctx, 82.5, 'sine', 0.05);
    const drone3 = this.createDrone(ctx, 110, 'triangle', 0.03);

    // Slow LFO modulation on drone1
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1;
    lfoGain.gain.value = 3;
    lfo.connect(lfoGain).connect(drone1.frequency);
    lfo.start();
    this.ambienceSources.push(lfo);

    // Filtered noise — distant cosmic wind
    const noise = this.createNoise(ctx, 0);
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 300;
    nf.Q.value = 0.5;
    const ng = ctx.createGain();
    ng.gain.value = 0.02;
    noise.connect(nf).connect(ng).connect(this.ambienceFadeGain!);
    noise.start();
    this.ambienceNoiseSource = noise;
    this.ambienceNodes.push(nf, ng);
  }

  private ambienceSystem(ctx: AudioContext): void {
    // Engine idle hum + space ambience
    const drone = this.createDrone(ctx, 65, 'sawtooth', 0.03);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    // Re-route drone through filter
    drone.disconnect();
    const dg = ctx.createGain();
    dg.gain.value = 0.06;
    drone.connect(filter).connect(dg).connect(this.ambienceFadeGain!);
    this.ambienceNodes.push(filter, dg);

    // Subtle high pad
    this.createDrone(ctx, 220, 'sine', 0.015);

    // Noise floor
    const noise = this.createNoise(ctx, 0);
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 400;
    const ng = ctx.createGain();
    ng.gain.value = 0.015;
    noise.connect(nf).connect(ng).connect(this.ambienceFadeGain!);
    noise.start();
    this.ambienceNoiseSource = noise;
    this.ambienceNodes.push(nf, ng);
  }

  private ambiencePlanet(ctx: AudioContext): void {
    // Wind + low drone
    const noise = this.createNoise(ctx, 0);
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 600;
    nf.Q.value = 0.3;
    const ng = ctx.createGain();
    ng.gain.value = 0.04;
    noise.connect(nf).connect(ng).connect(this.ambienceFadeGain!);
    noise.start();
    this.ambienceNoiseSource = noise;
    this.ambienceNodes.push(nf, ng);

    // Wind modulation
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 200;
    lfo.connect(lfoGain).connect(nf.frequency);
    lfo.start();
    this.ambienceSources.push(lfo);

    // Ground drone
    this.createDrone(ctx, 45, 'sine', 0.04);
  }

  private ambienceStation(ctx: AudioContext): void {
    // Mechanical hum + ventilation
    this.createDrone(ctx, 60, 'square', 0.02);
    this.createDrone(ctx, 120, 'sine', 0.015);

    // Ventilation noise
    const noise = this.createNoise(ctx, 0);
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 500;
    const ng = ctx.createGain();
    ng.gain.value = 0.025;
    noise.connect(nf).connect(ng).connect(this.ambienceFadeGain!);
    noise.start();
    this.ambienceNoiseSource = noise;
    this.ambienceNodes.push(nf, ng);
  }

  private ambienceShip(ctx: AudioContext): void {
    // Ship idle — gentle hum
    this.createDrone(ctx, 55, 'sine', 0.04);
    this.createDrone(ctx, 110, 'triangle', 0.015);

    // Life support hiss
    const noise = this.createNoise(ctx, 0);
    const nf = ctx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 2000;
    const ng = ctx.createGain();
    ng.gain.value = 0.008;
    noise.connect(nf).connect(ng).connect(this.ambienceFadeGain!);
    noise.start();
    this.ambienceNoiseSource = noise;
    this.ambienceNodes.push(nf, ng);
  }

  private ambienceTerminal(ctx: AudioContext): void {
    // CRT-like electrical hum
    this.createDrone(ctx, 60, 'sawtooth', 0.01);
    const high = this.createDrone(ctx, 15734, 'sine', 0.003); // CRT whine
    // Filter the high drone
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 15734;
    filter.Q.value = 30;
    high.disconnect();
    const hg = ctx.createGain();
    hg.gain.value = 0.005;
    high.connect(filter).connect(hg).connect(this.ambienceFadeGain!);
    this.ambienceNodes.push(filter, hg);
  }

  // ─── UTILITY ──────────────────────────────────────────

  private createDrone(ctx: AudioContext, freq: number, type: OscillatorType, volume: number): OscillatorNode {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain).connect(this.ambienceFadeGain!);
    osc.start();
    this.ambienceSources.push(osc);
    this.ambienceNodes.push(gain);
    return osc;
  }

  private createNoise(ctx: AudioContext, duration: number): AudioBufferSourceNode {
    const length = duration > 0
      ? ctx.sampleRate * duration
      : ctx.sampleRate * 4; // 4-second looping buffer for ambience
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (duration === 0) source.loop = true;
    return source;
  }
}

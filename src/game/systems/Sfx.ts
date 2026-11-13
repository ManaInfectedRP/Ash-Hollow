/**
 * Audio: CC0 samples (public/assets/audio/sfx, see docs/AUDIO.md) played through WebAudio with a
 * little pitch/volume variation, layered with / falling back to small synthesized sounds.
 * Music streams through <audio> elements (decoded music would cost tens of MB on mobile) and
 * cross-fades between area themes and boss music.
 */

const SAMPLES: Record<string, string[]> = {
  swing: ['swing1', 'swing2'],
  heavy: ['heavy1', 'heavy2', 'heavy3'],
  hit: ['hit1'],
  clang: ['clang1', 'clang2', 'clang3'],
  step: ['step0', 'step2', 'step4', 'step6', 'step8'],
  roll: ['roll1', 'roll2', 'roll3', 'roll4'],
  jump: ['jump'],
  pickup: ['pickup1', 'pickup2'],
  souls: ['souls1', 'souls2'],
  doorOpen: ['door_open1', 'door_open2'],
  locked: ['locked1', 'locked2'],
  fire: ['fire1', 'fire2'],
  levelUp: ['levelup'],
  hurt: ['hurt1', 'hurt2'],
  die: ['die1'],
  roar: ['roar1', 'roar2'],
  monster: ['monster1', 'monster2'],
  stones: ['stones1', 'stones2', 'stones3'],
  wood: ['wood1', 'wood2'],
  menuOpen: ['menu_open'],
  menuClose: ['menu_close'],
  drink: ['drink'],
};

export type MusicTrack = 'hollow' | 'crypt' | 'boss' | null;

const SETTINGS_KEY = 'ashen-hollow-audio';

class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private buffers = new Map<string, AudioBuffer[]>();
  private loading = false;
  private music = new Map<string, HTMLAudioElement>();
  private currentTrack: MusicTrack = null;
  private wantedTrack: MusicTrack = null;
  private fades = new Map<HTMLAudioElement, number>();
  muted = false;
  musicOn = true;
  musicVolume = 0.45;

  constructor() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
      this.muted = !!s.muted;
      this.musicOn = s.musicOn ?? true;
    } catch {
      /* defaults */
    }
  }

  private saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted: this.muted, musicOn: this.musicOn }));
    } catch {
      /* ignore */
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.saveSettings();
  }

  setMusicOn(on: boolean) {
    this.musicOn = on;
    this.saveSettings();
    if (on) this.playMusic(this.wantedTrack, true);
    else this.stopAllMusic();
  }

  /** Must be called from a user gesture (browsers block audio before that). */
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      void this.loadSamples();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    // music that was requested before the first gesture starts now
    if (this.wantedTrack && !this.currentTrack) this.playMusic(this.wantedTrack, true);
  }

  private async loadSamples() {
    if (this.loading || !this.ctx) return;
    this.loading = true;
    const ctx = this.ctx;
    await Promise.all(
      Object.entries(SAMPLES).map(async ([name, files]) => {
        const list: AudioBuffer[] = [];
        for (const f of files) {
          try {
            const res = await fetch(`assets/audio/sfx/${f}.ogg`);
            list.push(await ctx.decodeAudioData(await res.arrayBuffer()));
          } catch {
            /* unsupported codec (old iOS) or missing file: the synth fallback covers it */
          }
        }
        if (list.length) this.buffers.set(name, list);
      }),
    );
  }

  private ok() {
    return this.ctx && this.ctx.state === 'running' && !this.muted;
  }

  /** Play a random variant of a sample. Returns false when it isn't loaded (use a synth fallback). */
  private sample(name: string, vol = 0.6, rate = 1, delay = 0) {
    if (!this.ok()) return true;
    const list = this.buffers.get(name);
    if (!list) return false;
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = list[Math.floor(Math.random() * list.length)];
    src.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
    const g = ctx.createGain();
    g.gain.value = vol * (0.85 + Math.random() * 0.15);
    src.connect(g).connect(this.master);
    src.start(ctx.currentTime + delay);
    return true;
  }

  private tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0, lp = 0) {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      o.connect(f);
      node = f;
    }
    node.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(dur: number, type: BiquadFilterType, f0: number, f1: number, vol: number, q = 1, delay = 0) {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------------ combat
  swing(heavy = false) {
    if (!this.sample(heavy ? 'heavy' : 'swing', heavy ? 0.55 : 0.45, heavy ? 0.85 : 1.1))
      this.burst(heavy ? 0.24 : 0.13, 'bandpass', heavy ? 700 : 1400, heavy ? 180 : 420, heavy ? 0.4 : 0.28, 1.4);
  }
  hit(heavy = false) {
    // sample for the flesh/impact, synth thump underneath for weight
    this.sample('hit', heavy ? 0.8 : 0.6, heavy ? 0.8 : 1);
    this.tone(heavy ? 150 : 190, 45, heavy ? 0.22 : 0.15, 'sine', heavy ? 0.6 : 0.45);
  }
  hurt() {
    this.sample('hit', 0.6, 0.75);
    this.tone(200, 80, 0.2, 'square', 0.1, 0, 900);
  }
  enemyHurt() {
    this.sample('hurt', 0.35, 1.1);
  }
  enemyDie() {
    this.sample('die', 0.45, 0.9 + Math.random() * 0.2);
  }
  roll() {
    if (!this.sample('roll', 0.55)) this.burst(0.25, 'lowpass', 900, 150, 0.3);
  }
  jump() {
    if (!this.sample('jump', 0.3, 1.2)) this.burst(0.08, 'highpass', 900, 1600, 0.06);
  }
  land() {
    if (!this.sample('step', 0.45, 0.8)) this.tone(95, 40, 0.1, 'sine', 0.35);
  }
  step() {
    this.sample('step', 0.18, 1);
  }
  /** rising warning before a big swing */
  charge(big = false) {
    this.tone(big ? 160 : 260, big ? 420 : 560, big ? 0.55 : 0.35, 'sawtooth', big ? 0.07 : 0.05, 0, 1400);
    this.burst(big ? 0.5 : 0.3, 'bandpass', 300, 1800, big ? 0.18 : 0.12, 2);
  }
  /**
   * A distinct wind-up sound per kind of boss attack (see attacks.ts `Tell`):
   * slam = deep rising rumble, low = metal scraping along stone, high = rising whistle,
   * leap = grunt + spring, blink = eerie falling chime, wave = boiling roar, spit = gurgle,
   * rain = rattling bones, summon = low chant.
   */
  tell(kind: string) {
    switch (kind) {
      case 'slam':
        this.tone(55, 150, 0.9, 'sawtooth', 0.12, 0, 380);
        this.tone(110, 300, 0.9, 'square', 0.03, 0, 600);
        this.sample('stones', 0.25, 0.55);
        break;
      case 'low':
        // scrape: a long bright noise sliding down, plus a ringing edge
        this.burst(0.55, 'bandpass', 4200, 1500, 0.2, 7);
        this.tone(1250, 980, 0.5, 'triangle', 0.04);
        this.sample('clang', 0.15, 0.6);
        break;
      case 'high':
        this.tone(380, 1300, 0.45, 'sine', 0.09);
        this.burst(0.45, 'bandpass', 600, 3600, 0.14, 3);
        break;
      case 'leap':
        this.sample('monster', 0.5, 0.65);
        this.tone(140, 420, 0.35, 'square', 0.05, 0.05, 900);
        break;
      case 'blink':
        this.tone(1100, 330, 0.7, 'sine', 0.07);
        this.tone(1650, 470, 0.7, 'sine', 0.04, 0.03);
        this.burst(0.6, 'highpass', 3000, 6000, 0.05);
        break;
      case 'wave':
        this.tone(42, 95, 1.4, 'sine', 0.5);
        this.burst(1.3, 'lowpass', 300, 900, 0.3);
        this.sample('roar', 0.45, 0.45);
        for (let i = 0; i < 5; i++) this.tone(180 + Math.random() * 120, 80, 0.12, 'sine', 0.08, 0.2 + i * 0.22);
        break;
      case 'spit':
        for (let i = 0; i < 3; i++) this.tone(260 - i * 40, 90, 0.14, 'square', 0.05, i * 0.11, 700);
        this.burst(0.35, 'bandpass', 500, 220, 0.12, 4);
        break;
      case 'rain':
        for (let i = 0; i < 3; i++) this.sample('stones', 0.22, 1.5 + i * 0.15, i * 0.12);
        this.tone(700, 1400, 0.6, 'triangle', 0.03);
        break;
      case 'summon':
        this.tone(98, 92, 1.0, 'sawtooth', 0.08, 0, 450);
        this.tone(147, 139, 1.0, 'sawtooth', 0.05, 0, 450);
        break;
      case 'pierce':
        // a bright metallic ring: the cue to raise the shield
        this.sample('clang', 0.22, 1.8);
        this.tone(1500, 2100, 0.3, 'triangle', 0.05);
        break;
      case 'nova':
        for (let i = 0; i < 5; i++) this.tone(900 + i * 300, 2400 + i * 200, 0.6, 'sine', 0.035, i * 0.08);
        this.burst(0.8, 'highpass', 2500, 7000, 0.12);
        break;
    }
  }
  /** frost kill: the body locks up with a creak of ice… */
  freeze() {
    this.tone(900, 2600, 0.14, 'sine', 0.06);
    this.burst(0.15, 'highpass', 5000, 8000, 0.1);
  }
  /** …then bursts like a dropped pane of glass */
  shatter() {
    this.sample('clang', 0.35, 2.2);
    this.burst(0.35, 'highpass', 3000, 9000, 0.3);
    for (let i = 0; i < 7; i++)
      this.tone(2200 + Math.random() * 2600, 1600 + Math.random() * 1200, 0.08 + Math.random() * 0.12, 'triangle', 0.05, i * 0.025 + Math.random() * 0.02);
    this.tone(140, 60, 0.18, 'sine', 0.25);
  }
  /** elemental procs: fire catching, frost bursting into frostbite, poison taking hold */
  status(kind: 'ignite' | 'frostbite' | 'poison') {
    if (kind === 'ignite') {
      this.burst(0.35, 'lowpass', 1800, 400, 0.22);
      this.tone(320, 90, 0.25, 'sawtooth', 0.04, 0, 900);
    } else if (kind === 'frostbite') {
      this.sample('clang', 0.3, 1.6);
      for (let i = 0; i < 4; i++) this.tone(1800 + i * 420, 900 + i * 200, 0.25, 'sine', 0.05, i * 0.05);
      this.burst(0.4, 'highpass', 4000, 7000, 0.12);
    } else {
      for (let i = 0; i < 4; i++) this.tone(300 + Math.random() * 200, 120, 0.12, 'sine', 0.07, i * 0.09);
      this.burst(0.5, 'bandpass', 700, 300, 0.1, 3);
    }
  }
  stagger() {
    if (!this.sample('clang', 0.6)) {
      this.tone(520, 130, 0.3, 'triangle', 0.25);
      this.burst(0.2, 'bandpass', 2500, 900, 0.25, 4);
    }
  }
  slam() {
    this.sample('stones', 0.7, 0.7);
    this.tone(70, 25, 0.5, 'sine', 0.9);
  }
  roar() {
    if (!this.sample('roar', 0.75, 0.7)) {
      this.tone(110, 50, 1.4, 'sawtooth', 0.4, 0, 500);
      this.burst(1.2, 'lowpass', 700, 90, 0.45);
    }
  }
  monster() {
    this.sample('monster', 0.4, 1.1);
  }
  arrow() {
    if (!this.sample('wood', 0.35, 1.4)) this.burst(0.1, 'highpass', 2000, 4000, 0.1);
  }
  bones() {
    this.sample('stones', 0.35, 1.3);
  }

  // ------------------------------------------------------------------ world + ui
  death() {
    this.tone(70, 32, 2.4, 'sawtooth', 0.35, 0, 220);
    this.tone(55, 30, 2.6, 'sine', 0.6);
    this.burst(1.6, 'lowpass', 500, 50, 0.4);
  }
  bonfire() {
    if (!this.sample('fire', 0.6, 0.9)) this.burst(0.9, 'bandpass', 250, 1400, 0.35, 0.8);
    this.tone(660, 660, 1.3, 'sine', 0.05, 0.15);
    this.tone(990, 990, 1.5, 'sine', 0.03, 0.3);
  }
  souls() {
    if (!this.sample('souls', 0.35, 1.1)) {
      this.tone(880, 1320, 0.25, 'sine', 0.07);
      this.tone(1320, 1760, 0.3, 'sine', 0.05, 0.06);
    }
  }
  pickup() {
    if (!this.sample('pickup', 0.5)) this.souls();
  }
  drink() {
    if (!this.sample('drink', 0.5)) for (let i = 0; i < 3; i++) this.tone(320, 190, 0.09, 'sine', 0.18, i * 0.14);
  }
  heal() {
    this.tone(440, 880, 0.5, 'sine', 0.06);
  }
  door() {
    this.sample('doorOpen', 0.6);
  }
  locked() {
    if (!this.sample('locked', 0.6)) this.stagger();
  }
  menu(open: boolean) {
    this.sample(open ? 'menuOpen' : 'menuClose', 0.35);
  }
  victory() {
    [392, 494, 587, 784].forEach((f, i) => this.tone(f, f, 2.2, 'triangle', 0.07, i * 0.12, 1800));
  }
  levelUp() {
    if (!this.sample('levelUp', 0.5)) [523, 659, 784].forEach((f, i) => this.tone(f, f * 1.01, 0.5, 'sine', 0.08, i * 0.07));
  }

  // ------------------------------------------------------------------ music
  private track(name: string) {
    let a = this.music.get(name);
    if (!a) {
      a = new Audio(`assets/audio/music/${name}.ogg`);
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      this.music.set(name, a);
    }
    return a;
  }

  private fade(a: HTMLAudioElement, to: number, ms: number, thenPause = false) {
    const prev = this.fades.get(a);
    if (prev) clearInterval(prev);
    const from = a.volume;
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k >= 1) {
        clearInterval(id);
        this.fades.delete(a);
        if (thenPause) a.pause();
      }
    }, 50);
    this.fades.set(a, id);
  }

  /** Cross-fade to an area theme / boss music (null = silence). Safe to call every frame. */
  playMusic(name: MusicTrack, force = false) {
    this.wantedTrack = name;
    if (!force && name === this.currentTrack) return;
    if (!this.ctx || !this.musicOn) return; // starts on the first gesture / when re-enabled
    const old = this.currentTrack ? this.track(this.currentTrack) : null;
    if (old && this.currentTrack !== name) this.fade(old, 0, 1200, true);
    this.currentTrack = name;
    if (!name) return;
    const a = this.track(name);
    if (name === 'boss') a.currentTime = 0;
    void a.play().catch(() => {
      this.currentTrack = null; // autoplay blocked – retried on the next resume()
    });
    this.fade(a, this.musicVolume * (name === 'boss' ? 1 : 0.8), 1500);
  }

  private stopAllMusic() {
    for (const a of this.music.values()) this.fade(a, 0, 400, true);
    this.currentTrack = null;
  }

  /** duck the music while a menu is open */
  duck(on: boolean) {
    if (!this.currentTrack) return;
    const a = this.track(this.currentTrack);
    this.fade(a, on ? this.musicVolume * 0.3 : this.musicVolume * (this.currentTrack === 'boss' ? 1 : 0.8), 300);
  }
}

export const sfx = new Sfx();

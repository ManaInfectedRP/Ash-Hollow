import Phaser from 'phaser';
import { DEPTH } from '../constants';
import type { Tell } from './attacks';

/**
 * Every big attack has its own look (and its own wind-up sound, see Sfx.tell), so you can tell what's
 * coming before it lands:
 *
 *  slam   orange  – heat rising off the floor, chevrons falling onto it ............ get out of the zone
 *  low    yellow  – streaks skimming along the floor, "^" marks above it ............ jump it
 *  high   violet  – claw-like slashes drawing across the zone ...................... roll / block / back off
 *  leap   red     – a target reticle closing in where it will land ................. move off the mark
 *  blink  cyan    – a pale column and wisps where it will rise ..................... roll away from it
 *  wave   magma   – heat glow with arrows racing outward ........................... run, then come back
 *  spit   cream   – brackets closing in on your feet ............................... keep moving / block
 *  pierce gold    – a thin lance of light aimed at you, a shield mark ............... PARRY it (or roll)
 *  nova   ice     – frost rings swelling out from the caster ........................ get out of the circle
 *
 * The boss's own glow takes the same colour during the wind-up (see TELL_COLOR).
 * Drawn additively above the darkness layer so it reads as light even in the crypts.
 */
export const TELL_COLOR: Record<Tell, number> = {
  slam: 0xff6a20,
  low: 0xffd23a,
  high: 0xb46cff,
  leap: 0xff2e2e,
  blink: 0x7af0ff,
  wave: 0xff4416,
  spit: 0xfff0b0,
  rain: 0xffa060,
  summon: 0x9cff8a,
  pierce: 0xfff0a0,
  nova: 0x9ad8ff,
};

/** cheap deterministic 0..1 noise per index, so moving bits keep their lanes from frame to frame */
const hash = (i: number, s: number) => {
  const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** mix a colour toward white (k = 0 → colour, 1 → white) */
const lighten = (c: number, k: number) => {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  const m = (v: number) => Math.round(v + (255 - v) * k);
  return (m(r) << 16) | (m(g) << 8) | m(b);
};

/** mix a colour toward black (k = 0 → colour, 1 → black) */
const darken = (c: number, k: number) => {
  const m = (v: number) => Math.round(v * (1 - k));
  return (m((c >> 16) & 255) << 16) | (m((c >> 8) & 255) << 8) | m(c & 255);
};

export class Telegraph {
  /**
   * Bright areas (sky, desert): additive light vanishes against a white sky, so zones are painted normally,
   * deepened instead of lightened, and outlined in dark. Set by the scene when an area loads.
   */
  static bright = false;
  private g: Phaser.GameObjects.Graphics;
  private flashT = 0;

  constructor(private scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.FG + 3).setBlendMode(Telegraph.bright ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
  }

  /** the highlight tone: lighter in the dark, deeper (more saturated) against a bright sky */
  private lit(c: number, k: number) {
    return Telegraph.bright ? darken(c, Math.min(0.55, k * 0.6)) : lighten(c, k);
  }

  /**
   * progress 0..1 = how close the strike is; groundY = the floor under the zone;
   * facing = which way the attack travels (for the sweep streaks).
   */
  draw(rect: Phaser.Geom.Rectangle, progress: number, groundY: number, tell: Tell = 'slam', facing = 1) {
    const g = this.g;
    const p = Phaser.Math.Clamp(progress, 0, 1);
    const t = this.scene.time.now / 1000;
    g.clear();
    g.setAlpha(1);
    const c = TELL_COLOR[tell];
    // pulses faster as the strike approaches
    const pulse = 0.85 + 0.15 * Math.sin(t * (5 + p * 16));
    const z = { x: rect.x, w: rect.width, top: rect.y, bottom: Math.min(rect.bottom, groundY) };
    switch (tell) {
      case 'low':
        this.low(z, p, t, c, pulse, facing);
        break;
      case 'high':
        this.high(z, p, t, c, pulse, facing);
        break;
      case 'leap':
        this.leap(z, p, t, c, pulse);
        break;
      case 'blink':
        this.blink(z, p, t, c, pulse);
        break;
      case 'wave':
        this.wave(z, p, t, c, pulse);
        break;
      case 'spit':
        this.spit(z, p, t, c);
        return; // no timer – the globs are the timer
      case 'pierce':
        this.pierce(z, p, t, c, pulse, facing);
        break;
      case 'nova':
        this.nova(z, p, t, c, pulse);
        break;
      default:
        this.slam(z, p, t, c, pulse);
    }
    this.timer(rect.x, rect.width, groundY, p);
    if (Telegraph.bright) {
      // a crisp dark frame and a stronger wash so it reads against white cloud and pale sand
      g.fillStyle(c, 0.12 + 0.3 * p);
      g.fillRect(rect.x, rect.y, rect.width, Math.min(rect.bottom, groundY) - rect.y);
      g.lineStyle(1, 0x101018, 0.45 + 0.5 * p);
      g.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, Math.min(rect.bottom, groundY) - rect.y - 1);
    }
  }

  // ------------------------------------------------------------------ styles
  private heat(z: Zone, p: number, c: number, pulse: number, strength = 1) {
    const g = this.g;
    const h = Math.max(8, z.bottom - z.top);
    const bands = Math.max(5, Math.round(h / 3));
    const bh = h / bands;
    for (let i = 0; i < bands; i++) {
      const k = i / bands;
      const a = (0.04 + 0.2 * p) * Math.pow(1 - k, 1.8) * pulse * strength;
      if (a < 0.004) continue;
      g.fillStyle(k < 0.25 ? this.lit(c, 0.15) : c, a);
      g.fillRect(z.x, z.bottom - (i + 1) * bh, z.w, bh + 0.5);
    }
    g.fillStyle(this.lit(c, 0.3), (0.25 + 0.45 * p) * pulse * strength);
    g.fillRect(z.x, z.bottom - 1, z.w, 1);
  }

  private edges(z: Zone, p: number, c: number, height: number) {
    const g = this.g;
    const a = 0.25 + 0.55 * p;
    for (const [ex, dir] of [
      [z.x, 1],
      [z.x + z.w - 1, -1],
    ] as const) {
      for (let j = 0; j < height; j += 2) {
        g.fillStyle(this.lit(c, 0.3), a * (1 - j / height));
        g.fillRect(ex, z.bottom - 1 - j, 1, 2);
      }
      g.fillStyle(this.lit(c, 0.45), a);
      g.fillRect(dir > 0 ? ex : ex - 3, z.bottom - 1, 4, 1);
    }
  }

  private embers(z: Zone, p: number, t: number, c: number, count: number, speed: number) {
    const g = this.g;
    const h = Math.max(8, z.bottom - z.top);
    for (let i = 0; i < count; i++) {
      const life = (t * speed * (0.6 + hash(i, 1) * 0.8) + hash(i, 2)) % 1;
      const ex = z.x + 2 + hash(i, 3) * (z.w - 4) + Math.sin(t * 3 + i) * 1.5;
      const ey = z.bottom - 2 - life * h * 0.85;
      g.fillStyle(life < 0.3 ? this.lit(c, 0.6) : c, (1 - life) * (0.25 + 0.65 * p));
      g.fillRect(Math.round(ex), Math.round(ey), 1, 1);
    }
  }

  /** a "V" (dir 1) or "^" (dir -1) chevron centred on x,y */
  private chevron(x: number, y: number, size: number, dir: 1 | -1, color: number, a: number) {
    const g = this.g;
    g.fillStyle(color, a);
    for (let i = 0; i <= size; i++) {
      g.fillRect(Math.round(x - size + i), Math.round(y + dir * i), 1, 1);
      g.fillRect(Math.round(x + size - i), Math.round(y + dir * i), 1, 1);
    }
  }

  /** overhead smash into the floor: heat + chevrons falling onto the zone */
  private slam(z: Zone, p: number, t: number, c: number, pulse: number) {
    this.heat(z, p, c, pulse);
    this.edges(z, p, c, Math.min(z.bottom - z.top, 10 + 18 * p));
    this.embers(z, p, t, c, Math.max(3, Math.round(z.w / 9)), 0.35 + p * 1.1);
    const cx = z.x + z.w / 2;
    const h = z.bottom - z.top;
    for (let i = 0; i < 3; i++) {
      const k = (t * (0.8 + p * 1.6) + i / 3) % 1;
      this.chevron(cx, z.top - 6 + k * (h * 0.7), 5, 1, this.lit(c, 0.35), (0.2 + 0.6 * p) * Math.sin(k * Math.PI));
    }
  }

  /** low sweep along the floor: streaks racing in the swing direction, "^" marks = jump it */
  private low(z: Zone, p: number, t: number, c: number, pulse: number, facing: number) {
    const g = this.g;
    const h = Math.max(6, z.bottom - z.top);
    g.fillStyle(c, (0.05 + 0.16 * p) * pulse);
    g.fillRect(z.x, z.top, z.w, h);
    const lanes = Math.max(3, Math.round(h / 5));
    for (let i = 0; i < lanes; i++) {
      const y = Math.round(z.top + ((i + 0.5) * h) / lanes);
      const len = 6 + hash(i, 4) * 10;
      const k = (t * (0.9 + p * 2.2) * (0.7 + hash(i, 5) * 0.6) + hash(i, 6)) % 1;
      const sx = facing > 0 ? z.x + k * (z.w + len) - len : z.x + z.w - k * (z.w + len);
      const x0 = Math.max(z.x, sx);
      const x1 = Math.min(z.x + z.w, sx + len);
      if (x1 > x0) {
        g.fillStyle(this.lit(c, 0.4), 0.25 + 0.6 * p);
        g.fillRect(x0, y, x1 - x0, 1);
      }
    }
    // jump cue: chevrons pointing up, hopping, brighter and faster at the end
    const n = Math.max(2, Math.round(z.w / 28));
    const hop = Math.abs(Math.sin(t * (4 + p * 10))) * 3;
    for (let i = 0; i < n; i++) {
      const cx = z.x + ((i + 0.5) * z.w) / n;
      this.chevron(cx, z.top - 5 - hop, 3, -1, this.lit(c, p > 0.85 ? 0.8 : 0.3), 0.3 + 0.6 * p);
    }
    this.edges(z, p, c, h);
  }

  /** tall/overhead slash: violet haze and slashes that draw themselves across the zone */
  private high(z: Zone, p: number, t: number, c: number, pulse: number, facing: number) {
    const g = this.g;
    const h = Math.max(8, z.bottom - z.top);
    g.fillStyle(c, (0.03 + 0.12 * p) * pulse);
    g.fillRect(z.x, z.top, z.w, h);
    const n = 3;
    for (let i = 0; i < n; i++) {
      // each slash starts a little later and grows to full length as p → 1
      const k = Phaser.Math.Clamp(p * 1.4 - i * 0.18, 0, 1);
      if (k <= 0) continue;
      const x0 = z.x + ((i + 0.5) * z.w) / n - (facing * z.w) / 6;
      const len = h * 0.9 * k;
      const steps = Math.round(len);
      for (let s = 0; s < steps; s++) {
        const fade = s / Math.max(1, steps);
        const x = x0 + facing * s * 0.55;
        const y = z.top + h * 0.05 + s;
        g.fillStyle(this.lit(c, 0.5 - fade * 0.4), (0.3 + 0.6 * p) * (0.5 + fade * 0.5));
        g.fillRect(Math.round(x), Math.round(y), 2, 1);
      }
    }
    // floor seam: the slash comes all the way down
    g.fillStyle(this.lit(c, 0.3), (0.2 + 0.5 * p) * pulse);
    g.fillRect(z.x, z.bottom - 1, z.w, 1);
  }

  /** landing mark: rings closing in on the landing point, a beam from above */
  private leap(z: Zone, p: number, t: number, c: number, pulse: number) {
    const g = this.g;
    const cx = z.x + z.w / 2;
    const y = z.bottom - 1;
    this.heat(z, p, c, pulse, 0.6);
    for (let i = 0; i < 3; i++) {
      const k = (1 - ((t * (0.7 + p) + i / 3) % 1)) * (1 - p * 0.5);
      const rw = z.w * (0.25 + 0.75 * k);
      g.lineStyle(1, this.lit(c, 0.3), (0.25 + 0.6 * p) * (1 - k * 0.6));
      g.strokeEllipse(cx, y, rw, Math.max(3, rw * 0.18));
    }
    // crosshair ticks
    g.fillStyle(this.lit(c, 0.5), 0.4 + 0.5 * p);
    g.fillRect(cx - 1, y - 6, 2, 4);
    g.fillRect(cx - z.w / 2 - 4, y, 4, 1);
    g.fillRect(cx + z.w / 2, y, 4, 1);
    // beam from above, solid near the end
    const top = z.top - 40;
    for (let yy = top; yy < y - 6; yy += 3) g.fillStyle(c, (0.05 + 0.25 * p) * ((yy - top) / (y - top))).fillRect(cx - 1, yy, 2, 2);
  }

  /** where it will rise: cold column of light, wisps, a dark ring on the floor */
  private blink(z: Zone, p: number, t: number, c: number, pulse: number) {
    const g = this.g;
    const cx = z.x + z.w / 2;
    const h = Math.max(8, z.bottom - z.top);
    const cw = 6 + 10 * p;
    for (let i = 0; i < 8; i++) {
      const k = i / 8;
      g.fillStyle(c, (0.05 + 0.2 * p) * (1 - k) * pulse);
      g.fillRect(cx - cw / 2, z.bottom - (i + 1) * (h / 8), cw, h / 8 + 0.5);
    }
    g.lineStyle(1, this.lit(c, 0.3), 0.3 + 0.5 * p);
    g.strokeEllipse(cx, z.bottom - 1, z.w * (0.5 + 0.3 * p), 4);
    for (let i = 0; i < 6; i++) {
      const life = (t * (0.5 + p) * (0.7 + hash(i, 7) * 0.6) + hash(i, 8)) % 1;
      const x = cx + (hash(i, 9) - 0.5) * z.w * 0.6 + Math.sin(t * 4 + i * 2) * 3;
      g.fillStyle(this.lit(c, 0.5), (1 - life) * (0.3 + 0.6 * p));
      g.fillRect(Math.round(x), Math.round(z.bottom - 2 - life * h), 1, 2);
    }
  }

  /** ground wave: heat across the whole reach, arrows racing outward from the middle – run */
  private wave(z: Zone, p: number, t: number, c: number, pulse: number) {
    this.heat(z, p, c, pulse);
    this.edges(z, p, c, Math.min(z.bottom - z.top, 12 + 20 * p));
    this.embers(z, p, t, c, Math.max(4, Math.round(z.w / 12)), 0.5 + p);
    const g = this.g;
    const cx = z.x + z.w / 2;
    const y = z.bottom - 8;
    for (let i = 0; i < 4; i++) {
      const k = (t * (0.5 + p * 1.2) + i / 4) % 1;
      const d = 16 + k * (z.w / 2 - 22);
      const a = (0.25 + 0.6 * p) * Math.sin(k * Math.PI);
      for (const dir of [-1, 1]) {
        // ">" pointing away from the boss
        g.fillStyle(this.lit(c, 0.45), a);
        for (let s = 0; s <= 4; s++) {
          g.fillRect(Math.round(cx + dir * (d + s)), Math.round(y - 4 + s), 1, 1);
          g.fillRect(Math.round(cx + dir * (d + s)), Math.round(y + 4 - s), 1, 1);
        }
      }
    }
  }

  /** a thrust you can parry: a thin lance of light at chest height, shield brackets on the tip */
  private pierce(z: Zone, p: number, t: number, c: number, pulse: number, facing: number) {
    const g = this.g;
    const y = Math.round(z.top + (z.bottom - z.top) * 0.45);
    const len = z.w * Math.min(1, 0.3 + p * 0.9);
    const x0 = facing > 0 ? z.x : z.x + z.w - len;
    g.fillStyle(c, (0.08 + 0.22 * p) * pulse);
    g.fillRect(x0, y - 2, len, 5);
    g.fillStyle(this.lit(c, 0.6), 0.35 + 0.6 * p);
    g.fillRect(x0, y, len, 1);
    // the tip: a small shield shape = "parry this"
    const tx = facing > 0 ? x0 + len : x0;
    const a = 0.4 + 0.6 * p * (0.7 + 0.3 * Math.sin(t * 18));
    g.fillStyle(this.lit(c, 0.5), a);
    g.fillRect(tx - 3, y - 6, 7, 1);
    g.fillRect(tx - 3, y - 6, 1, 7);
    g.fillRect(tx + 3, y - 6, 1, 7);
    g.fillRect(tx - 2, y + 1, 1, 2);
    g.fillRect(tx + 2, y + 1, 1, 2);
    g.fillRect(tx - 1, y + 3, 3, 1);
    g.fillRect(tx, y + 4, 1, 1);
  }

  /** frost burst around the caster: rings swelling to the edge of the zone, flakes drifting */
  private nova(z: Zone, p: number, t: number, c: number, pulse: number) {
    const g = this.g;
    const cx = z.x + z.w / 2;
    const y = z.bottom - 1;
    this.heat(z, p, c, pulse, 0.7);
    for (let i = 0; i < 3; i++) {
      const k = (t * (0.6 + p * 1.4) + i / 3) % 1;
      const rw = z.w * k;
      g.lineStyle(1, this.lit(c, 0.4), (0.2 + 0.6 * p) * (1 - k));
      g.strokeEllipse(cx, y - (z.bottom - z.top) * 0.4, rw, (z.bottom - z.top) * 0.9 * k);
    }
    this.edges(z, p, c, Math.min(z.bottom - z.top, 10 + 20 * p));
    for (let i = 0; i < 10; i++) {
      const life = (t * 0.6 * (0.7 + hash(i, 11) * 0.6) + hash(i, 12)) % 1;
      const x = z.x + hash(i, 13) * z.w + Math.sin(t * 2 + i) * 2;
      g.fillStyle(0xffffff, (1 - life) * (0.3 + 0.5 * p));
      g.fillRect(Math.round(x), Math.round(z.top + life * (z.bottom - z.top)), 1, 1);
    }
  }

  /** lobbed globs: brackets closing in on the spot under you */
  private spit(z: Zone, p: number, t: number, c: number) {
    const g = this.g;
    const cx = z.x + z.w / 2;
    const y = z.bottom - 1;
    const r = 4 + (1 - p) * 10;
    const a = 0.35 + 0.55 * p;
    g.fillStyle(this.lit(c, 0.2), a);
    for (const dir of [-1, 1]) {
      const x = cx + dir * r;
      g.fillRect(Math.round(x - (dir > 0 ? 3 : 0)), y, 4, 1);
      g.fillRect(Math.round(dir > 0 ? x : x), y - 4, 1, 5);
    }
    g.fillStyle(c, (0.1 + 0.25 * p) * (0.8 + 0.2 * Math.sin(t * 20)));
    g.fillEllipse(cx, y, r * 2, 3);
  }

  /** soft cream line filling in from both ends; white for the last moment */
  private timer(x: number, w: number, groundY: number, p: number) {
    const g = this.g;
    const fill = (w / 2) * p;
    const late = p > 0.85;
    g.fillStyle(0x201810, 0.18);
    g.fillRect(x, groundY - 2, w, 2);
    g.fillStyle(late ? 0xffffff : 0xffe2a8, late ? 0.75 : 0.42);
    g.fillRect(x, groundY - 2, fill, 2);
    g.fillRect(x + w - fill, groundY - 2, fill, 2);
  }

  /** brief flash in the attack's colour when it lands */
  strike(rect: Phaser.Geom.Rectangle, tell: Tell = 'slam') {
    const g = this.g;
    this.flashT = 0.16;
    g.clear();
    g.setAlpha(1);
    if (tell === 'spit') return;
    const c = TELL_COLOR[tell];
    const h = rect.height;
    const bands = Math.max(5, Math.round(h / 3));
    for (let i = 0; i < bands; i++) {
      const k = i / bands;
      g.fillStyle(this.lit(c, k < 0.3 ? 0.8 : 0.35), 0.45 * Math.pow(1 - k, 1.4));
      g.fillRect(rect.x, rect.bottom - ((i + 1) * h) / bands, rect.width, h / bands + 0.5);
    }
  }

  /** returns false once the flash is over (caller destroys it) */
  tick(dt: number) {
    if (this.flashT <= 0) return true;
    this.flashT -= dt;
    this.g.setAlpha(Math.max(0, this.flashT / 0.16));
    return this.flashT > 0;
  }

  destroy() {
    this.g.destroy();
  }
}

interface Zone {
  x: number;
  w: number;
  top: number;
  bottom: number;
}

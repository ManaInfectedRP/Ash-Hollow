import Phaser from 'phaser';
import { DEPTH } from '../constants';
import type { Element } from './attacks';
import type { Light } from './Lighting';

/** grip → blade start / tip, in px along the weapon (sheets point right, pivot = grip) */
const REACH: Record<string, [number, number]> = {
  longsword: [4, 15],
  shortsword: [4, 10],
  dagger: [3, 7],
  greataxe: [9, 15],
  rapier: [5, 14],
  bone_scythe: [8, 20],
};

/** outer colour, hot core colour, strength of the tracer */
const LOOK: Record<Element, { outer: number; core: number; alpha: number }> = {
  fire: { outer: 0xff4a0a, core: 0xffd27a, alpha: 0.6 },
  cold: { outer: 0x4aa8ff, core: 0xe4f8ff, alpha: 0.42 },
  poison: { outer: 0x3a9a1a, core: 0xb8f070, alpha: 0.32 },
};

/** how long a tracer sample lingers (s) */
const LIFE = 0.14;
/** max angle per tracer segment before it's subdivided (rad) – keeps arcs round */
const SUB = 0.12;

interface Sample {
  gx: number;
  gy: number;
  /** world angle of the blade (rad) */
  a: number;
  t: number;
}

export interface BladePose {
  visible: boolean;
  swinging: boolean;
  /** grip position (world) */
  x: number;
  y: number;
  /** bone angle in degrees (sheet space, before mirroring) */
  angle: number;
  facing: number;
}

/**
 * Elemental blade effects for the player's weapon: a swept tracer ribbon behind every swing of an
 * infused weapon, and for fire blades a constant glow (shader glow on the sprite, a warm halo drawn
 * above the darkness and a light that pushes the darkness back).
 */
export class BladeFx {
  private g: Phaser.GameObjects.Graphics;
  private halo: Phaser.GameObjects.Image;
  private samples: Sample[] = [];
  private glow: Phaser.FX.Glow | null = null;
  private element: Element | null = null;
  private reach: [number, number] = [4, 12];
  private t = 0;
  private lit: { x: number; y: number } | null = null;

  constructor(
    scene: Phaser.Scene,
    private sprite: Phaser.GameObjects.Image,
  ) {
    this.g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.FG + 3);
    this.halo = scene.add
      .image(0, 0, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xff7a28)
      .setDepth(DEPTH.FG + 3)
      .setVisible(false);
  }

  /** switch weapons: base sheet id ('flame_longsword' → 'longsword') and its infusion */
  setWeapon(sheetId: string, element: Element | null) {
    this.reach = REACH[sheetId.replace(/^(flame|frost|venom)_/, '')] ?? [4, 12];
    if (element === this.element) return;
    this.element = element;
    this.samples.length = 0;
    const fx = this.sprite.preFX;
    if (this.glow && fx) {
      fx.remove(this.glow);
      this.glow = null;
    }
    if (element === 'fire' && fx) {
      fx.setPadding(4);
      this.glow = fx.addGlow(0xff6a1a, 2, 0, false, 0.1, 6);
    }
  }

  /** the blade's light (fire only) for the darkness layer */
  light(): Light | null {
    return this.lit ? { x: this.lit.x, y: this.lit.y, r: 44, flicker: 0.18 } : null;
  }

  /** a random point along the blade (for ember motes) */
  pointOnBlade(p: BladePose) {
    const a = this.worldAngle(p);
    const d = Phaser.Math.FloatBetween(this.reach[0], this.reach[1]);
    return { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
  }

  update(dt: number, p: BladePose) {
    this.t += dt;
    for (const s of this.samples) s.t += dt;
    while (this.samples.length && this.samples[0].t > LIFE) this.samples.shift();

    const el = this.element;
    const show = !!el && p.visible;
    // between swings the old samples just age out
    if (show && p.swinging) this.samples.push({ gx: p.x, gy: p.y, a: this.worldAngle(p), t: 0 });
    this.drawTracer();

    // fire: the blade glows and gives light
    const fire = show && el === 'fire';
    this.halo.setVisible(fire);
    this.lit = null;
    if (!fire) return;
    const a = this.worldAngle(p);
    const mid = (this.reach[0] + this.reach[1]) / 2;
    const x = p.x + Math.cos(a) * mid;
    const y = p.y + Math.sin(a) * mid;
    const flick = Math.sin(this.t * 23) * 0.5 + Math.sin(this.t * 37 + 1) * 0.5;
    this.halo
      .setPosition(x, y)
      .setScale(0.3 + flick * 0.02 + (p.swinging ? 0.06 : 0))
      .setAlpha(0.42 + flick * 0.08);
    if (this.glow) this.glow.outerStrength = 2 + flick * 0.6 + (p.swinging ? 1 : 0);
    this.lit = { x, y };
  }

  private worldAngle(p: BladePose) {
    const a = Phaser.Math.DegToRad(p.angle);
    return p.facing < 0 ? Math.PI - a : a;
  }

  private drawTracer() {
    const g = this.g;
    g.clear();
    const el = this.element;
    if (!el || this.samples.length < 2) return;
    const look = LOOK[el];
    const [r0, r1] = this.reach;
    const rc = r0 + (r1 - r0) * 0.55;
    for (let i = 1; i < this.samples.length; i++) {
      const s0 = this.samples[i - 1];
      const s1 = this.samples[i];
      const da = Phaser.Math.Angle.Wrap(s1.a - s0.a);
      if (Math.abs(da) < 0.01 && Math.hypot(s1.gx - s0.gx, s1.gy - s0.gy) < 0.5) continue;
      const n = Math.max(1, Math.ceil(Math.abs(da) / SUB));
      for (let k = 0; k < n; k++) {
        const u0 = k / n;
        const u1 = (k + 1) / n;
        const life = 1 - Phaser.Math.Linear(s0.t, s1.t, (u0 + u1) / 2) / LIFE;
        if (life <= 0) continue;
        const A = this.at(s0, s1, da, u0);
        const B = this.at(s0, s1, da, u1);
        // outer ribbon over the whole blade, hot core near the tip
        g.fillStyle(look.outer, look.alpha * life);
        this.quad(A, B, r0, r1);
        g.fillStyle(look.core, look.alpha * life * life);
        this.quad(A, B, rc, r1);
      }
    }
  }

  private at(s0: Sample, s1: Sample, da: number, u: number) {
    return { x: s0.gx + (s1.gx - s0.gx) * u, y: s0.gy + (s1.gy - s0.gy) * u, a: s0.a + da * u };
  }

  private quad(A: { x: number; y: number; a: number }, B: { x: number; y: number; a: number }, ri: number, ro: number) {
    const ca = Math.cos(A.a), sa = Math.sin(A.a), cb = Math.cos(B.a), sb = Math.sin(B.a);
    this.g.fillPoints(
      [
        { x: A.x + ca * ri, y: A.y + sa * ri },
        { x: A.x + ca * ro, y: A.y + sa * ro },
        { x: B.x + cb * ro, y: B.y + sb * ro },
        { x: B.x + cb * ri, y: B.y + sb * ri },
      ],
      true,
    );
  }
}

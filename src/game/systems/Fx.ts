import Phaser from 'phaser';
import { DEPTH } from '../constants';

/** Pooled particle emitters (one per effect type) – cheap enough for mobile. */
export class Fx {
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private blood: Phaser.GameObjects.Particles.ParticleEmitter;
  private dustE: Phaser.GameObjects.Particles.ParticleEmitter;
  private healE: Phaser.GameObjects.Particles.ParticleEmitter;
  private embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private frostE: Phaser.GameObjects.Particles.ParticleEmitter;
  private poisonE: Phaser.GameObjects.Particles.ParticleEmitter;
  private cloudE: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private scene: Phaser.Scene) {
    this.sparks = scene.add
      .particles(0, 0, 'spark', {
        lifespan: { min: 100, max: 260 },
        speed: { min: 80, max: 240 },
        angle: { min: 0, max: 360 },
        scale: { start: 1, end: 0 },
        gravityY: 300,
        tint: [0xffffff, 0xffe08a, 0xffb040],
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(DEPTH.FX);
    this.blood = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 300, max: 650 },
        speed: { min: 40, max: 170 },
        angle: { min: 200, max: 340 },
        gravityY: 650,
        scale: { start: 1.2, end: 0.5 },
        tint: [0x8a0d12, 0x5e0a0e, 0xb01820],
        emitting: false,
      })
      .setDepth(DEPTH.FX);
    this.dustE = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 300, max: 550 },
        speedX: { min: -45, max: 45 },
        speedY: { min: -30, max: -5 },
        scale: { start: 1.6, end: 0.4 },
        alpha: { start: 0.6, end: 0 },
        tint: 0x8a8378,
        emitting: false,
      })
      .setDepth(DEPTH.FX);
    this.healE = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 600, max: 1000 },
        speedX: { min: -15, max: 15 },
        speedY: { min: -45, max: -20 },
        scale: { start: 1, end: 0.2 },
        alpha: { start: 1, end: 0 },
        tint: [0xffc060, 0xfff3a0],
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(DEPTH.FX);
    this.embers = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 500, max: 1100 },
        speed: { min: 20, max: 110 },
        angle: { min: 200, max: 340 },
        gravityY: -30,
        scale: { start: 1, end: 0 },
        tint: [0xff6a1a, 0xffa030, 0xffe08a],
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(DEPTH.FX);
    // frost: pale flakes drifting down
    this.frostE = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 500, max: 900 },
        speedX: { min: -25, max: 25 },
        speedY: { min: -20, max: 25 },
        gravityY: 40,
        scale: { start: 1.1, end: 0.3 },
        alpha: { start: 1, end: 0 },
        tint: [0xd8f4ff, 0x9ad4ff, 0xffffff],
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(DEPTH.FX);
    // cloud puffs: soft white blobs that swell and fade
    this.cloudE = scene.add
      .particles(0, 0, 'glow-soul', {
        lifespan: { min: 500, max: 900 },
        speedX: { min: -14, max: 14 },
        speedY: { min: -10, max: 6 },
        scale: { start: 0.25, end: 0.6 },
        alpha: { start: 0.7, end: 0 },
        tint: [0xffffff, 0xeaf4ff],
        emitting: false,
      })
      .setDepth(DEPTH.FX);
    // poison: green bubbles rising
    this.poisonE = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 600, max: 1000 },
        speedX: { min: -12, max: 12 },
        speedY: { min: -40, max: -15 },
        scale: { start: 0.6, end: 1.4 },
        alpha: { start: 0.9, end: 0 },
        tint: [0x7ae04a, 0xb4f070, 0x4a9a2a],
        emitting: false,
      })
      .setDepth(DEPTH.FX);
  }

  /** a soft white puff (cloud platforms, the White Cloak) */
  cloud(x: number, y: number, n = 1) {
    this.cloudE.explode(n, x, y);
  }

  /** elemental motes: fire embers, frost flakes or poison bubbles */
  status(x: number, y: number, kind: 'fire' | 'cold' | 'poison', n = 4) {
    if (kind === 'fire') this.embers.explode(n, x, y);
    else if (kind === 'cold') this.frostE.explode(n, x, y);
    else this.poisonE.explode(n, x, y);
  }

  /**
   * Frost kill: break the sprite's current frame into pieces that fly apart, tumble, bounce off the
   * floor at the sprite's feet and melt away, with a burst of frost. The source sprite is untouched
   * (hide it yourself). Expects origin (0.5, 1).
   */
  shatter(src: Phaser.GameObjects.Sprite, dir = 0) {
    const scene = this.scene;
    const key = src.texture.key;
    const frame = src.frame.name;
    const fw = src.frame.width;
    const fh = src.frame.height;
    const sx = src.flipX ? -1 : 1;
    const floor = src.y;
    // piece size: small bodies break finer; never more than ~48 pieces
    const cell = Math.max(4, Math.round(Math.sqrt((fw * fh) / 160)));
    const cx = src.x;
    const cy = src.y - fh / 2;
    const tex = scene.textures;
    type Piece = { img: Phaser.GameObjects.Image; vx: number; vy: number; spin: number; bounced: number };
    const pieces: Piece[] = [];
    for (let y = 0; y < fh; y += cell) {
      for (let x = 0; x < fw; x += cell) {
        const w = Math.min(cell, fw - x);
        const h = Math.min(cell, fh - y);
        // skip empty cells (check a few points)
        let solid = 0;
        for (const [px, py] of [[0.5, 0.5], [0.2, 0.2], [0.8, 0.8], [0.8, 0.2], [0.2, 0.8]])
          if (tex.getPixelAlpha(Math.floor(x + w * px), Math.floor(y + h * py), key, frame) > 40) solid++;
        if (solid < 2 || pieces.length >= 48) continue;
        const wx = src.x + (x + w / 2 - fw / 2) * sx;
        const wy = src.y - fh + y + h / 2;
        const img = scene.add
          .image(wx, wy, key, frame)
          .setCrop(x, y, w, h)
          .setOrigin((x + w / 2) / fw, (y + h / 2) / fh)
          .setScale(sx, 1)
          // solid ice: each shard is a pale-to-blue faceted chip of the frozen body
          .setTintFill(0xf2fbff, 0xc4ecff, 0x6ab4f0, 0x9ad4ff)
          .setDepth(DEPTH.FX);
        // fly out from the body's centre, kicked along the blow
        const ox = (wx - cx) / (fw / 2);
        const oy = (wy - cy) / (fh / 2);
        pieces.push({
          img,
          vx: ox * Phaser.Math.Between(50, 110) + dir * 45 + Phaser.Math.Between(-25, 25),
          vy: oy * 50 - Phaser.Math.Between(70, 170),
          spin: Phaser.Math.FloatBetween(-14, 14),
          bounced: 0,
        });
      }
    }
    this.frostE.explode(36, src.x, cy);
    this.sparks.explode(10, src.x, cy);
    let t = 0;
    const LIFE = 1.3;
    const tick = (_time: number, delta: number) => {
      const dt = Math.min(delta / 1000, 0.05);
      t += dt;
      for (const p of pieces) {
        p.vy += 520 * dt;
        p.img.x += p.vx * dt;
        p.img.y += p.vy * dt;
        p.img.rotation += p.spin * dt;
        if (p.img.y > floor - 1 && p.vy > 0) {
          p.img.y = floor - 1;
          if (p.bounced++ < 2) {
            p.vy *= -0.32;
            p.vx *= 0.55;
            p.spin *= 0.5;
          } else {
            p.vy = 0;
            p.vx *= 0.8;
            p.spin = 0;
          }
        }
        if (t > LIFE * 0.55) p.img.setAlpha(Math.max(0, 1 - (t - LIFE * 0.55) / (LIFE * 0.45)));
      }
      if (t >= LIFE) {
        scene.events.off('update', tick);
        for (const p of pieces) p.img.destroy();
      }
    };
    scene.events.on('update', tick);
    scene.events.once('shutdown', () => scene.events.off('update', tick));
  }

  hit(x: number, y: number, heavy: boolean) {
    this.sparks.explode(heavy ? 14 : 8, x, y);
    this.blood.explode(heavy ? 12 : 6, x, y);
  }
  clang(x: number, y: number) {
    this.sparks.explode(18, x, y);
  }
  bleed(x: number, y: number, n = 10) {
    this.blood.explode(n, x, y);
  }
  dust(x: number, y: number, n = 6) {
    this.dustE.explode(n, x, y);
  }
  heal(x: number, y: number) {
    this.healE.explode(24, x, y);
  }
  ember(x: number, y: number, n = 20) {
    this.embers.explode(n, x, y);
  }

  /** Soul wisps that fly from (x,y) to a moving target, then call onArrive once. */
  soulsTo(x: number, y: number, target: () => { x: number; y: number }, onArrive: () => void, n = 6) {
    let arrived = false;
    for (let i = 0; i < n; i++) {
      const w = this.scene.add.image(x, y, 'wisp').setBlendMode('ADD').setDepth(DEPTH.FX);
      const ox = Phaser.Math.Between(-30, 30);
      const oy = Phaser.Math.Between(-40, -10);
      const state = { t: 0 };
      this.scene.tweens.add({
        targets: state,
        t: 1,
        delay: i * 40,
        duration: 650,
        ease: 'Sine.easeIn',
        onUpdate: () => {
          const tg = target();
          const t = state.t;
          const cx = x + ox;
          const cy = y + oy;
          w.x = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * tg.x;
          w.y = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * tg.y;
        },
        onComplete: () => {
          w.destroy();
          if (!arrived) {
            arrived = true;
            onArrive();
          }
        },
      });
    }
  }
}

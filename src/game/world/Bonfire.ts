import Phaser from 'phaser';
import { DEPTH } from '../constants';

export class Bonfire {
  sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Image;
  private embers: Phaser.GameObjects.Particles.ParticleEmitter;
  lit = false;
  private t = Math.random() * 10;

  constructor(scene: Phaser.Scene, public id: string, public x: number, public y: number, lit: boolean) {
    this.glow = scene.add.image(x, y - 10, 'glow').setBlendMode('ADD').setAlpha(0).setDepth(DEPTH.ITEMS - 1).setScale(1.6);
    this.sprite = scene.add.sprite(x, y, 'bonfire', 'f0').setOrigin(0.5, 1).setDepth(DEPTH.ITEMS);
    this.embers = scene.add
      .particles(x, y - 10, 'px', {
        frequency: 140,
        lifespan: { min: 800, max: 1500 },
        speedX: { min: -8, max: 8 },
        speedY: { min: -40, max: -18 },
        scale: { start: 0.8, end: 0 },
        tint: [0xffa040, 0xffd080, 0xff6a1a],
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(DEPTH.ITEMS + 1);
    if (lit) this.light();
  }

  light() {
    this.lit = true;
    this.embers.start();
    this.glow.setAlpha(0.55);
  }

  update(dt: number) {
    this.t += dt;
    if (!this.lit) {
      this.sprite.setFrame('f0');
      return;
    }
    this.sprite.setFrame(`f${1 + (Math.floor(this.t * 9) % 4)}`);
    this.glow.setAlpha(0.5 + Math.sin(this.t * 7) * 0.05 + Math.sin(this.t * 13) * 0.04);
  }
}

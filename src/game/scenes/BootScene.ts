import Phaser from 'phaser';
import { buildEnvironment } from '../gfx/environment';
import { preloadSprites } from '../gfx/sprites';

/** Loads baked character atlases + atlas item/prop sprites, generates environment art, then starts the game. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    preloadSprites(this.load);
  }

  create() {
    buildEnvironment(this);
    this.scene.start('Title');
  }
}

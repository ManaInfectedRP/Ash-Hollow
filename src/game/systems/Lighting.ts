import Phaser from 'phaser';
import { DEPTH } from '../constants';

export interface Light {
  x: number;
  y: number;
  /** radius in px */
  r: number;
  /** 0..1, how much the radius flickers */
  flicker?: number;
}

/**
 * Darkness overlay with soft light holes.
 * A screen-sized RenderTexture is filled with darkness every frame and each light erases a radial
 * gradient out of it. Colour still comes from the additive glow sprites in the world – this layer only
 * decides what is visible. Cost: one fill + one erase per visible light, fine on mobile.
 */
export class Lighting {
  private rt: Phaser.GameObjects.RenderTexture;
  private brush: Phaser.GameObjects.Image;
  private statics: (() => Light | null)[] = [];
  private t = 0;

  constructor(private scene: Phaser.Scene, private darkness: number, private color = 0x05040a) {
    const { width, height } = scene.scale;
    this.rt = scene.add.renderTexture(0, 0, width, height).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.FG + 2);
    this.brush = scene.make.image({ key: 'light', add: false });
    scene.scale.on('resize', this.onResize, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off('resize', this.onResize, this));
  }

  private onResize(size: Phaser.Structs.Size) {
    this.rt.resize(size.width, size.height);
  }

  /** change how dark it is (and the colour of the dark) – e.g. a sandstorm rolling in */
  setDarkness(darkness: number, color = 0x05040a) {
    this.darkness = darkness;
    this.color = color;
  }

  /** a light that lives as long as the scene; return null to switch it off for a frame */
  add(get: () => Light | null) {
    this.statics.push(get);
  }

  update(dt: number, dynamic: Light[] = []) {
    this.t += dt;
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    this.rt.clear();
    this.rt.fill(this.color, this.darkness);
    const draw = (l: Light | null, i: number) => {
      if (!l || l.r <= 0) return;
      if (l.x + l.r < view.x || l.x - l.r > view.right || l.y + l.r < view.y || l.y - l.r > view.bottom) return;
      const f = l.flicker ? 1 + Math.sin(this.t * 11 + i * 1.7) * l.flicker * 0.6 + Math.sin(this.t * 23 + i) * l.flicker * 0.4 : 1;
      this.brush.setScale((l.r * 2 * f) / this.brush.width);
      this.rt.erase(this.brush, l.x - cam.scrollX, l.y - cam.scrollY);
    };
    this.statics.forEach((get, i) => draw(get(), i));
    dynamic.forEach((l, i) => draw(l, i + 100));
  }
}

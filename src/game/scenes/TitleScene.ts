import Phaser from 'phaser';
import { DEPTH, T, TILE } from '../constants';
import { EventBus } from '../EventBus';
import { Bonfire } from '../world/Bonfire';
import { Lighting } from '../systems/Lighting';
import { sfx } from '../systems/Sfx';
import { useGameStore } from '../../stores/gameStore';

/**
 * Backdrop for the main menu: a lone bonfire under the moon with the knight resting beside it.
 * The menu itself is React (components/Menu/MainMenu.tsx); it emits `ui:start` to begin.
 */
export class TitleScene extends Phaser.Scene {
  private bonfire!: Bonfire;
  private lighting!: Lighting;
  private bg: { s: Phaser.GameObjects.TileSprite; f: number }[] = [];
  private t = 0;

  constructor() {
    super('Title');
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.bg = [];
    useGameStore.setState({ menu: 'title', boss: null, prompt: null, dead: false, paused: false, restOpen: false, invOpen: false, dialogue: null, shop: null, ending: false });

    const sky = this.add.tileSprite(0, 0, w, h, 'bg-sky').setOrigin(0).setScrollFactor(0);
    this.add.image(w * 0.78, 52, 'moon').setScrollFactor(0).setAlpha(0.9);
    this.bg.push({ s: sky, f: 0.02 });
    for (const [key, f] of [['bg-mount', 0.1], ['bg-ruins', 0.3]] as const) this.bg.push({ s: this.add.tileSprite(0, 0, w, h, key).setOrigin(0), f });

    // a strip of ground made of the real tiles
    const cols = Math.ceil(w / TILE) + 2;
    const rows = 4;
    const data = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, () => (r === 0 ? T.TOP : T.STONE)));
    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const ground = h - 44;
    map.createLayer(0, map.addTilesetImage('tiles')!, -TILE, ground)!.setDepth(DEPTH.DECOR);

    // the menu sits on the left, the bonfire scene on the right
    const cx = Math.round(w * 0.68);
    this.bonfire = new Bonfire(this, 'title', cx, ground, true);
    this.add.sprite(cx + 22, ground, 'player-garb', 'kneel').setOrigin(0.5, 1).setFlipX(true).setDepth(DEPTH.PLAYER);
    this.add.image(cx + 26, ground - 2, 'prop:tombstone').setOrigin(0.5, 1).setScale(0.75).setDepth(DEPTH.DECOR + 1);
    this.add.image(cx + 70, ground, 'prop:tombstone_cracked').setOrigin(0.5, 1).setScale(0.75).setDepth(DEPTH.DECOR + 1);

    this.lighting = new Lighting(this, 0.72);
    this.lighting.add(() => ({ x: cx, y: ground - 12, r: 150, flicker: 0.08 }));
    this.lighting.add(() => ({ x: w * 0.78, y: 52, r: 60 }));

    sfx.playMusic('hollow');

    const onStart = (debugAt?: { area: string; at: { x: number; y: number } }) => {
      // Continue reads the save; Start Over has already wiped it
      this.registry.remove('world');
      this.scene.start('Game', debugAt);
    };
    EventBus.on('ui:start', onStart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('ui:start', onStart));
    this.events.once(Phaser.Scenes.Events.DESTROY, () => EventBus.off('ui:start', onStart));
    this.cameras.main.fadeIn(800);
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    this.t += dt;
    this.bonfire.update(dt);
    // a slow drift so the backdrop feels alive
    for (const { s, f } of this.bg) s.tilePositionX = this.t * 12 * f;
    this.lighting.update(dt);
  }
}

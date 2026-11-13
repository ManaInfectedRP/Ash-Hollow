import Phaser from 'phaser';
import { DEPTH } from '../constants';
import { NPCS, type NpcDef } from '../data/npcs';

/** A friendly NPC: idles, turns toward the player, plays a talk frame while in dialogue. */
export class Npc {
  sprite: Phaser.GameObjects.Sprite;
  def: NpcDef;
  talking = false;
  private t = Math.random() * 4;

  constructor(scene: Phaser.Scene, id: string, public x: number, public y: number) {
    this.def = NPCS[id];
    this.sprite = scene.add.sprite(x, y, this.def.sheet, 'idle0').setOrigin(0.5, 1).setDepth(DEPTH.ENEMY - 1);
  }

  update(dt: number, playerX: number) {
    this.t += dt;
    this.sprite.setFlipX(playerX < this.x);
    this.sprite.setFrame(this.talking ? (Math.floor(this.t * 3) % 2 ? 'talk' : 'idle0') : `idle${Math.floor(this.t * 1.2) % 2}`);
  }
}

/** Door between areas. Frame shows whether it can be used right now. */
export class Door {
  sprite: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, public def: import('./builder').DoorDef) {
    this.sprite = scene.add.sprite(def.x, def.y, def.look === 'portal' ? 'portal' : 'door', 'closed').setOrigin(0.5, 1).setDepth(DEPTH.DECOR + 1);
    if (def.look === 'portal') {
      // a slow swirl and bob so it reads as alive
      scene.tweens.add({ targets: this.sprite, y: def.y - 3, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  refresh(usable: boolean) {
    this.sprite.setFrame(usable ? 'open' : this.def.sealed ? 'sealed' : 'closed');
    if (this.def.look === 'portal') this.sprite.setAlpha(usable ? 1 : 0.35);
  }
}

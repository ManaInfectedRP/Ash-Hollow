import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { AttackDef, Box } from './attacks';
import { sfx } from './Sfx';
import type { Enemy } from '../entities/Enemy';
import { useGameStore } from '../../stores/gameStore';
import type { Element } from './attacks';

export interface HitInfo {
  damage: number;
  poise: number;
  dir: number;
  knock: number;
  heavy: boolean;
  /** infused weapon: fire damage, or cold / poison build-up (see Enemy.applyElement) */
  element?: { type: Element; power: number };
}

/** Anything the player can hit. */
export interface Hittable {
  alive: boolean;
  hurtbox(): Phaser.Geom.Rectangle;
  /** returns true if the hit connected */
  takeHit(h: HitInfo): boolean;
}

/**
 * Owns the "feel" of combat: hit resolution, hitstop and screen shake.
 * Hitstop freezes physics + all entity updates (the scene skips them while frozen).
 */
export class CombatSystem {
  private freezeUntil = 0;
  debugBoxes: Phaser.Geom.Rectangle[] = [];

  constructor(private scene: GameScene) {}

  static box(cx: number, cy: number, facing: number, hb: Box) {
    const x = facing > 0 ? cx + hb.x : cx - hb.x - hb.w;
    return new Phaser.Geom.Rectangle(x, cy + hb.y, hb.w, hb.h);
  }

  get frozen() {
    return this.scene.time.now < this.freezeUntil;
  }

  hitstop(seconds: number) {
    this.freezeUntil = Math.max(this.freezeUntil, this.scene.time.now + seconds * 1000);
    this.scene.physics.world.pause();
  }

  /** call every frame before entity updates */
  tick() {
    this.debugBoxes.length = 0;
    if (!this.frozen && this.scene.physics.world.isPaused) this.scene.physics.world.resume();
  }

  shake(intensity: number, ms = 140) {
    if (intensity > 0 && useGameStore.getState().shake) this.scene.cameras.main.shake(ms, intensity);
  }

  /** Player swing vs all targets. Returns number of new targets hit. */
  playerStrike(rect: Phaser.Geom.Rectangle, already: Set<Hittable>, info: HitInfo, hitstop: number, shake: number) {
    this.debugBoxes.push(rect);
    let hits = 0;
    for (const t of this.scene.targets()) {
      if (!t.alive || already.has(t)) continue;
      const hb = t.hurtbox();
      if (!Phaser.Geom.Intersects.RectangleToRectangle(rect, hb)) continue;
      already.add(t);
      if (!t.takeHit(info)) continue;
      hits++;
      const inter = Phaser.Geom.Rectangle.Intersection(rect, hb);
      this.scene.fx.hit(inter.centerX, inter.centerY, info.heavy);
      sfx.hit(info.heavy);
    }
    if (hits) {
      this.hitstop(hitstop);
      this.shake(shake);
    }
    return hits;
  }

  /** Enemy swing vs player. Returns true when it should stop checking (hit landed). */
  enemyStrike(rect: Phaser.Geom.Rectangle, facing: number, def: AttackDef, attacker?: Enemy) {
    this.debugBoxes.push(rect);
    const p = this.scene.player;
    if (!p.alive) return true;
    if (!Phaser.Geom.Intersects.RectangleToRectangle(rect, p.hurtbox())) return false;
    const res = p.takeDamage(def.damage, facing, def.knock, def.poise, {
      attacker,
      parryable: attacker?.cfg.parryable !== false && !def.noParry,
      blockable: true,
      status: def.status,
    });
    if (res === 'dodged') return false; // still active – a late roll can get clipped
    if (res === 'parried') return true; // the player side already did the feedback
    if (res === 'blocked') {
      this.hitstop(def.heavy ? 0.08 : 0.05);
      this.shake(def.heavy ? 0.006 : 0.003);
      return true;
    }
    this.hitstop(def.heavy ? 0.12 : 0.07);
    this.shake(def.heavy ? 0.012 : 0.006, def.heavy ? 220 : 150);
    return true;
  }
}

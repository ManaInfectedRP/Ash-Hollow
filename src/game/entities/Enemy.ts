import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { DEPTH } from '../constants';
import { CombatSystem, type HitInfo, type Hittable } from '../systems/CombatSystem';
import type { AttackDef } from '../systems/attacks';
import { sfx } from '../systems/Sfx';
import { TELL_COLOR, Telegraph } from '../systems/Telegraph';
import type { Element } from '../systems/attacks';
import { useGameStore } from '../../stores/gameStore';

export interface EnemyAttack extends AttackDef {
  /** max distance (body centers) at which the AI starts this attack */
  range: number;
  minRange?: number;
  cooldown: number;
  /** chance to chain into `next` */
  chain?: number;
}

export interface EnemyConfig {
  key: string;
  name: string;
  hp: number;
  poise: number;
  walk: number;
  chase: number;
  aggro: number;
  keepDist: number;
  patrol: number;
  souls: number;
  hyperarmor: boolean;
  knockMul: number;
  body: { w: number; h: number; ox: number; oy: number };
  attacks: Record<string, EnemyAttack>;
  openers: string[];
  /** how far above/below the player can be and still be noticed (px, default 72) */
  vision?: number;
  /** can jump up ledges, across gaps and drop down to follow the player (default true) */
  canJump?: boolean;
  /** elemental damage / build-up multipliers (default 1; 0 = immune, >1 = weak) */
  resist?: Partial<Record<Element, number>>;
  /** can its attacks be parried (default true; bosses are not) */
  parryable?: boolean;
  /**
   * how clearly wind-ups are announced: 'glint' = weapon glint + warning glow + sound,
   * 'zone' = also a danger zone on the ground (bosses). Default: a short tint flash.
   */
  telegraph?: 'glint' | 'zone';
  /** random item drops on death */
  drops?: { item: string; chance: number; qty?: number }[];
}

export type EState = 'patrol' | 'idle' | 'chase' | 'attack' | 'hurt' | 'stagger' | 'dead';

export interface AttackRun {
  def: EnemyAttack;
  t: number;
  hit: boolean;
  swung: boolean;
  chained: boolean;
  /** subclass scratch state */
  phase: number;
  /** wind-up warning has been resolved (strike reached) */
  teleDone?: boolean;
}

/** white -> hot orange as the wind-up nears the strike */
/** wind-up glow: white → the attack's colour as the strike nears (default: hot orange) */
const warnTint = (p: number, color = 0xff5f2d) => {
  const k = Phaser.Math.Clamp(p, 0, 1) * 0.85;
  const mix = (sh: number) => Math.round(255 + (((color >> sh) & 255) - 255) * k);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
};

const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);

export class Enemy implements Hittable {
  sprite: Phaser.Physics.Arcade.Sprite;
  body: Phaser.Physics.Arcade.Body;
  facing: 1 | -1 = -1;
  state: EState = 'patrol';
  hp: number;
  poise: number;
  alive = true;
  /** raised by a boss: no souls/drops, removed when the fight resets */
  summoned = false;
  speedMul = 1;
  staggerTime = 0.9;
  /** > 0 while reeling from a parry: a riposte is possible */
  riposteT = 0;
  /** overrides staggerTime for the current stagger */
  protected staggerFor = 0;
  /** ground danger zone for the current wind-up (telegraph: 'zone') */
  protected tele: Telegraph | null = null;

  protected st = 0;
  protected animT = Math.random() * 3;
  protected atk: AttackRun | null = null;
  protected cooldown = 0.6;
  protected poiseT = 0;
  protected home: number;
  protected collider: Phaser.Physics.Arcade.Collider;
  /** airborne from a navigation jump: horizontal speed is kept and the AI waits for landing */
  protected jumping = false;
  private jumpT = 0;
  private jumpVx = 0;
  /** time spent unable to reach the player; leads to pacing, then giving up */
  protected stuckT = 0;
  /** best (closest) distance score reached during this chase – progress resets stuckT */
  private bestScore = Infinity;
  /** after giving up, ignore the player for a moment so we don't re-aggro instantly */
  protected ignoreT = 0;

  constructor(protected scene: GameScene, public cfg: EnemyConfig, x: number, y: number) {
    this.sprite = scene.physics.add.sprite(x, y, cfg.key, 'idle0').setOrigin(0.5, 1).setDepth(DEPTH.ENEMY);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(cfg.body.w, cfg.body.h).setOffset(cfg.body.ox, cfg.body.oy);
    this.body.setMaxVelocityY(520);
    this.collider = scene.physics.add.collider(this.sprite, scene.layer);
    this.hp = cfg.hp;
    this.poise = cfg.poise;
    this.home = x;
  }

  get x() {
    return this.body.center.x;
  }
  get y() {
    return this.body.center.y;
  }
  get onGround() {
    return this.body.blocked.down;
  }

  hurtbox() {
    return new Phaser.Geom.Rectangle(this.body.x, this.body.y, this.body.width, this.body.height);
  }

  protected edgeAhead(dir: number = this.facing) {
    return !this.scene.isGroundAt(this.x + dir * (this.body.width / 2 + 3), this.body.bottom + 4);
  }
  /** a solid tile right in front of the feet (probed, so it stays true while standing still against it) */
  protected wallAhead(dir: number = this.facing) {
    const fx = this.x + dir * (this.body.width / 2 + 4);
    return (dir > 0 ? this.body.blocked.right : this.body.blocked.left) || this.scene.isSolidAt(fx, this.body.bottom - 4);
  }

  // ------------------------------------------------------------------ elemental status
  /** fire: seconds left burning */
  private burnT = 0;
  private burnDps = 0;
  /** cold / poison build-up (0..100 → proc) */
  private frost = 0;
  private toxin = 0;
  /** frostbite: slowed until this runs out */
  private frostT = 0;
  /** poisoned: seconds left, damage per second */
  private poisonT = 0;
  private poisonDps = 0;
  private dotTick = 0;
  /** what landed the killing blow (a frost kill shatters the body) */
  private killedBy: Element | null = null;
  /** bosses keep their own death */
  protected shatterable = true;
  private frozen = false;

  /** an infused hit landed: fire adds damage now and burns; cold and poison build up to a proc */
  protected applyElement(el: { type: Element; power: number }) {
    const mul = this.cfg.resist?.[el.type] ?? 1;
    if (mul <= 0) {
      if (el.type === 'fire') this.scene.fx.status(this.x, this.y - 4, 'fire', 2);
      return;
    }
    const p = el.power * mul;
    if (el.type === 'fire') {
      this.dot(p, false, 'fire');
      if (this.burnT <= 0) sfx.status('ignite');
      this.burnT = 3;
      this.burnDps = Math.max(this.burnDps, 2 + p * 0.35);
      this.scene.fx.status(this.x, this.y - 4, 'fire', 8);
    } else if (el.type === 'cold') {
      if (this.frostT > 0) return; // can't stack while frostbitten
      this.frost += p;
      this.scene.fx.status(this.x, this.y - 6, 'cold', 4);
      if (this.frost >= 100) {
        this.frost = 0;
        this.frostT = 4;
        sfx.status('frostbite');
        this.scene.fx.status(this.x, this.y - 6, 'cold', 30);
        this.flashStatus(0x9ad4ff, 200);
        this.dot(Math.min(this.cfg.hp * 0.1, 90) + 12, true, 'cold');
      }
    } else {
      if (this.poisonT > 0) {
        this.poisonT = Math.min(10, this.poisonT + 0.5);
        return;
      }
      this.toxin += p;
      this.scene.fx.status(this.x, this.y - 4, 'poison', 3);
      if (this.toxin >= 100) {
        this.toxin = 0;
        this.poisonT = 8;
        this.poisonDps = Phaser.Math.Clamp(this.cfg.hp * 0.012, 3, 14);
        sfx.status('poison');
        this.scene.fx.status(this.x, this.y - 4, 'poison', 20);
        this.flashStatus(0x7ae04a, 200);
      }
    }
  }

  /** damage from an element / damage over time: no flinch, can kill */
  private dot(dmg: number, loud: boolean, el: Element) {
    if (!this.alive || dmg <= 0) return;
    this.hp -= dmg;
    this.onDamaged();
    if (loud) sfx.enemyHurt();
    if (this.hp <= 0) {
      this.killedBy = el;
      this.die(0);
    }
  }

  private flashStatus(color: number, ms: number) {
    this.sprite.setTint(color);
    this.scene.time.delayedCall(ms, () => this.sprite.active && this.alive && this.restoreTint());
  }

  /** ticks burning / poison, decays build-up; returns the speed multiplier (frostbite slows) */
  private updateStatus(dt: number) {
    if (!this.alive) return 1;
    this.frost = Math.max(0, this.frost - 9 * dt);
    this.toxin = Math.max(0, this.toxin - 6 * dt);
    this.frostT = Math.max(0, this.frostT - dt);
    this.dotTick -= dt;
    const burning = this.burnT > 0;
    const poisoned = this.poisonT > 0;
    this.burnT = Math.max(0, this.burnT - dt);
    this.poisonT = Math.max(0, this.poisonT - dt);
    if ((burning || poisoned) && this.dotTick <= 0) {
      this.dotTick = 0.5;
      if (burning) {
        this.dot(this.burnDps * 0.5, false, 'fire');
        this.scene.fx.status(this.x, this.y - 2, 'fire', 4);
        this.flashStatus(0xff8a40, 80);
      }
      if (poisoned && this.alive) {
        this.dot(this.poisonDps * 0.5, false, 'poison');
        this.scene.fx.status(this.x, this.y - 6, 'poison', 3);
        this.flashStatus(0x8ae05a, 80);
      }
    }
    if (!this.burnT) this.burnDps = 0;
    if (this.frostT > 0) {
      if (Math.random() < 6 * dt) this.scene.fx.status(this.x, this.body.top, 'cold', 1);
      return 0.55;
    }
    // a little chill as frost builds up
    return 1 - this.frost * 0.0015;
  }

  update(dt: number) {
    const slow = this.updateStatus(dt);
    this.tick(dt * slow);
    if (slow < 1 && this.alive) this.body.velocity.x *= slow;
  }

  private tick(dt: number) {
    this.st += dt;
    // the swing was interrupted (stagger, hurt, death…) or its strike flash is over: drop the warning
    if (this.tele && (!this.atk || !this.alive || !this.tele.tick(dt))) this.endTelegraph();
    if (!this.alive) {
      this.body.velocity.x = approach(this.body.velocity.x, 0, 400 * dt);
      return;
    }
    this.animT += dt;
    this.cooldown -= dt;
    this.poiseT -= dt;
    this.ignoreT -= dt;
    this.riposteT -= dt;
    if (this.poiseT <= 0) this.poise = this.cfg.poise;

    if (this.jumping) {
      this.jumpT += dt;
      if (this.jumpT > 0.12 && this.onGround) {
        this.jumping = false;
        this.scene.fx.dust(this.x, this.body.bottom, 4);
      } else {
        // walls zero the velocity on contact while rising – keep pushing toward the ledge
        this.body.velocity.x = this.jumpVx;
        this.sprite.setFrame('walk1');
        this.sprite.setFlipX(this.facing < 0);
        return;
      }
    }

    const p = this.scene.player;
    const dx = p.x - this.x;
    const dist = Math.abs(dx);
    const dy = p.feetY - this.body.bottom;
    const sees = p.alive && this.ignoreT <= 0 && dist < this.cfg.aggro && Math.abs(dy) < (this.cfg.vision ?? 72);

    switch (this.state) {
      case 'patrol':
        this.patrol(dt);
        if (sees && (Math.sign(dx) === this.facing || dist < 60)) this.state = 'chase';
        break;
      case 'idle':
        this.body.velocity.x = approach(this.body.velocity.x, 0, 600 * dt);
        if (this.st > 0.8) this.setState('patrol');
        if (sees) this.state = 'chase';
        break;
      case 'chase':
        this.chase(dt, dx, dist, dy);
        break;
      case 'attack':
        this.updateAttack(dt, dx);
        break;
      case 'hurt':
        this.body.velocity.x = approach(this.body.velocity.x, 0, 600 * dt);
        if (this.st > 0.28) this.setState('chase');
        break;
      case 'stagger':
        this.body.velocity.x = approach(this.body.velocity.x, 0, 300 * dt);
        if (this.st > (this.staggerFor || this.staggerTime)) {
          this.staggerFor = 0;
          this.setState('chase');
        }
        break;
      case 'dead':
        break;
    }
    this.animate();
    this.sprite.setFlipX(this.facing < 0);
  }

  protected setState(s: EState) {
    this.state = s;
    this.st = 0;
  }

  protected patrol(dt: number) {
    const tooFar = (this.x - this.home) * this.facing > this.cfg.patrol;
    if (this.wallAhead() || this.edgeAhead() || tooFar) {
      this.facing = this.facing > 0 ? -1 : 1;
      this.setState('idle');
      return;
    }
    this.body.velocity.x = approach(this.body.velocity.x, this.facing * this.cfg.walk, 600 * dt);
  }

  protected chase(dt: number, dx: number, dist: number, dy: number) {
    const p = this.scene.player;
    if (!p.alive || dist > this.cfg.aggro * 1.8 || Math.abs(dy) > 170) return this.giveUp();
    this.facing = dx >= 0 ? 1 : -1;
    // only swing when the player is on (about) the same floor – no more attacking thin air below a ledge
    const level = Math.abs(dy) < 20;
    if (this.cooldown <= 0 && level) {
      const a = this.chooseAttack(dist);
      if (a) return this.startAttack(a);
    }
    let target = dist > this.cfg.keepDist || !level ? this.facing * this.cfg.chase * this.speedMul : 0;
    let blocked = false;
    if (target !== 0 && this.onGround) {
      const nav = this.cfg.canJump === false ? (this.edgeAhead() ? 'blocked' : 'ok') : this.navigate(dx, dy);
      if (nav === 'jumped') return;
      if (nav === 'blocked') {
        target = 0;
        blocked = true;
      }
    }
    // can't get there (cliff, wall, player straight above/below): pace a little, then lose interest.
    // "Stuck" = no real progress toward the player, so pacing back and forth doesn't count as progress.
    const score = dist + Math.abs(dy) * 1.5;
    if (level && dist <= this.cfg.keepDist + 30) {
      this.stuckT = 0;
      this.bestScore = score;
    } else if (score < this.bestScore - 6) {
      this.bestScore = score;
      this.stuckT = 0;
    } else this.stuckT += dt;
    if (this.stuckT > 1 && (blocked || !level)) {
      const backOff = Math.floor((this.stuckT - 1) / 0.9) % 2 === 0;
      target = backOff && !this.edgeAhead(-this.facing) && !this.wallAhead(-this.facing) ? -this.facing * this.cfg.walk : 0;
    }
    if (this.stuckT > 4.5) return this.giveUp();
    this.body.velocity.x = approach(this.body.velocity.x, target, 900 * dt);
  }

  protected giveUp() {
    this.home = this.x;
    this.stuckT = 0;
    this.bestScore = Infinity;
    this.ignoreT = 3;
    this.setState('patrol');
  }

  // ------------------------------------------------------------------ navigation
  /**
   * Decide how to keep following the player in the facing direction:
   * climb a ledge, hop up onto a plank above, drop down a safe cliff, or jump a gap.
   */
  protected navigate(dx: number, dy: number): 'ok' | 'jumped' | 'blocked' {
    const s = this.scene;
    const dir = this.facing;
    const bottom = this.body.bottom;
    const front = this.x + dir * (this.body.width / 2 + 4);

    // 1) a wall: climb it if it's low enough and the player isn't below us
    if (this.wallAhead(dir)) {
      const h = this.ledgeHeight(dir);
      if (h !== null && dy < 10) return this.jumpTo(front + dir * 8, bottom - h, 80);
      return 'blocked';
    }

    // 2) player stands on a plank above us: hop up through it
    if (dy < -20 && Math.abs(dx) < 70) {
      for (const off of [dir * 10, dir * 24, 0]) {
        const cx = this.x + off;
        for (let y = bottom - 20; y >= bottom - 64; y -= 4) {
          if (s.isPlankAt(cx, y) && !s.isGroundAt(cx, y - 8)) return this.jumpTo(cx, Math.floor(y / 16) * 16);
          if (s.isSolidAt(cx, y)) break; // ceiling in the way
        }
      }
    }

    // 3) an edge: drop down when the player is lower and the fall is safe, else look for a landing across
    if (this.edgeAhead(dir)) {
      if (dy > 10 && s.surfaceAt(front + dir * 6, bottom, bottom + 7 * 16) !== null) return 'ok';
      for (let d = 24; d <= 120; d += 8) {
        const lx = this.x + dir * d;
        const ly = s.surfaceAt(lx, bottom - 56, bottom + 64);
        if (ly === null) continue;
        if (ly < bottom - 2 && dy > 10) continue; // don't jump up to a ledge when the player is below
        return this.jumpTo(lx, ly);
      }
      return 'blocked';
    }
    return 'ok';
  }

  /** height (px) of the wall right in front, if it can be jumped onto (≤ ~3.5 tiles with headroom) */
  protected ledgeHeight(dir: number): number | null {
    const s = this.scene;
    const bottom = this.body.bottom;
    const cx = this.x + dir * (this.body.width / 2 + 4);
    let y = bottom - 2;
    if (!s.isSolidAt(cx, y)) return null;
    while (s.isSolidAt(cx, y) && bottom - y < 60) y -= 4;
    const h = bottom - y;
    if (h >= 60) return null;
    // headroom above us and above the ledge
    if (s.isSolidAt(this.x, bottom - this.body.height - h) || s.isSolidAt(cx, y - this.body.height + 4)) return null;
    return h;
  }

  /** ballistic jump so the feet land at (tx, ty) */
  protected jumpTo(tx: number, ty: number, minVx = 0): 'jumped' | 'blocked' {
    const g = this.scene.physics.world.gravity.y;
    const rise = this.body.bottom - ty; // + = landing higher
    const vy0 = -Math.sqrt(2 * g * (Math.max(0, rise) + 18));
    if (vy0 < -440) return 'blocked';
    const drop = -rise;
    const t = (-vy0 + Math.sqrt(vy0 * vy0 + 2 * g * drop)) / g;
    let vx = Phaser.Math.Clamp((tx - this.x) / Math.max(t, 0.2), -210, 210);
    if (Math.abs(vx) < minVx) vx = Math.sign(tx - this.x || this.facing) * minVx;
    this.body.setVelocity(vx, vy0);
    this.jumpVx = vx;
    this.jumping = true;
    this.jumpT = 0;
    this.stuckT = 0;
    this.scene.fx.dust(this.x, this.body.bottom, 4);
    return 'jumped';
  }

  protected chooseAttack(dist: number): EnemyAttack | null {
    const opts = this.cfg.openers.map((id) => this.cfg.attacks[id]).filter((a) => dist <= a.range && dist >= (a.minRange ?? 0));
    return opts.length ? Phaser.Utils.Array.GetRandom(opts) : null;
  }

  protected startAttack(def: EnemyAttack) {
    if (this.cfg.key === 'ghoul' && def.id === 'lunge') sfx.monster();
    this.atk = { def, t: 0, hit: false, swung: false, chained: false, phase: 0 };
    this.setState('attack');
    // each kind of big attack has its own wind-up sound; untagged ones share the rising charge
    if (def.tell) sfx.tell(def.tell);
    const zone = this.cfg.telegraph === 'zone';
    if (this.cfg.telegraph && (def.damage > 0 || (zone && def.tell === 'spit'))) {
      // glint on the weapon + the glow ramps up in updateAttack
      if (def.damage > 0) this.glint();
      if (!def.tell) sfx.charge(zone);
      if (zone) {
        this.tele?.destroy();
        this.tele = new Telegraph(this.scene);
      }
      return;
    }
    if (def.tell) return; // spells with their own effects (bone rain, summons)
    // default: brief hot flash so wind-ups read on a small screen
    this.sprite.setTint(0xff9a70);
    this.scene.time.delayedCall(110, () => this.sprite.active && this.alive && this.restoreTint());
  }

  /** sparkle where the weapon is raised */
  protected glint() {
    const gx = this.x - this.facing * this.body.width * 0.4;
    const gy = this.body.top - 4;
    this.scene.fx.clang(gx, gy);
  }

  /** a tint this enemy always wears (the ash-grey of the finale's foes) */
  baseTint: number | null = null;

  /** clear wind-up tint back to the base look (bosses override to keep their phase colour) */
  protected restoreTint() {
    if (this.baseTint !== null) this.sprite.setTint(this.baseTint);
    else this.sprite.clearTint();
  }

  protected endTelegraph() {
    this.tele?.destroy();
    this.tele = null;
    if (this.alive) this.restoreTint();
  }

  /**
   * per-frame warning while winding up: glow ramp in the attack's colour + its danger zone
   * (groundY = the floor under the zone, defaults to our feet)
   */
  protected updateTelegraph(rect: Phaser.Geom.Rectangle, progress: number, groundY = this.body.bottom) {
    const a = this.atk;
    if (!a || a.teleDone) return;
    const tell = a.def.tell;
    if (progress >= 1) {
      a.teleDone = true;
      this.restoreTint();
      if (this.tele) this.tele.strike(rect, tell);
      return;
    }
    this.sprite.setTint(warnTint(progress, tell ? TELL_COLOR[tell] : undefined));
    this.tele?.draw(rect, progress, groundY, tell, this.facing);
  }

  protected updateAttack(dt: number, dx: number) {
    const a = this.atk!;
    const d = a.def;
    a.t += dt * this.speedMul;
    const s = d.startup;
    const e = s + d.active;
    if (a.t < s * 0.6) this.facing = dx >= 0 ? 1 : -1; // track, then commit

    if (this.cfg.telegraph && d.damage > 0) {
      // where the hit will land once the lunge has carried us forward
      const ahead = (d.lunge * d.active) / 2;
      const r = CombatSystem.box(this.x + this.facing * ahead, this.y, this.facing, d.hitbox);
      this.updateTelegraph(r, a.t / s);
    }

    const lunging = a.t >= s * 0.8 && a.t < e;
    let vx = approach(this.body.velocity.x, lunging ? this.facing * d.lunge : 0, 1100 * dt);
    if (this.edgeAhead(Math.sign(vx) || this.facing) && Math.abs(vx) > 0) vx = 0;
    this.body.velocity.x = vx;

    if (a.t >= s && a.t < e) {
      if (!a.swung) {
        a.swung = true;
        sfx.swing(!!d.heavy);
        this.onStrike(d);
      }
      if (!a.hit) a.hit = this.scene.combat.enemyStrike(CombatSystem.box(this.x, this.y, this.facing, d.hitbox), this.facing, d, this);
    }
    if (d.next && !a.chained && a.t >= e) {
      a.chained = true;
      if (Math.random() < (d.chain ?? 0.6)) return this.startAttack(this.cfg.attacks[d.next]);
    }
    if (a.t >= e + d.recovery) {
      this.atk = null;
      this.cooldown = d.cooldown * Phaser.Math.FloatBetween(0.8, 1.4);
      this.setState('chase');
    }
  }

  /** hook for subclasses (boss shockwaves etc.) */
  protected onStrike(_d: EnemyAttack) {}

  protected animate() {
    switch (this.state) {
      case 'attack': {
        const a = this.atk!;
        const s = a.def.startup;
        this.sprite.setFrame(a.t < s ? a.def.frames.windup : a.t < s + a.def.active ? a.def.frames.strike : a.def.frames.recover);
        break;
      }
      case 'hurt':
      case 'stagger':
        this.sprite.setFrame('hurt');
        break;
      default:
        if (Math.abs(this.body.velocity.x) > 8) this.sprite.setFrame(`walk${Math.floor(this.animT * (this.state === 'chase' ? 9 : 6)) % 4}`);
        else this.sprite.setFrame(`idle${Math.floor(this.animT * 1.5) % 2}`);
    }
  }

  takeHit(h: HitInfo) {
    if (!this.alive) return false;
    if (h.element) this.applyElement(h.element);
    if (!this.alive) return true;
    this.hp -= h.damage;
    this.poise -= h.poise;
    this.poiseT = 3;
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => this.sprite.active && !this.frozen && this.restoreTint());
    if (this.hp > 0) sfx.enemyHurt();
    this.onDamaged();
    if (this.hp <= 0) {
      // a frost blade, or any blow to a frostbitten foe, shatters it
      this.killedBy = this.frostT > 0 ? 'cold' : h.element?.type ?? null;
      this.die(h.dir);
      return true;
    }
    const a = this.atk;
    const armored = this.cfg.hyperarmor && this.state === 'attack' && !!a && a.t < a.def.startup + a.def.active;
    if (this.poise <= 0) {
      this.poise = this.cfg.poise;
      this.atk = null;
      this.setState('stagger');
      this.body.velocity.x = h.dir * 110 * this.cfg.knockMul;
      sfx.stagger();
      this.scene.fx.clang(this.x, this.y - 6);
    } else if (!armored) {
      this.atk = null;
      this.setState('hurt');
      this.body.velocity.x = h.dir * h.knock * this.cfg.knockMul;
      this.facing = h.dir > 0 ? -1 : 1;
    }
    if (this.state === 'patrol' || this.state === 'idle') this.setState('chase');
    return true;
  }

  protected onDamaged() {}

  /** our swing was parried: reel back, wide open for a riposte */
  onParried() {
    this.atk = null;
    this.setState('stagger');
    this.staggerFor = 1.5;
    this.riposteT = 1.5;
    this.body.velocity.x = -this.facing * 50;
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(90, () => this.sprite.active && this.restoreTint());
  }

  /** the player has started a riposte on us: hold still until the stab lands */
  grabForRiposte() {
    this.riposteT = 0;
    this.atk = null;
    this.setState('stagger');
    this.staggerFor = 1.4;
    this.body.velocity.x = 0;
  }

  takeRiposte(dmg: number, dir: number) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => this.sprite.active && this.restoreTint());
    this.onDamaged();
    if (this.hp <= 0) return this.die(dir);
    this.setState('stagger');
    this.staggerFor = 0.7;
    this.body.velocity.x = dir * 90;
  }

  die(dir = 0) {
    if (!this.alive) return;
    this.alive = false;
    this.atk = null;
    this.setState('dead');
    if (this.killedBy === 'cold' && this.shatterable) {
      // frozen solid where it stood, then it bursts into ice
      this.frozen = true;
      this.body.velocity.set(0, 0);
      this.sprite.setTintFill(0xd4f0ff);
      sfx.freeze();
      this.scene.fx.status(this.x, this.y - 4, 'cold', 14);
      this.scene.onEnemyKilled(this);
      this.scene.time.delayedCall(160, () => {
        if (!this.sprite.active) return;
        this.scene.fx.shatter(this.sprite, dir);
        sfx.shatter();
        this.sprite.setVisible(false);
      });
      return;
    }
    sfx.enemyDie();
    this.sprite.setFrame('dead');
    this.body.velocity.x = dir * 60;
    this.scene.onEnemyKilled(this);
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      delay: 900,
      duration: 700,
      onComplete: () => this.sprite.active && this.sprite.setVisible(false),
    });
  }

  destroy() {
    this.collider.destroy();
    this.sprite.destroy();
  }
}

// ------------------------------------------------------------------- configs

export const HOLLOW: EnemyConfig = {
  key: 'hollow',
  name: 'Hollow',
  hp: 62,
  poise: 18,
  walk: 28,
  chase: 62,
  aggro: 150,
  keepDist: 20,
  patrol: 48,
  souls: 45,
  drops: [
    { item: 'bread', chance: 0.18 },
    { item: 'ember_herb', chance: 0.08 },
    { item: 'titanite', chance: 0.06 },
  ],
  hyperarmor: false,
  knockMul: 1,
  body: { w: 10, h: 19, ox: 19, oy: 13 },
  openers: ['slash', 'thrust'],
  attacks: {
    slash: {
      id: 'slash', startup: 0.48, active: 0.11, recovery: 0.6, damage: 22, poise: 12, range: 30, cooldown: 0.9,
      hitbox: { x: 0, y: -16, w: 24, h: 22 }, lunge: 80, knock: 120,
      frames: { windup: 'wind', strike: 'strike', recover: 'rec' }, next: 'slash2', chain: 0.35,
    },
    slash2: {
      id: 'slash2', startup: 0.3, active: 0.11, recovery: 0.7, damage: 20, poise: 12, range: 30, cooldown: 1.2,
      hitbox: { x: 0, y: -20, w: 24, h: 24 }, lunge: 80, knock: 120,
      frames: { windup: 'wind2', strike: 'strike2', recover: 'rec' },
    },
    thrust: {
      id: 'thrust', startup: 0.62, active: 0.12, recovery: 0.7, damage: 26, poise: 15, range: 52, minRange: 26, cooldown: 1.2,
      hitbox: { x: 0, y: -14, w: 30, h: 14 }, lunge: 190, knock: 150,
      frames: { windup: 'wind', strike: 'strike', recover: 'rec' },
    },
  },
};

export const KNIGHT: EnemyConfig = {
  key: 'knight',
  name: 'Fallen Knight',
  hp: 190,
  poise: 70,
  walk: 22,
  chase: 46,
  aggro: 170,
  keepDist: 26,
  patrol: 40,
  souls: 220,
  drops: [{ item: 'titanite', chance: 0.6 }],
  hyperarmor: true,
  telegraph: 'glint',
  knockMul: 0.35,
  body: { w: 14, h: 28, ox: 25, oy: 20 },
  openers: ['cleave', 'rising'],
  attacks: {
    cleave: {
      id: 'cleave', startup: 0.78, active: 0.13, recovery: 0.75, damage: 36, poise: 30, range: 40, cooldown: 1.1,
      hitbox: { x: 0, y: -26, w: 34, h: 34 }, lunge: 90, knock: 190, heavy: true,
      frames: { windup: 'wind', strike: 'strike', recover: 'rec' }, next: 'rising', chain: 0.45,
    },
    rising: {
      id: 'rising', startup: 0.5, active: 0.13, recovery: 0.85, damage: 30, poise: 24, range: 38, cooldown: 1.3,
      hitbox: { x: 0, y: -30, w: 32, h: 34 }, lunge: 110, knock: 170, heavy: true,
      frames: { windup: 'wind2', strike: 'strike2', recover: 'rec' },
    },
  },
};

/** Fast crawler: long lunge from range, quick claw combo up close. Fragile. */
export const GHOUL: EnemyConfig = {
  key: 'ghoul',
  name: 'Ghoul',
  hp: 46,
  poise: 8,
  walk: 38,
  chase: 108,
  aggro: 170,
  keepDist: 16,
  patrol: 56,
  souls: 60,
  drops: [{ item: 'bread', chance: 0.12 }],
  hyperarmor: false,
  knockMul: 1.3,
  body: { w: 12, h: 14, ox: 18, oy: 18 },
  openers: ['lunge', 'claw'],
  attacks: {
    lunge: {
      id: 'lunge', startup: 0.5, active: 0.18, recovery: 0.7, damage: 18, poise: 14, range: 80, minRange: 34, cooldown: 1.1,
      hitbox: { x: 0, y: -10, w: 18, h: 14 }, lunge: 270, knock: 150,
      frames: { windup: 'wind', strike: 'strike', recover: 'rec' },
    },
    claw: {
      id: 'claw', startup: 0.26, active: 0.08, recovery: 0.2, damage: 11, poise: 6, range: 26, cooldown: 0.8,
      hitbox: { x: 0, y: -12, w: 16, h: 14 }, lunge: 60, knock: 70,
      frames: { windup: 'wind2', strike: 'strike2', recover: 'rec' }, next: 'claw2', chain: 0.7,
    },
    claw2: {
      id: 'claw2', startup: 0.2, active: 0.08, recovery: 0.5, damage: 11, poise: 6, range: 26, cooldown: 1,
      hitbox: { x: 0, y: -12, w: 16, h: 14 }, lunge: 60, knock: 90,
      frames: { windup: 'wind2', strike: 'strike2', recover: 'rec' },
    },
  },
};

/** Keeps its distance and shoots arcing arrows; shoves you away if you get close. */
export const ARCHER: EnemyConfig = {
  key: 'archer',
  name: 'Skeleton Archer',
  hp: 52,
  poise: 10,
  walk: 26,
  chase: 46,
  aggro: 230,
  keepDist: 120,
  patrol: 30,
  souls: 75,
  vision: 150,
  canJump: false,
  drops: [{ item: 'titanite', chance: 0.12 }],
  hyperarmor: false,
  knockMul: 1.1,
  body: { w: 10, h: 20, ox: 19, oy: 12 },
  openers: ['shoot'],
  attacks: {
    shoot: {
      id: 'shoot', startup: 0.75, active: 0.05, recovery: 0.55, damage: 0, poise: 0, range: 240, minRange: 40, cooldown: 1.3,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'wind', strike: 'strike', recover: 'rec' },
    },
    shove: {
      id: 'shove', startup: 0.32, active: 0.1, recovery: 0.45, damage: 10, poise: 20, range: 26, cooldown: 0.9,
      hitbox: { x: 0, y: -16, w: 18, h: 18 }, lunge: 90, knock: 220,
      frames: { windup: 'wind2', strike: 'strike2', recover: 'rec' },
    },
  },
};

/** Archer AI: back off when crowded, hold range, shoot. */
export class Archer extends Enemy {
  protected chase(dt: number, dx: number, dist: number, dy: number) {
    const p = this.scene.player;
    if (!p.alive || dist > this.cfg.aggro * 1.6 || Math.abs(dy) > 170) {
      this.home = this.x;
      this.setState('patrol');
      return;
    }
    this.facing = dx >= 0 ? 1 : -1;
    if (this.cooldown <= 0) {
      if (dist < 28 && Math.abs(dy) < 24) return this.startAttack(this.cfg.attacks.shove);
      if (dist > 40 && dist < this.cfg.aggro) return this.startAttack(this.cfg.attacks.shoot);
    }
    let target = 0;
    const away = -this.facing;
    if (dist < 64 && Math.abs(dy) < 30) {
      if (!this.edgeAhead(away) && !this.wallAhead(away)) target = away * this.cfg.chase;
    } else if (dist > this.cfg.keepDist && !this.edgeAhead()) target = this.facing * this.cfg.walk;
    this.body.velocity.x = approach(this.body.velocity.x, target, 700 * dt);
  }

  protected onStrike(d: EnemyAttack) {
    if (d.id === 'shoot') this.scene.spawnArrow(this.x + this.facing * 9, this.y - 5, this.facing);
  }
}

/** Hops toward you, lobs molten globs from range and pounces up close. Glows; can't be parried. */
export const SLIME: EnemyConfig = {
  key: 'slime',
  name: 'Lava Slime',
  hp: 58,
  poise: 14,
  walk: 30,
  chase: 58,
  aggro: 200,
  keepDist: 60,
  patrol: 40,
  souls: 90,
  vision: 110,
  parryable: false,
  telegraph: 'glint',
  drops: [{ item: 'ember_herb', chance: 0.12 }],
  hyperarmor: false,
  knockMul: 1.1,
  body: { w: 16, h: 13, ox: 16, oy: 19 },
  // born in lava: fire does nothing, frost cracks it
  resist: { fire: 0, cold: 2 },
  openers: ['spit', 'pounce'],
  attacks: {
    spit: {
      id: 'spit', tell: 'spit', startup: 0.7, active: 0.06, recovery: 0.6, damage: 0, poise: 0, range: 190, minRange: 50, cooldown: 1.4,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'wind', strike: 'strike', recover: 'rec' },
    },
    pounce: {
      id: 'pounce', startup: 0.5, active: 0.22, recovery: 0.6, damage: 18, poise: 14, range: 50, cooldown: 1.2,
      hitbox: { x: -4, y: -10, w: 22, h: 18 }, lunge: 200, knock: 140,
      frames: { windup: 'wind2', strike: 'strike2', recover: 'rec' },
    },
  },
};

export class LavaSlime extends Enemy {
  protected onStrike(d: EnemyAttack) {
    if (d.id === 'spit') this.scene.spawnLavaGlob(this.x + this.facing * 8, this.y - 4, 18);
  }
}

// =================================================================== the Frostbound Cloister

/**
 * Frost Wraith: a hovering shade of frost. Holds its distance and throws ice shards that build up
 * frost; when you get close it blinks away and starts again. Fragile – catch it after a blink.
 */
export const WRAITH: EnemyConfig = {
  key: 'wraith',
  name: 'Frost Wraith',
  hp: 58,
  poise: 10,
  walk: 22,
  chase: 46,
  aggro: 210,
  keepDist: 100,
  patrol: 40,
  souls: 150,
  vision: 150,
  canJump: false,
  parryable: false,
  telegraph: 'glint',
  drops: [{ item: 'titanite', chance: 0.15 }],
  hyperarmor: false,
  knockMul: 1.2,
  body: { w: 12, h: 18, ox: 18, oy: 14 },
  // made of frost: cold does nothing, fire tears it apart
  resist: { cold: 0, fire: 1.8 },
  openers: ['shard'],
  attacks: {
    shard: {
      id: 'shard', startup: 0.72, active: 0.05, recovery: 0.55, damage: 0, poise: 0, range: 230, minRange: 24, cooldown: 1.5,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'wind', strike: 'strike', recover: 'rec' },
    },
  },
};

/** how high a wraith hovers above the floor it was placed on (px) */
const HOVER = 18;
const BLINK_TIME = 0.5;

export class Wraith extends Enemy {
  /** what drifts off it: frost (wraiths, wisps) or embers (lanterns) */
  protected motes: 'cold' | 'fire' = 'cold';
  private hoverY: number;
  private blinkT = -1;
  private blinkCd = 0;
  private blinkTo = 0;

  constructor(scene: GameScene, cfg: EnemyConfig, x: number, y: number) {
    super(scene, cfg, x, y - HOVER);
    this.hoverY = y - HOVER;
    this.body.setAllowGravity(false);
    this.sprite.setAlpha(0.92);
  }

  update(dt: number) {
    if (this.alive) {
      // bob gently at hover height
      const target = this.hoverY + Math.sin(this.animT * 2.2) * 3;
      this.body.velocity.y = (target - this.body.bottom) * 5;
      this.blinkCd -= dt;
      if (this.blinkT >= 0) return this.updateBlink(dt);
      if (Math.random() < 3 * dt) {
        if (this.motes === 'fire') this.scene.fx.ember(this.x + Phaser.Math.Between(-4, 4), this.body.bottom - 4, 1);
        else this.scene.fx.status(this.x + Phaser.Math.Between(-5, 5), this.body.bottom, 'cold', 1);
      }
    }
    super.update(dt);
  }

  /** fade out, reappear on the far side of the player's reach, fade in */
  private updateBlink(dt: number) {
    this.blinkT += dt;
    this.body.velocity.x = 0;
    const half = BLINK_TIME / 2;
    if (this.blinkT < half) this.sprite.setAlpha(0.92 * (1 - this.blinkT / half));
    else {
      if (this.sprite.x !== this.blinkTo) {
        this.sprite.x = this.blinkTo;
        this.body.reset(this.sprite.x, this.sprite.y);
        this.scene.fx.status(this.x, this.y, 'cold', 12);
      }
      this.sprite.setAlpha(0.92 * Math.min(1, (this.blinkT - half) / half));
    }
    this.sprite.setFrame('wind');
    if (this.blinkT >= BLINK_TIME) {
      this.blinkT = -1;
      this.blinkCd = 3.2;
      this.cooldown = 0.35;
      this.setState('chase');
    }
  }

  /** a spot ~100 px from the player, over solid ground, not inside a wall */
  private blinkSpot(): number | null {
    const p = this.scene.player;
    const away = this.x >= p.x ? 1 : -1;
    for (const dir of [away, -away]) {
      for (const d of [105, 85, 65]) {
        const x = p.x + dir * d;
        if (x < 24 || x > this.scene.mapWidth() - 24) continue;
        if (this.scene.isSolidAt(x, this.y) || this.scene.isSolidAt(x, this.body.top)) continue;
        if (this.scene.surfaceAt(x, this.body.bottom - 4, this.body.bottom + 80) === null) continue;
        return x;
      }
    }
    return null;
  }

  protected patrol(dt: number) {
    const tooFar = (this.x - this.home) * this.facing > this.cfg.patrol;
    if (this.wallAhead() || tooFar) {
      this.facing = this.facing > 0 ? -1 : 1;
      this.setState('idle');
      return;
    }
    this.body.velocity.x = this.facing * this.cfg.walk;
  }

  protected chase(dt: number, dx: number, dist: number, dy: number) {
    const p = this.scene.player;
    if (!p.alive || dist > this.cfg.aggro * 1.6 || Math.abs(dy) > 180) return this.giveUp();
    this.facing = dx >= 0 ? 1 : -1;
    if (dist < 46 && this.blinkCd <= 0) {
      const to = this.blinkSpot();
      if (to !== null) {
        this.blinkTo = to;
        this.blinkT = 0;
        sfx.tell('blink');
        return;
      }
    }
    if (this.cooldown <= 0 && dist > 24 && dist < this.cfg.aggro) return this.startAttack(this.cfg.attacks.shard);
    let target = 0;
    if (dist < 70 && !this.wallAhead(-this.facing)) target = -this.facing * this.cfg.chase;
    else if (dist > this.cfg.keepDist + 20 && !this.wallAhead()) target = this.facing * this.cfg.walk;
    this.body.velocity.x = approach(this.body.velocity.x, target, 400 * dt);
  }

  protected onStrike(d: EnemyAttack) {
    if (d.id === 'shard') this.scene.spawnShard(this.x + this.facing * 7, this.y - 4);
  }

  die(dir = 0) {
    this.blinkT = -1;
    this.sprite.setAlpha(1);
    this.body.setAllowGravity(true);
    super.die(dir);
  }
}

/**
 * Ice-bound Monk: slow, heavy, carries a slab of ice as a shield. Hits from the front glance off it –
 * get behind it, break its guard with heavy blows, or parry its smash and riposte.
 */
export const MONK: EnemyConfig = {
  key: 'monk',
  name: 'Ice-bound Monk',
  hp: 175,
  poise: 64,
  walk: 18,
  chase: 34,
  aggro: 160,
  keepDist: 24,
  patrol: 30,
  souls: 280,
  drops: [{ item: 'titanite', chance: 0.5 }, { item: 'ember_herb', chance: 0.15 }],
  hyperarmor: true,
  telegraph: 'glint',
  knockMul: 0.35,
  body: { w: 14, h: 27, ox: 25, oy: 21 },
  resist: { cold: 0.3, fire: 1.4 },
  openers: ['smash', 'bash'],
  attacks: {
    smash: {
      id: 'smash', startup: 0.9, active: 0.13, recovery: 0.85, damage: 34, poise: 32, range: 42, cooldown: 1.2,
      hitbox: { x: 0, y: -26, w: 36, h: 36 }, lunge: 70, knock: 200, heavy: true,
      frames: { windup: 'wind', strike: 'strike', recover: 'rec' }, status: { type: 'cold', amount: 30 },
    },
    bash: {
      id: 'bash', startup: 0.42, active: 0.1, recovery: 0.6, damage: 14, poise: 26, range: 26, cooldown: 1,
      hitbox: { x: 0, y: -22, w: 22, h: 24 }, lunge: 140, knock: 240,
      frames: { windup: 'wind2', strike: 'strike2', recover: 'rec' }, noParry: true,
    },
  },
};

export class Monk extends Enemy {
  /** guarding = shield up: not staggered and not committed to a swing */
  private guarding() {
    if (this.state === 'stagger' || this.riposteT > 0) return false;
    const a = this.atk;
    return !(this.state === 'attack' && a && a.t > a.def.startup * 0.4);
  }

  takeHit(h: HitInfo) {
    if (!this.alive) return false;
    const frontal = h.dir === -this.facing;
    if (frontal && this.guarding()) {
      // glances off the ice: a sliver of damage, but heavy blows still wear the guard (poise) down
      this.scene.fx.clang(this.x + this.facing * 8, this.y - 6);
      this.scene.fx.status(this.x + this.facing * 8, this.y - 6, 'cold', 3);
      sfx.stagger();
      return super.takeHit({
        ...h,
        damage: Math.max(1, Math.round(h.damage * 0.12)),
        poise: h.poise * (h.heavy ? 0.9 : 0.45),
        knock: h.knock * 0.2,
        element: h.element ? { ...h.element, power: h.element.power * 0.25 } : undefined,
      });
    }
    return super.takeHit(h);
  }
}

// =================================================================== the Rotting Mire

/**
 * Bloated Carrier: a swollen, shambling sack of rot. Belches poison at close range, and when it dies
 * it bursts into a lingering poison cloud – kill it from range, or roll away from the corpse.
 */
export const CARRIER: EnemyConfig = {
  key: 'carrier',
  name: 'Bloated Carrier',
  hp: 96,
  poise: 34,
  walk: 14,
  chase: 28,
  aggro: 150,
  keepDist: 22,
  patrol: 30,
  souls: 190,
  telegraph: 'glint',
  drops: [{ item: 'bread', chance: 0.2 }, { item: 'titanite', chance: 0.15 }],
  hyperarmor: true,
  knockMul: 0.5,
  body: { w: 20, h: 22, ox: 22, oy: 26 },
  resist: { poison: 0, fire: 1.3 },
  openers: ['belch', 'flop'],
  attacks: {
    belch: {
      id: 'belch', startup: 0.8, active: 0.45, recovery: 0.7, damage: 8, poise: 8, range: 46, cooldown: 1.4,
      hitbox: { x: 2, y: -18, w: 42, h: 20 }, lunge: 0, knock: 60,
      frames: { windup: 'wind', strike: 'strike', recover: 'rec' }, status: { type: 'poison', amount: 55 }, noParry: true,
    },
    flop: {
      id: 'flop', startup: 0.62, active: 0.14, recovery: 0.9, damage: 24, poise: 30, range: 28, cooldown: 1.3,
      hitbox: { x: -4, y: -16, w: 30, h: 22 }, lunge: 120, knock: 200, heavy: true,
      frames: { windup: 'wind2', strike: 'strike2', recover: 'rec' },
    },
  },
};

export class Carrier extends Enemy {
  protected updateAttack(dt: number, dx: number) {
    const a = this.atk!;
    if (a.def.id === 'belch' && a.t >= a.def.startup && a.t < a.def.startup + a.def.active && Math.random() < 0.8)
      this.scene.fx.status(this.x + this.facing * Phaser.Math.Between(8, 40), this.y - Phaser.Math.Between(2, 14), 'poison', 2);
    super.updateAttack(dt, dx);
  }

  die(dir = 0) {
    if (!this.alive) return;
    super.die(dir);
    if (this.summoned) return;
    // swells… and bursts
    const x = this.x;
    const ground = this.body.bottom;
    this.scene.tweens.add({ targets: this.sprite, scaleX: 1.25, scaleY: 1.15, duration: 450, yoyo: true });
    this.scene.time.delayedCall(550, () => {
      if (!this.scene.player) return;
      sfx.status('poison');
      sfx.enemyDie();
      this.scene.fx.status(x, ground - 10, 'poison', 30);
      this.scene.fx.bleed(x, ground - 10, 10);
      this.scene.combat.shake(0.006, 160);
      this.scene.spawnGas(x, ground, 72, 5, 42);
      const p = this.scene.player;
      if (p.alive && Math.abs(p.x - x) < 36 && Math.abs(p.feetY - ground) < 30)
        p.takeDamage(18, p.x >= x ? 1 : -1, 180, 30, { blockable: true, status: { type: 'poison', amount: 40 } });
    });
  }
}

/**
 * Mire Leech: lies hidden in mire water (just a ripple) until you wade close, then lunges out.
 * If it lands it clings to you and feeds – roll to shake it off.
 */
export const LEECH: EnemyConfig = {
  key: 'leech',
  name: 'Mire Leech',
  hp: 40,
  poise: 6,
  walk: 18,
  chase: 62,
  aggro: 96,
  keepDist: 10,
  patrol: 24,
  souls: 80,
  vision: 64,
  canJump: false,
  parryable: false,
  drops: [{ item: 'ember_herb', chance: 0.1 }],
  hyperarmor: false,
  knockMul: 1.4,
  body: { w: 14, h: 8, ox: 17, oy: 24 },
  resist: { poison: 0 },
  openers: ['lunge'],
  attacks: {
    lunge: {
      id: 'lunge', startup: 0.45, active: 0.22, recovery: 0.75, damage: 9, poise: 6, range: 84, cooldown: 1.2,
      hitbox: { x: -2, y: -8, w: 18, h: 14 }, lunge: 230, knock: 40,
      frames: { windup: 'wind', strike: 'strike', recover: 'rec' }, status: { type: 'poison', amount: 20 },
    },
  },
};

const LATCH_MAX = 7;

export class Leech extends Enemy {
  /** seconds stuck to the player, -1 = free */
  private latchT = -1;
  private told = false;

  get latched() {
    return this.latchT >= 0;
  }

  update(dt: number) {
    if (this.alive && this.latchT >= 0) return this.updateLatched(dt);
    super.update(dt);
    if (!this.alive) return;
    // hidden in the water until it's coming for you
    const hidden = (this.state === 'patrol' || this.state === 'idle') && this.scene.isBogAt(this.x, this.body.bottom - 4);
    this.sprite.setAlpha(hidden ? 0.12 : 1);
    if (hidden && Math.random() < 1.5 * dt) this.scene.fx.dust(this.x + Phaser.Math.Between(-6, 6), this.body.bottom - 10, 1);
  }

  protected updateAttack(dt: number, dx: number) {
    const p = this.scene.player;
    const hp = p.hp;
    const a = this.atk!;
    const before = a.hit;
    super.updateAttack(dt, dx);
    // the lunge landed (not blocked, not dodged): clamp on
    if (!before && a.hit && p.alive && p.hp < hp && p.state !== 'block' && p.state !== 'parry') this.latchOn();
  }

  protected onStrike(d: EnemyAttack) {
    if (d.id === 'lunge') this.body.velocity.y = -160; // springs up out of the water
  }

  private latchOn() {
    this.latchT = 0;
    this.atk = null;
    // out of the attack state (animate() expects a swing while attacking); letGo() sets the next one
    this.setState('idle');
    this.body.setAllowGravity(false).setVelocity(0, 0);
    this.collider.active = false;
    this.sprite.setAlpha(1).setDepth(DEPTH.PLAYER + 3);
    if (!this.told) {
      this.told = true;
      useGameStore.getState().showToast('A leech clings to you – roll to shake it off!');
    }
  }

  private updateLatched(dt: number) {
    const p = this.scene.player;
    this.latchT += dt;
    if (!p.alive || p.rolling || this.latchT > LATCH_MAX) return this.letGo(p.alive && p.rolling);
    p.latchedUntil = this.scene.time.now + 120;
    // stuck to the player's back, pulsing as it feeds
    const x = p.x - p.facing * 3;
    this.sprite.setPosition(x, p.feetY - 8);
    this.body.reset(x, p.feetY - 8);
    this.facing = p.facing;
    this.sprite.setFlipX(this.facing < 0).setFrame(Math.floor(this.latchT * 6) % 2 ? 'strike' : 'rec');
    p.drain(5 * dt);
    p.addBuildup('poison', 14 * dt);
    if (Math.random() < 4 * dt) this.scene.fx.bleed(p.x, p.y, 1);
  }

  /** knocked off (a roll throws it clear and leaves it dazed) */
  private letGo(thrown: boolean) {
    const p = this.scene.player;
    this.latchT = -1;
    this.collider.active = true;
    this.body.setAllowGravity(true);
    this.sprite.setDepth(DEPTH.ENEMY);
    this.setState('stagger');
    this.staggerFor = thrown ? 1.6 : 0.8;
    this.body.setVelocity(-p.facing * (thrown ? 120 : 60), -140);
    if (thrown) this.scene.fx.dust(this.x, this.y, 6);
  }

  takeHit(h: HitInfo) {
    const r = super.takeHit(h);
    if (r && this.latchT >= 0 && this.alive) this.letGo(true);
    return r;
  }

  die(dir = 0) {
    if (this.latchT >= 0) {
      this.latchT = -1;
      this.collider.active = true;
      this.body.setAllowGravity(true);
      this.sprite.setDepth(DEPTH.ENEMY);
    }
    super.die(dir);
  }
}

// =================================================================== the Buried Necropolis + the Khepri Wastes

/**
 * Mummy: lies among the dead (looks like just another corpse) until you come close, then drags itself
 * up. Slow, tough, wide clawing swings; the old wrappings go up like tinder.
 */
export const MUMMY: EnemyConfig = {
  key: 'mummy',
  name: 'Mummy',
  hp: 120,
  poise: 34,
  walk: 16,
  chase: 30,
  aggro: 150,
  keepDist: 20,
  patrol: 30,
  souls: 200,
  drops: [{ item: 'bread', chance: 0.15 }, { item: 'titanite', chance: 0.2 }],
  hyperarmor: true,
  telegraph: 'glint',
  knockMul: 0.5,
  body: { w: 10, h: 20, ox: 19, oy: 12 },
  resist: { fire: 2.2, poison: 0.2 },
  openers: ['claw', 'grab'],
  attacks: {
    claw: {
      id: 'claw', startup: 0.62, active: 0.12, recovery: 0.6, damage: 24, poise: 18, range: 30, cooldown: 1,
      hitbox: { x: 0, y: -18, w: 26, h: 24 }, lunge: 70, knock: 140,
      frames: { windup: 'wind', strike: 'strike', recover: 'rec' }, next: 'claw2', chain: 0.5,
    },
    claw2: {
      id: 'claw2', startup: 0.42, active: 0.12, recovery: 0.8, damage: 24, poise: 18, range: 30, cooldown: 1.2,
      hitbox: { x: 0, y: -18, w: 26, h: 24 }, lunge: 70, knock: 160,
      frames: { windup: 'wind2', strike: 'strike2', recover: 'rec' },
    },
    /** a long reaching lunge with both arms */
    grab: {
      id: 'grab', startup: 0.8, active: 0.18, recovery: 0.9, damage: 30, poise: 28, range: 60, minRange: 26, cooldown: 1.4,
      hitbox: { x: 0, y: -16, w: 28, h: 18 }, lunge: 200, knock: 200, heavy: true,
      frames: { windup: 'wind', strike: 'strike2', recover: 'rec' },
    },
  },
};

const RISE_TIME = 1.1;

export class Mummy extends Enemy {
  /** lying dormant: -1 = awake, 0 = asleep, >0 = rising */
  private riseT = 0;

  update(dt: number) {
    if (this.alive && this.riseT >= 0) {
      const p = this.scene.player;
      if (this.riseT === 0) {
        this.sprite.setFrame('dead');
        this.body.velocity.x = 0;
        if (p.alive && Math.abs(p.x - this.x) < 64 && Math.abs(p.feetY - this.body.bottom) < 40) {
          this.riseT = 0.001;
          sfx.tell('summon');
          this.scene.fx.dust(this.x, this.body.bottom, 8);
        }
        return;
      }
      this.riseT += dt;
      this.facing = p.x >= this.x ? 1 : -1;
      this.sprite.setFlipX(this.facing < 0).setFrame(this.riseT < RISE_TIME * 0.5 ? 'rise0' : 'rise1');
      if (this.riseT >= RISE_TIME) {
        this.riseT = -1;
        this.cooldown = 0.4;
        this.setState('chase');
      }
      return;
    }
    super.update(dt);
  }

  takeHit(h: HitInfo) {
    if (this.riseT >= 0) {
      this.riseT = -1; // a blow wakes it at once
      this.setState('chase');
    }
    return super.takeHit(h);
  }
}

/**
 * Legionary: the dead of a lost legion. A tall shield in front (hits from the front glance off, like the
 * cloister monks), a gladius up close, and a pilum hurled from range.
 */
export const LEGIONARY: EnemyConfig = {
  key: 'legionary',
  name: 'Fallen Legionary',
  hp: 150,
  poise: 56,
  walk: 24,
  chase: 42,
  aggro: 220,
  keepDist: 22,
  patrol: 40,
  souls: 260,
  vision: 110,
  drops: [{ item: 'titanite', chance: 0.45 }, { item: 'soul_lost_knight', chance: 0.08 }],
  hyperarmor: true,
  telegraph: 'glint',
  knockMul: 0.4,
  body: { w: 10, h: 20, ox: 19, oy: 12 },
  resist: { poison: 0.3 },
  openers: ['stab', 'pilum'],
  attacks: {
    stab: {
      id: 'stab', startup: 0.5, active: 0.1, recovery: 0.55, damage: 26, poise: 20, range: 34, cooldown: 0.9,
      hitbox: { x: 0, y: -14, w: 30, h: 12 }, lunge: 120, knock: 140,
      frames: { windup: 'wind', strike: 'strike', recover: 'rec' }, next: 'bash', chain: 0.35,
    },
    bash: {
      id: 'bash', startup: 0.38, active: 0.1, recovery: 0.6, damage: 12, poise: 30, range: 26, cooldown: 1,
      hitbox: { x: 0, y: -18, w: 20, h: 22 }, lunge: 140, knock: 240, noParry: true,
      frames: { windup: 'wind2', strike: 'strike2', recover: 'rec' },
    },
    pilum: {
      id: 'pilum', startup: 0.85, active: 0.05, recovery: 0.7, damage: 0, poise: 0, range: 210, minRange: 70, cooldown: 2.6,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'throwW', strike: 'throwS', recover: 'rec' },
    },
  },
};

export class Legionary extends Monk {
  protected onStrike(d: EnemyAttack) {
    if (d.id === 'pilum') this.scene.spawnArrow(this.x + this.facing * 8, this.y - 8, this.facing, { tex: 'pilum', damage: 24 });
  }
}

// =================================================================== the Sky Reaches

/** Sky Wisp: a mote of storm-light that hovers out of reach, throws wind bolts and blinks away when crowded. */
export const WISP: EnemyConfig = {
  ...WRAITH,
  key: 'skywisp',
  name: 'Sky Wisp',
  // a taller frame (48×40) for the halo: the body box sits at its bottom
  body: { w: 12, h: 18, ox: 18, oy: 22 },
  hp: 64,
  souls: 220,
  aggro: 230,
  resist: { cold: 0.5, poison: 0 },
  drops: [{ item: 'titanite', chance: 0.18 }],
  attacks: {
    shard: { ...WRAITH.attacks.shard, startup: 0.62, cooldown: 1.3 },
  },
};

export class Wisp extends Wraith {
  protected onStrike(d: EnemyAttack) {
    if (d.id === 'shard') this.scene.spawnShard(this.x + this.facing * 7, this.y - 4, 16, 0, 0, 'windbolt');
  }
}

/** Cloud Slime: a hopping lump of cloud. Lobs puffs from range, bowls into you up close; frost does nothing, fire boils it off. */
export const CLOUD_SLIME: EnemyConfig = {
  ...SLIME,
  key: 'cloudslime',
  name: 'Cloud Slime',
  hp: 70,
  souls: 180,
  drops: [{ item: 'bread', chance: 0.12 }],
  resist: { cold: 0, fire: 1.8 },
};

export class CloudSlime extends Enemy {
  protected onStrike(d: EnemyAttack) {
    if (d.id === 'spit') this.scene.spawnPuff(this.x + this.facing * 8, this.y - 4, 18);
  }
}

// =================================================================== the Weeping Shrine

/**
 * Pale Maiden: a drowned girl in white, long black hair, gliding along the floor without a sound.
 * Rakes with cold fingers, then lunges to grasp – the chill builds frost. Her eyes go red as she strikes.
 */
export const MAIDEN: EnemyConfig = {
  key: 'maiden',
  name: 'Pale Maiden',
  hp: 84,
  poise: 22,
  walk: 24,
  chase: 72,
  aggro: 170,
  keepDist: 18,
  patrol: 40,
  souls: 300,
  canJump: false,
  telegraph: 'glint',
  drops: [{ item: 'ember_herb', chance: 0.12 }, { item: 'titanite', chance: 0.15 }],
  hyperarmor: false,
  knockMul: 1,
  body: { w: 10, h: 20, ox: 19, oy: 12 },
  resist: { poison: 0, fire: 1.5 },
  openers: ['rake', 'grasp'],
  attacks: {
    rake: {
      id: 'rake', startup: 0.42, active: 0.1, recovery: 0.45, damage: 16, poise: 10, range: 28, cooldown: 0.8,
      hitbox: { x: 0, y: -16, w: 24, h: 20 }, lunge: 70, knock: 90,
      frames: { windup: 'wind', strike: 'strike', recover: 'rec' }, next: 'rake2', chain: 0.5,
    },
    rake2: {
      id: 'rake2', startup: 0.32, active: 0.1, recovery: 0.6, damage: 16, poise: 10, range: 28, cooldown: 1,
      hitbox: { x: 0, y: -16, w: 24, h: 20 }, lunge: 70, knock: 110,
      frames: { windup: 'wind2', strike: 'strike2', recover: 'rec' },
    },
    /** a long gliding grasp: cold to the bone */
    grasp: {
      id: 'grasp', startup: 0.6, active: 0.22, recovery: 0.8, damage: 22, poise: 18, range: 90, minRange: 30, cooldown: 1.4,
      hitbox: { x: 0, y: -16, w: 22, h: 18 }, lunge: 240, knock: 140,
      frames: { windup: 'wind', strike: 'strike2', recover: 'rec' }, status: { type: 'cold', amount: 28 },
    },
  },
};

export class Maiden extends Enemy {
  update(dt: number) {
    super.update(dt);
    // never quite solid
    if (this.alive) this.sprite.setAlpha(0.82 + Math.sin(this.animT * 3) * 0.08);
  }
}

/** Lantern Spirit: a paper lantern that woke with an eye and a grin, hanging in the air and spitting spirit fire. */
export const LANTERN: EnemyConfig = {
  ...WRAITH,
  key: 'lantern',
  name: 'Lantern Spirit',
  hp: 52,
  souls: 240,
  aggro: 210,
  resist: { fire: 0, cold: 1.6 },
  drops: [{ item: 'titanite', chance: 0.18 }],
  attacks: {
    shard: { ...WRAITH.attacks.shard, startup: 0.65, cooldown: 1.4 },
  },
};

export class Lantern extends Wraith {
  protected motes: 'cold' | 'fire' = 'fire';
  protected onStrike(d: EnemyAttack) {
    if (d.id === 'shard') this.scene.spawnShard(this.x + this.facing * 6, this.y - 2, 16, 0, 0, 'spiritfire');
  }
}

/**
 * Faceless Servant: a tall shape in black robes with a blank white face. Slow, patient and very hard
 * to stagger; its sweeping blows are wide and heavy.
 */
export const FACELESS: EnemyConfig = {
  key: 'faceless',
  name: 'Faceless Servant',
  hp: 260,
  poise: 95,
  walk: 14,
  chase: 28,
  aggro: 150,
  keepDist: 26,
  patrol: 24,
  souls: 420,
  canJump: false,
  drops: [{ item: 'titanite', chance: 0.6 }, { item: 'soul_lost_knight', chance: 0.1 }],
  hyperarmor: true,
  telegraph: 'glint',
  knockMul: 0.3,
  body: { w: 14, h: 30, ox: 25, oy: 18 },
  openers: ['sweep', 'crush'],
  attacks: {
    sweep: {
      id: 'sweep', startup: 0.85, active: 0.14, recovery: 0.8, damage: 32, poise: 30, range: 46, cooldown: 1.1,
      hitbox: { x: -4, y: -24, w: 44, h: 34 }, lunge: 60, knock: 200, heavy: true,
      frames: { windup: 'wind', strike: 'strike', recover: 'rec' },
    },
    crush: {
      id: 'crush', startup: 1.05, active: 0.14, recovery: 1.0, damage: 44, poise: 44, range: 40, cooldown: 1.4,
      hitbox: { x: 0, y: -30, w: 34, h: 40 }, lunge: 40, knock: 220, heavy: true,
      frames: { windup: 'wind2', strike: 'strike2', recover: 'rec' },
    },
  },
};

/**
 * Grasping Hair: black hair lying in a crack in the floor. It stays still until you step close, then
 * lashes up out of the stone. It can't move – walk around it, or cut it down.
 */
export const HAIR: EnemyConfig = {
  key: 'hair',
  name: 'Grasping Hair',
  hp: 46,
  poise: 999,
  walk: 0,
  chase: 0,
  aggro: 56,
  keepDist: 999,
  patrol: 0,
  souls: 120,
  vision: 40,
  canJump: false,
  parryable: false,
  telegraph: 'glint',
  drops: [],
  hyperarmor: true,
  knockMul: 0,
  body: { w: 14, h: 12, ox: 17, oy: 20 },
  resist: { fire: 2.5 },
  openers: ['lash'],
  attacks: {
    lash: {
      id: 'lash', startup: 0.45, active: 0.16, recovery: 0.9, damage: 18, poise: 16, range: 44, cooldown: 1.1,
      hitbox: { x: -6, y: -34, w: 34, h: 40 }, lunge: 0, knock: 120,
      frames: { windup: 'wind', strike: 'strike', recover: 'rec' },
    },
  },
};

export class Hair extends Enemy {
  update(dt: number) {
    super.update(dt);
    if (!this.alive) return;
    // lying flat in the crack until something comes near
    const awake = this.state === 'attack' || (this.state === 'chase' && this.cooldown > 0);
    this.sprite.setAlpha(awake ? 1 : 0.35);
    this.body.velocity.x = 0;
  }

  /** rooted: it never walks, it only lashes at whatever comes close */
  protected chase(dt: number, dx: number, dist: number) {
    this.facing = dx >= 0 ? 1 : -1;
    if (dist > this.cfg.aggro * 1.4) return this.setState('idle');
    if (this.cooldown <= 0 && dist < this.cfg.attacks.lash.range) this.startAttack(this.cfg.attacks.lash);
  }

  protected patrol() {
    this.body.velocity.x = 0;
  }
}

/** a mirror shade of Ayame (phase 4): fragile, translucent, casts no shadow */
export const SHADE: EnemyConfig = {
  key: 'ayame',
  name: 'Mirror Shade',
  hp: 1,
  poise: 1,
  walk: 40,
  chase: 64,
  aggro: 999,
  keepDist: 30,
  patrol: 0,
  souls: 0,
  canJump: false,
  telegraph: 'glint',
  drops: [],
  hyperarmor: false,
  knockMul: 0.6,
  body: { w: 14, h: 40, ox: 41, oy: 40 },
  openers: ['stab'],
  attacks: {
    stab: {
      id: 'stab', startup: 0.7, active: 0.12, recovery: 0.8, damage: 14, poise: 10, range: 56, cooldown: 1.6,
      hitbox: { x: 0, y: -8, w: 46, h: 14 }, lunge: 120, knock: 100,
      frames: { windup: 'stabW', strike: 'stabS', recover: 'stabR' },
    },
  },
};

export class Shade extends Enemy {
  update(dt: number) {
    super.update(dt);
    if (this.alive) this.sprite.setAlpha(0.5 + Math.sin(this.animT * 9) * 0.12);
  }
  /** the shade's frames come from Ayame's sheet: walk with her glide */
  protected animate() {
    if (this.state === 'attack' || this.state === 'hurt' || this.state === 'stagger') return super.animate();
    this.sprite.setFrame(`walk${Math.floor(this.animT * 7) % 4}`);
  }
}

export const ENEMY_TYPES: Record<string, EnemyConfig> = {
  hollow: HOLLOW, knight: KNIGHT, ghoul: GHOUL, archer: ARCHER, slime: SLIME,
  wraith: WRAITH, monk: MONK, carrier: CARRIER, leech: LEECH,
  mummy: MUMMY, legionary: LEGIONARY,
  wisp: WISP, cloudslime: CLOUD_SLIME,
  maiden: MAIDEN, lantern: LANTERN, faceless: FACELESS, hair: HAIR, shade: SHADE,
};

const CLASSES = new Map<EnemyConfig, new (scene: GameScene, cfg: EnemyConfig, x: number, y: number) => Enemy>([
  [ARCHER, Archer],
  [SLIME, LavaSlime],
  [WRAITH, Wraith],
  [MONK, Monk],
  [CARRIER, Carrier],
  [LEECH, Leech],
  [MUMMY, Mummy],
  [LEGIONARY, Legionary],
  [WISP, Wisp],
  [CLOUD_SLIME, CloudSlime],
  [MAIDEN, Maiden],
  [LANTERN, Lantern],
  [HAIR, Hair],
  [SHADE, Shade],
]);

export function makeEnemy(scene: GameScene, type: string, x: number, y: number, summoned = false) {
  const base = ENEMY_TYPES[type] ?? HOLLOW;
  // summons give nothing, so a boss can't be farmed through its adds
  const cfg = summoned ? { ...base, souls: 0, drops: [], aggro: 999 } : base;
  const Cls = CLASSES.get(base) ?? Enemy;
  const e = new Cls(scene, cfg, x, y);
  e.summoned = summoned;
  return e;
}

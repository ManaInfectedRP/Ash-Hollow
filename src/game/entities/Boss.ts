import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { CombatSystem, type HitInfo } from '../systems/CombatSystem';
import { sfx } from '../systems/Sfx';
import { useGameStore } from '../../stores/gameStore';
import { Enemy, type AttackRun, type EnemyAttack, type EnemyConfig } from './Enemy';
import { TILE } from '../constants';

/**
 * Shared boss behaviour: dormant until the arena fog is crossed, a boss bar in the HUD,
 * a phase change at half HP (`enterPhase2`) and a full reset when the player dies or rests.
 */
export abstract class Boss extends Enemy {
  active = false;
  phase = 1;
  protected spawn: { x: number; y: number };
  protected phase2Tint = 0xffffff;
  /** HP fractions where the fight escalates: crossing thresholds[i] enters phase i + 2 (default: once, at half) */
  protected thresholds = [0.5];

  constructor(scene: GameScene, cfg: EnemyConfig, x: number, y: number) {
    super(scene, cfg, x, y);
    // bosses keep their own death (no frost shatter)
    this.shatterable = false;
    this.spawn = { x, y };
    this.staggerTime = 1.4;
    this.facing = -1;
    this.state = 'idle';
  }

  activate() {
    this.active = true;
    this.cooldown = 1.2;
    this.setState('chase');
    sfx.roar();
    this.scene.combat.shake(0.008, 900);
    this.pushBar();
  }

  reset() {
    this.active = false;
    this.alive = true;
    this.phase = 1;
    this.speedMul = 1;
    this.hp = this.cfg.hp;
    this.poise = this.cfg.poise;
    this.atk = null;
    this.state = 'idle';
    this.facing = -1;
    this.sprite.clearTint().setAlpha(1).setVisible(true);
    this.sprite.setPosition(this.spawn.x, this.spawn.y);
    this.body.reset(this.spawn.x, this.spawn.y);
  }

  update(dt: number) {
    if (!this.active) {
      this.animT += dt;
      this.sprite.setFrame(`idle${Math.floor(this.animT * 1.2) % 2}`);
      this.sprite.setFlipX(this.facing < 0);
      return;
    }
    super.update(dt);
    this.keepInArena();
  }

  /**
   * The fog gate only blocks the player, so the boss is held inside the arena here: it can't walk or
   * leap out, and if it ever ends up outside (or falls out of the world) it is put back.
   */
  protected keepInArena() {
    if (!this.alive) return;
    const [minX, maxX] = this.scene.arenaBounds();
    const half = this.body.width / 2;
    if (this.x - half < minX - 40 || this.x + half > maxX + 40 || this.body.bottom > this.scene.mapHeight() + 24) {
      this.sprite.setPosition(this.spawn.x, this.spawn.y);
      this.body.reset(this.spawn.x, this.spawn.y);
      return;
    }
    if (this.x - half < minX && this.body.velocity.x < 0) {
      this.sprite.x += minX - (this.x - half);
      this.body.velocity.x = 0;
    } else if (this.x + half > maxX && this.body.velocity.x > 0) {
      this.sprite.x -= this.x + half - maxX;
      this.body.velocity.x = 0;
    }
  }

  /** called once when HP drops below half */
  protected abstract enterPhase2(): void;

  /** debug menu: set HP to a fraction of max (runs the phase change; 0 kills) */
  debugSetHp(frac: number) {
    if (frac <= 0) {
      this.hp = 0;
      this.die(0);
      return;
    }
    this.hp = Math.max(1, Math.round(this.cfg.hp * frac));
    this.onDamaged();
  }

  /** later phases (3, 4, …) for bosses with more than one threshold */
  protected enterPhase(_n: number) {}

  protected onDamaged() {
    while (this.phase - 1 < this.thresholds.length && this.hp < this.cfg.hp * this.thresholds[this.phase - 1] && this.hp > 0) {
      this.phase++;
      this.sprite.setTint(this.phase2Tint);
      sfx.roar();
      this.scene.combat.shake(0.01, 700);
      if (this.phase === 2) this.enterPhase2();
      else this.enterPhase(this.phase);
      // cancel into a brief roar window – a reward for pushing the phase
      this.atk = null;
      this.setState('stagger');
    }
    this.pushBar();
  }

  takeHit(h: HitInfo) {
    const r = super.takeHit(h);
    if (r && this.phase >= 2 && this.alive) this.scene.time.delayedCall(70, () => this.alive && this.sprite.setTint(this.phase2Tint));
    return r;
  }

  protected restoreTint() {
    if (this.phase >= 2) this.sprite.setTint(this.phase2Tint);
    else this.sprite.clearTint();
  }

  pushBar() {
    useGameStore.setState({ boss: { name: this.cfg.name, hp: Math.max(0, Math.round(this.hp)), maxHp: this.cfg.hp } });
  }
}

// =================================================================== Ashen Warden (The Hollow)

export const WARDEN: EnemyConfig = {
  key: 'warden',
  name: 'Ashen Warden',
  hp: 850,
  poise: 140,
  walk: 40,
  chase: 52,
  aggro: 600,
  keepDist: 40,
  patrol: 0,
  souls: 3000,
  canJump: false,
  parryable: false,
  drops: [
    { item: 'flask_shard', chance: 1 },
    { item: 'titanite', chance: 1, qty: 3 },
  ],
  hyperarmor: true,
  telegraph: 'zone',
  knockMul: 0.1,
  body: { w: 24, h: 48, ox: 52, oy: 48 },
  openers: ['slam', 'sweep', 'leap'],
  attacks: {
    slam: {
      id: 'slam', tell: 'slam', startup: 1.15, active: 0.14, recovery: 0.95, damage: 55, poise: 50, range: 66, cooldown: 0.8,
      hitbox: { x: 4, y: -36, w: 58, h: 62 }, lunge: 70, knock: 240, heavy: true,
      frames: { windup: 'slamW', strike: 'slamS', recover: 'slamR' },
    },
    sweep: {
      id: 'sweep', tell: 'low', startup: 0.8, active: 0.14, recovery: 0.3, damage: 34, poise: 30, range: 72, cooldown: 0.7,
      // low horizontal sweep along the ground (18 px high + below the feet): hits a standing player, can be jumped
      hitbox: { x: -6, y: 6, w: 74, h: 24 }, lunge: 110, knock: 200, heavy: true,
      frames: { windup: 'sweepW', strike: 'sweepS', recover: 'sweepR' }, next: 'sweep2', chain: 0.75,
    },
    sweep2: {
      id: 'sweep2', tell: 'high', startup: 0.52, active: 0.14, recovery: 0.85, damage: 34, poise: 30, range: 72, cooldown: 0.9,
      // rising slash: full height down to the ground – roll or block
      hitbox: { x: -6, y: -44, w: 74, h: 74 }, lunge: 110, knock: 200, heavy: true,
      frames: { windup: 'sweep2W', strike: 'sweep2S', recover: 'sweepR' },
    },
    leap: {
      id: 'leap', tell: 'leap', startup: 0.75, active: 0.12, recovery: 1.05, damage: 48, poise: 50, range: 260, minRange: 95, cooldown: 1.2,
      hitbox: { x: -44, y: -6, w: 88, h: 30 }, lunge: 0, knock: 230, heavy: true,
      frames: { windup: 'crouch', strike: 'slamS', recover: 'slamR' },
    },
  },
};

/** Two-phase brute. Phase 2: faster, slams and landings spawn ground shockwaves. */
export class Warden extends Boss {
  private leapX = 0;
  private leapT = 0;
  /** floor height of the landing spot (fixed at take-off, so the mark stays on the ground mid-air) */
  private leapY = 0;

  constructor(scene: GameScene, x: number, y: number, cfg: EnemyConfig = WARDEN) {
    super(scene, cfg, x, y);
    this.phase2Tint = 0xffc8a0;
  }

  protected enterPhase2() {
    this.speedMul = 1.22;
    this.scene.fx.ember(this.x, this.y, 40);
  }

  protected chooseAttack(dist: number): EnemyAttack | null {
    const A = this.cfg.attacks;
    if (dist > 95) return Math.random() < 0.65 ? A.leap : null;
    if (dist < 70) return Math.random() < 0.5 ? A.slam : A.sweep;
    return Math.random() < 0.4 ? A.sweep : null;
  }

  protected updateAttack(dt: number, dx: number) {
    const a = this.atk!;
    if (a.def.id !== 'leap') return super.updateAttack(dt, dx);

    const d = a.def;
    const p = this.scene.player;
    const [minX, maxX] = this.scene.arenaBounds();
    const landX = () => Phaser.Math.Clamp(p.x, minX + 20, maxX - 20);
    const zone = (x: number) => CombatSystem.box(x, a.phase === 1 ? this.leapY : this.body.bottom, 1, d.hitbox);
    if (a.phase === 0) {
      this.leapY = this.body.bottom;
      // crouch wind-up: the landing zone tracks the player
      a.t += dt * this.speedMul;
      this.facing = dx >= 0 ? 1 : -1;
      this.body.velocity.x = 0;
      this.leapX = landX();
      this.updateTelegraph(zone(this.leapX), (a.t / d.startup) * 0.7);
      if (a.t >= d.startup) {
        a.phase = 1;
        const flight = 0.75;
        this.body.velocity.y = -360;
        // aim at the player, but never at a point outside the arena
        const tx = this.leapX;
        this.body.velocity.x = Phaser.Math.Clamp((tx - this.x) / flight, -240, 240);
        this.leapT = 0;
        this.scene.fx.dust(this.x, this.body.bottom, 12);
        sfx.swing(true);
      }
    } else if (a.phase === 1) {
      // airborne until landing: the zone stays where we will come down and fills up
      this.leapT += dt;
      this.updateTelegraph(zone(this.leapX), 0.7 + Math.min(0.29, this.leapT / 0.75 * 0.29), this.leapY);
      if (this.onGround && this.body.velocity.y >= 0) {
        this.updateTelegraph(zone(this.x), 1);
        a.phase = 2;
        a.t = d.startup + d.active;
        this.body.velocity.x = 0;
        sfx.slam();
        this.scene.combat.shake(0.02, 320);
        this.scene.fx.dust(this.x - 20, this.body.bottom, 10);
        this.scene.fx.dust(this.x + 20, this.body.bottom, 10);
        this.scene.combat.enemyStrike(CombatSystem.box(this.x, this.body.bottom, 1, d.hitbox), this.facing, d, this);
        if (this.phase >= 2) {
          this.scene.spawnShockwave(this.x - 14, this.body.bottom, -1);
          this.scene.spawnShockwave(this.x + 14, this.body.bottom, 1);
        }
      }
    } else {
      a.t += dt * this.speedMul;
      this.body.velocity.x = 0;
      if (a.t >= d.startup + d.active + d.recovery) {
        this.atk = null;
        this.cooldown = d.cooldown;
        this.setState('chase');
      }
    }
  }

  protected animate() {
    if (this.state === 'attack' && this.atk?.def.id === 'leap') {
      const a = this.atk;
      this.sprite.setFrame(a.phase === 0 ? 'crouch' : a.phase === 1 ? 'air' : 'slamR');
      return;
    }
    super.animate();
  }

  protected onStrike(d: EnemyAttack) {
    if (d.id === 'slam') {
      sfx.slam();
      this.scene.combat.shake(0.016, 260);
      const fx = this.x + this.facing * 44;
      this.scene.fx.dust(fx, this.body.bottom, 12);
      this.scene.fx.ember(fx, this.body.bottom - 4, this.phase >= 2 ? 24 : 8);
      if (this.phase >= 2) this.scene.spawnShockwave(fx, this.body.bottom, this.facing);
    }
  }
}

// =================================================================== Bone Shepherd (the Ossuary)

export const SHEPHERD: EnemyConfig = {
  key: 'shepherd',
  name: 'The Bone Shepherd',
  hp: 1350,
  poise: 110,
  walk: 34,
  chase: 46,
  aggro: 700,
  keepDist: 50,
  patrol: 0,
  souls: 5000,
  canJump: false,
  parryable: false,
  drops: [
    { item: 'bone_scythe', chance: 1 },
    { item: 'titanite', chance: 1, qty: 3 },
  ],
  hyperarmor: true,
  telegraph: 'zone',
  knockMul: 0.15,
  body: { w: 18, h: 44, ox: 39, oy: 36 },
  // bones: nothing in there for poison to work on
  resist: { poison: 0.3 },
  openers: ['sweep', 'rain', 'blink', 'summon'],
  attacks: {
    sweep: {
      id: 'sweep', tell: 'low', startup: 0.78, active: 0.16, recovery: 0.3, damage: 34, poise: 26, range: 72, cooldown: 0.5,
      // low scythe sweep along the ground (18 px high): hits a standing player, can be jumped
      hitbox: { x: -10, y: 4, w: 66, h: 24 }, lunge: 90, knock: 190, heavy: true,
      frames: { windup: 'sweepW', strike: 'sweepS', recover: 'sweepR' }, next: 'sweep2', chain: 0.6,
    },
    sweep2: {
      id: 'sweep2', tell: 'high', startup: 0.55, active: 0.16, recovery: 0.75, damage: 34, poise: 26, range: 72, cooldown: 0.7,
      // overhead return swing: full height down to the ground
      hitbox: { x: -10, y: -36, w: 66, h: 64 }, lunge: 90, knock: 190, heavy: true,
      frames: { windup: 'sweep2W', strike: 'sweep2S', recover: 'sweepR' },
    },
    rain: {
      id: 'rain', tell: 'rain', startup: 1.0, active: 0.1, recovery: 0.7, damage: 0, poise: 0, range: 999, cooldown: 0.9,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'raise', strike: 'raise', recover: 'idle0' },
    },
    summon: {
      id: 'summon', tell: 'summon', startup: 1.0, active: 0.1, recovery: 0.8, damage: 0, poise: 0, range: 999, cooldown: 1,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'raise', strike: 'raise', recover: 'idle0' },
    },
    /** sinks into the ground, resurfaces behind the player and slashes */
    blink: {
      id: 'blink', tell: 'blink', startup: 0.65, active: 0.16, recovery: 0.75, damage: 36, poise: 30, range: 999, cooldown: 1.2,
      hitbox: { x: -10, y: -24, w: 62, h: 52 }, lunge: 0, knock: 200, heavy: true,
      frames: { windup: 'sink', strike: 'sweepS', recover: 'sweepR' },
    },
  },
};

const RISE = 0.4;

/**
 * Necromancer boss. Telegraphs everything:
 *  - sweep combo (sweepW wind-up), blink (sinks + dust where he will rise), bone rain (raise + ground markers),
 *  - summons ghouls (max 1, phase 2: max 2). Phase 2: faster, denser rain, summons more often.
 */
export class Shepherd extends Boss {
  private summonCd = 6;
  /** soft cold light so he reads against the dark crypt */
  private aura: Phaser.GameObjects.Image;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, SHEPHERD, x, y);
    this.phase2Tint = 0xc8b0ff;
    this.aura = scene.add.image(x, y, 'glow-soul').setBlendMode('ADD').setTint(0x9ec8ff).setScale(3.2, 4).setAlpha(0.22);
    this.aura.setDepth(this.sprite.depth - 1);
  }

  destroy() {
    this.aura.destroy();
    super.destroy();
  }

  reset() {
    super.reset();
    this.summonCd = 6;
  }

  protected enterPhase2() {
    this.speedMul = 1.2;
    this.summonCd = 0;
    this.scene.fx.heal(this.x, this.y - 10);
  }

  update(dt: number) {
    this.aura.setPosition(this.x, this.y - 4).setAlpha(this.alive ? 0.22 * this.sprite.alpha : 0);
    if (this.active && this.alive) {
      this.summonCd -= dt;
      // a stagger or phase change can cancel a blink mid-sink – never stay invisible
      if (this.atk?.def.id !== 'blink' && this.sprite.alpha < 1) this.sprite.setAlpha(1);
    }
    super.update(dt);
  }

  protected chooseAttack(dist: number): EnemyAttack | null {
    const A = this.cfg.attacks;
    const maxAdds = this.phase === 2 ? 2 : 1;
    if (this.summonCd <= 0 && this.scene.summonedAlive() < maxAdds && Math.random() < 0.6) return A.summon;
    const r = Math.random();
    if (dist < 75) return r < 0.62 ? A.sweep : r < 0.84 ? A.blink : A.rain;
    return r < 0.45 ? A.rain : r < 0.8 ? A.blink : null;
  }

  /** can't be hit while sunk into the ground */
  takeHit(h: HitInfo) {
    if (this.atk?.def.id === 'blink' && this.atk.phase === 0 && this.atk.t > this.atk.def.startup * 0.5) return false;
    return super.takeHit(h);
  }

  protected updateAttack(dt: number, dx: number) {
    const a = this.atk!;
    if (a.def.id !== 'blink') return super.updateAttack(dt, dx);
    const d = a.def;
    const p = this.scene.player;
    a.t += dt * this.speedMul;
    this.body.velocity.x = 0;
    const [minX, maxX] = this.scene.arenaBounds();
    const riseX = () => Phaser.Math.Clamp(p.x - p.facing * 42, minX, maxX);
    if (a.phase === 0) {
      // sinking: fade out; the spot where he will rise is marked under the player's back
      this.sprite.setAlpha(Math.max(0.1, 1 - a.t / d.startup));
      const rx = riseX();
      const rf = p.x >= rx ? 1 : -1;
      this.updateTelegraph(CombatSystem.box(rx, this.y, rf, d.hitbox), (a.t / d.startup) * 0.5);
      if (a.t >= d.startup) {
        const x = riseX();
        this.sprite.x += x - this.x;
        this.body.reset(this.sprite.x, this.sprite.y);
        this.facing = p.x >= x ? 1 : -1;
        a.phase = 1;
        a.t = 0;
        this.scene.fx.dust(x, this.body.bottom, 14);
        sfx.roll();
      }
    } else if (a.phase === 1) {
      // rising – this is the dodge window
      this.sprite.setAlpha(Math.min(1, 0.2 + a.t / RISE));
      this.updateTelegraph(CombatSystem.box(this.x, this.y, this.facing, d.hitbox), 0.5 + (a.t / RISE) * 0.49);
      if (a.t >= RISE) {
        a.phase = 2;
        a.t = 0;
        this.sprite.setAlpha(1);
      }
    } else {
      if (a.t < d.active) {
        if (!a.swung) {
          a.swung = true;
          sfx.swing(true);
          this.updateTelegraph(CombatSystem.box(this.x, this.y, this.facing, d.hitbox), 1);
        }
        if (!a.hit) a.hit = this.scene.combat.enemyStrike(CombatSystem.box(this.x, this.y, this.facing, d.hitbox), this.facing, d, this);
      } else if (a.t >= d.active + d.recovery) {
        this.atk = null;
        this.cooldown = d.cooldown;
        this.setState('chase');
      }
    }
  }

  protected animate() {
    const a = this.atk;
    if (this.state === 'attack' && a?.def.id === 'blink') {
      this.sprite.setFrame(a.phase === 0 ? 'sink' : a.phase === 1 ? (a.t < RISE * 0.5 ? 'sink' : 'sweepW') : a.t < a.def.active ? 'sweepS' : 'sweepR');
      return;
    }
    super.animate();
  }

  protected onStrike(d: EnemyAttack) {
    if (d.id === 'rain') {
      const p = this.scene.player;
      const n = this.phase === 2 ? 6 : 4;
      const spread = this.phase === 2 ? 34 : 40;
      const xs = Array.from({ length: n }, (_, i) => p.x + (i - (n - 1) / 2) * spread + Phaser.Math.Between(-6, 6));
      // the bone right above the player falls first, the rest ripple outward
      xs.sort((a, b) => Math.abs(a - p.x) - Math.abs(b - p.x));
      xs.forEach((x, i) => this.scene.spawnFallingBone(x, 0.55 + i * 0.12));
      sfx.roar();
    } else if (d.id === 'summon') {
      const [minX, maxX] = this.scene.arenaBounds();
      const p = this.scene.player;
      // rise on the side away from the player so they come at you
      const x = Math.abs(p.x - minX) > Math.abs(p.x - maxX) ? minX + 10 : maxX - 10;
      this.scene.summon('ghoul', x, this.body.bottom);
      this.summonCd = this.phase === 2 ? 11 : 16;
    }
  }
}

// =================================================================== Molten Colossus (the Molten Depths)

export const COLOSSUS: EnemyConfig = {
  key: 'colossus',
  name: 'The Molten Colossus',
  hp: 1250,
  poise: 170,
  walk: 20,
  chase: 24,
  aggro: 800,
  keepDist: 70,
  patrol: 0,
  souls: 7000,
  canJump: false,
  parryable: false,
  telegraph: 'zone',
  drops: [
    { item: 'flask_shard', chance: 1 },
    { item: 'titanite', chance: 1, qty: 4 },
  ],
  hyperarmor: true,
  knockMul: 0.05,
  body: { w: 30, h: 62, ox: 49, oy: 50 },
  // molten rock: barely burns, frost bites deep, poison struggles
  resist: { fire: 0.1, cold: 1.5, poison: 0.6 },
  openers: ['spit', 'wave'],
  attacks: {
    /** lobbed globs of lava at range */
    spit: {
      id: 'spit', tell: 'spit', startup: 0.9, active: 0.1, recovery: 0.7, damage: 0, poise: 0, range: 999, cooldown: 0.8,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'spitW', strike: 'spitS', recover: 'rec' },
    },
    /** slow, huge: fists into the ground, a wall of lava rolls out both ways – run, then punish */
    wave: {
      id: 'wave', tell: 'wave', startup: 1.5, active: 0.2, recovery: 5.0, damage: 40, poise: 60, range: 120, cooldown: 1.5,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 240, heavy: true,
      frames: { windup: 'waveW', strike: 'waveS', recover: 'rec' },
    },
  },
};

/** how far the lava wave rolls from the Colossus before it dies down */
const WAVE_REACH = 180;

/**
 * Keeps its distance and spits lava; when you close in it winds up (slowly, with a ground warning
 * spanning the whole reach) and slams out a lava wave in both directions that you have to outrun.
 * After the slam it is spent for a long moment – that's the window to hit it.
 * Phase 2: faster, spits a fan of three, quicker waves.
 */
export class Colossus extends Boss {
  constructor(scene: GameScene, x: number, y: number) {
    super(scene, COLOSSUS, x, y);
    this.phase2Tint = 0xffb090;
    this.staggerTime = 1.6;
  }

  protected enterPhase2() {
    this.speedMul = 1.18;
    this.scene.fx.ember(this.x, this.y, 50);
  }

  protected chooseAttack(dist: number): EnemyAttack | null {
    const A = this.cfg.attacks;
    if (dist < 110) return A.wave;
    return Math.random() < 0.75 ? A.spit : null;
  }

  protected updateAttack(dt: number, dx: number) {
    const a = this.atk!;
    if (a.def.id === 'spit') {
      const p = this.scene.player;
      if (a.t < a.def.startup) this.updateTelegraph(new Phaser.Geom.Rectangle(p.x - 14, p.feetY - 16, 28, 16), a.t / a.def.startup, p.feetY);
      else if (!a.teleDone) this.updateTelegraph(new Phaser.Geom.Rectangle(p.x - 14, p.feetY - 16, 28, 16), 1, p.feetY);
    }
    if (a.def.id !== 'wave') return super.updateAttack(dt, dx);
    const d = a.def;
    a.t += dt * this.speedMul;
    this.body.velocity.x = 0;
    if (a.t < d.startup) {
      // the warning covers everything the wave will reach
      const reach = WAVE_REACH;
      const rect = new Phaser.Geom.Rectangle(this.x - reach, this.body.bottom - 60, reach * 2, 60);
      this.updateTelegraph(rect, a.t / d.startup);
      if (Math.random() < 0.3) this.scene.fx.ember(this.x + Phaser.Math.Between(-30, 30), this.body.bottom - 4, 2);
    } else if (!a.swung) {
      a.swung = true;
      this.updateTelegraph(new Phaser.Geom.Rectangle(this.x - 40, this.body.bottom - 60, 80, 60), 1);
      sfx.slam();
      this.scene.combat.shake(0.022, 420);
      // outrun it (sprint), wait for it to die down, then run back in while the Colossus is still slumped
      const speed = this.phase === 2 ? 115 : 95;
      this.scene.spawnLavaWave(this.x - 20, this.body.bottom, -1, speed, WAVE_REACH);
      this.scene.spawnLavaWave(this.x + 20, this.body.bottom, 1, speed, WAVE_REACH);
      this.scene.fx.ember(this.x, this.body.bottom - 6, 40);
    } else if (a.t >= d.startup + d.active + d.recovery) {
      this.atk = null;
      this.cooldown = d.cooldown;
      this.setState('chase');
    }
  }

  protected animate() {
    const a = this.atk;
    if (this.state === 'attack' && a?.def.id === 'wave') {
      const s = a.def.startup;
      // spent and slumped after the slam: that's your opening
      this.sprite.setFrame(a.t < s ? 'waveW' : a.t < s + 0.35 ? 'waveS' : 'rec');
      return;
    }
    super.animate();
  }

  protected onStrike(d: EnemyAttack) {
    if (d.id !== 'spit') return;
    const p = this.scene.player;
    const mx = this.x + this.facing * 10;
    const my = this.body.top + 14;
    sfx.monster();
    if (this.phase === 2) {
      // a fan of three: one at you, one short, one long
      for (const k of [-0.25, 0, 0.3]) this.scene.spawnLavaGlob(mx, my, 24, p.x + (p.x - mx) * k);
    } else {
      this.scene.spawnLavaGlob(mx, my, 24);
      this.scene.time.delayedCall(220, () => this.alive && this.scene.spawnLavaGlob(mx, my, 24, p.x + this.facing * 26));
    }
  }
}

// =================================================================== Frost Matriarch (the Frostbound Cloister)

export const MATRIARCH: EnemyConfig = {
  key: 'matriarch',
  name: 'The Frost Matriarch',
  hp: 1500,
  poise: 120,
  walk: 44,
  chase: 58,
  aggro: 700,
  keepDist: 46,
  patrol: 0,
  souls: 9000,
  canJump: false,
  // the first boss whose thrusts can be parried: the gold lance telegraph is the cue
  parryable: true,
  drops: [
    { item: 'frost_spear', chance: 1 },
    { item: 'flask_shard', chance: 1 },
    { item: 'titanite', chance: 1, qty: 3 },
  ],
  hyperarmor: true,
  telegraph: 'zone',
  knockMul: 0.15,
  body: { w: 16, h: 46, ox: 40, oy: 34 },
  resist: { cold: 0.1, fire: 1.5, poison: 0.8 },
  openers: ['thrust', 'sweep', 'lunge', 'rain'],
  attacks: {
    thrust: {
      id: 'thrust', tell: 'pierce', startup: 0.62, active: 0.12, recovery: 0.32, damage: 30, poise: 26, range: 72, cooldown: 0.7,
      hitbox: { x: 0, y: -4, w: 62, h: 16 }, lunge: 130, knock: 170, status: { type: 'cold', amount: 20 },
      frames: { windup: 'thrustW', strike: 'thrustS', recover: 'thrustR' }, next: 'thrust2', chain: 0.65,
    },
    thrust2: {
      id: 'thrust2', tell: 'pierce', startup: 0.46, active: 0.12, recovery: 0.4, damage: 30, poise: 26, range: 72, cooldown: 0.8,
      hitbox: { x: 0, y: -4, w: 62, h: 16 }, lunge: 130, knock: 170, status: { type: 'cold', amount: 20 },
      frames: { windup: 'thrustW', strike: 'thrustS', recover: 'thrustR' }, next: 'thrust3', chain: 0.4,
    },
    thrust3: {
      id: 'thrust3', tell: 'pierce', startup: 0.58, active: 0.14, recovery: 0.8, damage: 38, poise: 36, range: 72, cooldown: 1,
      hitbox: { x: 0, y: -4, w: 66, h: 18 }, lunge: 170, knock: 220, heavy: true, status: { type: 'cold', amount: 30 },
      frames: { windup: 'lungeW', strike: 'thrustS', recover: 'thrustR' },
    },
    sweep: {
      id: 'sweep', tell: 'low', startup: 0.74, active: 0.14, recovery: 0.6, damage: 30, poise: 26, range: 68, cooldown: 0.8,
      // the butt of the spear skimming the ice: jump it
      hitbox: { x: -8, y: 4, w: 68, h: 22 }, lunge: 80, knock: 190, heavy: true, noParry: true,
      frames: { windup: 'sweepW', strike: 'sweepS', recover: 'sweepR' },
    },
    lunge: {
      id: 'lunge', tell: 'pierce', startup: 0.8, active: 0.3, recovery: 0.85, damage: 36, poise: 34, range: 260, minRange: 95, cooldown: 1.1,
      hitbox: { x: 0, y: -4, w: 42, h: 18 }, lunge: 330, knock: 220, heavy: true, status: { type: 'cold', amount: 30 },
      frames: { windup: 'lungeW', strike: 'thrustS', recover: 'thrustR' },
    },
    rain: {
      id: 'rain', tell: 'rain', startup: 0.9, active: 0.1, recovery: 0.7, damage: 0, poise: 0, range: 999, cooldown: 0.9,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'raise', strike: 'raise', recover: 'idle0' },
    },
    /** phase 2: frost bursts out around her – get clear of the ring */
    nova: {
      id: 'nova', tell: 'nova', startup: 1.1, active: 0.16, recovery: 1.0, damage: 40, poise: 50, range: 80, cooldown: 1,
      hitbox: { x: -66, y: -40, w: 132, h: 64 }, lunge: 0, knock: 240, heavy: true, noParry: true, status: { type: 'cold', amount: 60 },
      frames: { windup: 'raise', strike: 'novaS', recover: 'sweepR' },
    },
  },
};

/**
 * A tall spear-maiden of the cloister. Fast thrust strings you can PARRY (gold lance tell), a low sweep
 * to jump, a long lunge from range and icicles called down from the vault.
 * Phase 2: the arena floor freezes over (you slide), frost novas, longer strings, more icicles.
 */
export class Matriarch extends Boss {
  private aura: Phaser.GameObjects.Image;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, MATRIARCH, x, y);
    this.phase2Tint = 0xc8e8ff;
    this.aura = scene.add.image(x, y, 'glow-soul').setBlendMode('ADD').setTint(0xaedcff).setScale(3, 4).setAlpha(0.2);
    this.aura.setDepth(this.sprite.depth - 1);
  }

  destroy() {
    this.aura.destroy();
    super.destroy();
  }

  update(dt: number) {
    this.aura.setPosition(this.x, this.y - 4).setAlpha(this.alive ? 0.2 : 0);
    if (this.active && this.alive && Math.random() < 4 * dt) this.scene.fx.status(this.x + Phaser.Math.Between(-8, 8), this.body.bottom - 2, 'cold', 1);
    super.update(dt);
  }

  protected enterPhase2() {
    this.speedMul = 1.18;
    this.scene.fx.status(this.x, this.y, 'cold', 50);
    this.scene.freezeArena();
  }

  protected chooseAttack(dist: number): EnemyAttack | null {
    const A = this.cfg.attacks;
    const r = Math.random();
    if (dist > 100) return r < 0.5 ? A.lunge : r < 0.8 ? A.rain : null;
    if (dist < 76) {
      if (this.phase === 2 && r < 0.18) return A.nova;
      return r < 0.6 ? A.thrust : r < 0.88 ? A.sweep : A.rain;
    }
    return r < 0.45 ? A.thrust : r < 0.7 ? A.lunge : null;
  }

  protected startAttack(def: EnemyAttack) {
    // phase 2 strings go one further
    if (this.phase === 2 && (def.id === 'thrust' || def.id === 'thrust2')) def = { ...def, chain: Math.min(0.9, (def.chain ?? 0.5) + 0.2) };
    super.startAttack(def);
  }

  protected onStrike(d: EnemyAttack) {
    if (d.id === 'rain') {
      const p = this.scene.player;
      const n = this.phase === 2 ? 7 : 4;
      const spread = this.phase === 2 ? 30 : 38;
      const xs = Array.from({ length: n }, (_, i) => p.x + (i - (n - 1) / 2) * spread + Phaser.Math.Between(-5, 5));
      xs.sort((a, b) => Math.abs(a - p.x) - Math.abs(b - p.x));
      xs.forEach((x, i) => this.scene.spawnFallingIcicle(x, 0.55 + i * 0.11));
      sfx.tell('nova');
    } else if (d.id === 'nova') {
      sfx.shatter();
      this.scene.combat.shake(0.014, 300);
      this.scene.fx.status(this.x, this.body.bottom - 10, 'cold', 60);
    } else if (d.id === 'lunge' || d.id === 'thrust3') {
      this.scene.fx.status(this.x + this.facing * 30, this.y - 10, 'cold', 10);
    }
  }
}

// =================================================================== Mire Mother (the Rotting Mire)

export const MOTHER: EnemyConfig = {
  key: 'mother',
  name: 'The Mire Mother',
  hp: 1550,
  poise: 210,
  walk: 14,
  chase: 18,
  aggro: 800,
  keepDist: 60,
  patrol: 0,
  souls: 9000,
  canJump: false,
  parryable: false,
  telegraph: 'zone',
  drops: [
    { item: 'mire_leathers', chance: 1 },
    { item: 'flask_shard', chance: 1 },
    { item: 'titanite', chance: 1, qty: 4 },
  ],
  hyperarmor: true,
  knockMul: 0.02,
  body: { w: 44, h: 58, ox: 58, oy: 54 },
  resist: { poison: 0, fire: 1.3 },
  openers: ['spit', 'slam', 'wave', 'summon'],
  attacks: {
    spit: {
      id: 'spit', tell: 'spit', startup: 0.9, active: 0.1, recovery: 0.6, damage: 0, poise: 0, range: 999, cooldown: 0.8,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'spitW', strike: 'spitS', recover: 'rec' },
    },
    slam: {
      id: 'slam', tell: 'slam', startup: 1.0, active: 0.14, recovery: 0.95, damage: 44, poise: 50, range: 96, cooldown: 0.9,
      hitbox: { x: 8, y: -34, w: 74, h: 64 }, lunge: 0, knock: 230, heavy: true, status: { type: 'poison', amount: 40 },
      frames: { windup: 'slamW', strike: 'slamS', recover: 'slamR' },
    },
    /** a low wave of mire water rolling out both ways: jump it */
    wave: {
      id: 'wave', tell: 'wave', startup: 1.1, active: 0.2, recovery: 1.1, damage: 20, poise: 0, range: 999, cooldown: 1,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'slamW', strike: 'slamS', recover: 'rec' },
    },
    summon: {
      id: 'summon', tell: 'summon', startup: 1.0, active: 0.1, recovery: 0.7, damage: 0, poise: 0, range: 999, cooldown: 1,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'spitW', strike: 'spitS', recover: 'rec' },
    },
    /** phase 2: sinks into the mire and bursts up under you */
    dive: {
      id: 'dive', tell: 'blink', startup: 1.0, active: 0.18, recovery: 1.1, damage: 40, poise: 50, range: 999, cooldown: 1.2,
      hitbox: { x: -40, y: -24, w: 80, h: 52 }, lunge: 0, knock: 240, heavy: true, status: { type: 'poison', amount: 50 },
      frames: { windup: 'sink', strike: 'slamS', recover: 'slamR' },
    },
  },
};

const WAVE_REACH_BOG = 260;
const DIVE_RISE = 0.45;

/**
 * A bloated swamp-mother squatting in the arena's mire. Lobs toxic globs that leave poison puddles,
 * slams the ground in front of her, sends out low waves of mire water you jump over, and births leeches.
 * Phase 2: faster, a fan of globs, and she sinks out of sight and bursts up beneath you.
 */
export class MireMother extends Boss {
  private summonCd = 5;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, MOTHER, x, y);
    this.phase2Tint = 0xd0f0a0;
    this.staggerTime = 1.6;
  }

  reset() {
    super.reset();
    this.summonCd = 5;
  }

  update(dt: number) {
    if (this.active && this.alive) {
      this.summonCd -= dt;
      if (this.atk?.def.id !== 'dive' && this.sprite.alpha < 1) this.sprite.setAlpha(1);
      if (Math.random() < 3 * dt) this.scene.fx.status(this.x + Phaser.Math.Between(-20, 20), this.body.top + 10, 'poison', 1);
    }
    super.update(dt);
  }

  protected enterPhase2() {
    this.speedMul = 1.15;
    this.summonCd = 0;
    this.scene.fx.status(this.x, this.y, 'poison', 50);
  }

  protected chooseAttack(dist: number): EnemyAttack | null {
    const A = this.cfg.attacks;
    if (this.summonCd <= 0 && this.scene.summonedAlive() < (this.phase === 2 ? 3 : 2) && Math.random() < 0.5) return A.summon;
    const r = Math.random();
    if (this.phase === 2 && r < 0.2) return A.dive;
    if (dist < 95) return r < 0.55 ? A.slam : r < 0.8 ? A.wave : A.spit;
    return r < 0.5 ? A.spit : r < 0.85 ? A.wave : null;
  }

  takeHit(h: HitInfo) {
    // nothing to hit while she is under the water
    if (this.atk?.def.id === 'dive' && this.atk.phase === 0 && this.atk.t > this.atk.def.startup * 0.5) return false;
    return super.takeHit(h);
  }

  protected updateAttack(dt: number, dx: number) {
    const a = this.atk!;
    const d = a.def;
    if (d.id === 'spit') {
      const p = this.scene.player;
      const zone = new Phaser.Geom.Rectangle(p.x - 16, p.feetY - 16, 32, 16);
      this.updateTelegraph(zone, Math.min(1, a.t / d.startup), p.feetY);
    }
    if (d.id === 'wave') return this.updateWave(dt, a);
    if (d.id === 'dive') return this.updateDive(dt, a);
    super.updateAttack(dt, dx);
  }

  private updateWave(dt: number, a: AttackRun) {
    const d = a.def;
    a.t += dt * this.speedMul;
    this.body.velocity.x = 0;
    const ground = this.groundY();
    if (a.t < d.startup) {
      const rect = new Phaser.Geom.Rectangle(this.x - WAVE_REACH_BOG, ground - 22, WAVE_REACH_BOG * 2, 22);
      this.updateTelegraph(rect, a.t / d.startup, ground);
    } else if (!a.swung) {
      a.swung = true;
      this.updateTelegraph(new Phaser.Geom.Rectangle(this.x - 40, ground - 22, 80, 22), 1, ground);
      sfx.slam();
      this.scene.combat.shake(0.016, 320);
      const speed = this.phase === 2 ? 150 : 120;
      this.scene.spawnBogWave(this.x - 26, ground, -1, speed, WAVE_REACH_BOG);
      this.scene.spawnBogWave(this.x + 26, ground, 1, speed, WAVE_REACH_BOG);
      this.scene.fx.status(this.x, ground - 8, 'poison', 30);
    } else if (a.t >= d.startup + d.active + d.recovery) {
      this.atk = null;
      this.cooldown = d.cooldown;
      this.setState('chase');
    }
  }

  /** the arena floor next to her (she squats in a pool, so her feet are a little lower) */
  private groundY() {
    return this.scene.level.boss?.y ?? this.body.bottom;
  }

  /** sink (untouchable), drift under the player, burst up – the rise is the dodge window */
  private updateDive(dt: number, a: AttackRun) {
    const d = a.def;
    const p = this.scene.player;
    a.t += dt * this.speedMul;
    this.body.velocity.x = 0;
    const [minX, maxX] = this.scene.arenaBounds();
    const riseX = () => Phaser.Math.Clamp(p.x, minX + 20, maxX - 20);
    if (a.phase === 0) {
      this.sprite.setAlpha(Math.max(0.05, 1 - a.t / (d.startup * 0.6)));
      if (Math.random() < 0.5) this.scene.fx.status(this.x + Phaser.Math.Between(-20, 20), this.body.bottom - 6, 'poison', 2);
      this.updateTelegraph(CombatSystem.box(riseX(), this.y, 1, d.hitbox), (a.t / d.startup) * 0.6);
      if (a.t >= d.startup) {
        const x = riseX();
        // stand on whatever is there: the pool floor, or the bank (never inside the rock)
        const g = this.groundY();
        const y = this.scene.isBogAt(x, g + 8) ? g + TILE : g;
        this.sprite.setPosition(x, y);
        this.body.reset(x, y);
        this.facing = p.x >= x ? 1 : -1;
        a.phase = 1;
        a.t = 0;
        this.scene.fx.status(x, y - 4, 'poison', 20);
        sfx.tell('wave');
      }
    } else if (a.phase === 1) {
      this.sprite.setAlpha(Math.min(1, 0.15 + a.t / DIVE_RISE));
      this.updateTelegraph(CombatSystem.box(this.x, this.y, 1, d.hitbox), 0.6 + (a.t / DIVE_RISE) * 0.39);
      if (a.t >= DIVE_RISE) {
        a.phase = 2;
        a.t = 0;
        this.sprite.setAlpha(1);
      }
    } else {
      if (a.t < d.active) {
        if (!a.swung) {
          a.swung = true;
          sfx.slam();
          this.scene.combat.shake(0.018, 300);
          this.updateTelegraph(CombatSystem.box(this.x, this.y, 1, d.hitbox), 1);
          this.scene.spawnGas(this.x, this.groundY(), 90, 3.5, 34);
        }
        if (!a.hit) a.hit = this.scene.combat.enemyStrike(CombatSystem.box(this.x, this.y, 1, d.hitbox), this.facing, d, this);
      } else if (a.t >= d.active + d.recovery) {
        this.atk = null;
        this.cooldown = d.cooldown;
        this.setState('chase');
      }
    }
  }

  protected animate() {
    const a = this.atk;
    if (this.state === 'attack' && a?.def.id === 'dive') {
      this.sprite.setFrame(a.phase === 0 ? 'sink' : a.phase === 1 ? 'sink' : a.t < a.def.active ? 'slamS' : 'slamR');
      return;
    }
    if (this.state === 'attack' && a?.def.id === 'wave') {
      const s = a.def.startup;
      this.sprite.setFrame(a.t < s ? 'slamW' : a.t < s + 0.4 ? 'slamS' : 'rec');
      return;
    }
    super.animate();
  }

  protected onStrike(d: EnemyAttack) {
    const p = this.scene.player;
    const mx = this.x + this.facing * 16;
    const my = this.body.top + 18;
    if (d.id === 'spit') {
      sfx.monster();
      if (this.phase === 2) for (const k of [-0.3, 0, 0.3]) this.scene.spawnToxGlob(mx, my, 18, p.x + (p.x - mx) * k);
      else {
        this.scene.spawnToxGlob(mx, my, 18);
        this.scene.time.delayedCall(240, () => this.alive && this.scene.spawnToxGlob(mx, my, 18, p.x + this.facing * 30));
      }
    } else if (d.id === 'slam') {
      sfx.slam();
      this.scene.combat.shake(0.016, 260);
      const fx = this.x + this.facing * 50;
      this.scene.fx.status(fx, this.groundY() - 6, 'poison', 20);
      this.scene.fx.dust(fx, this.groundY(), 10);
    } else if (d.id === 'summon') {
      const [minX, maxX] = this.scene.arenaBounds();
      // leeches wriggle out of the mire on both sides of her
      for (const side of [-1, 1]) {
        const x = Phaser.Math.Clamp(this.x + side * Phaser.Math.Between(50, 80), minX + 10, maxX - 10);
        const g = this.groundY();
        this.scene.summon('leech', x, this.scene.isBogAt(x, g + 8) ? g + TILE : g);
      }
      this.summonCd = this.phase === 2 ? 10 : 15;
      sfx.tell('summon');
    }
  }
}

// =================================================================== Sandstone Sphinx (the Buried Necropolis)

export const SPHINX: EnemyConfig = {
  key: 'sphinx',
  name: 'The Sandstone Sphinx',
  hp: 1800,
  poise: 180,
  walk: 34,
  chase: 46,
  aggro: 800,
  keepDist: 60,
  patrol: 0,
  souls: 12000,
  canJump: false,
  parryable: false,
  drops: [
    { item: 'sand_scepter', chance: 1 },
    { item: 'mummy_wraps', chance: 1 },
    { item: 'titanite', chance: 1, qty: 4 },
  ],
  hyperarmor: true,
  telegraph: 'zone',
  knockMul: 0.05,
  body: { w: 54, h: 48, ox: 53, oy: 48 },
  resist: { poison: 0.5, fire: 0.8 },
  openers: ['paw', 'maul', 'pounce'],
  attacks: {
    /** a low swipe of the forepaw along the floor: jump it */
    paw: {
      id: 'paw', tell: 'low', startup: 0.72, active: 0.14, recovery: 0.5, damage: 34, poise: 30, range: 86, cooldown: 0.7,
      hitbox: { x: -6, y: 4, w: 82, h: 20 }, lunge: 90, knock: 200, heavy: true,
      frames: { windup: 'pawW', strike: 'pawS', recover: 'pawR' }, next: 'maul', chain: 0.45,
    },
    /** rears up and brings both paws down: get out of the zone */
    maul: {
      id: 'maul', tell: 'slam', startup: 1.0, active: 0.14, recovery: 0.9, damage: 52, poise: 50, range: 88, cooldown: 0.9,
      hitbox: { x: 8, y: -30, w: 72, h: 56 }, lunge: 60, knock: 240, heavy: true,
      frames: { windup: 'maulW', strike: 'maulS', recover: 'maulR' },
    },
    pounce: {
      id: 'pounce', tell: 'leap', startup: 0.8, active: 0.12, recovery: 1.1, damage: 46, poise: 50, range: 320, minRange: 115, cooldown: 1.2,
      hitbox: { x: -48, y: -6, w: 96, h: 32 }, lunge: 0, knock: 230, heavy: true,
      frames: { windup: 'crouch', strike: 'maulS', recover: 'maulR' },
    },
    /** phase 2: rears up high and slams the whole floor – shockwaves race out both ways */
    quake: {
      id: 'quake', tell: 'nova', startup: 1.2, active: 0.16, recovery: 1.3, damage: 44, poise: 50, range: 120, cooldown: 1,
      hitbox: { x: -72, y: -30, w: 144, h: 56 }, lunge: 0, knock: 240, heavy: true,
      frames: { windup: 'rear', strike: 'maulS', recover: 'maulR' },
    },
  },
};

/**
 * A great lion of sandstone with a pharaoh's face and green-lit eyes.
 * 100%: heavy strikes (low paw swipe → maul) and a pounce across the hall.
 * 50%: the quake – a floor slam with shockwaves both ways.
 * 25%: a sandstorm fills the hall and she speeds up.
 */
export class Sphinx extends Boss {
  private leapX = 0;
  private leapT = 0;
  private leapY = 0;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, SPHINX, x, y);
    this.phase2Tint = 0xffe0b0;
    this.thresholds = [0.5, 0.25];
    this.staggerTime = 1.6;
  }

  protected enterPhase2() {
    this.speedMul = 1.12;
    this.scene.fx.dust(this.x, this.body.bottom, 30);
  }

  protected enterPhase(n: number) {
    if (n === 3) {
      this.speedMul = 1.25;
      this.scene.setSandstorm(true);
    }
  }

  protected chooseAttack(dist: number): EnemyAttack | null {
    const A = this.cfg.attacks;
    const r = Math.random();
    if (dist > 125) return r < 0.6 ? A.pounce : null;
    if (dist < 95) {
      if (this.phase >= 2 && r < 0.28) return A.quake;
      return r < 0.55 ? A.paw : A.maul;
    }
    return r < 0.35 ? A.pounce : null;
  }

  protected updateAttack(dt: number, dx: number) {
    const a = this.atk!;
    if (a.def.id !== 'pounce') return super.updateAttack(dt, dx);
    const d = a.def;
    const p = this.scene.player;
    const [minX, maxX] = this.scene.arenaBounds();
    const landX = () => Phaser.Math.Clamp(p.x, minX + 30, maxX - 30);
    const zone = (x: number) => CombatSystem.box(x, a.phase === 1 ? this.leapY : this.body.bottom, 1, d.hitbox);
    if (a.phase === 0) {
      this.leapY = this.body.bottom;
      a.t += dt * this.speedMul;
      this.facing = dx >= 0 ? 1 : -1;
      this.body.velocity.x = 0;
      this.leapX = landX();
      this.updateTelegraph(zone(this.leapX), (a.t / d.startup) * 0.7);
      if (a.t >= d.startup) {
        a.phase = 1;
        this.body.velocity.y = -340;
        this.body.velocity.x = Phaser.Math.Clamp((this.leapX - this.x) / 0.72, -300, 300);
        this.leapT = 0;
        this.scene.fx.dust(this.x, this.body.bottom, 14);
        sfx.roar();
      }
    } else if (a.phase === 1) {
      this.leapT += dt;
      this.updateTelegraph(zone(this.leapX), 0.7 + Math.min(0.29, (this.leapT / 0.72) * 0.29), this.leapY);
      if (this.onGround && this.body.velocity.y >= 0) {
        this.updateTelegraph(zone(this.x), 1);
        a.phase = 2;
        a.t = d.startup + d.active;
        this.body.velocity.x = 0;
        sfx.slam();
        this.scene.combat.shake(0.022, 340);
        this.scene.fx.dust(this.x - 30, this.body.bottom, 12);
        this.scene.fx.dust(this.x + 30, this.body.bottom, 12);
        this.scene.combat.enemyStrike(CombatSystem.box(this.x, this.body.bottom, 1, d.hitbox), this.facing, d, this);
      }
    } else {
      a.t += dt * this.speedMul;
      this.body.velocity.x = 0;
      if (a.t >= d.startup + d.active + d.recovery) {
        this.atk = null;
        this.cooldown = d.cooldown;
        this.setState('chase');
      }
    }
  }

  protected animate() {
    if (this.state === 'attack' && this.atk?.def.id === 'pounce') {
      const a = this.atk;
      this.sprite.setFrame(a.phase === 0 ? 'crouch' : a.phase === 1 ? 'air' : 'maulR');
      return;
    }
    super.animate();
  }

  protected onStrike(d: EnemyAttack) {
    if (d.id === 'maul') {
      sfx.slam();
      this.scene.combat.shake(0.016, 260);
      this.scene.fx.dust(this.x + this.facing * 44, this.body.bottom, 14);
    } else if (d.id === 'quake') {
      sfx.slam();
      this.scene.combat.shake(0.026, 450);
      this.scene.fx.dust(this.x, this.body.bottom, 30);
      for (const dir of [-1, 1]) {
        this.scene.spawnShockwave(this.x + dir * 30, this.body.bottom, dir);
        if (this.phase >= 3) this.scene.time.delayedCall(260, () => this.alive && this.scene.spawnShockwave(this.x + dir * 30, this.body.bottom, dir));
      }
    }
  }
}

// =================================================================== Varro, the Undying Gladiator (the Khepri Wastes)

export const GLADIATOR: EnemyConfig = {
  key: 'gladiator',
  name: 'Varro, the Undying Gladiator',
  hp: 1800,
  poise: 130,
  walk: 50,
  chase: 66,
  aggro: 800,
  keepDist: 40,
  patrol: 0,
  souls: 15000,
  canJump: false,
  parryable: true,
  drops: [
    { item: 'gladiator_blades', chance: 1 },
    { item: 'legion_plate', chance: 1 },
    { item: 'flask_shard', chance: 1 },
    { item: 'titanite', chance: 1, qty: 4 },
  ],
  hyperarmor: true,
  telegraph: 'zone',
  knockMul: 0.15,
  body: { w: 16, h: 42, ox: 40, oy: 38 },
  openers: ['slash', 'cross', 'spikes', 'spin'],
  attacks: {
    slash: {
      id: 'slash', tell: 'high', startup: 0.5, active: 0.12, recovery: 0.3, damage: 28, poise: 22, range: 62, cooldown: 0.7,
      hitbox: { x: -4, y: -20, w: 52, h: 40 }, lunge: 140, knock: 170,
      frames: { windup: 'slashW', strike: 'slashS', recover: 'slashR' }, next: 'slash2', chain: 0.7,
    },
    slash2: {
      id: 'slash2', tell: 'high', startup: 0.34, active: 0.12, recovery: 0.4, damage: 28, poise: 22, range: 62, cooldown: 0.8,
      hitbox: { x: -4, y: -20, w: 52, h: 40 }, lunge: 140, knock: 170,
      frames: { windup: 'slash2W', strike: 'slash2S', recover: 'slashR' }, next: 'cross', chain: 0.45,
    },
    /** both blades driven forward in a long lunge: parry it */
    cross: {
      id: 'cross', tell: 'pierce', startup: 0.62, active: 0.14, recovery: 0.85, damage: 38, poise: 34, range: 120, cooldown: 1,
      hitbox: { x: 0, y: -12, w: 56, h: 22 }, lunge: 230, knock: 220, heavy: true,
      frames: { windup: 'crossW', strike: 'crossS', recover: 'slashR' },
    },
    /** blades raised to the crowd: spikes burst from the sand in a line toward you */
    spikes: {
      id: 'spikes', tell: 'rain', startup: 0.9, active: 0.1, recovery: 0.8, damage: 0, poise: 0, range: 999, cooldown: 1,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'raise', strike: 'raise', recover: 'idle0' },
    },
    /** a whirling storm of steel that hunts you; when it stops he is dizzy – that's your window */
    spin: {
      id: 'spin', tell: 'high', startup: 0.8, active: 0.1, recovery: 1.8, damage: 16, poise: 20, range: 220, cooldown: 1,
      hitbox: { x: -28, y: -22, w: 56, h: 44 }, lunge: 0, knock: 180, noParry: true,
      frames: { windup: 'spinW', strike: 'spin0', recover: 'dizzy' },
    },
  },
};

const SPIN_HIT_EVERY = 0.4;

/**
 * The last of the arena's champions, a blade in each hand.
 *  phase 1 (100%): slash strings (parryable), a lunging cross-thrust, ground spikes
 *  phase 2 (75%):  + the hunting spin (then dizzy)
 *  phase 3 (50%):  + sandstorm
 *  phase 4 (25%):  spikes return and trail the spin; faster
 */
export class Gladiator extends Boss {
  private spinFor = 3;
  private spinHitT = 0;
  private spikeT = 0;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, GLADIATOR, x, y);
    this.phase2Tint = 0xffd0b0;
    this.thresholds = [0.75, 0.5, 0.25];
  }

  protected enterPhase2() {
    this.speedMul = 1.1;
  }

  protected enterPhase(n: number) {
    if (n === 3) this.scene.setSandstorm(true);
    if (n === 4) {
      this.speedMul = 1.25;
      this.scene.fx.dust(this.x, this.body.bottom, 30);
    }
  }

  private canSpin() {
    return this.phase >= 2;
  }
  private canSpike() {
    return this.phase === 1 || this.phase === 4;
  }

  protected chooseAttack(dist: number): EnemyAttack | null {
    const A = this.cfg.attacks;
    const r = Math.random();
    if (dist > 100) {
      if (this.canSpin() && r < 0.4) return A.spin;
      if (this.canSpike() && r < 0.75) return A.spikes;
      return r < 0.9 && dist < 125 ? A.cross : null;
    }
    if (this.canSpin() && r < 0.18) return A.spin;
    if (this.canSpike() && r < 0.3) return A.spikes;
    return r < 0.72 ? A.slash : A.cross;
  }

  protected startAttack(def: EnemyAttack) {
    if (def.id === 'spin') {
      this.spinFor = this.phase === 4 ? 3 : 2.6;
      this.spinHitT = 0;
      this.spikeT = 0.5;
    }
    super.startAttack(def);
  }

  protected updateAttack(dt: number, dx: number) {
    const a = this.atk!;
    if (a.def.id !== 'spin') return super.updateAttack(dt, dx);
    const d = a.def;
    const p = this.scene.player;
    a.t += dt * this.speedMul;
    const box = () => CombatSystem.box(this.x, this.y, 1, d.hitbox);
    if (a.phase === 0) {
      // wind-up: blades out wide, the zone marks the whirl
      this.body.velocity.x = 0;
      this.facing = dx >= 0 ? 1 : -1;
      this.updateTelegraph(box(), a.t / d.startup);
      if (a.t >= d.startup) {
        this.updateTelegraph(box(), 1);
        a.phase = 1;
        a.t = 0;
        sfx.swing(true);
      }
    } else if (a.phase === 1) {
      // spinning: drifts after the player, cuts every SPIN_HIT_EVERY
      const speed = this.phase === 4 ? 100 : 80;
      const dir = Math.sign(p.x - this.x) || 1;
      let vx = Phaser.Math.Linear(this.body.velocity.x, dir * speed, 3 * dt);
      if (this.edgeAhead(Math.sign(vx) || 1)) vx = 0;
      this.body.velocity.x = vx;
      this.spinHitT -= dt;
      if (this.spinHitT <= 0) {
        this.spinHitT = SPIN_HIT_EVERY;
        sfx.swing(false);
        this.scene.combat.enemyStrike(box(), dir, d, this);
        this.scene.fx.dust(this.x, this.body.bottom, 3);
      }
      if (this.phase === 4 && (this.spikeT -= dt) <= 0) {
        this.spikeT = 0.7;
        this.scene.spawnGroundSpike(this.x - dir * 30, this.body.bottom, 0.35);
      }
      if (a.t >= this.spinFor) {
        a.phase = 2;
        a.t = 0;
        this.body.velocity.x = 0;
        this.scene.fx.dust(this.x, this.body.top - 4, 6);
      }
    } else {
      // dizzy: staggering, wide open
      this.body.velocity.x = Phaser.Math.Linear(this.body.velocity.x, 0, 6 * dt);
      if (a.t >= d.recovery) {
        this.atk = null;
        this.cooldown = d.cooldown;
        this.setState('chase');
      }
    }
  }

  protected animate() {
    const a = this.atk;
    if (this.state === 'attack' && a?.def.id === 'spin') {
      this.sprite.setFrame(a.phase === 0 ? 'spinW' : a.phase === 1 ? `spin${Math.floor(this.animT * 16) % 4}` : 'dizzy');
      return;
    }
    super.animate();
  }

  protected onStrike(d: EnemyAttack) {
    if (d.id !== 'spikes') return;
    const p = this.scene.player;
    const g = this.body.bottom;
    const [minX, maxX] = this.scene.arenaBounds();
    const dir = Math.sign(p.x - this.x) || 1;
    const n = this.phase === 4 ? 7 : 5;
    // a line of spikes racing from his feet toward (and past) the player
    for (let i = 0; i < n; i++) {
      const x = this.x + dir * (40 + i * 30);
      if (x < minX || x > maxX) break;
      this.scene.spawnGroundSpike(x, g, 0.4 + i * 0.1);
    }
    if (this.phase === 4) this.scene.spawnGroundSpike(Phaser.Math.Clamp(p.x, minX, maxX), g, 0.55);
    sfx.roar();
  }
}

// =================================================================== The Sky Leviathan (the Sky Reaches)

export const LEVIATHAN: EnemyConfig = {
  key: 'leviathan',
  name: 'The Sky Leviathan',
  hp: 2100,
  poise: 220,
  walk: 40,
  chase: 60,
  aggro: 900,
  keepDist: 40,
  patrol: 0,
  souls: 18000,
  canJump: false,
  parryable: false,
  drops: [
    { item: 'cloudbreaker', chance: 1 },
    { item: 'whale_scale', chance: 1 },
    { item: 'white_cloak', chance: 1 },
    { item: 'titanite', chance: 1, qty: 5 },
  ],
  hyperarmor: true,
  telegraph: 'zone',
  knockMul: 0,
  // frame 240 wide; the whale is drawn 22 px right of the frame centre (room for the tail)
  body: { w: 96, h: 34, ox: 94, oy: 50 },
  resist: { cold: 0.6, fire: 1.2 },
  openers: ['bite', 'tail', 'bubbles', 'gust'],
  attacks: {
    /** marks you, then dives jaws-first onto the platform – and lies there a moment: your window */
    bite: {
      id: 'bite', tell: 'leap', startup: 0.9, active: 0.35, recovery: 1.1, damage: 46, poise: 50, range: 999, cooldown: 1,
      // a modest shove: a hit should hurt, not throw you off a cloud
      hitbox: { x: 18, y: -20, w: 50, h: 38 }, lunge: 0, knock: 100, heavy: true,
      frames: { windup: 'biteW', strike: 'biteS', recover: 'low' },
    },
    /** turns tail toward you, sinks to the platform and slams the flukes down in front of it */
    tail: {
      id: 'tail', tell: 'slam', startup: 1.1, active: 0.16, recovery: 1.0, damage: 50, poise: 60, range: 220, cooldown: 1,
      hitbox: { x: 24, y: -26, w: 92, h: 52 }, lunge: 0, knock: 120, heavy: true,
      frames: { windup: 'tailW', strike: 'tailS', recover: 'low' },
    },
    /** phase 2: a fan of cloud bubbles lobbed at you */
    bubbles: {
      id: 'bubbles', tell: 'spit', startup: 0.9, active: 0.1, recovery: 0.6, damage: 0, poise: 0, range: 999, cooldown: 0.8,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'mouthW', strike: 'mouthS', recover: 'idle0' },
    },
    /** phase 2: a blast of wind bolts from the blowhole */
    gust: {
      id: 'gust', tell: 'pierce', startup: 0.8, active: 0.1, recovery: 0.6, damage: 0, poise: 0, range: 999, cooldown: 0.8,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'mouthW', strike: 'mouthS', recover: 'idle0' },
    },
  },
};

/** how high the whale's belly floats above the platform (px) */
const LEVI_HOVER = 54;
const LEVI_RISE = 0.6;

/**
 * A whale the size of a house, swimming through the sky beside its floating platform.
 *  phase 1 (100%): the diving bite and the tail slam – both leave it low and open for a moment
 *  phase 2 (50%):  the platform breaks into drifting cloud; it adds bubble fans and wind blasts from range
 */
export class Leviathan extends Boss {
  private floorY: number;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, LEVIATHAN, x, y);
    this.floorY = y;
    this.body.setAllowGravity(false);
    this.spawn.y = y - LEVI_HOVER - 12;
    this.sprite.setPosition(x, this.spawn.y);
    this.body.reset(x, this.spawn.y);
    this.phase2Tint = 0xd8e8ff;
    this.staggerTime = 1.6;
    // floats free of the platform's tiles
    this.collider.active = false;
  }

  reset() {
    super.reset();
    this.body.setAllowGravity(false);
  }

  private get hoverBottom() {
    return this.floorY - LEVI_HOVER;
  }

  update(dt: number) {
    if (this.alive && this.active && this.state !== 'attack') {
      // keep swimming at hover height (bobbing)
      const target = this.hoverBottom + Math.sin(this.animT * 1.6) * 4;
      this.body.velocity.y = (target - this.body.bottom) * 3;
    }
    super.update(dt);
  }

  /** comes to rest on the platform, so what it leaves behind lands within reach */
  die(dir = 0) {
    if (!this.alive) return;
    this.atk = null;
    this.body.setVelocity(0, 0);
    this.sprite.y += this.floorY - this.body.bottom;
    this.body.reset(this.sprite.x, this.sprite.y);
    super.die(dir);
  }

  protected enterPhase2() {
    this.speedMul = 1.15;
    this.scene.splitArena();
  }

  protected chase(dt: number, dx: number, dist: number) {
    const p = this.scene.player;
    if (!p.alive) return;
    this.facing = dx >= 0 ? 1 : -1;
    if (this.cooldown <= 0) {
      const a = this.chooseAttack(dist);
      if (a) return this.startAttack(a);
    }
    // swim to a spot beside the player, a little above the platform
    const tx = p.x - this.facing * 90;
    const vx = Phaser.Math.Clamp((tx - this.x) * 1.5, -this.cfg.chase, this.cfg.chase) * this.speedMul;
    this.body.velocity.x = Phaser.Math.Linear(this.body.velocity.x, vx, 4 * dt);
  }

  protected chooseAttack(dist: number): EnemyAttack | null {
    const A = this.cfg.attacks;
    const r = Math.random();
    if (this.phase >= 2) {
      if (r < 0.28) return A.bubbles;
      if (r < 0.48) return A.gust;
      return r < 0.75 ? A.bite : dist < 200 ? A.tail : A.bite;
    }
    if (dist < 200 && r < 0.45) return A.tail;
    return A.bite;
  }

  protected updateAttack(dt: number, dx: number) {
    const a = this.atk!;
    const d = a.def;
    const p = this.scene.player;
    a.t += dt * this.speedMul;
    const done = () => {
      this.atk = null;
      this.cooldown = d.cooldown * Phaser.Math.FloatBetween(0.8, 1.3);
      this.setState('chase');
    };
    if (d.id === 'bubbles' || d.id === 'gust') {
      this.body.velocity.x *= 0.9;
      this.body.velocity.y = (this.hoverBottom - this.body.bottom) * 3;
      this.facing = dx >= 0 ? 1 : -1;
      if (d.id === 'bubbles' && a.t < d.startup) this.updateTelegraph(new Phaser.Geom.Rectangle(p.x - 16, p.feetY - 16, 32, 16), a.t / d.startup, p.feetY);
      if (!a.swung && a.t >= d.startup) {
        a.swung = true;
        if (d.id === 'bubbles') this.updateTelegraph(new Phaser.Geom.Rectangle(p.x - 16, p.feetY - 16, 32, 16), 1, p.feetY);
        this.onStrike(d);
      }
      if (a.t >= d.startup + d.active + d.recovery) done();
      return;
    }
    const [minX, maxX] = this.scene.arenaBounds();
    if (d.id === 'bite') {
      if (a.phase === 0) {
        // circle above you while the reticle closes in
        this.facing = dx >= 0 ? 1 : -1;
        const tx = Phaser.Math.Clamp(p.x - this.facing * 70, minX, maxX);
        this.body.velocity.x = (tx - this.x) * 2;
        this.body.velocity.y = (this.hoverBottom - 18 - this.body.bottom) * 3;
        const mark = Phaser.Math.Clamp(p.x, minX + 20, maxX - 20);
        this.updateTelegraph(new Phaser.Geom.Rectangle(mark - 34, this.floorY - 30, 68, 30), (a.t / d.startup) * 0.95, this.floorY);
        if (a.t >= d.startup) {
          a.phase = 1;
          a.t = 0;
          // the jaws come down where you stood when it committed
          a.hit = false;
          (a as AttackRun & { tx?: number }).tx = Phaser.Math.Clamp(p.x - this.facing * 30, minX, maxX);
          sfx.roar();
        }
      } else if (a.phase === 1) {
        const tx = (a as AttackRun & { tx?: number }).tx ?? p.x;
        const left = Math.max(0.05, d.active - a.t);
        this.body.velocity.x = (tx - this.x) / left;
        this.body.velocity.y = (this.floorY - 2 - this.body.bottom) / left;
        if (!a.swung) {
          a.swung = true;
          this.updateTelegraph(new Phaser.Geom.Rectangle(tx - 34, this.floorY - 30, 68, 30), 1);
        }
        if (!a.hit) a.hit = this.scene.combat.enemyStrike(CombatSystem.box(this.x, this.y, this.facing, d.hitbox), this.facing, d, this);
        if (a.t >= d.active) {
          a.phase = 2;
          a.t = 0;
          this.body.setVelocity(0, 0);
          sfx.slam();
          this.scene.combat.shake(0.016, 300);
          this.scene.fx.cloud(this.x + this.facing * 30, this.floorY, 12);
        }
      } else if (a.phase === 2) {
        // lying low on the platform: hit it now
        this.body.setVelocity(0, 0);
        if (a.t >= d.recovery) {
          a.phase = 3;
          a.t = 0;
        }
      } else {
        this.body.velocity.y = (this.hoverBottom - this.body.bottom) / Math.max(0.1, LEVI_RISE - a.t);
        this.body.velocity.x = 0;
        if (a.t >= LEVI_RISE) done();
      }
      return;
    }
    // tail slam
    if (a.phase === 0) {
      // turn the flukes toward the player and sink to the platform
      this.facing = dx >= 0 ? -1 : 1;
      this.body.velocity.x = 0;
      this.body.velocity.y = (this.floorY - 6 - this.body.bottom) * 3;
      const zone = CombatSystem.box(this.x, this.floorY - 26, -this.facing, d.hitbox);
      this.updateTelegraph(zone, a.t / d.startup, this.floorY);
      if (a.t >= d.startup) {
        a.phase = 1;
        a.t = 0;
        this.updateTelegraph(zone, 1, this.floorY);
        sfx.slam();
        this.scene.combat.shake(0.022, 400);
        this.scene.combat.enemyStrike(zone, -this.facing, d, this);
        this.scene.spawnShockwave(this.x - this.facing * 110, this.floorY, -this.facing);
        this.scene.fx.cloud(this.x - this.facing * 70, this.floorY, 16);
      }
    } else if (a.phase === 1) {
      this.body.setVelocity(0, 0);
      if (a.t >= d.recovery) {
        a.phase = 2;
        a.t = 0;
      }
    } else {
      this.body.velocity.y = (this.hoverBottom - this.body.bottom) / Math.max(0.1, LEVI_RISE - a.t);
      if (a.t >= LEVI_RISE) done();
    }
  }

  protected animate() {
    const a = this.atk;
    if (this.state === 'attack' && a) {
      const id = a.def.id;
      let f = 'idle0';
      if (id === 'bite') f = a.phase === 0 ? 'biteW' : a.phase === 1 ? 'biteS' : 'low';
      else if (id === 'tail') f = a.phase === 0 ? 'tailW' : a.phase === 1 ? 'tailS' : 'low';
      else f = a.t < a.def.startup ? 'mouthW' : 'mouthS';
      this.sprite.setFrame(f);
      return;
    }
    if (this.state === 'hurt' || this.state === 'stagger') return this.sprite.setFrame('hurt') as unknown as void;
    this.sprite.setFrame(`walk${Math.floor(this.animT * 4) % 4}`);
  }

  protected onStrike(d: EnemyAttack) {
    const p = this.scene.player;
    const mx = this.x + this.facing * 44;
    const my = this.body.top + 18;
    if (d.id === 'bubbles') {
      const n = this.phase >= 2 ? 5 : 3;
      for (let i = 0; i < n; i++) this.scene.spawnPuff(mx, my, 20, p.x + (i - (n - 1) / 2) * 34);
      sfx.monster();
    } else if (d.id === 'gust') {
      for (const k of [-26, -8, 10]) this.scene.spawnShard(this.x, this.body.top + 4, 18, 0, k, 'windbolt');
      this.scene.fx.cloud(this.x, this.body.top, 10);
    }
  }
}

// =================================================================== Ayame, the Weeping Bride (the Weeping Shrine)

export const AYAME: EnemyConfig = {
  key: 'ayame',
  name: 'Ayame, the Weeping Bride',
  hp: 1900,
  poise: 110,
  walk: 34,
  chase: 54,
  aggro: 800,
  keepDist: 40,
  patrol: 0,
  souls: 22000,
  canJump: false,
  // her knife can be parried – the gold lance tell is the cue
  parryable: true,
  drops: [
    { item: 'bridal_knife', chance: 1 },
    { item: 'white_kimono', chance: 1 },
    { item: 'flask_shard', chance: 1 },
    { item: 'titanite', chance: 1, qty: 5 },
  ],
  hyperarmor: true,
  telegraph: 'zone',
  knockMul: 0.15,
  body: { w: 14, h: 40, ox: 41, oy: 40 },
  resist: { poison: 0, fire: 1.3 },
  openers: ['stab', 'slash', 'rush', 'vanish', 'hair', 'mirror'],
  attacks: {
    stab: {
      id: 'stab', tell: 'pierce', startup: 0.55, active: 0.12, recovery: 0.35, damage: 30, poise: 24, range: 62, cooldown: 0.7,
      hitbox: { x: 0, y: -8, w: 50, h: 16 }, lunge: 140, knock: 160,
      frames: { windup: 'stabW', strike: 'stabS', recover: 'stabR' }, next: 'stab2', chain: 0.55,
    },
    stab2: {
      id: 'stab2', tell: 'pierce', startup: 0.4, active: 0.12, recovery: 0.5, damage: 30, poise: 24, range: 62, cooldown: 0.8,
      hitbox: { x: 0, y: -8, w: 50, h: 16 }, lunge: 140, knock: 160,
      frames: { windup: 'stabW', strike: 'stabS', recover: 'stabR' }, next: 'slash', chain: 0.4,
    },
    /** the knife raised over her head and brought down in an arc */
    slash: {
      id: 'slash', tell: 'high', startup: 0.75, active: 0.14, recovery: 0.6, damage: 36, poise: 32, range: 62, cooldown: 0.9,
      hitbox: { x: -4, y: -30, w: 52, h: 50 }, lunge: 90, knock: 190, heavy: true,
      frames: { windup: 'slashW', strike: 'slashS', recover: 'slashR' },
    },
    /** phase 2: bent double, arms trailing, she runs at you and drives the knife in */
    rush: {
      id: 'rush', tell: 'pierce', startup: 0.7, active: 0.55, recovery: 0.9, damage: 34, poise: 30, range: 230, minRange: 70, cooldown: 1.1,
      hitbox: { x: 0, y: -10, w: 30, h: 20 }, lunge: 300, knock: 200, heavy: true,
      frames: { windup: 'runW', strike: 'run1', recover: 'stabR' },
    },
    /** phase 3: she fades into the dark and steps out behind you */
    vanish: {
      id: 'vanish', tell: 'blink', startup: 0.7, active: 0.14, recovery: 0.7, damage: 34, poise: 30, range: 999, cooldown: 1.2,
      hitbox: { x: -4, y: -30, w: 52, h: 50 }, lunge: 0, knock: 190, heavy: true,
      frames: { windup: 'idle0', strike: 'slashS', recover: 'slashR' },
    },
    /** phase 4: hair lashes up out of the floor boards around you */
    hair: {
      id: 'hair', tell: 'rain', startup: 0.8, active: 0.1, recovery: 0.7, damage: 0, poise: 0, range: 999, cooldown: 1,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'weep', strike: 'weep', recover: 'idle0' },
    },
    /** phase 4: two pale reflections step out of her */
    mirror: {
      id: 'mirror', tell: 'summon', startup: 0.9, active: 0.1, recovery: 0.6, damage: 0, poise: 0, range: 999, cooldown: 1,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'weep', strike: 'weep', recover: 'idle0' },
    },
  },
};

const AYAME_RISE = 0.35;

/**
 * A bride in white with a knife, hair hanging over her face.
 *  phase 1 (100%): stab strings (PARRY them – gold lance tell) and an overhead slash
 *  phase 2 (75%):  + the rush: bent double, she runs at you knife-first
 *  phase 3 (50%):  every lantern goes out – only her eyes show; she vanishes and steps out behind you
 *  phase 4 (25%):  hair from the floor, and mirror shades of her (the real one is the one with a shadow)
 */
export class Ayame extends Boss {
  private shadow: Phaser.GameObjects.Image;
  private mirrorCd = 0;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, AYAME, x, y);
    this.phase2Tint = 0xffe8ec;
    this.thresholds = [0.75, 0.5, 0.25];
    this.shadow = scene.add.image(x, y, 'shadow').setDepth(this.sprite.depth - 1).setScale(1.2, 1);
  }

  destroy() {
    this.shadow.destroy();
    super.destroy();
  }

  reset() {
    super.reset();
    this.mirrorCd = 0;
  }

  update(dt: number) {
    this.shadow.setPosition(this.x, this.body.bottom).setAlpha(this.alive ? this.sprite.alpha : 0);
    if (this.active && this.alive) {
      this.mirrorCd -= dt;
      if (this.atk?.def.id !== 'vanish' && this.sprite.alpha < 1) this.sprite.setAlpha(1);
      // in the dark, the red of her eyes is all you see
      if (this.scene.gloom && Math.random() < 6 * dt) this.scene.fx.status(this.x + this.facing * 3, this.body.top + 6, 'fire', 1);
    }
    super.update(dt);
  }

  protected enterPhase2() {
    this.speedMul = 1.1;
  }

  protected enterPhase(n: number) {
    if (n === 3) this.scene.setGloom(true);
    if (n === 4) {
      this.speedMul = 1.2;
      this.mirrorCd = 0;
    }
  }

  protected chooseAttack(dist: number): EnemyAttack | null {
    const A = this.cfg.attacks;
    const r = Math.random();
    if (this.phase >= 4) {
      if (this.mirrorCd <= 0 && this.scene.summonedAlive() < 2 && r < 0.3) return A.mirror;
      if (r < 0.45) return A.hair;
    }
    if (this.phase >= 3 && r < 0.3) return A.vanish;
    if (dist > 90) return this.phase >= 2 && r < 0.7 ? A.rush : null;
    return r < 0.6 ? A.stab : A.slash;
  }

  /** can't be hit while she is gone */
  takeHit(h: HitInfo) {
    if (this.atk?.def.id === 'vanish' && this.atk.phase === 0 && this.atk.t > this.atk.def.startup * 0.5) return false;
    return super.takeHit(h);
  }

  protected updateAttack(dt: number, dx: number) {
    const a = this.atk!;
    const d = a.def;
    if (d.id === 'hair' || d.id === 'mirror') {
      a.t += dt * this.speedMul;
      this.body.velocity.x = 0;
      if (!a.swung && a.t >= d.startup) {
        a.swung = true;
        this.onStrike(d);
      }
      if (a.t >= d.startup + d.active + d.recovery) {
        this.atk = null;
        this.cooldown = d.cooldown;
        this.setState('chase');
      }
      return;
    }
    if (d.id !== 'vanish') return super.updateAttack(dt, dx);
    const p = this.scene.player;
    a.t += dt * this.speedMul;
    this.body.velocity.x = 0;
    const [minX, maxX] = this.scene.arenaBounds();
    const behind = () => Phaser.Math.Clamp(p.x - p.facing * 40, minX, maxX);
    if (a.phase === 0) {
      this.sprite.setAlpha(Math.max(0.05, 1 - a.t / d.startup));
      const rx = behind();
      this.updateTelegraph(CombatSystem.box(rx, this.y, p.x >= rx ? 1 : -1, d.hitbox), (a.t / d.startup) * 0.5);
      if (a.t >= d.startup) {
        const x = behind();
        this.sprite.x += x - this.x;
        this.body.reset(this.sprite.x, this.sprite.y);
        this.facing = p.x >= x ? 1 : -1;
        a.phase = 1;
        a.t = 0;
        sfx.tell('blink');
      }
    } else if (a.phase === 1) {
      this.sprite.setAlpha(Math.min(1, 0.15 + a.t / AYAME_RISE));
      this.updateTelegraph(CombatSystem.box(this.x, this.y, this.facing, d.hitbox), 0.5 + (a.t / AYAME_RISE) * 0.49);
      if (a.t >= AYAME_RISE) {
        a.phase = 2;
        a.t = 0;
        this.sprite.setAlpha(1);
      }
    } else {
      if (a.t < d.active) {
        if (!a.swung) {
          a.swung = true;
          sfx.swing(true);
          this.updateTelegraph(CombatSystem.box(this.x, this.y, this.facing, d.hitbox), 1);
        }
        if (!a.hit) a.hit = this.scene.combat.enemyStrike(CombatSystem.box(this.x, this.y, this.facing, d.hitbox), this.facing, d, this);
      } else if (a.t >= d.active + d.recovery) {
        this.atk = null;
        this.cooldown = d.cooldown;
        this.setState('chase');
      }
    }
  }

  protected animate() {
    const a = this.atk;
    if (this.state === 'attack' && a?.def.id === 'vanish') {
      this.sprite.setFrame(a.phase < 2 ? 'slashW' : a.t < a.def.active ? 'slashS' : 'slashR');
      return;
    }
    if (this.state === 'attack' && a?.def.id === 'rush') {
      const s = a.def.startup;
      this.sprite.setFrame(a.t < s ? 'runW' : a.t < s + a.def.active ? `run${Math.floor(a.t * 12) % 4}` : 'stabR');
      return;
    }
    if (this.state === 'chase' && Math.abs(this.body.velocity.x) > 8) {
      this.sprite.setFrame(`walk${Math.floor(this.animT * 7) % 4}`);
      return;
    }
    super.animate();
  }

  protected onStrike(d: EnemyAttack) {
    const p = this.scene.player;
    const [minX, maxX] = this.scene.arenaBounds();
    if (d.id === 'hair') {
      const xs = [p.x, p.x - 36, p.x + 36, p.x - 72, p.x + 72];
      xs.forEach((x, i) => this.scene.spawnGroundSpike(Phaser.Math.Clamp(x, minX, maxX), this.body.bottom, 0.45 + i * 0.1, 'hairspike'));
      sfx.tell('summon');
    } else if (d.id === 'mirror') {
      for (const side of [-1, 1]) {
        const x = Phaser.Math.Clamp(this.x + side * 70, minX + 10, maxX - 10);
        this.scene.summon('shade', x, this.body.bottom);
      }
      this.mirrorCd = 12;
    }
  }
}

// =================================================================== The Ashen King (the Ashen Throne)

export const KING: EnemyConfig = {
  ...WARDEN,
  key: 'king',
  name: 'The Ashen King',
  hp: 2600,
  poise: 160,
  walk: 46,
  chase: 60,
  souls: 30000,
  // his sword strokes can be parried; the slams and sweeps cannot
  parryable: true,
  drops: [
    { item: 'ashen_greatsword', chance: 1 },
    { item: 'ashen_regalia', chance: 1 },
    { item: 'titanite', chance: 1, qty: 6 },
  ],
  resist: { fire: 0.5, cold: 0.8, poison: 0.8 },
  openers: ['slam', 'sweep', 'leap', 'eruption', 'frostfall', 'venom'],
  attacks: {
    slam: { ...WARDEN.attacks.slam, damage: 60, noParry: true },
    sweep: { ...WARDEN.attacks.sweep, damage: 38, noParry: true },
    sweep2: { ...WARDEN.attacks.sweep2, tell: 'pierce', damage: 38 },
    leap: { ...WARDEN.attacks.leap, damage: 52, noParry: true },
    /** phase 2: the Colossus' fire – he drives the sword into the floor and lava rolls out both ways */
    eruption: {
      id: 'eruption', tell: 'wave', startup: 1.2, active: 0.2, recovery: 1.3, damage: 40, poise: 60, range: 140, cooldown: 1.2,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 240, heavy: true,
      frames: { windup: 'cast', strike: 'slamS', recover: 'slamR' },
    },
    /** phase 3: the Matriarch's frost – icicles out of the smoke above you */
    frostfall: {
      id: 'frostfall', tell: 'rain', startup: 0.9, active: 0.1, recovery: 0.7, damage: 0, poise: 0, range: 999, cooldown: 1,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'cast', strike: 'cast', recover: 'idle0' },
    },
    /** phase 3: the Mother's poison – globs lobbed from the blade */
    venom: {
      id: 'venom', tell: 'spit', startup: 0.9, active: 0.1, recovery: 0.6, damage: 0, poise: 0, range: 999, cooldown: 0.9,
      hitbox: { x: 0, y: 0, w: 0, h: 0 }, lunge: 0, knock: 0,
      frames: { windup: 'cast', strike: 'sweepS', recover: 'sweepR' },
    },
  },
};

const KING_WAVE = 170;

/**
 * The king the Warden once guarded, risen in his ash-grey plate with a crown of iron.
 *  phase 1 (100%): the Warden's slam / sweep / leap, faster; the rising cut can be parried
 *  phase 2 (75%):  + the Colossus' fire: eruptions of lava rolling out both ways
 *  phase 3 (50%):  + the Matriarch's icicles and the Mother's poison
 *  phase 4 (25%):  the wastes' sandstorm swallows the hall; everything, faster
 */
export class AshenKing extends Warden {
  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, KING);
    this.phase2Tint = 0xffb890;
    this.thresholds = [0.75, 0.5, 0.25];
    this.staggerTime = 1.5;
  }

  protected enterPhase2() {
    this.speedMul = 1.1;
    this.scene.fx.ember(this.x, this.y, 50);
  }

  protected enterPhase(n: number) {
    if (n === 3) {
      this.speedMul = 1.15;
      this.scene.fx.status(this.x, this.y, 'cold', 30);
      this.scene.fx.status(this.x, this.y, 'poison', 30);
    }
    if (n === 4) {
      this.speedMul = 1.25;
      this.scene.setSandstorm(true);
    }
  }

  protected chooseAttack(dist: number): EnemyAttack | null {
    const A = this.cfg.attacks;
    const r = Math.random();
    // borrowed powers, from the phase they unlock
    if (this.phase >= 3 && r < 0.14) return A.frostfall;
    if (this.phase >= 3 && r < 0.26) return A.venom;
    if (this.phase >= 2 && dist < 130 && r < 0.42) return A.eruption;
    if (dist > 95) return Math.random() < 0.65 ? A.leap : null;
    if (dist < 70) return Math.random() < 0.5 ? A.slam : A.sweep;
    return Math.random() < 0.45 ? A.sweep : null;
  }

  protected updateAttack(dt: number, dx: number) {
    const a = this.atk!;
    const d = a.def;
    if (d.id === 'frostfall' || d.id === 'venom') {
      a.t += dt * this.speedMul;
      this.body.velocity.x = 0;
      const p = this.scene.player;
      if (d.id === 'venom' && a.t < d.startup) this.updateTelegraph(new Phaser.Geom.Rectangle(p.x - 16, p.feetY - 16, 32, 16), a.t / d.startup, p.feetY);
      if (!a.swung && a.t >= d.startup) {
        a.swung = true;
        if (d.id === 'venom') this.updateTelegraph(new Phaser.Geom.Rectangle(p.x - 16, p.feetY - 16, 32, 16), 1, p.feetY);
        this.cast(d);
      }
      if (a.t >= d.startup + d.active + d.recovery) {
        this.atk = null;
        this.cooldown = d.cooldown;
        this.setState('chase');
      }
      return;
    }
    if (d.id !== 'eruption') return super.updateAttack(dt, dx);
    a.t += dt * this.speedMul;
    this.body.velocity.x = 0;
    if (a.t < d.startup) {
      const rect = new Phaser.Geom.Rectangle(this.x - KING_WAVE, this.body.bottom - 60, KING_WAVE * 2, 60);
      this.updateTelegraph(rect, a.t / d.startup);
      if (Math.random() < 0.3) this.scene.fx.ember(this.x + Phaser.Math.Between(-30, 30), this.body.bottom - 4, 2);
    } else if (!a.swung) {
      a.swung = true;
      this.updateTelegraph(new Phaser.Geom.Rectangle(this.x - 40, this.body.bottom - 60, 80, 60), 1);
      sfx.slam();
      this.scene.combat.shake(0.022, 420);
      const speed = this.phase >= 4 ? 120 : 100;
      this.scene.spawnLavaWave(this.x - 20, this.body.bottom, -1, speed, KING_WAVE);
      this.scene.spawnLavaWave(this.x + 20, this.body.bottom, 1, speed, KING_WAVE);
      this.scene.fx.ember(this.x, this.body.bottom - 6, 40);
    } else if (a.t >= d.startup + d.active + d.recovery) {
      this.atk = null;
      this.cooldown = d.cooldown;
      this.setState('chase');
    }
  }

  protected animate() {
    const a = this.atk;
    if (this.state === 'attack' && a?.def.id === 'eruption') {
      const s = a.def.startup;
      this.sprite.setFrame(a.t < s ? 'cast' : a.t < s + 0.35 ? 'slamS' : 'slamR');
      return;
    }
    super.animate();
  }

  private cast(d: EnemyAttack) {
    const p = this.scene.player;
    if (d.id === 'frostfall') {
      const n = this.phase >= 4 ? 6 : 4;
      const xs = Array.from({ length: n }, (_, i) => p.x + (i - (n - 1) / 2) * 34 + Phaser.Math.Between(-5, 5));
      xs.sort((a, b) => Math.abs(a - p.x) - Math.abs(b - p.x));
      xs.forEach((x, i) => this.scene.spawnFallingIcicle(x, 0.55 + i * 0.11));
      sfx.tell('nova');
    } else {
      const mx = this.x + this.facing * 30;
      const my = this.body.top + 10;
      for (const k of [-0.3, 0, 0.3]) this.scene.spawnToxGlob(mx, my, 18, p.x + (p.x - mx) * k);
      sfx.monster();
    }
  }
}

export function makeBoss(scene: GameScene, type: string, x: number, y: number): Boss {
  if (type === 'king') return new AshenKing(scene, x, y);
  if (type === 'ayame') return new Ayame(scene, x, y);
  if (type === 'leviathan') return new Leviathan(scene, x, y);
  if (type === 'sphinx') return new Sphinx(scene, x, y);
  if (type === 'gladiator') return new Gladiator(scene, x, y);
  if (type === 'matriarch') return new Matriarch(scene, x, y);
  if (type === 'mother') return new MireMother(scene, x, y);
  if (type === 'colossus') return new Colossus(scene, x, y);
  return type === 'shepherd' ? new Shepherd(scene, x, y) : new Warden(scene, x, y);
}

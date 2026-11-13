import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { Controls } from '../input/Controls';
import type { Action } from '../input/touchInput';
import { DEPTH } from '../constants';
import { CombatSystem, type Hittable } from '../systems/CombatSystem';
import { WEAPONS, type PlayerAttackDef, type StatusHit, type Weapon } from '../systems/attacks';
import { equipStats, type EquipStats, type RollClass } from '../systems/equipment';
import { playerBodyKey, weaponSheetKey, WEAPON_STEP, type Bone } from '../gfx/sprites';
import { ITEMS } from '../data/items';
import { useInventoryStore } from '../../stores/inventoryStore';
import type { Enemy } from './Enemy';
import { sfx } from '../systems/Sfx';
import { derived, NO_STATUS, usePlayerStore } from '../../stores/playerStore';
import { useGameStore } from '../../stores/gameStore';
import { debugState } from '../debugState';
import { BladeFx } from '../systems/BladeFx';

type PState = 'move' | 'roll' | 'attack' | 'hurt' | 'drink' | 'dead' | 'rest' | 'block' | 'parry' | 'riposte';

export type DamageResult = 'hit' | 'dodged' | 'killed' | 'none' | 'blocked' | 'parried';

/** what the hit can be answered with */
export interface HitSource {
  attacker?: Enemy;
  parryable?: boolean;
  blockable?: boolean;
  /** fire hits (lava globs, lava waves) are reduced by fire-resistant armor and shields */
  element?: 'fire';
  /** frost / poison build-up when it lands (a third of it through a block) */
  status?: StatusHit;
}

interface AttackRun {
  def: PlayerAttackDef;
  t: number;
  hit: Set<Hittable>;
  charge: number;
  air: boolean;
  queued: boolean;
  swung: boolean;
  flashed: boolean;
}

// movement tuning (px, px/s, s)
const WALK = 92;
const SPRINT = 148;
const JUMP_V = 320;
const COYOTE = 0.1;
const JUMP_BUFFER = 0.13;
const ACTION_BUFFER = 0.18;
/** equip load decides how you roll */
const ROLLS: Record<RollClass, { cost: number; time: number; fast: number; fastFor: number; slow: number; iframes: [number, number] }> = {
  light: { cost: 18, time: 0.4, fast: 190, fastFor: 0.3, slow: 70, iframes: [0.02, 0.34] },
  medium: { cost: 22, time: 0.46, fast: 165, fastFor: 0.3, slow: 60, iframes: [0.03, 0.32] },
  heavy: { cost: 28, time: 0.56, fast: 110, fastFor: 0.32, slow: 40, iframes: [0.08, 0.26] },
};
const SPRINT_DRAIN = 22;
const STAMINA_REGEN = 50;
const FLASK_HEAL = 0.45;
/** parry window after pressing the shield button, and the lock-out before the next parry */
const PARRY_WINDOW = 0.2;
const PARRY_COOLDOWN = 0.55;
const RIPOSTE_HIT = 0.32;
const RIPOSTE_END = 0.85;
/** frostbite: a burst of damage (fraction of max HP), then slowed with sluggish stamina for a while */
const FROSTBITE_DMG = 0.12;
const FROSTBITE_TIME = 6;
/** poisoned: HP per second, for this long */
const POISON_DPS = 3;
const POISON_TIME = 14;
/** wading through mire water: speed factor and poison build-up per second */
const BOG_SLOW = 0.55;
const BOG_TOXIN = 16;
/** White Cloak: the fastest you can fall while riding your little cloud */
const CLOUD_FALL = 150;

const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);

export class Player {
  sprite: Phaser.Physics.Arcade.Sprite;
  body: Phaser.Physics.Arcade.Body;
  facing: 1 | -1 = 1;
  state: PState = 'move';
  hp: number;
  stamina: number;
  weapon: Weapon = WEAPONS.longsword;
  private eq!: EquipStats;
  private texKey = '';
  /** the equipped weapon, attached to the weapon bone of the current body frame */
  weaponSprite: Phaser.GameObjects.Image;
  private weaponKey: string | null = null;
  /** equipped shield, attached to the off-hand bone */
  shieldSprite: Phaser.GameObjects.Image;
  private shieldKey: string | null = null;
  /** elemental glow + swing tracer on the weapon */
  private blade: BladeFx;
  private parryCd = 0;
  private ripTarget: Enemy | null = null;
  private ripHit = false;
  private hurtFor = 0.36;
  private bones: Record<string, Bone>;
  private poise = 0;
  private poiseT = 0;
  private regen: { perSec: number; left: number } | null = null;
  private using: string | null = null;
  private roll = ROLLS.light;
  dropThrough = 0;
  lastSafe: { x: number; y: number };
  /** frost / poison build-up (0..100) and how long frostbite / poison have left */
  private frost = 0;
  private toxin = 0;
  private frostT = 0;
  private poisonT = 0;
  private dotT = 0;
  /** scene time until which a leech is stuck to us (leeches refresh it every frame while attached) */
  latchedUntil = 0;
  private inBog = false;

  private st = 0;
  private animT = 0;
  private coyote = 0;
  private jumpBuf = 0;
  private buffered: { a: Action; t: number } | null = null;
  private staminaDelay = 0;
  private iframes = 0;
  private atk: AttackRun | null = null;
  private rollDir = 1;
  private airMax = WALK;
  private sprinting = false;
  private wasGround = true;
  private lastVy = 0;
  private healed = false;
  private lastRunFrame = -1;

  constructor(private scene: GameScene, x: number, y: number) {
    this.eq = equipStats();
    this.texKey = this.lookKey(this.eq);
    this.sprite = scene.physics.add.sprite(x, y, this.texKey, 'idle0').setOrigin(0.5, 1).setDepth(DEPTH.PLAYER);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.bones = scene.cache.json.get('player-bones') ?? {};
    this.weaponKey = weaponSheetKey(this.eq.weapon.sheet ?? this.eq.weapon.id);
    this.weaponSprite = scene.add.image(x, y, this.weaponKey ?? '__DEFAULT').setDepth(DEPTH.PLAYER + 1).setVisible(false);
    this.shieldSprite = scene.add.image(x, y, '__DEFAULT').setDepth(DEPTH.PLAYER - 1).setVisible(false);
    this.blade = new BladeFx(scene, this.weaponSprite);
    this.blade.setWeapon(this.eq.weapon.sheet ?? this.eq.weapon.id, this.eq.element?.type ?? null);
    this.body.setSize(10, 20).setOffset(19, 12);
    this.body.setMaxVelocityY(520);
    const d = derived();
    this.hp = d.maxHp;
    this.stamina = d.maxStamina;
    this.lastSafe = { x, y };
  }

  get x() {
    return this.body.center.x;
  }
  get y() {
    return this.body.center.y;
  }
  get feetY() {
    return this.body.bottom;
  }
  get alive() {
    return this.state !== 'dead';
  }
  /** set by the scene each frame while standing on a moving platform */
  riding = false;
  get onGround() {
    return this.body.blocked.down || this.body.touching.down || this.riding;
  }

  hurtbox() {
    return new Phaser.Geom.Rectangle(this.body.x, this.body.y, this.body.width, this.body.height);
  }

  isInvulnerable() {
    return (
      this.iframes > 0 ||
      this.state === 'dead' ||
      (this.state === 'roll' && this.st > this.roll.iframes[0] && this.st < this.roll.iframes[1])
    );
  }

  /** Called during hitstop too, so presses made while frozen are not lost. */
  bufferInputs(c: Controls) {
    for (const a of ['light', 'heavy', 'roll', 'flask', 'item'] as Action[]) if (c.pressed(a)) this.buffered = { a, t: ACTION_BUFFER };
    if (c.pressed('jump')) this.jumpBuf = JUMP_BUFFER;
  }

  private consume(a: Action) {
    if (this.buffered?.a === a) {
      this.buffered = null;
      return true;
    }
    return false;
  }

  private spend(n: number) {
    this.stamina = Math.max(0, this.stamina - n);
    this.staminaDelay = 0.55;
  }

  private lookKey(_eq: EquipStats) {
    return playerBodyKey(useInventoryStore.getState().equipped.armor);
  }

  /** Place the weapon sprite on the weapon bone of the current frame (mirrored when facing left). */
  private updateWeaponBone() {
    const b = this.bones[this.sprite.frame.name];
    if (!this.weaponKey || !b?.show || this.state === 'dead') {
      this.weaponSprite.setVisible(false);
      return;
    }
    const fw = this.sprite.frame.width;
    const fh = this.sprite.frame.height;
    const dir = this.facing;
    const lx = b.x + 0.5 - fw / 2; // bone relative to the sprite's bottom-centre origin
    const steps = Math.round(360 / WEAPON_STEP);
    const idx = (((Math.round(b.a / WEAPON_STEP)) % steps) + steps) % steps;
    this.weaponSprite
      .setTexture(this.weaponKey, `r${idx}`)
      .setPosition(this.sprite.x + lx * dir, this.sprite.y - fh + b.y + 0.5)
      .setScale(dir, 1)
      .setVisible(this.sprite.visible);
  }

  /**
   * The off hand: the shield (behind the body when lowered, in front when raised), or – with twin
   * daggers – the second dagger, rotated to the off-hand angle.
   */
  private updateShieldBone() {
    const b = this.bones[this.sprite.frame.name];
    const dual = this.eq.hands === 'dual' && this.weaponKey;
    if ((!this.shieldKey && !dual) || !b || (b.sx === 0 && b.sy === 0) || this.state === 'dead' || this.state === 'roll') {
      this.shieldSprite.setVisible(false);
      return;
    }
    const fw = this.sprite.frame.width;
    const fh = this.sprite.frame.height;
    const lx = b.sx + 0.5 - fw / 2;
    if (dual) {
      const steps = Math.round(360 / WEAPON_STEP);
      const idx = (((Math.round((b.sa ?? 100) / WEAPON_STEP)) % steps) + steps) % steps;
      this.shieldSprite.setTexture(this.weaponKey!, `r${idx}`);
    } else this.shieldSprite.setTexture(this.shieldKey!, 's');
    this.shieldSprite
      .setPosition(this.sprite.x + lx * this.facing, this.sprite.y - fh + b.sy + 0.5)
      .setScale(this.facing, 1)
      .setDepth(b.front ? DEPTH.PLAYER + 2 : DEPTH.PLAYER - 1)
      .setVisible(this.sprite.visible);
  }

  /** an infused blade: tracer behind each swing, a fire blade glows and smoulders; motes fly off it */
  private elementTrail(dt: number) {
    const el = this.eq.element;
    const b = this.bones[this.sprite.frame.name];
    const swinging = this.state === 'attack' || this.state === 'riposte';
    const pose = {
      visible: this.weaponSprite.visible,
      swinging,
      x: this.weaponSprite.x,
      y: this.weaponSprite.y,
      angle: b?.a ?? 0,
      facing: this.facing,
    };
    this.blade.update(dt, pose);
    if (!el || !pose.visible) return;
    // swinging: a shower of motes; idle fire blades still give off the odd ember
    const rate = swinging ? 0.45 : el.type === 'fire' ? 0.1 : 0;
    if (Math.random() > rate) return;
    const pt = this.blade.pointOnBlade(pose);
    this.scene.fx.status(pt.x, pt.y, el.type, 1);
  }

  /** light from a fire blade, for the darkness layer */
  bladeLight() {
    return this.state === 'dead' ? null : this.blade.light();
  }

  /** Pick up equipment changes (from the React inventory) between actions. */
  private refreshEquipment() {
    this.eq = equipStats();
    const sk = this.eq.shieldItem ? `shield-${this.eq.shieldItem}` : null;
    this.shieldKey = sk && this.scene.textures.exists(sk) ? sk : null;
    if (this.state === 'attack' || this.state === 'riposte') return;
    this.weapon = this.eq.weapon;
    this.weaponKey = weaponSheetKey(this.weapon.sheet ?? this.weapon.id);
    this.blade.setWeapon(this.weapon.sheet ?? this.weapon.id, this.eq.element?.type ?? null);
    const key = this.lookKey(this.eq);
    if (key !== this.texKey) {
      this.texKey = key;
      this.sprite.setTexture(key, this.sprite.frame.name);
    }
  }

  update(dt: number, c: Controls) {
    const d = derived();
    this.refreshEquipment();
    this.st += dt;
    this.poiseT -= dt;
    if (this.poiseT <= 0) this.poise = this.eq.poise;
    if (this.regen && this.state !== 'dead') {
      const step = Math.min(this.regen.left, dt);
      this.hp = Math.min(d.maxHp, this.hp + this.regen.perSec * step);
      this.regen.left -= step;
      if (this.regen.left <= 0) this.regen = null;
    }
    this.animT += dt;
    this.updateStatus(dt, d.maxHp);
    this.iframes = Math.max(0, this.iframes - dt);
    this.parryCd -= dt;
    this.dropThrough = Math.max(0, this.dropThrough - dt);
    if (this.buffered && (this.buffered.t -= dt) <= 0) this.buffered = null;
    this.bufferInputs(c);
    this.jumpBuf -= dt;

    const g = this.onGround;
    if (g) this.coyote = COYOTE;
    else this.coyote -= dt;

    this.sprinting = false;
    switch (this.state) {
      case 'move':
        this.updateMove(dt, c, g);
        break;
      case 'roll':
        this.updateRoll(g);
        break;
      case 'attack':
        this.updateAttack(dt, c, g, this.eq.dmgMul);
        break;
      case 'hurt':
        this.body.velocity.x = approach(this.body.velocity.x, 0, (g ? 500 : 150) * dt);
        this.sprite.setFrame('hurt');
        if (this.st > this.hurtFor) {
          this.state = 'move';
          this.hurtFor = 0.36;
        }
        break;
      case 'parry':
        this.updateParry(dt, c);
        break;
      case 'block':
        this.updateBlock(dt, c, g);
        break;
      case 'riposte':
        this.updateRiposte();
        break;
      case 'drink':
        this.updateDrink(dt, c, d.maxHp);
        break;
      case 'rest':
        this.body.velocity.x = 0;
        this.hp = d.maxHp;
        this.stamina = d.maxStamina;
        this.sprite.setFrame('kneel');
        break;
      case 'dead':
        this.body.velocity.x = approach(this.body.velocity.x, 0, 400 * dt);
        this.sprite.setFrame('dead');
        break;
    }

    // stamina regen
    if (debugState.god) this.stamina = d.maxStamina;
    if (this.staminaDelay > 0) this.staminaDelay -= dt;
    else if (this.state !== 'attack' && this.state !== 'roll' && !this.sprinting) {
      const rate = (this.state === 'drink' ? 0.4 : this.state === 'block' ? 0.3 : 1) * (this.frostT > 0 ? 0.5 : 1);
      this.stamina = Math.min(d.maxStamina, this.stamina + STAMINA_REGEN * rate * dt);
    }
    this.hp = Math.min(this.hp, d.maxHp);

    // the White Cloak: a little cloud under your feet that slows every fall
    if (this.eq.float && this.state !== 'dead') {
      if (!g && this.body.velocity.y > CLOUD_FALL) this.body.velocity.y = CLOUD_FALL;
      if (Math.random() < (g ? 4 : 14) * dt) this.scene.fx.cloud(this.x + Phaser.Math.Between(-5, 5), this.feetY);
    }

    // landing feedback
    if (g && !this.wasGround && this.lastVy > 220) {
      this.scene.fx.dust(this.x, this.feetY, 8);
      sfx.land();
    }
    if (!g) this.lastVy = this.body.velocity.y;
    this.wasGround = g;
    if (g && this.state === 'move' && this.scene.isGroundAt(this.x, this.feetY + 2))
      this.lastSafe = { x: this.sprite.x, y: this.sprite.y };

    this.sprite.setFlipX(this.facing < 0);
    this.updateWeaponBone();
    this.updateShieldBone();
    this.elementTrail(dt);
    this.sync();
  }

  private updateMove(dt: number, c: Controls, g: boolean) {
    const mx = Math.abs(c.moveX) > 0.15 ? c.moveX : 0;
    const wantSprint = c.sprint && mx !== 0 && this.stamina > 0;
    if (g) {
      this.sprinting = wantSprint;
      this.airMax = Math.max(WALK, Math.abs(this.body.velocity.x));
    }
    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - SPRINT_DRAIN * dt);
      this.staminaDelay = 0.35;
    }
    const target = mx * (g ? (this.sprinting ? SPRINT : WALK) : this.airMax) * this.speedMul();
    // on ice you build speed slowly and slide a long way before you stop
    const accel = !g ? 900 : this.onIce() ? (mx !== 0 ? 260 : 75) : 1400;
    this.body.velocity.x = approach(this.body.velocity.x, target, accel * dt);
    if (mx !== 0) this.facing = mx > 0 ? 1 : -1;

    // jump / drop-through (coyote time + jump buffer)
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.jumpBuf = 0;
      if (c.moveY > 0.5 && this.scene.isOneWayBelow(this.x, this.feetY)) {
        this.dropThrough = 0.25;
      } else {
        this.body.velocity.y = -JUMP_V;
        this.coyote = 0;
        this.airMax = this.sprinting ? SPRINT : Math.max(WALK, Math.abs(this.body.velocity.x));
        sfx.jump();
        this.scene.fx.dust(this.x, this.feetY, 4);
      }
    }
    if (c.released('jump') && this.body.velocity.y < -60) this.body.velocity.y *= 0.5;

    // actions (buffered)
    if (this.stamina > 0 && g && this.consume('roll')) return this.startRoll(c);
    // shield, or the weapon's own guard (two-handed blade, off-hand dagger)
    if (g && this.eq.shield && (c.pressed('block') || c.held('block'))) return this.startGuard(c);
    if (g && this.tryRiposte()) return;
    if (this.stamina > 0 && this.consume('light')) return this.startAttack(g ? this.weapon.light[0] : this.weapon.air);
    if (this.stamina > 0 && g && this.consume('heavy')) return this.startAttack(this.weapon.heavy);
    if (g && this.consume('flask')) return this.startDrink(null);
    if (g && this.consume('item')) return this.startDrink(useInventoryStore.getState().equipped.quick);

    // animation
    if (!g) this.sprite.setFrame(this.body.velocity.y < 0 ? 'jump' : 'fall');
    else if (Math.abs(this.body.velocity.x) > 12) {
      const fps = this.sprinting ? 14 : 10;
      const f = Math.floor(this.animT * fps) % 4;
      if (f !== this.lastRunFrame && (f === 0 || f === 2)) sfx.step();
      this.lastRunFrame = f;
      this.sprite.setFrame(`run${f}`);
    } else this.sprite.setFrame(`idle${Math.floor(this.animT * 1.6) % 2}`);
  }

  // ------------------------------------------------------------------ shield: parry, block, riposte
  /** Shield button: a fresh press opens a short parry window, holding it turns into a block. */
  private startGuard(c: Controls) {
    this.st = 0;
    this.atk = null;
    if (c.pressed('block') && this.parryCd <= 0) {
      this.state = 'parry';
      this.parryCd = PARRY_COOLDOWN;
      sfx.swing(false);
    } else this.state = 'block';
  }

  private updateParry(dt: number, c: Controls) {
    this.body.velocity.x = approach(this.body.velocity.x, 0, 900 * dt);
    this.sprite.setFrame('parry');
    // players hit attack the moment the parry lands – let that become the riposte straight away
    if (this.tryRiposte()) return;
    if (this.st >= PARRY_WINDOW && c.held('block')) {
      this.state = 'block';
      this.st = 0;
    } else if (this.st >= 0.38) this.state = 'move';
  }

  private updateBlock(dt: number, c: Controls, g: boolean) {
    if (!c.held('block') || !this.eq.shield || !g) {
      this.state = 'move';
      return;
    }
    const mx = Math.abs(c.moveX) > 0.15 ? c.moveX : 0;
    if (mx !== 0) this.facing = mx > 0 ? 1 : -1;
    this.body.velocity.x = approach(this.body.velocity.x, mx * 40, 800 * dt);
    this.sprite.setFrame('block');
    // attack or roll straight out of the guard
    if (this.tryRiposte()) return;
    if (this.stamina > 0 && this.consume('light')) return this.startAttack(this.weapon.light[0]);
    if (this.stamina > 0 && this.consume('heavy')) return this.startAttack(this.weapon.heavy);
    if (this.stamina > 0 && this.consume('roll')) return this.startRoll(c);
  }

  /** Light attack next to a parried (reeling) enemy in front → riposte. */
  private tryRiposte() {
    if (this.buffered?.a !== 'light') return false;
    const e = this.scene.riposteTarget(this);
    if (!e) return false;
    this.buffered = null;
    this.state = 'riposte';
    this.st = 0;
    this.atk = null;
    this.ripTarget = e;
    this.ripHit = false;
    this.facing = e.x >= this.x ? 1 : -1;
    // step in close for the stab
    const x = e.x - this.facing * Math.max(16, e.body.width / 2 + 9);
    this.sprite.x += x - this.x;
    this.body.reset(this.sprite.x, this.sprite.y);
    this.iframes = RIPOSTE_END + 0.2;
    e.grabForRiposte();
    return true;
  }

  private updateRiposte() {
    this.body.velocity.x = 0;
    this.sprite.setFrame(this.st < RIPOSTE_HIT ? 'rip1' : 'rip2');
    const e = this.ripTarget;
    if (!this.ripHit && this.st >= RIPOSTE_HIT && e) {
      this.ripHit = true;
      const dmg = Math.round(this.weapon.light[0].damage * this.eq.dmgMul * 3.5 + 20);
      e.takeRiposte(dmg, this.facing);
      const fx = this.x + this.facing * 14;
      this.scene.fx.hit(fx, this.y - 4, true);
      this.scene.fx.bleed(fx, this.y - 4, 24);
      sfx.hit(true);
      this.scene.combat.hitstop(0.2);
      this.scene.combat.shake(0.012, 260);
    }
    if (this.st >= RIPOSTE_END) {
      this.ripTarget = null;
      this.state = 'move';
    }
  }

  private startRoll(c: Controls) {
    this.rollDir = Math.abs(c.moveX) > 0.2 ? Math.sign(c.moveX) : this.facing;
    this.facing = this.rollDir > 0 ? 1 : -1;
    this.state = 'roll';
    this.st = 0;
    this.atk = null;
    this.roll = ROLLS[this.eq.roll];
    this.spend(this.roll.cost);
    sfx.roll();
    this.scene.fx.dust(this.x, this.feetY, 6);
  }

  private updateRoll(g: boolean) {
    const t = this.st;
    const r = this.roll;
    this.body.velocity.x = this.rollDir * (t < r.fastFor ? r.fast : r.slow) * (this.inBog ? 0.7 : 1);
    this.sprite.setFrame(`roll${Math.min(3, Math.floor((t / r.time) * 4))}`);
    if (t >= r.time) {
      this.state = 'move';
      if (g) this.scene.fx.dust(this.x, this.feetY, 3);
    }
  }

  private startAttack(def: PlayerAttackDef) {
    this.atk = {
      def, t: 0, hit: new Set(), charge: 0, air: !this.onGround, queued: false, swung: false, flashed: false,
    };
    this.state = 'attack';
    this.st = 0;
    this.spend(def.stamina);
  }

  private updateAttack(dt: number, c: Controls, g: boolean, dmgMul: number) {
    const a = this.atk!;
    const def = a.def;
    const s = def.startup;
    const e = s + def.active;
    const end = e + def.recovery;

    // charged heavy: hold to keep winding up
    let adv = dt;
    if (def.chargeMax && a.t >= s * 0.7 && a.t < s && c.held('heavy') && a.charge < def.chargeMax) {
      a.charge = Math.min(def.chargeMax, a.charge + dt);
      adv = 0;
      if (a.charge >= def.chargeMax && !a.flashed) {
        a.flashed = true;
        this.sprite.setTintFill(0xfff0c0);
        this.scene.time.delayedCall(70, () => this.sprite.clearTint());
        this.scene.fx.ember(this.x + this.facing * 4, this.y - 14, 10);
      }
    }
    a.t += adv;
    const t = a.t;

    if (!a.air) {
      const lunging = t >= s * 0.6 && t < e;
      let vx = approach(this.body.velocity.x, lunging ? this.facing * def.lunge : 0, (this.onIce() ? 260 : 1300) * dt);
      if (!this.scene.isGroundAt(this.x + this.facing * 8, this.feetY + 4) && Math.sign(vx) === this.facing) vx = 0;
      this.body.velocity.x = vx;
    } else {
      this.body.velocity.x = approach(this.body.velocity.x, c.moveX * WALK * 0.7, 300 * dt);
    }

    // frames
    if (t < s) this.sprite.setFrame(a.charge > 0.15 && def.frames.charge ? def.frames.charge : def.frames.windup);
    else if (t < e) this.sprite.setFrame(def.frames.strike);
    else this.sprite.setFrame(def.frames.recover);

    // active window
    if (t >= s && t < e) {
      if (!a.swung) {
        a.swung = true;
        sfx.swing(!!def.heavy);
      }
      const cm = def.chargeMax ? 1 + 0.6 * (a.charge / def.chargeMax) : 1;
      const rect = CombatSystem.box(this.x, this.y, this.facing, def.hitbox);
      this.scene.combat.playerStrike(
        rect,
        a.hit,
        {
          damage: Math.round(def.damage * dmgMul * cm),
          poise: def.poise * cm,
          dir: this.facing,
          knock: def.knock,
          heavy: !!def.heavy || cm > 1.3,
          // infusion scales with charge (and the both-blades dagger heavy hits twice)
          element: this.eq.element ? { ...this.eq.element, power: this.eq.element.power * cm * (this.weapon.hands === 'dual' && def === this.weapon.heavy ? 2 : 1) } : undefined,
        },
        def.hitstop * (cm > 1.3 ? 1.4 : 1),
        def.shake * cm,
      );
    }

    // combo queue + roll cancel in late recovery
    if (t > s * 0.5 && this.consume('light')) a.queued = true;
    if (t >= e + def.recovery * 0.3) {
      if (a.queued && def.next && this.stamina > 0 && g && !a.air) {
        const next = this.weapon.light.find((l) => l.id === def.next);
        if (next) {
          if (Math.abs(c.moveX) > 0.3) this.facing = c.moveX > 0 ? 1 : -1;
          return this.startAttack(next);
        }
      }
      if (this.stamina > 0 && g && this.consume('roll')) return this.startRoll(c);
    }
    if (a.air && g && t >= e) {
      this.atk = null;
      this.state = 'move';
      return;
    }
    if (t >= end) {
      this.atk = null;
      this.state = 'move';
    }
  }

  /** itemId null = the flask; otherwise a consumable from the quick slot. */
  private startDrink(itemId: string | null) {
    if (itemId === null) {
      const ps = usePlayerStore.getState();
      if (ps.flasks <= 0) {
        useGameStore.getState().showToast('No flasks left');
        return;
      }
      usePlayerStore.setState({ flasks: ps.flasks - 1 });
    } else {
      const def = ITEMS[itemId];
      if (!def?.use || !useInventoryStore.getState().remove(itemId)) {
        useGameStore.getState().showToast(def ? `No ${def.name} left` : 'No quick item');
        return;
      }
    }
    this.using = itemId;
    this.state = 'drink';
    this.st = 0;
    this.healed = false;
    sfx.drink();
  }

  /** Applies a consumable's effect. Used both mid-animation and from the inventory menu. */
  applyItem(itemId: string) {
    const use = ITEMS[itemId]?.use;
    if (!use) return;
    const maxHp = derived().maxHp;
    if (use.heal) {
      this.hp = Math.min(maxHp, this.hp + use.heal);
      this.scene.fx.heal(this.x, this.y);
      sfx.heal();
    }
    if (use.regen) {
      this.regen = { perSec: use.regen.amount / use.regen.duration, left: use.regen.duration };
      this.scene.fx.heal(this.x, this.y);
    }
    if (use.souls) {
      usePlayerStore.getState().addSouls(use.souls);
      sfx.souls();
    }
    const extra = use.maxFlasks;
    if (extra) {
      usePlayerStore.setState((s) => ({ maxFlasks: s.maxFlasks + extra, flasks: s.flasks + extra }));
      sfx.levelUp();
    }
    this.sync();
  }

  /** Inventory "Use" while the menu is open: no animation. */
  useFromMenu(itemId: string) {
    if (!this.alive || !ITEMS[itemId]?.use) return false;
    if (!useInventoryStore.getState().remove(itemId)) return false;
    this.applyItem(itemId);
    return true;
  }

  private updateDrink(dt: number, c: Controls, maxHp: number) {
    this.body.velocity.x = approach(this.body.velocity.x, c.moveX * 28, 800 * dt);
    this.sprite.setFrame('drink');
    if (!this.healed && this.st > 0.55) {
      this.healed = true;
      if (this.using) this.applyItem(this.using);
      else {
        this.hp = Math.min(maxHp, this.hp + maxHp * FLASK_HEAL);
        this.scene.fx.heal(this.x, this.y);
        sfx.heal();
      }
    }
    if (this.st > 0.95) this.state = 'move';
  }

  /**
   * Returns what happened so the attacker can react (hitstop only on real hits).
   * `dir` is the direction the attack travels; a hit is "frontal" when it comes at the way we face.
   */
  takeDamage(dmg: number, dir: number, knock: number, poiseDmg: number, src: HitSource = {}): DamageResult {
    if (this.state === 'dead') return 'none';
    if (this.isInvulnerable() || debugState.god) return 'dodged';
    if (this.state === 'rest') this.standUp();
    const frontal = dir === -this.facing;
    const shield = this.eq.shield;
    const sx = this.shieldSprite.x;
    const sy = this.shieldSprite.y;

    // parry: inside the window, a melee hit that can be parried bounces off and leaves the attacker open
    if (this.state === 'parry' && this.st < PARRY_WINDOW && frontal && src.parryable && src.attacker) {
      src.attacker.onParried();
      this.scene.fx.clang(sx, sy);
      this.scene.fx.ember(sx, sy, 12);
      sfx.stagger();
      this.scene.combat.hitstop(0.14);
      this.scene.combat.shake(0.006, 160);
      return 'parried';
    }

    // fire-resistant armor
    if (src.element === 'fire') dmg *= 1 - this.eq.fireRes;

    // block: the shield soaks the hit for stamina; running out breaks the guard
    if ((this.state === 'block' || this.state === 'parry') && frontal && shield && src.blockable !== false) {
      const cost = dmg * (1 - shield.stability) + 6;
      this.stamina -= cost;
      this.staminaDelay = 0.8;
      this.scene.fx.clang(sx, sy);
      sfx.stagger();
      this.body.velocity.x = dir * Math.min(90, knock * 0.4);
      let chip = dmg * (1 - (src.element === 'fire' ? shield.fireAbsorb ?? shield.absorb : shield.absorb));
      if (this.stamina <= 0) {
        // guard break: stunned, and the hit comes through harder
        this.stamina = 0;
        chip = dmg * 0.6;
        this.state = 'hurt';
        this.st = 0;
        this.hurtFor = 0.85;
        useGameStore.getState().showToast('Guard broken');
      }
      if (chip >= 1) {
        this.hp -= Math.round(chip * (1 - this.eq.defense));
        useGameStore.setState((s) => ({ hurtFlash: s.hurtFlash + 1 }));
        if (this.hp <= 0) {
          this.hp = 0;
          this.die();
          return 'killed';
        }
      }
      this.iframes = 0.15;
      if (src.status) this.addBuildup(src.status.type, src.status.amount / 3);
      return 'blocked';
    }
    dmg = Math.max(1, Math.round(dmg * (1 - this.eq.defense)));
    this.hp -= dmg;
    this.regen = null;
    if (src.status) this.addBuildup(src.status.type, src.status.amount);
    this.scene.fx.bleed(this.x, this.y - 4, 12);
    sfx.hurt();
    useGameStore.setState((s) => ({ hurtFlash: s.hurtFlash + 1 }));
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return 'killed';
    }
    const a = this.atk;
    const armored =
      this.state === 'attack' && a?.def.hyperFrom !== undefined && a.t >= a.def.hyperFrom && a.t < a.def.startup + a.def.active;
    // armor poise absorbs flinches until it breaks (resets 2.5s after the last hit)
    this.poise -= poiseDmg;
    this.poiseT = 2.5;
    const poised = this.poise > 0;
    if (!poised && this.eq.poise > 0) this.poise = this.eq.poise;
    if ((!armored && !poised) || poiseDmg > 40) {
      this.state = 'hurt';
      this.st = 0;
      this.atk = null;
      this.body.velocity.x = dir * knock;
      this.body.velocity.y = -130;
    }
    this.iframes = 0.3;
    return 'hit';
  }

  die() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.st = 0;
    this.atk = null;
    this.sprite.setFrame('dead');
    sfx.death();
    this.sync();
    this.scene.onPlayerDeath();
  }

  rest() {
    this.state = 'rest';
    this.st = 0;
    this.atk = null;
    this.body.velocity.x = 0;
  }

  standUp() {
    if (this.state === 'rest') {
      this.state = 'move';
      this.st = 0;
    }
  }

  respawn(x: number, y: number) {
    const d = derived();
    this.sprite.setPosition(x, y);
    this.body.reset(x, y);
    this.hp = d.maxHp;
    this.stamina = d.maxStamina;
    this.state = 'move';
    this.st = 0;
    this.atk = null;
    this.iframes = 1;
    this.facing = 1;
    this.lastSafe = { x, y };
    this.clearStatus();
    this.sprite.clearTint();
    this.sync();
  }

  heal() {
    const d = derived();
    this.hp = d.maxHp;
    this.stamina = d.maxStamina;
    this.clearStatus();
  }

  // ------------------------------------------------------------------ frost, poison, ice, mire
  private onIce() {
    return this.onGround && this.scene.isIceAt(this.x, this.feetY + 2);
  }

  /** wading, frostbitten and leech-ridden all slow you down */
  private speedMul() {
    return (this.inBog ? BOG_SLOW : 1) * (this.frostT > 0 ? 0.75 : 1) * (this.scene.time.now < this.latchedUntil ? 0.8 : 1);
  }

  /**
   * Frost or poison building up (0..100). Armor resists it. At 100 it takes hold:
   * frostbite bursts for a chunk of HP and leaves you slow; poison eats away at you for a long while.
   */
  addBuildup(type: 'cold' | 'poison', amount: number) {
    if (!this.alive || debugState.god || amount <= 0) return;
    if (type === 'cold') {
      if (this.frostT > 0) return;
      this.frost += amount * (1 - this.eq.frostRes);
      this.scene.fx.status(this.x, this.y - 4, 'cold', 3);
      if (this.frost >= 100) {
        this.frost = 0;
        this.frostT = FROSTBITE_TIME;
        sfx.status('frostbite');
        this.scene.fx.status(this.x, this.y - 6, 'cold', 30);
        this.hp -= Math.round(derived().maxHp * FROSTBITE_DMG);
        useGameStore.setState((s) => ({ hurtFlash: s.hurtFlash + 1 }));
        useGameStore.getState().showToast('Frostbite');
        this.sprite.setTintFill(0xd4f0ff);
        this.scene.time.delayedCall(140, () => this.sprite.active && this.sprite.clearTint());
        if (this.hp <= 0) {
          this.hp = 0;
          this.die();
        }
      }
    } else {
      if (this.poisonT > 0) {
        this.poisonT = Math.min(POISON_TIME, this.poisonT + amount * 0.04);
        return;
      }
      this.toxin += amount * (1 - this.eq.poisonRes);
      if (Math.random() < 0.5) this.scene.fx.status(this.x, this.y - 4, 'poison', 2);
      if (this.toxin >= 100) {
        this.toxin = 0;
        this.poisonT = POISON_TIME;
        this.dotT = 1;
        sfx.status('poison');
        this.scene.fx.status(this.x, this.y - 4, 'poison', 20);
        useGameStore.getState().showToast('Poisoned');
      }
    }
  }

  /** a leech feeding on us: direct HP loss, no flinch */
  drain(dmg: number) {
    if (!this.alive || debugState.god || this.isInvulnerable()) return;
    this.hp -= dmg;
    this.regen = null;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  get rolling() {
    return this.state === 'roll';
  }

  private clearStatus() {
    this.frost = this.toxin = this.frostT = this.poisonT = 0;
    this.latchedUntil = 0;
    usePlayerStore.setState({ status: NO_STATUS });
  }

  private updateStatus(dt: number, maxHp: number) {
    if (this.state === 'dead') return;
    this.inBog = this.scene.isBogAt(this.x, this.feetY - 3);
    if (this.inBog && this.state !== 'rest') {
      this.addBuildup('poison', BOG_TOXIN * dt);
      if (Math.random() < 3 * dt) this.scene.fx.status(this.x + Phaser.Math.Between(-5, 5), this.feetY - 6, 'poison', 1);
    }
    this.frost = Math.max(0, this.frost - 7 * dt);
    if (!this.inBog) this.toxin = Math.max(0, this.toxin - 4 * dt);
    if (this.frostT > 0) {
      this.frostT = Math.max(0, this.frostT - dt);
      if (Math.random() < 5 * dt) this.scene.fx.status(this.x, this.body.top, 'cold', 1);
    }
    if (this.poisonT > 0) {
      this.poisonT = Math.max(0, this.poisonT - dt);
      this.dotT -= dt;
      if (this.dotT <= 0) {
        this.dotT = 1;
        this.scene.fx.status(this.x, this.y - 6, 'poison', 3);
        this.sprite.setTint(0x9ae07a);
        this.scene.time.delayedCall(90, () => this.sprite.active && this.alive && this.sprite.clearTint());
        // poison wears you down, but never lands the last blow by itself
        if (!debugState.god) this.hp = Math.max(1, this.hp - Math.min(POISON_DPS, maxHp * 0.015));
      }
    }
    const st = usePlayerStore.getState().status;
    const next = { frost: Math.round(this.frost), poison: Math.round(this.toxin), frostbite: this.frostT > 0, poisoned: this.poisonT > 0 };
    if (st.frost !== next.frost || st.poison !== next.poison || st.frostbite !== next.frostbite || st.poisoned !== next.poisoned)
      usePlayerStore.setState({ status: next });
  }


  /** Mirror vitals into the store only when the rounded value changes. */
  private sync() {
    const hp = Math.max(0, Math.round(this.hp));
    const st = Math.round(this.stamina);
    const s = usePlayerStore.getState();
    if (s.hp !== hp || s.stamina !== st) usePlayerStore.setState({ hp, stamina: st });
  }
}

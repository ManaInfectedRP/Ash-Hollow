/** Hitbox relative to the attacker's body center, written for facing right. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Shared frame-data shape for player and enemy attacks (seconds). */
/**
 * What kind of big attack this is – picks its danger-zone look (systems/Telegraph.ts) and its
 * wind-up sound (Sfx.tell), so each one reads differently before it lands.
 */
export type Tell = 'slam' | 'low' | 'high' | 'leap' | 'blink' | 'wave' | 'spit' | 'rain' | 'summon' | 'pierce' | 'nova';

/** a hit that also builds up frost or poison on the player (see Player.addBuildup) */
export interface StatusHit {
  type: 'cold' | 'poison';
  amount: number;
}

export interface AttackDef {
  id: string;
  tell?: Tell;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  /** poise damage dealt */
  poise: number;
  hitbox: Box;
  /** forward speed during the swing */
  lunge: number;
  knock: number;
  heavy?: boolean;
  frames: { windup: string; strike: string; recover: string; charge?: string };
  next?: string;
  /** frost / poison build-up on the player when it lands */
  status?: StatusHit;
  /** can't be parried even if the attacker's other moves can (sweeps to jump, bursts) */
  noParry?: boolean;
}

export interface PlayerAttackDef extends AttackDef {
  stamina: number;
  hitstop: number;
  shake: number;
  chargeMax?: number;
  /** player won't flinch between hyperFrom and end of active */
  hyperFrom?: number;
}

export type WeaponStyle = 'sword' | 'axe' | 'rapier' | 'dagger' | 'none';

/** fire: extra damage per hit + burning; cold: builds up to frostbite (burst + slow); poison: builds up to a long DoT */
export type Element = 'fire' | 'cold' | 'poison';

export interface Weapon {
  id: string;
  name: string;
  weight: number;
  /** 1 = with a shield (default), 2 = two-handed (no shield, guards with the blade), 'dual' = a blade in each hand */
  hands?: 1 | 2 | 'dual';
  /** how the weapon blocks when it occupies the off hand (two-handed / dual) */
  guard?: { absorb: number; stability: number };
  /** elemental infusion: `power` = fire damage per hit, or cold/poison build-up per hit (100 = proc) */
  element?: { type: Element; power: number };
  /** sprite sheet (`weapon-<sheet>`), defaults to the id */
  sheet?: string;
  /** stat scaling: damage bonus per stat point above 10 is 5% × factor */
  scaling: { str: number; dex: number };
  /** sprite look (overrides the player build) */
  look: { style: WeaponStyle; swordLen: number; bladeW: number; hilt: number; guard: number };
  light: PlayerAttackDef[];
  heavy: PlayerAttackDef;
  air: PlayerAttackDef;
}

type A = PlayerAttackDef;
const f = (windup: string, strike: string, recover: string, charge?: string) => ({ windup, strike, recover, charge });

/** Movesets live in data so a new weapon is just a new entry here. */

/** Two-handed: both hands on the hilt, no shield. Slower, longer and harder than the shortsword; blocks with the blade. */
export const LONGSWORD: Weapon = {
  id: 'longsword',
  name: 'Longsword',
  weight: 6,
  hands: 2,
  guard: { absorb: 0.6, stability: 0.45 },
  scaling: { str: 0.7, dex: 0.6 },
  look: { style: 'sword', swordLen: 13, bladeW: 1, hilt: 3, guard: 2 },
  light: [
    {
      id: 'l1', startup: 0.14, active: 0.1, recovery: 0.26, damage: 25, poise: 14, stamina: 16,
      hitbox: { x: 2, y: -18, w: 30, h: 24 }, lunge: 75, knock: 85, hitstop: 0.06, shake: 0.0025,
      frames: f('l1w', 'l1s', 'l1r'), next: 'l2',
    },
    {
      id: 'l2', startup: 0.13, active: 0.1, recovery: 0.28, damage: 26, poise: 14, stamina: 16,
      hitbox: { x: 2, y: -24, w: 30, h: 28 }, lunge: 75, knock: 85, hitstop: 0.06, shake: 0.0025,
      frames: f('l2w', 'l2s', 'l2r'), next: 'l3',
    },
    {
      id: 'l3', startup: 0.22, active: 0.11, recovery: 0.38, damage: 37, poise: 28, stamina: 20,
      hitbox: { x: 0, y: -26, w: 34, h: 32 }, lunge: 115, knock: 150, hitstop: 0.09, shake: 0.005,
      frames: f('l3w', 'l3s', 'l3r'), heavy: true, hyperFrom: 0.15,
    },
  ],
  heavy: {
    id: 'heavy', startup: 0.42, active: 0.13, recovery: 0.44, damage: 54, poise: 46, stamina: 30,
    hitbox: { x: 0, y: -28, w: 36, h: 34 }, lunge: 125, knock: 190, hitstop: 0.11, shake: 0.007,
    frames: f('hw', 'hs', 'hr', 'hc'), heavy: true, chargeMax: 0.75, hyperFrom: 0.18,
  },
  air: {
    id: 'air', startup: 0.11, active: 0.12, recovery: 0.22, damage: 23, poise: 12, stamina: 15,
    hitbox: { x: 0, y: -18, w: 28, h: 30 }, lunge: 0, knock: 70, hitstop: 0.055, shake: 0.0025,
    frames: f('aw', 'as', 'as'),
  },
};

/** One-handed, used with a shield: quick, short, light. */
export const SHORTSWORD: Weapon = {
  id: 'shortsword',
  name: 'Shortsword',
  weight: 3,
  scaling: { str: 0.5, dex: 0.7 },
  look: { style: 'sword', swordLen: 9, bladeW: 1, hilt: 2, guard: 2 },
  light: [
    {
      id: 'k1', startup: 0.1, active: 0.08, recovery: 0.2, damage: 17, poise: 8, stamina: 11,
      hitbox: { x: 2, y: -16, w: 22, h: 20 }, lunge: 70, knock: 60, hitstop: 0.05, shake: 0.0018,
      frames: f('l1w', 'l1s', 'l1r'), next: 'k2',
    },
    {
      id: 'k2', startup: 0.09, active: 0.08, recovery: 0.22, damage: 17, poise: 8, stamina: 11,
      hitbox: { x: 2, y: -20, w: 22, h: 24 }, lunge: 70, knock: 60, hitstop: 0.05, shake: 0.0018,
      frames: f('l2w', 'l2s', 'l2r'), next: 'k3',
    },
    {
      id: 'k3', startup: 0.16, active: 0.09, recovery: 0.3, damage: 24, poise: 16, stamina: 15,
      hitbox: { x: 0, y: -22, w: 26, h: 26 }, lunge: 100, knock: 110, hitstop: 0.07, shake: 0.003,
      frames: f('l3w', 'l3s', 'l3r'), heavy: true,
    },
  ],
  heavy: {
    id: 'kheavy', startup: 0.32, active: 0.11, recovery: 0.38, damage: 34, poise: 30, stamina: 24,
    hitbox: { x: 0, y: -24, w: 28, h: 28 }, lunge: 120, knock: 150, hitstop: 0.09, shake: 0.005,
    frames: f('hw', 'hs', 'hr', 'hc'), heavy: true, chargeMax: 0.6, hyperFrom: 0.16,
  },
  air: {
    id: 'kair', startup: 0.09, active: 0.11, recovery: 0.18, damage: 15, poise: 6, stamina: 12,
    hitbox: { x: 0, y: -18, w: 24, h: 26 }, lunge: 0, knock: 50, hitstop: 0.045, shake: 0.0018,
    frames: f('aw', 'as', 'as'),
  },
};

/**
 * A dagger in each hand: very fast stabs alternating right/left, the heavy drives both blades in
 * at once. Short reach, no poise. Parries with the off-hand blade but blocks poorly.
 */
export const TWIN_DAGGERS: Weapon = {
  id: 'twin_daggers',
  name: 'Twin Daggers',
  weight: 2,
  hands: 'dual',
  sheet: 'dagger',
  guard: { absorb: 0.35, stability: 0.2 },
  scaling: { str: 0.2, dex: 1.2 },
  look: { style: 'dagger', swordLen: 6, bladeW: 1, hilt: 2, guard: 1 },
  light: ['d1', 'd2', 'd3', 'd4'].map(
    (id, i): A => ({
      id, startup: 0.06, active: 0.06, recovery: 0.13, damage: i === 3 ? 13 : 10, poise: 3, stamina: 7,
      hitbox: { x: 4, y: -16, w: 20, h: 14 }, lunge: 80, knock: 30, hitstop: 0.035, shake: 0.0012,
      // right hand, left hand, right, left
      frames: i % 2 === 0 ? f('tw', 'ts', 'tr') : f('o1w', 'o1s', 'o1r'),
      next: i < 3 ? `d${i + 2}` : undefined,
    }),
  ),
  heavy: {
    id: 'dheavy', startup: 0.28, active: 0.1, recovery: 0.32, damage: 30, poise: 12, stamina: 20,
    hitbox: { x: 4, y: -18, w: 24, h: 18 }, lunge: 180, knock: 110, hitstop: 0.08, shake: 0.004,
    frames: f('xw', 'xs', 'xr', 'xw'), chargeMax: 0.45,
  },
  air: {
    id: 'dair', startup: 0.07, active: 0.1, recovery: 0.14, damage: 11, poise: 3, stamina: 8,
    hitbox: { x: 2, y: -12, w: 22, h: 20 }, lunge: 0, knock: 30, hitstop: 0.035, shake: 0.0012,
    frames: f('aw', 'as', 'as'),
  },
};

/** Slow, huge poise damage, hyperarmor on every swing. */
export const GREATAXE: Weapon = {
  id: 'greataxe',
  name: 'Greataxe',
  weight: 12,
  scaling: { str: 1.1, dex: 0 },
  look: { style: 'axe', swordLen: 16, bladeW: 1, hilt: 4, guard: 0 },
  light: [
    {
      id: 'g1', startup: 0.32, active: 0.12, recovery: 0.42, damage: 40, poise: 32, stamina: 24,
      hitbox: { x: 0, y: -26, w: 32, h: 32 }, lunge: 90, knock: 160, hitstop: 0.09, shake: 0.006,
      frames: f('l3w', 'l3s', 'l3r'), next: 'g2', heavy: true, hyperFrom: 0.12,
    },
    {
      id: 'g2', startup: 0.28, active: 0.12, recovery: 0.5, damage: 44, poise: 34, stamina: 24,
      hitbox: { x: -4, y: -20, w: 36, h: 26 }, lunge: 100, knock: 170, hitstop: 0.09, shake: 0.006,
      frames: f('l2w', 'l2s', 'l2r'), heavy: true, hyperFrom: 0.1,
    },
  ],
  heavy: {
    id: 'gheavy', startup: 0.62, active: 0.14, recovery: 0.6, damage: 78, poise: 70, stamina: 40,
    hitbox: { x: -2, y: -30, w: 38, h: 38 }, lunge: 110, knock: 220, hitstop: 0.13, shake: 0.012,
    frames: f('hw', 'hs', 'hr', 'hc'), heavy: true, chargeMax: 0.8, hyperFrom: 0.15,
  },
  air: {
    id: 'gair', startup: 0.16, active: 0.14, recovery: 0.3, damage: 34, poise: 24, stamina: 22,
    hitbox: { x: -2, y: -16, w: 30, h: 32 }, lunge: 0, knock: 120, hitstop: 0.08, shake: 0.005,
    frames: f('aw', 'as', 'as'), heavy: true,
  },
};

/** Fast thrusts with long reach but almost no poise damage. */
export const RAPIER: Weapon = {
  id: 'rapier',
  name: 'Rapier',
  weight: 3,
  scaling: { str: 0.2, dex: 1.1 },
  look: { style: 'rapier', swordLen: 15, bladeW: 1, hilt: 2, guard: 1 },
  light: ['r1', 'r2', 'r3', 'r4'].map(
    (id, i): A => ({
      id, startup: 0.08, active: 0.07, recovery: 0.17, damage: i === 3 ? 18 : 13, poise: 4, stamina: 9,
      hitbox: { x: 4, y: -14, w: 32, h: 10 }, lunge: 90, knock: 40, hitstop: 0.04, shake: 0.0015,
      frames: f('tw', 'ts', 'tr'), next: i < 3 ? `r${i + 2}` : undefined,
    }),
  ),
  heavy: {
    id: 'rheavy', startup: 0.3, active: 0.12, recovery: 0.36, damage: 32, poise: 14, stamina: 22,
    hitbox: { x: 4, y: -15, w: 38, h: 12 }, lunge: 260, knock: 120, hitstop: 0.08, shake: 0.004,
    frames: f('tw', 'ts', 'tr', 'tw'), chargeMax: 0.5,
  },
  air: {
    id: 'rair', startup: 0.08, active: 0.12, recovery: 0.16, damage: 14, poise: 4, stamina: 10,
    hitbox: { x: 2, y: -10, w: 30, h: 16 }, lunge: 0, knock: 40, hitstop: 0.04, shake: 0.0015,
    frames: f('aw', 'as', 'as'),
  },
};

export const FISTS: Weapon = {
  id: 'fists',
  name: 'Fists',
  weight: 0,
  scaling: { str: 0.5, dex: 0.3 },
  look: { style: 'none', swordLen: 0, bladeW: 1, hilt: 0, guard: 0 },
  light: ['p1', 'p2'].map(
    (id, i): A => ({
      id, startup: 0.08, active: 0.06, recovery: 0.16, damage: 8, poise: 5, stamina: 8,
      hitbox: { x: 2, y: -16, w: 12, h: 12 }, lunge: 50, knock: 50, hitstop: 0.04, shake: 0.0015,
      frames: f('tw', 'ts', 'tr'), next: i === 0 ? 'p2' : undefined,
    }),
  ),
  heavy: {
    id: 'pheavy', startup: 0.3, active: 0.08, recovery: 0.3, damage: 16, poise: 14, stamina: 16,
    hitbox: { x: 2, y: -16, w: 14, h: 14 }, lunge: 120, knock: 120, hitstop: 0.06, shake: 0.003,
    frames: f('tw', 'ts', 'tr'),
  },
  air: {
    id: 'pair', startup: 0.08, active: 0.1, recovery: 0.16, damage: 7, poise: 4, stamina: 8,
    hitbox: { x: 0, y: -14, w: 14, h: 18 }, lunge: 0, knock: 40, hitstop: 0.04, shake: 0.0015,
    frames: f('aw', 'as', 'as'),
  },
};

/** Reward from the Bone Shepherd: wide sweeping arcs that also clip enemies just behind you. */
export const BONE_SCYTHE: Weapon = {
  id: 'bone_scythe',
  name: "Shepherd's Scythe",
  weight: 7,
  scaling: { str: 0.5, dex: 0.9 },
  look: { style: 'axe', swordLen: 18, bladeW: 1, hilt: 3, guard: 0 },
  light: [
    {
      id: 's1', startup: 0.17, active: 0.13, recovery: 0.3, damage: 25, poise: 14, stamina: 17,
      hitbox: { x: -8, y: -24, w: 44, h: 28 }, lunge: 60, knock: 90, hitstop: 0.06, shake: 0.003,
      frames: f('l1w', 'l1s', 'l1r'), next: 's2',
    },
    {
      id: 's2', startup: 0.16, active: 0.13, recovery: 0.38, damage: 27, poise: 16, stamina: 17,
      hitbox: { x: -8, y: -26, w: 44, h: 30 }, lunge: 60, knock: 110, hitstop: 0.06, shake: 0.003,
      frames: f('l2w', 'l2s', 'l2r'),
    },
  ],
  heavy: {
    id: 'sheavy', startup: 0.46, active: 0.2, recovery: 0.5, damage: 50, poise: 34, stamina: 30,
    hitbox: { x: -34, y: -30, w: 70, h: 34 }, lunge: 50, knock: 170, hitstop: 0.1, shake: 0.007,
    frames: f('hw', 'hs', 'hr', 'hc'), heavy: true, chargeMax: 0.6, hyperFrom: 0.2,
  },
  air: {
    id: 'sair', startup: 0.12, active: 0.14, recovery: 0.24, damage: 22, poise: 10, stamina: 15,
    hitbox: { x: -6, y: -20, w: 38, h: 32 }, lunge: 0, knock: 70, hitstop: 0.05, shake: 0.002,
    frames: f('aw', 'as', 'as'),
  },
};

/**
 * An infused copy of a weapon: same moveset, a little less physical damage, plus the element.
 * The sprite is the same blade recoloured (tools/sprites PLAYER_WEAPONS, sheet = id).
 */
function infuse(base: Weapon, id: string, name: string, type: Element, power: number, phys = 0.88): Weapon {
  const scale = (a: A): A => ({ ...a, damage: Math.round(a.damage * phys) });
  return { ...base, id, name, sheet: id, element: { type, power }, light: base.light.map(scale), heavy: scale(base.heavy), air: scale(base.air) };
}

export const FLAME_LONGSWORD = infuse(LONGSWORD, 'flame_longsword', 'Flame Longsword', 'fire', 7);
export const FROST_LONGSWORD = infuse(LONGSWORD, 'frost_longsword', 'Frost Longsword', 'cold', 26);
export const VENOM_LONGSWORD = infuse(LONGSWORD, 'venom_longsword', 'Venom Longsword', 'poison', 24);
export const FLAME_SHORTSWORD = infuse(SHORTSWORD, 'flame_shortsword', 'Flame Shortsword', 'fire', 5);
export const FROST_SHORTSWORD = infuse(SHORTSWORD, 'frost_shortsword', 'Frost Shortsword', 'cold', 20);
export const FLAME_GREATAXE = infuse(GREATAXE, 'flame_greataxe', 'Flame Greataxe', 'fire', 12);
export const FROST_GREATAXE = infuse(GREATAXE, 'frost_greataxe', 'Frost Greataxe', 'cold', 45);
export const VENOM_RAPIER = infuse(RAPIER, 'venom_rapier', 'Venom Rapier', 'poison', 17);

/**
 * Reward from the Frost Matriarch: her spear, rimed through. Rapier-quick thrusts with far more
 * reach, a charging lunge, and every hit builds frost.
 */
export const FROST_SPEAR: Weapon = {
  ...RAPIER,
  id: 'frost_spear',
  name: "Matriarch's Spear",
  weight: 6,
  hands: 2,
  guard: { absorb: 0.5, stability: 0.4 },
  sheet: 'frost_spear',
  element: { type: 'cold', power: 22 },
  scaling: { str: 0.5, dex: 0.9 },
  look: { style: 'rapier', swordLen: 24, bladeW: 1, hilt: 2, guard: 1 },
  light: ['fs1', 'fs2', 'fs3'].map(
    (id, i): A => ({
      id, startup: 0.12, active: 0.09, recovery: 0.22, damage: i === 2 ? 26 : 19, poise: 8, stamina: 12,
      hitbox: { x: 4, y: -14, w: 46, h: 10 }, lunge: 100, knock: 60, hitstop: 0.05, shake: 0.002,
      frames: f('tw', 'ts', 'tr'), next: i < 2 ? `fs${i + 2}` : undefined,
    }),
  ),
  heavy: {
    id: 'fsheavy', startup: 0.36, active: 0.16, recovery: 0.4, damage: 44, poise: 26, stamina: 26,
    hitbox: { x: 4, y: -15, w: 54, h: 12 }, lunge: 300, knock: 150, hitstop: 0.09, shake: 0.005, heavy: true,
    frames: f('tw', 'ts', 'tr', 'tw'), chargeMax: 0.5,
  },
  air: {
    id: 'fsair', startup: 0.1, active: 0.12, recovery: 0.18, damage: 18, poise: 6, stamina: 12,
    hitbox: { x: 2, y: -10, w: 40, h: 16 }, lunge: 0, knock: 50, hitstop: 0.04, shake: 0.0015,
    frames: f('aw', 'as', 'as'),
  },
};

/** Reward from the Sandstone Sphinx: a one-handed sandstone mace. Slower than a sword, but every blow breaks poise. */
export const SAND_SCEPTER: Weapon = {
  id: 'sand_scepter',
  name: 'Sand Scepter',
  weight: 7,
  scaling: { str: 1, dex: 0.2 },
  look: { style: 'axe', swordLen: 10, bladeW: 2, hilt: 2, guard: 0 },
  light: [
    {
      id: 'm1', startup: 0.18, active: 0.1, recovery: 0.28, damage: 24, poise: 22, stamina: 15,
      hitbox: { x: 0, y: -20, w: 24, h: 26 }, lunge: 70, knock: 110, hitstop: 0.07, shake: 0.003,
      frames: f('l1w', 'l1s', 'l1r'), next: 'm2', heavy: true,
    },
    {
      id: 'm2', startup: 0.2, active: 0.1, recovery: 0.36, damage: 28, poise: 26, stamina: 16,
      hitbox: { x: 0, y: -22, w: 24, h: 28 }, lunge: 80, knock: 130, hitstop: 0.08, shake: 0.004,
      frames: f('l3w', 'l3s', 'l3r'), heavy: true,
    },
  ],
  heavy: {
    id: 'mheavy', startup: 0.4, active: 0.12, recovery: 0.42, damage: 48, poise: 46, stamina: 26,
    hitbox: { x: 0, y: -26, w: 28, h: 32 }, lunge: 100, knock: 190, hitstop: 0.11, shake: 0.007,
    frames: f('hw', 'hs', 'hr', 'hc'), heavy: true, chargeMax: 0.6, hyperFrom: 0.18,
  },
  air: {
    id: 'mair', startup: 0.12, active: 0.12, recovery: 0.22, damage: 20, poise: 14, stamina: 14,
    hitbox: { x: 0, y: -18, w: 24, h: 28 }, lunge: 0, knock: 80, hitstop: 0.06, shake: 0.003,
    frames: f('aw', 'as', 'as'),
  },
};

/** Reward from Varro: his twin gladii. Twin-dagger speed with real weight behind each cut. */
export const GLADIATOR_BLADES: Weapon = {
  ...TWIN_DAGGERS,
  id: 'gladiator_blades',
  name: "Gladiator's Blades",
  weight: 6,
  sheet: 'gladius',
  guard: { absorb: 0.45, stability: 0.3 },
  scaling: { str: 0.6, dex: 0.9 },
  look: { style: 'dagger', swordLen: 9, bladeW: 2, hilt: 2, guard: 1 },
  light: TWIN_DAGGERS.light.map((a, i) => ({
    ...a, id: `gb${i + 1}`, damage: i === 3 ? 20 : 15, poise: 8, stamina: 9, startup: a.startup + 0.02,
    hitbox: { x: 4, y: -16, w: 26, h: 16 }, next: i < 3 ? `gb${i + 2}` : undefined,
  })),
  heavy: { ...TWIN_DAGGERS.heavy, id: 'gbheavy', damage: 42, poise: 24, stamina: 24, hitbox: { x: 4, y: -18, w: 30, h: 18 } },
  air: { ...TWIN_DAGGERS.air, id: 'gbair', damage: 16, poise: 6 },
};

/** Reward from the Sky Leviathan: a two-handed maul of storm-grey whalebone. Enormous poise damage. */
export const CLOUDBREAKER: Weapon = {
  ...GREATAXE,
  id: 'cloudbreaker',
  name: 'Cloudbreaker',
  weight: 14,
  hands: 2,
  guard: { absorb: 0.6, stability: 0.55 },
  sheet: 'cloudbreaker',
  scaling: { str: 1.25, dex: 0 },
  look: { style: 'axe', swordLen: 18, bladeW: 2, hilt: 4, guard: 0 },
  light: GREATAXE.light.map((a, i) => ({ ...a, id: `cb${i + 1}`, damage: a.damage + 6, poise: a.poise + 14, next: a.next ? `cb${i + 2}` : undefined })),
  heavy: { ...GREATAXE.heavy, id: 'cbheavy', damage: GREATAXE.heavy.damage + 10, poise: GREATAXE.heavy.poise + 20 },
  air: { ...GREATAXE.air, id: 'cbair', damage: GREATAXE.air.damage + 4, poise: GREATAXE.air.poise + 8 },
};

/** Reward from Ayame: her wedding knife. One-handed (keep your shield); very quick stabs, a darting heavy. */
export const BRIDAL_KNIFE: Weapon = {
  ...SHORTSWORD,
  id: 'bridal_knife',
  name: 'Bridal Knife',
  weight: 2,
  sheet: 'bridal_knife',
  scaling: { str: 0.2, dex: 1.15 },
  look: { style: 'dagger', swordLen: 7, bladeW: 1, hilt: 2, guard: 1 },
  light: ['bk1', 'bk2', 'bk3'].map(
    (id, i): A => ({
      id, startup: 0.07, active: 0.07, recovery: 0.15, damage: i === 2 ? 19 : 14, poise: 6, stamina: 8,
      hitbox: { x: 4, y: -14, w: 22, h: 12 }, lunge: 90, knock: 40, hitstop: 0.035, shake: 0.0012,
      frames: f('tw', 'ts', 'tr'), next: i < 2 ? `bk${i + 2}` : undefined,
    }),
  ),
  heavy: {
    id: 'bkheavy', startup: 0.26, active: 0.12, recovery: 0.3, damage: 30, poise: 14, stamina: 18,
    hitbox: { x: 4, y: -15, w: 26, h: 14 }, lunge: 300, knock: 110, hitstop: 0.07, shake: 0.003,
    frames: f('tw', 'ts', 'tr', 'tw'), chargeMax: 0.4,
  },
  air: {
    id: 'bkair', startup: 0.07, active: 0.1, recovery: 0.14, damage: 13, poise: 4, stamina: 8,
    hitbox: { x: 2, y: -12, w: 22, h: 18 }, lunge: 0, knock: 30, hitstop: 0.035, shake: 0.0012,
    frames: f('aw', 'as', 'as'),
  },
};

/** Reward from the Ashen King: his greatsword, still smouldering. Two-handed, heavy, every cut sets the foe burning. */
export const ASHEN_GREATSWORD: Weapon = {
  ...LONGSWORD,
  id: 'ashen_greatsword',
  name: 'Ashen Greatsword',
  weight: 11,
  sheet: 'ashen_greatsword',
  element: { type: 'fire', power: 6 },
  scaling: { str: 1, dex: 0.5 },
  look: { style: 'sword', swordLen: 20, bladeW: 3, hilt: 4, guard: 3 },
  light: LONGSWORD.light.map((a, i) => ({
    ...a, id: `ag${i + 1}`, startup: a.startup + 0.06, recovery: a.recovery + 0.06,
    damage: Math.round(a.damage * 1.4), poise: Math.round(a.poise * 1.6), stamina: a.stamina + 5,
    hitbox: { ...a.hitbox, w: a.hitbox.w + 8 }, next: a.next ? `ag${i + 2}` : undefined,
  })),
  heavy: { ...LONGSWORD.heavy, id: 'agheavy', damage: Math.round(LONGSWORD.heavy.damage * 1.45), poise: Math.round(LONGSWORD.heavy.poise * 1.6), stamina: LONGSWORD.heavy.stamina + 6 },
  air: { ...LONGSWORD.air, id: 'agair', damage: Math.round(LONGSWORD.air.damage * 1.3) },
};

export const WEAPONS: Record<string, Weapon> = {
  ashen_greatsword: ASHEN_GREATSWORD,
  bridal_knife: BRIDAL_KNIFE,
  cloudbreaker: CLOUDBREAKER,
  sand_scepter: SAND_SCEPTER,
  gladiator_blades: GLADIATOR_BLADES,
  frost_spear: FROST_SPEAR,
  bone_scythe: BONE_SCYTHE,
  fists: FISTS,
  longsword: LONGSWORD,
  shortsword: SHORTSWORD,
  twin_daggers: TWIN_DAGGERS,
  greataxe: GREATAXE,
  rapier: RAPIER,
  flame_longsword: FLAME_LONGSWORD,
  frost_longsword: FROST_LONGSWORD,
  venom_longsword: VENOM_LONGSWORD,
  flame_shortsword: FLAME_SHORTSWORD,
  frost_shortsword: FROST_SHORTSWORD,
  flame_greataxe: FLAME_GREATAXE,
  frost_greataxe: FROST_GREATAXE,
  venom_rapier: VENOM_RAPIER,
};

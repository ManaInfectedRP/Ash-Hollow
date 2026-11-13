// Character definitions: rig proportions + palette + parts + poses.
// Frame names are the contract with the game code (Player.ts / Enemy.ts / Boss.ts).
import { BOW, HEADS, PAULDRONS, SHIELDS, SHIELD_PALS, STAFF, WEAPONS } from './parts.mjs';
import { FM_ARMORS, FM_PLAYER_WEAPONS, setBase } from './frostmire.mjs';
import { DS_ARMORS, DS_PLAYER_WEAPONS, setDesertBase } from './desert.mjs';
import { SKY_ARMORS, SKY_PLAYER_WEAPONS } from './sky.mjs';
import { SHRINE_ARMORS, SHRINE_PLAYER_WEAPONS, setShrineBase } from './shrine.mjs';
import { FINALE_ARMORS, FINALE_PLAYER_WEAPONS } from './finale.mjs';
export { SHIELDS, SHIELD_PALS };

const BASE = {
  o: '#110d16',
  z: '#8a5e4a', s: '#c48e6e', S: '#e0b090', h: '#3a2a22',
  x: '#5a6070', b: '#a8b0be', B: '#dfe4ec', W: '#ffffff',
  n: '#2e2119', N: '#5e4230',
  g: '#a07828', G: '#e0b850',
  v: '#0a0810', e: '#ff5a30',
  r: '#6a1a20', R: '#c03a32',
  u: '#a89a80', U: '#e8dcc0',
  f: '#d0501a', F: '#ffc050',
  k: '#3a1a22', c: '#6e2430', C: '#9a3a40',
  D: '#3e3226', M: '#5e4c3a', L: '#7e6850', H: '#9a8466',
};
setBase(BASE);
setDesertBase(BASE);
setShrineBase(BASE);

// ------------------------------------------------------------------ poses
const walk = (s, a, extra = {}) => ({
  walk0: { fx: 2 * s, bx: -2 * s, a, ba: 120, ...extra },
  walk1: { fx: s, fl: 1, bx: -s, by: -1, a: a + 4, ba: 100, ...extra },
  walk2: { fx: -2 * s, bx: 2 * s, a, ba: 75, ...extra },
  walk3: { fx: -s, bx: s, bl: 1, by: -1, a: a + 4, ba: 100, ...extra },
});

export const PLAYER_POSES = {
  idle0: { a: 70, r: 3, ba: 100 },
  idle1: { a: 72, r: 3, by: 1, ba: 102 },
  run0: { fx: 4, fl: 1, bx: -4, lean: 1, a: 35, r: 3, cape: 2, ba: 140 },
  run1: { fx: 1, fl: 2, bx: -1, by: -1, lean: 1, a: 40, cape: 3, ba: 110 },
  run2: { fx: -3, bx: 3, bl: 1, lean: 1, a: 35, cape: 2, ba: 60 },
  run3: { fx: -1, bx: 1, bl: 2, by: -1, lean: 1, a: 40, cape: 3, ba: 100 },
  jump: { fx: 2, fl: 3, bx: -2, bl: 1, a: -30, r: 4, cape: 0, by: -1, ba: 150 },
  fall: { fx: 3, fl: 1, bx: -3, bl: 2, a: -60, r: 4, cape: 4, ba: 200 },
  roll0: { kind: 'roll', rot: 0 },
  roll1: { kind: 'roll', rot: Math.PI / 2 },
  roll2: { kind: 'roll', rot: Math.PI },
  roll3: { kind: 'roll', rot: Math.PI * 1.5 },
  l1w: { lean: -1, a: -120, r: 2, fx: 2, bx: -3, ba: 60 },
  l1s: { lean: 2, a: 10, r: 5, fx: 4, bx: -4, cape: 2, ba: 150 },
  l1r: { lean: 1, a: 50, r: 4, fx: 3, bx: -3, ba: 130 },
  l2w: { a: 140, r: 3, fx: 2, bx: -3, ba: 70 },
  l2s: { lean: 2, a: -40, r: 5, fx: 4, bx: -4, cape: 2, ba: 150 },
  l2r: { lean: 1, a: -10, r: 4, fx: 3, bx: -3, ba: 130 },
  l3w: { lean: -2, a: -160, r: 3, by: 1, fx: 2, bx: -3, ba: 40 },
  l3s: { lean: 3, a: 55, r: 5, by: 2, fx: 5, bx: -5, cape: 3, ba: 160 },
  l3r: { lean: 2, a: 80, r: 4, by: 1, fx: 4, bx: -4, ba: 140 },
  hw: { lean: -2, a: -165, r: 3, by: 1, fx: 3, bx: -3, ba: 30 },
  hc: { lean: -3, a: -178, r: 4, by: 2, fx: 3, bx: -4, ba: 20 },
  hs: { lean: 3, a: 35, r: 5, by: 2, fx: 5, bx: -5, cape: 3, ba: 170 },
  hr: { lean: 2, a: 75, r: 4, by: 1, fx: 4, bx: -4, ba: 140 },
  aw: { a: -110, r: 3, fx: 2, fl: 3, bx: -2, bl: 1, ba: 160 },
  as: { a: 45, r: 5, fx: 3, fl: 2, bx: -2, bl: 2, cape: 3, ba: 200 },
  tw: { lean: -1, a: 8, r: 0, fx: 2, bx: -3, ba: 150 },
  ts: { lean: 3, a: 0, r: 6, fx: 5, bx: -5, cape: 2, ba: 170 },
  tr: { lean: 1, a: 25, r: 4, fx: 3, bx: -3, ba: 130 },
  hurt: { lean: -2, a: -40, r: 2, fx: -1, bx: -3, cape: 0, ba: 210 },
  // shield: raised guard, a sharp parry flick, and the riposte stab
  block: { lean: -1, a: 80, r: 3, ba: -8, by: 1, fx: 3, bx: -3, cape: 1, shieldFront: true },
  parry: { lean: 2, a: 85, r: 3, ba: -45, fx: 4, bx: -3, cape: 2, shieldFront: true },
  // twin daggers: the off-hand stab (back arm thrusts forward) and the both-blades heavy
  o1w: { lean: -1, a: 75, r: 3, ba: 175, fx: 2, bx: -3 },
  o1s: { lean: 3, a: 110, r: 3, ba: 2, fx: 5, bx: -5, cape: 2, shieldFront: true },
  o1r: { lean: 1, a: 90, r: 3, ba: 40, fx: 3, bx: -3, shieldFront: true },
  xw: { lean: -2, a: 175, r: 3, ba: 185, by: 1, fx: 2, bx: -3 },
  xs: { lean: 4, a: 0, r: 6, ba: -4, by: 1, fx: 6, bx: -6, cape: 3, shieldFront: true },
  xr: { lean: 2, a: 30, r: 4, ba: 35, fx: 4, bx: -4, shieldFront: true },
  rip1: { lean: -1, a: 5, r: 1, ba: 150, fx: 3, bx: -3 },
  rip2: { lean: 4, a: 0, r: 7, ba: 170, fx: 6, bx: -6, cape: 3 },
  drink: { kind: 'drink', a: -75, r: 3, lean: -1, ba: 100 },
  kneel: { by: 3, fx: 3, bx: -3, a: 90, r: 2, lean: 1, ba: 80 },
  dead: { kind: 'dead' },
};

// ------------------------------------------------------------------ player variants
const PLAYER_RIG = { legLen: 8, legW: 3, torsoW: 8, torsoH: 8, armW: 2, armLen: 5 };
const rigFor = (armor) => ({ ...PLAYER_RIG, taper: armor.taper ?? 0 });

export const PLAYER_ARMORS = {
  garb: {
    head: HEADS.hood,
    torso: 'leather',
    cape: { w: 4 },
    legs: { back: '#2c2830', front: '#423d48', lit: '#5c5664' },
    pal: { D: '#4a3c2c', M: '#6e5a42', L: '#8e7656', H: '#b09474' },
  },
  knight_armor: {
    head: HEADS.knightHelm,
    torso: 'plate',
    pauldron: PAULDRONS.small,
    kneePad: true,
    cape: { w: 4 },
    taper: 1,
    pal: {
      D: '#3c4252', M: '#646c80', L: '#9aa3b8', H: '#d0d6e4',
      k: '#1c2a1e', c: '#2e4430', C: '#44603e',
    },
  },
  /** light leathers, green hood and cloak */
  hunter_leathers: {
    head: HEADS.hood,
    torso: 'leather',
    cape: { w: 4 },
    pauldron: PAULDRONS.small,
    legs: { back: '#2a2a22', front: '#3e3e30', lit: '#56563e' },
    pal: { D: '#3a2c1e', M: '#5a4630', L: '#7a6242', H: '#9a7e58', k: '#1c2a1a', c: '#2e4428', C: '#46603a' },
  },
  /** pyromancer's robes: flared hem, ember runes, coal-eyed cowl */
  ember_robes: {
    head: HEADS.cowl,
    torso: 'robe',
    cape: { w: 3 },
    taper: -1,
    legs: { back: '#1e0c0a', front: '#34140e', lit: '#4e2014' },
    pal: { D: '#3a120c', M: '#6a1e14', L: '#9a3a1c', H: '#c05028', k: '#2a0e0c', c: '#6a1e14', C: '#9a3a1c', r: '#5a1610', R: '#b04a22', e: '#ffb040' },
  },
  /** blackened plate with bone horns and a smouldering crack */
  warden_plate: {
    head: HEADS.greatHelm,
    torso: 'warden',
    pauldron: PAULDRONS.small,
    kneePad: true,
    cape: { w: 4 },
    taper: 1,
    legs: { back: '#1a1a20', front: '#2c2c34', lit: '#44444e' },
    pal: { D: '#22222a', M: '#3e3e4a', L: '#62626e', H: '#8e8e9c', k: '#1a0a0c', c: '#3a1418', C: '#5a2024' },
  },
  naked: {
    head: HEADS.bare,
    torso: 'skin',
    bareHands: true,
    headDy: 0,
    pal: {
      D: '#8a5e4a', M: '#c48e6e', L: '#e0b090', H: '#f0c8a8',
      k: '#2e2119', c: '#4a3626', C: '#5e4632',
    },
  },
  ...FM_ARMORS(HEADS),
  ...DS_ARMORS(HEADS),
  ...SKY_ARMORS(HEADS),
  ...SHRINE_ARMORS(HEADS),
  ...FINALE_ARMORS(HEADS),
};

/** Blade recolours for the elemental weapons (blade ramp x → b → B → W). */
export const ELEMENT_PAL = {
  fire: { x: '#8a2a10', b: '#e8642a', B: '#ffb45a', W: '#fff0c0' },
  cold: { x: '#3a6a9a', b: '#86c4ec', B: '#d0f0ff', W: '#ffffff' },
  poison: { x: '#2e5a24', b: '#62aa44', B: '#b4e87a', W: '#ecffc8' },
};

/**
 * Weapons the player can equip; each becomes a pre-rotated `weapon-<id>` sheet.
 * An entry is a grid, or { grid, pal } for a recoloured variant. `base` names the item whose
 * icon gets recoloured for the inventory (see the icon pass in build.mjs).
 */
export const PLAYER_WEAPONS = {
  longsword: WEAPONS.longsword,
  greataxe: WEAPONS.greataxe,
  rapier: WEAPONS.rapier,
  bone_scythe: WEAPONS.boneScythe,
  shortsword: WEAPONS.shortsword,
  dagger: WEAPONS.dagger,
  flame_longsword: { grid: WEAPONS.longsword, pal: ELEMENT_PAL.fire, base: 'longsword', element: 'fire' },
  frost_longsword: { grid: WEAPONS.longsword, pal: ELEMENT_PAL.cold, base: 'longsword', element: 'cold' },
  venom_longsword: { grid: WEAPONS.longsword, pal: ELEMENT_PAL.poison, base: 'longsword', element: 'poison' },
  flame_shortsword: { grid: WEAPONS.shortsword, pal: ELEMENT_PAL.fire, base: 'shortsword', element: 'fire' },
  frost_shortsword: { grid: WEAPONS.shortsword, pal: ELEMENT_PAL.cold, base: 'shortsword', element: 'cold' },
  flame_greataxe: { grid: WEAPONS.greataxe, pal: ELEMENT_PAL.fire, base: 'greataxe', element: 'fire' },
  frost_greataxe: { grid: WEAPONS.greataxe, pal: ELEMENT_PAL.cold, base: 'greataxe', element: 'cold' },
  venom_rapier: { grid: WEAPONS.rapier, pal: ELEMENT_PAL.poison, base: 'rapier', element: 'poison' },
  ...FM_PLAYER_WEAPONS,
  ...DS_PLAYER_WEAPONS,
  ...SKY_PLAYER_WEAPONS,
  ...SHRINE_PLAYER_WEAPONS,
  ...FINALE_PLAYER_WEAPONS,
};
export const WEAPON_PALETTE = BASE;

/** Player BODY sheet for one armor. The weapon is NOT baked in – it is attached in-game to the weapon bone. */
export function playerSheet(armorId) {
  const armor = PLAYER_ARMORS[armorId];
  return {
    key: `player-${armorId}`,
    fw: 48,
    fh: 32,
    def: {
      rig: rigFor(armor),
      head: armor.head,
      legs: armor.legs,
      torso: armor.torso,
      cape: armor.cape ?? null,
      pauldron: armor.pauldron ?? null,
      kneePad: !!armor.kneePad,
      bareHands: !!armor.bareHands,
      headDy: armor.headDy,
      weapon: null,
      pal: { ...BASE, ...armor.pal },
    },
    poses: PLAYER_POSES,
  };
}

// ------------------------------------------------------------------ enemies
const ENEMY_STRIKES = (s) => ({
  wind: { lean: -1, a: -130, r: 2, fx: 2, bx: -3, ba: 60 },
  strike: { lean: 2, a: 20, r: 5, fx: 4 * s, bx: -4 * s, ba: 150 },
  rec: { lean: 1, a: 70, r: 4, fx: 3 * s, bx: -3 * s, ba: 130 },
  wind2: { lean: 0, a: 150, r: 3, fx: 2, bx: -3, ba: 60 },
  strike2: { lean: 2, a: -30, r: 5, fx: 4 * s, bx: -4 * s, ba: 160 },
  hurt: { lean: -2, a: -30, r: 2, bx: -3, ba: 200 },
  dead: { kind: 'dead' },
});

export const HOLLOW_SHEET = {
  key: 'hollow',
  fw: 48,
  fh: 32,
  def: {
    rig: { legLen: 8, legW: 2, torsoW: 7, torsoH: 8, armW: 2, armLen: 5 },
    head: HEADS.hollow,
    legs: { back: '#4e4436', front: '#6e6250', lit: '#8c7e68' },
    torso: 'rags',
    weapon: WEAPONS.rusty,
    bareHands: true,
    headDy: 0,
    pal: {
      ...BASE,
      D: '#2e2620', M: '#4a3e32', L: '#655546', H: '#7a6a58',
      k: '#2e261c', c: '#54442f', C: '#6e5a40',
      z: '#6a5c48', s: '#9a8a70', S: '#bcac8c', h: '#2a2420',
      x: '#4a3020', b: '#7a5a40', B: '#a08060', W: '#c0a080',
      n: '#2a1c12', N: '#4a3422', e: '#ff4a30',
    },
  },
  poses: {
    idle0: { lean: 1, by: 1, a: 80, r: 2, ba: 95 },
    idle1: { lean: 1, by: 2, a: 82, r: 2, ba: 97 },
    ...walk(1.5, 75, { lean: 1, r: 2 }),
    ...ENEMY_STRIKES(1),
  },
};

export const KNIGHT_SHEET = {
  key: 'knight',
  fw: 64,
  fh: 48,
  def: {
    rig: { legLen: 11, legW: 4, torsoW: 12, torsoH: 11, armW: 3, armLen: 7, taper: 2 },
    head: HEADS.bruteHelm,
    torso: 'plate',
    pauldron: PAULDRONS.brute,
    kneePad: true,
    cape: { w: 6 },
    weapon: WEAPONS.knightSword,
    pal: {
      ...BASE,
      D: '#262a35', M: '#3e4454', L: '#5d6578', H: '#8890a4',
      k: '#151c16', c: '#26331f', C: '#3a4a30',
      r: '#5a1a1a', R: '#9a2a2a',
      x: '#4a5060', b: '#9aa0ac', B: '#d0d4dc',
    },
  },
  poses: {
    idle0: { a: 65, r: 4, ba: 100 },
    idle1: { a: 67, r: 4, by: 1, ba: 102 },
    ...walk(2.5, 60, { r: 4 }),
    ...ENEMY_STRIKES(1.5),
    wind: { lean: -2, a: -150, r: 4, by: 1, fx: 3, bx: -4, ba: 50 },
    strike: { lean: 3, a: 40, r: 6, by: 2, fx: 6, bx: -6, cape: 3, ba: 160 },
  },
};

export const WARDEN_SHEET = {
  key: 'warden',
  fw: 128,
  fh: 96,
  def: {
    rig: { legLen: 20, legW: 5, torsoW: 22, torsoH: 20, armW: 5, armLen: 12, taper: 4 },
    legs: { back: '#2a221c', front: '#4a3c30', lit: '#6e5a46' },
    head: HEADS.wardenHelm,
    headDy: 2,
    torso: 'warden',
    pauldron: PAULDRONS.warden,
    kneePad: true,
    cape: { w: 9 },
    weapon: WEAPONS.greatsword,
    pal: {
      ...BASE,
      D: '#3a2e24', M: '#5a4a3a', L: '#8f7a5c', H: '#b8a07a',
      k: '#221f26', c: '#3a3540', C: '#545060',
      e: '#ffa030', f: '#c04010', F: '#ffb040',
      x: '#6a6050', b: '#b9ad90', B: '#e0d6bc', W: '#fff1c4',
    },
  },
  poses: {
    idle0: { a: 70, r: 6, cape: 1, ba: 100 },
    idle1: { a: 72, r: 6, by: 1, cape: 2, ba: 102 },
    ...walk(4, 65, { r: 6, cape: 2 }),
    slamW: { lean: -4, a: -170, r: 6, by: 2, fx: 5, bx: -6, cape: 0, ba: 40 },
    slamS: { lean: 6, a: 75, r: 9, by: 5, fx: 9, bx: -9, cape: 4, ba: 170 },
    slamR: { lean: 4, a: 88, r: 8, by: 4, fx: 8, bx: -8, cape: 3, ba: 150 },
    sweepW: { lean: -3, a: -120, r: 6, by: 2, fx: 5, bx: -7, cape: 1, ba: 60 },
    sweepS: { lean: 5, a: 15, r: 10, by: 3, fx: 9, bx: -9, cape: 4, ba: 170 },
    sweep2W: { lean: 0, a: 150, r: 7, by: 2, fx: 6, bx: -7, cape: 2, ba: 60 },
    sweep2S: { lean: 5, a: -25, r: 10, by: 3, fx: 9, bx: -9, cape: 4, ba: 170 },
    sweepR: { lean: 3, a: 40, r: 8, by: 2, fx: 7, bx: -7, ba: 140 },
    crouch: { lean: 2, a: 120, r: 5, by: 7, fx: 6, bx: -7, cape: 0, ba: 80 },
    air: { lean: 1, a: -140, r: 6, fx: 5, fl: 6, bx: -6, bl: 3, cape: 4, ba: 200 },
    hurt: { lean: -4, a: -50, r: 4, bx: -6, by: 3, ba: 210 },
    dead: { kind: 'dead' },
  },
};

// ------------------------------------------------------------------ Fas 3: new enemies + NPCs

/** Ghoul: fast, crouched crawler that lunges with its claws (no weapon). */
export const GHOUL_SHEET = {
  key: 'ghoul',
  fw: 48,
  fh: 32,
  def: {
    rig: { legLen: 7, legW: 2, torsoW: 8, torsoH: 7, armW: 2, armLen: 6 },
    head: HEADS.ghoul,
    headDy: 0,
    torso: 'skin',
    weapon: null,
    bareHands: true,
    legs: { back: '#4a5048', front: '#6a7268', lit: '#8a948a' },
    pal: {
      ...BASE,
      z: '#4a5048', s: '#7a8478', S: '#a4ae9e', v: '#1a0c10', e: '#e8f060',
      k: '#20241e', c: '#2e342a', C: '#3e4638',
    },
  },
  poses: {
    idle0: { lean: 3, by: 3, a: 70, r: 4, ba: 80 },
    idle1: { lean: 3, by: 4, a: 72, r: 4, ba: 82 },
    walk0: { lean: 4, by: 3, fx: 4, bx: -4, a: 40, r: 5, ba: 130 },
    walk1: { lean: 4, by: 2, fx: 2, fl: 1, bx: -2, a: 60, r: 5, ba: 100 },
    walk2: { lean: 4, by: 3, fx: -3, bx: 3, a: 80, r: 5, ba: 60 },
    walk3: { lean: 4, by: 2, fx: -1, bx: 1, bl: 1, a: 60, r: 5, ba: 100 },
    wind: { lean: -1, by: 5, fx: 3, bx: -4, a: -150, r: 4, ba: 200 },
    strike: { lean: 5, by: 1, fx: 6, bx: -6, a: 0, r: 7, ba: 20 },
    rec: { lean: 4, by: 3, fx: 4, bx: -4, a: 40, r: 5, ba: 100 },
    wind2: { lean: 2, by: 4, fx: 3, bx: -3, a: -100, r: 4, ba: 160 },
    strike2: { lean: 4, by: 3, fx: 4, bx: -4, a: 50, r: 6, ba: 40 },
    hurt: { lean: -2, by: 2, a: -60, r: 3, bx: -3, ba: 220 },
    dead: { kind: 'dead' },
  },
};

/** Skeleton archer: keeps its distance and shoots arcing arrows. */
export const ARCHER_SHEET = {
  key: 'archer',
  fw: 48,
  fh: 32,
  def: {
    rig: { legLen: 8, legW: 2, torsoW: 7, torsoH: 8, armW: 1, armLen: 5 },
    head: HEADS.skull,
    headDy: 0,
    torso: 'bones',
    weapon: BOW,
    bareHands: true,
    legs: { back: '#8a7e66', front: '#b8ac90', lit: '#e8dcc0' },
    pal: {
      ...BASE,
      M: '#b8ac90', L: '#e8dcc0', D: '#8a7e66', s: '#d8ccb0', z: '#8a7e66',
      v: '#100810', e: '#60c0ff', n: '#3a2a1c', N: '#6b4a2f',
    },
  },
  poses: {
    idle0: { a: 70, r: 3, ba: 100 },
    idle1: { a: 72, r: 3, by: 1, ba: 102 },
    ...walk(1.5, 65, { r: 3 }),
    wind: { a: 0, r: 5, ba: 180, fx: 3, bx: -3, lean: -1 }, // drawing the string
    strike: { a: -5, r: 5, ba: 150, fx: 3, bx: -3 }, // release
    rec: { a: 30, r: 4, ba: 120, fx: 2, bx: -2 },
    wind2: { a: 120, r: 2, ba: 60, lean: -1, fx: 2, bx: -3 }, // shove
    strike2: { a: 10, r: 6, ba: 160, lean: 3, fx: 5, bx: -5 },
    hurt: { lean: -2, a: -40, r: 2, bx: -3, ba: 210 },
    dead: { kind: 'dead' },
  },
};

const NPC_POSES = (a, extra = {}) => ({
  idle0: { a, r: 3, ba: 100, ...extra },
  idle1: { a: a + 2, r: 3, by: 1, ba: 102, ...extra },
  talk: { a: a - 30, r: 4, ba: 60, lean: 1, ...extra },
});

/** Hessa, the ash-merchant: hunched, hooded, lantern staff. */
export const MERCHANT_SHEET = {
  key: 'npc-merchant',
  fw: 48,
  fh: 32,
  def: {
    rig: { legLen: 6, legW: 3, torsoW: 9, torsoH: 9, armW: 2, armLen: 4 },
    head: HEADS.hood,
    torso: 'cloth',
    cape: { w: 5 },
    weapon: STAFF,
    legs: { back: '#2a2228', front: '#3e3440', lit: '#524658' },
    pal: { ...BASE, k: '#2a2440', c: '#40385c', C: '#5a507a', s: '#b08a70', S: '#d0a888' },
  },
  poses: NPC_POSES(-80, { lean: 2, by: 1 }),
};

/** Ser Corvin: a weary knight resting in the catacombs. */
export const CORVIN_SHEET = {
  key: 'npc-corvin',
  fw: 48,
  fh: 32,
  def: {
    rig: { legLen: 8, legW: 3, torsoW: 8, torsoH: 8, armW: 2, armLen: 5, taper: 1 },
    head: HEADS.knightHelm,
    torso: 'plate',
    pauldron: PAULDRONS.small,
    kneePad: true,
    cape: { w: 4 },
    weapon: WEAPONS.longsword,
    pal: {
      ...BASE,
      D: '#4a3a24', M: '#7a6034', L: '#a88a50', H: '#d8bc7c',
      k: '#1c2440', c: '#2a3866', C: '#3e5090', r: '#1c2440', R: '#3e5090',
    },
  },
  poses: NPC_POSES(95, { by: 2 }),
};

/** The Bone Shepherd: tall robed necromancer with a great bone scythe (catacombs boss). */
export const SHEPHERD_SHEET = {
  key: 'shepherd',
  fw: 96,
  fh: 80,
  def: {
    rig: { legLen: 18, legW: 3, torsoW: 14, torsoH: 20, armW: 3, armLen: 10, taper: -2 },
    head: HEADS.shepherd,
    headDy: 1,
    torso: 'cloth',
    cape: { w: 8 },
    weapon: WEAPONS.shepherdScythe,
    bareHands: true,
    legs: { back: '#6e6656', front: '#a89e86', lit: '#d8ccb0' },
    pal: {
      ...BASE,
      k: '#2a2238', c: '#4a3c64', C: '#6c5c8e', n: '#2a1c14', N: '#4a3424', g: '#6a5a40',
      u: '#b4a890', U: '#ece2c8', x: '#7a705c', s: '#d8ccb0', z: '#8a7e66', v: '#08060c', e: '#9ef0ff',
    },
  },
  poses: {
    idle0: { a: 80, r: 5, cape: 1, ba: 100 },
    idle1: { a: 82, r: 5, by: 1, cape: 2, ba: 102 },
    ...walk(3, 75, { r: 5, cape: 2 }),
    sweepW: { lean: -3, a: -150, r: 6, by: 2, fx: 4, bx: -6, cape: 0, ba: 40 },
    sweepS: { lean: 5, a: 20, r: 9, by: 3, fx: 7, bx: -7, cape: 4, ba: 170 },
    sweepR: { lean: 3, a: 60, r: 7, by: 2, fx: 5, bx: -5, cape: 3, ba: 140 },
    sweep2W: { lean: 0, a: 150, r: 6, by: 2, fx: 4, bx: -6, cape: 1, ba: 60 },
    sweep2S: { lean: 5, a: -30, r: 9, by: 3, fx: 7, bx: -7, cape: 4, ba: 170 },
    raise: { lean: -2, a: -90, r: 9, by: -1, fx: 2, bx: -3, cape: 3, ba: -110 },
    sink: { lean: 3, a: 100, r: 4, by: 12, fx: 6, bx: -6, cape: 0, ba: 60 },
    hurt: { lean: -4, a: -50, r: 4, bx: -6, by: 3, ba: 210 },
    dead: { kind: 'dead' },
  },
};

// ------------------------------------------------------------------ The Molten Depths

/**
 * Lava slime: not a rigged humanoid – drawn directly. A blob that squashes and stretches,
 * dark crust over a glowing core. Pose: sx/sy squash, lean (x shift of the top), mouth (open 0..1).
 */
export function drawSlime(cv, pose, fx, fy, fw, fh) {
  const pal = { crust: '#3a160c', body: '#c8401a', bright: '#ff8a2a', core: '#ffd27a', eye: '#1a0806' };
  const cx = fx + fw / 2;
  const base = fy + fh - 1;
  if (pose.kind === 'dead') {
    // a cooling puddle
    for (let x = -9; x <= 9; x++) {
      const h = Math.max(1, Math.round(3 - Math.abs(x) / 4));
      cv.rect(cx + x, base - h + 1, 1, h, Math.abs(x) > 6 ? pal.crust : x % 3 ? pal.body : pal.bright);
    }
    return;
  }
  const rx = 8 * (pose.sx ?? 1);
  const ry = 7 * (pose.sy ?? 1);
  const lean = pose.lean ?? 0;
  const cy = base - ry + (pose.lift ? -pose.lift : 0);
  for (let y = -ry; y <= ry; y++) {
    const t = (y + ry) / (2 * ry); // 0 top .. 1 bottom
    const half = Math.sqrt(Math.max(0, 1 - (y / ry) * (y / ry))) * rx * (y > 0 ? 1.08 : 1);
    const shift = lean * (1 - t);
    for (let x = -Math.round(half); x <= Math.round(half); x++) {
      const edge = Math.abs(x) >= Math.round(half) - 1 || y === -Math.round(ry);
      const inner = Math.hypot(x / rx, (y + ry * 0.15) / ry);
      let col = pal.body;
      if (edge) col = pal.crust;
      else if (inner < 0.35) col = pal.core;
      else if (inner < 0.6) col = pal.bright;
      if (!edge && (x * 5 + y * 3) % 13 === 0) col = pal.crust; // cooling crust flecks
      cv.px(cx + x + shift, cy + y, col);
    }
  }
  // eyes + mouth on the facing (right) side
  const ex = cx + rx * 0.35 + lean * 0.6;
  const ey = cy - ry * 0.25;
  cv.rect(ex, ey, 2, 2, pal.eye);
  cv.rect(ex - 4, ey, 2, 2, pal.eye);
  if (pose.mouth) cv.rect(ex - 3, ey + 3, 4, Math.max(1, Math.round(pose.mouth * 3)), pal.eye);
}

export const SLIME_SHEET = {
  key: 'slime',
  fw: 48,
  fh: 32,
  draw: drawSlime,
  outline: '#110806',
  poses: {
    idle0: { sx: 1, sy: 1 },
    idle1: { sx: 1.06, sy: 0.94 },
    walk0: { sx: 1.15, sy: 0.82 },
    walk1: { sx: 0.88, sy: 1.15, lift: 4, lean: 2 },
    walk2: { sx: 0.92, sy: 1.08, lift: 2, lean: 1 },
    walk3: { sx: 1.2, sy: 0.78 },
    wind: { sx: 1.25, sy: 0.72, lean: -2 }, // gathering to spit
    strike: { sx: 0.9, sy: 1.12, lean: 3, mouth: 1 },
    rec: { sx: 1.05, sy: 0.95, mouth: 0.4 },
    wind2: { sx: 1.3, sy: 0.65, lean: -1 }, // crouch before the pounce
    strike2: { sx: 0.8, sy: 1.25, lean: 4, lift: 6, mouth: 0.6 },
    hurt: { sx: 1.25, sy: 0.75, lean: -3 },
    dead: { kind: 'dead' },
  },
};

/** The Molten Colossus – a hulking rock-and-magma golem with stone fists. */
export const COLOSSUS_SHEET = {
  key: 'colossus',
  fw: 128,
  fh: 112,
  def: {
    rig: { legLen: 22, legW: 9, torsoW: 32, torsoH: 28, armW: 8, armLen: 20, taper: 6 },
    head: HEADS.golem,
    headDy: 3,
    torso: 'magma',
    weapon: null,
    bareHands: true,
    kneePad: false,
    legs: { back: '#1e1612', front: '#3a2c24', lit: '#5a4636' },
    pal: {
      ...BASE,
      D: '#2a1e1a', M: '#4a3a30', L: '#6a5446', H: '#8a705c',
      f: '#d04010', F: '#ffb040', e: '#ffe08a',
      s: '#5a4636', z: '#2a1e1a', n: '#1e1612', N: '#3a2c24',
    },
  },
  poses: {
    idle0: { a: 95, r: 18, ba: 95, by: 1 },
    idle1: { a: 97, r: 18, ba: 97, by: 2 },
    ...walk(3, 90, { r: 18, ba: 95 }),
    spitW: { lean: -4, a: 60, r: 14, ba: 120, by: 2, fx: 4, bx: -5 },
    spitS: { lean: 5, a: 40, r: 18, ba: 70, by: 1, fx: 6, bx: -6 },
    waveW: { lean: -2, a: -105, r: 20, ba: -115, by: -2, fx: 4, bx: -5 },
    waveS: { lean: 5, a: 80, r: 20, ba: 80, by: 9, fx: 7, bx: -7 },
    rec: { lean: 5, a: 100, r: 16, ba: 110, by: 7, fx: 5, bx: -5 },
    hurt: { lean: -4, a: 120, r: 14, ba: 140, by: 3, bx: -6 },
    dead: { kind: 'dead' },
  },
};

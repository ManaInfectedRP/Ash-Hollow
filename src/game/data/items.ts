export type ItemKind = 'weapon' | 'shield' | 'armor' | 'consumable' | 'material';
export type IconKey =
  | 'sword' | 'axe' | 'rapier' | 'fist' | 'garb' | 'plate' | 'rags'
  | 'bread' | 'herb' | 'soul' | 'shard' | 'flaskShard';

export interface ArmorDef {
  /** fraction of incoming damage removed */
  defense: number;
  /** poise points: hits are absorbed until this is broken */
  poise: number;
  weight: number;
  /** fraction of fire damage (lava globs, waves) removed */
  fireRes?: number;
  /** fraction of frost build-up removed */
  frostRes?: number;
  /** fraction of poison build-up removed */
  poisonRes?: number;
  /** you ride a little cloud: slow falls (and a puff of cloud under your feet) */
  float?: boolean;
}

export interface ShieldDef {
  /** fraction of a blocked hit's damage that is stopped */
  absorb: number;
  /** 0..1 – higher means each blocked hit costs less stamina */
  stability: number;
  weight: number;
  /** fraction of a blocked FIRE hit that is stopped (defaults to absorb) */
  fireAbsorb?: number;
}

export interface UseEffect {
  heal?: number;
  /** heal over time */
  regen?: { amount: number; duration: number };
  souls?: number;
  maxFlasks?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  icon: IconKey;
  desc: string;
  /** weapon id in WEAPONS */
  weapon?: string;
  armor?: ArmorDef;
  shield?: ShieldDef;
  use?: UseEffect;
}

export const NAKED: ArmorDef = {
  defense: 0,
  poise: 0,
  weight: 0,
};

export const ITEMS: Record<string, ItemDef> = {
  longsword: {
    id: 'longsword', name: 'Longsword', kind: 'weapon', icon: 'sword', weapon: 'longsword',
    desc: 'Two-handed: no shield, but every cut lands harder and reaches further. Blocks with the blade. Scales with strength and dexterity.',
  },
  shortsword: {
    id: 'shortsword', name: 'Shortsword', kind: 'weapon', icon: 'sword', weapon: 'shortsword',
    desc: 'One-handed, for use with a shield. Quick, light cuts. Scales with dexterity and strength.',
  },
  twin_daggers: {
    id: 'twin_daggers', name: 'Twin Daggers', kind: 'weapon', icon: 'rapier', weapon: 'twin_daggers',
    desc: 'A blade in each hand. Lightning stabs left and right; the heavy drives both in at once. Parries with the off-hand blade, but blocks poorly. Scales with dexterity.',
  },
  flame_longsword: {
    id: 'flame_longsword', name: 'Flame Longsword', kind: 'weapon', icon: 'sword', weapon: 'flame_longsword',
    desc: 'Two-handed. The blade never cools: every hit adds fire damage and sets the foe burning.',
  },
  frost_longsword: {
    id: 'frost_longsword', name: 'Frost Longsword', kind: 'weapon', icon: 'sword', weapon: 'frost_longsword',
    desc: 'Two-handed. Rimed steel: hits build up frost until it bursts into frostbite – heavy damage and a long slow.',
  },
  venom_longsword: {
    id: 'venom_longsword', name: 'Venom Longsword', kind: 'weapon', icon: 'sword', weapon: 'venom_longsword',
    desc: 'Two-handed. The fuller weeps poison: hits build up until the foe is poisoned and wastes away.',
  },
  flame_shortsword: {
    id: 'flame_shortsword', name: 'Flame Shortsword', kind: 'weapon', icon: 'sword', weapon: 'flame_shortsword',
    desc: 'One-handed. Quick cuts that add fire damage and set the foe burning.',
  },
  frost_shortsword: {
    id: 'frost_shortsword', name: 'Frost Shortsword', kind: 'weapon', icon: 'sword', weapon: 'frost_shortsword',
    desc: 'One-handed. Quick cuts that build up frost until it bursts into frostbite.',
  },
  flame_greataxe: {
    id: 'flame_greataxe', name: 'Flame Greataxe', kind: 'weapon', icon: 'axe', weapon: 'flame_greataxe',
    desc: 'A molten edge on a crushing weight: big fire damage on every swing, and the foe keeps burning.',
  },
  frost_greataxe: {
    id: 'frost_greataxe', name: 'Frost Greataxe', kind: 'weapon', icon: 'axe', weapon: 'frost_greataxe',
    desc: 'Each swing packs in so much frost that two or three hits bring on frostbite.',
  },
  venom_rapier: {
    id: 'venom_rapier', name: 'Venom Rapier', kind: 'weapon', icon: 'rapier', weapon: 'venom_rapier',
    desc: 'A needle dipped in venom. Its quick thrusts poison a foe in no time.',
  },
  greataxe: {
    id: 'greataxe', name: 'Greataxe', kind: 'weapon', icon: 'axe', weapon: 'greataxe',
    desc: 'Crushing weight. Every swing carries hyperarmor and breaks poise. Scales with strength.',
  },
  rapier: {
    id: 'rapier', name: 'Rapier', kind: 'weapon', icon: 'rapier', weapon: 'rapier',
    desc: 'Swift thrusts with long reach. Little poise damage. Scales with dexterity.',
  },
  bone_scythe: {
    id: 'bone_scythe', name: "Shepherd's Scythe", kind: 'weapon', icon: 'axe', weapon: 'bone_scythe',
    desc: 'Taken from the Bone Shepherd. Wide arcs reach enemies beside and just behind you. Scales with dexterity.',
  },
  wooden_shield: {
    id: 'wooden_shield', name: 'Wooden Round Shield', kind: 'shield', icon: 'garb',
    desc: 'Planks and an iron boss. Blocks most of a blow, but each hit drains a lot of stamina. Tap to parry, hold to block.',
    shield: { absorb: 0.65, stability: 0.4, weight: 3 },
  },
  kite_shield: {
    id: 'kite_shield', name: 'Kite Shield', kind: 'shield', icon: 'plate',
    desc: 'A knightly steel shield. Stops a blow completely and holds steady under heavy hits.',
    shield: { absorb: 1, stability: 0.65, weight: 7 },
  },
  buckler: {
    id: 'buckler', name: 'Buckler', kind: 'shield', icon: 'plate',
    desc: 'A fist-sized steel disc. Barely blocks, weighs nothing – made for parrying.',
    shield: { absorb: 0.45, stability: 0.25, weight: 1 },
  },
  tower_shield: {
    id: 'tower_shield', name: 'Tower Shield', kind: 'shield', icon: 'plate',
    desc: 'A wall of banded oak. Stops everything and hardly budges, but it is very heavy.',
    shield: { absorb: 1, stability: 0.9, weight: 14 },
  },
  obsidian_shield: {
    id: 'obsidian_shield', name: 'Obsidian Shield', kind: 'shield', icon: 'plate',
    desc: 'Volcanic glass from the Molten Depths. Blocks most of a blow – and all of a lava glob.',
    shield: { absorb: 0.85, stability: 0.55, weight: 6, fireAbsorb: 1 },
  },
  garb: {
    id: 'garb', name: "Wanderer's Garb", kind: 'armor', icon: 'garb',
    desc: 'Worn leather and a hood. Light enough to roll freely.',
    armor: {
      defense: 0.06, poise: 0, weight: 4,
    },
  },
  knight_armor: {
    id: 'knight_armor', name: 'Fallen Knight Set', kind: 'armor', icon: 'plate',
    desc: 'Heavy plate from a knight who never left the hollow. Great defense and poise, but heavy.',
    armor: {
      defense: 0.26, poise: 32, weight: 18,
    },
  },
  hunter_leathers: {
    id: 'hunter_leathers', name: "Hunter's Leathers", kind: 'armor', icon: 'garb',
    desc: 'Boiled leather and a green cloak. Real protection that still lets you roll quickly.',
    armor: {
      defense: 0.13, poise: 10, weight: 8,
    },
  },
  ember_robes: {
    id: 'ember_robes', name: 'Ember Robes', kind: 'armor', icon: 'garb',
    desc: 'Robes of a pyromancer who went too deep. Thin, but they shrug off fire: 45% less damage from lava globs and waves.',
    armor: {
      defense: 0.08, poise: 4, weight: 5, fireRes: 0.45,
    },
  },
  warden_plate: {
    id: 'warden_plate', name: "Warden's Plate", kind: 'armor', icon: 'plate',
    desc: "Blackened plate cut from the Ashen Warden's own. The best protection there is, and the heaviest.",
    armor: {
      defense: 0.32, poise: 48, weight: 24, fireRes: 0.15,
    },
  },
  sand_scepter: {
    id: 'sand_scepter', name: 'Sand Scepter', kind: 'weapon', icon: 'axe', weapon: 'sand_scepter',
    desc: "Taken from the Sandstone Sphinx. A one-handed mace of carved sandstone with a green-lit gem. Slow, but every blow breaks poise. Scales with strength.",
  },
  gladiator_blades: {
    id: 'gladiator_blades', name: "Gladiator's Blades", kind: 'weapon', icon: 'sword', weapon: 'gladiator_blades',
    desc: "Varro's twin gladii. A blade in each hand: quick cuts with real weight behind them; the heavy drives both in at once.",
  },
  mummy_wraps: {
    id: 'mummy_wraps', name: 'Mummy Wraps', kind: 'armor', icon: 'rags',
    desc: "Embalmed linen from the Sphinx's tomb. Light; poison barely takes hold (−50%), but it burns easily (+20% fire damage).",
    armor: {
      defense: 0.1, poise: 6, weight: 5, poisonRes: 0.5, fireRes: -0.2,
    },
  },
  legion_plate: {
    id: 'legion_plate', name: 'Legion Plate', kind: 'armor', icon: 'plate',
    desc: 'Bronze lorica and a crested galea of the lost legion, worn by Varro. Heavy defense and great poise.',
    armor: {
      defense: 0.3, poise: 44, weight: 21, fireRes: 0.1,
    },
  },
  cloudbreaker: {
    id: 'cloudbreaker', name: 'Cloudbreaker', kind: 'weapon', icon: 'axe', weapon: 'cloudbreaker',
    desc: 'Taken from the Sky Leviathan. A two-handed maul of whalebone and storm-iron. Slow, but nothing keeps its footing under it. Scales with strength.',
  },
  whale_scale: {
    id: 'whale_scale', name: 'Whale Scale', kind: 'armor', icon: 'plate',
    desc: "Plates cut from the Sky Leviathan's hide, cold as the high air. Solid protection, and frost builds slowly (−30%).",
    armor: {
      defense: 0.22, poise: 26, weight: 12, frostRes: 0.3,
    },
  },
  white_cloak: {
    id: 'white_cloak', name: 'White Cloak', kind: 'armor', icon: 'garb',
    desc: 'Woven from the cloud the Leviathan swam through. Barely any protection – but a little cloud rides under your feet and every fall becomes a slow drift.',
    armor: {
      defense: 0.07, poise: 0, weight: 3, float: true,
    },
  },
  bridal_knife: {
    id: 'bridal_knife', name: 'Bridal Knife', kind: 'weapon', icon: 'rapier', weapon: 'bridal_knife',
    desc: "Ayame's wedding knife, never cleaned. One-handed: lightning-quick stabs and a darting heavy lunge. Scales with dexterity.",
  },
  white_kimono: {
    id: 'white_kimono', name: 'White Kimono', kind: 'armor', icon: 'garb',
    desc: 'The burial kimono of the Weeping Bride. Light as mist; cold and poison find it hard to take hold (−25%).',
    armor: {
      defense: 0.1, poise: 4, weight: 4, frostRes: 0.25, poisonRes: 0.25,
    },
  },
  ashen_greatsword: {
    id: 'ashen_greatsword', name: 'Ashen Greatsword', kind: 'weapon', icon: 'sword', weapon: 'ashen_greatsword',
    desc: "The Ashen King's greatsword, still smouldering. Two-handed and heavy: every cut adds fire and sets the foe burning. Scales with strength.",
  },
  ashen_regalia: {
    id: 'ashen_regalia', name: 'Ashen Regalia', kind: 'armor', icon: 'plate',
    desc: "The king's ash-grey plate and iron crown. Heavy; the powers he stole still cling to it – fire, frost and poison all bite less.",
    armor: {
      defense: 0.3, poise: 40, weight: 20, fireRes: 0.3, frostRes: 0.25, poisonRes: 0.25,
    },
  },
  frostbound_mantle: {
    id: 'frostbound_mantle', name: 'Frostbound Mantle', kind: 'armor', icon: 'garb',
    desc: 'Grey wool and rimed mail of the cloister monks. Frost builds up on you far more slowly (−60%).',
    armor: {
      defense: 0.15, poise: 14, weight: 10, frostRes: 0.6,
    },
  },
  mire_leathers: {
    id: 'mire_leathers', name: "Mire Mother's Hide", kind: 'armor', icon: 'garb',
    desc: 'Tanned from the Mire Mother herself. It reeks, but poison barely takes hold (−65%).',
    armor: {
      defense: 0.12, poise: 8, weight: 7, poisonRes: 0.65,
    },
  },
  frost_spear: {
    id: 'frost_spear', name: "Matriarch's Spear", kind: 'weapon', icon: 'rapier', weapon: 'frost_spear',
    desc: 'Taken from the Frost Matriarch. Two-handed: long, quick thrusts that build up frost, and a charging lunge.',
  },
  bread: {
    id: 'bread', name: 'Stale Bread', kind: 'consumable', icon: 'bread',
    desc: 'Hard as stone, but filling. Slowly restores 70 HP over 6 seconds.',
    use: { regen: { amount: 70, duration: 6 } },
  },
  ember_herb: {
    id: 'ember_herb', name: 'Ember Herb', kind: 'consumable', icon: 'herb',
    desc: 'A bitter leaf that still smoulders. Instantly restores 60 HP.',
    use: { heal: 60 },
  },
  soul_lost_knight: {
    id: 'soul_lost_knight', name: 'Soul of a Lost Knight', kind: 'consumable', icon: 'soul',
    desc: 'Use to gain 400 souls.',
    use: { souls: 400 },
  },
  soul_nameless: {
    id: 'soul_nameless', name: 'Soul of a Nameless Soldier', kind: 'consumable', icon: 'soul',
    desc: 'Use to gain 800 souls.',
    use: { souls: 800 },
  },
  flask_shard: {
    id: 'flask_shard', name: 'Ashen Flask Shard', kind: 'consumable', icon: 'flaskShard',
    desc: 'A warm shard of the first flask. Use to permanently gain one flask charge.',
    use: { maxFlasks: 1 },
  },
  titanite: {
    id: 'titanite', name: 'Titanite Shard', kind: 'material', icon: 'shard',
    desc: 'Used to reinforce weapons at a bonfire.',
  },
};

export const MAX_UPGRADE = 5;
export const upgradeCost = (lvl: number) => ({ shards: lvl + 1, souls: 250 * (lvl + 1) });

import { ITEMS, NAKED, type ArmorDef, type ShieldDef } from '../data/items';
import { WEAPONS, type Element, type Weapon } from './attacks';
import { maxLoadFor, usePlayerStore, type Stats } from '../../stores/playerStore';
import { useInventoryStore, type Equipped } from '../../stores/inventoryStore';

export type RollClass = 'light' | 'medium' | 'heavy';

export interface EquipStats {
  weapon: Weapon;
  weaponItem: string | null;
  armor: ArmorDef;
  /** what blocks: the equipped shield, or the weapon's own guard when it holds the off hand */
  shield: ShieldDef | null;
  /** equipped shield item (null while a two-handed / dual weapon holds the off hand) */
  shieldItem: string | null;
  hands: 1 | 2 | 'dual';
  element: { type: Element; power: number } | null;
  /** fraction of fire damage removed by the armor */
  fireRes: number;
  /** fraction of frost / poison build-up removed by the armor */
  frostRes: number;
  poisonRes: number;
  /** slow falls on a little cloud (White Cloak) */
  float: boolean;
  upgrade: number;
  dmgMul: number;
  /** attack rating shown in menus (first light attack) */
  ar: number;
  defense: number;
  poise: number;
  load: number;
  maxLoad: number;
  roll: RollClass;
}

/** Pure: usable from React (with hook values) and Phaser (with getState()). */
export function computeEquip(stats: Stats, equipped: Equipped, upgrades: Record<string, number>): EquipStats {
  const wItem = equipped.weapon ? ITEMS[equipped.weapon] : null;
  const weapon = WEAPONS[wItem?.weapon ?? 'fists'] ?? WEAPONS.fists;
  const armor = (equipped.armor && ITEMS[equipped.armor]?.armor) || NAKED;
  // a two-handed or dual weapon takes the off hand: the shield stays on your back (no weight, no block)
  const hands = weapon.hands ?? 1;
  const shieldItem = hands === 1 ? equipped.shield ?? null : null;
  const shield: ShieldDef | null =
    hands === 1 ? (shieldItem && ITEMS[shieldItem]?.shield) || null : weapon.guard ? { ...weapon.guard, weight: 0 } : null;
  const upgrade = equipped.weapon ? upgrades[equipped.weapon] ?? 0 : 0;
  const dmgMul =
    1 +
    weapon.scaling.str * (stats.strength - 10) * 0.05 +
    weapon.scaling.dex * (stats.dexterity - 10) * 0.05 +
    upgrade * 0.1;
  const load = weapon.weight + armor.weight + (shield?.weight ?? 0);
  const maxLoad = maxLoadFor(stats);
  const ratio = load / maxLoad;
  return {
    weapon,
    weaponItem: equipped.weapon,
    armor,
    shield,
    shieldItem,
    hands,
    element: weapon.element ?? null,
    fireRes: armor.fireRes ?? 0,
    frostRes: armor.frostRes ?? 0,
    poisonRes: armor.poisonRes ?? 0,
    float: !!armor.float,
    upgrade,
    dmgMul,
    ar: Math.round(weapon.light[0].damage * dmgMul),
    defense: armor.defense,
    poise: armor.poise,
    load,
    maxLoad,
    roll: ratio <= 0.3 ? 'light' : ratio <= 0.7 ? 'medium' : 'heavy',
  };
}

export function equipStats() {
  const inv = useInventoryStore.getState();
  return computeEquip(usePlayerStore.getState().stats, inv.equipped, inv.upgrades);
}

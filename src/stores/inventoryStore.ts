import { create } from 'zustand';
import { ITEMS, MAX_UPGRADE, upgradeCost } from '../game/data/items';
import { usePlayerStore } from './playerStore';

export type EquipSlot = 'weapon' | 'shield' | 'armor' | 'quick';

export interface Equipped {
  weapon: string | null;
  shield?: string | null;
  armor: string | null;
  quick: string | null;
}

export interface InventoryStore {
  /** item id -> quantity */
  items: Record<string, number>;
  equipped: Equipped;
  /** weapon item id -> reinforcement level */
  upgrades: Record<string, number>;
  add: (id: string, n?: number) => void;
  remove: (id: string, n?: number) => boolean;
  equip: (slot: EquipSlot, id: string | null) => void;
  upgradeWeapon: (id: string) => boolean;
}

export const STARTING_INVENTORY = () => ({
  items: { shortsword: 1, wooden_shield: 1, garb: 1, bread: 2, ember_herb: 1 } as Record<string, number>,
  equipped: { weapon: 'shortsword', shield: 'wooden_shield', armor: 'garb', quick: 'bread' } as Equipped,
  upgrades: {} as Record<string, number>,
});

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  ...STARTING_INVENTORY(),
  add: (id, n = 1) => {
    if (!ITEMS[id]) return;
    const items = { ...get().items, [id]: (get().items[id] ?? 0) + n };
    // auto-assign a quick item if the slot is empty
    const eq = get().equipped;
    const quick = !eq.quick && ITEMS[id].kind === 'consumable' ? id : eq.quick;
    set({ items, equipped: { ...eq, quick } });
  },
  remove: (id, n = 1) => {
    const have = get().items[id] ?? 0;
    if (have < n) return false;
    const items = { ...get().items };
    if (have - n <= 0) delete items[id];
    else items[id] = have - n;
    set({ items });
    return true;
  },
  equip: (slot, id) => {
    if (id && !get().items[id]) return;
    set({ equipped: { ...get().equipped, [slot]: id } });
  },
  upgradeWeapon: (id) => {
    const lvl = get().upgrades[id] ?? 0;
    if (lvl >= MAX_UPGRADE) return false;
    const cost = upgradeCost(lvl);
    const ps = usePlayerStore.getState();
    if (ps.souls < cost.souls || (get().items.titanite ?? 0) < cost.shards) return false;
    get().remove('titanite', cost.shards);
    usePlayerStore.setState({ souls: ps.souls - cost.souls });
    set({ upgrades: { ...get().upgrades, [id]: lvl + 1 } });
    return true;
  },
}));

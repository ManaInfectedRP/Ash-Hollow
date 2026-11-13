import { BASE_STATS, type Stats, usePlayerStore } from '../../stores/playerStore';
import { STARTING_INVENTORY, useInventoryStore, type Equipped } from '../../stores/inventoryStore';

const KEY = 'ashen-hollow-save-v1';

export interface WorldState {
  lit: string[];
  lastBonfire: string | null;
  /** area of the last bonfire (where you respawn) */
  lastArea: string | null;
  bloodstain: { area: string; x: number; y: number; souls: number } | null;
  bossDefeated: boolean;
  items: string[];
  /** story/progress flags: shortcuts, NPC conversations, ... */
  flags: Record<string, boolean>;
}

interface SaveData extends WorldState {
  v: 1;
  souls: number;
  level: number;
  stats: Stats;
  maxFlasks: number;
  inv?: { items: Record<string, number>; equipped: Equipped; upgrades: Record<string, number> };
}

export function freshWorld(): WorldState {
  return { lit: [], lastBonfire: null, lastArea: null, bloodstain: null, bossDefeated: false, items: [], flags: {} };
}

/** Loads progression into the player store and returns the world state. */
export function loadGame(): WorldState {
  try {
    const raw = localStorage.getItem(KEY);
    // always start from a clean character: "Quit to Title → Start Over" must not keep the old run's
    // souls, level, stats or flasks (the stores outlive the scene)
    useInventoryStore.setState(STARTING_INVENTORY());
    usePlayerStore.setState({ souls: 0, level: 1, stats: { ...BASE_STATS }, maxFlasks: 3, flasks: 3 });
    if (!raw) return freshWorld();
    const d = JSON.parse(raw) as SaveData;
    if (d.v !== 1) return freshWorld();
    usePlayerStore.setState({
      souls: d.souls ?? 0,
      level: d.level ?? 1,
      stats: { ...BASE_STATS, ...d.stats },
      maxFlasks: d.maxFlasks ?? 3,
      flasks: d.maxFlasks ?? 3,
    });
    if (d.inv) {
      // saves from before shields existed get the starting shield
      const items = { ...d.inv.items };
      const equipped = { ...d.inv.equipped };
      if (equipped.shield === undefined) {
        items.wooden_shield = items.wooden_shield ?? 1;
        equipped.shield = 'wooden_shield';
      }
      // the longsword became two-handed: older saves also get the one-handed shortsword
      if (!items.shortsword) items.shortsword = 1;
      useInventoryStore.setState({ items, equipped, upgrades: d.inv.upgrades ?? {} });
    }
    // only the world fields – spreading the whole save would later overwrite fresh souls/inventory
    const w = freshWorld();
    return {
      lit: d.lit ?? w.lit,
      lastBonfire: d.lastBonfire ?? w.lastBonfire,
      lastArea: d.lastArea ?? (d.lastBonfire ? 'hollow' : null),
      // older saves had no area on the bloodstain (only the hollow existed)
      bloodstain: d.bloodstain ? { ...d.bloodstain, area: d.bloodstain.area ?? 'hollow' } : w.bloodstain,
      flags: d.flags ?? w.flags,
      bossDefeated: d.bossDefeated ?? w.bossDefeated,
      items: d.items ?? w.items,
    };
  } catch {
    return freshWorld();
  }
}

export function saveGame(world: WorldState) {
  const p = usePlayerStore.getState();
  const data: SaveData = {
    v: 1,
    souls: p.souls,
    level: p.level,
    stats: p.stats,
    maxFlasks: p.maxFlasks,
    inv: (({ items, equipped, upgrades }) => ({ items, equipped, upgrades }))(useInventoryStore.getState()),
    ...world,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable (private mode) – progress just isn't persisted */
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function wipeSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

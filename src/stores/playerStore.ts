import { create } from 'zustand';

export interface Stats {
  vigor: number;
  endurance: number;
  strength: number;
  dexterity: number;
}
export type StatKey = keyof Stats;

export const BASE_STATS: Stats = { vigor: 10, endurance: 10, strength: 10, dexterity: 10 };

export const maxHpFor = (s: Stats) => 200 + (s.vigor - 10) * 20;
export const maxStaminaFor = (s: Stats) => 90 + (s.endurance - 10) * 6;
export const maxLoadFor = (s: Stats) => 40 + (s.endurance - 10) * 2;
export const levelCost = (level: number) => Math.round(80 * Math.pow(1.1, level - 1) + level * 15);

/**
 * Single source of truth for progression (souls, stats, flasks).
 * hp/stamina are simulated inside Phaser (Player) and mirrored here for the HUD.
 */
/** frost / poison build-up on the player (0..100) and whether it has taken hold */
export interface PlayerStatus {
  frost: number;
  poison: number;
  frostbite: boolean;
  poisoned: boolean;
}
export const NO_STATUS: PlayerStatus = { frost: 0, poison: 0, frostbite: false, poisoned: false };

export interface PlayerStore {
  hp: number;
  stamina: number;
  status: PlayerStatus;
  souls: number;
  flasks: number;
  maxFlasks: number;
  level: number;
  stats: Stats;
  addSouls: (n: number) => void;
  levelUp: (stat: StatKey) => boolean;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  hp: maxHpFor(BASE_STATS),
  stamina: maxStaminaFor(BASE_STATS),
  status: NO_STATUS,
  souls: 0,
  flasks: 3,
  maxFlasks: 3,
  level: 1,
  stats: { ...BASE_STATS },
  addSouls: (n) => set({ souls: get().souls + n }),
  levelUp: (stat) => {
    const { souls, level, stats } = get();
    const cost = levelCost(level);
    if (souls < cost) return false;
    set({ souls: souls - cost, level: level + 1, stats: { ...stats, [stat]: stats[stat] + 1 } });
    return true;
  },
}));

export function derived() {
  const s = usePlayerStore.getState().stats;
  return { maxHp: maxHpFor(s), maxStamina: maxStaminaFor(s) };
}

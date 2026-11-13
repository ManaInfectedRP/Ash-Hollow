import { create } from 'zustand';

export type BannerTone = 'gold' | 'red' | 'white';
export interface Banner {
  text: string;
  sub?: string;
  tone: BannerTone;
  id: number;
}

export interface GameStore {
  paused: boolean;
  dead: boolean;
  restOpen: boolean;
  invOpen: boolean;
  /** open conversation: npc id + current node */
  dialogue: { npc: string; node: string } | null;
  /** npc id whose shop is open */
  shop: string | null;
  prompt: string | null;
  boss: { name: string; hp: number; maxHp: number } | null;
  banner: Banner | null;
  toast: { text: string; id: number } | null;
  hurtFlash: number;
  showTouch: boolean;
  /** screen shake on hits (option) */
  shake: boolean;
  /** 'boot' while assets load, 'title' while the main menu is up */
  menu: 'boot' | 'title' | null;
  /** the pre-release ending card (after the Ashen King falls) */
  ending: boolean;
  showBanner: (text: string, tone?: BannerTone, sub?: string) => void;
  showToast: (text: string) => void;
}

let seq = 1;
const SETTINGS_KEY = 'ashen-hollow-settings';
const saved: { showTouch?: boolean; shake?: boolean } = (() => {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
  } catch {
    return {};
  }
})();
const isTouch =
  typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);

export const useGameStore = create<GameStore>((set) => ({
  paused: false,
  dead: false,
  restOpen: false,
  invOpen: false,
  dialogue: null,
  shop: null,
  prompt: null,
  boss: null,
  banner: null,
  toast: null,
  hurtFlash: 0,
  showTouch: saved.showTouch ?? isTouch,
  shake: saved.shake ?? true,
  menu: 'boot',
  ending: false,
  showBanner: (text, tone = 'gold', sub) => set({ banner: { text, tone, sub, id: seq++ } }),
  showToast: (text) => set({ toast: { text, id: seq++ } }),
}));

// persist the player's options
useGameStore.subscribe((s, prev) => {
  if (s.showTouch === prev.showTouch && s.shake === prev.shake) return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showTouch: s.showTouch, shake: s.shake }));
  } catch {
    /* ignore */
  }
});

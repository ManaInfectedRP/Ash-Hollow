export const TILE = 16;
export const GAME_H = 270;

/** Tileset indices (position in the generated 'tiles' texture). -1 = empty. */
export const T = {
  TOP: 0,
  STONE: 1,
  PLANK: 2,
  SPIKE: 3,
  /** molten rock: deadly to touch, lights up the cave */
  LAVA: 4,
  /** frozen stone: solid, but your feet slide on it */
  ICE: 5,
  /** stagnant mire water: you wade through it (slowed) while the poison builds up */
  BOG: 6,
} as const;

export const DEPTH = {
  BG: -10,
  DECOR: 0,
  ITEMS: 4,
  ENEMY: 8,
  PLAYER: 10,
  FX: 20,
  FG: 30,
} as const;

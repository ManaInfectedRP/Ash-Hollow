import { T, TILE } from '../constants';

export type EnemyType =
  | 'hollow' | 'knight' | 'ghoul' | 'archer' | 'slime' | 'wraith' | 'monk' | 'carrier' | 'leech' | 'mummy' | 'legionary'
  | 'wisp' | 'cloudslime' | 'maiden' | 'lantern' | 'faceless' | 'hair';
export type Theme = 'outdoor' | 'crypt' | 'lava' | 'frost' | 'mire' | 'tomb' | 'desert' | 'sky' | 'shrine' | 'ash' | 'keep';

/** A door you interact with to travel to another area (`to`), arriving at door `entry` there. */
export interface DoorDef {
  id: string;
  x: number;
  y: number;
  to: string;
  entry: string;
  /** world flag that must be true to use it (e.g. boss defeated, shortcut opened) */
  requires?: string;
  /** shown when `requires` is not met */
  lockedMsg?: string;
  /** looks sealed (glowing runes) instead of closed while locked */
  sealed?: boolean;
  /** world flag set when this door is used (e.g. unlocking a shortcut from this side) */
  sets?: string;
  /** 'portal': a swirling cloud instead of a door (faint while locked) */
  look?: 'portal';
}

export interface BossArena {
  /** 'warden' | 'shepherd' – see makeBoss */
  type: string;
  x: number;
  y: number;
  /** fog gate x – crossing it starts the fight and closes the gate behind you */
  fogX: number;
  /** world flag set on victory ('bossDefeated' is the Warden's legacy flag) */
  flag: string;
  banner: string;
  sub: string;
}

/**
 * A one-way stone slab that moves back and forth between its start and start + (dx, dy) tiles.
 * The player rides it (and can drop through it); enemies ignore it.
 */
export interface MoverDef {
  x: number;
  y: number;
  /** width in tiles */
  w: number;
  /** travel in px */
  dx: number;
  dy: number;
  /** seconds for a full there-and-back */
  period: number;
  /** 0..1 offset into the cycle */
  phase: number;
}

export interface LevelData {
  id: string;
  name: string;
  theme: Theme;
  cols: number;
  rows: number;
  tiles: number[][];
  spawn: { x: number; y: number };
  bonfires: { id: string; x: number; y: number }[];
  enemies: { type: EnemyType; x: number; y: number }[];
  /** world item pickups (id is the persistent world id, item is the ITEMS id) */
  items: { id: string; x: number; y: number; item: string; qty: number }[];
  /** decorative atlas props; hang = anchored at the top (chains, banners) */
  props: { key: string; x: number; y: number; hang?: boolean; light?: boolean; flip?: boolean }[];
  doors: DoorDef[];
  npcs: { id: string; x: number; y: number }[];
  /** boss arena (optional) */
  boss: BossArena | null;
  movers: MoverDef[];
  /** icicles hanging from a ceiling: they break off when you walk under them (x = centre, y = ceiling) */
  icicles: { x: number; y: number }[];
  /** rotten planks: one-way, give way a moment after you step on them and grow back later */
  crumbles: { x: number; y: number; w: number }[];
}

/** '.' air, '#' rock, '=' plank, '^' spikes, '~' lava, 'i' ice (solid, slippery), '%' bog water, 's' paved stone (never grassy/sandy) */
type Cell = '.' | '#' | '=' | '^' | '~' | 'i' | '%' | 's';

/** Small builder so levels are authored as readable geometry calls instead of giant strings. */
export class Builder {
  g: Cell[][];
  data: Omit<LevelData, 'tiles' | 'cols' | 'rows'>;
  constructor(public cols: number, public rows: number, id: string, name: string, theme: Theme) {
    this.g = Array.from({ length: rows }, () => Array<Cell>(cols).fill('.'));
    this.data = { id, name, theme, spawn: { x: 0, y: 0 }, bonfires: [], enemies: [], items: [], props: [], doors: [], npcs: [], boss: null, movers: [], icicles: [], crumbles: [] };
  }
  fill(x1: number, y1: number, x2: number, y2: number, c: Cell = '#') {
    for (let y = Math.max(0, y1); y <= Math.min(this.rows - 1, y2); y++)
      for (let x = Math.max(0, x1); x <= Math.min(this.cols - 1, x2); x++) this.g[y][x] = c;
  }
  /** ground from x1..x2 whose surface is row `top` */
  ground(x1: number, x2: number, top: number) {
    this.fill(x1, top, x2, this.rows - 1);
  }
  /** spike pit: cleared from row `top` down to the spikes on `floor - 1`, solid below */
  pit(x1: number, x2: number, floor: number, top = 0) {
    this.fill(x1, top, x2, floor - 1, '.');
    this.fill(x1, floor - 1, x2, floor - 1, '^');
    this.fill(x1, floor, x2, this.rows - 1, '#');
  }
  /** a lava lake whose surface is `row`, with solid rock beneath it */
  lava(x1: number, x2: number, row: number) {
    this.fill(x1, 0, x2, row - 1, '.');
    this.fill(x1, row, x2, row, '~');
    this.fill(x1, row + 1, x2, this.rows - 1, '#');
  }
  /** frozen floor: the surface row of x1..x2 turns to ice (the ground below must already be there) */
  ice(x1: number, x2: number, row: number) {
    this.fill(x1, row, x2, row, 'i');
  }
  /** paved floor: the surface row of x1..x2 is dressed stone instead of grass / sand */
  pave(x1: number, x2: number, row: number) {
    this.fill(x1, row, x2, row, 's');
  }
  /** a mire pool: one row of wading-deep water on row `row`, solid ground beneath */
  bog(x1: number, x2: number, row: number) {
    this.fill(x1, 0, x2, row - 1, '.');
    this.fill(x1, row, x2, row, '%');
    this.fill(x1, row + 1, x2, this.rows - 1, '#');
  }
  /** an icicle hanging under the ceiling whose bottom edge is row `ceilRow` (the first air row) */
  icicle(col: number, ceilRow: number) {
    this.data.icicles.push({ x: col * TILE + TILE / 2, y: ceilRow * TILE });
  }
  /** rotten one-way planks that collapse under you */
  crumble(col: number, row: number, w: number) {
    this.data.crumbles.push({ x: col * TILE, y: row * TILE, w });
  }
  /** stone pillar rising out of the lava (top = standing row) */
  pillar(x1: number, x2: number, top: number) {
    this.fill(x1, top, x2, this.rows - 1);
  }
  /** moving platform: top-left col/row, width in tiles, travel in tiles, period in seconds */
  mover(col: number, row: number, w: number, dxTiles: number, dyTiles: number, period: number, phase = 0) {
    this.data.movers.push({ x: col * TILE, y: row * TILE, w, dx: dxTiles * TILE, dy: dyTiles * TILE, period, phase });
  }
  plat(x: number, y: number, w: number) {
    this.fill(x, y, x + w - 1, y, '=');
  }
  /** entity standing on row `top` at column x (pixel feet position) */
  at(x: number, top: number) {
    return { x: x * TILE + TILE / 2, y: top * TILE };
  }
  prop(key: string, col: number, top: number, opts: { hang?: boolean; light?: boolean } = {}) {
    this.data.props.push({ key, ...this.at(col, top), ...opts });
  }
  enemy(type: EnemyType, col: number, top: number) {
    this.data.enemies.push({ type, ...this.at(col, top) });
  }
  item(id: string, item: string, col: number, top: number, qty = 1) {
    this.data.items.push({ id, item, qty, ...this.at(col, top) });
  }
  door(d: Omit<DoorDef, 'x' | 'y'>, col: number, top: number) {
    this.data.doors.push({ ...d, ...this.at(col, top) });
  }
  build(): LevelData {
    const solid = (x: number, y: number) => y >= 0 && y < this.rows && x >= 0 && x < this.cols && (this.g[y][x] === '#' || this.g[y][x] === 'i' || this.g[y][x] === 's');
    const tiles = this.g.map((row, y) =>
      row.map((c, x) => {
        if (c === '#') return solid(x, y - 1) ? T.STONE : T.TOP;
        if (c === '=') return T.PLANK;
        if (c === '^') return T.SPIKE;
        if (c === '~') return T.LAVA;
        if (c === 'i') return T.ICE;
        if (c === '%') return T.BOG;
        if (c === 's') return T.STONE;
        return -1;
      }),
    );
    return { cols: this.cols, rows: this.rows, tiles, ...this.data };
  }
}

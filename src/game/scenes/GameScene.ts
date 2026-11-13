import Phaser from 'phaser';
import { DEPTH, T, TILE } from '../constants';
import { EventBus } from '../EventBus';
import { Controls } from '../input/Controls';
import { resetTouchInput } from '../input/touchInput';
import { Player } from '../entities/Player';
import { makeEnemy, type Enemy } from '../entities/Enemy';
import { makeBoss, type Boss } from '../entities/Boss';
import { Bonfire } from '../world/Bonfire';
import { Door, Npc } from '../world/Npc';
import { AREAS, START_AREA } from '../world/areas';
import type { LevelData } from '../world/builder';
import { CombatSystem, type Hittable } from '../systems/CombatSystem';
import { Fx } from '../systems/Fx';
import { Lighting, type Light } from '../systems/Lighting';
import { sfx } from '../systems/Sfx';
import { loadGame, saveGame, type WorldState } from '../systems/SaveSystem';
import { derived, usePlayerStore } from '../../stores/playerStore';
import { useGameStore } from '../../stores/gameStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { ITEMS } from '../data/items';
import { NPCS } from '../data/npcs';
import { debugState } from '../debugState';
import type { StatusHit } from '../systems/attacks';
import { Telegraph } from '../systems/Telegraph';

/**
 * Anything thrown or travelling: boss shockwaves and lava waves (follow the ground),
 * arrows and lava globs (ballistic), falling bones.
 */
interface Projectile {
  kind: 'wave' | 'arrow' | 'bone' | 'glob' | 'lavawave' | 'shard' | 'icicle' | 'toxglob' | 'bogwave' | 'gspike' | 'puff';
  /** frost / poison build-up on hit */
  status?: StatusHit;
  /** lava wave: where it started and how far it may roll */
  startX?: number;
  reach?: number;
  /** seconds before it starts moving (bone rain shows a ground marker meanwhile) */
  delay?: number;
  marker?: Phaser.GameObjects.Image;
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  dir: number;
  life: number;
  hit: boolean;
  damage: number;
}

interface Pickup {
  /** persistent world id, or null for enemy drops (not saved) */
  id: string | null;
  item: string;
  qty: number;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  baseY: number;
}

interface SceneData {
  area?: string;
  /** door id to arrive at */
  entry?: string;
  /** debug: exact spot to arrive at (feet position) */
  at?: { x: number; y: number };
}

/** light radius per light-emitting prop */
const PROP_LIGHT: Record<string, { r: number; flicker: number }> = {
  torch: { r: 78, flicker: 0.12 },
  wall_torch: { r: 78, flicker: 0.12 },
  candle: { r: 42, flicker: 0.1 },
  lantern: { r: 64, flicker: 0.04 },
  paperlantern: { r: 70, flicker: 0.06 },
  stonelantern: { r: 56, flicker: 0.08 },
  glow_mushroom: { r: 38, flicker: 0.02 },
};

/** how dark each theme is (alpha of the darkness layer) */
const DARKNESS = { outdoor: 0.6, crypt: 0.86, lava: 0.8, frost: 0.55, mire: 0.84, tomb: 0.88, desert: 0.1, sky: 0, shrine: 0.8, ash: 0.7, keep: 0.86 } as const;

/** every great soul: the Ashen Throne opens only when all of these have fallen */
export const ALL_BOSSES = [
  'bossDefeated', 'shepherdDefeated', 'colossusDefeated', 'matriarchDefeated', 'motherDefeated',
  'sphinxDefeated', 'gladiatorDefeated', 'leviathanDefeated', 'ayameDefeated',
] as const;
/** the burnt-out lands of the finale: ash-grey stone, enemies come back as ash */
const ASH_THEMES = new Set(['ash', 'keep']);
/** themes built from the sandstone tileset */
const SAND_THEMES = new Set(['tomb', 'desert']);

/** An icicle hanging from the ceiling: shakes when you pass under it, falls, shatters, grows back. */
interface Icicle {
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  state: 'hang' | 'shake' | 'fall' | 'gone';
  t: number;
  vy: number;
}
/** Rotten planks: give way a moment after you stand on them, grow back after a while. */
interface Crumble {
  s: Phaser.GameObjects.TileSprite;
  body: Phaser.Physics.Arcade.Body;
  x: number;
  y: number;
  /** seconds stood on (breaks at CRUMBLE_TIME) / seconds gone */
  t: number;
  broken: boolean;
}
/** A lingering cloud of poison (toxic glob splashes, burst carriers). */
interface Gas {
  rect: Phaser.Geom.Rectangle;
  life: number;
  max: number;
  /** poison build-up per second inside */
  rate: number;
  puffs: Phaser.GameObjects.Image[];
}
const CRUMBLE_TIME = 0.5;
const CRUMBLE_REGROW = 4.5;
const ICICLE_REGROW = 9;
const ICICLE_GRAVITY = 900;
const SHARD_SPEED = 170;

/** Phase-2 arena collapse: floor columns that sank into the lava (restored when the boss dies). */
interface SunkColumn {
  c: number;
  /** tile indices of the rows that were removed/replaced, top first */
  saved: number[];
  surf: Phaser.GameObjects.TileSprite;
}
/** how many columns per side can sink, and how deep the hole is (rows of air above the lava) */
const COLLAPSE_MAX = 10;
const COLLAPSE_DEPTH = 2;
const COLLAPSE_WARN = 0.9;

/** A one-way slab moving along a smooth back-and-forth path (see MoverDef). */
interface Mover {
  s: Phaser.GameObjects.TileSprite;
  /** its own collider with the player (so arena pieces can come and go) */
  col: Phaser.Physics.Arcade.Collider;
  body: Phaser.Physics.Arcade.Body;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  period: number;
  phase: number;
}

/** Atlas props are 16×16 icons; shrink them so they read as scenery next to 20px-tall characters. */
const PROP_SCALE: Record<string, number> = {
  candle: 0.5, skull: 0.55, bone: 0.55, glow_mushroom: 0.55, lantern: 0.6, chain: 0.7,
  torch: 0.65, wall_torch: 0.65, crate: 0.65, barrel: 0.65, tombstone: 0.75, tombstone_cracked: 0.75,
  coffin: 0.8, banner: 0.8, pillar: 0.9, gargoyle: 0.9,
  // generated desert props are drawn at size
  cactus: 1, scrub: 1, urn: 1,
  paperlantern: 1, stonelantern: 1, torii: 1, bamboo: 1,
};

const BONE_GRAVITY = 820;
const ARROW_SPEED = 230;
const ARROW_GRAVITY = 260;
const GLOB_GRAVITY = 450;
/** lava wave height scale: 40 px × 1.5 = 60, more than the player's ~57 px jump */
const LAVA_WAVE_SY = 1.5;

const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);

export class GameScene extends Phaser.Scene {
  player!: Player;
  controls!: Controls;
  combat!: CombatSystem;
  fx!: Fx;
  lighting!: Lighting;
  layer!: Phaser.Tilemaps.TilemapLayer;
  level!: LevelData;
  world!: WorldState;
  area = START_AREA;

  enemies: Enemy[] = [];
  boss: Boss | null = null;
  bonfires: Bonfire[] = [];
  npcs: Npc[] = [];
  doors: Door[] = [];

  private entry: string | undefined;
  private bg: { s: Phaser.GameObjects.TileSprite; f: number }[] = [];
  private moon: Phaser.GameObjects.Image | null = null;
  private projectiles: Projectile[] = [];
  private pickups: Pickup[] = [];
  private stain: { sprite: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; souls: number } | null = null;
  private fog: Phaser.GameObjects.TileSprite | null = null;
  private gateCollider: Phaser.Physics.Arcade.Collider | null = null;
  private bossActive = false;
  private talkingTo: Npc | null = null;
  private travelling = false;
  private at: { x: number; y: number } | undefined;
  private debugGfx!: Phaser.GameObjects.Graphics;
  private mapW = 0;
  private mapH = 0;
  private movers: Mover[] = [];
  private lavaSurfaces: Phaser.GameObjects.TileSprite[] = [];
  /** top-centre points along every lava lake (for lights and embers) */
  private lavaPoints: { x: number; y: number }[] = [];
  private bogSurfaces: Phaser.GameObjects.TileSprite[] = [];
  private icicles: Icicle[] = [];
  private crumbles: Crumble[] = [];
  private gas: Gas[] = [];
  /** phase-2 frozen arena floor: tiles that were turned to ice (restored on reset / victory) */
  private frozenTiles: { c: number; r: number; idx: number }[] = [];
  /** Ayame's darkness: every lantern goes out (see setGloom) */
  gloom = false;
  /** a boss's sandstorm: blowing sand + the dark closing in */
  private storm: { sand: Phaser.GameObjects.Particles.ParticleEmitter; haze: Phaser.GameObjects.Rectangle } | null = null;
  private sunk: SunkColumn[] = [];
  /** columns currently glowing before they give way */
  private sinkWarn: { cols: number[]; t: number } | null = null;
  private sinkGap = 0;
  private t = 0;

  constructor() {
    super('Game');
  }

  init(data: SceneData) {
    this.entry = data.entry;
    this.at = data.at;
    // the world state lives across area changes; only the very first boot reads the save
    if (!this.registry.has('world')) this.registry.set('world', loadGame());
    this.world = this.registry.get('world');
    this.area = data.area ?? this.world.lastArea ?? START_AREA;
    if (!AREAS[this.area]) this.area = START_AREA;
  }

  // ------------------------------------------------------------------ setup
  create() {
    this.enemies = [];
    this.bonfires = [];
    this.npcs = [];
    this.doors = [];
    this.projectiles = [];
    this.pickups = [];
    this.bg = [];
    this.movers = [];
    this.lavaSurfaces = [];
    this.lavaPoints = [];
    this.bogSurfaces = [];
    this.icicles = [];
    this.crumbles = [];
    this.gas = [];
    this.frozenTiles = [];
    this.storm = null;
    this.split = null;
    this.gloom = false;
    this.sunk = [];
    this.sinkWarn = null;
    this.sinkGap = 0;
    this.stain = null;
    this.boss = null;
    this.fog = null;
    this.gateCollider = null;
    this.bossActive = false;
    this.talkingTo = null;
    this.travelling = false;

    this.level = AREAS[this.area]();
    // bright, open-air areas need the danger zones painted dark instead of lit
    Telegraph.bright = this.level.theme === 'sky' || this.level.theme === 'desert';
    this.mapW = this.level.cols * TILE;
    this.mapH = this.level.rows * TILE;
    useGameStore.setState({ boss: null, dead: false, restOpen: false, prompt: null, paused: false, dialogue: null, shop: null, ending: false });

    this.createBackground();

    const map = this.make.tilemap({ data: this.level.tiles, tileWidth: TILE, tileHeight: TILE });
    const theme = this.level.theme;
    const ts = map.addTilesetImage('tiles', SAND_THEMES.has(theme) ? 'tiles-sand' : theme === 'sky' ? 'tiles-cloud' : theme === 'shrine' ? 'tiles-shrine' : 'tiles')!;
    this.layer = map.createLayer(0, ts, 0, 0)!.setDepth(DEPTH.DECOR);
    this.layer.setCollision([T.TOP, T.STONE, T.ICE]);
    this.layer.forEachTile((t) => {
      if (t.index === T.PLANK) t.setCollision(false, false, true, false);
      if (this.level.theme === 'crypt' && t.index >= 0) t.tint = 0x9a94b4;
      // rock warmed from below by the lava
      if (this.level.theme === 'lava' && t.index >= 0 && t.index !== T.LAVA) t.tint = 0xb4908a;
      // rimed, cold-lit stone up in the mountains
      if (this.level.theme === 'frost' && t.index >= 0 && t.index !== T.ICE) t.tint = 0xc4d4ec;
      // moss and rot in the mire
      if (this.level.theme === 'mire' && t.index >= 0 && t.index !== T.BOG) t.tint = 0x8e9e7a;
      // burnt, ash-choked stone
      if (ASH_THEMES.has(this.level.theme) && t.index >= 0 && t.index !== T.LAVA) t.tint = 0x9a8e88;
    });
    this.createLava();
    this.createBog();

    this.physics.world.setBounds(0, 0, this.mapW, this.mapH + 400);
    this.physics.world.setBoundsCollision(true, true, true, false);

    this.combat = new CombatSystem(this);
    this.fx = new Fx(this);
    this.controls = new Controls(this);

    for (const b of this.level.bonfires) this.bonfires.push(new Bonfire(this, b.id, b.x, b.y, this.world.lit.includes(b.id)));
    for (const d of this.level.doors) this.doors.push(new Door(this, d));
    for (const n of this.level.npcs) this.npcs.push(new Npc(this, n.id, n.x, n.y));
    this.refreshDoors();

    const sp = this.spawnPoint();
    this.at = undefined;
    this.player = new Player(this, sp.x, sp.y);
    const carry = this.registry.get('carry') as { hp: number; stamina: number } | undefined;
    if (carry && this.entry) {
      this.player.hp = carry.hp;
      this.player.stamina = carry.stamina;
    }
    this.registry.remove('carry');
    this.physics.add.collider(this.player.sprite, this.layer, undefined, (_p, t) => {
      const tile = t as Phaser.Tilemaps.Tile;
      return !(tile.index === T.PLANK && this.player.dropThrough > 0);
    });
    this.createMovers();
    this.createCrumbles();
    this.createIcicles();

    this.lighting = new Lighting(this, DARKNESS[this.level.theme]);
    this.createProps();
    this.spawnEnemies();
    this.createPickups();
    this.createBossArena();
    this.placeStain();
    this.createLights();
    this.createWeather();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.mapW, this.mapH);
    cam.startFollow(this.player.sprite, true, 0.14, 0.14, 0, 24);
    cam.setDeadzone(16, 28);
    cam.fadeIn(500);

    this.debugGfx = this.add.graphics().setDepth(DEPTH.FG + 5);
    this.input.keyboard!.on('keydown-F2', () => (debugState.hitboxes = !debugState.hitboxes));

    this.bindUi();

    sfx.playMusic(this.areaTrack());
    if (this.entry) useGameStore.getState().showBanner(this.level.name.toUpperCase(), 'white');
    else if (!this.world.lit.length) useGameStore.getState().showBanner(this.level.name.toUpperCase(), 'white', 'Rest at the bonfire');
  }

  /** Commands from React (pause, menus, dialogue). Cleaned up on restart and on game destroy. */
  private bindUi() {
    const handlers: Record<string, (...args: never[]) => void> = {
      'ui:pause': () => {
        resetTouchInput();
        if (this.scene.isActive()) this.scene.pause();
      },
      // only wake a scene that is actually paused (never one that is shutting down)
      'ui:resume': () => {
        if (this.scene.isPaused()) this.scene.resume();
      },
      'ui:rest-leave': () => {
        this.player.standUp();
        useGameStore.setState({ restOpen: false });
        saveGame(this.world);
      },
      'ui:use-item': (id: string) => {
        if (this.player.useFromMenu(id)) saveGame(this.world);
      },
      'ui:dialogue-node': (npc: string, node: string) => this.onDialogueNode(npc, node),
      'ui:dialogue-end': () => {
        if (this.talkingTo) this.talkingTo.talking = false;
        this.talkingTo = null;
        saveGame(this.world);
      },
      'ui:save': () => saveGame(this.world),
      'ui:quit': () => {
        saveGame(this.world);
        this.registry.remove('world');
        resetTouchInput();
        this.scene.start('Title'); // TitleScene.create resets paused/menu state in the store
      },
    };
    for (const [ev, fn] of Object.entries(handlers)) EventBus.on(ev, fn);
    this.scale.on('resize', this.onResize, this);
    const cleanup = () => {
      for (const [ev, fn] of Object.entries(handlers)) EventBus.off(ev, fn);
      this.scale.off('resize', this.onResize, this);
    };
    // SHUTDOWN covers scene restarts (area changes), DESTROY covers game.destroy() (React unmount / HMR)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  private createBackground() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.moon = null;
    if (this.level.theme === 'keep') {
      // inside the king's keep: the crypt's stone, warmed by braziers
      this.cameras.main.setBackgroundColor('#0a0606');
      const layers: [string, number, number, number][] = [
        ['bg-cave-far', 0.25, 1, 0x9a7a70],
        ['bg-crypt', 0.4, 0.5, 0xb08070],
        ['bg-cave-near', 0.65, 1, 0x806058],
        ['bg-fog', 0.8, 0.2, 0xc09080],
      ];
      layers.forEach(([key, f, a, tint], i) => {
        const s = this.add.tileSprite(0, 0, w, h, key).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 4 + i).setAlpha(a).setTint(tint);
        this.bg.push({ s, f });
      });
      return;
    }
    if (this.level.theme === 'ash') {
      // a dead city under a red-brown sky; the ruined towers of what was here, ash on the wind
      const sky = this.add.tileSprite(0, 0, w, h, 'bg-sky').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 4).setTint(0xb07060);
      this.moon = this.add.image(w * 0.75, 50, 'moon').setScrollFactor(0).setDepth(DEPTH.BG - 3).setAlpha(0.6).setTint(0xff9a70);
      this.bg.push({ s: sky, f: 0.02 });
      for (const [key, f, a, tint] of [
        ['bg-mount', 0.1, 1, 0x9a6a60],
        ['bg-ruins', 0.3, 1, 0x8a5a50],
        ['bg-fog', 0.55, 0.6, 0xc0a098],
      ] as const) {
        const s = this.add.tileSprite(0, 0, w, h, key).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 2).setAlpha(a).setTint(tint);
        this.bg.push({ s, f });
      }
      return;
    }
    if (this.level.theme === 'shrine') {
      // a still night: a big pale moon, temple roofs and bamboo in silhouette, low mist
      const sky = this.add.tileSprite(0, 0, w, h, 'bg-sky').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 4).setTint(0x8a90c8);
      this.moon = this.add.image(w * 0.7, 56, 'moon').setScrollFactor(0).setDepth(DEPTH.BG - 3).setScale(1.6).setAlpha(0.95);
      this.bg.push({ s: sky, f: 0.02 });
      for (const [key, f, a] of [
        ['bg-shrine-roofs', 0.15, 1],
        ['bg-bamboo', 0.35, 1],
        ['bg-fog', 0.6, 0.45],
      ] as const) {
        const s = this.add.tileSprite(0, 0, w, h, key).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 2).setAlpha(a);
        if (key === 'bg-fog') s.setTint(0xb8c0ff);
        this.bg.push({ s, f });
      }
      return;
    }
    if (this.level.theme === 'sky') {
      // above the clouds: deep blue overhead, banks of cloud drifting far below and around
      const sky = this.add.tileSprite(0, 0, w, h, 'bg-daysky').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 4).setTileScale(1, h / 270).setTint(0xb8d4ff);
      this.moon = this.add.image(w * 0.2, 40, 'sun').setScrollFactor(0).setDepth(DEPTH.BG - 3).setScale(1.2);
      this.bg.push({ s: sky, f: 0 });
      for (const [key, f, a] of [
        ['bg-clouds-far', 0.08, 1],
        ['bg-clouds-near', 0.25, 0.95],
        ['bg-fog', 0.5, 0.3],
      ] as const) {
        const s = this.add.tileSprite(0, 0, w, h, key).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 2).setAlpha(a);
        this.bg.push({ s, f });
      }
      return;
    }
    if (this.level.theme === 'desert') {
      // high noon over the wastes: blue sky, a white sun, two ranges of dunes, heat haze
      const sky = this.add.tileSprite(0, 0, w, h, 'bg-daysky').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 4).setTileScale(1, h / 270);
      this.moon = this.add.image(w * 0.8, 46, 'sun').setScrollFactor(0).setDepth(DEPTH.BG - 3).setScale(1.4);
      this.bg.push({ s: sky, f: 0 });
      for (const [key, f, a, tint] of [
        ['bg-dunes-far', 0.1, 1, 0xffffff],
        ['bg-dunes-near', 0.3, 1, 0xffffff],
        ['bg-fog', 0.55, 0.35, 0xfff0c8],
      ] as const) {
        const s = this.add.tileSprite(0, 0, w, h, key).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 2).setAlpha(a).setTint(tint);
        this.bg.push({ s, f });
      }
      return;
    }
    if (this.level.theme === 'tomb') {
      // sandstone catacombs: carved niches in the far wall, warm torch-dark
      this.cameras.main.setBackgroundColor('#0c0804');
      const layers: [string, number, number, number][] = [
        ['bg-cave-far', 0.25, 1, 0xc8a070],
        ['bg-crypt', 0.4, 0.5, 0xd8b080],
        ['bg-cave-near', 0.65, 1, 0xa88058],
        ['bg-fog', 0.8, 0.18, 0xe8c090],
      ];
      layers.forEach(([key, f, a, tint], i) => {
        const s = this.add.tileSprite(0, 0, w, h, key).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 4 + i).setAlpha(a).setTint(tint);
        this.bg.push({ s, f });
      });
      return;
    }
    if (this.level.theme === 'mire') {
      // a drowned cave: green-black rock, rot-light and thick low fog
      this.cameras.main.setBackgroundColor('#060904');
      const layers: [string, number, number, number][] = [
        ['bg-cave-far', 0.25, 1, 0x6a8a5a],
        ['bg-cave-near', 0.6, 1, 0x5a7a4a],
        ['bg-fog', 0.7, 0.35, 0x9ad070],
        ['bg-fog', 0.9, 0.25, 0x6a9a4a],
      ];
      layers.forEach(([key, f, a, tint], i) => {
        const s = this.add.tileSprite(0, 0, w, h, key).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 4 + i).setAlpha(a).setTint(tint);
        this.bg.push({ s, f });
      });
      return;
    }
    if (this.level.theme === 'frost') {
      // a monastery up in the peaks: pale sky, snow-capped mountains, cold mist
      const sky = this.add.tileSprite(0, 0, w, h, 'bg-sky').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 4).setTint(0x9ab8e0);
      this.moon = this.add.image(w * 0.78, 52, 'moon').setScrollFactor(0).setDepth(DEPTH.BG - 3).setAlpha(0.7).setTint(0xd8ecff);
      this.bg.push({ s: sky, f: 0.02 });
      for (const [key, f, a, tint] of [
        ['bg-mount', 0.1, 1, 0xc8dcf4],
        ['bg-ruins', 0.3, 1, 0x9ab0d0],
        ['bg-fog', 0.55, 0.9, 0xeaf4ff],
      ] as const) {
        const s = this.add.tileSprite(0, 0, w, h, key).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 2).setAlpha(a).setTint(tint);
        this.bg.push({ s, f });
      }
      return;
    }
    if (this.level.theme === 'lava') {
      // deep cave: the same rock walls, lit red from the lava far below
      this.cameras.main.setBackgroundColor('#0e0505');
      const layers: [string, number, number, number][] = [
        ['bg-cave-far', 0.25, 1, 0xc07060],
        ['bg-cave-near', 0.6, 1, 0xd08070],
        ['bg-lavaglow', 0, 1, 0xffffff],
        ['bg-fog', 0.8, 0.18, 0xff9060],
      ];
      layers.forEach(([key, f, a, tint], i) => {
        const s = this.add.tileSprite(0, 0, w, h, key).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 4 + i).setAlpha(a).setTint(tint);
        if (key === 'bg-lavaglow') s.setBlendMode('ADD').setTileScale(1, h / 270);
        this.bg.push({ s, f });
      });
      return;
    }
    if (this.level.theme === 'crypt') {
      // stone cave: far wall, crypt niches carved into it, near rock columns, a little fog
      this.cameras.main.setBackgroundColor('#07060a');
      const layers: [string, number, number][] = [
        ['bg-cave-far', 0.25, 1],
        ['bg-crypt', 0.4, 0.45],
        ['bg-cave-near', 0.65, 1],
        ['bg-fog', 0.8, 0.25],
      ];
      layers.forEach(([key, f, a], i) => {
        const s = this.add.tileSprite(0, 0, w, h, key).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 4 + i).setAlpha(a);
        this.bg.push({ s, f });
      });
      return;
    }
    const sky = this.add.tileSprite(0, 0, w, h, 'bg-sky').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 4);
    this.moon = this.add.image(w * 0.78, 52, 'moon').setScrollFactor(0).setDepth(DEPTH.BG - 3).setAlpha(0.9);
    this.bg.push({ s: sky, f: 0.02 });
    for (const [key, f, a] of [['bg-mount', 0.1, 1], ['bg-ruins', 0.3, 1], ['bg-fog', 0.55, 0.8]] as const) {
      const s = this.add.tileSprite(0, 0, w, h, key).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG - 2).setAlpha(a);
      this.bg.push({ s, f });
    }
  }

  private onResize(size: Phaser.Structs.Size) {
    this.cameras.main.setSize(size.width, size.height);
    for (const { s } of this.bg) {
      s.setSize(size.width, size.height);
      if (s.texture.key === 'bg-lavaglow' || s.texture.key === 'bg-daysky') s.setTileScale(1, size.height / 270);
    }
    this.moon?.setX(size.width * 0.78);
  }

  private spawnPoint() {
    if (this.at) return this.at;
    const door = this.entry && this.level.doors.find((d) => d.id === this.entry);
    if (door) return { x: door.x, y: door.y };
    const b = this.level.bonfires.find((x) => x.id === this.world.lastBonfire);
    return b ? { x: b.x + 16, y: b.y } : this.level.spawn;
  }

  private spawnEnemies() {
    for (const e of this.enemies) e.destroy();
    this.pickups = this.pickups.filter((p) => {
      if (p.id) return true;
      p.sprite.destroy();
      p.glow.destroy();
      return false;
    });
    this.enemies = this.level.enemies.map((e) => makeEnemy(this, e.type, e.x, e.y));
    // in the finale the old foes return as ash: grey, a glow of embers in them
    if (ASH_THEMES.has(this.level.theme))
      for (const e of this.enemies) {
        e.baseTint = 0xb4a8a4;
        e.sprite.setTint(0xb4a8a4);
      }
  }

  private createPickups() {
    for (const it of this.level.items) {
      if (this.world.items.includes(it.id)) continue;
      this.spawnPickup(it.x, it.y, it.item, it.qty, it.id);
    }
  }

  /** Static light sources: player, bonfires, light props. Dynamic ones are gathered each frame. */
  private createLights() {
    const L = this.lighting;
    const playerR = this.level.theme === 'outdoor' ? 62 : 78;
    L.add(() => (this.player.alive ? { x: this.player.x, y: this.player.y - 4, r: this.gloom ? 40 : playerR } : null));
    for (const b of this.bonfires) L.add(() => (b.lit ? { x: b.x, y: b.y - 12, r: 130, flicker: 0.08 } : { x: b.x, y: b.y - 8, r: 26 }));
    for (const pr of this.level.props) {
      const l = PROP_LIGHT[pr.key];
      if (!pr.light || !l) continue;
      const y = pr.hang ? pr.y + 6 : pr.y - 8;
      L.add(() => (this.gloom ? null : { x: pr.x, y, r: l.r, flicker: l.flicker }));
    }
    for (const d of this.doors) L.add(() => (d.sprite.frame.name === 'sealed' ? { x: d.def.x, y: d.def.y - 20, r: 40, flicker: 0.05 } : null));
    // lava lights the cave from below
    for (const lp of this.lavaPoints) L.add(() => ({ x: lp.x, y: lp.y - 6, r: 74, flicker: 0.1 }));
    // NPCs carry no light of their own – they sit in the dark until you bring light to them
  }

  private dynamicLights(): Light[] {
    const out: Light[] = [];
    for (const it of this.pickups) out.push({ x: it.sprite.x, y: it.sprite.y, r: 30, flicker: 0.05 });
    if (this.stain) out.push({ x: this.stain.sprite.x, y: this.stain.sprite.y, r: 34, flicker: 0.05 });
    for (const p of this.projectiles) {
      if (p.kind === 'wave') out.push({ x: p.sprite.x, y: p.sprite.y - 8, r: 46, flicker: 0.15 });
      if (p.kind === 'lavawave') out.push({ x: p.sprite.x, y: p.sprite.y - 18, r: 60, flicker: 0.15 });
      if (p.kind === 'glob') out.push({ x: p.sprite.x, y: p.sprite.y, r: 32, flicker: 0.1 });
      if (p.marker) out.push({ x: p.marker.x, y: p.marker.y, r: 22 });
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.cfg.key === 'slime') out.push({ x: e.x, y: e.y, r: 34, flicker: 0.08 });
      else if (e.cfg.key === 'wraith') out.push({ x: e.x, y: e.y, r: 30, flicker: 0.12 });
      else if (e.cfg.key === 'lantern' && !this.gloom) out.push({ x: e.x, y: e.y, r: 44, flicker: 0.1 });
    }
    for (const p of this.projectiles) if (p.kind === 'shard' || p.kind === 'toxglob') out.push({ x: p.sprite.x, y: p.sprite.y, r: 20 });
    for (const g of this.gas) out.push({ x: g.rect.centerX, y: g.rect.centerY, r: 26 });
    for (const s of this.sunk) if (s.c % 2 === 0) out.push({ x: s.c * TILE + 8, y: s.surf.y, r: 58, flicker: 0.1 });
    const bl = this.player?.bladeLight();
    if (bl) out.push(bl);
    const b = this.boss;
    if (b && b.alive && b.active) out.push({ x: b.x, y: b.y - 10, r: ({ shepherd: 70, colossus: 110, matriarch: 80, mother: 120, sphinx: 110, gladiator: 80, leviathan: 130, ayame: this.gloom ? 16 : 60, king: 80 } as Record<string, number>)[b.cfg.key] ?? 54, flicker: 0.05 });
    return out;
  }

  // ------------------------------------------------------------------ lava + moving platforms
  /** Animated surface strips over every lava lake, plus the points its light comes from. */
  private createLava() {
    const { tiles, cols, rows } = this.level;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (tiles[r][c] !== T.LAVA || (r > 0 && tiles[r - 1][c] === T.LAVA)) continue;
        let e = c;
        while (e + 1 < cols && tiles[r][e + 1] === T.LAVA && !(r > 0 && tiles[r - 1][e + 1] === T.LAVA)) e++;
        const x = c * TILE;
        const w = (e - c + 1) * TILE;
        const y = r * TILE;
        // drawn above characters so anything that falls in sinks out of sight
        const s = this.addLavaSurface(x, y, w);
        s.tilePositionX = c * 7;
        this.lavaSurfaces.push(s);
        const glow = this.add.tileSprite(x, y - 26, w, 30, 'bg-lavaglow').setOrigin(0).setDepth(DEPTH.DECOR - 1).setBlendMode('ADD').setTileScale(1, 30 / 270);
        glow.setAlpha(0.8);
        const n = Math.max(1, Math.round(w / 52));
        for (let i = 0; i < n; i++) this.lavaPoints.push({ x: x + ((i + 0.5) * w) / n, y });
        c = e;
      }
    }
  }

  /**
   * The lava's animated crest plus an opaque molten body under it, both drawn above characters
   * so anything that falls in sinks out of sight. `y` = top of the lava tile row.
   */
  private addLavaSurface(x: number, y: number, w: number) {
    const body = this.add.rectangle(x, y + 2, w, TILE - 2, 0xc8360e).setOrigin(0).setDepth(DEPTH.FX + 1);
    const s = this.add.tileSprite(x, y - 5, w, 8, 'lava-surface').setOrigin(0).setDepth(DEPTH.FX + 1);
    s.setData('body', body);
    return s;
  }

  private createMovers() {
    for (const m of this.level.movers) this.addMover(m);
  }

  private addMover(m: LevelData['movers'][number]) {
    const tex = this.level.theme === 'sky' ? 'mover-cloud' : 'mover';
    const s = this.add.tileSprite(m.x, m.y, m.w * TILE, 8, tex).setOrigin(0).setDepth(DEPTH.DECOR + 1);
    this.physics.add.existing(s);
    const body = s.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true);
    body.checkCollision.down = false;
    body.checkCollision.left = false;
    body.checkCollision.right = false;
    body.friction.set(1, 0);
    const col = this.physics.add.collider(this.player.sprite, s);
    const mv: Mover = { s, body, col, x0: m.x, y0: m.y, dx: m.dx, dy: m.dy, period: m.period, phase: m.phase };
    this.movers.push(mv);
    return mv;
  }

  // ------------------------------------------------------------------ mire water, rotten planks, icicles, snow
  /**
   * Every mire pool gets a murky body drawn over the waders' legs (so they read as standing in water)
   * and a slow scummy sheen on top.
   */
  private createBog() {
    const { tiles, cols, rows } = this.level;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (tiles[r][c] !== T.BOG || (r > 0 && tiles[r - 1][c] === T.BOG)) continue;
        let e = c;
        while (e + 1 < cols && tiles[r][e + 1] === T.BOG) e++;
        const x = c * TILE;
        const w = (e - c + 1) * TILE;
        const y = r * TILE;
        this.add.rectangle(x, y + 6, w, TILE - 6, 0x22341a, 0.72).setOrigin(0).setDepth(DEPTH.FX + 1);
        const s = this.add.tileSprite(x, y + 2, w, 6, 'bog-surface').setOrigin(0).setDepth(DEPTH.FX + 1).setAlpha(0.9);
        s.tilePositionX = c * 5;
        this.bogSurfaces.push(s);
        c = e;
      }
    }
  }

  private updateBog(dt: number) {
    if (!this.bogSurfaces.length) return;
    for (const s of this.bogSurfaces) s.tilePositionX += 2.5 * dt;
    // a bubble now and then near the camera
    const view = this.cameras.main.worldView;
    for (const s of this.bogSurfaces) {
      if (s.x > view.right || s.x + s.width < view.x || s.y < view.y - 20 || s.y > view.bottom + 20) continue;
      if (Math.random() < (s.width / 160) * dt) this.fx.status(s.x + Math.random() * s.width, s.y + 4, 'poison', 1);
    }
  }

  private createCrumbles() {
    for (const d of this.level.crumbles) {
      const s = this.add.tileSprite(d.x, d.y, d.w * TILE, 6, this.level.theme === 'sky' ? 'crumble-cloud' : 'crumble').setOrigin(0).setDepth(DEPTH.DECOR + 1);
      this.physics.add.existing(s);
      const body = s.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false).setImmovable(true);
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;
      this.crumbles.push({ s, body, x: d.x, y: d.y, t: 0, broken: false });
    }
    if (this.crumbles.length) this.physics.add.collider(this.player.sprite, this.crumbles.map((c) => c.s));
  }

  /** standing on a rotten plank: it creaks, sags, then drops away; it grows back a few seconds later */
  private updateCrumbles(dt: number) {
    const p = this.player;
    for (const c of this.crumbles) {
      if (c.broken) {
        c.t += dt;
        if (c.t >= CRUMBLE_REGROW) {
          c.broken = false;
          c.t = 0;
          c.s.setPosition(c.x, c.y).setAlpha(0).setVisible(true);
          c.body.reset(c.x, c.y);
          c.body.enable = true;
          this.tweens.add({ targets: c.s, alpha: 1, duration: 400 });
        }
        continue;
      }
      const onIt = p.alive && p.body.right > c.body.x + 1 && p.body.x < c.body.right - 1 && Math.abs(p.feetY - c.body.y) < 3 && p.body.velocity.y >= 0;
      if (onIt) c.t += dt;
      else c.t = Math.max(0, c.t - dt * 0.5);
      c.s.x = c.x + (c.t > 0.15 ? Math.sin(this.t * 60) * 0.8 : 0);
      if (c.t > 0.15 && Math.random() < 0.3) this.fx.dust(c.x + Math.random() * c.s.width, c.y + 4, 1);
      if (c.t >= CRUMBLE_TIME) {
        c.broken = true;
        c.t = 0;
        c.body.enable = false;
        sfx.bones();
        this.fx.dust(c.x + c.s.width / 2, c.y + 2, 10);
        this.tweens.add({ targets: c.s, y: c.y + 40, alpha: 0, angle: 0, duration: 500, ease: 'Quad.easeIn', onComplete: () => c.s.setVisible(false) });
      }
    }
  }

  private createIcicles() {
    for (const d of this.level.icicles) {
      const sprite = this.add.image(d.x, d.y, 'icicle').setOrigin(0.5, 0).setDepth(DEPTH.DECOR + 2);
      this.icicles.push({ x: d.x, y: d.y, sprite, state: 'hang', t: 0, vy: 0 });
    }
  }

  /** walk under an icicle and it shakes loose – keep moving */
  private updateIcicles(dt: number) {
    const p = this.player;
    for (const ic of this.icicles) {
      const s = ic.sprite;
      if (ic.state === 'hang') {
        if (p.alive && Math.abs(p.x - ic.x) < 22 && p.y > ic.y && p.y - ic.y < 220) {
          ic.state = 'shake';
          ic.t = 0;
          sfx.tell('blink');
        }
      } else if (ic.state === 'shake') {
        ic.t += dt;
        s.x = ic.x + Math.sin(this.t * 70) * 1.2;
        if (ic.t > 0.42) {
          ic.state = 'fall';
          ic.vy = 0;
          s.x = ic.x;
        }
      } else if (ic.state === 'fall') {
        ic.vy += ICICLE_GRAVITY * dt;
        s.y += ic.vy * dt;
        const tip = new Phaser.Geom.Rectangle(s.x - 3, s.y + 4, 6, 12);
        let hit = false;
        if (p.alive && Phaser.Geom.Intersects.RectangleToRectangle(tip, p.hurtbox())) {
          const res = p.takeDamage(24, 0, 60, 30, { blockable: false, status: { type: 'cold', amount: 35 } });
          hit = res === 'hit' || res === 'killed';
        }
        if (hit || this.isSolidAt(s.x, s.y + 16) || this.isPlankAt(s.x, s.y + 16) || s.y > this.mapH) {
          this.fx.status(s.x, s.y + 14, 'cold', 14);
          this.fx.dust(s.x, s.y + 14, 4);
          sfx.shatter();
          ic.state = 'gone';
          ic.t = 0;
          s.setVisible(false);
        }
      } else {
        ic.t += dt;
        if (ic.t >= ICICLE_REGROW) this.regrowIcicle(ic);
      }
    }
  }

  private regrowIcicle(ic: Icicle) {
    ic.state = 'hang';
    ic.t = 0;
    ic.sprite.setPosition(ic.x, ic.y).setVisible(true).setScale(1, 0.1);
    this.tweens.add({ targets: ic.sprite, scaleY: 1, duration: 600 });
  }

  /** rest / respawn: every icicle hangs again and every plank is whole */
  private resetHazards() {
    for (const ic of this.icicles) if (ic.state !== 'hang') this.regrowIcicle(ic);
    for (const c of this.crumbles) {
      c.t = CRUMBLE_REGROW;
      if (!c.broken) c.t = 0;
    }
    this.clearGas();
  }

  /** snow drifting across the Cloister (screen-space, above the darkness so it reads) */
  private createWeather() {
    if (ASH_THEMES.has(this.level.theme)) {
      // grey ash drifting down, the odd ember among it
      this.add
        .particles(0, 0, 'px', {
          x: { min: -40, max: this.scale.width + 40 },
          y: -6,
          lifespan: 8000,
          speedY: { min: 10, max: 26 },
          speedX: { min: -14, max: 8 },
          scale: { min: 0.5, max: 1.1 },
          alpha: { start: 0.7, end: 0.15 },
          tint: [0x8a8080, 0xb0a8a8, 0x6a6262, 0xff8a40],
          frequency: this.level.theme === 'keep' ? 160 : 55,
        })
        .setScrollFactor(0)
        .setDepth(DEPTH.FG + 4);
      return;
    }
    if (this.level.theme !== 'frost') return;
    const w = this.scale.width;
    this.add
      .particles(0, 0, 'px', {
        x: { min: -40, max: w + 40 },
        y: -6,
        lifespan: 7000,
        speedY: { min: 18, max: 42 },
        speedX: { min: -22, max: 4 },
        scale: { min: 0.4, max: 1 },
        alpha: { start: 0.75, end: 0.2 },
        tint: [0xffffff, 0xdcecff],
        frequency: 70,
      })
      .setScrollFactor(0)
      .setDepth(DEPTH.FG + 4);
  }

  // ------------------------------------------------------------------ poison clouds
  /** a lingering poison cloud standing on the floor at (x, groundY) */
  spawnGas(x: number, groundY: number, w: number, life: number, rate: number) {
    const rect = new Phaser.Geom.Rectangle(x - w / 2, groundY - 22, w, 22);
    const puffs: Phaser.GameObjects.Image[] = [];
    const n = Math.max(2, Math.round(w / 14));
    for (let i = 0; i < n; i++) {
      const img = this.add
        .image(rect.x + ((i + 0.5) * w) / n, groundY - 8, 'glow-soul')
        .setTint(0x7ac040)
        .setAlpha(0)
        .setScale(1.3, 0.9)
        .setDepth(DEPTH.FX);
      this.tweens.add({ targets: img, alpha: 0.55, duration: 250 });
      this.tweens.add({ targets: img, y: groundY - 12, scaleX: 1.6, duration: 900 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      puffs.push(img);
    }
    this.gas.push({ rect, life, max: life, rate, puffs });
  }

  private updateGas(dt: number) {
    const p = this.player;
    this.gas = this.gas.filter((g) => {
      g.life -= dt;
      if (Math.random() < 6 * dt) this.fx.status(g.rect.x + Math.random() * g.rect.width, g.rect.bottom - 4, 'poison', 1);
      if (g.life < 0.6) for (const img of g.puffs) img.setAlpha(Math.max(0, g.life / 0.6) * 0.55);
      if (p.alive && Phaser.Geom.Intersects.RectangleToRectangle(g.rect, p.hurtbox())) p.addBuildup('poison', g.rate * dt);
      if (g.life > 0) return true;
      for (const img of g.puffs) img.destroy();
      return false;
    });
  }

  private clearGas() {
    for (const g of this.gas) for (const img of g.puffs) img.destroy();
    this.gas = [];
  }

  // ------------------------------------------------------------------ gloom (Ayame, phase 3)
  /** every lantern gutters out; you see only a little way around yourself (and her red eyes) */
  setGloom(on: boolean) {
    if (this.gloom === on) return;
    this.gloom = on;
    this.lighting.setDarkness(on ? 0.96 : DARKNESS[this.level.theme], on ? 0x020208 : undefined);
    if (on) {
      useGameStore.getState().showToast('The lanterns gutter out');
      sfx.tell('blink');
    }
  }

  // ------------------------------------------------------------------ split arena (Sky Leviathan, phase 2)
  /** the arena's floor before it broke apart, and the drifting pieces that replaced it */
  private split: { tiles: { c: number; r: number; idx: number }[]; pieces: Mover[] } | null = null;

  /**
   * The white platform breaks into drifting pieces: the floor's tiles go, and cloud slabs bob and sway
   * in their place. A few tiles by the fog gate stay solid so there is always somewhere to stand.
   */
  splitArena() {
    const arena = this.level.boss;
    if (!arena || this.split) return;
    const row = Math.round(arena.y / TILE);
    const c0 = Math.floor(arena.fogX / TILE) + 5;
    const c1 = this.level.cols - 3;
    const tiles: { c: number; r: number; idx: number }[] = [];
    for (let c = c0; c <= c1; c++)
      for (let r = row; r < this.level.rows; r++) {
        const t = this.layer.getTileAt(c, r);
        if (!t || t.index < 0) continue;
        tiles.push({ c, r, idx: t.index });
        this.layer.removeTileAt(c, r);
      }
    const pieces: Mover[] = [];
    const W = 4;
    const stepC = W + 1; // one-tile gaps between pieces
    // line the pieces up so one lands right under the player – breaking apart never drops you outright
    const pc = Phaser.Math.Clamp(Math.floor(this.player.x / TILE) - 1, c0, c1 - W + 1);
    const first = pc - stepC * Math.floor((pc - c0) / stepC);
    for (let c = first, i = 0; c + W - 1 <= c1; c += stepC, i++) {
      // only every third piece drifts sideways (a little), the rest bob gently up and down
      const vertical = i % 3 !== 1;
      const mv = this.addMover({
        x: c * TILE, y: row * TILE, w: W,
        dx: vertical ? 0 : TILE * (i % 2 ? 1 : -1),
        dy: vertical ? -TILE * 2 : 0,
        period: 4.2 + (i % 3) * 0.6, phase: 0,
      });
      // start each piece where the floor was (k = 0 at this moment)
      mv.phase = (1 - ((this.t / mv.period) % 1)) % 1;
      pieces.push(mv);
      this.fx.cloud(c * TILE + 32, row * TILE, 6);
    }
    this.split = { tiles, pieces };
    this.combat.shake(0.012, 500);
    useGameStore.getState().showToast('The platform breaks apart!');
  }

  private mendArena() {
    const sp = this.split;
    if (!sp) return;
    this.split = null;
    for (const m of sp.pieces) {
      m.col.destroy();
      m.s.destroy();
    }
    this.movers = this.movers.filter((m) => !sp.pieces.includes(m));
    for (const t of sp.tiles) {
      const nt = this.layer.putTileAt(t.idx, t.c, t.r);
      nt.setCollision(t.idx === T.TOP || t.idx === T.STONE || t.idx === T.ICE);
      if (t.idx === T.PLANK) nt.setCollision(false, false, true, false);
    }
  }

  // ------------------------------------------------------------------ sandstorm (desert bosses)
  /** sand whips across the screen and the light closes in around you; the boss's tells still show through */
  setSandstorm(on: boolean) {
    if (on === !!this.storm) return;
    if (!on) {
      const st = this.storm!;
      this.storm = null;
      st.sand.stop();
      this.tweens.add({ targets: st.haze, alpha: 0, duration: 1200, onComplete: () => st.haze.destroy() });
      this.time.delayedCall(2500, () => st.sand.destroy());
      this.lighting.setDarkness(DARKNESS[this.level.theme]);
      return;
    }
    const w = this.scale.width;
    const h = this.scale.height;
    const sand = this.add
      .particles(0, 0, 'px', {
        x: w + 20,
        y: { min: -10, max: h + 10 },
        lifespan: 1600,
        speedX: { min: -420, max: -240 },
        speedY: { min: -20, max: 30 },
        scaleX: { min: 1.5, max: 4 },
        scaleY: { min: 0.5, max: 1 },
        alpha: { start: 0.7, end: 0.1 },
        tint: [0xe8c47c, 0xc8985c, 0xf4dca8],
        frequency: 8,
      })
      .setScrollFactor(0)
      .setDepth(DEPTH.FG + 4);
    const haze = this.add.rectangle(0, 0, w * 2, h * 2, 0xc89050, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.FG + 1);
    this.tweens.add({ targets: haze, alpha: 0.28, duration: 1500 });
    this.lighting.setDarkness(Math.max(0.72, DARKNESS[this.level.theme]), 0x2a1a0a);
    this.storm = { sand, haze };
    useGameStore.getState().showToast('A sandstorm rises');
  }

  /** a spike of stone bursting out of the floor at x after `delay` (a marker shows where) */
  spawnGroundSpike(x: number, groundY: number, delay: number, tex = 'gspike') {
    const marker = this.add.image(x, groundY - 2, 'glow-soul').setBlendMode('ADD').setTint(tex === 'hairspike' ? 0xc070ff : 0xffa040).setScale(0.9, 0.45).setDepth(DEPTH.FG + 3);
    this.tweens.add({ targets: marker, alpha: { from: 0.35, to: 1 }, scaleX: { from: 0.6, to: 1.1 }, duration: 120, yoyo: true, repeat: -1 });
    const sprite = this.add.image(x, groundY, tex).setOrigin(0.5, 1).setDepth(DEPTH.FX).setVisible(false).setScale(1, 0.1);
    this.projectiles.push({ kind: 'gspike', sprite, marker, delay, vx: 0, vy: 0, dir: 0, life: delay + 0.75, hit: false, damage: 26 });
  }

  // ------------------------------------------------------------------ frozen arena (Frost Matriarch, phase 2)
  /** the arena floor turns to ice (you slide; she doesn't) */
  freezeArena() {
    const arena = this.level.boss;
    if (!arena || this.frozenTiles.length) return;
    const row = Math.round(arena.y / TILE);
    const c0 = Math.floor(arena.fogX / TILE) + 1;
    for (let c = c0; c < this.level.cols - 1; c++) {
      const t = this.layer.getTileAt(c, row);
      if (!t || (t.index !== T.TOP && t.index !== T.STONE)) continue;
      this.frozenTiles.push({ c, r: row, idx: t.index });
      // spreads outward from her feet
      const delay = Math.abs(c * TILE - (this.boss?.x ?? 0)) * 2.2;
      this.time.delayedCall(delay, () => {
        if (!this.frozenTiles.length) return;
        const nt = this.layer.putTileAt(T.ICE, c, row);
        nt.setCollision(true, true, true, true);
        nt.tint = 0xffffff;
        if (c % 2 === 0) this.fx.status(c * TILE + 8, row * TILE, 'cold', 3);
      });
    }
    useGameStore.getState().showToast('The floor freezes over');
  }

  /** put the stone back – at once (reset) or melting outward (victory) */
  private thawArena(animated: boolean) {
    const tiles = this.frozenTiles;
    if (!tiles.length) return;
    this.frozenTiles = [];
    tiles.forEach((f, i) => {
      const put = () => {
        const nt = this.layer.putTileAt(f.idx, f.c, f.r);
        nt.setCollision(true, true, true, true);
        nt.tint = 0xc4d4ec;
      };
      if (animated) this.time.delayedCall(300 + i * 25, put);
      else put();
    });
  }


  private moverPos(m: Mover, t: number) {
    const k = 0.5 - 0.5 * Math.cos(((t / m.period + m.phase) % 1) * Math.PI * 2);
    return { x: m.x0 + m.dx * k, y: m.y0 + m.dy * k };
  }

  /**
   * Steer each platform towards where it should be next frame (velocity, so Arcade carries riders
   * sideways), and keep a rider glued on when the platform sinks faster than they would fall.
   */
  private updateMovers(dt: number) {
    const p = this.player;
    p.riding = false;
    if (!this.movers.length) return;
    const step = Math.max(dt, 1 / 120);
    for (const m of this.movers) {
      // never drift off the track: if physics and the scene clock fell out of step (frame drops,
      // hitstop, a slow phone), put the slab back where it should be before steering on
      const now = this.moverPos(m, this.t);
      if (Math.abs(m.body.x - now.x) > 3 || Math.abs(m.body.y - now.y) > 3) {
        m.s.setPosition(now.x, now.y);
        m.body.reset(now.x, now.y);
      }
      const next = this.moverPos(m, this.t + step);
      m.body.setVelocity((next.x - m.body.x) / step, (next.y - m.body.y) / step);
      if (!p.alive || p.body.velocity.y < -20) continue;
      const top = m.body.y;
      const onIt = p.body.right > m.body.x + 2 && p.body.x < m.body.right - 2 && p.feetY >= top - 3 && p.feetY <= top + 5;
      if (!onIt) continue;
      p.riding = true;
      p.body.y = top - p.body.height;
      if (p.body.velocity.y > m.body.velocity.y) p.body.velocity.y = Math.max(0, m.body.velocity.y);
    }
  }

  private updateLava(dt: number) {
    for (const s of this.lavaSurfaces) s.tilePositionX += 6 * dt;
    // rising sparks near the camera
    const view = this.cameras.main.worldView;
    for (const lp of this.lavaPoints) {
      if (lp.x < view.x - 20 || lp.x > view.right + 20 || lp.y < view.y - 20 || lp.y > view.bottom + 40) continue;
      if (Math.random() < 0.9 * dt) this.fx.ember(lp.x + Phaser.Math.Between(-20, 20), lp.y - 2, 2);
    }
  }

  /**
   * Make every prop physically plausible before it's placed:
   *  - wall torches / banners are pushed against the nearest wall (flipped to face away from it);
   *    with no wall nearby a torch becomes a standing floor torch, a banner hangs from the ceiling,
   *  - chains and lanterns marked `hang` must hang from a ceiling,
   *  - everything else stands on the ground below it.
   * Props that can't be placed are dropped. Mutates level.props so lights follow the new positions.
   */
  private placeProps() {
    const WALL = new Set(['wall_torch', 'banner']);
    const placed: LevelData['props'] = [];
    const ceilingAbove = (x: number, y: number) => {
      for (let yy = y; yy > y - 200; yy -= 4) if (this.isSolidAt(x, yy)) return (Math.floor(yy / TILE) + 1) * TILE;
      return null;
    };
    for (const pr of this.level.props) {
      const half = (16 * (PROP_SCALE[pr.key] ?? 0.7)) / 2;
      if (WALL.has(pr.key)) {
        const y = pr.y + 8;
        let wall: { x: number; side: -1 | 1 } | null = null;
        for (let d = 0; d <= 40 && !wall; d += 2) {
          if (this.isSolidAt(pr.x - d, y)) wall = { x: (Math.floor((pr.x - d) / TILE) + 1) * TILE, side: -1 };
          else if (this.isSolidAt(pr.x + d, y)) wall = { x: Math.floor((pr.x + d) / TILE) * TILE, side: 1 };
        }
        if (wall) {
          placed.push({ ...pr, x: wall.x - wall.side * half, hang: true, flip: wall.side > 0 });
          continue;
        }
        if (pr.key === 'wall_torch') {
          const ground = this.surfaceAt(pr.x, pr.y, pr.y + 240);
          if (ground !== null) placed.push({ ...pr, key: 'torch', y: ground, hang: false });
          continue;
        }
        const ceil = ceilingAbove(pr.x, pr.y);
        if (ceil !== null) placed.push({ ...pr, y: ceil, hang: true });
        continue;
      }
      if (pr.hang) {
        const ceil = ceilingAbove(pr.x, pr.y + 4);
        if (ceil !== null) placed.push({ ...pr, y: ceil });
        continue;
      }
      const ground = this.surfaceAt(pr.x, pr.y - 24, pr.y + 160);
      if (ground !== null) placed.push({ ...pr, y: ground });
    }
    this.level.props = placed;
  }

  private createProps() {
    this.placeProps();
    for (const pr of this.level.props) {
      const img = this.add
        .image(pr.x, pr.y, `prop:${pr.key}`)
        .setOrigin(0.5, pr.hang ? 0 : 1)
        .setScale(PROP_SCALE[pr.key] ?? 0.7)
        .setFlipX(!!pr.flip)
        .setDepth(DEPTH.DECOR + 1);
      if (pr.light) {
        const glow = this.add
          .image(pr.x, img.getCenter().y ?? pr.y, 'glow')
          .setBlendMode('ADD')
          .setScale(pr.key === 'torch' || pr.key === 'wall_torch' ? 0.6 : 0.35)
          .setAlpha(0.45)
          .setDepth(DEPTH.DECOR);
        this.tweens.add({
          targets: glow,
          alpha: { from: 0.32, to: 0.5 },
          duration: Phaser.Math.Between(90, 160),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
  }

  /** Item on the ground: its atlas sprite (or a soul wisp) over a pulsing glow. */
  spawnPickup(x: number, y: number, item: string, qty: number, id: string | null = null) {
    const gear = ITEMS[item]?.kind === 'weapon' || ITEMS[item]?.kind === 'armor';
    const glow = this.add.image(x, y - 6, 'glow-soul').setBlendMode('ADD').setDepth(DEPTH.ITEMS);
    const tex = this.textures.exists(`item:${item}`) ? `item:${item}` : 'wisp';
    const sprite = this.add.image(x, y - 6, tex).setDepth(DEPTH.ITEMS + 1);
    if (tex === 'wisp') sprite.setBlendMode('ADD');
    if (gear) glow.setTint(0xffd080).setScale(1.3);
    this.pickups.push({ id, item, qty, sprite, glow, baseY: y - 6 });
  }

  private createBossArena() {
    const b = this.level.boss;
    if (!b) return;
    const gate = this.add.zone(b.fogX, this.mapH / 2, 12, this.mapH);
    this.physics.add.existing(gate, true);
    this.gateCollider = this.physics.add.collider(this.player.sprite, gate);
    this.gateCollider.active = false;
    if (this.hasFlag(b.flag)) return;
    this.boss = makeBoss(this, b.type, b.x, b.y);
    this.fog = this.add.tileSprite(b.fogX, b.y, 20, 112, 'fogwall').setOrigin(0.5, 1).setDepth(DEPTH.FG).setAlpha(0.6);
  }

  private placeStain() {
    if (this.stain) {
      this.stain.sprite.destroy();
      this.stain.glow.destroy();
      this.stain = null;
    }
    const s = this.world.bloodstain;
    if (!s || s.area !== this.area) return;
    const glow = this.add.image(s.x, s.y - 4, 'glow-soul').setBlendMode('ADD').setTint(0x60ff90).setDepth(DEPTH.ITEMS);
    const sprite = this.add.image(s.x, s.y - 4, 'stain').setDepth(DEPTH.ITEMS + 1);
    this.stain = { sprite, glow, souls: s.souls };
  }

  private areaTrack() {
    const t = this.level.theme;
    return t === 'outdoor' || t === 'frost' || t === 'desert' || t === 'sky' || t === 'ash' ? 'hollow' : 'crypt';
  }

  // ------------------------------------------------------------------ world flags + doors
  private hasFlag(flag: string): boolean {
    if (flag === 'allBosses') return ALL_BOSSES.every((f) => this.hasFlag(f));
    return flag === 'bossDefeated' ? this.world.bossDefeated : !!this.world.flags[flag];
  }

  private setFlag(flag: string) {
    if (flag === 'bossDefeated') this.world.bossDefeated = true;
    else this.world.flags[flag] = true;
  }

  private refreshDoors() {
    for (const d of this.doors) d.refresh(!d.def.requires || this.hasFlag(d.def.requires));
  }

  private useDoor(d: Door) {
    if (d.def.requires && !this.hasFlag(d.def.requires)) {
      if (d.def.requires === 'allBosses') {
        const n = ALL_BOSSES.filter((f) => this.hasFlag(f)).length;
        useGameStore.getState().showToast(`${d.def.lockedMsg ?? 'Sealed.'} (${n} of ${ALL_BOSSES.length} great souls)`);
        sfx.locked();
        return;
      }
      useGameStore.getState().showToast(d.def.lockedMsg ?? 'Locked.');
      sfx.locked();
      return;
    }
    if (d.def.sets && !this.world.flags[d.def.sets]) {
      this.world.flags[d.def.sets] = true;
      useGameStore.getState().showToast('A shortcut has been opened');
    }
    this.travel(d.def.to, d.def.entry);
  }

  /** Fade out and rebuild the scene in another area, keeping hp/stamina. */
  private travel(area: string, entry: string) {
    if (this.travelling) return;
    this.travelling = true;
    sfx.door();
    saveGame(this.world);
    this.registry.set('carry', { hp: this.player.hp, stamina: this.player.stamina });
    this.player.body.setVelocity(0, 0);
    this.cameras.main.fadeOut(350);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({ area, entry }));
  }

  // ------------------------------------------------------------------ dialogue (driven by React)
  private onDialogueNode(npcId: string, nodeId: string) {
    const node = NPCS[npcId]?.nodes[nodeId];
    if (!node) return;
    // `sets` guards one-time effects such as gifts
    if (node.sets && !this.world.flags[node.sets]) {
      this.world.flags[node.sets] = true;
      for (const g of node.gives ?? []) {
        useInventoryStore.getState().add(g.item, g.qty);
        useGameStore.getState().showToast(`${ITEMS[g.item]?.name ?? g.item}  ×${g.qty}`);
        sfx.souls();
      }
      saveGame(this.world);
    }
  }

  private talkTo(n: Npc) {
    this.talkingTo = n;
    n.talking = true;
    this.player.body.setVelocityX(0);
    useGameStore.setState({ dialogue: { npc: n.def.id, node: n.def.start(this.world.flags) }, prompt: null });
  }

  // ------------------------------------------------------------------ boss helpers
  mapHeight() {
    return this.mapH;
  }

  mapWidth() {
    return this.mapW;
  }

  /** walkable x-range inside the boss arena (between the fog gate and the far wall) */
  arenaBounds(): [number, number] {
    const b = this.level.boss;
    if (!b) return [40, this.mapW - 40];
    const lost = this.sunk.length / 2 + (this.sinkWarn ? 1 : 0);
    if (!lost) return [b.fogX + 28, this.mapW - 44];
    const [l, r] = this.collapseRange();
    return [Math.max(b.fogX + 28, (l + lost) * TILE + 20), Math.min(this.mapW - 44, (r - lost + 1) * TILE - 20)];
  }

  // ------------------------------------------------------------------ phase-2 arena collapse (lava arenas)
  /** first and last floor column of the arena */
  private collapseRange(): [number, number] {
    return [Math.floor(this.level.boss!.fogX / TILE), this.level.cols - 3];
  }

  /**
   * Below half HP the floor at both ends of the arena glows, cracks and sinks into lava, one column
   * per side at a time – three right away, then more the weaker the boss gets (up to COLLAPSE_MAX).
   */
  private updateCollapse(dt: number) {
    const b = this.boss;
    const arena = this.level.boss;
    if (!b || !arena || this.level.theme !== 'lava') return;
    const w = this.sinkWarn;
    if (w) {
      w.t -= dt;
      const hot = Math.floor(w.t * (w.t < 0.35 ? 22 : 10)) % 2 === 0;
      const row = Math.round(arena.y / TILE);
      for (const c of w.cols)
        for (let k = 0; k < COLLAPSE_DEPTH; k++) {
          const t = this.layer.getTileAt(c, row + k);
          if (t) t.tint = hot ? 0xff7a3a : 0xb4908a;
        }
      if (Math.random() < 0.5) {
        const c = w.cols[Math.floor(Math.random() * w.cols.length)];
        this.fx.ember(c * TILE + 8, row * TILE, 2);
      }
      if (w.t <= 0) {
        for (const c of w.cols) this.sinkColumn(c, row);
        this.sinkWarn = null;
        this.sinkGap = 0.3;
        this.combat.shake(0.006, 200);
        sfx.slam();
      }
      return;
    }
    if (!this.bossActive || !b.alive || b.phase !== 2) return;
    if ((this.sinkGap -= dt) > 0) return;
    const f = Phaser.Math.Clamp((0.5 - b.hp / b.cfg.hp) / 0.4, 0, 1);
    const want = Math.min(COLLAPSE_MAX, 3 + Math.round(f * (COLLAPSE_MAX - 3)));
    const pairs = this.sunk.length / 2;
    if (pairs >= want) return;
    if (pairs === 0) useGameStore.getState().showToast('The floor gives way to the lava!');
    const [l, r] = this.collapseRange();
    this.sinkWarn = { cols: [l + pairs, r - pairs], t: COLLAPSE_WARN };
  }

  private sinkColumn(c: number, row: number) {
    const saved: number[] = [];
    for (let k = 0; k <= COLLAPSE_DEPTH; k++) {
      saved.push(this.layer.getTileAt(c, row + k)?.index ?? -1);
      if (k < COLLAPSE_DEPTH) this.layer.removeTileAt(c, row + k);
    }
    this.layer.putTileAt(T.LAVA, c, row + COLLAPSE_DEPTH);
    const y = (row + COLLAPSE_DEPTH) * TILE;
    const surf = this.addLavaSurface(c * TILE, y, TILE);
    surf.tilePositionX = c * 7;
    this.lavaSurfaces.push(surf);
    this.sunk.push({ c, saved, surf });
    this.fx.dust(c * TILE + 8, row * TILE + 4, 8);
    this.fx.ember(c * TILE + 8, y - 4, 10);
  }

  /** Put the floor back – instantly (reset), or rising column by column from the middle out (victory). */
  private restoreArena(animated: boolean) {
    const arena = this.level.boss;
    if (!arena) return;
    const row = Math.round(arena.y / TILE);
    if (this.sinkWarn) {
      for (const c of this.sinkWarn.cols)
        for (let k = 0; k < COLLAPSE_DEPTH; k++) {
          const t = this.layer.getTileAt(c, row + k);
          if (t) t.tint = 0xb4908a;
        }
      this.sinkWarn = null;
    }
    const cols = [...this.sunk].reverse(); // innermost first
    this.sunk = [];
    cols.forEach((s, i) => {
      const put = () => {
        s.saved.forEach((idx, k) => {
          if (idx < 0) this.layer.removeTileAt(s.c, row + k);
          else this.layer.putTileAt(idx, s.c, row + k).tint = 0xb4908a;
        });
        this.lavaSurfaces = this.lavaSurfaces.filter((l) => l !== s.surf);
        (s.surf.getData('body') as Phaser.GameObjects.GameObject | undefined)?.destroy();
        s.surf.destroy();
        if (animated) {
          this.fx.dust(s.c * TILE + 8, row * TILE, 8);
          if (i % 2 === 0) this.combat.shake(0.003, 90);
        }
      };
      if (animated) this.time.delayedCall(400 + Math.floor(i / 2) * 140, put);
      else put();
    });
  }

  /** a reeling (parried) enemy close in front of the player, if any */
  riposteTarget(p: Player): Enemy | null {
    let best: Enemy | null = null;
    let bestD = 40;
    const pool: Enemy[] = this.boss && this.bossActive ? [...this.enemies, this.boss] : this.enemies;
    for (const e of pool) {
      if (!e.alive || e.riposteT <= 0) continue;
      const dx = e.x - p.x;
      // measured to the edge of its body, so big (boss) bodies can be riposted too
      const d = Math.max(0, Math.abs(dx) - Math.max(0, e.body.width / 2 - 7));
      if (d >= bestD || Math.abs(e.body.bottom - p.feetY) > 24) continue;
      if (d > 10 && Math.sign(dx) !== p.facing) continue;
      best = e;
      bestD = d;
    }
    return best;
  }

  summonedAlive() {
    return this.enemies.filter((e) => e.summoned && e.alive).length;
  }

  /** a boss raises an add: it crawls out of the ground and joins the fight */
  summon(type: string, x: number, y: number) {
    const e = makeEnemy(this, type, x, y, true);
    e.state = 'chase';
    e.sprite.setAlpha(0);
    this.tweens.add({ targets: e.sprite, alpha: 1, duration: 500 });
    this.fx.dust(x, y, 16);
    this.enemies.push(e);
  }

  private clearSummons() {
    this.enemies = this.enemies.filter((e) => {
      if (!e.summoned) return true;
      e.destroy();
      return false;
    });
  }

  /** bone falling from the vault after `delay` seconds; a glowing marker shows where it lands */
  spawnFallingBone(x: number, delay: number) {
    const groundY = this.level.boss?.y ?? this.player.feetY;
    // a pulsing warm marker where the bone will land, drawn above the darkness so it's always readable
    const marker = this.add.image(x, groundY - 2, 'glow-soul').setBlendMode('ADD').setTint(0xffa060).setScale(1.1, 0.5).setDepth(DEPTH.FG + 3);
    this.tweens.add({ targets: marker, alpha: { from: 0.35, to: 1 }, scaleX: { from: 0.8, to: 1.2 }, duration: 140, yoyo: true, repeat: -1 });
    const top = this.cameras.main.worldView.top - 12;
    const sprite = this.add.image(x, Math.max(top, 8), 'prop:bone').setDepth(DEPTH.FX).setVisible(false);
    this.projectiles.push({ kind: 'bone', sprite, marker, delay, vx: 0, vy: 0, dir: 0, life: delay + 2.5, hit: false, damage: 26 });
  }

  // ------------------------------------------------------------------ queries used by entities
  targets(): Hittable[] {
    const list: Hittable[] = this.enemies.filter((e) => e.alive);
    if (this.boss && this.bossActive && this.boss.alive) list.push(this.boss);
    return list;
  }

  /** solid or one-way tile at a world point */
  isGroundAt(x: number, y: number) {
    const t = this.layer.getTileAtWorldXY(x, y);
    return !!t && (t.collides || t.index === T.PLANK);
  }

  isOneWayBelow(x: number, feetY: number) {
    const t = this.layer.getTileAtWorldXY(x, feetY + 2);
    return !!t && t.index === T.PLANK;
  }

  isSolidAt(x: number, y: number) {
    const t = this.layer.getTileAtWorldXY(x, y);
    return !!t && t.collides && t.index !== T.PLANK;
  }

  isPlankAt(x: number, y: number) {
    const t = this.layer.getTileAtWorldXY(x, y);
    return !!t && t.index === T.PLANK;
  }

  isSpikeAt(x: number, y: number) {
    const t = this.layer.getTileAtWorldXY(x, y);
    return !!t && t.index === T.SPIKE;
  }

  isIceAt(x: number, y: number) {
    const t = this.layer.getTileAtWorldXY(x, y);
    return !!t && t.index === T.ICE;
  }

  isBogAt(x: number, y: number) {
    const t = this.layer.getTileAtWorldXY(x, y);
    return !!t && t.index === T.BOG;
  }

  isLavaAt(x: number, y: number) {
    const t = this.layer.getTileAtWorldXY(x, y);
    return !!t && t.index === T.LAVA;
  }

  /**
   * First standable surface (top of a solid or plank tile with air above it) scanning down
   * from `fromY` to `toY` at column x. Returns its y, or null if there is none or spikes come first.
   */
  surfaceAt(x: number, fromY: number, toY: number): number | null {
    for (let y = fromY; y <= toY; y += 4) {
      if (this.isSpikeAt(x, y) || this.isLavaAt(x, y) || this.isBogAt(x, y)) return null;
      if (this.isGroundAt(x, y) && !this.isGroundAt(x, y - 6)) return Math.floor(y / TILE) * TILE;
    }
    return null;
  }

  // ------------------------------------------------------------------ events from entities
  onEnemyKilled(e: Enemy) {
    const souls = e.cfg.souls;
    this.fx.soulsTo(
      e.x,
      e.y,
      () => ({ x: this.player.x, y: this.player.y }),
      () => {
        usePlayerStore.getState().addSouls(souls);
        sfx.souls();
      },
      e === this.boss ? 20 : 6,
    );
    for (const d of e.summoned ? [] : e.cfg.drops ?? []) {
      if (Math.random() < d.chance) this.spawnPickup(e.x + Phaser.Math.Between(-6, 6), e.body.bottom, d.item, d.qty ?? 1);
    }
    if (e === this.boss) this.onBossDefeated();
  }

  onPlayerDeath() {
    const souls = usePlayerStore.getState().souls;
    this.world.bloodstain = souls > 0 ? { area: this.area, x: this.player.lastSafe.x, y: this.player.lastSafe.y, souls } : null;
    usePlayerStore.setState({ souls: 0 });
    if (this.stain) {
      this.stain.sprite.destroy();
      this.stain.glow.destroy();
      this.stain = null;
    }
    useGameStore.setState({ prompt: null, restOpen: false, dialogue: null, shop: null });
    saveGame(this.world);
    this.time.delayedCall(900, () => useGameStore.setState({ dead: true }));
    this.time.delayedCall(4200, () => this.cameras.main.fadeOut(400));
    this.time.delayedCall(4650, () => this.respawn());
  }

  spawnShockwave(x: number, y: number, dir: number) {
    const sprite = this.add.sprite(x, y, 'wave', 'w0').setOrigin(0.5, 1).setFlipX(dir < 0).setDepth(DEPTH.FX);
    this.projectiles.push({ kind: 'wave', sprite, vx: dir * 170, vy: 0, dir, life: 1.8, hit: false, damage: 26 });
  }

  /**
   * Lobbed glob of lava, landing at targetX (default: where the player stands now).
   * Blockable; bursts into embers on whatever it hits.
   */
  spawnLavaGlob(x: number, y: number, damage: number, targetX?: number) {
    const p = this.player;
    const tx = targetX ?? p.x;
    const dx = tx - x;
    const dy = p.feetY - 6 - y;
    const tFlight = Phaser.Math.Clamp(Math.abs(dx) / 150, 0.55, 1.3);
    const vx = dx / tFlight;
    const vy = (dy - 0.5 * GLOB_GRAVITY * tFlight * tFlight) / tFlight;
    const sprite = this.add.image(x, y, 'glob').setDepth(DEPTH.FX);
    this.projectiles.push({ kind: 'glob', sprite, vx, vy, dir: Math.sign(vx) || 1, life: 3, hit: false, damage });
    sfx.swing();
  }

  /** A wall of lava rolling along the ground from (x, groundY), dying out after `reach` px. Not blockable. */
  spawnLavaWave(x: number, groundY: number, dir: number, speed: number, reach: number) {
    // taller than a jump clears: you have to outrun it
    const sprite = this.add.sprite(x, groundY, 'lava-wave', 'w0').setOrigin(0.5, 1).setFlipX(dir < 0).setDepth(DEPTH.FX).setScale(1.4, 0.2);
    this.tweens.add({ targets: sprite, scaleY: LAVA_WAVE_SY, duration: 260, ease: 'Back.easeOut' });
    this.projectiles.push({ kind: 'lavawave', sprite, vx: dir * speed, vy: 0, dir, life: reach / speed + 0.5, hit: false, damage: 40, startX: x, reach });
  }

  /** Arrow aimed at the player's current position along a shallow arc. */
  spawnArrow(x: number, y: number, dir: number, opts: { tex?: string; damage?: number } = {}) {
    const p = this.player;
    const dx = p.x - x;
    const dy = p.y - 2 - y;
    const tFlight = Phaser.Math.Clamp(Math.abs(dx) / ARROW_SPEED, 0.15, 1.4);
    const vx = Math.sign(dx || dir) * ARROW_SPEED;
    const vy = Phaser.Math.Clamp((dy - 0.5 * ARROW_GRAVITY * tFlight * tFlight) / tFlight, -260, 260);
    const sprite = this.add.image(x, y, opts.tex ?? 'arrow').setDepth(DEPTH.FX);
    this.projectiles.push({ kind: 'arrow', sprite, vx, vy, dir: Math.sign(vx), life: 2.2, hit: false, damage: opts.damage ?? 17 });
    sfx.arrow();
  }

  /** a cloud puff lobbed at the player (Sky Leviathan, cloud slimes): blockable, nothing else */
  spawnPuff(x: number, y: number, damage: number, targetX?: number) {
    const p = this.player;
    const tx = targetX ?? p.x;
    const dx = tx - x;
    const dy = p.feetY - 6 - y;
    const tFlight = Phaser.Math.Clamp(Math.abs(dx) / 150, 0.55, 1.3);
    const vx = dx / tFlight;
    const vy = (dy - 0.5 * GLOB_GRAVITY * tFlight * tFlight) / tFlight;
    const sprite = this.add.image(x, y, 'puff').setDepth(DEPTH.FX);
    this.projectiles.push({ kind: 'puff', sprite, vx, vy, dir: Math.sign(vx) || 1, life: 3, hit: false, damage });
    sfx.swing();
  }

  /** a shard of ice (or a wind bolt) flying straight at the player's chest; blockable; frost builds if `frost` > 0 */
  spawnShard(x: number, y: number, damage = 14, frost = 30, aimDy = 0, tex = 'shard') {
    const p = this.player;
    const dx = p.x - x;
    const dy = p.y - 2 + aimDy - y;
    const d = Math.max(1, Math.hypot(dx, dy));
    const vx = (dx / d) * SHARD_SPEED;
    const vy = (dy / d) * SHARD_SPEED;
    const sprite = this.add.image(x, y, tex).setDepth(DEPTH.FX).setRotation(Math.atan2(vy, vx));
    this.projectiles.push({
      kind: 'shard', sprite, vx, vy, dir: Math.sign(vx) || 1, life: 2.4, hit: false, damage,
      status: frost > 0 ? { type: 'cold', amount: frost } : undefined,
    });
    sfx.arrow();
  }

  /** boss icicle rain: a pale marker on the floor, then an icicle drops out of the dark */
  spawnFallingIcicle(x: number, delay: number) {
    const groundY = this.level.boss?.y ?? this.player.feetY;
    const marker = this.add.image(x, groundY - 2, 'glow-soul').setBlendMode('ADD').setTint(0x9ad8ff).setScale(1.1, 0.5).setDepth(DEPTH.FG + 3);
    this.tweens.add({ targets: marker, alpha: { from: 0.35, to: 1 }, scaleX: { from: 0.8, to: 1.2 }, duration: 140, yoyo: true, repeat: -1 });
    const top = Math.max(this.cameras.main.worldView.top - 16, 4);
    const sprite = this.add.image(x, top, 'icicle').setOrigin(0.5, 0).setDepth(DEPTH.FX).setVisible(false);
    this.projectiles.push({ kind: 'icicle', sprite, marker, delay, vx: 0, vy: 0, dir: 0, life: delay + 2.5, hit: false, damage: 24, status: { type: 'cold', amount: 32 } });
  }

  /** lobbed toxic glob: lands where the player stands (or at targetX) and leaves a poison puddle */
  spawnToxGlob(x: number, y: number, damage: number, targetX?: number) {
    const p = this.player;
    const tx = targetX ?? p.x;
    const dx = tx - x;
    const dy = p.feetY - 6 - y;
    const tFlight = Phaser.Math.Clamp(Math.abs(dx) / 140, 0.6, 1.3);
    const vx = dx / tFlight;
    const vy = (dy - 0.5 * GLOB_GRAVITY * tFlight * tFlight) / tFlight;
    const sprite = this.add.image(x, y, 'toxglob').setDepth(DEPTH.FX);
    this.projectiles.push({ kind: 'toxglob', sprite, vx, vy, dir: Math.sign(vx) || 1, life: 3, hit: false, damage, status: { type: 'poison', amount: 35 } });
    sfx.swing();
  }

  /** a low wall of mire water rolling along the floor – low enough to jump */
  spawnBogWave(x: number, groundY: number, dir: number, speed: number, reach: number) {
    const sprite = this.add.sprite(x, groundY, 'bog-wave', 'w0').setOrigin(0.5, 1).setFlipX(dir < 0).setDepth(DEPTH.FX).setScale(1.2, 0.2);
    this.tweens.add({ targets: sprite, scaleY: 1, duration: 200, ease: 'Back.easeOut' });
    this.projectiles.push({
      kind: 'bogwave', sprite, vx: dir * speed, vy: 0, dir, life: reach / speed + 0.5, hit: false, damage: 20,
      startX: x, reach, status: { type: 'poison', amount: 45 },
    });
  }


  // ------------------------------------------------------------------ flow
  private respawn() {
    useGameStore.setState({ dead: false, boss: null });
    // the last bonfire may be in another area
    const home = this.world.lastArea ?? START_AREA;
    if (home !== this.area) {
      usePlayerStore.setState((s) => ({ flasks: s.maxFlasks }));
      this.scene.restart({ area: home });
      return;
    }
    const sp = this.spawnPoint();
    this.entry = undefined;
    this.player.respawn(sp.x, sp.y);
    usePlayerStore.setState((s) => ({ flasks: s.maxFlasks }));
    this.spawnEnemies();
    this.resetBoss();
    this.resetHazards();
    this.placeStain();
    this.cameras.main.fadeIn(700);
  }

  private resetBoss() {
    for (const p of this.projectiles) {
      p.sprite.destroy();
      p.marker?.destroy();
    }
    this.projectiles = [];
    this.clearSummons();
    this.restoreArena(false);
    this.thawArena(false);
    this.mendArena();
    this.setGloom(false);
    this.setSandstorm(false);
    this.clearGas();
    this.bossActive = false;
    if (this.gateCollider) this.gateCollider.active = false;
    // each arena has its own flag (the Warden's is the legacy world.bossDefeated)
    if (this.boss && this.level.boss && !this.hasFlag(this.level.boss.flag)) {
      sfx.playMusic(this.areaTrack());
      this.boss.reset();
      this.fog?.setAlpha(0.6);
    }
  }

  private restAt(b: Bonfire) {
    sfx.bonfire();
    if (!b.lit) {
      b.light();
      this.world.lit.push(b.id);
      useGameStore.getState().showBanner('BONFIRE LIT', 'gold');
      this.fx.ember(b.x, b.y - 10, 30);
    }
    this.player.rest();
    this.player.heal();
    usePlayerStore.setState((s) => ({ flasks: s.maxFlasks }));
    this.world.lastBonfire = b.id;
    this.world.lastArea = this.area;
    this.entry = undefined;
    this.spawnEnemies();
    this.resetBoss();
    this.resetHazards();
    useGameStore.setState({ boss: null });
    saveGame(this.world);
    useGameStore.setState({ restOpen: true, prompt: null });
  }

  private onBossDefeated() {
    const arena = this.level.boss!;
    this.setFlag(arena.flag);
    this.bossActive = false;
    if (this.gateCollider) this.gateCollider.active = false;
    for (const e of this.enemies) if (e.summoned && e.alive) e.die(0);
    this.restoreArena(true);
    this.thawArena(true);
    this.time.delayedCall(1200, () => this.mendArena());
    this.setGloom(false);
    this.setSandstorm(false);
    sfx.victory();
    sfx.playMusic(null);
    this.time.delayedCall(6000, () => sfx.playMusic(this.areaTrack()));
    useGameStore.getState().showBanner(arena.banner, 'gold', arena.sub);
    if (this.fog) this.tweens.add({ targets: this.fog, alpha: 0, duration: 1500 });
    this.refreshDoors();
    this.time.delayedCall(2500, () => {
      useGameStore.setState({ boss: null });
      saveGame(this.world);
    });
    // the last boss of the pre-release: once the banner has had its moment, the ending card
    if (arena.flag === 'kingDefeated') this.time.delayedCall(5200, () => this.player.alive && useGameStore.setState({ ending: true }));
  }

  // ------------------------------------------------------------------ debug menu (?debug) – see components/Debug
  /** jump to a spot in any area (restarts the scene, keeps hp/stamina) */
  debugGoto(area: string, at: { x: number; y: number }) {
    if (!AREAS[area] || this.travelling) return;
    this.registry.set('carry', { hp: this.player.hp, stamina: this.player.stamina });
    resetTouchInput();
    this.scene.restart({ area, at });
  }

  debugHeal() {
    this.player.heal();
    this.player.stamina = derived().maxStamina;
    usePlayerStore.setState((s) => ({ flasks: s.maxFlasks }));
  }

  debugKillEnemies() {
    for (const e of this.enemies) if (e.alive) e.die(0);
  }

  /** set the boss to a fraction of its HP (0 kills it) – only once the fight has started */
  debugBossHp(frac: number): string {
    const b = this.boss;
    if (!b || !b.alive) return 'No boss alive in this area';
    if (!this.bossActive) return 'Walk through the fog gate first';
    b.debugSetHp(frac);
    return frac <= 0 ? `${b.cfg.name} killed` : `${b.cfg.name} → ${Math.round(frac * 100)}%`;
  }

  debugLightBonfires() {
    for (const b of this.bonfires) {
      if (b.lit) continue;
      b.light();
      this.world.lit.push(b.id);
    }
    saveGame(this.world);
  }

  /** world flags incl. the Warden's legacy `bossDefeated` */
  debugFlags(): Record<string, boolean> {
    return { bossDefeated: this.world.bossDefeated, ...this.world.flags };
  }

  debugSetFlag(flag: string, on: boolean) {
    if (on) this.setFlag(flag);
    else if (flag === 'bossDefeated') this.world.bossDefeated = false;
    else delete this.world.flags[flag];
    this.refreshDoors();
    saveGame(this.world);
  }

  debugSave() {
    saveGame(this.world);
  }

  // ------------------------------------------------------------------ loop
  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    this.t += dt;
    this.controls.update();
    this.combat.tick();

    if (this.combat.frozen) {
      // hitstop: everything holds still, but inputs are still buffered
      this.player.bufferInputs(this.controls);
      this.drawDebug();
      return;
    }

    this.updateMovers(dt);
    this.player.update(dt, this.controls);
    for (const e of this.enemies) e.update(dt);
    this.boss?.update(dt);
    this.updateProjectiles(dt);
    this.updateLava(dt);
    this.updateBog(dt);
    this.updateCrumbles(dt);
    this.updateIcicles(dt);
    this.updateGas(dt);
    this.updateCollapse(dt);
    for (const b of this.bonfires) b.update(dt);
    for (const n of this.npcs) n.update(dt, this.player.x);

    this.checkHazards();
    this.checkInteract();
    this.checkPickups();
    this.checkBossTrigger();
    this.updateCamera(dt);
    this.lighting.update(dt, this.dynamicLights());
    this.drawDebug();
  }

  private updateProjectiles(dt: number) {
    const p = this.player;
    this.projectiles = this.projectiles.filter((pr) => {
      const s = pr.sprite;
      let dead = (pr.life -= dt) <= 0;
      if (pr.delay !== undefined && pr.delay > 0) {
        pr.delay -= dt;
        if (pr.delay <= 0) {
          s.setVisible(true);
          pr.marker?.destroy();
          pr.marker = undefined;
          if (pr.kind === 'gspike') {
            this.tweens.add({ targets: s, scaleY: 1, duration: 70, ease: 'Back.easeOut' });
            this.fx.dust(s.x, s.y, 6);
            sfx.bones();
          }
        }
        return true;
      }
      if (pr.kind === 'bone') {
        pr.vy += BONE_GRAVITY * dt;
        s.y += pr.vy * dt;
        s.rotation += 9 * dt;
        if (this.isSolidAt(s.x, s.y + 4)) {
          dead = true;
          this.fx.dust(s.x, s.y + 4, 6);
          sfx.bones();
        }
      } else if (pr.kind === 'wave') {
        s.x += pr.vx * dt;
        (s as Phaser.GameObjects.Sprite).setFrame(Math.floor(this.t * 14) % 2 ? 'w1' : 'w0');
        const ahead = s.x + pr.dir * 8;
        dead ||= !this.isGroundAt(ahead, s.y + 4) || this.isSolidAt(ahead, s.y - 6);
      } else if (pr.kind === 'lavawave') {
        s.x += pr.vx * dt;
        (s as Phaser.GameObjects.Sprite).setFrame(Math.floor(this.t * 8) % 2 ? 'w1' : 'w0');
        const ahead = s.x + pr.dir * 10;
        const gone = Math.abs(s.x - pr.startX!) / pr.reach!;
        // it sinks back down over the last stretch
        if (gone > 0.8 && !this.tweens.isTweening(s)) s.setScale(1.4, Math.max(0.2, (1 - gone) * 5 * LAVA_WAVE_SY));
        if (Math.random() < 0.5) this.fx.ember(s.x, s.y - 30 * s.scaleY, 1);
        dead ||= gone >= 1 || !this.isGroundAt(ahead, s.y + 4) || this.isSolidAt(ahead, s.y - 6);
      } else if (pr.kind === 'gspike') {
        // stands for a moment, then sinks back into the floor
        if (pr.life < 0.2) s.setScale(1, Math.max(0.05, pr.life / 0.2));
      } else if (pr.kind === 'shard') {
        s.x += pr.vx * dt;
        s.y += pr.vy * dt;
        if (Math.random() < 0.4) this.fx.status(s.x, s.y, 'cold', 1);
        dead ||= this.isSolidAt(s.x, s.y);
      } else if (pr.kind === 'icicle') {
        pr.vy += ICICLE_GRAVITY * dt;
        s.y += pr.vy * dt;
        if (this.isSolidAt(s.x, s.y + 14)) dead = true;
      } else if (pr.kind === 'bogwave') {
        s.x += pr.vx * dt;
        (s as Phaser.GameObjects.Sprite).setFrame(Math.floor(this.t * 10) % 2 ? 'w1' : 'w0');
        const ahead = s.x + pr.dir * 9;
        const gone = Math.abs(s.x - pr.startX!) / pr.reach!;
        if (Math.random() < 0.4) this.fx.status(s.x, s.y - 12, 'poison', 1);
        // it rolls over mire pools and planks, but breaks on a wall or a drop
        const floor = this.isGroundAt(ahead, s.y + 4) || this.isBogAt(ahead, s.y - 4) || this.isBogAt(ahead, s.y + 4);
        dead ||= gone >= 1 || !floor || this.isSolidAt(ahead, s.y - 6);
      } else if (pr.kind === 'glob' || pr.kind === 'toxglob' || pr.kind === 'puff') {
        pr.vy += GLOB_GRAVITY * dt;
        s.x += pr.vx * dt;
        s.y += pr.vy * dt;
        s.rotation += 6 * dt;
        dead ||=
          this.isSolidAt(s.x, s.y + 3) ||
          this.isLavaAt(s.x, s.y) ||
          this.isBogAt(s.x, s.y) ||
          (pr.vy > 0 && this.isGroundAt(s.x, s.y + 3) && !this.isGroundAt(s.x, s.y - 6));
      } else {
        pr.vy += ARROW_GRAVITY * dt;
        s.x += pr.vx * dt;
        s.y += pr.vy * dt;
        s.rotation = Math.atan2(pr.vy, pr.vx);
        dead ||= this.isSolidAt(s.x, s.y);
      }
      if (!pr.hit && p.alive) {
        const r =
          pr.kind === 'wave'
            ? new Phaser.Geom.Rectangle(s.x - 6, s.y - 14, 12, 14)
            : pr.kind === 'bogwave'
              ? new Phaser.Geom.Rectangle(s.x - 7, s.y - 16, 14, 16)
            : pr.kind === 'gspike'
              ? new Phaser.Geom.Rectangle(s.x - 4, s.y - 20 * s.scaleY, 8, 20 * s.scaleY)
            : pr.kind === 'icicle'
              ? new Phaser.Geom.Rectangle(s.x - 3, s.y + 2, 6, 12)
            : pr.kind === 'lavawave'
              ? new Phaser.Geom.Rectangle(s.x - 9, s.y - 40 * s.scaleY, 18, 40 * s.scaleY)
              : pr.kind === 'bone' || pr.kind === 'glob'
                ? new Phaser.Geom.Rectangle(s.x - 4, s.y - 4, 8, 8)
                : pr.kind === 'toxglob' || pr.kind === 'shard' || pr.kind === 'puff'
                  ? new Phaser.Geom.Rectangle(s.x - 4, s.y - 3, 8, 6)
                  : new Phaser.Geom.Rectangle(s.x - 3, s.y - 2, 6, 4);
        const rolling = pr.kind === 'wave' || pr.kind === 'lavawave' || pr.kind === 'bogwave' || pr.kind === 'gspike';
        if (Phaser.Geom.Intersects.RectangleToRectangle(r, p.hurtbox())) {
          // arrows, globs and shockwaves can be blocked; falling bones and lava waves can't
          const knock = pr.kind === 'lavawave' ? 240 : pr.kind === 'wave' ? 160 : pr.kind === 'glob' ? 110 : 90;
          const poise = pr.kind === 'lavawave' ? 60 : pr.kind === 'wave' ? 20 : pr.kind === 'glob' ? 16 : 12;
          const res = p.takeDamage(pr.damage, pr.dir, knock, poise, {
            blockable: pr.kind !== 'bone' && pr.kind !== 'lavawave' && pr.kind !== 'icicle' && pr.kind !== 'bogwave' && pr.kind !== 'gspike',
            element: pr.kind === 'glob' || pr.kind === 'lavawave' ? 'fire' : undefined,
            status: pr.status,
          });
          if (res === 'blocked' && (pr.kind === 'arrow' || pr.kind === 'glob' || pr.kind === 'toxglob' || pr.kind === 'shard' || pr.kind === 'puff')) {
            pr.hit = true;
            dead = true;
          }
          if (res === 'hit' || res === 'killed') {
            pr.hit = true;
            this.combat.shake(rolling ? 0.008 : 0.004);
            if (!rolling) dead = true;
          }
        }
      }
      if (dead) {
        if (pr.kind === 'wave') this.fx.ember(s.x, s.y - 4, 6);
        else if (pr.kind === 'lavawave') this.fx.ember(s.x, s.y - 6, 10);
        else if (pr.kind === 'glob') this.fx.ember(s.x, s.y, 12);
        else if (pr.kind === 'shard') this.fx.status(s.x, s.y, 'cold', 6);
        else if (pr.kind === 'puff') this.fx.cloud(s.x, s.y, 6);
        else if (pr.kind === 'icicle') {
          this.fx.status(s.x, s.y + 12, 'cold', 12);
          sfx.shatter();
        } else if (pr.kind === 'toxglob') {
          this.fx.status(s.x, s.y, 'poison', 10);
          // splashes into a lingering poison puddle where it lands
          if (!pr.hit) this.spawnGas(s.x, this.surfaceAt(s.x, s.y - 8, s.y + 40) ?? s.y + 4, 40, 4.5, 38);
        } else if (pr.kind === 'bogwave') this.fx.status(s.x, s.y - 6, 'poison', 8);
        else this.fx.dust(s.x, s.y, 3);
        s.destroy();
        pr.marker?.destroy();
        return false;
      }
      return true;
    });
  }

  private checkHazards() {
    const p = this.player;
    if (p.alive && debugState.god && (this.isLavaAt(p.x, p.feetY - 4) || this.isSpikeAt(p.x, p.feetY - 2) || p.feetY > this.mapH + 24)) {
      // god mode: back onto the last safe ground instead of dying
      p.body.reset(p.lastSafe.x, p.lastSafe.y);
    } else if (p.alive && this.isLavaAt(p.x, p.feetY - 4)) {
      this.fx.ember(p.x, p.feetY - 8, 40);
      this.combat.shake(0.01);
      p.hp = 0;
      p.die();
    } else if (p.alive && (this.isSpikeAt(p.x, p.feetY - 2) || p.feetY > this.mapH + 24)) {
      this.fx.bleed(p.x, p.feetY - 6, 16);
      p.hp = 0;
      p.die();
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const lava = this.isLavaAt(e.x, e.body.bottom - 4);
      if (lava && e.cfg.key === 'slime') continue; // born in it
      if ((e.cfg.key === 'wraith' || e.cfg.key === 'skywisp' || e.cfg.key === 'lantern') && !lava && e.body.bottom < this.mapH) continue; // floats over spikes
      if (lava || this.isSpikeAt(e.x, e.body.bottom - 2) || e.body.bottom > this.mapH + 24) {
        if (lava) this.fx.ember(e.x, e.body.bottom - 6, 20);
        e.die(0);
      }
    }
  }

  /** One interaction at a time, nearest first: bonfire → NPC → door. */
  private checkInteract() {
    const p = this.player;
    let prompt: string | null = null;
    if (p.state === 'move' && p.onGround && !this.travelling && !this.talkingTo) {
      const near = (x: number, y: number, r: number) => Math.abs(x - p.x) < r && Math.abs(y - p.feetY) < 20;
      const b = this.bonfires.find((b) => near(b.x, b.y, 22));
      const n = !b && this.npcs.find((n) => near(n.x, n.y, 26));
      const d = !b && !n && this.doors.find((d) => near(d.def.x, d.def.y, 16));
      const pressed = this.controls.pressed('interact');
      if (b) {
        prompt = b.lit ? 'Rest at bonfire' : 'Light bonfire';
        if (pressed) this.restAt(b);
      } else if (n) {
        prompt = `Talk to ${n.def.name.split(',')[0]}`;
        if (pressed) this.talkTo(n);
      } else if (d) {
        const open = !d.def.requires || this.hasFlag(d.def.requires);
        prompt = open ? 'Enter' : 'Examine door';
        if (pressed) this.useDoor(d);
      }
      if (pressed) prompt = null;
    }
    if (useGameStore.getState().prompt !== prompt) useGameStore.setState({ prompt });
  }

  private checkPickups() {
    const p = this.player;
    for (const it of this.pickups) {
      const bob = Math.sin(this.t * 3 + it.baseY) * 2;
      it.sprite.y = it.glow.y = it.baseY + bob;
      it.glow.setAlpha(0.6 + Math.sin(this.t * 5) * 0.2);
    }
    if (!p.alive) return;
    this.pickups = this.pickups.filter((it) => {
      if (Math.abs(it.sprite.x - p.x) > 14 || Math.abs(it.baseY - p.y) > 20) return true;
      it.sprite.destroy();
      it.glow.destroy();
      if (it.id) this.world.items.push(it.id);
      useInventoryStore.getState().add(it.item, it.qty);
      const def = ITEMS[it.item];
      useGameStore.getState().showToast(`${def?.name ?? it.item}${it.qty > 1 ? ` ×${it.qty}` : ''}`);
      sfx.pickup();
      saveGame(this.world);
      return false;
    });
    if (this.stain) {
      this.stain.glow.setAlpha(0.6 + Math.sin(this.t * 4) * 0.25);
      if (Math.abs(this.stain.sprite.x - p.x) < 16 && Math.abs(this.stain.sprite.y - p.y) < 24) {
        usePlayerStore.getState().addSouls(this.stain.souls);
        useGameStore.getState().showToast(`Souls retrieved  +${this.stain.souls}`);
        sfx.souls();
        this.fx.heal(p.x, p.y);
        this.stain.sprite.destroy();
        this.stain.glow.destroy();
        this.stain = null;
        this.world.bloodstain = null;
        saveGame(this.world);
      }
    }
  }

  private checkBossTrigger() {
    if (this.fog) this.fog.tilePositionY -= 0.4;
    const b = this.boss;
    const arena = this.level.boss;
    if (!b || !arena || !b.alive || this.bossActive || !this.player.alive) return;
    if (this.player.x > arena.fogX + 20) {
      this.bossActive = true;
      if (this.gateCollider) this.gateCollider.active = true;
      this.fog?.setAlpha(0.85);
      b.activate();
      sfx.playMusic('boss');
    }
  }

  private updateCamera(dt: number) {
    const cam = this.cameras.main;
    // look ahead in the facing direction
    cam.followOffset.x = approach(cam.followOffset.x, -this.player.facing * 32, 90 * dt);
    for (const { s, f } of this.bg) s.tilePositionX = cam.scrollX * f;
  }

  private drawDebug() {
    const g = this.debugGfx;
    g.clear();
    if (!debugState.hitboxes) return;
    g.lineStyle(1, 0x00ff00, 1).strokeRectShape(this.player.hurtbox());
    for (const t of this.targets()) g.lineStyle(1, 0xffff00, 1).strokeRectShape(t.hurtbox());
    for (const r of this.combat.debugBoxes) g.lineStyle(1, 0xff0000, 1).strokeRectShape(r);
  }
}

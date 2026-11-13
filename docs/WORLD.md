# World – areas, doors, NPCs, enemies

The world is a set of **areas** connected by **doors**. Each area is one Phaser scene run
(`GameScene` restarts with `{ area, entry }` when you walk through a door).

```
src/game/world/
  builder.ts     Builder + LevelData/DoorDef types (geometry, props, enemies, items, doors, npcs)
  areas.ts       AREAS registry: id -> build function, START_AREA
  level1.ts      "The Hollow"        (outdoor)
  catacombs.ts   "Sunken Catacombs"  (crypt)
  ossuary.ts     "The Ossuary"       (crypt, Bone Shepherd arena)
  depths.ts      "The Molten Depths" (lava, pillars + moving platforms, Molten Colossus arena)
  Bonfire.ts, Npc.ts (Npc + Door)
src/game/data/npcs.ts   NPC definitions, dialogue graphs, shops
```

## Current map

```
 The Hollow                                                          Sunken Catacombs
 [gate-door]─bonfire─pits─ledge─bridge─bonfire+Hessa─climb─arena─[arena-door] ══► [west-door]─bonfire+Corvin─…─[east-door]
     ▲  locked until "shortcut"                          sealed until boss dead                                    │ sets "shortcut"
     └───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Inside the catacombs' low crypt: a second bonfire (`crypt`) and `ossuary-door` → **The Ossuary**
(Bone Shepherd). Victory sets `shepherdDefeated` and drops the Shepherd's Scythe.

The Ossuary's sealed `depths-door` (requires `shepherdDefeated`) leads down to **The Molten Depths**:
entry bonfire (`depths`) → pillars and a ferry slab over a lava lake → rest island (ghouls) → a lift
up to a high shelf → planks and a second ferry → forge-gate bonfire (`forge`) → the **Molten Colossus**.
Victory sets `colossusDefeated`.

### Lava and moving platforms (theme `lava`)

- `b.lava(x1, x2, row)` makes a lava lake whose surface is `row` (solid rock beneath); `b.pillar(x1, x2, top)`
  raises stone out of it. Lava (`T.LAVA`) kills the player and enemies on touch, lights the cave
  (a static light every ~52 px) and throws sparks; its surface strip + molten body are drawn above
  characters so whatever falls in sinks out of sight. Enemies never path into it (`surfaceAt` → null).
- `b.mover(col, row, wTiles, dxTiles, dyTiles, periodSec, phase)` – a stone slab that eases back and
  forth. Only the player collides with it (top side only). Arcade carries riders sideways; the scene
  glues a rider down while the slab sinks (`Player.riding`).

## Bosses

`entities/Boss.ts`: abstract `Boss` (dormant until the fog gate is crossed, HUD bar, phase 2 at half
HP via `enterPhase2`, full reset on death/rest) + one class per boss, created by `makeBoss(type)`.

| Boss | Area | Moves | Phase 2 |
|---|---|---|---|
| `Warden` | The Hollow | slam, 2-hit sweep, leap | faster, slams/landings send ground shockwaves |
| `Shepherd` | The Ossuary | 2-hit scythe sweep, **blink** (sinks, rises behind you, slashes – un-hittable while sunk), **bone rain** (ground markers, then bones fall), **summons ghouls** | faster, denser rain, up to 2 ghouls, summons more often |
| `Colossus` | The Molten Depths | **spit** (two lobbed lava globs at range – blockable), **lava wave** when you're close: 1.5 s wind-up with a red zone over the whole reach, then a 60 px-tall wave rolls out both ways (180 px, not blockable, too tall to jump – outrun it or roll *through* it), then it slumps for 5 s: run back in and punish | faster; spits a fan of three; quicker waves; **the arena collapses**: both ends glow and sink into lava (3 columns per side at once, then more as HP drops, up to 10). The floor rises back when it dies, and resets if you die |

### Reading boss attacks (tells)

Every big attack is tagged with a `tell` (`systems/attacks.ts`). The tag picks its danger-zone look
(`systems/Telegraph.ts`), the colour the boss glows while winding up, and its wind-up sound
(`Sfx.tell`). Same tag = same answer, whichever boss uses it:

| Tell | Colour | Looks like | Sounds like | Answer | Used by |
|---|---|---|---|---|---|
| `slam` | orange | heat rising off the floor, chevrons falling onto it | deep rising rumble | leave the zone | Warden slam |
| `low` | yellow | streaks skimming the floor, hopping `^` marks | metal scraping stone | **jump** | Warden + Shepherd sweep |
| `high` | violet | slashes drawing across the full height | rising whistle | roll / block / back off | Warden + Shepherd follow-up swing |
| `leap` | red | target rings closing in where it lands | grunt + spring | move off the mark | Warden leap |
| `blink` | cyan | pale column + wisps where it will rise | eerie falling chime | roll away from the column | Shepherd blink |
| `wave` | magma | heat over the whole reach, arrows racing outward | boiling roar | **run**, or roll through | Colossus wave |
| `spit` | cream | brackets closing in on your feet | gurgle | keep moving / block | Colossus + slime spit |
| `rain` | – | (bones' own ground markers) | rattling bones | step off the markers | Shepherd |
| `summon` | – | – | low chant | kill the add | Shepherd |

Under every zone a thin cream timer fills in from both ends and turns white for the last moment.
Untagged attacks (regular enemies) keep the generic orange glow + rising charge sound.

An arena is declared on the level: `b.data.boss = { type, x, y, fogX, flag, banner, sub }`.
Summoned adds (`GameScene.summon`) give no souls or drops and are removed when the fight resets.

## Authoring an area

```ts
const b = new Builder(cols, rows, 'id', 'Display Name', 'outdoor' | 'crypt' | 'lava');
b.ground(x1, x2, topRow);      // solid ground whose surface is topRow
b.pit(x1, x2, floorRow, top);   // spike pit (top = first cleared row; use it under ceilings)
b.plat(x, row, w);              // one-way plank
b.fill(x1, y1, x2, y2);         // raw solid block (walls, ceilings – fill ceilings LAST)
b.enemy('ghoul', col, row);     // hollow | knight | ghoul | archer | slime
b.lava(x1, x2, row); b.pillar(x1, x2, top); b.mover(col, row, w, dx, dy, period, phase);  // theme 'lava'
b.item('unique-world-id', 'titanite', col, row, qty);
b.prop('candle', col, row, { light: true });       // atlas prop; { hang: true } anchors at the top
b.door({ id, to, entry, requires?, lockedMsg?, sealed?, sets? }, col, row);
b.data.bonfires.push({ id: 'unique', ...b.at(col, row) });
b.data.npcs.push({ id: 'hessa', ...b.at(col, row) });
```

Then add it to `AREAS` in `areas.ts`.

Movement limits to respect: a jump clears **3 tiles up**; a walking jump clears a **3-tile gap**,
a sprinting jump about **6 tiles**.

### Doors

- `to` / `entry`: target area id and the id of the door you arrive at there.
- `requires`: world flag needed to use it (`bossDefeated` is special-cased). Locked doors show
  `lockedMsg`; `sealed` draws glowing runes instead of a plain closed door.
- `sets`: flag set when the door is used – this is how one-way shortcuts are opened from one side.

### World state (saved)

`WorldState` in `systems/SaveSystem.ts`: lit bonfires, `lastBonfire` + `lastArea` (respawn point –
can be in another area), bloodstain (with its area), picked-up item ids, `bossDefeated`, and
`flags` (shortcuts, NPC conversations). It lives in the Phaser registry while playing, so changing
area never re-reads the save.

## Gear

Weapons live in `systems/attacks.ts` (movesets) and `data/items.ts` (items). Grip (`hands`):

| Grip | Weapons | Off hand |
|---|---|---|
| one-handed | Shortsword (+ Flame / Frost), Rapier, Venom Rapier, Greataxe (+ Flame / Frost), Shepherd's Scythe | shield |
| two-handed | Longsword (+ Flame / Frost / Venom) | none – blocks with the blade (60 %) |
| dual | Twin Daggers – stabs alternate right / left, the heavy drives both in | second dagger – parries, blocks poorly (35 %) |

**Elements** (`element: { type, power }`, applied in `Enemy.applyElement`):

- **fire** – `power` extra damage on every hit, and the foe burns for 3 s (ticks every 0.5 s).
- **cold** – each hit adds `power` frost; at 100 → **frostbite**: a burst (10 % of max HP, max 90, +12)
  and 45 % slower for 4 s. Build-up drains slowly between hits.
- **poison** – each hit adds `power` toxin; at 100 → **poisoned** for 8 s at 1.2 % max HP per second (3–14).

Enemies can resist (`resist` in their config: 0 = immune, >1 = weak): lava slimes ignore fire and
take double frost; the Colossus barely burns (0.1) and is weak to frost (1.5); the Shepherd's bones
resist poison (0.3).

**Blade effects** (`systems/BladeFx.ts`): every infused weapon leaves a swept tracer ribbon behind its
swings (orange/gold fire, pale blue frost, faint green venom), drawn above the darkness. Fire blades
also glow all the time (shader glow on the weapon sprite, a warm halo, a light that pushes the
darkness back) and shed the odd ember at rest. Reach per weapon sheet is in `REACH`.

**Frost kills shatter**: an enemy killed by a frost hit, frostbite burst, or any hit while
frostbitten freezes solid for 0.16 s, then breaks into ice chips cut from its own frame
(`Fx.shatter`) that bounce on the floor and melt away. Bosses keep their normal death.

Armor: Wanderer's Garb, Hunter's Leathers, Ember Robes (45 % fire resistance), Fallen Knight Set,
Warden's Plate. Fire resistance (`fireRes`) cuts lava glob / lava wave damage. Shields: Wooden,
Buckler (light, for parrying), Kite, Tower (blocks everything, very heavy), Obsidian (stops fire
completely when blocking, `fireAbsorb`).

Where to find them: you start with the Shortsword + Wooden Shield; Hessa sells the Shortsword,
Longsword, Twin Daggers, Buckler, Hunter's Leathers and Tower Shield. Longsword on the Knight's
Bridge, Flame Shortsword at the top of the Climb, Warden's Plate behind the Warden; Frost Shortsword
on the catacombs' archer ledge, Venom Rapier on the balcony, Frost Greataxe in the low crypt; Venom
Longsword in the Ossuary before the fog; in the Molten Depths the Obsidian Shield (entry hall),
Ember Robes (on a pillar), Flame Greataxe (rest island), Frost Longsword (high shelf) and Flame
Longsword (forge gate).

## NPCs and dialogue

`NPCS[id]` in `data/npcs.ts`:

- `sheet`: sprite key, `start(flags)`: which node to open with (NPCs remember you via flags).
- `nodes`: `{ lines[], choices[], sets?, gives? }`. Choices: `goto` another node, open the `shop`,
  or `end`. `sets` + `gives` run once (Phaser applies them when React shows the node).
- `shop`: `{ item, price }[]` – bought with souls in the React shop.

React shows the dialogue (`components/Dialogue/Dialogue.tsx`, typewriter, tap/Enter/E to advance,
1–9 for choices) and the shop; the game is paused while either is open.

## Enemies

Configs in `entities/Enemy.ts` (`HOLLOW`, `KNIGHT`, `GHOUL`, `ARCHER`, `SLIME`) + `ENEMY_TYPES` and
`makeEnemy`. Attacks are data (startup/active/recovery, hitbox, lunge, combos via `next`/`chain`).
Special behaviour = subclass and override `chase` / `onStrike` (see `Archer`, `LavaSlime`, `Boss`).
The **Lava Slime** hops after you, lobs lava globs from range (`GameScene.spawnLavaGlob`) and pounces
up close; it glows, can't be parried, and lava doesn't hurt it.

### Navigation (`Enemy.navigate`)

While chasing, melee enemies follow the player across terrain:

- **climb** a wall in front if it is ≤ ~3.5 tiles high and has headroom (`ledgeHeight` → `jumpTo`),
- **hop up through a plank** when the player stands on one above them,
- **drop down** a cliff when the player is lower and the fall is safe (≤ 7 tiles, no spikes – `surfaceAt`),
- **jump a gap** to the nearest landing within ~7 tiles.

They only attack when the player is on (about) the same floor (`|dy| < 20`). If they make no real
progress toward the player (closest distance doesn't improve) they pace for a moment and then give up,
ignoring the player for 3 s. `canJump: false` turns this off (archers, bosses).
Tile probes used for this live on `GameScene`: `isGroundAt`, `isSolidAt`, `isPlankAt`, `isSpikeAt`, `surfaceAt`.
Projectiles (boss shockwaves, arrows) live in `GameScene.projectiles`.

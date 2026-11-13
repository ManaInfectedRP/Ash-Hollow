# Sprites – how they are made

Two sources of art, two build steps. Both write into `public/assets/` and are loaded by
`src/game/gfx/sprites.ts` (`preloadSprites`) in `BootScene.preload()`.

| What | Source | Build | Output |
|---|---|---|---|
| Player body, monsters, bosses, NPCs (animated) | **Custom**, hand-drawn parts + a rig, in `tools/sprites/` | `npm run sprites` | `public/assets/sprites/<key>.png` + `.json` (Phaser JSON-hash atlas) |
| Player weapons (held) | **Custom** weapon grids, pre-rotated | `npm run sprites` | `weapon-<id>.png/.json` + `player.bones.json` |
| Item icons, world pickups, props (static 16×16) | **Pixel Art Atlas** dataset (CC0) | `npm run atlas -- <shard.parquet>` | `public/assets/atlas/{items,props}/<name>.png` + `manifest.json` |

Previews of every sheet are written to `docs/sprites/` on every `npm run sprites` – look at them
before testing in-game. `docs/sprites/equipped-<weapon>.png` shows the player body with that weapon
attached to the weapon bone in every frame, exactly as the game composes it.

Environment art (tiles, parallax, crypt backdrop, bonfire, doors, arrows, fog, particles) is still
generated at runtime in `src/game/gfx/environment.ts`.

---

## 1. Custom character sprites (`tools/sprites/`)

```
tools/sprites/
  lib/canvas.mjs   RGBA canvas: px/rect/line/disc/poly, outline pass, PNG save
  lib/grid.mjs     part grids: grid(), stamp(), stampRotated() (3× supersampled rotation)
  parts.mjs        HAND-DRAWN parts: heads, pauldrons, weapons (+ makeSword generator)
  rig.mjs          draws one frame: legs (2-bone IK), torso styles, cape, arms, weapon, outline
  characters.mjs   character definitions: rig sizes, palettes, parts, POSES (frame list)
  build.mjs        renders every sheet → PNG + atlas JSON, previews → docs/sprites/
```

### Palette roles (the letters in part grids)

Grids never contain colours, only *roles*. Each character maps roles → colours in its `pal`,
so one helmet grid can be steel on one character and bronze on another.

| Letters | Meaning |
|---|---|
| `o` | outline (applied automatically after drawing) |
| `D M L H` | main material: dark / mid / light / highlight (armor, leather) |
| `k c C` | cloth: dark / mid / light (cape, hood, rags) |
| `z s S h` | skin shadow / skin / skin light / hair |
| `x b B W` | blade: dark / mid / light / shine |
| `n N` | leather / wood dark & light (grips, boots, belts) |
| `g G` | gold dark / light (guards, buckles, trims) |
| `v e` | visor / void, glowing eye |
| `r R` | accent dark / light (plumes, crests) |
| `u U` | bone dark / light (horns) |
| `f F` | ember dark / bright (runes, glowing cracks) |

Light comes from the **upper left**. Every grid is drawn **facing right**; the game flips
sprites with `setFlipX` for left.

### Anatomy of a frame (back → front)

1. cape (polygon, shaded by column, tattered hem)
2. back arm (off-hand, angle `ba`)
3. back leg (darker ramp) – thigh + shin solved with 2-bone IK, knee bends forward
4. torso – a *style* function per pixel (`plate`, `leather`, `cloth`, `rags`, `skin`, `warden`),
   sheared by `lean`, tapered by `rig.taper`
5. front leg + boot
6. head grid (pivot = neck)
7. front arm, then the weapon grid rotated to angle `a` around its grip pivot
8. pauldron grid over the shoulder, hand on top
9. 1px outline pass, then `after()` hook (e.g. extra glow)

Special kinds: `roll` (curled ball + rotated head), `dead` (hurt pose rotated 90° onto its back),
`drink` (flask grid in the hand instead of the weapon).

### Pose parameters (`characters.mjs`)

| Key | Meaning |
|---|---|
| `a` | weapon angle in degrees: 0 = forward, 90 = down, −90 = up, ±180 = behind |
| `r` | hand reach from shoulder (px) |
| `ba` | back-arm angle (100 ≈ hanging) |
| `lean` | torso lean in px (+ forward) |
| `by` | crouch (+ lowers hips) |
| `fx fl` / `bx bl` | front / back foot x-offset and lift |
| `cape` | cape flutter 0–4 |
| `kind` | `roll` (with `rot`), `dead`, `drink` |

### The weapon bone (player)

The player body is baked **without** a weapon (`player-<armor>`, one sheet per armor). While
rendering each frame the rig records the **weapon bone** – where the hand grips and at which angle
the weapon points – and `build.mjs` writes them to `public/assets/sprites/player.bones.json`:

```json
{ "l1s": { "x": 30, "y": 15, "a": 10, "show": true }, "roll0": { "x": 0, "y": 0, "a": 0, "show": false } }
```

`x, y` are frame-local pixels (top-left of the 48×32 frame), `a` is the pose angle `a` in degrees,
`show` is false for rolls, the death pose and drinking.

Each equippable weapon is baked as its own sheet `weapon-<id>` with **72 frames `r0..r71`**: the
weapon grid rotated in 5° steps with the grip pivot exactly at the frame centre (rotation is done
by the build's supersampled rotation, so the pixels stay crisp – no runtime sprite rotation).

In game (`Player.updateWeaponBone`), every frame:

1. look up the bone of the body's current frame,
2. pick weapon frame `r = round(a / 5) mod 72` from the **equipped** weapon's sheet,
3. place it at the bone (mirrored with `scaleX = -1` when facing left),
4. hide it when `show` is false or nothing is equipped (fists).

The same frames also carry the **off-hand (shield) bone**: `sx, sy` is the back hand and `front`
says whether the shield is raised in front of the body (`block`, `parry` poses, set with
`shieldFront: true`) or hangs behind it. Shields are baked one frame each (`shield-<id>`, grip at the
centre, grids in `SHIELDS` in `parts.mjs`) and placed by `Player.updateShieldBone`, drawn in front of
or behind the body accordingly.

So equipping a weapon in the inventory instantly swaps what swings – any weapon works with every
animation, and a new weapon needs no new body art.

**Off-hand weapons (twin daggers).** Every bone also carries `sa`, the off-hand (back arm) angle.
With a dual weapon (`hands: 'dual'` in `attacks.ts`) the shield sprite is replaced by the weapon's
own sheet, rotated to `sa`. The dagger poses `o1w/o1s/o1r` (off-hand stab: the back arm thrusts
forward, `shieldFront` so the blade is drawn in front) and `xw/xs/xr` (both blades at once) are part
of `PLAYER_POSES`, so every armor has them.

**Two-handed weapons** (`hands: 2`, the Longsword) simply hide the shield; blocking uses the
weapon's `guard` values instead (`systems/equipment.ts`).

### Frame names are a contract

Game code picks frames by name. If you rename one, update the code too.

- **Player** (`PLAYER_POSES`): `idle0-1 run0-3 jump fall roll0-3 l1w/l1s/l1r l2* l3* hw hc hs hr aw as tw ts tr o1w o1s o1r xw xs xr hurt block parry rip1 rip2 drink kneel dead`
  (movesets in `src/game/systems/attacks.ts` reference these via `frames: { windup, strike, recover, charge }`)
- **Enemies** (hollow, knight, ghoul, archer): `idle0-1 walk0-3 wind strike rec wind2 strike2 hurt dead`
- **NPCs** (`npc-<id>`): `idle0-1 talk`
- **Warden**: the enemy set + `slamW slamS slamR sweepW sweepS sweep2W sweep2S sweepR crouch air`
- **Shepherd**: `idle0-1 walk0-3 sweepW sweepS sweepR sweep2W sweep2S raise sink hurt dead`
- **Slime**: `idle0-1 walk0-3 wind strike rec wind2 strike2 hurt dead`
- **Colossus**: `idle0-1 walk0-3 spitW spitS waveW waveS rec hurt dead`

Frame size must match the physics body offsets in code:
player, hollow, ghoul, archer, slime, NPCs 48×32, knight 64×48, shepherd 96×80, warden 128×96, colossus 128×112 (feet on the bottom row, centred).

Not everything has to use the humanoid rig: a sheet with `draw(cv, pose, fx, fy, fw, fh)` is drawn by
that function instead (pose = whatever fields you like) and then outlined – see `drawSlime` /
`SLIME_SHEET` (squash/stretch blob, crust + glowing core). The Colossus is rigged: `HEADS.golem` and
the `magma` torso style (rock split by glowing veins).

Weapons can also be procedural: `makeSword({ len, width, grip, guard, chipped, runes })` and
`makeScythe({ haft, blade, depth, thick, bladeW })` in `parts.mjs`. A negative `rig.taper` flares the
torso at the bottom (robes).

### Recipe: add a new monster

1. **Parts** (`parts.mjs`): draw a head grid (pivot `[centerX, bottomRow]`), optionally a
   pauldron, and a weapon (`makeSword({ len, width, grip, guard, chipped, runes })` or a grid
   pointing right with the grip as pivot).
2. **Definition** (`characters.mjs`): copy `KNIGHT_SHEET`, set `key`, frame size, `rig`
   (legLen, legW, torsoW, torsoH, armW, armLen, taper), `torso` style, `legs` ramp, `pal`
   overrides, and poses. Reuse `walk()` and `ENEMY_STRIKES()` and tweak.
3. **Register** it in `build.mjs` (`sheets` list) and add it to the preview list.
4. `npm run sprites`, then look at `docs/sprites/<key>.png`.
5. **Game**: add the key to `ENEMY_SHEETS` in `src/game/gfx/sprites.ts`, write an
   `EnemyConfig` in `src/game/entities/Enemy.ts` with `key`, body size/offset and attacks
   whose `frames` use your pose names, then place it in `src/game/world/level1.ts`.

### Recipe: add player equipment

- **Weapon**: draw the grid in `parts.mjs` (pointing right, pivot on the grip) → add it to
  `PLAYER_WEAPONS` in `characters.mjs` → `npm run sprites` and check `docs/sprites/equipped-<id>.png`
  → add the id to `PLAYER_WEAPON_LOOKS` in `src/game/gfx/sprites.ts` → moveset in `attacks.ts`
  (+ `WEAPONS`) → item in `data/items.ts` → atlas icon in `tools/atlas/picks.json` (optional).
- **Armor**: add an entry in `PLAYER_ARMORS` (head grid, torso style, cape, pauldron, legs,
  palette) → `PLAYER_ARMOR_LOOKS` in `sprites.ts` → item with `armor` stats in `data/items.ts`.

- **Elemental variant** of a weapon: add `{ grid, pal: ELEMENT_PAL.fire | cold | poison, base, element }`
  to `PLAYER_WEAPONS` (same grid, blade recoloured) and an `infuse(BASE, id, name, type, power)` entry
  in `attacks.ts`. Its inventory icon is made automatically by recolouring the base item's icon.
- **Shield**: grid in `SHIELDS` (`parts.mjs`, optional palette in `SHIELD_PALS`) → `SHIELD_LOOKS` in
  `sprites.ts` → item with `shield` stats.
- **Icons**: gear without a Pixel Art Atlas sprite gets a 16×16 icon from the icon pass at the end of
  `build.mjs` (weapons drawn diagonally, armor = head + chest of the idle frame, shields as-is,
  elemental variants = recoloured base icon). They are written to `public/assets/atlas/items/` – add
  the id to the icon list in `build.mjs` and to `ATLAS_ITEMS` in `sprites.ts`. Preview:
  `docs/sprites/icons-generated.png`.

Bodies are per armor and weapons are separate, so sheets grow as armors + weapons, not armors × weapons.

### Recipe: add an NPC

Copy `MERCHANT_SHEET` / `CORVIN_SHEET` (poses from `NPC_POSES`), register it in `build.mjs`, add the
key to `ENEMY_SHEETS` in `sprites.ts`, then write the NPC + dialogue in `src/game/data/npcs.ts`
and place it with `b.data.npcs.push(...)` in an area file (see `docs/WORLD.md`).

### Tips that made the art read better

- Give legs their own ramp (`legs`) when the torso colour is similar – otherwise the body
  becomes one blob.
- `taper` (broad shoulders, narrow waist) instantly makes armored characters heavier.
- The back arm uses the dark ramp with a mid lit edge; pure dark reads as a hole.
- Keep 1px blades for the player, 2–3px for knights, 4–5px for bosses.
- Check readability at 1× in-game: the previews are ×3 and flatter everything.

---

## 2. Pixel Art Atlas sprites (`tools/atlas/`)

Dataset: <https://huggingface.co/datasets/Angais/pixel-art-atlas-1.4m> – 1.4M AI-generated
16×16 RGBA sprites with captions, **CC0 1.0** (see the dataset card for Krea's terms).
It has **single static objects only** (no animation frames), which is why characters are custom.

The dataset is split into ~24 parquet shards (~29 MB each, ~58k random sprites each).
One shard already covers most common subjects.

### Workflow

1. Download a shard into a scratch folder (not the repo):
   `https://huggingface.co/datasets/Angais/pixel-art-atlas-1.4m/resolve/main/data/train-000.parquet`
2. Find candidates with a contact sheet (one row per subject, 12 samples, `row_id` under each)
   and pick by eye – captions are approximate, so always look:
   `python -I tools/atlas/contact_sheet.py shard.parquet out.png "torch|tombstone|skull"`
   Subjects are free text (e.g. `great axe`, `loaf of bread`, `wall sconce torch`).
3. Add `name: row_id` to `tools/atlas/picks.json` under `items` or `props`.
4. `npm run atlas -- path/to/train-000.parquet` (pass several shards if a pick is elsewhere).
   Writes the PNGs and `manifest.json` (subject, caption, row id for each sprite).
5. **Game**: add the name to `ATLAS_ITEMS` / `ATLAS_PROPS` in `src/game/gfx/sprites.ts`.
   - Items automatically use their sprite in the inventory, HUD and as world pickups
     (`itemSpriteUrl`, texture `item:<id>`).
   - Props are placed in the level with `prop('<name>', col, row, { hang, light })` in
     `src/game/world/level1.ts` (`hang` anchors at the top, `light` adds a flickering glow).

Python needs `pyarrow` and `Pillow`.

### Current picks

Items: longsword 26717, greataxe 3099, rapier 16763, bread 911, ember_herb 11582,
soul_lost_knight 61540, soul_nameless 6938, titanite 6373, flask_shard 19, flask 29337,
knight_armor 2783, garb 19602.

Props: torch 879, wall_torch 10016, tombstone 472, tombstone_cracked 7808, bone 25607,
coffin 50746, chain 4061, barrel 56624, crate 1482, candle 676, banner 20383, pillar 18802,
gargoyle 23899, skull 12415, glow_mushroom 69469, lantern 3869.

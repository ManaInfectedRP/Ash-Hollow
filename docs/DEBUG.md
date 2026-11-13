# Debug menu

Open the game with `?debug` in the URL (e.g. `http://localhost:5173/?debug`). A 🐞 button appears at
the top centre; it (or **F1**) opens the menu. The game is paused while the menu is open.
**F2** toggles hitbox drawing.

| Tab | What it does |
|---|---|
| **World** | Every area with its spawn, bonfires (🔥), doors (🚪) and boss gate (💀). Click one to jump there. Works from the title screen too: it loads your save (or a fresh game) and drops you at that spot. |
| **Items** | Give any item (+1 / +5 for consumables and materials), *Give all gear*, +10 Titanite, raise or lower the equipped weapon's upgrade level. |
| **Player** | Souls +1k / +10k / +100k / reset, **God mode** (no damage, lava/spikes/falls put you back on safe ground, endless stamina), hitboxes, heal + refill flasks, +1 max flask, kill all enemies in the area, save. **Boss**: set its HP to 50 % / 25 % / 10 % or kill it (only once the fight has started), e.g. to test phase 2 or the victory. |
| **Flags** | Toggle world flags (`bossDefeated`, `shepherdDefeated`, `colossusDefeated`, `shortcut`, NPC flags…) and light every bonfire in the area. Doors update at once; boss flags apply when the area next loads (jump there again from World). |

Code: `src/components/Debug/DebugMenu.tsx` (UI), `src/game/debugState.ts` (god mode / hitboxes,
survive area changes), the `debug*` methods on `GameScene` and `Boss.debugSetHp`. Jumps use
`GameScene.debugGoto(area, { x, y })` → `scene.restart({ area, at })`; from the title,
`ui:start` takes the same `{ area, at }`.

Everything the menu changes is real game state: what you give yourself ends up in the save.
Use **Start Over** to get a clean run back.

`?debug` also exposes `window.__souls` (game, touch input, stores, sfx) for scripted tests in the
browser console.

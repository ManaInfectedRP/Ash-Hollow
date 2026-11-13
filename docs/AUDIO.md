# Audio

All audio is **CC0** (public domain). Credits are not required but given anyway.

| File(s) in `public/assets/audio/` | Source | Author | License |
|---|---|---|---|
| `sfx/swing*, hit1, step*, roll*, jump, door_open*, menu_*, drink` | [50 RPG sound effects](https://opengameart.org/content/50-rpg-sound-effects) (`RPGsounds_Kenney.zip`) | Kenney (kenney.nl) | CC0 |
| `sfx/heavy*, clang*, pickup*, souls*, locked*, fire*, levelup, hurt*, die1, roar*, monster*, stones*, wood*` | [80 CC0 RPG SFX](https://opengameart.org/content/80-cc0-rpg-sfx) (`80-CC0-RPG-SFX_0.zip`) | rubberduck | CC0 |
| `music/hollow.ogg` | [Dungeon Ambience](https://opengameart.org/content/dungeon-ambience) (`dungeon002.ogg`) | yd | CC0 |
| `music/crypt.ogg` | [Dark Cavern Ambient](https://opengameart.org/content/dark-cavern-ambient) (`dark_cavern_ambient_002.ogg`) | Paul Wortmann | CC0 |
| `music/boss.ogg` | [Boss Battle Theme](https://opengameart.org/content/boss-battle-theme) (`CleytonRX - Battle RPG Theme Var.ogg`) | CleytonKauffman | CC0 |

## How it plays

`src/game/systems/Sfx.ts`:

- **SFX** are decoded once into WebAudio buffers (`SAMPLES` maps a sound name to file variants) and
  played with ±6 % pitch and a little volume variation so repeats don't sound mechanical. Every
  sound has a small synthesized fallback (old iOS can't decode Ogg Vorbis) and some layer a synth
  thump under the sample for weight (`hit`, `slam`).
- **Music** streams through `<audio>` elements (decoding minutes of music would cost tens of MB on a
  phone) and cross-fades: area theme by `LevelData.theme` (`hollow` / `crypt`), `boss` when a fight
  starts, silence for a few seconds after a victory, ducked while menus are open.
- Audio starts on the first tap/key (browser autoplay rules). Sound and music can be toggled in the
  pause menu; the choice is stored in `localStorage`.

## Adding a sound

1. Copy the `.ogg` to `public/assets/audio/sfx/<name>.ogg` (keep it short, mono is fine).
2. Add it to `SAMPLES` under an existing or new key.
3. Call it from a method on `Sfx` (`this.sample('key', volume, rate)`), with a synth fallback.

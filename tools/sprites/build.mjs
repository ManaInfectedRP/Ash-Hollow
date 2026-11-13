// Builds every spritesheet into public/assets/sprites/ and previews into docs/sprites/.
//   npm run sprites
//
// Outputs
//   player-<armor>.png/.json   player BODY (no weapon), one per armor
//   player.bones.json          weapon bone per player frame: { x, y, a, show } (frame-local px, degrees)
//   weapon-<id>.png/.json      weapon pre-rotated in 5° steps (frames r0..r71), grip at frame centre
//   hollow/knight/warden       enemies (weapons baked in – they never change weapon)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas } from './lib/canvas.mjs';
import { PNG } from 'pngjs';
import { renderFrame, renderShield, renderWeaponSheet } from './rig.mjs';
import {
  ARCHER_SHEET, COLOSSUS_SHEET, CORVIN_SHEET, GHOUL_SHEET, HOLLOW_SHEET, KNIGHT_SHEET, MERCHANT_SHEET, SHEPHERD_SHEET, SLIME_SHEET,
  ELEMENT_PAL, PLAYER_ARMORS, PLAYER_WEAPONS, SHIELD_PALS, SHIELDS, WARDEN_SHEET, WEAPON_PALETTE, playerSheet,
} from './characters.mjs';
import { stampRotated } from './lib/grid.mjs';
import { FINALE_PLAYER_WEAPONS, FINALE_WEAPONS, KING_SHEET } from './finale.mjs';
import { AYAME_SHEET, FACELESS_SHEET, HAIR_SHEET, LANTERN_SHEET, MAIDEN_SHEET, SHRINE_PLAYER_WEAPONS, SHRINE_WEAPONS } from './shrine.mjs';
import { CLOUDSLIME_SHEET, LEVIATHAN_SHEET, SKY_WEAPON_PAL, SKY_WEAPONS, WISP_SHEET } from './sky.mjs';
import { DS_PLAYER_WEAPONS, DS_WEAPONS, GLADIATOR_SHEET, LEGIONARY_SHEET, MUMMY_SHEET, SPHINX_SHEET } from './desert.mjs';
import { CARRIER_SHEET, FM_WEAPONS, LEECH_SHEET, MATRIARCH_SHEET, MONK_SHEET, MOTHER_SHEET, WRAITH_SHEET } from './frostmire.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'public/assets/sprites');
const DOCS = path.join(ROOT, 'docs/sprites');
const COLS = 8;

const frameEntry = (x, y, w, h) => ({
  frame: { x, y, w, h },
  rotated: false,
  trimmed: false,
  spriteSourceSize: { x: 0, y: 0, w, h },
  sourceSize: { w, h },
});

function writeAtlas(key, cv, frames) {
  cv.save(path.join(OUT, `${key}.png`));
  const meta = { app: 'tools/sprites/build.mjs', image: `${key}.png`, format: 'RGBA8888', size: { w: cv.w, h: cv.h }, scale: '1' };
  fs.writeFileSync(path.join(OUT, `${key}.json`), JSON.stringify({ frames, meta }, null, 1));
}

function buildSheet(sheet) {
  const names = Object.keys(sheet.poses);
  const cols = Math.min(COLS, names.length);
  const rows = Math.ceil(names.length / cols);
  const cv = new Canvas(sheet.fw * cols, sheet.fh * rows);
  const frames = {};
  const bones = {};
  names.forEach((name, i) => {
    const fx = (i % cols) * sheet.fw;
    const fy = Math.floor(i / cols) * sheet.fh;
    if (sheet.draw) {
      // custom-drawn creatures (not the humanoid rig)
      cv.setClip(fx, fy, sheet.fw, sheet.fh);
      sheet.draw(cv, sheet.poses[name], fx, fy, sheet.fw, sheet.fh);
      cv.outline(fx, fy, sheet.fw, sheet.fh, sheet.outline ?? '#110d16');
      cv.clearClip();
      bones[name] = { x: 0, y: 0, a: 0, show: false, sx: 0, sy: 0, front: false };
    } else bones[name] = renderFrame(cv, sheet.def, sheet.poses[name], fx, fy, sheet.fw, sheet.fh);
    frames[name] = frameEntry(fx, fy, sheet.fw, sheet.fh);
  });
  writeAtlas(sheet.key, cv, frames);
  return { cv, names, bones };
}

fs.rmSync(OUT, { recursive: true, force: true });
const PREVIEW = [
  'hollow', 'knight', 'warden', 'shepherd', 'slime', 'colossus', 'ghoul', 'archer', 'npc-merchant', 'npc-corvin',
  'monk', 'matriarch', 'wraith', 'carrier', 'leech', 'mother', 'player-frostbound_mantle', 'player-mire_leathers',
  'mummy', 'legionary', 'gladiator', 'sphinx', 'player-mummy_wraps', 'player-legion_plate',
  'skywisp', 'cloudslime', 'leviathan', 'player-whale_scale', 'player-white_cloak',
  'ayame', 'maiden', 'faceless', 'lantern', 'hair', 'player-white_kimono',
  'king', 'player-ashen_regalia',
  'player-garb', 'player-knight_armor', 'player-hunter_leathers', 'player-ember_robes', 'player-warden_plate',
];
const bodies = {};
const index = {};
let garb = null;

const SHEETS = [
  HOLLOW_SHEET, KNIGHT_SHEET, WARDEN_SHEET, SHEPHERD_SHEET, GHOUL_SHEET, ARCHER_SHEET, MERCHANT_SHEET, CORVIN_SHEET, SLIME_SHEET, COLOSSUS_SHEET,
  MONK_SHEET(), MATRIARCH_SHEET(), WRAITH_SHEET, CARRIER_SHEET, LEECH_SHEET, MOTHER_SHEET,
  MUMMY_SHEET(), LEGIONARY_SHEET(), GLADIATOR_SHEET(), SPHINX_SHEET,
  WISP_SHEET, CLOUDSLIME_SHEET, LEVIATHAN_SHEET,
  AYAME_SHEET(), MAIDEN_SHEET(), FACELESS_SHEET(), LANTERN_SHEET, HAIR_SHEET,
  KING_SHEET(WARDEN_SHEET),
];
for (const s of [...SHEETS, ...Object.keys(PLAYER_ARMORS).map(playerSheet)]) {
  const { cv, names, bones } = buildSheet(s);
  index[s.key] = { frameWidth: s.fw, frameHeight: s.fh, frames: names.length };
  if (s.key.startsWith('player-')) bodies[s.key.slice(7)] = { cv, names, fw: s.fw, fh: s.fh };
  if (s.key === 'player-garb') {
    fs.writeFileSync(path.join(OUT, 'player.bones.json'), JSON.stringify(bones, null, 1));
    garb = { cv, names, bones, fw: s.fw, fh: s.fh };
  }
  if (PREVIEW.includes(s.key)) cv.scaled(3).save(path.join(DOCS, `${s.key}.png`));
}

for (const [id, entry] of Object.entries(PLAYER_WEAPONS)) {
  const grid = entry.grid ?? entry;
  const { cv, frames, size, step } = renderWeaponSheet(grid, { ...WEAPON_PALETTE, ...(entry.pal ?? {}) });
  const json = {};
  for (const f of frames) json[f.name] = frameEntry(f.x, f.y, f.w, f.h);
  writeAtlas(`weapon-${id}`, cv, json);
  index[`weapon-${id}`] = { frameWidth: size, frameHeight: size, frames: frames.length, stepDegrees: step };
  cv.scaled(2).save(path.join(DOCS, `weapon-${id}.png`));

  // preview: the garb body with this weapon attached to the weapon bone, exactly like the game does it
  const pad = 16;
  const cell = { w: garb.fw + pad * 2, h: garb.fh + pad * 2 };
  const cols = 8;
  const prev = new Canvas(cell.w * cols, cell.h * Math.ceil(garb.names.length / cols));
  garb.names.forEach((name, i) => {
    const ox = (i % cols) * cell.w + pad;
    const oy = Math.floor(i / cols) * cell.h + pad;
    const src = Object.values(JSON.parse(fs.readFileSync(path.join(OUT, 'player-garb.json'), 'utf8')).frames)[i].frame;
    const bone = garb.bones[name];
    const drawShield = () => {
      if (!bone.sx && !bone.sy) return;
      const sh = renderShield(SHIELDS.wooden_shield, { ...WEAPON_PALETTE });
      const h = Math.floor(sh.size / 2);
      prev.draw(sh.cv, ox + bone.sx - h, oy + bone.sy - h);
    };
    if (!bone.front) drawShield();
    for (let y = 0; y < garb.fh; y++)
      for (let x = 0; x < garb.fw; x++) {
        const c = garb.cv.get(src.x + x, src.y + y);
        if (c[3]) prev.px(ox + x, oy + y, c);
      }
    const b = garb.bones[name];
    if (!b.show) {
      if (b.front) drawShield();
      return;
    }
    const f = frames[((Math.round(b.a / step) % frames.length) + frames.length) % frames.length];
    const half = Math.floor(size / 2);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const c = cv.get(f.x + x, f.y + y);
        if (c[3]) prev.px(ox + b.x - half + x, oy + b.y - half + y, c);
      }
    if (b.front) drawShield();
  });
  prev.scaled(3).save(path.join(DOCS, `equipped-${id}.png`));
}

// shields: one frame each, attached in-game to the off-hand bone (sx, sy)
const SHIELD_PAL = { ...WEAPON_PALETTE, D: '#3c4252', L: '#9aa3b8', H: '#d0d6e4', R: '#a8262c' };
for (const [id, grid] of Object.entries(SHIELDS)) {
  const { cv, size } = renderShield(grid, { ...SHIELD_PAL, ...(SHIELD_PALS[id] ?? {}) });
  writeAtlas(`shield-${id}`, cv, { s: frameEntry(0, 0, size, size) });
  index[`shield-${id}`] = { frameWidth: size, frameHeight: size, frames: 1 };
}

// ------------------------------------------------------------------ inventory icons (16×16)
// Gear that has no Pixel Art Atlas sprite gets an icon generated here, written next to the atlas
// icons (public/assets/atlas/items/<id>.png) and listed in ATLAS_ITEMS in src/game/gfx/sprites.ts.
const ICONS = path.join(ROOT, 'public/assets/atlas/items');
const ICON_OUTLINE = '#110d16';

/** a weapon grid drawn diagonally (tip to the top right), centred in 16×16 */
function weaponIcon(grid, pal, deg = -45) {
  const big = new Canvas(48, 48);
  stampRotated(big, grid, 24, 24, deg, pal);
  return fitIcon(big);
}

/** crop the opaque pixels of a canvas and centre them in a 16×16 icon (cropping if larger) */
function fitIcon(src, maxH = 16) {
  let x0 = src.w, y0 = src.h, x1 = -1, y1 = -1;
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++)
      if (src.alpha(x, y)) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
  const out = new Canvas(16, 16);
  if (x1 < 0) return out;
  const w = x1 - x0 + 1;
  const h = Math.min(maxH, y1 - y0 + 1);
  const ox = Math.floor((16 - Math.min(w, 16)) / 2) - Math.max(0, Math.floor((w - 16) / 2));
  const oy = Math.floor((16 - h) / 2);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = src.get(x0 + x, y0 + y);
      if (c[3]) out.px(ox + x, oy + y, c);
    }
  out.outline(0, 0, 16, 16, ICON_OUTLINE);
  return out;
}

/** recolour the bright, unsaturated (metal) pixels of an icon into an element's blade ramp */
function tintIcon(src, element) {
  const ramp = ['x', 'b', 'B', 'W'].map((k) => rgbaOf(ELEMENT_PAL[element][k]));
  const out = new Canvas(src.w, src.h);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (!c[3]) continue;
      const mx = Math.max(c[0], c[1], c[2]);
      const mn = Math.min(c[0], c[1], c[2]);
      const metal = mx - mn < 46 && mx > 70;
      if (!metal) {
        out.px(x, y, c);
        continue;
      }
      const lum = (c[0] + c[1] + c[2]) / 3;
      const k = Math.min(3, Math.max(0, Math.floor((lum - 70) / 46)));
      out.px(x, y, [...ramp[k].slice(0, 3), c[3]]);
    }
  return out;
}
const rgbaOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255);

function loadPng(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const cv = new Canvas(png.width, png.height);
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      if (png.data[i + 3]) cv.px(x, y, [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]]);
    }
  return cv;
}

const icons = {};
// plain new blades
icons.shortsword = weaponIcon(PLAYER_WEAPONS.shortsword, WEAPON_PALETTE);
icons.ashen_greatsword = weaponIcon(FINALE_WEAPONS.ashenGreatsword, { ...WEAPON_PALETTE, ...FINALE_PLAYER_WEAPONS.ashen_greatsword.pal });
icons.bridal_knife = weaponIcon(SHRINE_WEAPONS.knife, { ...WEAPON_PALETTE, ...SHRINE_PLAYER_WEAPONS.bridal_knife.pal });
icons.cloudbreaker = weaponIcon(SKY_WEAPONS.cloudbreaker, { ...WEAPON_PALETTE, ...SKY_WEAPON_PAL });
icons.sand_scepter = weaponIcon(DS_WEAPONS.scepter, { ...WEAPON_PALETTE, ...DS_PLAYER_WEAPONS.sand_scepter.pal });
{
  // two gladii crossed
  const big = new Canvas(48, 48);
  const pal = { ...WEAPON_PALETTE, ...DS_PLAYER_WEAPONS.gladius.pal };
  stampRotated(big, DS_WEAPONS.gladius, 20, 26, -45, pal);
  stampRotated(big, DS_WEAPONS.gladius, 28, 26, -135, pal);
  icons.gladiator_blades = fitIcon(big);
}
icons.frost_spear = weaponIcon(FM_WEAPONS.playerSpear, { ...WEAPON_PALETTE, ...ELEMENT_PAL.cold });
{
  // twin daggers: two blades crossed
  const big = new Canvas(48, 48);
  stampRotated(big, PLAYER_WEAPONS.dagger, 20, 26, -45, WEAPON_PALETTE);
  stampRotated(big, PLAYER_WEAPONS.dagger, 28, 26, -135, WEAPON_PALETTE);
  icons.twin_daggers = fitIcon(big);
}
// elemental variants: the base item's icon, blade recoloured
for (const [id, entry] of Object.entries(PLAYER_WEAPONS)) {
  if (!entry.element) continue;
  const base = icons[entry.base] ?? loadPng(path.join(ICONS, `${entry.base}.png`));
  icons[id] = tintIcon(base, entry.element);
}
// armor: head + chest of the idle frame
for (const id of ['hunter_leathers', 'ember_robes', 'warden_plate', 'frostbound_mantle', 'mire_leathers', 'mummy_wraps', 'legion_plate', 'whale_scale', 'white_cloak', 'white_kimono', 'ashen_regalia']) {
  const b = bodies[id];
  const i = b.names.indexOf('idle0');
  const cols = Math.min(COLS, b.names.length);
  const fx = (i % cols) * b.fw;
  const fy = Math.floor(i / cols) * b.fh;
  const frame = new Canvas(b.fw, b.fh);
  for (let y = 0; y < b.fh; y++)
    for (let x = 0; x < b.fw; x++) {
      const c = b.cv.get(fx + x, fy + y);
      if (c[3]) frame.px(x, y, c);
    }
  icons[id] = fitIcon(frame, 15);
}
// new shields
for (const id of ['buckler', 'tower_shield', 'obsidian_shield']) {
  const { cv } = renderShield(SHIELDS[id], { ...SHIELD_PAL, ...(SHIELD_PALS[id] ?? {}) });
  icons[id] = fitIcon(cv);
}
for (const [id, cv] of Object.entries(icons)) cv.save(path.join(ICONS, `${id}.png`));
const sheet = new Canvas(18 * Object.keys(icons).length, 18);
Object.values(icons).forEach((cv, i) => sheet.draw(cv, i * 18 + 1, 1));
sheet.scaled(4).save(path.join(DOCS, 'icons-generated.png'));

fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
console.log(`built ${Object.keys(index).length} sheets -> ${path.relative(ROOT, OUT)}`);

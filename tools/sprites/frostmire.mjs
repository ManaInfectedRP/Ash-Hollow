// The Frostbound Cloister + the Rotting Mire: new enemies, bosses and gear.
// Rigged humanoids (monk, matriarch) use the shared rig; the creatures are drawn directly.
// Frame names are the contract with the game code (Enemy.ts / Boss.ts).
import { grid } from './lib/grid.mjs';
import { makeSword, PAULDRONS } from './parts.mjs';

/** shared base palette (same roles as characters.mjs BASE) – passed in to avoid a circular import */
let BASE = {};
export function setBase(b) {
  BASE = b;
}

const walk = (s, a, extra = {}) => ({
  walk0: { fx: 2 * s, bx: -2 * s, a, ba: 120, ...extra },
  walk1: { fx: s, fl: 1, bx: -s, by: -1, a: a + 4, ba: 100, ...extra },
  walk2: { fx: -2 * s, bx: 2 * s, a, ba: 75, ...extra },
  walk3: { fx: -s, bx: s, bl: 1, by: -1, a: a + 4, ba: 100, ...extra },
});

// ------------------------------------------------------------------ parts
export const FM_HEADS = {
  /** deep grey hood, frost-white beard, pale eyes in the shadow */
  monkHood: grid(
    [
      '..kkkk..',
      '.kcccck.',
      'kcCCCCck',
      'kcCvvvvv',
      'kcvveveU',
      'kcCvUUUU',
      '.kcUUUU.',
      '..kUUU..',
      '...UU...',
    ],
    [3, 8],
  ),
  /** the Matriarch: silver helm, a crown of ice spikes, a veil, cold eyes */
  matriarch: grid(
    [
      '.F...F...F.',
      '.FR..F..RF.',
      '..FRRFRRF..',
      '..RHHHHHR..',
      '.RHHLLLLHR.',
      '.RHLvvvvvR.',
      '.RHLveveeR.',
      '.RHLLLLLLR.',
      '..cCCCCCc..',
      '..cCCCCCc..',
      '...ccccc...',
    ],
    [5, 10],
  ),
};

/** a long spear: silver-bound haft, leaf blade of clear ice; pivot = grip */
function makeSpear(haft, blade) {
  const W = haft + blade + 2;
  const rows = [Array(W).fill('.'), Array(W).fill('.'), Array(W).fill('.')];
  rows[1][0] = 'g';
  for (let x = 1; x <= haft; x++) rows[1][x] = x % 5 === 0 ? 'g' : x % 2 ? 'n' : 'N';
  rows[1][haft + 1] = 'G';
  for (let i = 0; i < blade; i++) {
    const x = haft + 2 + i;
    rows[1][x] = i === blade - 1 ? 'W' : i % 3 === 0 ? 'B' : 'b';
    if (i > 0 && i < blade - 2) {
      rows[0][x] = i < blade / 2 ? 'x' : 'b';
      rows[2][x] = i < blade / 2 ? 'x' : 'x';
    }
  }
  return grid(
    rows.map((r) => r.join('')),
    [Math.floor(haft * 0.35), 1],
  );
}

export const FM_WEAPONS = {
  /** a club of ice as long as a sword, chipped */
  iceClub: makeSword({ len: 13, width: 3, grip: 3, guard: 2, chipped: true, seed: 11 }),
  matriarchSpear: makeSpear(30, 10),
  /** the player's version: shorter, same look */
  playerSpear: makeSpear(17, 7),
};

const ICE_BLADE = { x: '#3a6a9a', b: '#86c4ec', B: '#d0f0ff', W: '#ffffff' };

// ------------------------------------------------------------------ Ice-bound Monk (rigged, ice-slab shield in front)

/** the slab of ice held in front: drawn after the body (not outlined by the rig, so it has its own rim) */
function monkShield(cv, pose, cx, baseY) {
  if (pose.kind === 'dead') return;
  const x = cx + 6 + (pose.shx ?? 0);
  const y = baseY - 27 + (pose.by ?? 0) + (pose.shy ?? 0);
  const w = 6;
  const h = 18;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
      let col = '#8ac0e8';
      if (edge) col = '#14202e';
      else if (i === 1 || j === 1) col = '#d8f4ff';
      else if (i === w - 2) col = '#5a88b8';
      else if ((i + j * 2) % 7 === 0) col = '#c0e4fa';
      cv.px(x + i, y + j, col);
    }
}

export const MONK_SHEET = () => ({
  key: 'monk',
  fw: 64,
  fh: 48,
  def: {
    rig: { legLen: 10, legW: 4, torsoW: 12, torsoH: 12, armW: 3, armLen: 6, taper: -1 },
    head: FM_HEADS.monkHood,
    headDy: 1,
    torso: 'robe',
    cape: { w: 5 },
    weapon: FM_WEAPONS.iceClub,
    bareHands: false,
    legs: { back: '#2a303c', front: '#3e4656', lit: '#56607a' },
    after: monkShield,
    pal: {
      ...BASE,
      ...ICE_BLADE,
      k: '#2a3240', c: '#4a5468', C: '#6a7890', r: '#3a4458', R: '#8a9ab4', g: '#5a7ea6', F: '#d8f0ff',
      U: '#e8f0f8', u: '#a8b8c8', v: '#0a0e16', e: '#9ae8ff', n: '#3a3a48', N: '#5a5a6a',
    },
  },
  poses: {
    idle0: { a: 70, r: 3, ba: 100, cape: 1 },
    idle1: { a: 72, r: 3, by: 1, ba: 102, cape: 2 },
    ...walk(2, 65, { r: 3, cape: 2 }),
    wind: { lean: -2, a: -150, r: 4, by: 1, fx: 3, bx: -4, ba: 60, shx: -3 },
    strike: { lean: 3, a: 45, r: 6, by: 2, fx: 5, bx: -5, cape: 3, ba: 140, shx: -4, shy: 2 },
    rec: { lean: 2, a: 80, r: 5, by: 1, fx: 4, bx: -4, ba: 120, shx: -2 },
    wind2: { lean: -2, a: 100, r: 2, fx: 2, bx: -4, ba: 100, shx: -3 },
    strike2: { lean: 4, a: 80, r: 3, fx: 5, bx: -5, cape: 3, ba: 100, shx: 5 },
    hurt: { lean: -3, a: -40, r: 2, bx: -4, ba: 200, shx: -3, shy: 2 },
    dead: { kind: 'dead' },
  },
});

// ------------------------------------------------------------------ The Frost Matriarch (rigged)

export const MATRIARCH_SHEET = () => ({
  key: 'matriarch',
  fw: 96,
  fh: 80,
  def: {
    rig: { legLen: 19, legW: 3, torsoW: 12, torsoH: 20, armW: 3, armLen: 10, taper: -2 },
    head: FM_HEADS.matriarch,
    headDy: 1,
    torso: 'robe',
    cape: { w: 9 },
    pauldron: PAULDRONS.small,
    weapon: FM_WEAPONS.matriarchSpear,
    bareHands: false,
    legs: { back: '#3a4458', front: '#5a6a86', lit: '#8a9cba' },
    pal: {
      ...BASE,
      ...ICE_BLADE,
      k: '#24304a', c: '#40527a', C: '#6a84b4', r: '#8aa4c8', R: '#c8dcf0', g: '#a8b8d0', F: '#e8f8ff',
      D: '#5a6a86', M: '#8a9cba', L: '#b8c8e0', H: '#e8f0fa',
      v: '#0a1020', e: '#9ae8ff', n: '#6a7a96', N: '#9aaac4', G: '#e8f4ff',
    },
  },
  poses: {
    idle0: { a: -70, r: 6, cape: 1, ba: 100 },
    idle1: { a: -68, r: 6, by: 1, cape: 2, ba: 102 },
    ...walk(3, -65, { r: 6, cape: 2 }),
    thrustW: { lean: -3, a: 10, r: 2, by: 1, fx: 5, bx: -6, cape: 1, ba: 150 },
    thrustS: { lean: 5, a: 14, r: 12, by: 2, fx: 8, bx: -8, cape: 4, ba: 170 },
    thrustR: { lean: 3, a: 25, r: 8, by: 1, fx: 6, bx: -6, cape: 3, ba: 140 },
    sweepW: { lean: -3, a: -150, r: 6, by: 2, fx: 4, bx: -6, cape: 0, ba: 40 },
    sweepS: { lean: 5, a: 35, r: 10, by: 4, fx: 8, bx: -8, cape: 4, ba: 170 },
    sweepR: { lean: 3, a: 60, r: 7, by: 2, fx: 5, bx: -5, cape: 3, ba: 140 },
    lungeW: { lean: -4, a: 5, r: 1, by: 5, fx: 7, bx: -8, cape: 0, ba: 160 },
    raise: { lean: -2, a: -95, r: 9, by: -1, fx: 2, bx: -3, cape: 3, ba: -110 },
    novaS: { lean: 1, a: 92, r: 8, by: 4, fx: 6, bx: -6, cape: 4, ba: -60 },
    hurt: { lean: -4, a: -50, r: 4, bx: -6, by: 3, ba: 210 },
    dead: { kind: 'dead' },
  },
});

// ------------------------------------------------------------------ Frost Wraith (drawn): a hovering shade

/** filled circle with a fractional radius (integer pixel grid) */
function fdisc(cv, cx, cy, r, col) {
  const R = Math.ceil(r);
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const px = Math.round(cx) + x;
      const py = Math.round(cy) + y;
      if ((px - cx) * (px - cx) + (py - cy) * (py - cy) <= r * r + 0.25) cv.px(px, py, col);
    }
}

/** a tapered limb through points (shoulder → elbow → hand): dark rim, then fill, thick → thin */
function limbPath(cv, pts, w0, w1, fill, rim) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(l);
    total += l;
  }
  for (const pass of [0, 1]) {
    let run = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const n = Math.max(1, Math.ceil(segs[i - 1] * 2));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const along = (run + segs[i - 1] * t) / total;
        const r = (w0 + (w1 - w0) * along) / 2;
        fdisc(cv, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, pass ? Math.max(0.5, r - 0.7) : r + 0.5, pass ? fill : rim);
      }
      run += segs[i - 1];
    }
  }
}

function drawWraith(cv, pose, fx, fy, fw, fh) {
  const pal = { rim: '#16304a', dark: '#2e5478', mid: '#4f80b0', light: '#86b8e0', pale: '#c4e4fa', white: '#f2fbff', void: '#050c16', eye: '#8ff6ff' };
  const cx = fx + Math.floor(fw / 2) + (pose.lean ?? 0);
  const base = fy + fh - 2;
  if (pose.kind === 'dead') {
    // a drift of rime and an empty, crumpled cowl
    for (let x = -9; x <= 9; x++) {
      const h = Math.abs(x) < 3 ? 3 : Math.abs(x) < 6 ? 2 : 1;
      for (let j = 0; j < h; j++) cv.px(cx + x, base - j, j === h - 1 ? pal.white : (x + j) % 3 ? pal.light : pal.pale);
    }
    cv.disc(cx + 3, base - 4, 2, pal.mid);
    cv.px(cx + 4, base - 4, pal.void);
    return;
  }
  const h = 22 + (pose.tall ?? 0);
  const top = base - h;
  const sway = pose.sway ?? 0;
  // the cloak: hood → shoulders → a long flaring hem streaming back (left) into wisps
  for (let y = 4; y < h; y++) {
    const t = y / h;
    const half = t < 0.32 ? 3 + (t / 0.32) * 4 : 7 + (t - 0.32) * 3;
    const trail = Math.round(t * t * 6 + Math.sin(t * 6 + sway) * t * 1.5); // streams behind
    const x0 = Math.round(-half - trail);
    const x1 = Math.round(half - trail * 0.4);
    for (let x = x0; x <= x1; x++) {
      // tattered hem: long fingers of cloth, every other column cut short
      const tear = t > 0.7 && ((x * 7 + Math.round(sway * 3)) % 5 === 0 || ((x & 1) && t > 0.88));
      if (tear) continue;
      let col = pal.mid;
      const k = (x - x0) / Math.max(1, x1 - x0);
      if (x === x0 || x === x1) col = pal.rim;
      else if (k > 0.8) col = t < 0.5 ? pal.pale : pal.light;
      else if (k < 0.3) col = pal.dark;
      else if ((x + 1) % 4 === 0 && t > 0.38) col = pal.dark; // folds
      if (t > 0.85 && col !== pal.rim) col = (x + y) % 2 ? pal.dark : pal.mid; // fades into wisps
      cv.px(cx + x, top + y, col);
    }
  }
  // wisps trailing off the hem
  for (let i = 0; i < 3; i++) {
    const wx = cx - 7 - i * 3 - Math.round(sway);
    cv.px(wx, base - 1 - i, pal.light);
    cv.px(wx - 1, base - i, pal.mid);
  }
  // pointed hood, opening forward (right), two cold eyes in the dark
  for (let y = 0; y < 8; y++) {
    const half = Math.round(1 + y * 0.6);
    for (let x = -half; x <= half; x++) {
      const px = cx + x - (y < 2 ? 1 : 0);
      let col = x < 0 ? pal.mid : pal.light;
      if (x === -half || x === half) col = pal.rim;
      if (y === 0) col = pal.pale;
      cv.px(px, top - 2 + y, col);
    }
  }
  for (let y = 2; y < 7; y++) for (let x = 0; x <= 2; x++) cv.px(cx + x + 1, top + y - 1, pal.void);
  cv.px(cx + 2, top + 2, pal.eye);
  cv.px(cx + 3, top + 2, pal.white);
  cv.px(cx + 3, top + 3, pal.eye);
  // crown of ice shards on the hood
  for (const [dx, ht] of [[-3, 2], [-1, 3], [1, 4], [3, 2]]) {
    cv.rect(cx + dx, top - 2 - ht, 1, ht, pal.white);
    cv.px(cx + dx, top - 2 - ht, pal.pale);
  }
  // arms: thin sleeves with icy claws
  const arm = pose.arm ?? 0;
  const sh = [cx + 4, top + 8];
  const hand = arm === 1 ? [cx + 6, top - 1] : arm === 2 ? [cx + 13, top + 6] : [cx + 7, top + 15];
  const elbow = arm === 2 ? [cx + 9, top + 8] : [cx + 7, top + (arm === 1 ? 4 : 11)];
  limbPath(cv, [sh, elbow, hand], 3, 2, pal.light, pal.rim);
  for (const d of [-1, 0, 1]) cv.px(hand[0] + 1, hand[1] + d, pal.white);
  const bsh = [cx - 4, top + 8];
  limbPath(cv, [bsh, [cx - 7, top + (arm === 1 ? 3 : 12)], [cx - 6, top + (arm === 1 ? -1 : 16)]], 3, 2, pal.dark, pal.rim);
  if (arm === 1) {
    // a shard forming between the raised claws
    cv.disc(cx + 1, top - 5, 2, pal.pale);
    cv.px(cx + 1, top - 5, pal.white);
    cv.px(cx + 1, top - 8, pal.white);
  }
}

export const WRAITH_SHEET = {
  key: 'wraith',
  fw: 48,
  fh: 32,
  draw: drawWraith,
  outline: '#0a1420',
  poses: {
    idle0: { sway: 0 },
    idle1: { sway: 1.5, tall: 1 },
    walk0: { sway: 0, lean: 1 },
    walk1: { sway: 1, lean: 1, tall: 1 },
    walk2: { sway: 2, lean: 1 },
    walk3: { sway: 3, lean: 1, tall: 1 },
    wind: { arm: 1, tall: 1 },
    strike: { arm: 2, lean: 2 },
    rec: { arm: 0, lean: 1 },
    hurt: { lean: -3, sway: 2 },
    dead: { kind: 'dead' },
  },
};

// ------------------------------------------------------------------ Bloated Carrier (drawn): a swollen sack of rot

function drawCarrier(cv, pose, fx, fy, fw, fh) {
  const pal = {
    rim: '#1c2412', dark: '#3a4626', shade: '#566640', skin: '#7a8c58', light: '#a2b47a', hi: '#c8d8a0',
    vein: '#6a2e44', pus: '#d8ee6a', pusD: '#8aa830', eye: '#f4f070', mouth: '#1a0a0e', drool: '#b4e070',
  };
  const cx = fx + Math.floor(fw / 2) + (pose.lean ?? 0);
  const base = fy + fh - 1;
  if (pose.kind === 'dead') {
    // a burst, deflated sack in a puddle
    for (let x = -14; x <= 14; x++) {
      const hh = Math.max(1, Math.round(5 - Math.abs(x) / 3));
      for (let j = 0; j < hh; j++) cv.px(cx + x, base - j, Math.abs(x) > 11 ? pal.pusD : j === hh - 1 ? pal.light : x % 4 ? pal.shade : pal.vein);
    }
    return;
  }
  const rx = Math.round(12 * (pose.sx ?? 1));
  const ry = Math.round(11 * (pose.sy ?? 1));
  const legH = 5;
  const cy = base - legH - ry + 3;
  // stubby legs with toes
  const step = pose.step ?? 0;
  for (const [lx, col] of [[-7 + step, pal.shade], [3 - step, pal.skin]]) {
    cv.rect(cx + lx, base - legH, 4, legH + 1, col);
    cv.rect(cx + lx + 3, base, 2, 1, col);
  }
  // the belly: sags low, lit from the upper right, a dark crease under it
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++) {
      const sag = y > 0 ? 1 + y / (ry * 4) : 1;
      const d = (x * x) / (rx * rx * sag * sag) + (y * y) / (ry * ry);
      if (d > 1) continue;
      let col = pal.skin;
      const light = x / rx - y / ry; // + = toward the light
      if (d > 0.84) col = pal.rim;
      else if (light > 0.9 && d < 0.5) col = pal.hi;
      else if (light > 0.3) col = pal.light;
      else if (light < -0.6) col = pal.dark;
      else if (light < -0.1) col = pal.shade;
      if (y > ry * 0.55 && d < 0.84 && d > 0.6) col = pal.dark; // underside crease
      // veins
      if (d < 0.8 && ((x * 3 + y * 7) % 19 === 0 || (x * 5 - y * 4) % 23 === 0)) col = pal.vein;
      cv.px(cx + x, cy + y, col);
    }
  // glowing boils
  for (const [px, py, r] of [[-5, -4, 1], [5, 4, 2], [-2, 7, 1], [8, -3, 1], [-8, 3, 1]]) {
    cv.disc(cx + px, cy + py, r, pal.pusD);
    cv.px(cx + px, cy + py, pal.pus);
    if (r > 1) cv.px(cx + px - 1, cy + py - 1, pal.pus);
  }
  // little head sunk into the top of the sack, facing right
  const hx = cx + Math.round(rx * 0.5);
  const hy = cy - ry + 1;
  cv.disc(hx, hy, 4, pal.rim);
  cv.disc(hx, hy, 3, pal.skin);
  cv.px(hx - 1, hy - 2, pal.light);
  cv.px(hx + 1, hy - 1, pal.eye);
  cv.px(hx + 3, hy - 1, pal.eye);
  const open = pose.mouth ?? 0;
  cv.rect(hx, hy + 1, 4, 1 + Math.round(open * 3), pal.mouth);
  if (!open) cv.px(hx + 2, hy + 2, pal.drool);
  else for (let i = 0; i < 3; i++) cv.px(hx + 4 + i, hy + 2 + i, pal.drool); // the belch spills out
  // a short arm
  limbPath(cv, [[cx + rx - 3, cy - 3], [cx + rx + 2, cy + 1], [cx + rx + 3 + (pose.reach ?? 0), cy + 6 - (pose.reach ?? 0)]], 3, 2, pal.shade, pal.rim);
}

export const CARRIER_SHEET = {
  key: 'carrier',
  fw: 64,
  fh: 48,
  draw: drawCarrier,
  outline: '#10140a',
  poses: {
    idle0: { sx: 1, sy: 1 },
    idle1: { sx: 1.04, sy: 0.97 },
    walk0: { step: 1 },
    walk1: { step: 0, sy: 1.03 },
    walk2: { step: -1 },
    walk3: { step: 0, sy: 1.03 },
    wind: { sx: 1.12, sy: 1.08, lean: -2 }, // gulping air
    strike: { sx: 0.95, sy: 0.95, lean: 2, mouth: 1 }, // the belch
    rec: { mouth: 0.4 },
    wind2: { sx: 0.92, sy: 1.12, lean: -1 },
    strike2: { sx: 1.18, sy: 0.82, lean: 4, reach: 3 },
    hurt: { sx: 1.1, sy: 0.92, lean: -3 },
    dead: { kind: 'dead' },
  },
};

// ------------------------------------------------------------------ Mire Leech (drawn)

function drawLeech(cv, pose, fx, fy, fw, fh) {
  const pal = {
    rim: '#120a12', back: '#2a1c2c', body: '#4a2e48', mid: '#664062', light: '#946488', gloss: '#c896b8',
    belly: '#9a7458', spot: '#d8b040', mouth: '#c42c48', inner: '#5a0c1c', tooth: '#f2ead4',
  };
  const cx = fx + Math.floor(fw / 2);
  const base = fy + fh - 1;
  if (pose.kind === 'dead') {
    for (let x = -10; x <= 10; x++) {
      cv.px(cx + x, base, x % 3 ? pal.body : pal.back);
      cv.px(cx + x, base - 1, x % 3 ? pal.mid : pal.body);
    }
    cv.px(cx + 10, base - 1, pal.mouth);
    return;
  }
  const len = Math.round(20 * (pose.len ?? 1));
  const arch = pose.arch ?? 0;
  const rear = pose.rear ?? 0;
  const x0 = cx - Math.floor(len / 2);
  const lift = (t) => Math.round(Math.sin(t * Math.PI) * arch + rear * t * t * 7);
  // segmented body, tail (left) to head (right), thickest in the middle
  for (let i = 0; i < len; i++) {
    const t = i / (len - 1);
    const th = Math.max(2, Math.round(2.5 + Math.sin(t * Math.PI) * 3.5));
    const y0 = base - lift(t);
    for (let j = 0; j < th; j++) {
      let col = pal.body;
      if (j === th - 1) col = pal.light; // top edge catches the light
      else if (j === th - 2) col = pal.mid;
      else if (j === 0) col = pal.belly;
      if (i % 3 === 0 && j > 0 && j < th - 1) col = pal.back; // segment rings
      cv.px(x0 + i, y0 - j, col);
    }
    // gloss streak + yellow dorsal spots
    if (i % 4 === 2 && th > 3) cv.px(x0 + i, y0 - th + 1, pal.spot);
    else if (i % 5 === 1 && th > 4) cv.px(x0 + i, y0 - th + 2, pal.gloss);
  }
  // tail sucker
  cv.disc(x0 - 1, base - lift(0) - 1, 1, pal.body);
  // the head sucker: a ring of teeth when it opens
  const mx = x0 + len;
  const my = base - lift(1) - 2;
  const open = !!pose.open;
  cv.disc(mx, my, open ? 3 : 2, pal.body);
  cv.disc(mx + 1, my, open ? 2 : 1, open ? pal.inner : pal.mouth);
  if (open) {
    cv.px(mx + 1, my, pal.mouth);
    for (const [dx, dy] of [[1, -2], [3, -1], [3, 1], [1, 2], [-1, 0]]) cv.px(mx + dx, my + dy, pal.tooth);
  } else cv.px(mx + 2, my, pal.mouth);
}

export const LEECH_SHEET = {
  key: 'leech',
  fw: 48,
  fh: 32,
  draw: drawLeech,
  outline: '#0c080c',
  poses: {
    idle0: { arch: 0 },
    idle1: { arch: 1, len: 0.95 },
    walk0: { arch: 2, len: 0.85 },
    walk1: { arch: 0, len: 1.05 },
    walk2: { arch: 3, len: 0.8 },
    walk3: { arch: 0, len: 1.1 },
    wind: { arch: 4, len: 0.75, rear: 1 },
    strike: { len: 1.25, rear: 0.5, open: true },
    rec: { arch: 1, open: true },
    hurt: { arch: 3, len: 0.85 },
    dead: { kind: 'dead' },
  },
};

// ------------------------------------------------------------------ The Mire Mother (drawn, huge)

function drawMother(cv, pose, fx, fy, fw, fh) {
  const pal = {
    rim: '#0e1408', dark: '#24301a', shade: '#3c4a2c', skin: '#5c6e44', light: '#82946a', hi: '#a8b88c',
    vein: '#5a2a3a', hair: '#1c2214', hairL: '#3a4228', eye: '#eef070', eyeD: '#7a7a1a', mouth: '#120a0c',
    tooth: '#d8d0b0', pus: '#d8ee6a', pusD: '#8aa830', moss: '#3a5a22', mossL: '#5a8030', shroom: '#c8e8a0', drip: '#9ac860',
  };
  const cx = fx + Math.floor(fw / 2) + (pose.lean ?? 0);
  const base = fy + fh - 1 + (pose.sink ?? 0);
  const ell = (ex, ey, rx, ry, shade) => {
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (d > 1 || ey + y > base) continue;
        cv.px(ex + x, ey + y, shade(x, y, d));
      }
  };
  const lit = (x, y, rx, ry, d) => {
    const l = x / rx - y / ry * 0.8;
    if (d > 0.88) return pal.rim;
    if (l > 1 && d < 0.45) return pal.hi;
    if (l > 0.35) return pal.light;
    if (l < -0.7) return pal.dark;
    if (l < -0.1) return pal.shade;
    return pal.skin;
  };
  if (pose.kind === 'dead') {
    // slumped into the mire: a mossy mound, one arm flung out
    ell(cx, base, 40, 14, (x, y, d) => (d > 0.9 ? pal.rim : (x * 5 + y * 3) % 11 === 0 ? pal.moss : lit(x, y, 40, 14, d)));
    limbPath(cv, [[cx + 20, base - 6], [cx + 38, base - 3], [cx + 52, base - 1]], 5, 3, pal.shade, pal.rim);
    return;
  }
  const sx = pose.sx ?? 1;
  const sy = pose.sy ?? 1;
  const hunch = pose.hunch ?? 0;
  const arm = pose.arm ?? 0; // 0 rest, 1 raised, 2 slammed, 3 both up (sinking)
  // the swollen lower body squatting in the water
  const rx = Math.round(36 * sx);
  const ry = Math.round(25 * sy);
  const by = base - ry + 8;
  // back arm first (behind everything): shoulder → elbow out behind → hand braced on the mass
  const tx = cx + 6;
  const tTop = by - ry - 14 + hunch;
  const bsh = [tx - 10, tTop + 8];
  if (arm === 3) limbPath(cv, [bsh, [bsh[0] - 10, bsh[1] - 10], [bsh[0] - 6, bsh[1] - 26]], 6, 4, pal.shade, pal.rim);
  else limbPath(cv, [bsh, [bsh[0] - 16, bsh[1] + 8], [bsh[0] - 22, by - ry + 12]], 6, 4, pal.shade, pal.rim);
  ell(cx, by, rx, ry, (x, y, d) => {
    let c = lit(x, y, rx, ry, d);
    // folds of fat across the belly
    if (d < 0.88 && y > -4 && Math.abs(y - 4 - Math.round((x * x) / 160)) < 0.6 && x > -rx * 0.5) c = pal.dark;
    if (d < 0.88 && y > 6 && Math.abs(y - 12 - Math.round((x * x) / 200)) < 0.6 && x > -rx * 0.4) c = pal.dark;
    if (d < 0.85 && ((x * 5 + y * 3) % 29 === 0 || (x * 2 - y * 7) % 37 === 0)) c = pal.vein;
    if (d < 0.8 && y < -ry * 0.4 && x < 0 && (x * 7 - y * 2) % 9 === 0) c = pal.moss; // moss over the back
    return c;
  });
  // boils on the flank
  for (const [px, py, r] of [[-22, -2, 2], [-12, 10, 1], [10, 12, 2], [22, 0, 1], [-28, 8, 1], [26, 10, 2]]) {
    cv.disc(cx + px, by + py, r, pal.pusD);
    cv.px(cx + px, by + py, pal.pus);
  }
  // little glowing mushrooms growing on her back
  for (const [mx, my] of [[-18, -ry + 4], [-10, -ry + 1], [-26, -ry + 9]]) {
    cv.rect(cx + mx, by + my, 1, 3, pal.hi);
    cv.rect(cx + mx - 1, by + my - 1, 3, 1, pal.shroom);
  }
  // hunched torso rising out of the mass: round-shouldered, leaning toward you
  const trx = 13;
  const try_ = 15;
  const tcy = tTop + try_;
  ell(tx, tcy, trx, try_, (x, y, d) => {
    let c = lit(x, y, trx, try_, d);
    if (x < -trx + 3 && d < 0.88 && y % 4 === 0) c = pal.light; // knobs of the spine
    if (d < 0.7 && y > 2 && Math.abs(x - 2) < 0.6) c = pal.shade; // sternum shadow
    return c;
  });
  // long lank hair hanging from the crown down the back
  const hx = tx + 10;
  const hy = tTop + 2 + Math.round(hunch / 2);
  for (let i = 0; i < 11; i++) {
    const sx0 = hx - 8 + i;
    const len = 12 + ((i * 7) % 9);
    cv.line(sx0, hy - 6, sx0 - 5 - (i % 3), hy - 6 + len, i % 3 ? pal.hair : pal.hairL);
  }
  // the head: heavy brow, a crown of glowing eyes, a wide drooling mouth (faces right)
  ell(hx, hy, 10, 8, (x, y, d) => (y < -3 && d > 0.5 ? pal.hair : lit(x, y, 10, 8, d)));
  cv.line(hx - 2, hy - 3, hx + 9, hy - 4, pal.dark);
  for (const [ex, ey] of [[3, -2], [6, -3], [9, -1], [4, 1], [8, 1], [1, 0]]) {
    cv.px(hx + ex, hy + ey, pal.eye);
    cv.px(hx + ex, hy + ey + 1, pal.eyeD);
  }
  const open = pose.mouth ?? 0;
  const mh = 1 + Math.round(open * 4);
  cv.rect(hx + 1, hy + 4, 9, mh, pal.mouth);
  for (let i = 0; i < 4; i++) {
    cv.px(hx + 2 + i * 2, hy + 4, pal.tooth);
    if (open > 0.5) cv.px(hx + 3 + i * 2, hy + 3 + mh, pal.tooth);
  }
  cv.line(hx + 8, hy + 4 + mh, hx + 9, hy + 9 + mh, pal.drip);
  // front arm: shoulder → elbow → hand, tapering, with long claws
  const sh = [tx + 9, tTop + 8];
  const pts =
    arm === 1 ? [sh, [sh[0] + 12, sh[1] - 6], [sh[0] + 10, sh[1] - 24]]
      : arm === 2 ? [sh, [sh[0] + 16, sh[1] + 8], [sh[0] + 30, base - 3]]
        : arm === 3 ? [sh, [sh[0] + 8, sh[1] - 10], [sh[0] + 4, sh[1] - 26]]
          : [sh, [sh[0] + 14, sh[1] + 10], [sh[0] + 18, sh[1] + 26]];
  limbPath(cv, pts, 7, 4, pal.skin, pal.rim);
  const [hx2, hy2] = pts[2];
  const down = arm === 1 || arm === 3 ? -1 : 1;
  for (const k of [-2, 0, 2]) cv.line(hx2, hy2, hx2 + 3 + Math.abs(k) / 2, hy2 + down * 4 + k, pal.tooth);
}

export const MOTHER_SHEET = {
  key: 'mother',
  fw: 160,
  fh: 112,
  draw: drawMother,
  outline: '#0a0e06',
  poses: {
    idle0: { sy: 1 },
    idle1: { sy: 1.03, hunch: 1 },
    walk0: { lean: 1, hunch: 1 },
    walk1: { lean: 2, sy: 1.02 },
    walk2: { lean: 1, hunch: 1 },
    walk3: { lean: 0, sy: 1.02 },
    spitW: { hunch: -4, mouth: 0.3, sy: 1.06, arm: 0 },
    spitS: { hunch: 3, mouth: 1, lean: 3 },
    rec: { mouth: 0.3 },
    slamW: { arm: 1, hunch: -3, lean: -2, sy: 1.05 },
    slamS: { arm: 2, hunch: 5, lean: 4, sy: 0.96, mouth: 0.8 },
    slamR: { arm: 2, hunch: 4, lean: 3 },
    sink: { arm: 3, sink: 18, sy: 0.9, mouth: 1 },
    hurt: { lean: -4, hunch: 2, mouth: 0.6 },
    dead: { kind: 'dead' },
  },
};

// ------------------------------------------------------------------ player gear

/** extra player armors: palette variants of the existing looks */
export const FM_ARMORS = (HEADS) => ({
  /** grey wool cowl and rimed mail */
  frostbound_mantle: {
    head: HEADS.hood,
    torso: 'plate',
    pauldron: PAULDRONS.small,
    cape: { w: 4 },
    legs: { back: '#2a303c', front: '#3e4656', lit: '#56607a' },
    pal: {
      D: '#4a5468', M: '#7a88a0', L: '#a8b8cc', H: '#dce8f4',
      k: '#2a3240', c: '#4a5468', C: '#6a7890',
    },
  },
  /** stitched mire-hide, mottled green */
  mire_leathers: {
    head: HEADS.hood,
    torso: 'leather',
    cape: { w: 4 },
    legs: { back: '#22281a', front: '#343e26', lit: '#4a5636' },
    pal: { D: '#2e3a20', M: '#4a5a32', L: '#6a7a48', H: '#8a9a62', k: '#1e2616', c: '#34421e', C: '#4e5e2e' },
  },
});

export const FM_PLAYER_WEAPONS = {
  frost_spear: { grid: FM_WEAPONS.playerSpear, pal: ICE_BLADE },
};
